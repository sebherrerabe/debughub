import { spawnSync } from 'child_process';

export type RuntimePrereqs = {
    java: string;
    javac: string;
    python: string;
    go: string;
    rustc: string;
    php: string;
    dotnet: string;
    dotnetMajor: number;
};

export function assertRequiredRuntimes(): RuntimePrereqs {
    const missing: string[] = [];

    const java = detectTool('java', ['-version']);
    if (!java.ok) missing.push('java');

    const javac = detectTool('javac', ['-version']);
    if (!javac.ok) missing.push('javac');

    const go = detectTool('go', ['version']);
    if (!go.ok) missing.push('go');

    const rustc = detectTool('rustc', ['--version']);
    if (!rustc.ok) missing.push('rustc');

    const php = detectTool('php', ['-v']);
    if (!php.ok) missing.push('php');

    const dotnet = detectTool('dotnet', ['--version']);
    if (!dotnet.ok) missing.push('dotnet');

    const python3 = detectTool('python3', ['--version']);
    const python = detectTool('python', ['--version']);
    const chosenPython = python3.ok ? python3 : python.ok ? python : null;
    if (!chosenPython) missing.push('python3/python');

    if (missing.length > 0) {
        throw new Error(
            `Missing required runtimes/tools for helper E2E tests: ${missing.join(', ')}. ` +
            'Install all required runtimes (see docs/RUNTIME_PREREQS.md) or remove the runtime.e2e test suite.'
        );
    }
    if (!chosenPython) {
        throw new Error('Internal preflight error: expected python runtime selection');
    }

    const dotnetMajor = parseDotnetMajor(dotnet.version);
    if (!dotnetMajor) {
        throw new Error(`Unable to parse dotnet version from output: ${dotnet.version}`);
    }

    return {
        java: java.command,
        javac: javac.command,
        python: chosenPython.command,
        go: go.command,
        rustc: rustc.command,
        php: php.command,
        dotnet: dotnet.command,
        dotnetMajor,
    };
}

function detectTool(command: string, args: string[]): { ok: boolean; command: string; version: string } {
    const result = spawnSync(command, args, { encoding: 'utf-8' });
    if (result.error) {
        return { ok: false, command, version: '' };
    }
    if (result.status !== 0 && !hasVersionText(result.stdout, result.stderr)) {
        return { ok: false, command, version: '' };
    }

    const version = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
    return { ok: true, command, version };
}

function hasVersionText(stdout: string | null, stderr: string | null): boolean {
    return Boolean((stdout && stdout.trim().length > 0) || (stderr && stderr.trim().length > 0));
}

function parseDotnetMajor(version: string): number {
    const match = version.match(/(\d+)\./);
    if (!match) return 0;
    return parseInt(match[1], 10);
}
