import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as readline from 'readline';
import { spawnSync } from 'child_process';
import { readRuntimeEnvFile, runtimeEnvPath, type DebugHubEnv } from '../lib/runtimeEnv';

type DoctorOptions = {
    browser?: boolean;
    java?: boolean;
    envFile?: string;
};

type CollectorState = {
    pid: number;
    port: number;
    session: string;
};

type EndpointCheck = {
    ok: boolean;
    message: string;
};

type ResolvedJavaEnv = {
    env: DebugHubEnv;
    source: string;
};

export function doctor(options: DoctorOptions): void {
    const cwd = process.cwd();
    const debughubDir = path.join(cwd, '.debughub');
    const stateFile = path.join(debughubDir, 'state.json');
    const currentLink = path.join(debughubDir, 'vendor', 'current');

    console.log('🩺 DebugHub Doctor');
    console.log('==================');

    const installed = fs.existsSync(currentLink);
    console.log(`[${installed ? 'x' : ' '}] Installation: .debughub/vendor directory exists`);
    if (installed) {
        const version = fs.readFileSync(currentLink, 'utf-8').trim();
        console.log(`    Version linked: ${version}`);
    }

    const isRunning = fs.existsSync(stateFile);
    console.log(`[${isRunning ? 'x' : ' '}] Collector   : Running state found`);

    if (isRunning) {
        let state: CollectorState | null = null;
        try {
            state = JSON.parse(fs.readFileSync(stateFile, 'utf-8')) as CollectorState;
            console.log(`    Session ID: ${state.session}`);
            console.log(`    PID       : ${state.pid}`);
            console.log(`    Port      : ${state.port}`);

            const outFile = path.join(debughubDir, 'out', `${state.session}.jsonl`);
            try {
                fs.accessSync(path.dirname(outFile), fs.constants.W_OK);
                console.log(`[x] Output Path : ${outFile} is reachable/writable`);
            } catch {
                console.log(`[ ] Output Path : ${outFile} is NOT writable`);
            }
            logEventStatus(outFile);

            checkEndpointReachability(`http://127.0.0.1:${state.port}`, (result) => {
                console.log(result.ok
                    ? `[x] Reachability: ${result.message}`
                    : `[ ] Reachability: ${result.message}`);

                if (options.browser) {
                    runBrowserSelfTest(state!.session, state!.port, outFile);
                }

                if (options.java) {
                    runJavaDiagnostics(debughubDir, state!, options, result);
                }
            });
            return;
        } catch {
            console.log('    State file is unreadable or corrupt.');
            if (options.java) {
                runJavaDiagnostics(debughubDir, null, options);
            }
            return;
        }
    }

    if (options.browser) {
        console.log('\nCannot run browser self-test: collector is not running. Run `debughub start` first.');
    }
    if (options.java) {
        runJavaDiagnostics(debughubDir, null, options);
    }
}

function logEventStatus(outFile: string): void {
    if (!fs.existsSync(outFile)) {
        console.log(`[ ] Events     : Session file does not exist yet`);
        return;
    }

    try {
        const stat = fs.statSync(outFile);
        if (stat.size === 0) {
            console.log(`[ ] Events     : Session file exists but is empty — no events received yet`);
            console.log('');
            console.log(`    Likely causes:`);
            console.log(`    • Helper not loaded — verify your app imports debugProbe.browser.ts`);
            console.log(`    • Config not set — call initDebugHub() or set window.__DEBUGHUB__ before probes fire`);
            console.log(`    • Stale page bundle — rebuild and hard-refresh after adding the helper`);
            console.log(`    • Probe path not executed — confirm the instrumented code actually runs`);
            console.log(`    • Browser blocked request — check DevTools Network tab for failed POST to /event`);
            console.log(`    • Run \`doctor --browser\` to test transport and helper interactively`);
            return;
        }

        const content = fs.readFileSync(outFile, 'utf-8');
        const eventCount = content.split('\n').filter((line) => line.trim().length > 0).length;
        console.log(`[x] Events     : ${eventCount} events in session file`);
    } catch {
        console.log(`[ ] Events     : Could not inspect session file`);
    }
}

