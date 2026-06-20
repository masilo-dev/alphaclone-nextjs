const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        if (isDirectory) {
            walkDir(dirPath, callback);
        } else {
            callback(dirPath);
        }
    });
}

const matches = [];

walkDir('src', file => {
    if (!file.endsWith('.ts') && !file.endsWith('.tsx') && !file.endsWith('.js') && !file.endsWith('.jsx')) return;
    try {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
            if (line.includes('.filter(')) {
                matches.push({ file, lineNum: idx + 1, content: line.trim() });
            }
        });
    } catch (e) {
        console.error(e);
    }
});

console.log(`Found ${matches.length} filter calls.`);
fs.writeFileSync('all_filters.json', JSON.stringify(matches, null, 2));
