import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { inject } from '../../src/commands/inject';

describe('inject command', () => {
    const originalCwd = process.cwd();
    let tempDir: string;
    let consoleLogSpy: jest.SpyInstance;
    let consoleErrorSpy: jest.SpyInstance;
    let exitSpy: jest.SpyInstance;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'debughub-inject-'));
        process.chdir(tempDir);
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {
            throw new Error('process.exit');
        }) as any);
    });

    afterEach(() => {
        process.chdir(originalCwd);
        fs.rmSync(tempDir, { recursive: true, force: true });
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        exitSpy.mockRestore();
    });

    it('defaults to inline-http and derives module and package from the target file', () => {
        writeFile('pom.xml', '<project />');
        writeFile('src/main/java/com/acme/orders/OrderService.java', 'package com.acme.orders;\npublic class OrderService {}\n');

        inject('java', { target: 'src/main/java/com/acme/orders/OrderService.java' });

        const output = getConsoleOutput(consoleLogSpy);
        expect(output).toContain('Mode        : inline-http');
        expect(output).toContain('Module      : .');
        expect(output).toContain('Build Tool  : maven (pom.xml)');
        expect(output).toContain('Package     : com.acme.orders');
        expect(output).toContain('debugHubEmit("debughub_probe"');
        expect(output).toContain('debughub doctor --java');
    });

    it('suggests a package-local helper path for helper-class mode', () => {
        writeFile('module-a/pom.xml', '<project />');
        writeFile('module-a/src/main/java/com/acme/orders/OrderService.java', 'package com.acme.orders;\npublic class OrderService {}\n');

        inject('java', { mode: 'helper-class', target: 'module-a/src/main/java/com/acme/orders/OrderService.java' });

        const output = getConsoleOutput(consoleLogSpy);
        expect(output).toContain('Suggested helper path: module-a/src/main/java/com/acme/orders/DebugHubProbe.java');
        expect(output).toContain('package com.acme.orders;');
        expect(output).toContain('DebugHubProbe.debugProbe("debughub_probe"');
    });

    it('requires an explicit target or module when multiple Java modules are present', () => {
        writeFile('services/orders/pom.xml', '<project />');
        writeFile('services/orders/src/main/java/com/acme/orders/OrderService.java', 'package com.acme.orders;\npublic class OrderService {}\n');
        writeFile('services/billing/build.gradle', 'plugins {}');
        writeFile('services/billing/src/main/java/com/acme/billing/BillingService.java', 'package com.acme.billing;\npublic class BillingService {}\n');

        expect(() => inject('java', {})).toThrow('process.exit');

        const errorOutput = getConsoleOutput(consoleErrorSpy);
        expect(errorOutput).toContain('Multiple Java modules were detected');
        expect(errorOutput).toContain('services/orders');
        expect(errorOutput).toContain('services/billing');
    });

    it('uses explicit module and package overrides when no target file is provided', () => {
        writeFile('backend/build.gradle.kts', 'plugins {}');
        writeFile('backend/src/main/java/com/acme/App.java', 'package com.acme;\npublic class App {}\n');

        inject('java', { mode: 'helper-class', module: 'backend', package: 'com.acme.debug' });

        const output = getConsoleOutput(consoleLogSpy);
        expect(output).toContain('Module      : backend');
        expect(output).toContain('Package     : com.acme.debug');
        expect(output).toContain('Suggested helper path: backend/src/main/java/com/acme/debug/DebugHubProbe.java');
    });
});

function writeFile(relPath: string, content: string): void {
    const fullPath = path.join(process.cwd(), relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf-8');
}

function getConsoleOutput(spy: jest.SpyInstance): string {
    return spy.mock.calls.map((call) => call.join(' ')).join('\n');
}
