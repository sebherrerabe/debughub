import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export function verify() {
    const cwd = process.cwd();

    console.log('Verifying DebugHub installation files...');

    const isValid = verifyVendorFiles(cwd);
    if (isValid) {
        console.log('✅ Integrity check passed: all installed vendor files match the official manifest.');
    } else {
        console.error('❌ Integrity check failed: one or more files have been modified or are missing.');
        process.exit(1);
    }
}

export function verifyVendorFiles(cwd: string): boolean {
    const currentLink = path.join(cwd, '.debughub', 'vendor', 'current');

    if (!fs.existsSync(currentLink)) {
        console.error(`Not found: ${currentLink}. Is DebugHub installed in this repo?`);
        return false;
    }

    const version = fs.readFileSync(currentLink, 'utf-8').trim();
    const vendorDir = path.join(cwd, '.debughub', 'vendor', version);
    const manifestFile = path.join(vendorDir, 'MANIFEST.json');

    if (!fs.existsSync(manifestFile)) {
        console.error(`Missing MANIFEST.json in ${vendorDir}`);
        return false;
    }

    let manifest: Record<string, string>;
    try {
        manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf-8'));
    } catch (e) {
        console.error('Failed to parse MANIFEST.json');
        return false;
    }

    let isValid = true;

    for (const [relPath, expectedHash] of Object.entries(manifest)) {
        // relPath in manifest uses forward slashes
        const targetFile = path.resolve(vendorDir, relPath);

        if (!fs.existsSync(targetFile)) {
            console.error(`File missing: ${relPath}`);
            isValid = false;
            continue;
        }

        const content = fs.readFileSync(targetFile);
        const actualHash = crypto.createHash('sha256').update(content).digest('hex');

        if (actualHash !== expectedHash) {
            console.error(`Checksum mismatch in: ${relPath}`);
            isValid = false;
        }
    }

    return isValid;
}
