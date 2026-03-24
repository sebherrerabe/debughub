const _diagnosed: Record<string, boolean> = {};
function diagnose(reason: string): void {
    if (_diagnosed[reason]) return;
    _diagnosed[reason] = true;
    if (typeof console !== 'undefined') console.debug(`[DebugHub] ${reason}`);
}

interface ResolvedConfig {
    enabled: boolean;
    session: string;
    endpoint: string;
    source: string;
}

function normalizeEnabled(val: unknown): boolean {
    return val === true || val === '1' || val === 'true';
}

function resolveConfig(): ResolvedConfig {
    // 1. globalThis.__DEBUGHUB__ (runtime object, no bundler needed)
    const g = globalThis as any;
    if (g.__DEBUGHUB__) {
        return {
            enabled: normalizeEnabled(g.__DEBUGHUB__.enabled),
            session: String(g.__DEBUGHUB__.session || ''),
            endpoint: String(g.__DEBUGHUB__.endpoint || ''),
            source: 'globalThis.__DEBUGHUB__',
        };
    }

    // 2. globalThis.process?.env (webpack DefinePlugin replacements)
    if (g.process?.env?.DEBUGHUB_ENABLED !== undefined) {
        return {
            enabled: normalizeEnabled(g.process.env.DEBUGHUB_ENABLED),
            session: String(g.process.env.DEBUGHUB_SESSION || ''),
            endpoint: String(g.process.env.DEBUGHUB_ENDPOINT || ''),
            source: 'globalThis.process.env',
        };
    }

    // 3. window.process?.env (legacy fallback)
    if (typeof window !== 'undefined') {
        const w = window as any;
        if (w.process?.env?.DEBUGHUB_ENABLED !== undefined) {
            return {
                enabled: normalizeEnabled(w.process.env.DEBUGHUB_ENABLED),
                session: String(w.process.env.DEBUGHUB_SESSION || ''),
                endpoint: String(w.process.env.DEBUGHUB_ENDPOINT || ''),
                source: 'window.process.env',
            };
        }
    }

    return { enabled: false, session: '', endpoint: '', source: '' };
}

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
        const config = resolveConfig();

        if (!config.enabled) {
            diagnose(
                config.source
                    ? `disabled: not enabled (config source: ${config.source})`
                    : 'disabled: not enabled (checked globalThis.__DEBUGHUB__, globalThis.process.env, window.process.env \u2014 none had enabled=1)'
            );
            return;
        }

        if (!config.session) {
            diagnose(`disabled: no session ID (config source: ${config.source})`);
            return;
        }

        if (!config.endpoint) {
            diagnose(`disabled: no endpoint (config source: ${config.source})`);
            return;
        }

        const event = {
            ts: new Date().toISOString(),
            sessionId: config.session,
            label,
            data: data ?? null,
            hypothesisId: meta?.hypothesisId ?? null,
            loc: meta?.loc ?? null,
            level: meta?.level ?? 'info',
            tags: meta?.tags ?? null,
            runtime: 'browser',
        };

        const payload = JSON.stringify(event);
        const url = new URL('/event', config.endpoint).toString();

        // Fire and forget using standard fetch
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
        }).catch((err) => {
            diagnose(`send failed: ${err?.message || String(err)}`);
        });
    } catch (err) {
        // Swallow exceptions
    }
}
