import * as fs from 'fs';
import * as path from 'path';

export function stop() {
    const cwd = process.cwd();
    const stateFile = path.join(cwd, '.debughub', 'state.json');

    if (!fs.existsSync(stateFile)) {
        console.log('No DebugHub collector is currently running (state.json not found).');
        return;
    }

    try {
        const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
        if (state.pid) {
            try {
                process.kill(state.pid);
                console.log(`Stopped collector process ${state.pid}.`);
            } catch (e: any) {
                if (e.code === 'ESRCH') {
                    console.log(`Process ${state.pid} was not running.`);
                } else {
                    console.error(`Failed to stop process ${state.pid}:`, e.message);
                }
            }
        }
    } catch (e) {
        console.log('Could not read state.json or parse PID.');
    }

    fs.unlinkSync(stateFile);
    console.log('Cleared state.');
}
