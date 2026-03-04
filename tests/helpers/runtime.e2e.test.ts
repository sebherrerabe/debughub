import * as path from 'path';
import { buildJavaMain, type FixtureMode } from './e2e/fixtures/java/mainFactory';
import { buildPythonMain } from './e2e/fixtures/python/mainFactory';
import { buildGoMain } from './e2e/fixtures/go/mainFactory';
import { buildPhpMain } from './e2e/fixtures/php/mainFactory';
import { buildRustMain } from './e2e/fixtures/rust/mainFactory';
import { buildCSharpProgram, buildCSharpProject } from './e2e/fixtures/csharp/mainFactory';
import { validateEventContract } from './e2e/httpContract';
import { assertRequiredRuntimes, type RuntimePrereqs } from './e2e/runtimePrereqs';
import { copyFile, createCaptureServer, makeTempDir, removeDir, runCommand, writeFiles, type CommandResult } from './e2e/runtimeHarness';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SESSION_ID = 'runtime-e2e-session';
const DISCONNECTED_ENDPOINT = 'http://127.0.0.1:1';
const MALFORMED_ENDPOINT = 'http://%';
const PREREQ_CHECK = detectRuntimePrereqs();

jest.setTimeout(180000);

describe('HTTP contract validator', () => {
    it('accepts valid payload', () => {
        const event = validateEventContract(
            {
                ts: '2026-01-01T00:00:00.000Z',
                sessionId: SESSION_ID,
                label: 'x',
                data: null,
                hypothesisId: null,
                loc: null,
                level: 'info',
                tags: null,
                runtime: 'java',
            },
            'java',
            'x',
            SESSION_ID
        );
        expect(event.level).toBe('info');
    });

    it('rejects missing required keys', () => {
        expect(() =>
            validateEventContract(
                {
                    ts: '2026-01-01T00:00:00.000Z',
                    sessionId: SESSION_ID,
                },
                'java',
                'x',
                SESSION_ID
            )
        ).toThrow('Missing required key');
    });

    it('rejects invalid level', () => {
        expect(() =>
            validateEventContract(
                {
                    ts: '2026-01-01T00:00:00.000Z',
                    sessionId: SESSION_ID,
                    label: 'x',
                    data: null,
                    hypothesisId: null,
                    loc: null,
                    level: 'verbose',
                    tags: null,
                    runtime: 'java',
                },
                'java',
                'x',
                SESSION_ID
            )
        ).toThrow('Invalid level');
    });

    it('rejects invalid timestamp/session/label types', () => {
        expect(() =>
            validateEventContract(
                {
                    ts: 123,
                    sessionId: SESSION_ID,
                    label: 'x',
                    data: null,
                    hypothesisId: null,
                    loc: null,
                    level: 'info',
                    tags: null,
                    runtime: 'java',
                },
                'java',
                'x',
                SESSION_ID
            )
        ).toThrow('Invalid string field: ts');
    });

    it('rejects non-ISO timestamp strings', () => {
        expect(() =>
            validateEventContract(
                {
                    ts: '1704067200.123Z',
                    sessionId: SESSION_ID,
                    label: 'x',
                    data: null,
                    hypothesisId: null,
                    loc: null,
                    level: 'info',
                    tags: null,
                    runtime: 'java',
                },
                'java',
                'x',
                SESSION_ID
            )
        ).toThrow('Invalid ISO-8601 timestamp: ts');
    });
});

