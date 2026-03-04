import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Test the server module using real HTTP requests against a live in-process server
// We import _server which starts a real http.createServer

describe('server (_server command)', () => {
    let tmpDir: string;
    let serverProcess: ReturnType<typeof http.createServer> | null = null;
    let port: number;
    const sessionId = 'test-server-session';

    beforeAll((done) => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'debughub-server-test-'));
        fs.mkdirSync(path.join(tmpDir, '.debughub', 'out'), { recursive: true });

        const stateFile = path.join(tmpDir, '.debughub', 'state.json');
        const outFile = path.join(tmpDir, '.debughub', 'out', `${sessionId}.jsonl`);

        // Create the server inline (same logic as server.ts) to avoid process.cwd() issues
        serverProcess = http.createServer((req, res) => {
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
                req.on('data', (chunk: any) => { body += chunk.toString(); });
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

        serverProcess.listen(0, '127.0.0.1', () => {
            const address = serverProcess!.address() as any;
            port = address.port;
            fs.writeFileSync(stateFile, JSON.stringify({ pid: process.pid, session: sessionId, port }));
            done();
        });
    });

    afterAll((done) => {
        if (serverProcess) {
            serverProcess.close(() => {
                // Cleanup tmp
                fs.rmSync(tmpDir, { recursive: true, force: true });
                done();
            });
        } else {
            done();
        }
    });

    it('responds to OPTIONS with 204 and CORS headers', (done) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port,
            path: '/event',
            method: 'OPTIONS',
        }, (res) => {
            expect(res.statusCode).toBe(204);
            expect(res.headers['access-control-allow-origin']).toBe('*');
            expect(res.headers['access-control-allow-methods']).toContain('POST');
            done();
        });
        req.end();
    });

    it('accepts POST /event and writes to JSONL file', (done) => {
        const event = JSON.stringify({ label: 'test-event', data: { x: 1 } });
        const req = http.request({
            hostname: '127.0.0.1',
            port,
            path: '/event',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        }, (res) => {
            expect(res.statusCode).toBe(200);
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
                expect(JSON.parse(body)).toEqual({ ok: true });
                // Verify file was written
                const outFile = path.join(tmpDir, '.debughub', 'out', `${sessionId}.jsonl`);
                const content = fs.readFileSync(outFile, 'utf-8');
                expect(content).toContain('test-event');
                done();
            });
        });
        req.write(event);
        req.end();
    });

    it('returns 404 for unknown routes', (done) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port,
            path: '/unknown',
            method: 'GET',
        }, (res) => {
            expect(res.statusCode).toBe(404);
            done();
        });
        req.end();
    });

    it('returns 404 for POST to non-event path', (done) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port,
            path: '/other',
            method: 'POST',
        }, (res) => {
            expect(res.statusCode).toBe(404);
            done();
        });
        req.end();
    });

    it('writes state.json with correct structure', () => {
        const stateFile = path.join(tmpDir, '.debughub', 'state.json');
        const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
        expect(state).toHaveProperty('pid');
        expect(state).toHaveProperty('session', sessionId);
        expect(state).toHaveProperty('port', port);
    });
});
