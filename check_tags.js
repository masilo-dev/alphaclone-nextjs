const fs = require('fs');
const path = require('path');

const filePath = process.argv[2];
if (!filePath) {
    console.error('Usage: node check_tags.js <file_path>');
    process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');

let openDivs = 0;
let closeDivs = 0;
let selfClosingDivs = 0;

// Remove comments to avoid false positives
const cleanContent = content.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/<!--[\s\S]*?-->/g, '');

const openMatches = cleanContent.match(/<div(?:\s[^>]*)?>/g) || [];
const closeMatches = cleanContent.match(/<\/div>/g) || [];
const selfClosingMatches = cleanContent.match(/<div(?:\s[^>]*)?\/>/g) || [];

openDivs = openMatches.length;
closeDivs = closeMatches.length;
selfClosingDivs = selfClosingMatches.length;

console.log(`File: ${filePath}`);
console.log(`Open <div>: ${openDivs}`);
console.log(`Close </div>: ${closeDivs}`);
console.log(`Self-closing <div />: ${selfClosingDivs}`);
console.log(`Net Open: ${openDivs - selfClosingDivs}`);
console.log(`Balance: ${(openDivs - selfClosingDivs) - closeDivs}`);

if (((openDivs - selfClosingDivs) - closeDivs) !== 0) {
    console.error('ERROR: Div tags are imbalanced!');
    process.exit(1);
} else {
    console.log('SUCCESS: Div tags are balanced.');
}
