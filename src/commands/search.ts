import * as fs from 'fs';
import * as path from 'path';

export function search(query: string, options: any) {
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
        console.error('Could not determine active session ID. Provide --session or run `debughub start`.');
        process.exit(1);
    }

    const outFile = path.join(debughubDir, 'out', `${sessionId}.jsonl`);
    if (!fs.existsSync(outFile)) {
        console.log(`No events yet in session ${sessionId}`);
        return;
    }

    const content = fs.readFileSync(outFile, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    let matches = 0;

    for (const l of lines) {
        try {
            const parsed = JSON.parse(l);

            // Filters
            if (options.label && parsed.label !== options.label) continue;
            if (options.hypothesis && parsed.hypothesisId !== options.hypothesis) continue;
            if (options.level && parsed.level !== options.level) continue;

            // Substring match
            if (query && !l.includes(query)) continue;

            matches++;

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
            if (query && l.includes(query)) {
                matches++;
                console.log(l);
            }
        }
    }

    if (matches === 0) {
        console.log(`No matches found for query: "${query}"`);
    } else {
        console.log(`\nFound ${matches} match(es).`);
    }
}
