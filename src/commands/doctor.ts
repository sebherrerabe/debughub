import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as readline from 'readline';

export function doctor(options: any) {
    const cwd = process.cwd();
    const debughubDir = path.join(cwd, '.debughub');
    const stateFile = path.join(debughubDir, 'state.json');
    const currentLink = path.join(debughubDir, 'vendor', 'current');

    console.log('🩺 DebugHub Doctor');
    console.log('==================');

    // Check 1: Installation
    const installed = fs.existsSync(currentLink);
    console.log(`[${installed ? 'x' : ' '}] Installation: .debughub/vendor directory exists`);
    if (installed) {
        const version = fs.readFileSync(currentLink, 'utf-8').trim();
        console.log(`    Version linked: ${version}`);
    }

    // Check 2: Collector status
    const isRunning = fs.existsSync(stateFile);
    console.log(`[${isRunning ? 'x' : ' '}] Collector   : Running state found`);

    if (isRunning) {
        try {
            const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
            console.log(`    Session ID: ${state.session}`);
            console.log(`    PID       : ${state.pid}`);
            console.log(`    Port      : ${state.port}`);

            // Check writable output
            const outFile = path.join(debughubDir, 'out', `${state.session}.jsonl`);
            try {
                fs.accessSync(path.dirname(outFile), fs.constants.W_OK);
                console.log(`[x] Output Path : ${outFile} is reachable/writable`);
            } catch (e) {
                console.log(`[ ] Output Path : ${outFile} is NOT writable`);
            }

            // Check Reachability
            const req = http.request({
                hostname: '127.0.0.1',
                port: state.port,
                path: '/event',
                method: 'OPTIONS',
            }, (res) => {
                if (res.statusCode === 204) {
                    console.log(`[x] Reachability: Endpoint http://127.0.0.1:${state.port}/event is responding`);
                } else {
                    console.log(`[ ] Reachability: Endpoint responded with ${res.statusCode}`);
                }

                // If --browser flag, run browser self-test after reachability check
                if (options.browser) {
                    runBrowserSelfTest(state.session, state.port, outFile);
                }
            });
            req.on('error', (e) => {
                console.log(`[ ] Reachability: Error connecting to endpoint: ${e.message}`);
                if (options.browser) {
                    console.log('\nCannot run browser self-test: collector is not reachable.');
                }
            });
            req.end();
            return;
        } catch (e) {
            console.log(`    State file is unreadable or corrupt.`);
        }
    }

    if (options.browser && !isRunning) {
        console.log('\nCannot run browser self-test: collector is not running. Run `debughub start` first.');
    }
}

function runBrowserSelfTest(sessionId: string, port: number, outFile: string) {
    console.log('\n--- Browser Self-Test ---\n');

    // Snippet 1: Transport test
    console.log('1. Transport test \u2014 paste in browser console:');
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

    // Snippet 2: Helper test
    console.log('2. Helper test \u2014 paste in browser console:');
    console.log('```');
    console.log(`window.__DEBUGHUB__ = { enabled: true, session: "${sessionId}", endpoint: "http://127.0.0.1:${port}" };`);
    console.log(`// Then call your debugProbe import:`);
    console.log(`debugProbe("__browser_selftest__", { test: "helper" });`);
    console.log(`// Check browser console for [DebugHub] messages if it doesn't work.`);
    console.log('```\n');

    // Wait for Enter before polling
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('Press Enter when you\'ve pasted a snippet, then waiting up to 30s for the event...', () => {
        rl.close();

        // Record file size at start of polling to only check new content
        let startSize = 0;
        try {
            const stat = fs.statSync(outFile);
            startSize = stat.size;
        } catch (e) {
            // File may not exist yet
        }

        let elapsed = 0;
        const interval = setInterval(() => {
            elapsed += 500;

            try {
                if (fs.existsSync(outFile)) {
                    const content = fs.readFileSync(outFile, 'utf-8');
                    // Only check content added after polling started
                    const newContent = content.substring(startSize);
                    const lines = newContent.trim().split('\n').filter(Boolean);

                    for (const line of lines) {
                        try {
                            const parsed = JSON.parse(line);
                            if (parsed.label === '__browser_selftest__') {
                                clearInterval(interval);
                                const testType = parsed.data?.test || 'unknown';
                                console.log(`\n\u2705 Self-test event received! (type: ${testType})`);
                                if (testType === 'transport') {
                                    console.log('   Transport is working \u2014 CORS and collector are fine.');
                                    console.log('   To also verify the helper, run snippet 2.');
                                } else if (testType === 'helper') {
                                    console.log('   Helper is working \u2014 config resolution, helper code, and transport all OK.');
                                }
                                return;
                            }
                        } catch (e) {
                            // Skip malformed lines
                        }
                    }
                }
            } catch (e) {
                // Ignore read errors during polling
            }

            if (elapsed >= 30000) {
                clearInterval(interval);
                console.log('\n\u274c Timed out after 30s \u2014 no self-test event received.');
                console.log('\nTroubleshooting:');
                console.log('  - Did you paste the snippet in the browser console?');
                console.log('  - Check the browser console for errors (CORS, network, etc.)');
                console.log('  - Check the browser console for [DebugHub] diagnostic messages');
                console.log('  - Verify the page can reach http://127.0.0.1:' + port);
                console.log('  - Try snippet 1 first to isolate transport vs helper issues');
            }
        }, 500);
    });
}