describe('cross-runtime helpers e2e', () => {
    if (PREREQ_CHECK.error || !PREREQ_CHECK.prereqs) {
        it('fails fast when required runtimes/tools are missing', () => {
            throw PREREQ_CHECK.error ?? new Error('Unknown runtime preflight error');
        });
        return;
    }
    const prereqs = PREREQ_CHECK.prereqs;

    const runtimes: Array<{
        runtime: string;
        run: (mode: FixtureMode, endpoint: string, sessionId?: string) => CommandResult;
        emitLabel: string;
    }> = [
        { runtime: 'java', run: (m, e, s) => runJava(m, e, s, prereqs), emitLabel: 'java_emit' },
        { runtime: 'python', run: (m, e, s) => runPython(m, e, s, prereqs), emitLabel: 'python_emit' },
        { runtime: 'rust', run: (m, e, s) => runRust(m, e, s, prereqs), emitLabel: 'rust_emit' },
        { runtime: 'php', run: (m, e, s) => runPhp(m, e, s, prereqs), emitLabel: 'php_emit' },
        { runtime: 'go', run: (m, e, s) => runGo(m, e, s, prereqs), emitLabel: 'go_emit' },
        { runtime: 'csharp', run: (m, e, s) => runCSharp(m, e, s, prereqs), emitLabel: 'csharp_emit' },
    ];

    for (const runtimeCfg of runtimes) {
        describe(runtimeCfg.runtime, () => {
            it('emits a valid event when enabled', async () => {
                const server = await createCaptureServer();
                try {
                    const result = runtimeCfg.run('emit', server.endpoint, SESSION_ID);
                    expectSuccessfulExit(result, runtimeCfg.runtime, 'emit');
                    const events = await server.waitForEvents(1, 10000);
                    const event = validateEventContract(events[0], runtimeCfg.runtime, runtimeCfg.emitLabel, SESSION_ID);
                    expect(event.data).toBeNull();
                    expect(event.hypothesisId).toBeNull();
                    expect(event.loc).toBeNull();
                    expect(event.level).toBe('info');
                    expect(event.tags).toBeNull();
                } finally {
                    await server.close();
                }
            });

            it('does not emit when disabled', async () => {
                const server = await createCaptureServer();
                try {
                    const result = runtimeCfg.run('disabled', server.endpoint, SESSION_ID);
                    expectSuccessfulExit(result, runtimeCfg.runtime, 'disabled');
                    await sleep(250);
                    expect(server.events).toHaveLength(0);
                } finally {
                    await server.close();
                }
            });

            it('does not emit when session is missing', async () => {
                const server = await createCaptureServer();
                try {
                    const result = runtimeCfg.run('missingSession', server.endpoint);
                    expectSuccessfulExit(result, runtimeCfg.runtime, 'missingSession');
                    await sleep(250);
                    expect(server.events).toHaveLength(0);
                } finally {
                    await server.close();
                }
            });

            it('never throws on bad endpoint', () => {
                const result = runtimeCfg.run('badEndpoint', DISCONNECTED_ENDPOINT, SESSION_ID);
                expectSuccessfulExit(result, runtimeCfg.runtime, 'badEndpoint');
            });

            if (runtimeCfg.runtime === 'java') {
                it('never throws on malformed endpoint', () => {
                    const result = runtimeCfg.run('emit', MALFORMED_ENDPOINT, SESSION_ID);
                    expectSuccessfulExit(result, 'java', 'malformedEndpoint');
                });
            }
        });
    }
});

function helperPath(relPath: string): string {
    return path.join(REPO_ROOT, 'helpers', relPath);
}

function buildEnv(mode: FixtureMode, endpoint: string, sessionId?: string): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...process.env };
    env.DEBUGHUB_ENABLED = mode === 'disabled' ? '0' : '1';
    if (mode === 'missingSession') {
        delete env.DEBUGHUB_SESSION;
    } else if (sessionId) {
        env.DEBUGHUB_SESSION = sessionId;
    }
    env.DEBUGHUB_ENDPOINT = endpoint;
    return env;
}

function runJava(mode: FixtureMode, endpoint: string, sessionId: string | undefined, prereqs: RuntimePrereqs): CommandResult {
    const tmp = makeTempDir('debughub-java-e2e-');
    try {
        copyFile(helperPath(path.join('java', 'DebugProbe.java')), path.join(tmp, 'debughub', 'DebugProbe.java'));
        writeFiles(tmp, { 'Main.java': buildJavaMain() });

        const compileResult = runCommand(prereqs.javac, ['-d', tmp, path.join(tmp, 'debughub', 'DebugProbe.java'), path.join(tmp, 'Main.java')], { cwd: tmp });
        expectSuccessfulExit(compileResult, 'java', 'compile');

        return runCommand(prereqs.java, ['-cp', tmp, 'Main', mode], {
            cwd: tmp,
            env: buildEnv(mode, endpoint, sessionId),
            timeoutMs: 30000,
        });
    } finally {
        removeDir(tmp);
    }
}

