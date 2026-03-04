import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';

export function doctor() {
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
            });
            req.on('error', (e) => {
                console.log(`[ ] Reachability: Error connecting to endpoint: ${e.message}`);
            });
            req.end();
            return;
        } catch (e) {
            console.log(`    State file is unreadable or corrupt.`);
        }
    }
}
