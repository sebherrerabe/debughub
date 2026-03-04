import * as fs from 'fs';
import * as path from 'path';

export function tail(options: any) {
    const cwd = process.cwd();
    const debughubDir = path.join(cwd, '.debughub');
    const maxLines = parseInt(options.n, 10);

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
        console.error('Could not determine active session ID. Provide --session or run `debughub start`.');
        process.exit(1);
    }

    const outFile = path.join(debughubDir, 'out', `${sessionId}.jsonl`);
    if (!fs.existsSync(outFile)) {
        console.log(`No events yet in session ${sessionId}`);
        return;
    }

    // Quick read logic (assumes file is small enough for memory for a debug tool)
    const content = fs.readFileSync(outFile, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    if (lines.length === 0) {
        console.log(`No events yet in session ${sessionId}`);
        return;
    }

    const toShow = lines.slice(-maxLines);

    if (options.json) {
        toShow.forEach(l => console.log(l));
    } else {
        toShow.forEach(l => {
            try {
                const parsed = JSON.parse(l);
                const ts = new Date(parsed.ts).toLocaleTimeString();
                const levelColorStr = parsed.level === 'error' ? '\x1b[31m[ERROR]\x1b[0m' :
                    parsed.level === 'warn' ? '\x1b[33m[WARN]\x1b[0m' :
                        '\x1b[36m[INFO]\x1b[0m';

                let meta = '';
                if (parsed.hypothesisId) meta += ` [H:${parsed.hypothesisId}]`;
                if (parsed.loc) meta += ` [L:${parsed.loc}]`;

                console.log(`[${ts}] ${levelColorStr} ${parsed.label}${meta}`);
                if (parsed.data !== null) {
                    console.dir(parsed.data, { depth: 4, colors: true });
                }
            } catch (e) {
                console.log(l);
            }
        });
    }
}
