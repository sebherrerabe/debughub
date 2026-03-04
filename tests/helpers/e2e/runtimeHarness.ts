import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';

export type CommandResult = {
    status: number | null;
    stdout: string;
    stderr: string;
};

export type CaptureServer = {
    endpoint: string;
    events: unknown[];
    close: () => Promise<void>;
    waitForEvents: (count: number, timeoutMs?: number) => Promise<unknown[]>;
};

export async function createCaptureServer(): Promise<CaptureServer> {
    const events: unknown[] = [];
    const waiters: Array<{ count: number; resolve: (value: unknown[]) => void }> = [];

    const server = http.createServer((req, res) => {
        if (req.method !== 'POST' || req.url !== '/event') {
            res.statusCode = 404;
            res.end('not found');
            return;
        }

        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                events.push(JSON.parse(body));
            } catch {
                events.push(body);
            }

            for (let i = waiters.length - 1; i >= 0; i--) {
                if (events.length >= waiters[i].count) {
                    waiters[i].resolve(events.slice(0, waiters[i].count));
                    waiters.splice(i, 1);
                }
            }

            res.statusCode = 200;
            res.end('ok');
        });
    });

    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
        throw new Error('Failed to start capture server');
    }

    return {
        endpoint: `http://127.0.0.1:${address.port}`,
        events,
        close: () =>
            new Promise<void>((resolve, reject) => {
                server.close(err => (err ? reject(err) : resolve()));
            }),
        waitForEvents: (count: number, timeoutMs = 10000) =>
            new Promise<unknown[]>((resolve, reject) => {
                if (events.length >= count) {
                    resolve(events.slice(0, count));
                    return;
                }

                const waiter = { count, resolve };
                waiters.push(waiter);

                setTimeout(() => {
                    const index = waiters.indexOf(waiter);
                    if (index >= 0) {
                        waiters.splice(index, 1);
                        reject(new Error(`Timed out waiting for ${count} events`));
                    }
                }, timeoutMs);
            }),
    };
}

export function makeTempDir(prefix: string): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function writeFiles(baseDir: string, files: Record<string, string>): void {
    for (const [relPath, content] of Object.entries(files)) {
        const fullPath = path.join(baseDir, relPath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content, 'utf-8');
    }
}

export function copyFile(srcPath: string, destPath: string): void {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(srcPath, destPath);
}

export function removeDir(dirPath: string): void {
    fs.rmSync(dirPath, { recursive: true, force: true });
}

export function runCommand(
    command: string,
    args: string[],
    options: {
        cwd: string;
        env?: NodeJS.ProcessEnv;
        timeoutMs?: number;
    }
): CommandResult {
    const result = spawnSync(command, args, {
        cwd: options.cwd,
        env: options.env,
        encoding: 'utf-8',
        timeout: options.timeoutMs ?? 30000,
    });

    return {
        status: result.status,
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? '',
    };
}
