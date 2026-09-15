<?php
// Temporary diagnostics for api/chat.php. Copy next to chat.php on the server, open it in a browser,
// and DELETE it when done. It never prints the API key.
declare(strict_types=1);

ini_set('display_errors', '0');
header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: no-store');

function line(string $label, string $value): void
{
    echo str_pad($label, 28) . $value . "\n";
}

function load_settings(): array
{
    $file = __DIR__ . '/config.php';
    $fromFile = is_file($file) ? require $file : [];
    if (!is_array($fromFile)) {
        $fromFile = [];
    }
    $value = static function (string $env, string $key, $default) use ($fromFile) {
        $fromEnv = getenv($env);
        if ($fromEnv !== false && $fromEnv !== '') {
            return [$fromEnv, "env $env"];
        }
        return array_key_exists($key, $fromFile) ? [$fromFile[$key], 'config.php'] : [$default, 'default'];
    };
    return [
        'config_file' => is_file($file),
        'provider' => $value('AI_PROVIDER', 'provider', 'ollama'),
        'base_url' => $value('AI_BASE_URL', 'base_url', ''),
        'model' => $value('AI_MODEL', 'model', ''),
        'api_key' => $value('AI_API_KEY', 'api_key', ''),
        'timeout' => $value('AI_TIMEOUT', 'timeout', 60),
        'ca_file' => $value('AI_CA_FILE', 'ca_file', ''),
    ];
}

// Same trust rules as chat.php: ca_file first, otherwise the Windows certificate store on Windows (PHP 8.2+).
function tls_options(string $caFile): array
{
    if ($caFile !== '') {
        return [CURLOPT_CAINFO => $caFile];
    }
    if (PHP_OS_FAMILY === 'Windows' && defined('CURLSSLOPT_NATIVE_CA')) {
        return [CURLOPT_SSL_OPTIONS => CURLSSLOPT_NATIVE_CA];
    }
    return [];
}

function request(string $method, string $url, array $headers, ?string $body, int $timeout, string $caFile): array
{
    if (!function_exists('curl_init')) {
        return ['status' => 0, 'error' => 'curl extension is not enabled', 'errno' => -1, 'ms' => 0, 'body' => ''];
    }
    $handle = curl_init($url);
    curl_setopt_array($handle, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => $timeout,
    ] + tls_options($caFile));
    if ($body !== null) {
        curl_setopt($handle, CURLOPT_POSTFIELDS, $body);
    }
    $started = microtime(true);
    $response = curl_exec($handle);
    $result = [
        'status' => (int) curl_getinfo($handle, CURLINFO_HTTP_CODE),
        'errno' => curl_errno($handle),
        'error' => curl_error($handle),
        'ms' => (int) round((microtime(true) - $started) * 1000),
        'body' => is_string($response) ? $response : '',
    ];
    unset($handle);
    return $result;
}

function advice(array $result): string
{
    $errno = $result['errno'];
    $status = $result['status'];
    if ($errno === -1) return 'Enable extension=curl in php.ini and restart the IIS application pool.';
    if (in_array($errno, [60, 77, 35], true)) return "HTTPS certificate not trusted. Internal servers usually use a company CA or a self-signed certificate:\n"
        . str_repeat(' ', 28) . "- export that CA (or the self-signed certificate) as Base-64 .cer from the browser, put it in this api folder, and set 'ca_file' in config.php;\n"
        . str_repeat(' ', 28) . "- or use PHP 8.2+ on Windows, which trusts the Windows certificate store automatically;\n"
        . str_repeat(' ', 28) . "- or, if policy allows, use http:// in base_url on the internal network.\n"
        . str_repeat(' ', 28) . "Use the host name from the certificate in base_url, not an IP address.";
    if ($errno === 51) return 'Certificate host name mismatch: use the host name the certificate was issued for in base_url (not an IP address).';
    if ($errno === 6) return 'Host name not found: check base_url, and that this server resolves the AI host name (DNS).';
    if ($errno === 7) return 'Connection refused or blocked: check the port, firewall, and that the AI server listens on an address this server can reach (Ollama: OLLAMA_HOST=0.0.0.0).';
    if ($errno === 28) return 'Timed out: firewall dropping packets, an outbound proxy is required, or the AI server is too slow.';
    if ($errno === 5) return 'Outbound proxy problem: this server may need a proxy to reach the AI server.';
    if ($errno !== 0) return 'Network error: see the curl error above.';
    if ($status === 404) return 'Endpoint or model not found: Ollama base_url is the server root; OpenAI-compatible base_url must include /v1. Also check the model name.';
    if ($status === 401 || $status === 403) return 'The AI server rejected the request: check api_key (and that it expects "Authorization: Bearer").';
    if ($status >= 500) return 'The AI server returned an error: check its logs, the model name, and that the model is loaded.';
    if ($status >= 200 && $status < 300) return 'OK';
    return 'Unexpected HTTP status: see the response body below.';
}

