// We need to test debugProbe which reads process.env
// We'll manipulate process.env and mock fetch/fs

describe('debugProbe (server helper)', () => {
    const originalEnv = { ...process.env };
    let consoleSpy: jest.SpyInstance;
    let mockFetch: jest.Mock;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        process.env = { ...originalEnv };
        // Mock global fetch
        mockFetch = jest.fn().mockResolvedValue({ ok: true });
        (global as any).fetch = mockFetch;
    });

    afterEach(() => {
        process.env = originalEnv;
        consoleSpy.mockRestore();
        delete (global as any).fetch;
    });

    function getDebugProbe() {
        return require('../../helpers/ts/debugProbe').debugProbe;
    }

    it('is a no-op when DEBUGHUB_ENABLED is not set', () => {
        delete process.env.DEBUGHUB_ENABLED;
        const debugProbe = getDebugProbe();
        debugProbe('test');
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('is a no-op when DEBUGHUB_SESSION is not set', () => {
        process.env.DEBUGHUB_ENABLED = '1';
        delete process.env.DEBUGHUB_SESSION;
        const debugProbe = getDebugProbe();
        debugProbe('test');
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('POSTs to endpoint when enabled and endpoint is set', () => {
        process.env.DEBUGHUB_ENABLED = '1';
        process.env.DEBUGHUB_SESSION = 'test-session';
        process.env.DEBUGHUB_ENDPOINT = 'http://127.0.0.1:9999';
        const debugProbe = getDebugProbe();
        debugProbe('test-label', { key: 'value' }, { hypothesisId: 'H1', level: 'warn', loc: 'file.ts:10', tags: { a: 'b' } });

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [url, opts] = mockFetch.mock.calls[0];
        expect(url).toBe('http://127.0.0.1:9999/event');
        expect(opts.method).toBe('POST');
        const body = JSON.parse(opts.body);
        expect(body.label).toBe('test-label');
        expect(body.data).toEqual({ key: 'value' });
        expect(body.hypothesisId).toBe('H1');
        expect(body.level).toBe('warn');
        expect(body.loc).toBe('file.ts:10');
        expect(body.tags).toEqual({ a: 'b' });
        expect(body.runtime).toBe('node');
        expect(body.sessionId).toBe('test-session');
    });

    it('sets default values for optional meta fields', () => {
        process.env.DEBUGHUB_ENABLED = '1';
        process.env.DEBUGHUB_SESSION = 'test-session';
        process.env.DEBUGHUB_ENDPOINT = 'http://127.0.0.1:9999';
        const debugProbe = getDebugProbe();
        debugProbe('test-label');

        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.data).toBeNull();
        expect(body.hypothesisId).toBeNull();
        expect(body.loc).toBeNull();
        expect(body.level).toBe('info');
        expect(body.tags).toBeNull();
    });

    it('falls back to file when no endpoint is set', () => {
        process.env.DEBUGHUB_ENABLED = '1';
        process.env.DEBUGHUB_SESSION = 'test-session';
        delete process.env.DEBUGHUB_ENDPOINT;

        // Mock fs module used by fallbackToFile
        const mockAppendFileSync = jest.fn();
        const mockExistsSync = jest.fn().mockReturnValue(true);
        jest.doMock('fs', () => ({
            appendFileSync: mockAppendFileSync,
            existsSync: mockExistsSync,
        }));

        jest.resetModules();
        (global as any).fetch = mockFetch;
        const debugProbe = require('../../helpers/ts/debugProbe').debugProbe;
        debugProbe('test-label');

        expect(mockFetch).not.toHaveBeenCalled();
        expect(mockAppendFileSync).toHaveBeenCalled();
    });

    it('falls back to file when POST fails', async () => {
        process.env.DEBUGHUB_ENABLED = '1';
        process.env.DEBUGHUB_SESSION = 'test-session';
        process.env.DEBUGHUB_ENDPOINT = 'http://127.0.0.1:9999';

        const mockAppendFileSync = jest.fn();
        const mockExistsSync = jest.fn().mockReturnValue(true);
        jest.doMock('fs', () => ({
            appendFileSync: mockAppendFileSync,
            existsSync: mockExistsSync,
        }));

        const rejectFetch = jest.fn().mockRejectedValue(new Error('network error'));
        (global as any).fetch = rejectFetch;

        jest.resetModules();
        (global as any).fetch = rejectFetch;
        const debugProbe = require('../../helpers/ts/debugProbe').debugProbe;
        debugProbe('test-label');

        // Wait for the async catch handler
        await new Promise(r => setTimeout(r, 50));
        expect(mockAppendFileSync).toHaveBeenCalled();
    });

    it('never throws even if everything breaks', () => {
        process.env.DEBUGHUB_ENABLED = '1';
        process.env.DEBUGHUB_SESSION = 'test-session';
        // Set endpoint to something that will cause URL constructor to throw
        process.env.DEBUGHUB_ENDPOINT = 'not-a-valid-url';
        (global as any).fetch = jest.fn().mockImplementation(() => { throw new Error('fetch broke'); });

        jest.resetModules();
        (global as any).fetch = jest.fn().mockImplementation(() => { throw new Error('fetch broke'); });
        const debugProbe = require('../../helpers/ts/debugProbe').debugProbe;

        // Should not throw
        expect(() => debugProbe('test-label')).not.toThrow();
    });
});