function runPython(mode: FixtureMode, endpoint: string, sessionId: string | undefined, prereqs: RuntimePrereqs): CommandResult {
    const tmp = makeTempDir('debughub-python-e2e-');
    try {
        copyFile(helperPath(path.join('python', 'debugProbe.py')), path.join(tmp, 'debugProbe.py'));
        writeFiles(tmp, { 'main.py': buildPythonMain(mode) });
        return runCommand(prereqs.python, ['main.py'], {
            cwd: tmp,
            env: buildEnv(mode, endpoint, sessionId),
            timeoutMs: 30000,
        });
    } finally {
        removeDir(tmp);
    }
}

function runRust(mode: FixtureMode, endpoint: string, sessionId: string | undefined, prereqs: RuntimePrereqs): CommandResult {
    const tmp = makeTempDir('debughub-rust-e2e-');
    try {
        copyFile(helperPath(path.join('rust', 'debug_probe.rs')), path.join(tmp, 'debug_probe.rs'));
        writeFiles(tmp, { 'main.rs': buildRustMain(mode) });

        const compileResult = runCommand(prereqs.rustc, ['main.rs', '-o', 'app'], {
            cwd: tmp,
            timeoutMs: 40000,
        });
        expectSuccessfulExit(compileResult, 'rust', 'compile');

        return runCommand(path.join(tmp, process.platform === 'win32' ? 'app.exe' : 'app'), [], {
            cwd: tmp,
            env: buildEnv(mode, endpoint, sessionId),
            timeoutMs: 30000,
        });
    } finally {
        removeDir(tmp);
    }
}

function runPhp(mode: FixtureMode, endpoint: string, sessionId: string | undefined, prereqs: RuntimePrereqs): CommandResult {
    const tmp = makeTempDir('debughub-php-e2e-');
    try {
        copyFile(helperPath(path.join('php', 'DebugProbe.php')), path.join(tmp, 'DebugProbe.php'));
        writeFiles(tmp, { 'main.php': buildPhpMain(mode) });
        return runCommand(prereqs.php, ['main.php'], {
            cwd: tmp,
            env: buildEnv(mode, endpoint, sessionId),
            timeoutMs: 30000,
        });
    } finally {
        removeDir(tmp);
    }
}

function runGo(mode: FixtureMode, endpoint: string, sessionId: string | undefined, prereqs: RuntimePrereqs): CommandResult {
    const tmp = makeTempDir('debughub-go-e2e-');
    try {
        copyFile(helperPath(path.join('go', 'debug_probe.go')), path.join(tmp, 'debug_probe.go'));
        writeFiles(tmp, { 'main.go': buildGoMain(mode) });
        return runCommand(prereqs.go, ['run', 'main.go', 'debug_probe.go'], {
            cwd: tmp,
            env: buildEnv(mode, endpoint, sessionId),
            timeoutMs: 40000,
        });
    } finally {
        removeDir(tmp);
    }
}

function runCSharp(mode: FixtureMode, endpoint: string, sessionId: string | undefined, prereqs: RuntimePrereqs): CommandResult {
    const tmp = makeTempDir('debughub-csharp-e2e-');
    try {
        const tfm = `net${prereqs.dotnetMajor}.0`;
        copyFile(helperPath(path.join('csharp', 'DebugProbe.cs')), path.join(tmp, 'DebugProbe.cs'));
        writeFiles(tmp, {
            'Program.cs': buildCSharpProgram(mode),
            'DebugProbeHarness.csproj': buildCSharpProject(tfm),
        });

        return runCommand(prereqs.dotnet, ['run', '--project', 'DebugProbeHarness.csproj', '--nologo'], {
            cwd: tmp,
            env: buildEnv(mode, endpoint, sessionId),
            timeoutMs: 120000,
        });
    } finally {
        removeDir(tmp);
    }
}

function expectSuccessfulExit(result: CommandResult, runtime: string, mode: string): void {
    if (result.status === 0) {
        return;
    }
    throw new Error(
        `${runtime} ${mode} command failed with status ${result.status}\n` +
        `STDOUT:\n${result.stdout}\n` +
        `STDERR:\n${result.stderr}`
    );
}

async function sleep(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
}

function detectRuntimePrereqs(): { prereqs: RuntimePrereqs | null; error: Error | null } {
    try {
        return { prereqs: assertRequiredRuntimes(), error: null };
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        return { prereqs: null, error: err };
    }
}
