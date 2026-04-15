import { createProgram } from '../src/cli';

describe('CLI smoke test', () => {
    it('prints help with all commands listed', () => {
        const output = createProgram().helpInformation();
        expect(output).toContain('debughub');
        expect(output).toContain('install');
        expect(output).toContain('start');
        expect(output).toContain('stop');
        expect(output).toContain('tail');
        expect(output).toContain('search');
        expect(output).toContain('clear');
        expect(output).toContain('verify');
        expect(output).toContain('doctor');
        expect(output).toContain('inject');
    });

    it('prints version', () => {
        const output = createProgram().version();
        expect(output).toMatch(/^\d+\.\d+\.\d+$/);
    });
});
