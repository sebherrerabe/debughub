import * as fs from 'fs';
import * as path from 'path';
import {
    buildJavaHelperClass,
    buildJavaInlineImports,
    buildJavaInlineMembers,
    buildJavaSampleCall,
    DEFAULT_JAVA_HYPOTHESIS_ID,
    DEFAULT_JAVA_PROBE_LABEL,
} from '../lib/javaEmitter';
import {
    describeJavaModuleRoot,
    detectJavaModules,
    findNearestJavaModule,
    readJavaPackage,
    suggestJavaHelperPath,
    type JavaModule,
} from '../lib/javaLayout';

type InjectCommandOptions = {
    mode?: string;
    target?: string;
    module?: string;
    package?: string;
};

type JavaInjectMode = 'inline-http' | 'helper-class';

export function inject(runtime: string, options: InjectCommandOptions): void {
    if (runtime !== 'java') {
        console.error(`Unsupported runtime: ${runtime}. Currently only \`debughub inject java\` is implemented.`);
        process.exit(1);
    }

    injectJava(options);
}

function injectJava(options: InjectCommandOptions): void {
    const cwd = process.cwd();
    const mode = normalizeMode(options.mode);
    const targetFile = options.target ? path.resolve(cwd, options.target) : undefined;
    const detectedModules = detectJavaModules(cwd);

    if (targetFile && !fs.existsSync(targetFile)) {
        fail(`Target file not found: ${targetFile}`);
    }

    let module = resolveModule(cwd, detectedModules, options.module, targetFile);
    if (!module) {
        module = {
            rootDir: cwd,
            buildFile: '',
            buildTool: 'maven',
            sourceRoots: [],
        };
    }

    const packageName = options.package ?? (targetFile ? readJavaPackage(targetFile) : null);

    console.log('DebugHub Java Injection');
    console.log('=======================');
    console.log(`Mode        : ${mode}`);
    console.log(`Target      : ${targetFile ? relativeOrDot(cwd, targetFile) : '(not specified)'}`);
    console.log(`Module      : ${relativeOrDot(cwd, module.rootDir)}`);
    if (module.buildFile) {
        console.log(`Build Tool  : ${module.buildTool} (${path.basename(module.buildFile)})`);
    } else {
        console.log('Build Tool  : not detected');
    }
    console.log(`Package     : ${packageName ?? '(default package or inline-only)'}`);
    console.log('');

    if (mode === 'inline-http') {
        printInlineHttpGuidance(cwd, packageName);
        return;
    }

    printHelperClassGuidance(cwd, module, packageName, targetFile);
}

function normalizeMode(mode: string | undefined): JavaInjectMode {
    if (!mode || mode === 'inline-http') {
        return 'inline-http';
    }

    if (mode === 'helper-class') {
        return 'helper-class';
    }

    fail(`Unsupported Java inject mode: ${mode}. Use \`inline-http\` or \`helper-class\`.`);
}

function resolveModule(
    cwd: string,
    detectedModules: JavaModule[],
    moduleOption: string | undefined,
    targetFile: string | undefined
): JavaModule | null {
    if (moduleOption) {
        const moduleRoot = path.resolve(cwd, moduleOption);
        const module = describeJavaModuleRoot(moduleRoot);
        if (!module) {
            fail(`Could not detect a Maven or Gradle module at: ${moduleRoot}`);
        }
        return module;
    }

    if (targetFile) {
        const nearestModule = findNearestJavaModule(targetFile);
        if (nearestModule) {
            return nearestModule;
        }
    }

    if (detectedModules.length === 1) {
        return detectedModules[0];
    }

    if (detectedModules.length > 1) {
        console.error('Multiple Java modules were detected. Rerun with `--target <file>` or `--module <dir>`.');
        console.error('');
        console.error('Detected modules:');
        for (const module of detectedModules) {
            console.error(`  - ${relativeOrDot(cwd, module.rootDir)} (${module.buildTool})`);
        }
        process.exit(1);
    }

    return null;
}

function printInlineHttpGuidance(cwd: string, packageName: string | null): void {
    console.log('Paste the imports into the instrumented class if they are not already present:');
    console.log('```java');
    console.log(buildJavaInlineImports().join('\n'));
    console.log('```');
    console.log('');
    console.log('Paste these class members inside the same class you are instrumenting:');
    console.log('```java');
    console.log(buildJavaInlineMembers());
    console.log('```');
    console.log('');
    console.log('Sample call site:');
    console.log('```java');
    console.log(buildJavaSampleCall());
    console.log('```');
    console.log('');
    if (packageName) {
        console.log(`Package-local context detected: ${packageName}`);
        console.log('');
    }
    printVerifySteps();
}

function printHelperClassGuidance(
    cwd: string,
    module: JavaModule,
    packageName: string | null,
    targetFile: string | undefined
): void {
    const helperPath = suggestJavaHelperPath(module.rootDir, packageName, targetFile);

    console.log(`Suggested helper path: ${relativeOrDot(cwd, helperPath)}`);
    console.log('Use a package-local helper only when you need to reuse the emitter across multiple classes.');
    console.log('');
    console.log('```java');
    console.log(buildJavaHelperClass(packageName));
    console.log('```');
    console.log('');
    console.log('Sample call site:');
    console.log('```java');
    console.log(`DebugHubProbe.debugProbe("${DEFAULT_JAVA_PROBE_LABEL}", Map.of("step", "before-query"), Map.of("hypothesisId", "${DEFAULT_JAVA_HYPOTHESIS_ID}", "level", "info"));`);
    console.log('```');
    console.log('');
    printVerifySteps();
}

function printVerifySteps(): void {
    console.log('Verify after you paste the snippet:');
    console.log(`  debughub doctor --java`);
    console.log(`  debughub search --label ${DEFAULT_JAVA_PROBE_LABEL}`);
}

function relativeOrDot(cwd: string, targetPath: string): string {
    const relativePath = path.relative(cwd, targetPath);
    return relativePath.length > 0 ? relativePath : '.';
}

function fail(message: string): never {
    console.error(message);
    process.exit(1);
}
