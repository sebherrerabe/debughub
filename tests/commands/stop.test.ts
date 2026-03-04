import * as fs from 'fs';

jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

import { stop } from '../../src/commands/stop';

describe('stop command', () => {
    let consoleSpy: jest.SpyInstance;
    let consoleErrorSpy: jest.SpyInstance;
    let killSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        killSpy = jest.spyOn(process, 'kill').mockImplementation((() => true) as any);
    });

    afterEach(() => {
        consoleSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        killSpy.mockRestore();
    });

    it('prints message when no state file exists', () => {
        mockFs.existsSync.mockReturnValue(false);
        stop();
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No DebugHub collector is currently running'));
    });

    it('kills the process and clears state', () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue(JSON.stringify({ pid: 12345 }) as any);
        mockFs.unlinkSync.mockReturnValue(undefined);

        stop();

        expect(killSpy).toHaveBeenCalledWith(12345);
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Stopped collector process 12345'));
        expect(mockFs.unlinkSync).toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith('Cleared state.');
    });

    it('handles ESRCH error when process not running', () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue(JSON.stringify({ pid: 99999 }) as any);
        mockFs.unlinkSync.mockReturnValue(undefined);
        killSpy.mockImplementation(() => {
            const err: any = new Error('No such process');
            err.code = 'ESRCH';
            throw err;
        });

        stop();

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('was not running'));
        expect(mockFs.unlinkSync).toHaveBeenCalled();
    });

    it('handles other kill errors', () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue(JSON.stringify({ pid: 12345 }) as any);
        mockFs.unlinkSync.mockReturnValue(undefined);
        killSpy.mockImplementation(() => {
            const err: any = new Error('Permission denied');
            err.code = 'EPERM';
            throw err;
        });

        stop();

        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to stop process'), 'Permission denied');
        expect(mockFs.unlinkSync).toHaveBeenCalled();
    });

    it('handles corrupt state.json', () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue('not-json' as any);
        mockFs.unlinkSync.mockReturnValue(undefined);

        stop();

        expect(consoleSpy).toHaveBeenCalledWith('Could not read state.json or parse PID.');
        expect(mockFs.unlinkSync).toHaveBeenCalled();
    });
});
