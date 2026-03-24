import * as fs from 'fs';
import * as http from 'http';
import * as readline from 'readline';

jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

// We need to partially mock http to intercept http.request
jest.mock('http');
const mockHttp = http as jest.Mocked<typeof http>;

jest.mock('readline');
const mockReadline = readline as jest.Mocked<typeof readline>;

import { doctor } from '../../src/commands/doctor';

describe('doctor command', () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
        consoleSpy.mockRestore();
    });

    it('reports not installed when current link does not exist', () => {
        mockFs.existsSync.mockReturnValue(false);
        doctor({});
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('DebugHub Doctor'));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[ ] Installation'));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[ ] Collector'));
    });

    it('reports installed version when current link exists', () => {
        mockFs.existsSync.mockImplementation((p: any) => {
            if (p.toString().includes('current')) return true;
            return false; // no state.json
        });
        mockFs.readFileSync.mockReturnValue('1.0.0' as any);

        doctor({});
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[x] Installation'));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Version linked: 1.0.0'));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[ ] Collector'));
    });

    it('reports running collector with reachable endpoint (204)', () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockImplementation((p: any) => {
            if (p.toString().includes('current')) return '1.0.0' as any;
            if (p.toString().includes('state.json')) return JSON.stringify({ session: 'abc', pid: 123, port: 9999 }) as any;
            return '' as any;
        });
        mockFs.accessSync.mockReturnValue(undefined);

        // Mock http.request to simulate a 204 response
        const mockReq = {
            on: jest.fn(),
            end: jest.fn(),
        };
        mockHttp.request.mockImplementation((opts: any, cb: any) => {
            if (cb) {
                cb({ statusCode: 204 });
            }
            return mockReq as any;
        });

        doctor({});
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[x] Collector'));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Session ID: abc'));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[x] Output Path'));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[x] Reachability'));
    });

    it('reports non-204 endpoint response', () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockImplementation((p: any) => {
            if (p.toString().includes('current')) return '1.0.0' as any;
            if (p.toString().includes('state.json')) return JSON.stringify({ session: 'abc', pid: 123, port: 9999 }) as any;
            return '' as any;
        });
        mockFs.accessSync.mockReturnValue(undefined);

        const mockReq = { on: jest.fn(), end: jest.fn() };
        mockHttp.request.mockImplementation((opts: any, cb: any) => {
            if (cb) cb({ statusCode: 500 });
            return mockReq as any;
        });

        doctor({});
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Endpoint responded with 500'));
    });

    it('reports connection error to endpoint', () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockImplementation((p: any) => {
            if (p.toString().includes('current')) return '1.0.0' as any;
            if (p.toString().includes('state.json')) return JSON.stringify({ session: 'abc', pid: 123, port: 9999 }) as any;
            return '' as any;
        });
        mockFs.accessSync.mockReturnValue(undefined);

        const mockReq = {
            on: jest.fn().mockImplementation((event: string, cb: (error: Error) => void) => {
                if (event === 'error') cb(new Error('ECONNREFUSED'));
                return mockReq;
            }),
            end: jest.fn(),
        };
        mockHttp.request.mockImplementation((_opts: any, _cb: any) => {
            return mockReq as any;
        });

        doctor({});
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Error connecting to endpoint'));
    });

    it('reports output not writable', () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockImplementation((p: any) => {
            if (p.toString().includes('current')) return '1.0.0' as any;
            if (p.toString().includes('state.json')) return JSON.stringify({ session: 'abc', pid: 123, port: 9999 }) as any;
            return '' as any;
        });
        mockFs.accessSync.mockImplementation(() => { throw new Error('EACCES'); });

        const mockReq = { on: jest.fn(), end: jest.fn() };
        mockHttp.request.mockImplementation((opts: any, cb: any) => {
            if (cb) cb({ statusCode: 204 });
            return mockReq as any;
        });

        doctor({});
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('NOT writable'));
    });

    it('outputs browser self-test snippets when --browser is set', () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockImplementation((p: any) => {
            if (p.toString().includes('current')) return '1.0.0' as any;
            if (p.toString().includes('state.json')) return JSON.stringify({ session: 'abc', pid: 123, port: 9999 }) as any;
            return '' as any;
        });
        mockFs.accessSync.mockReturnValue(undefined);

        const mockReq = { on: jest.fn(), end: jest.fn() };
        mockHttp.request.mockImplementation((opts: any, cb: any) => {
            if (cb) cb({ statusCode: 204 });
            return mockReq as any;
        });

        // Mock readline to avoid interactive prompt in tests
        const mockRl = { question: jest.fn(), close: jest.fn() };
        mockReadline.createInterface.mockReturnValue(mockRl as any);

        doctor({ browser: true });

        // Should print self-test snippets
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Browser Self-Test'));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Transport test'));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Helper test'));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('__browser_selftest__'));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('window.__DEBUGHUB__'));
    });

    it('reports cannot run browser self-test when collector not running', () => {
        mockFs.existsSync.mockReturnValue(false);
        doctor({ browser: true });
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Cannot run browser self-test'));
    });

    it('handles corrupt state.json', () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockImplementation((p: any) => {
            if (p.toString().includes('current')) return '1.0.0' as any;
            if (p.toString().includes('state.json')) return 'not-json' as any;
            return '' as any;
        });

        doctor({});
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('unreadable or corrupt'));
    });
});
