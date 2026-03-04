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
        // Browser bundlers should replace these or they remain undefined
        // Users are expected to configure their bundlers if they want browser probing
        const isEnabled = (window as any).process?.env?.DEBUGHUB_ENABLED === '1' || (import.meta as any).env?.VITE_DEBUGHUB_ENABLED === '1';
        const sessionId = (window as any).process?.env?.DEBUGHUB_SESSION || (import.meta as any).env?.VITE_DEBUGHUB_SESSION;
        if (!isEnabled || !sessionId) return;

        const endpoint = (window as any).process?.env?.DEBUGHUB_ENDPOINT || (import.meta as any).env?.VITE_DEBUGHUB_ENDPOINT;
        if (!endpoint) return; // No file fallback in browser

        const event = {
            ts: new Date().toISOString(),
            sessionId,
            label,
            data: data ?? null,
            hypothesisId: meta?.hypothesisId ?? null,
            loc: meta?.loc ?? null,
            level: meta?.level ?? 'info',
            tags: meta?.tags ?? null,
            runtime: 'browser',
        };

        const payload = JSON.stringify(event);
        const url = new URL('/event', endpoint).toString();

        // Fire and forget using standard fetch
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
        }).catch(() => { });
    } catch (err) {
        // Swallow exceptions
    }
}
