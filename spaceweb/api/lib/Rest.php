<?php
/**
 * Подмножество PostgREST — ровно то, чем пользуется сайт через supabase-js:
 *   GET/HEAD /rest/v1/<таблица>?select=…&<фильтры>&or=(…)&order=…&limit=…&offset=…
 *   POST (вставка, upsert), PATCH (изменение), DELETE — с return=representation и select;
 *   POST /rest/v1/rpc/<функция> — вызов функции, у табличных результатов тоже select/фильтры.
 * Вложенные выборки (species(slug), cover:plant_photos!plants_cover_photo_fk(…), x!inner(…),
 * entries:contest_entries(count)) строятся подзапросами по внешним ключам, JSON собирает сама база.
 *
 * Безопасность — как в Supabase: запрос идёт от имени пользователя (правила RLS в базе), таблицы,
 * колонки и функции проверяются по правам ролей из api.*_privileges, имена — по каталогу схемы.
 */
final class Rest
{
    private const RESERVED = ['select', 'order', 'limit', 'offset', 'on_conflict', 'columns', 'or', 'and', 'not.or', 'not.and'];
    private const OPERATORS = [
        'eq' => '=', 'neq' => '<>', 'gt' => '>', 'gte' => '>=', 'lt' => '<', 'lte' => '<=',
        'like' => 'like', 'ilike' => 'ilike', 'cs' => '@>', 'cd' => '<@', 'ov' => '&&',
    ];

    private Schema $schema;
    /** @var array<string, mixed> */
    private array $params = [];
    private int $aliasCount = 0;
    /** Параметры строки запроса, разобранные по пути вложенности: '' — корень, 'plants' — вложенная. */
    private array $filters = [];
    private array $orders = [];
    private array $limits = [];
    private array $logic = [];

    private function __construct(private readonly PDO $db, private readonly string $role)
    {
        $this->schema = new Schema($db, $role);
    }

    public static function handle(string $method, string $path): never
    {
        $claims = Auth::claims();
        $role = $claims['role'] ?? 'anon';
        if (!in_array($role, ['anon', 'authenticated'], true)) {
            $role = 'anon';
        }
        [$status, $body, $headers] = Db::asUser($claims, function (PDO $db) use ($method, $path, $role) {
            try {
                $rest = new self($db, $role);
                $rest->parseQuery();
                return str_starts_with($path, 'rpc/')
                    ? $rest->rpc($method, substr($path, 4))
                    : $rest->table($method, $path);
            } catch (PDOException $e) {
                throw Db::toApiError($e, $role === 'anon');
            }
        });
        if ($body === null) {
            Http::empty($status, $headers);
        }
        Http::json($status, $body, $headers);
    }

    // --- Разбор строки запроса ------------------------------------------------------------------

    private array $select = [['type' => 'star']];
    private ?string $onConflict = null;

    private function parseQuery(): void
    {
        foreach (Http::query() as [$key, $value]) {
            if ($key === 'select') {
                $this->select = $this->parseSelect($value);
                continue;
            }
            if ($key === 'on_conflict') {
                $this->onConflict = $value;
                continue;
            }
            if ($key === 'columns') {
                continue;
            }
            // Путь вложенности: «plants.owner_id» — фильтр по колонке owner_id вложенной plants.
            $dot = strrpos($key, '.');
            $path = $dot === false ? '' : substr($key, 0, $dot);
            $name = $dot === false ? $key : substr($key, $dot + 1);
            if (in_array($key, ['not.or', 'not.and'], true) || (str_ends_with($key, '.not.or') || str_ends_with($key, '.not.and'))) {
                $path = substr($key, 0, max(0, strlen($key) - strlen(str_ends_with($key, 'or') ? 'not.or' : 'not.and') - 1));
                $name = str_ends_with($key, 'or') ? 'or' : 'and';
                $this->logic[$path][] = ['logic' => $name, 'neg' => true, 'items' => $this->parseLogicList($value)];
                continue;
            }
            match ($name) {
                'order' => $this->orders[$path] = $this->parseOrder($value),
                'limit' => $this->limits[$path]['limit'] = max(0, (int) $value),
                'offset' => $this->limits[$path]['offset'] = max(0, (int) $value),
                'or', 'and' => $this->logic[$path][] = ['logic' => $name, 'neg' => false, 'items' => $this->parseLogicList($value)],
                default => $this->filters[$path][] = $this->parseCondition($name, $value),
            };
        }
    }

