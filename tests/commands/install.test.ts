import * as fs from 'fs';

jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

// We need to mock verifyVendorFiles before importing install
jest.mock('../../src/commands/verify', () => ({
    verifyVendorFiles: jest.fn(),
}));

import { install } from '../../src/commands/install';
import { verifyVendorFiles } from '../../src/commands/verify';

const mockVerify = verifyVendorFiles as jest.Mock;

describe('install command', () => {
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

    it('exits when dist vendor bundle is not found', () => {
        mockFs.existsSync.mockReturnValue(false);
        expect(() => install()).toThrow('process.exit');
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Cannot find DebugHub distribution bundle'));
        expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('copies files, writes current pointer, and creates default config', () => {
        // dist vendor exists
        mockFs.existsSync.mockImplementation((p: any) => {
            const s = p.toString();
            if (s.includes('debughub.json')) return false; // config does not exist yet
            return true; // dist vendor exists, etc.
        });
        mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
        mockFs.mkdirSync.mockReturnValue(undefined as any);
        mockFs.writeFileSync.mockReturnValue(undefined);
        mockFs.copyFileSync.mockReturnValue(undefined);
        mockFs.readdirSync.mockReturnValue([] as any);
        mockVerify.mockReturnValue(true);

        install();

        expect(mockFs.mkdirSync).toHaveBeenCalled();
        expect(mockFs.writeFileSync).toHaveBeenCalledWith(expect.stringContaining('current'), expect.any(String), 'utf-8');
        // config was written since it didn't exist
        expect(mockFs.writeFileSync).toHaveBeenCalledWith(
            expect.stringContaining('debughub.json'),
            expect.stringContaining('bindHost'),
            'utf-8'
        );
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Installation verified successfully'));
    });

    it('does not overwrite existing config', () => {
        mockFs.existsSync.mockReturnValue(true); // everything exists, including config
        mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
        mockFs.mkdirSync.mockReturnValue(undefined as any);
        mockFs.writeFileSync.mockReturnValue(undefined);
        mockFs.copyFileSync.mockReturnValue(undefined);
        mockFs.readdirSync.mockReturnValue([] as any);
        mockVerify.mockReturnValue(true);

        install();

        // writeFileSync should NOT have been called with debughub.json (only current)
        const configCalls = (mockFs.writeFileSync as jest.Mock).mock.calls.filter(
            (c: any[]) => c[0].toString().includes('debughub.json')
        );
        expect(configCalls).toHaveLength(0);
    });

    it('exits when verify fails after install', () => {
        mockFs.existsSync.mockImplementation((p: any) => {
            if (p.toString().includes('debughub.json')) return false;
            return true;
        });
        mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
        mockFs.mkdirSync.mockReturnValue(undefined as any);
        mockFs.writeFileSync.mockReturnValue(undefined);
        mockFs.copyFileSync.mockReturnValue(undefined);
        mockFs.readdirSync.mockReturnValue([] as any);
        mockVerify.mockReturnValue(false);

        expect(() => install()).toThrow('process.exit');
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Verify failed'));
        expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('recursively copies directories', () => {
        const existsCalls: string[] = [];
        mockFs.existsSync.mockImplementation((p: any) => {
            existsCalls.push(p.toString());
            if (p.toString().includes('debughub.json')) return false;
            return true;
        });
        // First call = directory, second call = file
        let statCallCount = 0;
        mockFs.statSync.mockImplementation(() => {
            statCallCount++;
            if (statCallCount === 1) return { isDirectory: () => true } as any;
            return { isDirectory: () => false } as any;
        });
        mockFs.readdirSync.mockImplementation((_p: any) => {
            if (statCallCount <= 1) return ['subfile.ts'] as any;
            return [] as any;
        });
        mockFs.mkdirSync.mockReturnValue(undefined as any);
        mockFs.writeFileSync.mockReturnValue(undefined);
        mockFs.copyFileSync.mockReturnValue(undefined);
        mockVerify.mockReturnValue(true);

        install();

        expect(mockFs.copyFileSync).toHaveBeenCalled();
    });
});
