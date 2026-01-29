
const fs = require('fs');
try {
    const data = fs.readFileSync('lint_final.json', 'utf8');
    const results = JSON.parse(data);
    results.forEach(result => {
        if (result.errorCount > 0) {
            console.log(`File: ${result.filePath}`);
            result.messages.forEach(msg => {
                if (msg.severity === 2) { // Error
                    console.log(`  Line ${msg.line}: ${msg.message}`);
                }
            });
        }
    });
} catch (err) {
    console.error('Error parsing lint file:', err);
}