    /** select=*, a, alias:b, x::text, rel(…), alias:rel!hint!inner(…), count */
    private function parseSelect(string $s): array
    {
        $items = [];
        foreach ($this->splitTop($s) as $part) {
            $part = trim($part);
            if ($part === '') {
                continue;
            }
            if ($part === '*') {
                $items[] = ['type' => 'star'];
            } elseif (preg_match('/^(?:(\w+):)?(\w+)((?:!\w+)*)\((.*)\)$/s', $part, $m)) {
                if ($m[2] === 'count' && trim($m[4]) === '') {
                    $items[] = ['type' => 'count', 'alias' => $m[1] ?: 'count'];
                    continue;
                }
                $hint = null;
                $inner = false;
                foreach (array_filter(explode('!', $m[3])) as $flag) {
                    if ($flag === 'inner') {
                        $inner = true;
                    } elseif ($flag !== 'left') {
                        $hint = $flag;
                    }
                }
                $items[] = ['type' => 'embed', 'name' => $m[2], 'alias' => $m[1] ?: $m[2], 'hint' => $hint,
                            'inner' => $inner, 'items' => $this->parseSelect($m[4])];
            } elseif (preg_match('/^(?:(\w+):)?(\w+)(?:::(\w+))?$/', $part, $m)) {
                $items[] = ['type' => 'col', 'name' => $m[2], 'alias' => $m[1] ?: $m[2], 'cast' => $m[3] ?? null];
            } else {
                throw new ApiError(400, "failed to parse select parameter ($part)", 'PGRST100');
            }
        }
        return $items ?: [['type' => 'star']];
    }

    /** order=a.desc.nullslast,b */
    private function parseOrder(string $s): array
    {
        $out = [];
        foreach ($this->splitTop($s) as $part) {
            $bits = explode('.', trim($part));
            $col = array_shift($bits);
            $dir = in_array('desc', $bits, true) ? 'desc' : 'asc';
            $nulls = in_array('nullsfirst', $bits, true) ? ' nulls first' : (in_array('nullslast', $bits, true) ? ' nulls last' : '');
            $out[] = [$col, $dir . $nulls];
        }
        return $out;
    }

    /** Значение фильтра: «eq.5», «not.is.null», «in.(a,"b,c")», «ilike.*мон*». */
    private function parseCondition(string $col, string $value): array
    {
        $neg = false;
        if (str_starts_with($value, 'not.')) {
            $neg = true;
            $value = substr($value, 4);
        }
        $dot = strpos($value, '.');
        if ($dot === false) {
            throw new ApiError(400, "failed to parse filter ($col=$value)", 'PGRST100');
        }
        return ['col' => $col, 'op' => substr($value, 0, $dot), 'neg' => $neg, 'val' => substr($value, $dot + 1)];
    }

    /** (a.eq.1,and(b.eq.2,c.gte.3),not.or(…)) */
    private function parseLogicList(string $s): array
    {
        $s = trim($s);
        if (!str_starts_with($s, '(') || !str_ends_with($s, ')')) {
            throw new ApiError(400, "failed to parse logic tree ($s)", 'PGRST100');
        }
        $items = [];
        foreach ($this->splitTop(substr($s, 1, -1)) as $part) {
            $part = trim($part);
            if (preg_match('/^(not\.)?(and|or)(\(.*\))$/s', $part, $m)) {
                $items[] = ['logic' => $m[2], 'neg' => $m[1] !== '', 'items' => $this->parseLogicList($m[3])];
            } else {
                $dot = strpos($part, '.');
                if ($dot === false) {
                    throw new ApiError(400, "failed to parse logic tree ($part)", 'PGRST100');
                }
                $items[] = $this->parseCondition(substr($part, 0, $dot), substr($part, $dot + 1));
            }
        }
        return $items;
    }

    /** Разбивка по запятым верхнего уровня — без учёта скобок и строк в кавычках. */
    private function splitTop(string $s): array
    {
        $parts = [];
        $depth = 0;
        $quoted = false;
        $cur = '';
        for ($i = 0, $n = strlen($s); $i < $n; $i++) {
            $ch = $s[$i];
            if ($ch === '"' && ($i === 0 || $s[$i - 1] !== '\\')) {
                $quoted = !$quoted;
            } elseif (!$quoted && $ch === '(') {
                $depth++;
            } elseif (!$quoted && $ch === ')') {
                $depth--;
            } elseif (!$quoted && $depth === 0 && $ch === ',') {
                $parts[] = $cur;
                $cur = '';
                continue;
            }
            $cur .= $ch;
        }
        $parts[] = $cur;
        return $parts;
    }

