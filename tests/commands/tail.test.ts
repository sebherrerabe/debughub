import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

import { tail } from '../../src/commands/tail';

describe('tail command', () => {
    let consoleSpy: jest.SpyInstance;
    let consoleErrorSpy: jest.SpyInstance;
    let consoleDirSpy: jest.SpyInstance;
    let exitSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        consoleDirSpy = jest.spyOn(console, 'dir').mockImplementation();
        exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => { throw new Error('process.exit'); }) as any);
    });

    afterEach(() => {
        consoleSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        consoleDirSpy.mockRestore();
        exitSpy.mockRestore();
    });

    it('reads session from state.json when no --session given', () => {
        mockFs.existsSync.mockImplementation((p: any) => {
            if (p.toString().includes('state.json')) return true;
            if (p.toString().includes('.jsonl')) return true;
            return false;
        });
        mockFs.readFileSync.mockImplementation((p: any) => {
            if (p.toString().includes('state.json')) return JSON.stringify({ session: 'abc-123' }) as any;
            if (p.toString().includes('.jsonl')) return '' as any;
            return '' as any;
        });

        tail({ n: '10' });
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No events yet'));
    });

    it('exits when no session can be determined', () => {
        mockFs.existsSync.mockReturnValue(false);
        expect(() => tail({ n: '10' })).toThrow('process.exit');
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Could not determine active session'));
    });

    it('prints message when log file does not exist', () => {
        mockFs.existsSync.mockImplementation((p: any) => {
            if (p.toString().includes('.jsonl')) return false;
            return false;
        });
        tail({ n: '10', session: 'test-session' });
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No events yet'));
    });

    it('prints raw JSON when --json flag is set', () => {
        const event = JSON.stringify({ ts: '2024-01-01T00:00:00Z', label: 'test', level: 'info', data: null });
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockImplementation((p: any) => {
            if (p.toString().includes('.jsonl')) return `${event}\n` as any;
            return '' as any;
        });

        tail({ n: '10', session: 'test-session', json: true });
        expect(consoleSpy).toHaveBeenCalledWith(event);
    });

    it('prints pretty formatted output with info level', () => {
        const event = JSON.stringify({ ts: '2024-01-01T00:00:00Z', label: 'test_label', level: 'info', data: null, hypothesisId: null, loc: null });
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockImplementation((p: any) => {
            if (p.toString().includes('.jsonl')) return `${event}\n` as any;
            return '' as any;
        });

        tail({ n: '10', session: 'test-session' });
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('test_label'));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[INFO]'));
    });

    it('prints warn and error levels correctly', () => {
        const warnEvent = JSON.stringify({ ts: '2024-01-01T00:00:00Z', label: 'warn_label', level: 'warn', data: null });
        const errorEvent = JSON.stringify({ ts: '2024-01-01T00:00:01Z', label: 'error_label', level: 'error', data: null });
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockImplementation((p: any) => {
            if (p.toString().includes('.jsonl')) return `${warnEvent}\n${errorEvent}\n` as any;
            return '' as any;
        });

        tail({ n: '10', session: 'test-session' });
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[WARN]'));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[ERROR]'));
    });

    it('shows hypothesis and loc in metadata', () => {
        const event = JSON.stringify({ ts: '2024-01-01T00:00:00Z', label: 'meta_test', level: 'info', data: null, hypothesisId: 'H1', loc: 'file.ts:42' });
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockImplementation((p: any) => {
            if (p.toString().includes('.jsonl')) return `${event}\n` as any;
            return '' as any;
        });

        tail({ n: '10', session: 'test-session' });
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[H:H1]'));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[L:file.ts:42]'));
    });

    it('displays data object when not null', () => {
        const event = JSON.stringify({ ts: '2024-01-01T00:00:00Z', label: 'data_test', level: 'info', data: { key: 'value' } });
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockImplementation((p: any) => {
            if (p.toString().includes('.jsonl')) return `${event}\n` as any;
            return '' as any;
        });

        tail({ n: '10', session: 'test-session' });
        expect(consoleDirSpy).toHaveBeenCalledWith({ key: 'value' }, expect.objectContaining({ depth: 4 }));
    });

    it('falls back to raw line when JSON is malformed', () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockImplementation((p: any) => {
            if (p.toString().includes('.jsonl')) return 'malformed-line\n' as any;
            return '' as any;
        });

        tail({ n: '10', session: 'test-session' });
        expect(consoleSpy).toHaveBeenCalledWith('malformed-line');
    });

    it('limits output to last N lines', () => {
        const lines = Array.from({ length: 10 }, (_, i) =>
            JSON.stringify({ ts: '2024-01-01T00:00:00Z', label: `event-${i}`, level: 'info', data: null })
        ).join('\n');
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockImplementation((p: any) => {
            if (p.toString().includes('.jsonl')) return lines as any;
            return '' as any;
        });

        tail({ n: '3', session: 'test-session', json: true });
        // Should only print 3 lines
        const logCalls = consoleSpy.mock.calls.filter((c: any[]) => c[0].includes('event-'));
        expect(logCalls).toHaveLength(3);
    });
});
