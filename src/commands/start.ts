import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { spawn } from 'child_process';
import { writeRuntimeEnvFile } from '../lib/runtimeEnv';

export function start() {
    const cwd = process.cwd();
    const debughubDir = path.join(cwd, '.debughub');
    const stateFile = path.join(debughubDir, 'state.json');

    if (!fs.existsSync(debughubDir)) {
        console.error('Error: .debughub directory not found. Did you run `debughub install`?');
        process.exit(1);
    }

    // Check if already running
    if (fs.existsSync(stateFile)) {
        let state: { pid?: number; session?: string } | null = null;
        try {
            state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
        } catch (e) { }

        if (state?.pid) {
            let isRunning = false;
            try {
                process.kill(state.pid, 0); // test if running
                isRunning = true;
            } catch (e) {
                // Process not actually running, clear state
                fs.unlinkSync(stateFile);
            }

            if (isRunning) {
                console.error(`Collector is already running with PID ${state.pid} (Session: ${state.session})`);
                console.error(`Run \`debughub stop\` to stop it first.`);
                process.exit(1);
            }
        }
    }

    const sessionId = crypto.randomUUID();
    const outDir = path.join(debughubDir, 'out');
    fs.mkdirSync(outDir, { recursive: true });

    // Eagerly create session file (touch semantics — create if missing, preserve if exists)
    const outFile = path.join(outDir, `${sessionId}.jsonl`);
    fs.closeSync(fs.openSync(outFile, 'a'));

    const port = process.env.DEBUGHUB_PORT ? parseInt(process.env.DEBUGHUB_PORT, 10) : 0; // 0 means pick random

    // Spawn the server in detached mode
    const cliPath = path.resolve(__dirname, '..', 'cli.js');

    const outLog = fs.openSync(path.join(debughubDir, 'server.log'), 'a');
    const errLog = fs.openSync(path.join(debughubDir, 'error.log'), 'a');

    const child = spawn(process.execPath, [cliPath, '_server', sessionId, port.toString()], {
        detached: true,
        stdio: ['ignore', outLog, errLog]
    });

    child.unref();

    // We need to wait a tiny bit to read the port from state file that the child writes,
    // or the child can write it and we just tell the user to check `.debughub/state.json`.
    // To be user-friendly, let's wait up to 2 seconds for state.json to appear with our sessionId

    let attempts = 0;
    let finalPort = port;
    while (attempts < 20) {
        if (fs.existsSync(stateFile)) {
            try {
                const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
                if (state.session === sessionId && state.port) {
                    finalPort = state.port;
                    break;
                }
            } catch (e) { }
        }
        // sleep
        const startTm = Date.now();
        while (Date.now() - startTm < 100) {
            // intentional busy-wait to keep implementation synchronous
        }
        attempts++;
    }

    if (finalPort === 0) {
        console.log("Started collector but couldn't confirm port. Check .debughub/state.json");
        // Fallback display
    } else {
        const runtimeEnvFile = writeRuntimeEnvFile(debughubDir, sessionId, `http://127.0.0.1:${finalPort}`);
        console.log(`\nDebugHub Collector Started!`);
        console.log(`Session ID   : ${sessionId}`);
        console.log(`Endpoint     : http://127.0.0.1:${finalPort}/event`);
        console.log(`Output File  : .debughub/out/${sessionId}.jsonl`);
        console.log(`Env File     : ${path.relative(cwd, runtimeEnvFile)}`);
        console.log(`\nEnvironment variables to set:`);
        console.log(`  DEBUGHUB_ENABLED=1`);
        console.log(`  DEBUGHUB_SESSION=${sessionId}`);
        console.log(`  DEBUGHUB_ENDPOINT=http://127.0.0.1:${finalPort}\n`);
        console.log(`Browser (no bundler config needed):`);
        console.log(`  <script>window.__DEBUGHUB__ = { enabled: true, session: "${sessionId}", endpoint: "http://127.0.0.1:${finalPort}" };</script>\n`);
        console.log(`Browser (JS module):`);
        console.log(`  import { initDebugHub } from '.debughub/vendor/current/ts/debugProbe.browser';`);
        console.log(`  initDebugHub({ enabled: true, session: "${sessionId}", endpoint: "http://127.0.0.1:${finalPort}" });\n`);
    }
}
