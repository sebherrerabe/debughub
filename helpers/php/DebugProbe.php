<?php

function debug_probe($label, $data = null, $meta = null) {
    try {
        if (getenv('DEBUGHUB_ENABLED') !== '1') {
            return;
        }

        $sessionId = getenv('DEBUGHUB_SESSION');
        if (!$sessionId) {
            return;
        }

        $endpoint = getenv('DEBUGHUB_ENDPOINT');
        if (!$endpoint) {
            return;
        }

        if (!is_array($meta)) {
            $meta = [];
        }

        $level = isset($meta['level']) ? $meta['level'] : 'info';
        if (!in_array($level, ['info', 'warn', 'error'], true)) {
            $level = 'info';
        }

        $tags = null;
        if (isset($meta['tags']) && is_array($meta['tags'])) {
            $tags = $meta['tags'];
        }

        $event = [
            'ts' => gmdate('Y-m-d\TH:i:s\Z'),
            'sessionId' => $sessionId,
            'label' => $label,
            'data' => $data,
            'hypothesisId' => isset($meta['hypothesisId']) ? $meta['hypothesisId'] : null,
            'loc' => isset($meta['loc']) ? $meta['loc'] : null,
            'level' => $level,
            'tags' => $tags,
            'runtime' => 'php',
        ];

        $payload = json_encode($event, JSON_UNESCAPED_SLASHES);
        if ($payload === false) {
            return;
        }

        $url = rtrim($endpoint, '/') . '/event';
        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => "Content-Type: application/json\r\n",
                'content' => $payload,
                'timeout' => 2,
            ],
        ]);

        @file_get_contents($url, false, $context);
    } catch (Throwable $err) {
        return;
    }
}

function debugProbe($label, $data = null, $meta = null) {
    debug_probe($label, $data, $meta);
}