    // --- Построение SQL -------------------------------------------------------------------------

    private function param(mixed $value): string
    {
        $name = ':p' . (count($this->params) + 1);
        $this->params[$name] = is_bool($value) ? ($value ? 't' : 'f') : $value;
        return $name;
    }

    private function alias(): string
    {
        return 't' . (++$this->aliasCount);
    }

    private static function q(string $ident): string
    {
        return '"' . str_replace('"', '""', $ident) . '"';
    }

    /** Условие для одной колонки. */
    private function conditionSql(string $rel, string $alias, array $c): string
    {
        if (isset($c['logic'])) {
            $parts = array_map(fn ($x) => $this->conditionSql($rel, $alias, $x), $c['items']);
            $sql = '(' . implode($c['logic'] === 'or' ? ' or ' : ' and ', $parts ?: ['true']) . ')';
            return $c['neg'] ? "not $sql" : $sql;
        }
        $this->schema->requireColumn($rel, $c['col']);
        $col = $alias . '.' . self::q($c['col']);
        $val = $c['val'];
        $sql = match (true) {
            $c['op'] === 'is' => match (strtolower($val)) {
                'null' => "$col is null",
                'not_null' => "$col is not null",
                'true' => "$col is true",
                'false' => "$col is false",
                'unknown' => "$col is unknown",
                default => throw new ApiError(400, "failed to parse filter (is.$val)", 'PGRST100'),
            },
            $c['op'] === 'in' => "$col = any(" . $this->param($this->pgArray($this->parseInList($val))) . ')',
            in_array($c['op'], ['like', 'ilike'], true) => "$col " . self::OPERATORS[$c['op']] . ' ' . $this->param(str_replace('*', '%', $val)),
            isset(self::OPERATORS[$c['op']]) => "$col " . self::OPERATORS[$c['op']] . ' ' . $this->param($val),
            default => throw new ApiError(400, "unknown operator {$c['op']}", 'PGRST100'),
        };
        return $c['neg'] ? "not ($sql)" : $sql;
    }

    private function parseInList(string $val): array
    {
        $val = trim($val);
        if (!str_starts_with($val, '(') || !str_ends_with($val, ')')) {
            throw new ApiError(400, "failed to parse filter (in.$val)", 'PGRST100');
        }
        $out = [];
        foreach ($this->splitTop(substr($val, 1, -1)) as $item) {
            $item = trim($item);
            if (strlen($item) >= 2 && $item[0] === '"' && str_ends_with($item, '"')) {
                $item = stripcslashes(substr($item, 1, -1));
            }
            $out[] = $item;
        }
        return $out;
    }

    private function pgArray(array $items): string
    {
        return '{' . implode(',', array_map(fn ($v) => '"' . addcslashes((string) $v, '"\\') . '"', $items)) . '}';
    }

    /** Все условия уровня вложенности $path — фильтры и or/and. */
    private function whereFor(string $rel, string $alias, string $path): array
    {
        $parts = [];
        foreach ($this->filters[$path] ?? [] as $c) {
            $parts[] = $this->conditionSql($rel, $alias, $c);
        }
        foreach ($this->logic[$path] ?? [] as $c) {
            $parts[] = $this->conditionSql($rel, $alias, $c);
        }
        return $parts;
    }

    private function orderFor(string $rel, string $alias, string $path): string
    {
        if (!isset($this->orders[$path])) {
            return '';
        }
        $parts = [];
        foreach ($this->orders[$path] as [$col, $dir]) {
            $this->schema->requireColumn($rel, $col);
            $parts[] = "$alias." . self::q($col) . " $dir";
        }
        return ' order by ' . implode(', ', $parts);
    }

    private function limitFor(string $path): string
    {
        $l = $this->limits[$path] ?? [];
        return (isset($l['limit']) ? ' limit ' . (int) $l['limit'] : '') . (isset($l['offset']) ? ' offset ' . (int) $l['offset'] : '');
    }

