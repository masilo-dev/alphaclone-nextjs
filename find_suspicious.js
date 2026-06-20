const fs = require('fs');
const results = JSON.parse(fs.readFileSync('filter_analysis.json', 'utf8'));

const filtered = results.filter(r => {
    const isTargetDir = r.file.startsWith('src/components') || r.file.startsWith('src/app/dashboard') || r.file.startsWith('src/contexts');
    if (!isTargetDir) return false;
    
    // Ignore commonly safe args
    const safeArgs = [
        'Boolean', 'Boolean)', '', 'item', 'val', 'Boolean', 'v => v', 'e => e', 'd => d',
        'p => p', 't => t', 'c => c', 's => s', 'm => m', 'u => u', 'a => a', 'r => r',
        'key => key', 'k => k', 'x => x', 'Boolean', 'b => b'
    ];
    if (safeArgs.includes(r.arg)) return false;
    
    return true;
});

console.log(`Found ${filtered.length} targets:`);
filtered.forEach(f => {
    console.log(`${f.file}:${f.lineNum}: arg="${f.arg}" | line="${f.content}"`);
});
