<?php
/** Исходящие HTTP-запросы через curl: к Pl@ntNet, Gemini, лентам новостей, push-сервисам браузеров. */
final class Fetch
{
    /**
     * @param array<string, string> $headers
     * @param string|array|null $body строка — как есть, массив — multipart/form-data (CURLFile для файлов)
     * @return array{status: int, body: string, headers: array<string, string>, url: string}
     */
    public static function request(string $method, string $url, array $headers = [], string|array|null $body = null,
                                   int $timeout = 20, int $maxBytes = 0): array
    {
        $ch = curl_init($url);
        $respHeaders = [];
        $received = '';
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => array_map(fn ($k, $v) => "$k: $v", array_keys($headers), $headers),
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 5,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
            CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_HEADERFUNCTION => function ($ch, string $line) use (&$respHeaders) {
                if (str_contains($line, ':')) {
                    [$k, $v] = explode(':', $line, 2);
                    $respHeaders[strtolower(trim($k))] = trim($v);
                }
                return strlen($line);
            },
            // Не держим в памяти больше, чем нужно (статьи новостей — до 3 МБ).
            CURLOPT_WRITEFUNCTION => function ($ch, string $chunk) use (&$received, $maxBytes) {
                $received .= $chunk;
                return $maxBytes > 0 && strlen($received) > $maxBytes ? 0 : strlen($chunk);
            },
        ]);
        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        }
        curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $effective = (string) curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
        $error = curl_errno($ch);
        curl_close($ch);
        if ($error !== 0 && !($maxBytes > 0 && strlen($received) > $maxBytes)) {
            // Без строки запроса: в ней бывают ключи (Pl@ntNet), а текст ошибки уходит в журналы.
            throw new RuntimeException(strtok($url, '?') . ": curl $error " . curl_strerror($error));
        }
        return ['status' => $status, 'body' => $received, 'headers' => $respHeaders, 'url' => $effective ?: $url,
                'truncated' => $maxBytes > 0 && strlen($received) > $maxBytes];
    }
}