    /**
     * Колонки выборки и условия для !inner-вложений (их надо добавить в where родителя).
     * @return array{0: string, 1: list<string>}
     */
    private function projection(string $rel, string $alias, array $items, string $path): array
    {
        $cols = [];
        $innerConds = [];
        $named = [];
        $star = false;
        foreach ($items as $it) {
            switch ($it['type']) {
                case 'star':
                    $star = true;
                    $cols[] = "$alias.*";
                    break;
                case 'col':
                    $this->schema->requireColumn($rel, $it['name']);
                    $named[] = $it['name'];
                    $cols[] = "$alias." . self::q($it['name']) . ($it['cast'] ? '::' . $it['cast'] : '') . ' as ' . self::q($it['alias']);
                    break;
                case 'count':
                    // count() поддерживается только во вложенных выборках: entries:contest_entries(count).
                    throw new ApiError(400, 'count() — только во вложенной выборке', 'PGRST100');
                case 'embed':
                    [$sql, $inner] = $this->embed($rel, $alias, $it, $path);
                    $cols[] = "$sql as " . self::q($it['alias']);
                    if ($inner !== null) {
                        $innerConds[] = $inner;
                    }
                    break;
            }
        }
        $this->schema->requirePrivilege($rel, 'SELECT', $star ? null : $named);
        return [implode(', ', $cols) ?: "$alias.*", $innerConds];
    }

    /**
     * Вложенная выборка по внешнему ключу. Многие-к-одному → объект (или null), один-ко-многим → массив.
     * @return array{0: string, 1: ?string}  подзапрос и условие exists для !inner
     */
    private function embed(string $parentRel, string $parentAlias, array $it, string $parentPath): array
    {
        // Фильтры вложенной таблицы задаются по псевдониму («post.kind»), а без него — по имени.
        $prefix = $parentPath === '' ? '' : "$parentPath.";
        $path = $prefix . $it['alias'];
        $byName = $prefix . $it['name'];
        if ($byName !== $path) {
            foreach (['filters', 'orders', 'limits', 'logic'] as $prop) {
                if (isset($this->{$prop}[$byName]) && !isset($this->{$prop}[$path])) {
                    $this->{$prop}[$path] = $this->{$prop}[$byName];
                }
            }
        }
        $r = $this->schema->relationship($parentRel, $it['name'], $it['hint']);
        $target = $r['target'];
        $a = $this->alias();
        $join = array_map(fn ($p) => "$a." . self::q($p[1]) . " = $parentAlias." . self::q($p[0]), $r['pairs']);
        $where = array_merge($join, $this->whereFor($target, $a, $path));
        $from = 'public.' . self::q($target) . " $a";

        $inner = null;
        if ($it['inner']) {
            $b = $this->alias();
            $joinB = array_map(fn ($p) => "$b." . self::q($p[1]) . " = $parentAlias." . self::q($p[0]), $r['pairs']);
            $inner = 'exists (select 1 from public.' . self::q($target) . " $b where "
                   . implode(' and ', array_merge($joinB, $this->whereFor($target, $b, $path))) . ')';
        }

        // «count» без скобок — тоже подсчёт, если такой колонки в таблице нет.
        $it['items'] = array_map(fn ($x) => $x['type'] === 'col' && $x['name'] === 'count' && !isset($this->schema->columns[$target]['count'])
            ? ['type' => 'count', 'alias' => $x['alias']] : $x, $it['items']);
        $onlyCount = count($it['items']) === 1 && $it['items'][0]['type'] === 'count';
        if ($onlyCount) {
            $this->schema->requirePrivilege($target, 'SELECT', []);
            $key = $it['items'][0]['alias'];
            $agg = "json_build_object('$key', count(*))";
            $sql = "(select " . ($r['many'] ? "json_build_array($agg)" : $agg) . " from $from where " . implode(' and ', $where) . ')';
            return [$sql, $inner];
        }

        [$cols, $innerConds] = $this->projection($target, $a, $it['items'], $path);
        $where = implode(' and ', array_merge($where, $innerConds));
        if ($r['many']) {
            $sql = "(select coalesce(json_agg(_x), '[]'::json) from (select $cols from $from where $where"
                 . $this->orderFor($target, $a, $path) . $this->limitFor($path) . ') _x)';
        } else {
            $sql = "(select to_json(_x) from (select $cols from $from where $where limit 1) _x)";
        }
        return [$sql, $inner];
    }

