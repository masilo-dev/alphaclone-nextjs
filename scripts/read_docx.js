const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');

async function readDocx(filename) {
  const filePath = path.join('/home/bonnie/Downloads', filename);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }
  console.log(`--- Reading ${filename} ---`);
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    console.log(result.value.substring(0, 3000)); // print first 3000 chars
  } catch (err) {
    console.error(`Error reading ${filename}:`, err);
  }
}

async function run() {
  await readDocx('alphaclone_mcp_fix_prompt.docx');
  await readDocx('Alphaclone_Master_Brief_June2026.docx');
}

run().catch(console.error);
