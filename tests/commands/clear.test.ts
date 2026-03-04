import * as fs from 'fs';

jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

import { clear } from '../../src/commands/clear';

describe('clear command', () => {
    let consoleSpy: jest.SpyInstance;
    let consoleErrorSpy: jest.SpyInstance;
    let exitSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => { throw new Error('process.exit'); }) as any);
    });

    afterEach(() => {
        consoleSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        exitSpy.mockRestore();
    });

    it('reads session from state.json when no --session given', () => {
        mockFs.existsSync.mockImplementation((p: any) => {
            if (p.toString().includes('state.json')) return true;
            if (p.toString().includes('.jsonl')) return true;
            return false;
        });
        mockFs.readFileSync.mockReturnValue(JSON.stringify({ session: 'abc' }) as any);
        mockFs.truncateSync.mockReturnValue(undefined);

        clear({});
        expect(mockFs.truncateSync).toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Cleared log file'));
    });

    it('exits when no session can be determined', () => {
        mockFs.existsSync.mockReturnValue(false);
        expect(() => clear({})).toThrow('process.exit');
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Could not determine active session'));
    });

    it('truncates the output file when it exists', () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.truncateSync.mockReturnValue(undefined);

        clear({ session: 'test-session' });
        expect(mockFs.truncateSync).toHaveBeenCalledWith(expect.stringContaining('test-session.jsonl'), 0);
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Cleared log file'));
    });

    it('prints message when file does not exist', () => {
        mockFs.existsSync.mockImplementation((p: any) => {
            if (p.toString().includes('.jsonl')) return false;
            return false;
        });
        clear({ session: 'test-session' });
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('has no log file yet'));
    });

    it('handles corrupt state.json gracefully', () => {
        mockFs.existsSync.mockImplementation((p: any) => {
            if (p.toString().includes('state.json')) return true;
            return false;
        });
        mockFs.readFileSync.mockReturnValue('not-json' as any);

        // No session from corrupt state, should exit
        expect(() => clear({})).toThrow('process.exit');
    });
});
