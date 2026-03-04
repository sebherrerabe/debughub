export function debugProbe(
    label: string,
    data?: any,
    meta?: {
        hypothesisId?: string;
        loc?: string;
        level?: 'info' | 'warn' | 'error';
        tags?: Record<string, string>;
    }
): void {
    try {
        const isEnabled = process.env.DEBUGHUB_ENABLED === '1';
        const sessionId = process.env.DEBUGHUB_SESSION;
        if (!isEnabled || !sessionId) return;

        const endpoint = process.env.DEBUGHUB_ENDPOINT;

        // Canonical event schema
        const event = {
            ts: new Date().toISOString(),
            sessionId,
            label,
            data: data ?? null,
            hypothesisId: meta?.hypothesisId ?? null,
            loc: meta?.loc ?? null,
            level: meta?.level ?? 'info',
            tags: meta?.tags ?? null,
            runtime: 'node',
            pid: process.pid,
        };

        const payload = JSON.stringify(event);

        if (endpoint) {
            // Best-effort POST
            const url = new URL('/event', endpoint).toString();
            fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payload,
            }).catch(() => {
                fallbackToFile(sessionId, payload);
            });
        } else {
            fallbackToFile(sessionId, payload);
        }
    } catch (err) {
        // Swallow exceptions
    }
}

function fallbackToFile(sessionId: string, payload: string) {
    try {
        const fs = require('fs');
        const path = require('path');
        const outPath = path.join(process.cwd(), '.debughub', 'out', `${sessionId}.jsonl`);
        if (fs.existsSync(path.dirname(outPath))) {
            fs.appendFileSync(outPath, payload + '\n', 'utf-8');
        }
    } catch (err) {
        // Best effort
    }
}
