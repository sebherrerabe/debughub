import * as fs from 'fs';
import * as path from 'path';

export function clear(options: any) {
    const cwd = process.cwd();
    const debughubDir = path.join(cwd, '.debughub');

    let sessionId = options.session;

    if (!sessionId) {
        const stateFile = path.join(debughubDir, 'state.json');
        if (fs.existsSync(stateFile)) {
            try {
                const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
                sessionId = state.session;
            } catch (e) { }
        }
    }

    if (!sessionId) {
        console.error('Could not determine active session ID.');
        process.exit(1);
    }

    const outFile = path.join(debughubDir, 'out', `${sessionId}.jsonl`);
    if (fs.existsSync(outFile)) {
        fs.truncateSync(outFile, 0);
        console.log(`Cleared log file for session ${sessionId}`);
    } else {
        console.log(`Session ${sessionId} has no log file yet.`);
    }
}
