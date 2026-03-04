import * as fs from 'fs';
import * as crypto from 'crypto';

jest.mock('fs');
jest.mock('crypto');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockCrypto = crypto as jest.Mocked<typeof crypto>;

import { verify, verifyVendorFiles } from '../../src/commands/verify';

describe('verify command', () => {
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

    describe('verifyVendorFiles', () => {
        it('returns false when current link file does not exist', () => {
            mockFs.existsSync.mockReturnValue(false);
            const result = verifyVendorFiles('/repo');
            expect(result).toBe(false);
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Not found'));
        });

        it('returns false when MANIFEST.json is missing', () => {
            mockFs.existsSync.mockImplementation((p: any) => {
                const s = p.toString();
                if (s.includes('current')) return true;
                if (s.includes('MANIFEST.json')) return false;
                return false;
            });
            mockFs.readFileSync.mockReturnValue('1.0.0' as any);
            const result = verifyVendorFiles('/repo');
            expect(result).toBe(false);
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Missing MANIFEST.json'));
        });

        it('returns false when MANIFEST.json is corrupt JSON', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockImplementation((p: any) => {
                const s = p.toString();
                if (s.includes('current')) return '1.0.0' as any;
                if (s.includes('MANIFEST.json')) return 'not-json' as any;
                return '' as any;
            });
            const result = verifyVendorFiles('/repo');
            expect(result).toBe(false);
            expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to parse MANIFEST.json');
        });

        it('returns false when a file in the manifest is missing from disk', () => {
            mockFs.existsSync.mockImplementation((p: any) => {
                const s = p.toString();
                if (s.includes('current')) return true;
                if (s.includes('MANIFEST.json')) return true;
                // the individual file
                return false;
            });
            mockFs.readFileSync.mockImplementation((p: any) => {
                const s = p.toString();
                if (s.includes('current')) return '1.0.0' as any;
                if (s.includes('MANIFEST.json')) return JSON.stringify({ 'ts/debugProbe.ts': 'abc123' }) as any;
                return '' as any;
            });
            const result = verifyVendorFiles('/repo');
            expect(result).toBe(false);
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('File missing'));
        });

        it('returns false when a file checksum mismatches', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockImplementation((p: any) => {
                const s = p.toString();
                if (s.includes('current')) return '1.0.0' as any;
                if (s.includes('MANIFEST.json')) return JSON.stringify({ 'ts/debugProbe.ts': 'expected_hash' }) as any;
                return Buffer.from('file contents') as any;
            });
            const mockHash = { update: jest.fn().mockReturnThis(), digest: jest.fn().mockReturnValue('wrong_hash') };
            mockCrypto.createHash.mockReturnValue(mockHash as any);

            const result = verifyVendorFiles('/repo');
            expect(result).toBe(false);
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Checksum mismatch'));
        });

        it('returns true when all file checksums match', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockImplementation((p: any) => {
                const s = p.toString();
                if (s.includes('current')) return '1.0.0' as any;
                if (s.includes('MANIFEST.json')) return JSON.stringify({ 'ts/debugProbe.ts': 'correct_hash' }) as any;
                return Buffer.from('file contents') as any;
            });
            const mockHash = { update: jest.fn().mockReturnThis(), digest: jest.fn().mockReturnValue('correct_hash') };
            mockCrypto.createHash.mockReturnValue(mockHash as any);

            const result = verifyVendorFiles('/repo');
            expect(result).toBe(true);
        });
    });

    describe('verify (CLI wrapper)', () => {
        it('prints success when valid', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockImplementation((p: any) => {
                const s = p.toString();
                if (s.includes('current')) return '1.0.0' as any;
                if (s.includes('MANIFEST.json')) return JSON.stringify({}) as any;
                return '' as any;
            });
            verify();
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Integrity check passed'));
        });

        it('exits with 1 when invalid', () => {
            mockFs.existsSync.mockReturnValue(false);
            expect(() => verify()).toThrow('process.exit');
            expect(exitSpy).toHaveBeenCalledWith(1);
        });
    });
});
