import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as os from 'os';

describe('build script', () => {
    let tmpDir: string;
    let originalDir: string;
    const expectedFiles = [
        'README.md',
        'ts/debugProbe.ts',
        'ts/debugProbe.browser.ts',
        'java/DebugProbe.java',
        'python/debugProbe.py',
        'rust/debug_probe.rs',
        'php/DebugProbe.php',
        'go/debug_probe.go',
        'csharp/DebugProbe.cs',
        'http/EVENT_CONTRACT.md',
        'http/event.example.json',
    ];

    beforeAll(() => {
        originalDir = process.cwd();
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'debughub-build-test-'));

        // Set up a representative helper tree in tmpDir
        writeHelperFixture('README.md', '# README');
        writeHelperFixture('ts/debugProbe.ts', 'export function debugProbe() {}');
        writeHelperFixture('ts/debugProbe.browser.ts', 'export function debugProbe() {}');
        writeHelperFixture('java/DebugProbe.java', 'public class DebugProbe {}');
        writeHelperFixture('python/debugProbe.py', 'def debugProbe(label):\n    return None');
        writeHelperFixture('rust/debug_probe.rs', 'pub fn debug_probe(_label: &str, _data: Option<&str>, _meta: Option<()>) {}');
        writeHelperFixture('php/DebugProbe.php', '<?php function debugProbe($label) {}');
        writeHelperFixture('go/debug_probe.go', 'package main\nfunc DebugProbe(label string, data interface{}, meta interface{}) {}');
        writeHelperFixture('csharp/DebugProbe.cs', 'public static class DebugProbe { public static void Probe(string label) {} }');
        writeHelperFixture('http/EVENT_CONTRACT.md', '# Contract');
        writeHelperFixture('http/event.example.json', '{"runtime":"java"}');

        // Create a package.json with version
        fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ version: '9.9.9' }), 'utf-8');

        // Create a dist dir
        fs.mkdirSync(path.join(tmpDir, 'dist'), { recursive: true });

        // Copy the build script
        const buildScript = fs.readFileSync(
            path.resolve(__dirname, '..', '..', 'scripts', 'build.js'),
            'utf-8'
        );
        fs.mkdirSync(path.join(tmpDir, 'scripts'), { recursive: true });
        fs.writeFileSync(path.join(tmpDir, 'scripts', 'build.js'), buildScript, 'utf-8');
    });

    afterAll(() => {
        process.chdir(originalDir);
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('copies vendor files and generates MANIFEST.json', () => {
        const { execSync } = require('child_process');
        execSync(`node "${path.join(tmpDir, 'scripts', 'build.js')}"`, {
            cwd: tmpDir,
            stdio: 'pipe',
        });

        const vendorDir = path.join(tmpDir, 'dist', 'vendor', '9.9.9');
        expect(fs.existsSync(vendorDir)).toBe(true);

        // Check vendor files were copied
        for (const relPath of expectedFiles) {
            expect(fs.existsSync(path.join(vendorDir, relPath))).toBe(true);
        }

        // Check MANIFEST.json exists and has correct structure
        const manifestPath = path.join(vendorDir, 'MANIFEST.json');
        expect(fs.existsSync(manifestPath)).toBe(true);

        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Record<string, string>;

        // MANIFEST.json should not contain itself
        expect(manifest).not.toHaveProperty('MANIFEST.json');

        // MANIFEST.json should include all expected helper files
        expect(Object.keys(manifest).sort()).toEqual([...expectedFiles].sort());

        // All files should have correct hashes
        for (const [relPath, expectedHash] of Object.entries(manifest)) {
            const filePath = path.join(vendorDir, relPath);
            const content = fs.readFileSync(filePath);
            const actualHash = crypto.createHash('sha256').update(content).digest('hex');
            expect(actualHash).toBe(expectedHash);
        }
    });

    function writeHelperFixture(relPath: string, content: string): void {
        const fullPath = path.join(tmpDir, 'helpers', relPath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content, 'utf-8');
    }
});
