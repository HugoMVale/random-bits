#!/usr/bin/env node
/**
 * Builds the numerics-js submodule (vendor/numerics-js) and copies its
 * compiled ESM output into static/js/numeric-js, replacing the vendored
 * library wholesale (this folder contains nothing else).
 */
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const vendorDir = path.join(rootDir, 'vendor', 'numerics-js');
const distDir = path.join(vendorDir, 'dist');
const targetDir = path.join(rootDir, 'static', 'js', 'numeric-js');

function run(cmd, args, cwd) {
    // Trusted, hardcoded args only; shell needed on Windows to resolve npm.cmd.
    execFileSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
}

async function copyJs(srcDir, destDir) {
    await mkdir(destDir, { recursive: true });
    for (const entry of await readdir(srcDir, { withFileTypes: true })) {
        const srcPath = path.join(srcDir, entry.name);
        const destPath = path.join(destDir, entry.name);
        if (entry.isDirectory()) {
            await copyJs(srcPath, destPath);
        } else if (entry.name.endsWith('.js')) {
            await cp(srcPath, destPath);
        }
    }
}

console.log('Building numerics-js...');
if (!(await stat(path.join(vendorDir, 'node_modules')).catch(() => null))) {
    run('npm', ['install'], vendorDir);
}
run('npm', ['run', 'build'], vendorDir);

console.log('Vendoring compiled output into static/js/numeric-js...');
await rm(targetDir, { recursive: true, force: true });
await copyJs(distDir, targetDir);

console.log('Done.');

