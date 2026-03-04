import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

export function _server(sessionId: string, portStr: string) {
    const cwd = process.cwd();
    const stateFile = path.join(cwd, '.debughub', 'state.json');
    const outFile = path.join(cwd, '.debughub', 'out', `${sessionId}.jsonl`);

    const server = http.createServer((req, res) => {
        // Basic CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        if (req.method === 'POST' && req.url === '/event') {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    fs.appendFileSync(outFile, body + '\n', 'utf-8');
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: true }));
                } catch (e) {
                    res.writeHead(500);
                    res.end();
                }
            });
        } else {
            res.writeHead(404);
            res.end();
        }
    });

    server.listen(parseInt(portStr, 10), '127.0.0.1', () => {
        const address = server.address() as any;
        const port = address.port;

        fs.writeFileSync(stateFile, JSON.stringify({
            pid: process.pid,
            session: sessionId,
            port: port
        }, null, 2));

        // Cleanup on exit
        const cleanup = () => {
            if (fs.existsSync(stateFile)) {
                fs.unlinkSync(stateFile);
            }
            process.exit();
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
    });
}
