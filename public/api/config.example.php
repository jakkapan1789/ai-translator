<?php
// Copy this file to config.php (in the same api folder on the server) and fill in the values.
// config.php is ignored by git and web.config blocks it from being downloaded.
// Environment variables AI_PROVIDER, AI_BASE_URL, AI_MODEL, AI_API_KEY, AI_TIMEOUT, and
// AI_ALLOWED_ORIGINS (comma-separated) override these values when set.
return [
    // 'ollama' or 'openai' (any OpenAI-compatible /chat/completions API)
    'provider' => 'ollama',

    // Ollama: server root, e.g. http://10.0.0.5:11434. OpenAI-compatible: include /v1, e.g. https://ai.company.local/v1
    'base_url' => 'http://localhost:11434',

    'model' => 'qwen2.5:7b',

    // Sent as "Authorization: Bearer <key>" when set. Stays on the server.
    'api_key' => '',

    // Seconds to wait for the AI server.
    'timeout' => 60,

    // Only needed when a page on another domain calls this file, e.g. ['https://translator.company.com'].
    'allowed_origins' => [],
];
