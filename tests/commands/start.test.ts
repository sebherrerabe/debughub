import * as fs from 'fs';

jest.mock('fs');
jest.mock('child_process');
jest.mock('crypto', () => ({
    ...jest.requireActual('crypto'),
    randomUUID: jest.fn().mockReturnValue('mocked-uuid-1234'),
}));

const mockFs = fs as jest.Mocked<typeof fs>;
const mockSpawn = require('child_process').spawn as jest.Mock;

import { start } from '../../src/commands/start';

describe('start command', () => {
    let consoleSpy: jest.SpyInstance;
    let consoleErrorSpy: jest.SpyInstance;
    let exitSpy: jest.SpyInstance;
    let killSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => { throw new Error('process.exit'); }) as any);
        killSpy = jest.spyOn(process, 'kill').mockImplementation((() => true) as any);
    });

    afterEach(() => {
        consoleSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        exitSpy.mockRestore();
        killSpy.mockRestore();
    });

    it('exits when .debughub directory does not exist', () => {
        mockFs.existsSync.mockReturnValue(false);
        expect(() => start()).toThrow('process.exit');
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('.debughub directory not found'));
    });

    it('exits when collector is already running', () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue(JSON.stringify({ pid: 12345, session: 'old' }) as any);
        // process.kill(pid, 0) succeeds meaning process is running
        killSpy.mockImplementation(() => true);

        expect(() => start()).toThrow('process.exit');
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('already running'));
    });

    it('cleans stale state when process is not actually running', () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockImplementation((_p: any) => {
            return JSON.stringify({ pid: 99999, session: 'stale', port: 0 }) as any;
        });
        // process.kill(pid, 0) throws = process not running
        killSpy.mockImplementation((pid: number, signal?: any) => {
            if (signal === 0) throw new Error('ESRCH');
            return true;
        });
        mockFs.unlinkSync.mockReturnValue(undefined);
        mockFs.mkdirSync.mockReturnValue(undefined as any);
        mockFs.openSync.mockReturnValue(42);

        const mockChild = { unref: jest.fn() };
        mockSpawn.mockReturnValue(mockChild as any);

        start();

        // Should have cleaned stale state
        expect(mockFs.unlinkSync).toHaveBeenCalled();
        // Should have spawned the server
        expect(mockSpawn).toHaveBeenCalled();
    });

    it('eagerly creates session file with touch semantics', () => {
        mockFs.existsSync.mockImplementation((p: any) => {
            const s = p.toString();
            if (s.includes('state.json')) return false;
            if (s.includes('.debughub')) return true;
            return true;
        });
        mockFs.mkdirSync.mockReturnValue(undefined as any);
        mockFs.openSync.mockReturnValue(42);
        mockFs.closeSync.mockReturnValue(undefined);

        const mockChild = { unref: jest.fn() };
        mockSpawn.mockReturnValue(mockChild as any);

        start();

        // Should have called openSync with 'a' flag for touch semantics
        const openCalls = mockFs.openSync.mock.calls;
        const touchCall = openCalls.find((call: any) => call[0].toString().includes('.jsonl') && call[1] === 'a');
        expect(touchCall).toBeDefined();
        expect(mockFs.closeSync).toHaveBeenCalled();
    });

    it('prints fallback message when port cannot be confirmed', () => {
        mockFs.existsSync.mockImplementation((p: any) => {
            const s = p.toString();
            if (s.includes('state.json')) return false; // no existing state
            if (s.includes('.debughub')) return true;
            return true;
        });
        mockFs.mkdirSync.mockReturnValue(undefined as any);
        mockFs.openSync.mockReturnValue(42);

        const mockChild = { unref: jest.fn() };
        mockSpawn.mockReturnValue(mockChild as any);

        start();

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("couldn't confirm port"));
    });
});
