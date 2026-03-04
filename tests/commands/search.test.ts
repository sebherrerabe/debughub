import * as fs from 'fs';

jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

import { search } from '../../src/commands/search';

describe('search command', () => {
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
            if (p.toString().includes('.jsonl')) return false;
            return false;
        });
        mockFs.readFileSync.mockImplementation((p: any) => {
            if (p.toString().includes('state.json')) return JSON.stringify({ session: 'abc' }) as any;
            return '' as any;
        });

        search('test', {});
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No events yet'));
    });

    it('exits when no session can be determined', () => {
        mockFs.existsSync.mockReturnValue(false);
        expect(() => search('test', {})).toThrow('process.exit');
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Could not determine active session'));
    });

    it('prints no matches when nothing found', () => {
        const event = JSON.stringify({ ts: '2024-01-01T00:00:00Z', label: 'hello', level: 'info', data: null });
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockImplementation((p: any) => {
            if (p.toString().includes('.jsonl')) return `${event}\n` as any;
            return '' as any;
        });

        search('zzzzz', { session: 'test' });
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No matches found'));
    });

    it('finds substring matches and prints match count', () => {
        const event = JSON.stringify({ ts: '2024-01-01T00:00:00Z', label: 'hello_world', level: 'info', data: null });
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockImplementation((p: any) => {
            if (p.toString().includes('.jsonl')) return `${event}\n` as any;
            return '' as any;
        });

        search('hello', { session: 'test' });
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('1 match'));
    });

    it('filters by label', () => {
        const e1 = JSON.stringify({ ts: '2024-01-01T00:00:00Z', label: 'alpha', level: 'info', data: null });
        const e2 = JSON.stringify({ ts: '2024-01-01T00:00:01Z', label: 'beta', level: 'info', data: null });
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockImplementation((p: any) => {
            if (p.toString().includes('.jsonl')) return `${e1}\n${e2}\n` as any;
            return '' as any;
        });

        search('', { session: 'test', label: 'alpha' });
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('alpha'));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('1 match'));
    });

    it('filters by hypothesis', () => {
        const e1 = JSON.stringify({ ts: '2024-01-01T00:00:00Z', label: 'test', level: 'info', data: null, hypothesisId: 'H1' });
        const e2 = JSON.stringify({ ts: '2024-01-01T00:00:01Z', label: 'test', level: 'info', data: null, hypothesisId: 'H2' });
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockImplementation((p: any) => {
            if (p.toString().includes('.jsonl')) return `${e1}\n${e2}\n` as any;
            return '' as any;
        });

        search('', { session: 'test', hypothesis: 'H1' });
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('1 match'));
    });

    it('filters by level', () => {
        const e1 = JSON.stringify({ ts: '2024-01-01T00:00:00Z', label: 'test', level: 'error', data: null });
        const e2 = JSON.stringify({ ts: '2024-01-01T00:00:01Z', label: 'test', level: 'info', data: null });
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockImplementation((p: any) => {
            if (p.toString().includes('.jsonl')) return `${e1}\n${e2}\n` as any;
            return '' as any;
        });

        search('', { session: 'test', level: 'error' });
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[ERROR]'));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('1 match'));
    });

    it('matches malformed JSON lines by substring', () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockImplementation((p: any) => {
            if (p.toString().includes('.jsonl')) return 'malformed-line-with-keyword\n' as any;
            return '' as any;
        });

        search('keyword', { session: 'test' });
        expect(consoleSpy).toHaveBeenCalledWith('malformed-line-with-keyword');
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('1 match'));
    });

    it('displays data when present', () => {
        const event = JSON.stringify({ ts: '2024-01-01T00:00:00Z', label: 'test', level: 'info', data: { x: 1 } });
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockImplementation((p: any) => {
            if (p.toString().includes('.jsonl')) return `${event}\n` as any;
            return '' as any;
        });

        search('test', { session: 'test' });
        expect(consoleDirSpy).toHaveBeenCalledWith({ x: 1 }, expect.objectContaining({ depth: 4 }));
    });
});