    /** Выборка из источника (таблица, представление или результат функции) в JSON-массив. */
    private function readQuery(string $rel, string $source): array
    {
        $a = 't0';
        [$cols, $innerConds] = $this->projection($rel, $a, $this->select, '');
        $where = array_merge($this->whereFor($rel, $a, ''), $innerConds);
        $whereSql = $where ? ' where ' . implode(' and ', $where) : '';
        $inner = "select $cols from $source $a$whereSql" . $this->orderFor($rel, $a, '') . $this->limitFor('');
        return [$inner, "select $a.* from $source $a$whereSql"];
    }

    // --- Таблицы --------------------------------------------------------------------------------

    private function table(string $method, string $rel): array
    {
        if (!$this->schema->hasRelation($rel)) {
            throw new ApiError(404, "relation \"public.$rel\" does not exist", '42P01');
        }
        return match ($method) {
            'GET', 'HEAD' => $this->read($rel, 'public.' . self::q($rel), $method === 'HEAD'),
            'POST' => $this->insert($rel),
            'PATCH' => $this->update($rel),
            'DELETE' => $this->delete($rel),
            default => throw new ApiError(405, 'Method not allowed'),
        };
    }

    private function read(string $rel, string $source, bool $head): array
    {
        [$inner, $countSql] = $this->readQuery($rel, $source);
        $prefer = $this->prefer();
        $headers = [];
        $total = '*';
        if (($prefer['count'] ?? null) !== null) {
            $total = (int) Db::value($this->db, "select count(*) from ($countSql) _c", $this->paramsFor($countSql));
        }
        if ($head) {
            $headers['Content-Range'] = "*/$total";
            return [200, null, $headers];
        }
        [$json, $n] = $this->runJson($inner);
        $offset = $this->limits['']['offset'] ?? 0;
        $headers['Content-Range'] = ($n > 0 ? $offset . '-' . ($offset + $n - 1) : '*') . "/$total";
        return [200, $this->shape($json, $n), $headers];
    }

    /** Выполняет выборку и возвращает [JSON-массив, число строк]. */
    private function runJson(string $inner): array
    {
        $row = Db::row($this->db, "select coalesce(json_agg(_r), '[]'::json)::text as j, count(*) as n from ($inner) _r", $this->paramsFor($inner));
        return [$row['j'], (int) $row['n']];
    }

    /** Параметры, которые встречаются в SQL (PDO не принимает лишние). */
    private function paramsFor(string $sql): array
    {
        preg_match_all('/:p\d+\b/', $sql, $m);
        return array_intersect_key($this->params, array_flip($m[0]));
    }

