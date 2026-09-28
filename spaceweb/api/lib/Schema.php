<?php
/**
 * Что есть в схеме public: таблицы и представления с колонками, внешние ключи (для вложенных
 * выборок), первичные ключи и права ролей API (перенесены из Supabase в api.*_privileges).
 * Читается одним запросом на каждый вызов API — схема маленькая.
 */
final class Schema
{
    /** @var array<string, array<string, string>> relation → column → type */
    public array $columns = [];
    /** @var array<string, list<string>> */
    public array $primaryKeys = [];
    /** @var array<string, list<list<string>>> relation → уникальные наборы колонок (PK и unique) */
    private array $uniques = [];
    /** @var list<array{name: string, table: string, cols: list<string>, ftable: string, fcols: list<string>}> */
    public array $foreignKeys = [];
    /** @var array<string, array<string, true>> relation → privilege */
    private array $tablePrivs = [];
    /** @var array<string, array<string, array<string, true>>> relation → privilege → column */
    private array $columnPrivs = [];
    /** @var array<string, true> */
    private array $routines = [];

    public function __construct(PDO $db, public readonly string $role)
    {
        $json = Db::value($db, <<<'SQL'
            select json_build_object(
              'columns', (select json_object_agg(relname, cols) from (
                  select c.relname, json_object_agg(a.attname, format_type(a.atttypid, a.atttypmod) order by a.attnum) cols
                    from pg_class c
                    join pg_namespace n on n.oid = c.relnamespace
                    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
                   where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p')
                   group by c.relname) x),
              'pkeys', (select json_object_agg(relname, cols) from (
                  select c.relname, json_agg(a.attname order by k.ord) cols
                    from pg_constraint con
                    join pg_class c on c.oid = con.conrelid
                    join pg_namespace n on n.oid = c.relnamespace
                    cross join unnest(con.conkey) with ordinality k(attnum, ord)
                    join pg_attribute a on a.attrelid = c.oid and a.attnum = k.attnum
                   where con.contype = 'p' and n.nspname = 'public'
                   group by c.relname) x),
              'uniques', (select json_agg(json_build_array(relname, cols)) from (
                  select c.relname, json_agg(a.attname order by a.attname) cols
                    from pg_constraint con
                    join pg_class c on c.oid = con.conrelid
                    join pg_namespace n on n.oid = c.relnamespace
                    cross join unnest(con.conkey) k(attnum)
                    join pg_attribute a on a.attrelid = c.oid and a.attnum = k.attnum
                   where con.contype in ('p', 'u') and n.nspname = 'public'
                   group by con.oid, c.relname) x),
              'fkeys', (select json_agg(json_build_object('name', conname, 'table', tbl, 'cols', cols, 'ftable', ftbl, 'fcols', fcols)) from (
                  select con.conname, c.relname tbl, f.relname ftbl,
                         json_agg(a.attname order by k.ord) cols, json_agg(fa.attname order by k.ord) fcols
                    from pg_constraint con
                    join pg_class c on c.oid = con.conrelid
                    join pg_class f on f.oid = con.confrelid
                    join pg_namespace n on n.oid = c.relnamespace
                    join pg_namespace fn on fn.oid = f.relnamespace
                    cross join unnest(con.conkey, con.confkey) with ordinality k(attnum, fattnum, ord)
                    join pg_attribute a on a.attrelid = c.oid and a.attnum = k.attnum
                    join pg_attribute fa on fa.attrelid = f.oid and fa.attnum = k.fattnum
                   where con.contype = 'f' and n.nspname = 'public' and fn.nspname = 'public'
                   group by con.conname, c.relname, f.relname) x),
              'tprivs', (select json_agg(json_build_array(relation, privilege)) from api.table_privileges where role = :r1),
              'cprivs', (select json_agg(json_build_array(relation, privilege, column_name)) from api.column_privileges where role = :r2),
              'routines', (select json_agg(routine) from api.routine_privileges where role = :r3)
            )::text
            SQL, [':r1' => $role, ':r2' => $role, ':r3' => $role]);
        $s = json_decode($json, true);
        $this->columns = $s['columns'] ?? [];
        $this->primaryKeys = $s['pkeys'] ?? [];
        $this->foreignKeys = $s['fkeys'] ?? [];
        foreach ($s['uniques'] ?? [] as [$rel, $cols]) {
            $this->uniques[$rel][] = $cols;
        }
        foreach ($s['tprivs'] ?? [] as [$rel, $priv]) {
            $this->tablePrivs[$rel][$priv] = true;
        }
        foreach ($s['cprivs'] ?? [] as [$rel, $priv, $col]) {
            $this->columnPrivs[$rel][$priv][$col] = true;
        }
        foreach ($s['routines'] ?? [] as $r) {
            $this->routines[$r] = true;
        }
    }

