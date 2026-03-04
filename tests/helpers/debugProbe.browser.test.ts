/**
 * Tests for the browser debugProbe helper.
 * Since import.meta is not available in CJS/ts-jest, we test the window.process path only.
 * We use a manual transform to avoid the import.meta compilation error.
 */

// We need to preprocess the browser helper to remove import.meta references
// before requiring it, since ts-jest in CJS mode can't handle them.
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('debugProbe (browser helper)', () => {
    let mockFetch: jest.Mock;
    let tmpFile: string;

    beforeAll(() => {
        // Read the source, replace import.meta references with undefined checks
        const srcPath = path.resolve(__dirname, '..', '..', 'helpers', 'ts', 'debugProbe.browser.ts');
        let src = fs.readFileSync(srcPath, 'utf-8');

        // Replace (import.meta as any).env?.VITE_DEBUGHUB_* with undefined
        // to make it compilable in CJS mode
        src = src.replace(/\(import\.meta as any\)\.env\?\.VITE_DEBUGHUB_ENABLED/g, 'undefined');
        src = src.replace(/\(import\.meta as any\)\.env\?\.VITE_DEBUGHUB_SESSION/g, 'undefined');
        src = src.replace(/\(import\.meta as any\)\.env\?\.VITE_DEBUGHUB_ENDPOINT/g, 'undefined');

        // Write to a temp file that we can require
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'debughub-browser-test-'));
        tmpFile = path.join(tmpDir, 'debugProbe.browser.ts');
        fs.writeFileSync(tmpFile, src, 'utf-8');
    });

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        mockFetch = jest.fn().mockResolvedValue({ ok: true });
        (global as any).fetch = mockFetch;
        // Set up a fake `window` with process.env
        (global as any).window = {
            process: {
                env: {}
            }
        };
    });

    afterEach(() => {
        delete (global as any).fetch;
        delete (global as any).window;
    });

    function loadBrowserProbe() {
        // Require the preprocessed file via ts-jest
        return require(tmpFile).debugProbe;
    }

    it('is a no-op when DEBUGHUB_ENABLED is not set', () => {
        (global as any).window.process.env = {};
        const debugProbe = loadBrowserProbe();
        debugProbe('test');
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('is a no-op when no session is set', () => {
        (global as any).window.process.env = { DEBUGHUB_ENABLED: '1' };
        const debugProbe = loadBrowserProbe();
        debugProbe('test');
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('is a no-op when no endpoint is set', () => {
        (global as any).window.process.env = {
            DEBUGHUB_ENABLED: '1',
            DEBUGHUB_SESSION: 'test-session',
        };
        const debugProbe = loadBrowserProbe();
        debugProbe('test');
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('sends POST to endpoint when fully configured', () => {
        (global as any).window.process.env = {
            DEBUGHUB_ENABLED: '1',
            DEBUGHUB_SESSION: 'test-session',
            DEBUGHUB_ENDPOINT: 'http://127.0.0.1:9999',
        };
        const debugProbe = loadBrowserProbe();
        debugProbe('browser-test', { key: 'val' }, { hypothesisId: 'H2', level: 'error' });

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [url, opts] = mockFetch.mock.calls[0];
        expect(url).toBe('http://127.0.0.1:9999/event');
        const body = JSON.parse(opts.body);
        expect(body.label).toBe('browser-test');
        expect(body.runtime).toBe('browser');
        expect(body.hypothesisId).toBe('H2');
        expect(body.level).toBe('error');
    });

    it('sets default meta fields', () => {
        (global as any).window.process.env = {
            DEBUGHUB_ENABLED: '1',
            DEBUGHUB_SESSION: 'test-session',
            DEBUGHUB_ENDPOINT: 'http://127.0.0.1:9999',
        };
        const debugProbe = loadBrowserProbe();
        debugProbe('defaults-test');

        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.data).toBeNull();
        expect(body.hypothesisId).toBeNull();
        expect(body.loc).toBeNull();
        expect(body.level).toBe('info');
        expect(body.tags).toBeNull();
    });

    it('swallows fetch errors silently', async () => {
        (global as any).window.process.env = {
            DEBUGHUB_ENABLED: '1',
            DEBUGHUB_SESSION: 'test-session',
            DEBUGHUB_ENDPOINT: 'http://127.0.0.1:9999',
        };
        mockFetch.mockRejectedValue(new Error('network error'));
        const debugProbe = loadBrowserProbe();

        expect(() => debugProbe('test')).not.toThrow();
        await new Promise(r => setTimeout(r, 50));
    });

    it('never throws even if window is corrupt', () => {
        (global as any).window = null;
        const debugProbe = loadBrowserProbe();
        expect(() => debugProbe('test')).not.toThrow();
    });
});