    /** .single() / .maybeSingle(): Accept: application/vnd.pgrst.object+json — один объект. */
    private function shape(string $json, int $n): string
    {
        if (!str_contains(Http::header('Accept') ?? '', 'vnd.pgrst.object')) {
            return $json;
        }
        if ($n !== 1) {
            throw new ApiError(406, 'JSON object requested, multiple (or no) rows returned', 'PGRST116',
                "The result contains $n rows");
        }
        return json_encode(json_decode($json, true)[0], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    /** Заголовок Prefer: return, count, resolution, missing. */
    private function prefer(): array
    {
        $out = [];
        foreach (preg_split('/\s*,\s*/', Http::header('Prefer') ?? '', -1, PREG_SPLIT_NO_EMPTY) as $p) {
            [$k, $v] = array_pad(explode('=', $p, 2), 2, '');
            $out[trim($k)] = trim($v);
        }
        return $out;
    }

    /** Результат записи: представление (select после insert/update/delete) или пусто. */
    private function writeResult(string $rel, string $writeSql, int $okStatus): array
    {
        $prefer = $this->prefer();
        if (($prefer['return'] ?? 'minimal') !== 'representation') {
            Db::run($this->db, $writeSql, $this->paramsFor($writeSql));
            return [$okStatus === 201 ? 201 : 204, null, []];
        }
        [$cols, $innerConds] = $this->projection($rel, 't0', $this->select, '');
        $where = $innerConds ? ' where ' . implode(' and ', $innerConds) : '';
        $sql = "with _w as ($writeSql) select coalesce(json_agg(_r), '[]'::json)::text as j, count(*) as n from "
             . "(select $cols from _w t0$where" . $this->orderFor($rel, 't0', '') . ') _r';
        $row = Db::row($this->db, $sql, $this->paramsFor($sql));
        return [$okStatus, $this->shape($row['j'], (int) $row['n']), []];
    }

    private function insert(string $rel): array
    {
        $body = Http::body();
        $rows = is_array($body) && array_is_list($body) ? $body : [$body];
        if ($rows === [] || !is_array($rows[0])) {
            throw new ApiError(400, 'Empty or invalid json', 'PGRST102');
        }
        $cols = [];
        foreach ($rows as $row) {
            foreach (array_keys($row) as $c) {
                $this->schema->requireColumn($rel, $c);
                $cols[$c] = true;
            }
        }
        $cols = array_keys($cols);
        $this->schema->requirePrivilege($rel, 'INSERT', $cols);
        $list = implode(', ', array_map([self::class, 'q'], $cols));
        $t = 'public.' . self::q($rel);
        $sql = "insert into $t ($list) select $list from json_populate_recordset(null::$t, "
             . $this->param(json_encode($rows, JSON_UNESCAPED_UNICODE)) . '::json) _j';

        $resolution = $this->prefer()['resolution'] ?? null;
        if ($resolution !== null) {
            $conflict = $this->onConflict !== null ? array_map('trim', explode(',', $this->onConflict)) : ($this->schema->primaryKeys[$rel] ?? []);
            foreach ($conflict as $c) {
                $this->schema->requireColumn($rel, $c);
            }
            $target = '(' . implode(', ', array_map([self::class, 'q'], $conflict)) . ')';
            if ($resolution === 'ignore-duplicates') {
                $sql .= " on conflict $target do nothing";
            } else {
                $update = array_diff($cols, $conflict);
                $this->schema->requirePrivilege($rel, 'UPDATE', array_values($update));
                $sql .= " on conflict $target " . ($update === [] ? 'do nothing'
                     : 'do update set ' . implode(', ', array_map(fn ($c) => self::q($c) . ' = excluded.' . self::q($c), $update)));
            }
        }
        return $this->writeResult($rel, "$sql returning *", 201);
    }

    private function update(string $rel): array
    {
        $body = Http::body();
        if (!is_array($body) || array_is_list($body) || $body === []) {
            throw new ApiError(400, 'Empty or invalid json', 'PGRST102');
        }
        $cols = array_keys($body);
        foreach ($cols as $c) {
            $this->schema->requireColumn($rel, $c);
        }
        $this->schema->requirePrivilege($rel, 'UPDATE', $cols);
        $t = 'public.' . self::q($rel);
        $set = implode(', ', array_map(fn ($c) => self::q($c) . ' = _j.' . self::q($c), $cols));
        $where = $this->whereFor($rel, 't0', '');
        $sql = "update $t t0 set $set from json_populate_record(null::$t, "
             . $this->param(json_encode($body, JSON_UNESCAPED_UNICODE)) . '::json) _j'
             . ($where ? ' where ' . implode(' and ', $where) : '') . ' returning t0.*';
        return $this->writeResult($rel, $sql, 200);
    }

    private function delete(string $rel): array
    {
        $this->schema->requirePrivilege($rel, 'DELETE');
        $where = $this->whereFor($rel, 't0', '');
        $sql = 'delete from public.' . self::q($rel) . ' t0' . ($where ? ' where ' . implode(' and ', $where) : '') . ' returning t0.*';
        return $this->writeResult($rel, $sql, 200);
    }

    // --- Функции (rpc) --------------------------------------------------------------------------

    private function rpc(string $method, string $name): array
    {
        if (!in_array($method, ['POST', 'GET', 'HEAD'], true)) {
            throw new ApiError(405, 'Method not allowed');
        }
        $args = $method === 'POST' ? (Http::body() ?? []) : [];
        if (!is_array($args) || ($args !== [] && array_is_list($args))) {
            throw new ApiError(400, 'Аргументы функции — объект JSON', 'PGRST102');
        }
        $fn = $this->findFunction($name, array_keys($args));
        $this->schema->requireRoutine($name);

        $call = [];
        foreach ($args as $arg => $value) {
            $type = $fn['types'][$arg];
            $call[] = self::q($arg) . ' => ' . $this->argSql($type, $value);
        }
        $expr = 'public.' . self::q($name) . '(' . implode(', ', $call) . ')';

        if ($fn['rettype'] === 'void') {
            Db::run($this->db, "select $expr", $this->paramsFor($expr));
            return [204, null, []];
        }
        // Табличный результат: setof таблица, returns table(…) или составной тип — с select/фильтрами.
        if ($fn['retset'] || $fn['typtype'] === 'c') {
            $rel = $fn['relname'];
            if ($rel === null) {
                // returns table (…): колонки берём из описания функции.
                $rel = '__rpc_' . $name;
                $this->schema->columns[$rel] = $fn['outcols'];
                $this->schema->grantAll($rel);
            }
            [$status, $body, $headers] = $this->read($rel, $expr, $method === 'HEAD');
            if (!$fn['retset'] && $body !== null && !str_contains(Http::header('Accept') ?? '', 'vnd.pgrst.object')) {
                $list = json_decode($body, true);
                $body = json_encode($list[0] ?? null, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            }
            return [$status, $body, $headers];
        }
        $json = Db::value($this->db, "select to_json($expr)::text", $this->paramsFor($expr));
        return [200, $json ?? 'null', []];
    }

    /** Значение аргумента: массивы и json — из JSON, остальное — текстом с приведением типа. */
    private function argSql(string $type, mixed $value): string
    {
        if ($value === null) {
            return "null::$type";
        }
        if (str_ends_with($type, '[]')) {
            if (!is_array($value)) {
                throw new ApiError(400, "Аргумент типа $type — массив", 'PGRST102');
            }
            $elem = substr($type, 0, -2);
            return "(select coalesce(array_agg(x::$elem), '{}') from json_array_elements_text("
                 . $this->param(json_encode($value, JSON_UNESCAPED_UNICODE)) . "::json) x)::$type";
        }
        if (in_array($type, ['json', 'jsonb'], true)) {
            return $this->param(json_encode($value, JSON_UNESCAPED_UNICODE)) . "::$type";
        }
        if (is_array($value)) {
            throw new ApiError(400, "Аргумент типа $type — не объект", 'PGRST102');
        }
        return $this->param(is_bool($value) ? $value : (string) $value) . "::$type";
    }

    /** Функция public.<name>, у которой есть все переданные аргументы и хватает обязательных. */
    private function findFunction(string $name, array $given): array
    {
        $rows = Db::run($this->db, <<<'SQL'
            select p.proname, p.proretset, t.typtype, format_type(p.prorettype, null) as rettype,
                   (select c.relname from pg_class c join pg_namespace cn on cn.oid = c.relnamespace
                     where c.oid = t.typrelid and cn.nspname = 'public') as relname,
                   p.pronargs, p.pronargdefaults,
                   coalesce(p.proargnames, '{}') as names,
                   coalesce(p.proargmodes::text[], array_fill('i'::text, array[cardinality(coalesce(p.proallargtypes, p.proargtypes::oid[]))])) as modes,
                   (select array_agg(format_type(x, null) order by o)
                      from unnest(coalesce(p.proallargtypes, p.proargtypes::oid[])) with ordinality u(x, o)) as types
              from pg_proc p
              join pg_namespace n on n.oid = p.pronamespace
              join pg_type t on t.oid = p.prorettype
             where n.nspname = 'public' and p.proname = :p0
            SQL, [':p0' => $name])->fetchAll();
        $parse = static fn ($a) => is_array($a) ? $a : str_getcsv(trim((string) $a, '{}'), ',', '"', '\\');
        foreach ($rows as $r) {
            $names = $parse($r['names']);
            $modes = $parse($r['modes']);
            $types = $parse($r['types']);
            $in = [];
            $out = [];
            foreach ($types as $i => $type) {
                $mode = $modes[$i] ?? 'i';
                $argName = $names[$i] ?? '';
                if (in_array($mode, ['i', 'b', 'v'], true)) {
                    $in[$argName] = $type;
                }
                if (in_array($mode, ['o', 'b', 't'], true)) {
                    $out[$argName] = $type;
                }
            }
            $required = array_slice(array_keys($in), 0, (int) $r['pronargs'] - (int) $r['pronargdefaults']);
            if (array_diff($given, array_keys($in)) === [] && array_diff($required, $given) === []) {
                return [
                    'types' => $in,
                    'outcols' => $out,
                    'retset' => (bool) $r['proretset'],
                    'typtype' => $r['typtype'],
                    'rettype' => $r['rettype'],
                    'relname' => $r['relname'],
                ];
            }
        }
        throw new ApiError(404, "Could not find the function public.$name(" . implode(', ', $given) . ') in the schema cache', 'PGRST202');
    }
}