function runBrowserSelfTest(sessionId: string, port: number, outFile: string): void {
    console.log('\n--- Browser Self-Test ---\n');

    console.log('1. Transport test — paste in browser console:');
    console.log('```');
    console.log(`fetch("http://127.0.0.1:${port}/event", {`);
    console.log(`  method: "POST",`);
    console.log(`  headers: { "Content-Type": "application/json" },`);
    console.log(`  body: JSON.stringify({ ts: new Date().toISOString(), sessionId: "${sessionId}",`);
    console.log(`    label: "__browser_selftest__", data: { test: "transport" },`);
    console.log(`    hypothesisId: null, loc: null, level: "info", tags: null, runtime: "browser" })`);
    console.log(`}).then(r => console.log("DebugHub transport:", r.ok ? "OK" : "FAIL " + r.status))`);
    console.log(`  .catch(e => console.error("DebugHub transport:", e.message));`);
    console.log('```\n');

    console.log('2. Helper test — paste in browser console:');
    console.log('```');
    console.log(`window.__DEBUGHUB__ = { enabled: true, session: "${sessionId}", endpoint: "http://127.0.0.1:${port}" };`);
    console.log(`// Then call your debugProbe import:`);
    console.log(`debugProbe("__browser_selftest__", { test: "helper" });`);
    console.log(`// Check browser console for [DebugHub] messages if it doesn't work.`);
    console.log('```\n');

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('Press Enter when you\'ve pasted a snippet, then waiting up to 30s for the event...', () => {
        rl.close();

        let startSize = 0;
        try {
            const stat = fs.statSync(outFile);
            startSize = stat.size;
        } catch {
            // File may not exist yet.
        }

        let elapsed = 0;
        const interval = setInterval(() => {
            elapsed += 500;

            try {
                if (fs.existsSync(outFile)) {
                    const content = fs.readFileSync(outFile, 'utf-8');
                    const newContent = content.substring(startSize);
                    const lines = newContent.trim().split('\n').filter(Boolean);

                    for (const line of lines) {
                        try {
                            const parsed = JSON.parse(line) as { data?: { test?: string }; label?: string };
                            if (parsed.label === '__browser_selftest__') {
                                clearInterval(interval);
                                const testType = parsed.data?.test || 'unknown';
                                console.log(`\n✅ Self-test event received! (type: ${testType})`);
                                if (testType === 'transport') {
                                    console.log('   Transport is working — CORS and collector are fine.');
                                    console.log('   To also verify the helper, run snippet 2.');
                                } else if (testType === 'helper') {
                                    console.log('   Helper is working — config resolution, helper code, and transport all OK.');
                                }
                                return;
                            }
                        } catch {
                            // Skip malformed lines.
                        }
                    }
                }
            } catch {
                // Ignore read errors during polling.
            }

            if (elapsed >= 30000) {
                clearInterval(interval);
                console.log('\n❌ Timed out after 30s — no self-test event received.');
                console.log('\nTroubleshooting:');
                console.log('  - Did you paste the snippet in the browser console?');
                console.log('  - Check the browser console for errors (CORS, network, etc.)');
                console.log('  - Check the browser console for [DebugHub] diagnostic messages');
                console.log(`  - Verify the page can reach http://127.0.0.1:${port}`);
                console.log('  - Try snippet 1 first to isolate transport vs helper issues');
            }
        }, 500);
    });
}

function runJavaDiagnostics(
    debughubDir: string,
    state: CollectorState | null,
    options: DoctorOptions,
    collectorReachability?: EndpointCheck
): void {
    console.log('\n--- Java Diagnostics ---\n');

    const javaVersion = getJavaVersion();
    if (!javaVersion) {
        console.log('[ ] Java       : `java` is not available on PATH');
        console.log('    Install Java 11+ and rerun `debughub doctor --java`.');
    } else if (javaVersion.major < 11) {
        console.log(`[ ] Java       : Found Java ${javaVersion.major}, but Java 11+ is required for HttpClient`);
        console.log(`    Detected   : ${javaVersion.raw}`);
    } else {
        console.log(`[x] Java       : ${javaVersion.raw}`);
    }

    const resolvedEnv = resolveJavaEnv(debughubDir, options.envFile);
    if (!resolvedEnv) {
        console.log('[ ] Env Source : No DebugHub env vars found in the current shell or env file');
        console.log('    Update `.debughub/runtime.env` (or your EnvFile mapping) and restart the IntelliJ run configuration.');
        printJavaSelfTestSnippet(state?.session, state ? `http://127.0.0.1:${state.port}` : undefined);
        return;
    }

    console.log(`[x] Env Source : ${resolvedEnv.source}`);

    const enabled = resolvedEnv.env.DEBUGHUB_ENABLED === '1';
    if (enabled) {
        console.log('[x] Env Vars   : DEBUGHUB_ENABLED=1');
    } else {
        console.log('[ ] Env Vars   : DEBUGHUB_ENABLED must be 1');
    }

    const sessionId = resolvedEnv.env.DEBUGHUB_SESSION;
    if (sessionId) {
        console.log(`[x] Session    : ${sessionId}`);
    } else {
        console.log('[ ] Session    : DEBUGHUB_SESSION is missing');
    }

    const endpoint = resolvedEnv.env.DEBUGHUB_ENDPOINT;
    if (endpoint) {
        console.log(`[x] Endpoint   : ${endpoint}`);
    } else {
        console.log('[ ] Endpoint   : DEBUGHUB_ENDPOINT is missing');
    }

    if (state) {
        if (sessionId === state.session) {
            console.log(`[x] State Sync : Session matches active collector (${state.session})`);
        } else {
            console.log(`[ ] State Sync : Session mismatch. Active collector=${state.session}, env=${sessionId ?? '(missing)'}`);
            console.log('    Update the env file / EnvFile config and restart the IntelliJ run configuration.');
        }

        const activeEndpoint = `http://127.0.0.1:${state.port}`;
        if (endpoint === activeEndpoint) {
            console.log(`[x] Endpoint   : Env endpoint matches active collector (${activeEndpoint})`);
        } else {
            console.log(`[ ] Endpoint   : Env endpoint mismatch. Active collector=${activeEndpoint}, env=${endpoint ?? '(missing)'}`);
            console.log('    Update the env file / EnvFile config and restart the IntelliJ run configuration.');
        }
    } else {
        console.log('[ ] State Sync : Collector state not found. Run `debughub start` before verifying Java wiring.');
    }

    if (endpoint) {
        const collectorEndpoint = state ? `http://127.0.0.1:${state.port}` : null;
        if (collectorEndpoint && endpoint === collectorEndpoint && collectorReachability) {
            console.log(collectorReachability.ok
                ? `[x] Reachability: ${collectorReachability.message}`
                : `[ ] Reachability: ${collectorReachability.message}`);
            printJavaSelfTestSnippet(sessionId, endpoint);
            return;
        }

        checkEndpointReachability(endpoint, (result) => {
            console.log(result.ok
                ? `[x] Reachability: ${result.message}`
                : `[ ] Reachability: ${result.message}`);
            if (!result.ok) {
                console.log('    Update the env file / EnvFile config and restart the IntelliJ run configuration.');
            }
            printJavaSelfTestSnippet(sessionId, endpoint);
        });
        return;
    }

    printJavaSelfTestSnippet(sessionId, endpoint);
}

