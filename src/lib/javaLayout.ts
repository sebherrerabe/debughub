import * as fs from 'fs';
import * as path from 'path';

export type JavaBuildTool = 'maven' | 'gradle';

export type JavaModule = {
    rootDir: string;
    buildFile: string;
    buildTool: JavaBuildTool;
    sourceRoots: string[];
};

const BUILD_FILE_CANDIDATES: Array<{ name: string; tool: JavaBuildTool }> = [
    { name: 'pom.xml', tool: 'maven' },
    { name: 'build.gradle', tool: 'gradle' },
    { name: 'build.gradle.kts', tool: 'gradle' },
    { name: 'settings.gradle', tool: 'gradle' },
    { name: 'settings.gradle.kts', tool: 'gradle' },
];

const JAVA_SOURCE_ROOTS = ['src/main/java', 'src/test/java'];
const IGNORED_DIRS = new Set([
    '.debughub',
    '.git',
    '.idea',
    'build',
    'coverage',
    'dist',
    'node_modules',
    'out',
    'target',
]);

export function detectJavaModules(cwd: string): JavaModule[] {
    const modules = new Map<string, JavaModule>();
    walkForJavaModules(cwd, modules);
    return Array.from(modules.values()).sort((left, right) => left.rootDir.localeCompare(right.rootDir));
}

export function describeJavaModuleRoot(moduleRoot: string): JavaModule | null {
    const resolvedRoot = path.resolve(moduleRoot);
    const buildInfo = detectBuildFile(resolvedRoot);
    if (!buildInfo) {
        return null;
    }

    return {
        rootDir: resolvedRoot,
        buildFile: path.join(resolvedRoot, buildInfo.name),
        buildTool: buildInfo.tool,
        sourceRoots: collectSourceRoots(resolvedRoot),
    };
}

export function findNearestJavaModule(targetFile: string): JavaModule | null {
    let currentDir = path.dirname(path.resolve(targetFile));
    const rootDir = path.parse(currentDir).root;

    while (true) {
        const buildInfo = detectBuildFile(currentDir);
        if (buildInfo) {
            return {
                rootDir: currentDir,
                buildFile: path.join(currentDir, buildInfo.name),
                buildTool: buildInfo.tool,
                sourceRoots: collectSourceRoots(currentDir),
            };
        }

        if (currentDir === rootDir) {
            return null;
        }
        currentDir = path.dirname(currentDir);
    }
}

export function readJavaPackage(filePath: string): string | null {
    if (!fs.existsSync(filePath)) {
        return null;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const match = content.match(/^\s*package\s+([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*;/m);
    return match ? match[1] : null;
}

export function resolveJavaSourceRoot(moduleRoot: string): string {
    for (const sourceRoot of JAVA_SOURCE_ROOTS) {
        const fullPath = path.join(moduleRoot, sourceRoot);
        if (fs.existsSync(fullPath)) {
            return fullPath;
        }
    }

    return moduleRoot;
}

export function suggestJavaHelperPath(moduleRoot: string, packageName: string | null, targetFile?: string): string {
    if (targetFile) {
        return path.join(path.dirname(path.resolve(targetFile)), 'DebugHubProbe.java');
    }

    const sourceRoot = resolveJavaSourceRoot(moduleRoot);
    if (!packageName) {
        return path.join(sourceRoot, 'DebugHubProbe.java');
    }

    return path.join(sourceRoot, ...packageName.split('.'), 'DebugHubProbe.java');
}

function walkForJavaModules(currentDir: string, modules: Map<string, JavaModule>): void {
    let dirEntries: fs.Dirent[];
    try {
        dirEntries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
        return;
    }

    const buildInfo = detectBuildFile(currentDir);
    const sourceRoots = collectSourceRoots(currentDir);
    if (buildInfo && sourceRoots.length > 0) {
        modules.set(currentDir, {
            rootDir: currentDir,
            buildFile: path.join(currentDir, buildInfo.name),
            buildTool: buildInfo.tool,
            sourceRoots,
        });
    }

    for (const entry of dirEntries) {
        if (!entry.isDirectory()) {
            continue;
        }

        if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.')) {
            continue;
        }

        walkForJavaModules(path.join(currentDir, entry.name), modules);
    }
}

function detectBuildFile(dirPath: string): { name: string; tool: JavaBuildTool } | null {
    for (const candidate of BUILD_FILE_CANDIDATES) {
        if (fs.existsSync(path.join(dirPath, candidate.name))) {
            return candidate;
        }
    }

    return null;
}

function collectSourceRoots(moduleRoot: string): string[] {
    return JAVA_SOURCE_ROOTS
        .map((sourceRoot) => path.join(moduleRoot, sourceRoot))
        .filter((fullPath) => fs.existsSync(fullPath));
}
