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
        const regex = /\.filter\(\s*([a-zA-Z0-9_\.]+)\s*\)/g;
        let match;
        while ((match = regex.exec(content)) !== null) {
            const arg = match[1];
            if (arg !== 'Boolean' && arg !== 'val' && arg !== 'item') {
                matches.push({
                    file,
                    arg,
                    line: content.split('\n')[content.substring(0, match.index).split('\n').length - 1].trim()
                });
            }
        }
    } catch (e) {
        console.error(e);
    }
});

console.log(JSON.stringify(matches, null, 2));
