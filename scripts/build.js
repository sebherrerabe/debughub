const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const pkg = require('../package.json');
const version = pkg.version;

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const VENDOR_SRC = path.join(ROOT_DIR, 'helpers');
const VENDOR_DIST = path.join(DIST_DIR, 'vendor', version);

// Ensure directories
fs.mkdirSync(DIST_DIR, { recursive: true });
fs.mkdirSync(VENDOR_DIST, { recursive: true });

function copyRecursiveSync(src, dest) {
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

// Copy helpers to dist
if (fs.existsSync(VENDOR_SRC)) {
    copyRecursiveSync(VENDOR_SRC, VENDOR_DIST);
}

// Generate Manifest
function generateManifest(dir) {
    const manifest = {};

    function walk(currentDir) {
        const files = fs.readdirSync(currentDir);
        for (const file of files) {
            const fullPath = path.join(currentDir, file);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                walk(fullPath);
            } else {
                if (file === 'MANIFEST.json') continue; // Don't hash the manifest itself
                const content = fs.readFileSync(fullPath);
                const hash = crypto.createHash('sha256').update(content).digest('hex');

                // Use forward slashes for cross-platform consistency in manifest
                const relPath = path.relative(VENDOR_DIST, fullPath).replace(/\\/g, '/');
                manifest[relPath] = hash;
            }
        }
    }

    if (fs.existsSync(dir)) {
        walk(dir);
    }

    return manifest;
}

const manifest = generateManifest(VENDOR_DIST);
fs.writeFileSync(
    path.join(VENDOR_DIST, 'MANIFEST.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8'
);

console.log(`Build complete. Vendor bundle for v${version} created.`);
