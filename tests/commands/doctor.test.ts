import * as fs from 'fs';
import * as http from 'http';
import * as readline from 'readline';
import { spawnSync } from 'child_process';

jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

// We need to partially mock http to intercept http.request
jest.mock('http');
const mockHttp = http as jest.Mocked<typeof http>;

jest.mock('readline');
const mockReadline = readline as jest.Mocked<typeof readline>;

jest.mock('child_process', () => ({
    spawnSync: jest.fn(),
}));
const mockSpawnSync = spawnSync as jest.MockedFunction<typeof spawnSync>;

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
            if (p.toString().includes('.jsonl')) return '{"label":"one"}\n{"label":"two"}\n' as any;
            return '' as any;
        });
        mockFs.accessSync.mockReturnValue(undefined);
        mockFs.statSync.mockReturnValue({ size: 32 } as any);

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
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[x] Events     : 2 events in session file'));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[x] Reachability'));
    });

    it('reports non-204 endpoint response', () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockImplementation((p: any) => {
            if (p.toString().includes('current')) return '1.0.0' as any;
            if (p.toString().includes('state.json')) return JSON.stringify({ session: 'abc', pid: 123, port: 9999 }) as any;
            if (p.toString().includes('.jsonl')) return '{"label":"one"}\n' as any;
            return '' as any;
        });
        mockFs.accessSync.mockReturnValue(undefined);
        mockFs.statSync.mockReturnValue({ size: 16 } as any);

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
            if (p.toString().includes('.jsonl')) return '{"label":"one"}\n' as any;
            return '' as any;
        });
        mockFs.accessSync.mockReturnValue(undefined);
        mockFs.statSync.mockReturnValue({ size: 16 } as any);

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
            if (p.toString().includes('.jsonl')) return '{"label":"one"}\n' as any;
            return '' as any;
        });
        mockFs.accessSync.mockImplementation(() => { throw new Error('EACCES'); });
        mockFs.statSync.mockReturnValue({ size: 16 } as any);

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
            if (p.toString().includes('.jsonl')) return '{"label":"one"}\n' as any;
            return '' as any;
        });
        mockFs.accessSync.mockReturnValue(undefined);
        mockFs.statSync.mockReturnValue({ size: 16 } as any);

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

    it('reports why no events were received when the session file is empty', () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockImplementation((p: any) => {
            if (p.toString().includes('current')) return '1.0.0' as any;
            if (p.toString().includes('state.json')) return JSON.stringify({ session: 'abc', pid: 123, port: 9999 }) as any;
            if (p.toString().includes('.jsonl')) return '' as any;
            return '' as any;
        });
        mockFs.accessSync.mockReturnValue(undefined);
        mockFs.statSync.mockReturnValue({ size: 0 } as any);

        const mockReq = { on: jest.fn(), end: jest.fn() };
        mockHttp.request.mockImplementation((opts: any, cb: any) => {
            if (cb) cb({ statusCode: 204 });
            return mockReq as any;
        });

        doctor({});

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Session file exists but is empty'));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Helper not loaded'));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('call initDebugHub()'));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('doctor --browser'));
    });

    it('runs Java diagnostics using an explicit env file and prints a self-test snippet', () => {
        mockFs.existsSync.mockImplementation((p: any) => {
            const s = p.toString();
            if (s.includes('current')) return true;
            if (s.includes('state.json')) return true;
            if (s.includes('runtime.env')) return true;
            if (s.includes('.jsonl')) return true;
            return false;
        });
        mockFs.readFileSync.mockImplementation((p: any) => {
            const s = p.toString();
            if (s.includes('current')) return '1.0.0' as any;
            if (s.includes('state.json')) return JSON.stringify({ session: 'abc', pid: 123, port: 9999 }) as any;
            if (s.includes('runtime.env')) {
                return 'DEBUGHUB_ENABLED=1\nDEBUGHUB_SESSION=abc\nDEBUGHUB_ENDPOINT=http://127.0.0.1:9999\n' as any;
            }
            if (s.includes('.jsonl')) return '{"label":"one"}\n' as any;
            return '' as any;
        });
        mockFs.accessSync.mockReturnValue(undefined);
        mockFs.statSync.mockReturnValue({ size: 16 } as any);
        mockSpawnSync.mockReturnValue({
            stdout: '',
            stderr: 'openjdk version "17.0.10" 2024-01-16',
        } as any);

        const mockReq = { on: jest.fn(), end: jest.fn() };
        mockHttp.request.mockImplementation((_opts: any, cb: any) => {
            if (cb) cb({ statusCode: 204 });
            return mockReq as any;
        });

        doctor({ java: true, envFile: '.debughub/runtime.env' });

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Java Diagnostics'));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[x] Java       : 17.0.10'));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[x] Env Source : .debughub/runtime.env'));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Session matches active collector'));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Env endpoint matches active collector'));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('__java_selftest__'));
    });

    it('reports stale Java env values and restart guidance', () => {
        mockFs.existsSync.mockImplementation((p: any) => {
            const s = p.toString();
            if (s.includes('current')) return true;
            if (s.includes('state.json')) return true;
            if (s.includes('runtime.env')) return true;
            if (s.includes('.jsonl')) return true;
            return false;
        });
        mockFs.readFileSync.mockImplementation((p: any) => {
            const s = p.toString();
            if (s.includes('current')) return '1.0.0' as any;
            if (s.includes('state.json')) return JSON.stringify({ session: 'abc', pid: 123, port: 9999 }) as any;
            if (s.includes('runtime.env')) {
                return 'DEBUGHUB_ENABLED=0\nDEBUGHUB_SESSION=stale-session\nDEBUGHUB_ENDPOINT=http://127.0.0.1:7777\n' as any;
            }
            if (s.includes('.jsonl')) return '{"label":"one"}\n' as any;
            return '' as any;
        });
        mockFs.accessSync.mockReturnValue(undefined);
        mockFs.statSync.mockReturnValue({ size: 16 } as any);
        mockSpawnSync.mockReturnValue({
            stdout: '',
            stderr: 'openjdk version "8.0.392" 2023-10-17',
        } as any);

        const okReq = { on: jest.fn(), end: jest.fn() };
        const badReq = {
            on: jest.fn().mockImplementation((event: string, cb: (error: Error) => void) => {
                if (event === 'error') cb(new Error('ECONNREFUSED'));
                return badReq;
            }),
            end: jest.fn(),
        };
        mockHttp.request.mockImplementation((opts: any, cb: any) => {
            if (opts.port === 9999) {
                if (cb) cb({ statusCode: 204 });
                return okReq as any;
            }
            return badReq as any;
        });

        doctor({ java: true, envFile: '.debughub/runtime.env' });

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Java 11+ is required'));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('DEBUGHUB_ENABLED must be 1'));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Session mismatch'));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Env endpoint mismatch'));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('restart the IntelliJ run configuration'));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Error connecting to endpoint'));
    });
});
