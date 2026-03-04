import { execSync } from 'child_process';
import * as path from 'path';

describe('CLI smoke test', () => {
    const cliPath = path.resolve(__dirname, '..', 'dist', 'cli.js');

    it('prints help with all commands listed', () => {
        const output = execSync(`node "${cliPath}" --help`, { encoding: 'utf-8' });
        expect(output).toContain('debughub');
        expect(output).toContain('install');
        expect(output).toContain('start');
        expect(output).toContain('stop');
        expect(output).toContain('tail');
        expect(output).toContain('search');
        expect(output).toContain('clear');
        expect(output).toContain('verify');
        expect(output).toContain('doctor');
    });

    it('prints version', () => {
        const output = execSync(`node "${cliPath}" --version`, { encoding: 'utf-8' });
        expect(output.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });
});