    public function hasRelation(string $rel): bool
    {
        return isset($this->columns[$rel]);
    }

    /** Колонка должна существовать — иначе ошибка, как у PostgREST (заодно защита от подстановок). */
    public function requireColumn(string $rel, string $col): void
    {
        if (!isset($this->columns[$rel][$col])) {
            throw new ApiError(400, "column $rel.$col does not exist", '42703');
        }
    }

    /**
     * Право на действие с таблицей: на всю таблицу или на каждую из названных колонок.
     * @param list<string>|null $cols null — нужны все колонки (select=*)
     */
    public function requirePrivilege(string $rel, string $priv, ?array $cols = null): void
    {
        if (isset($this->tablePrivs[$rel][$priv])) {
            return;
        }
        if ($cols !== null && $cols !== [] && $priv !== 'DELETE') {
            $missing = array_filter($cols, fn ($c) => !isset($this->columnPrivs[$rel][$priv][$c]));
            if ($missing === []) {
                return;
            }
        }
        throw new ApiError($this->role === 'anon' ? 401 : 403, 'permission denied for table ' . $rel, '42501');
    }

    /** Результат функции «returns table (…)» читается целиком — права проверены на саму функцию. */
    public function grantAll(string $rel): void
    {
        $this->tablePrivs[$rel]['SELECT'] = true;
    }

    public function requireRoutine(string $name): void
    {
        if (!isset($this->routines[$name])) {
            throw new ApiError($this->role === 'anon' ? 401 : 403, 'permission denied for function ' . $name, '42501');
        }
    }

    /**
     * Связь для вложенной выборки «parent → name[!hint]».
     * @return array{target: string, many: bool, pairs: list<array{0: string, 1: string}>}  pairs: [колонка parent, колонка target]
     */
    public function relationship(string $parent, string $name, ?string $hint): array
    {
        $found = [];
        foreach ($this->foreignKeys as $fk) {
            // Многие-к-одному: у parent есть ключ на name.
            if ($fk['table'] === $parent && $fk['ftable'] === $name) {
                $found[] = ['fk' => $fk, 'target' => $name, 'many' => false,
                            'pairs' => array_map(null, $fk['cols'], $fk['fcols'])];
            }
            // Один-ко-многим: у name есть ключ на parent.
            if ($fk['table'] === $name && $fk['ftable'] === $parent) {
                // Ключ уникален у дочерней таблицы — связь «один к одному», вложение объектом.
                $cols = $fk['cols'];
                sort($cols);
                $found[] = ['fk' => $fk, 'target' => $name, 'many' => !in_array($cols, $this->uniques[$name] ?? [], true),
                            'pairs' => array_map(null, $fk['fcols'], $fk['cols'])];
            }
        }
        if ($hint !== null) {
            $found = array_values(array_filter($found, fn ($r) => $r['fk']['name'] === $hint
                || ($r['fk']['cols'] === [$hint])));
        }
        if (count($found) === 0) {
            throw new ApiError(400, "Could not find a relationship between '$parent' and '$name' in the schema cache", 'PGRST200');
        }
        if (count($found) > 1) {
            throw new ApiError(300, "Could not embed because more than one relationship was found for '$parent' and '$name'", 'PGRST201');
        }
        return ['target' => $found[0]['target'], 'many' => $found[0]['many'], 'pairs' => $found[0]['pairs']];
    }
}
