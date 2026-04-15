/**
 * Tests for the browser debugProbe helper.
 * No import.meta preprocessing needed — the helper is now CJS-safe.
 */

describe('debugProbe (browser helper)', () => {
    let mockFetch: jest.Mock;
    let debugProbe: typeof import('../../helpers/ts/debugProbe.browser').debugProbe;
    let initDebugHub: typeof import('../../helpers/ts/debugProbe.browser').initDebugHub;
    let getDebugHubStatus: typeof import('../../helpers/ts/debugProbe.browser').getDebugHubStatus;
    let debugProbeSelfTest: typeof import('../../helpers/ts/debugProbe.browser').debugProbeSelfTest;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        mockFetch = jest.fn().mockResolvedValue({ ok: true });
        (global as any).fetch = mockFetch;
        // Clean up any global config
        delete (globalThis as any).__DEBUGHUB__;
        delete (globalThis as any).process;
        delete (global as any).window;
    });

    afterEach(() => {
        delete (global as any).fetch;
        delete (globalThis as any).__DEBUGHUB__;
        delete (globalThis as any).process;
        delete (global as any).window;
    });

    function loadBrowserProbe() {
        const mod = require('../../helpers/ts/debugProbe.browser');
        debugProbe = mod.debugProbe;
        initDebugHub = mod.initDebugHub;
        getDebugHubStatus = mod.getDebugHubStatus;
        debugProbeSelfTest = mod.debugProbeSelfTest;
        return mod.debugProbe;
    }

    // --- Config source: globalThis.__DEBUGHUB__ ---

    it('sends POST when configured via globalThis.__DEBUGHUB__', () => {
        (globalThis as any).__DEBUGHUB__ = {
            enabled: true,
            session: 'test-session',
            endpoint: 'http://127.0.0.1:9999',
        };
        debugProbe = loadBrowserProbe();
        debugProbe('test-label', { key: 'val' });

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [url, opts] = mockFetch.mock.calls[0];
        expect(url).toBe('http://127.0.0.1:9999/event');
        const body = JSON.parse(opts.body);
        expect(body.label).toBe('test-label');
        expect(body.runtime).toBe('browser');
        expect(body.sessionId).toBe('test-session');
    });

    it('accepts enabled as string "1" in __DEBUGHUB__', () => {
        (globalThis as any).__DEBUGHUB__ = {
            enabled: '1',
            session: 'test-session',
            endpoint: 'http://127.0.0.1:9999',
        };
        debugProbe = loadBrowserProbe();
        debugProbe('test');
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('accepts enabled as string "true" in __DEBUGHUB__', () => {
        (globalThis as any).__DEBUGHUB__ = {
            enabled: 'true',
            session: 'test-session',
            endpoint: 'http://127.0.0.1:9999',
        };
        debugProbe = loadBrowserProbe();
        debugProbe('test');
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('initDebugHub seeds globalThis.__DEBUGHUB__ with normalized values', () => {
        loadBrowserProbe();

        initDebugHub({
            enabled: 'true',
            session: 'boot-session',
            endpoint: 'http://127.0.0.1:4567',
        });

        expect((globalThis as any).__DEBUGHUB__).toEqual({
            enabled: true,
            session: 'boot-session',
            endpoint: 'http://127.0.0.1:4567',
        });
    });

    it('initDebugHub is idempotent across repeated calls', () => {
        loadBrowserProbe();

        initDebugHub({
            enabled: true,
            session: 'same-session',
            endpoint: 'http://127.0.0.1:9999',
        });
        initDebugHub({
            enabled: true,
            session: 'same-session',
            endpoint: 'http://127.0.0.1:9999',
        });

        expect((globalThis as any).__DEBUGHUB__).toEqual({
            enabled: true,
            session: 'same-session',
            endpoint: 'http://127.0.0.1:9999',
        });
    });

    it('treats enabled: false as disabled in __DEBUGHUB__', () => {
        (globalThis as any).__DEBUGHUB__ = {
            enabled: false,
            session: 'test-session',
            endpoint: 'http://127.0.0.1:9999',
        };
        debugProbe = loadBrowserProbe();
        debugProbe('test');
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('treats enabled: "0" as disabled in __DEBUGHUB__', () => {
        (globalThis as any).__DEBUGHUB__ = {
            enabled: '0',
            session: 'test-session',
            endpoint: 'http://127.0.0.1:9999',
        };
        debugProbe = loadBrowserProbe();
        debugProbe('test');
        expect(mockFetch).not.toHaveBeenCalled();
    });

    // --- Config source: globalThis.process.env ---

    it('sends POST when configured via globalThis.process.env', () => {
        (globalThis as any).process = {
            env: {
                DEBUGHUB_ENABLED: '1',
                DEBUGHUB_SESSION: 'gp-session',
                DEBUGHUB_ENDPOINT: 'http://127.0.0.1:8888',
            },
        };
        debugProbe = loadBrowserProbe();
        debugProbe('gp-test');

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.sessionId).toBe('gp-session');
    });

    // --- Config source: window.process.env ---

    it('sends POST when configured via window.process.env', () => {
        (global as any).window = {
            process: {
                env: {
                    DEBUGHUB_ENABLED: '1',
                    DEBUGHUB_SESSION: 'wp-session',
                    DEBUGHUB_ENDPOINT: 'http://127.0.0.1:7777',
                },
            },
        };
        debugProbe = loadBrowserProbe();
        debugProbe('wp-test');

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.sessionId).toBe('wp-session');
    });

    // --- Priority: globalThis.__DEBUGHUB__ wins ---

    it('prefers globalThis.__DEBUGHUB__ over globalThis.process.env', () => {
        (globalThis as any).__DEBUGHUB__ = {
            enabled: true,
            session: 'runtime-session',
            endpoint: 'http://127.0.0.1:1111',
        };
        (globalThis as any).process = {
            env: {
                DEBUGHUB_ENABLED: '1',
                DEBUGHUB_SESSION: 'env-session',
                DEBUGHUB_ENDPOINT: 'http://127.0.0.1:2222',
            },
        };
        debugProbe = loadBrowserProbe();
        debugProbe('priority-test');

        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.sessionId).toBe('runtime-session');
    });

    it('getDebugHubStatus reports resolved config from globalThis.__DEBUGHUB__', () => {
        (globalThis as any).__DEBUGHUB__ = {
            enabled: '1',
            session: 'runtime-session',
            endpoint: 'http://127.0.0.1:1111',
        };
        loadBrowserProbe();

        expect(getDebugHubStatus()).toEqual({
            enabled: true,
            configSource: 'globalThis.__DEBUGHUB__',
            sessionPresent: true,
            endpointPresent: true,
            lastSendError: null,
        });
    });

    // --- No-op cases ---

    it('is a no-op when no config source found', () => {
        debugProbe = loadBrowserProbe();
        debugProbe('test');
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('getDebugHubStatus reports no config when nothing is configured', () => {
        loadBrowserProbe();

        expect(getDebugHubStatus()).toEqual({
            enabled: false,
            configSource: '',
            sessionPresent: false,
            endpointPresent: false,
            lastSendError: null,
        });
    });

    it('is a no-op when enabled but no session', () => {
        (globalThis as any).__DEBUGHUB__ = {
            enabled: true,
            session: '',
            endpoint: 'http://127.0.0.1:9999',
        };
        debugProbe = loadBrowserProbe();
        debugProbe('test');
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('is a no-op when enabled but no endpoint', () => {
        (globalThis as any).__DEBUGHUB__ = {
            enabled: true,
            session: 'test-session',
            endpoint: '',
        };
        debugProbe = loadBrowserProbe();
        debugProbe('test');
        expect(mockFetch).not.toHaveBeenCalled();
    });

    // --- Default meta fields ---

    it('sets default meta fields', () => {
        (globalThis as any).__DEBUGHUB__ = {
            enabled: true,
            session: 'test-session',
            endpoint: 'http://127.0.0.1:9999',
        };
        debugProbe = loadBrowserProbe();
        debugProbe('defaults-test');

        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.data).toBeNull();
        expect(body.hypothesisId).toBeNull();
        expect(body.loc).toBeNull();
        expect(body.level).toBe('info');
        expect(body.tags).toBeNull();
    });

    it('passes meta fields correctly', () => {
        (globalThis as any).__DEBUGHUB__ = {
            enabled: true,
            session: 'test-session',
            endpoint: 'http://127.0.0.1:9999',
        };
        debugProbe = loadBrowserProbe();
        debugProbe('meta-test', { key: 'val' }, { hypothesisId: 'H2', level: 'error', loc: 'file.ts:10', tags: { env: 'dev' } });

        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.hypothesisId).toBe('H2');
        expect(body.level).toBe('error');
        expect(body.loc).toBe('file.ts:10');
        expect(body.tags).toEqual({ env: 'dev' });
    });

    // --- Error handling ---

    it('swallows fetch errors silently', async () => {
        (globalThis as any).__DEBUGHUB__ = {
            enabled: true,
            session: 'test-session',
            endpoint: 'http://127.0.0.1:9999',
        };
        mockFetch.mockRejectedValue(new Error('network error'));
        debugProbe = loadBrowserProbe();

        expect(() => debugProbe('test')).not.toThrow();
        await new Promise(r => setTimeout(r, 50));
    });

    it('getDebugHubStatus exposes the last send error', async () => {
        (globalThis as any).__DEBUGHUB__ = {
            enabled: true,
            session: 'test-session',
            endpoint: 'http://127.0.0.1:9999',
        };
        mockFetch.mockRejectedValue(new Error('network error'));
        loadBrowserProbe();

        debugProbe('test');
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(getDebugHubStatus()).toEqual({
            enabled: true,
            configSource: 'globalThis.__DEBUGHUB__',
            sessionPresent: true,
            endpointPresent: true,
            lastSendError: 'network error',
        });
    });

    it('never throws even if globalThis is sparse', () => {
        (global as any).window = null;
        debugProbe = loadBrowserProbe();
        expect(() => debugProbe('test')).not.toThrow();
    });

    it('debugProbeSelfTest sends the expected event through debugProbe', () => {
        (globalThis as any).__DEBUGHUB__ = {
            enabled: true,
            session: 'selftest-session',
            endpoint: 'http://127.0.0.1:9999',
        };
        loadBrowserProbe();

        debugProbeSelfTest();

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [url, opts] = mockFetch.mock.calls[0];
        expect(url).toBe('http://127.0.0.1:9999/event');
        const body = JSON.parse(opts.body);
        expect(body.label).toBe('__selftest__');
        expect(body.data.test).toBe('helper');
        expect(typeof body.data.ts).toBe('number');
    });

    // --- Diagnostics ---

    it('logs diagnostic when not enabled', () => {
        const debugSpy = jest.spyOn(console, 'debug').mockImplementation();
        debugProbe = loadBrowserProbe();
        debugProbe('test');
        expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('[DebugHub] disabled: not enabled'));
        debugSpy.mockRestore();
    });

    it('logs diagnostic with config source when enabled but missing session', () => {
        const debugSpy = jest.spyOn(console, 'debug').mockImplementation();
        (globalThis as any).__DEBUGHUB__ = {
            enabled: true,
            session: '',
            endpoint: 'http://127.0.0.1:9999',
        };
        debugProbe = loadBrowserProbe();
        debugProbe('test');
        expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('no session ID'));
        expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('globalThis.__DEBUGHUB__'));
        debugSpy.mockRestore();
    });

    it('logs diagnostic with config source when enabled but missing endpoint', () => {
        const debugSpy = jest.spyOn(console, 'debug').mockImplementation();
        (globalThis as any).__DEBUGHUB__ = {
            enabled: true,
            session: 'test-session',
            endpoint: '',
        };
        debugProbe = loadBrowserProbe();
        debugProbe('test');
        expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('no endpoint'));
        expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('globalThis.__DEBUGHUB__'));
        debugSpy.mockRestore();
    });

    it('logs each distinct diagnostic reason independently', () => {
        const debugSpy = jest.spyOn(console, 'debug').mockImplementation();

        // First call: no config at all
        debugProbe = loadBrowserProbe();
        debugProbe('test1');
        expect(debugSpy).toHaveBeenCalledTimes(1);
        expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('not enabled'));

        // Second call with same reason: should not log again
        debugProbe('test2');
        expect(debugSpy).toHaveBeenCalledTimes(1);

        // Now change config to have session missing — different reason
        (globalThis as any).__DEBUGHUB__ = { enabled: true, session: '', endpoint: 'http://127.0.0.1:9999' };
        debugProbe('test3');
        expect(debugSpy).toHaveBeenCalledTimes(2);
        expect(debugSpy).toHaveBeenLastCalledWith(expect.stringContaining('no session ID'));

        debugSpy.mockRestore();
    });
});
