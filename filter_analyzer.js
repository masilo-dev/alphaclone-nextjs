const fs = require('fs');
const filters = JSON.parse(fs.readFileSync('all_filters.json', 'utf8'));

const results = [];

filters.forEach(item => {
    const content = item.content;
    // Extract the content inside .filter( ... )
    const match = content.match(/\.filter\((.*)\)/);
    if (match) {
        const arg = match[1].trim();
        // If the argument doesn't look like an inline function
        if (!arg.includes('=>') && !arg.startsWith('function') && arg !== 'Boolean' && arg !== 'Boolean)' && arg !== 'b => b' && arg !== 'x => x') {
            // Also ignore simple helper names like 'isNotNull', etc., but list them
            results.push({
                file: item.file,
                lineNum: item.lineNum,
                arg: arg,
                content: content
            });
        }
    } else {
        // If it spans multiple lines or has complex structure
        results.push({
            file: item.file,
            lineNum: item.lineNum,
            arg: 'COMPLEX / MULTILINE',
            content: content
        });
    }
});

console.log(`Found ${results.length} potentially non-inline filter callbacks.`);
fs.writeFileSync('filter_analysis.json', JSON.stringify(results, null, 2));
// Also write a human readable summary
const summary = results.map(r => `${r.file}:${r.lineNum}: arg="${r.arg}" | line="${r.content}"`).join('\n');
fs.writeFileSync('filter_analysis_summary.txt', summary);