function printJavaSelfTestSnippet(sessionId?: string, endpoint?: string): void {
    if (!sessionId || !endpoint) {
        console.log('\nJava self-test snippet not available until DEBUGHUB_SESSION and DEBUGHUB_ENDPOINT are set.');
        return;
    }

    console.log('\nJava self-test — paste inside the class you instrumented or a temporary main path:');
    console.log('```java');
    console.log(`debugHubEmit("__java_selftest__", Map.of("source", "doctor"), Map.of("hypothesisId", "H1", "level", "info"));`);
    console.log('```');
    console.log('');
    console.log('Then run:');
    console.log('  debughub search --label __java_selftest__');
}

function resolveJavaEnv(debughubDir: string, envFileOption?: string): ResolvedJavaEnv | null {
    if (envFileOption) {
        const envFile = path.resolve(process.cwd(), envFileOption);
        if (!fs.existsSync(envFile)) {
            console.log(`[ ] Env File   : ${envFile} does not exist`);
            return null;
        }
        return {
            env: readRuntimeEnvFile(envFile),
            source: path.relative(process.cwd(), envFile) || envFile,
        };
    }

    if (hasCurrentProcessJavaEnv()) {
        return {
            env: {
                DEBUGHUB_ENABLED: process.env.DEBUGHUB_ENABLED,
                DEBUGHUB_SESSION: process.env.DEBUGHUB_SESSION,
                DEBUGHUB_ENDPOINT: process.env.DEBUGHUB_ENDPOINT,
            },
            source: 'process.env',
        };
    }

    const defaultEnvFile = runtimeEnvPath(debughubDir);
    if (fs.existsSync(defaultEnvFile)) {
        return {
            env: readRuntimeEnvFile(defaultEnvFile),
            source: path.relative(process.cwd(), defaultEnvFile) || defaultEnvFile,
        };
    }

    return null;
}

function hasCurrentProcessJavaEnv(): boolean {
    return Boolean(process.env.DEBUGHUB_ENABLED || process.env.DEBUGHUB_SESSION || process.env.DEBUGHUB_ENDPOINT);
}

function getJavaVersion(): { major: number; raw: string } | null {
    const result = spawnSync('java', ['-version'], { encoding: 'utf-8' });
    if (result.error) {
        return null;
    }

    const output = `${result.stderr ?? ''}\n${result.stdout ?? ''}`;
    const versionMatch = output.match(/version "([^"]+)"/) ?? output.match(/openjdk (\d+[\d._+]*)/);
    if (!versionMatch) {
        return { major: 0, raw: output.trim() || 'unknown version' };
    }

    const rawVersion = versionMatch[1];
    const major = parseJavaMajorVersion(rawVersion);
    return { major, raw: rawVersion };
}

function parseJavaMajorVersion(version: string): number {
    if (version.startsWith('1.')) {
        return parseInt(version.split('.')[1], 10);
    }

    const firstSegment = version.split(/[._+-]/)[0];
    const parsed = parseInt(firstSegment, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
}

function checkEndpointReachability(endpoint: string, callback: (result: EndpointCheck) => void): void {
    let url: URL;
    try {
        url = new URL(endpoint.endsWith('/') ? `${endpoint}event` : `${endpoint}/event`);
    } catch (error) {
        callback({ ok: false, message: `Invalid endpoint: ${(error as Error).message}` });
        return;
    }

    const req = http.request({
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'OPTIONS',
    }, (res) => {
        if (res.statusCode === 204) {
            callback({ ok: true, message: `Endpoint ${url.origin}${url.pathname} is responding` });
            return;
        }

        callback({ ok: false, message: `Endpoint responded with ${res.statusCode}` });
    });

    req.on('error', (error) => {
        callback({ ok: false, message: `Error connecting to endpoint: ${error.message}` });
    });
    req.end();
}