$settings = load_settings();
[$provider] = $settings['provider'];
$provider = strtolower((string) $provider);
[$baseUrl, $baseSource] = $settings['base_url'];
$baseUrl = rtrim((string) $baseUrl, '/');
[$model, $modelSource] = $settings['model'];
[$apiKey, $keySource] = $settings['api_key'];
[$timeout] = $settings['timeout'];
$timeout = max(5, (int) $timeout);
[$caFile, $caSource] = $settings['ca_file'];
$caFile = trim((string) $caFile);
if ($caFile !== '' && !preg_match('#^([a-zA-Z]:[\\\\/]|[\\\\/])#', $caFile)) {
    $caFile = __DIR__ . DIRECTORY_SEPARATOR . $caFile;
}

echo "== PHP\n";
line('PHP version', PHP_VERSION . ' (' . PHP_SAPI . ', ' . PHP_OS_FAMILY . ')');
line('curl extension', function_exists('curl_init') ? 'enabled (' . (curl_version()['version'] ?? '?') . ', ' . (curl_version()['ssl_version'] ?? 'no SSL') . ')' : 'MISSING');
line('openssl extension', extension_loaded('openssl') ? 'enabled' : 'MISSING');
line('curl.cainfo (php.ini)', ini_get('curl.cainfo') ?: '(not set)');
line('openssl.cafile (php.ini)', ini_get('openssl.cafile') ?: '(not set)');
line('max_execution_time', (string) ini_get('max_execution_time'));

echo "\n== Settings\n";
line('config.php found', $settings['config_file'] ? 'yes' : 'NO (copy config.example.php to config.php)');
line('provider', $provider . ($provider === 'ollama' || $provider === 'openai' ? '' : '  <- must be ollama or openai'));
line('base_url', ($baseUrl !== '' ? $baseUrl : '(empty)') . "  [$baseSource]");
line('model', ($model !== '' ? (string) $model : '(empty)') . "  [$modelSource]");
line('api_key', ($apiKey !== '' ? 'set, ' . strlen((string) $apiKey) . ' characters' : 'not set') . "  [$keySource]");
line('timeout', $timeout . ' s');

echo "\n== HTTPS trust\n";
if (str_starts_with(strtolower($baseUrl), 'http://')) {
    line('certificate check', 'not used (base_url is http://)');
} elseif ($caFile !== '') {
    line('trusted CAs', "ca_file $caFile  [$caSource]");
    line('ca_file exists', is_file($caFile) ? 'yes' : 'NO  <- chat.php answers "AI backend is not configured" until this file exists');
} elseif (PHP_OS_FAMILY === 'Windows' && defined('CURLSSLOPT_NATIVE_CA')) {
    line('trusted CAs', 'Windows certificate store (same as browsers)');
} else {
    line('trusted CAs', ini_get('curl.cainfo') ? 'php.ini curl.cainfo' : 'curl default bundle' . (PHP_OS_FAMILY === 'Windows' ? ' (often none on Windows: set ca_file or use PHP 8.2+)' : ''));
}

if ($baseUrl === '' || $model === '') {
    echo "\nbase_url and model are required. Fix the settings above and reload this page.\n";
    exit;
}

$headers = ['Accept: application/json'];
if ($apiKey !== '') {
    $headers[] = 'Authorization: Bearer ' . $apiKey;
}

$checks = [
    ['List models', 'GET', $baseUrl . ($provider === 'ollama' ? '/api/tags' : '/models'), null],
];
$messages = [['role' => 'user', 'content' => 'Reply with OK.']];
$checks[] = $provider === 'ollama'
    ? ['Chat request', 'POST', $baseUrl . '/api/chat', json_encode(['model' => $model, 'messages' => $messages, 'stream' => false])]
    : ['Chat request', 'POST', $baseUrl . '/chat/completions', json_encode(['model' => $model, 'messages' => $messages])];

foreach ($checks as [$label, $method, $url, $body]) {
    echo "\n== $label\n";
    line('request', "$method $url");
    $result = request($method, $url, $body === null ? $headers : array_merge($headers, ['Content-Type: application/json']), $body, $timeout, is_file($caFile) ? $caFile : '');
    line('HTTP status', $result['status'] ? (string) $result['status'] : '(no response)');
    line('curl error', $result['errno'] ? "#{$result['errno']} {$result['error']}" : 'none');
    line('time', $result['ms'] . ' ms');
    line('result', advice($result));
    if ($result['body'] !== '') {
        echo "response body (first 400 chars):\n" . substr($result['body'], 0, 400) . "\n";
    }
}

echo "\nDelete diagnose.php from the server when you are done.\n";
