import * as fs from 'fs';
import * as path from 'path';
import { verifyVendorFiles } from './verify';

export function install() {
    const pkg = require('../../package.json');
    const version = pkg.version;

    const cwd = process.cwd();
    const debughubDir = path.join(cwd, '.debughub');
    const targetVendorDir = path.join(debughubDir, 'vendor', version);
    const currentLinkFile = path.join(debughubDir, 'vendor', 'current');

    // Find source bundle
    const distVendorPath = path.resolve(__dirname, '..', 'vendor', version);
    if (!fs.existsSync(distVendorPath)) {
        console.error(`Error: Cannot find DebugHub distribution bundle for v${version} at ${distVendorPath}`);
        process.exit(1);
    }

    // Create target structure
    fs.mkdirSync(targetVendorDir, { recursive: true });
    fs.mkdirSync(path.join(debughubDir, 'out'), { recursive: true });

    // Copy files
    copyRecursiveSync(distVendorPath, targetVendorDir);

    // Update "current" pointer (use a text file to avoid symlink issues on windows)
    fs.writeFileSync(currentLinkFile, version, 'utf-8');

    // Write default config
    const configFile = path.join(debughubDir, 'debughub.json');
    if (!fs.existsSync(configFile)) {
        fs.writeFileSync(configFile, JSON.stringify({
            bindHost: "127.0.0.1",
            allowRemote: false
        }, null, 2), 'utf-8');
    }

    console.log(`DebugHub v${version} vendor files installed to .debughub/vendor/${version}`);
    console.log(`Verifying installation...`);

    const isValid = verifyVendorFiles(cwd);
    if (!isValid) {
        console.error('Verify failed immediately after install. Installation might be corrupted.');
        process.exit(1);
    }

    console.log('Installation verified successfully ✨');
}

function copyRecursiveSync(src: string, dest: string) {
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
        fs.mkdirSync(dest, { recursive: true });
        for (const child of fs.readdirSync(src)) {
            copyRecursiveSync(path.join(src, child), path.join(dest, child));
        }
    } else {
        fs.copyFileSync(src, dest);
    }
}
