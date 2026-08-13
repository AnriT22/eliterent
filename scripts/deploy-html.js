const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const LOCAL_ROOT = 'c:\\Users\\ANRI\\Desktop\\Myrent.com';
const SERVER = 'root@178.104.99.239:/root/app/';

function findHtmlFiles(dir, files = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === 'server' || entry.name === 'scripts' || entry.name === '.git' || entry.name === '.seo-engine') continue;
            findHtmlFiles(fullPath, files);
        } else if (entry.isFile() && entry.name.endsWith('.html')) {
            files.push(fullPath);
        }
    }
    return files;
}

const htmlFiles = findHtmlFiles(LOCAL_ROOT);
console.log('Found', htmlFiles.length, 'HTML files to deploy');

let success = 0;
let failed = 0;

for (const file of htmlFiles) {
    const relativePath = path.relative(LOCAL_ROOT, file).replace(/\\/g, '/');
    const remotePath = SERVER + relativePath;
    try {
        execSync(`scp "${file}" "${remotePath}"`, { stdio: 'pipe', timeout: 30000 });
        success++;
        console.log('OK:', relativePath);
    } catch (e) {
        failed++;
        console.error('FAIL:', relativePath, e.message);
    }
}

console.log(`\nDeployed: ${success}, Failed: ${failed}`);
