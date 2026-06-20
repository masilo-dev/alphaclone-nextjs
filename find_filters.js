const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        if (isDirectory) {
            if (f === 'api' || f === '.well-known' || f === 'services' || f === 'workflows' || f === 'lib') return;
            walkDir(dirPath, callback);
        } else {
            callback(dirPath);
        }
    });
}

const anomalous = [];

walkDir('src', file => {
    if (!file.endsWith('.ts') && !file.endsWith('.tsx') && !file.endsWith('.js') && !file.endsWith('.jsx')) return;
    try {
        const content = fs.readFileSync(file, 'utf8');
        if (!content.includes('.filter')) return;

        const lines = content.split('\n');
        lines.forEach((line, idx) => {
            if (line.includes('.filter(')) {
                // If it doesn't contain '=>', 'function', or 'Boolean' on the line (or next lines, but let's check same line first)
                if (!line.includes('=>') && !line.includes('function') && !line.includes('Boolean')) {
                    anomalous.push(`${file}:${idx + 1}: ${line.trim()}`);
                }
            }
        });
    } catch (e) {
        console.error(e);
    }
});

console.log(`Found ${anomalous.length} anomalous filter lines:`);
console.log(anomalous.join('\n'));
fs.writeFileSync('anomalous_filters.txt', anomalous.join('\n'));
