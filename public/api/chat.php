<?php
// Server-side AI endpoint for the translator.
// The browser posts chat messages here on the same site (so there is no CORS), and this script adds
// the model and API key from server config before calling the AI server. The key never reaches the browser.
declare(strict_types=1);

ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// Environment variables override config.php, which sits next to this file on the server.
function load_config(): array
{
    $file = __DIR__ . '/config.php';
    $fromFile = is_file($file) ? require $file : [];
    if (!is_array($fromFile)) {
        $fromFile = [];
    }
    $value = static function (string $env, string $key, $default) use ($fromFile) {
        $fromEnv = getenv($env);
        if ($fromEnv !== false && $fromEnv !== '') {
            return $fromEnv;
        }
        return $fromFile[$key] ?? $default;
    };
    $origins = $value('AI_ALLOWED_ORIGINS', 'allowed_origins', []);
    if (is_string($origins)) {
        $origins = array_values(array_filter(array_map('trim', explode(',', $origins))));
    }
    // A relative ca_file is looked up next to this script, e.g. 'company-root-ca.pem'.
    $caFile = trim((string) $value('AI_CA_FILE', 'ca_file', ''));
    if ($caFile !== '' && !preg_match('#^([a-zA-Z]:[\\\\/]|[\\\\/])#', $caFile)) {
        $caFile = __DIR__ . DIRECTORY_SEPARATOR . $caFile;
    }
    return [
        'ca_file' => $caFile,
        'provider' => strtolower((string) $value('AI_PROVIDER', 'provider', 'ollama')),
        'base_url' => rtrim((string) $value('AI_BASE_URL', 'base_url', ''), '/'),
        'model' => (string) $value('AI_MODEL', 'model', ''),
        'api_key' => (string) $value('AI_API_KEY', 'api_key', ''),
        'timeout' => max(5, (int) $value('AI_TIMEOUT', 'timeout', 60)),
        'allowed_origins' => is_array($origins) ? $origins : [],
    ];
}

// Internal AI servers usually use a company CA that PHP does not know. ca_file trusts a specific PEM file;
// otherwise on Windows (PHP 8.2+) curl trusts the Windows certificate store, the same CAs browsers use.
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

function post_json(string $url, array $headers, string $body, int $timeout, string $caFile = ''): array
{
    if (function_exists('curl_init')) {
        $handle = curl_init($url);
        curl_setopt_array($handle, [
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => $timeout,
        ] + tls_options($caFile));
        $response = curl_exec($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
        $timedOut = curl_errno($handle) === 28;
        unset($handle);
        return $response === false
            ? ['status' => 0, 'body' => '', 'timeout' => $timedOut]
            : ['status' => $status, 'body' => (string) $response, 'timeout' => false];
    }

    // Fallback when the curl extension is not enabled.
    $context = stream_context_create(['http' => [
        'method' => 'POST',
        'header' => implode("\r\n", $headers),
        'content' => $body,
        'timeout' => $timeout,
        'ignore_errors' => true,
    ], 'ssl' => $caFile !== '' ? ['cafile' => $caFile] : []]);
    $started = microtime(true);
    $response = @file_get_contents($url, false, $context);
    $lines = function_exists('http_get_last_response_headers') ? (http_get_last_response_headers() ?? []) : ($http_response_header ?? []);
    $status = 0;
    foreach ($lines as $line) {
        if (preg_match('#^HTTP/\S+\s+(\d{3})#', $line, $match)) {
            $status = (int) $match[1];
        }
    }
    if ($response === false || $status === 0) {
        return ['status' => 0, 'body' => '', 'timeout' => microtime(true) - $started >= $timeout - 1];
    }
    return ['status' => $status, 'body' => (string) $response, 'timeout' => false];
}

$config = load_config();

// Same-site requests need no CORS headers. allowed_origins is only for calling this file from another domain.
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && in_array($origin, $config['allowed_origins'], true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Max-Age: 86400');
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if ($method !== 'POST') {
    header('Allow: POST, OPTIONS');
    respond(405, ['error' => 'Method not allowed']);
}
if ($config['base_url'] === '' || $config['model'] === '' || !in_array($config['provider'], ['ollama', 'openai'], true)) {
    respond(500, ['error' => 'AI backend is not configured']);
}
if ($config['ca_file'] !== '' && !is_file($config['ca_file'])) {
    respond(500, ['error' => 'AI backend is not configured']);
}

$raw = file_get_contents('php://input', false, null, 0, 100001);
if ($raw === false || strlen($raw) > 100000) {
    respond(413, ['error' => 'Request is too large']);
}
$input = json_decode($raw, true);
if (!is_array($input) || !isset($input['messages']) || !is_array($input['messages'])) {
    respond(400, ['error' => 'Input text is required']);
}

// Only system and user messages with text are forwarded; the model always comes from server config.
$messages = [];
foreach ($input['messages'] as $message) {
    $role = is_array($message) ? ($message['role'] ?? '') : '';
    $content = is_array($message) ? ($message['content'] ?? null) : null;
    if (!in_array($role, ['system', 'user'], true) || !is_string($content)) {
        respond(400, ['error' => 'Input text is required']);
    }
    $messages[] = ['role' => $role, 'content' => $content];
}
if (count($messages) === 0 || count($messages) > 4) {
    respond(400, ['error' => 'Input text is required']);
}
$temperature = isset($input['temperature']) && is_numeric($input['temperature']) ? max(0.0, min(2.0, (float) $input['temperature'])) : 0.2;
$seed = isset($input['seed']) && is_int($input['seed']) ? $input['seed'] : null;

if ($config['provider'] === 'ollama') {
    $url = $config['base_url'] . '/api/chat';
    $options = ['temperature' => $temperature];
    if ($seed !== null) {
        $options['seed'] = $seed;
    }
    $payload = ['model' => $config['model'], 'messages' => $messages, 'stream' => false, 'options' => $options];
} else {
    $url = $config['base_url'] . '/chat/completions';
    $payload = ['model' => $config['model'], 'messages' => $messages, 'temperature' => $temperature];
    if ($seed !== null) {
        $payload['seed'] = $seed;
    }
}

$headers = ['Content-Type: application/json', 'Accept: application/json'];
if ($config['api_key'] !== '') {
    $headers[] = 'Authorization: Bearer ' . $config['api_key'];
}

$result = post_json($url, $headers, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $config['timeout'], $config['ca_file']);
$status = $result['status'];
if ($status === 0) {
    respond($result['timeout'] ? 504 : 502, ['error' => $result['timeout'] ? 'AI server timed out' : 'Unable to connect to AI server']);
}
if ($status === 404) {
    respond(502, ['error' => 'AI model or endpoint not found']);
}
if ($status === 401 || $status === 403) {
    respond(502, ['error' => 'AI server rejected the API key']);
}
if ($status === 429) {
    respond(429, ['error' => 'AI server is busy. Try again shortly.']);
}
if ($status < 200 || $status >= 300) {
    respond(502, ['error' => 'Unable to connect to AI server']);
}

$data = json_decode($result['body'], true);
$content = $config['provider'] === 'ollama'
    ? ($data['message']['content'] ?? null)
    : ($data['choices'][0]['message']['content'] ?? null);
if (!is_string($content)) {
    respond(502, ['error' => 'Unexpected response from AI server']);
}
respond(200, ['content' => $content]);
