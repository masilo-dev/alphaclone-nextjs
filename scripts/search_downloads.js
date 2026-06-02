const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');

async function searchFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const basename = path.basename(filePath);
  
  if (ext === '.docx') {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      const text = result.value;
      if (text.toLowerCase().includes('password') || text.includes('postgresql://') || text.includes('@db.')) {
        console.log(`[MATCH in ${basename}]:`);
        const lines = text.split('\n');
        for (const line of lines) {
          if (line.toLowerCase().includes('password') || line.includes('postgresql://') || line.includes('@db.')) {
            console.log(`  > ${line.trim()}`);
          }
        }
      }
    } catch (e) {}
  } else if (ext === '.txt' || ext === '.md' || ext === '.json' || ext === '.sql' || ext === '.html') {
    try {
      const text = fs.readFileSync(filePath, 'utf8');
      if (text.toLowerCase().includes('password') || text.includes('postgresql://') || text.includes('@db.')) {
        console.log(`[MATCH in ${basename}]:`);
        const lines = text.split('\n');
        for (const line of lines) {
          if (line.toLowerCase().includes('password') || line.includes('postgresql://') || line.includes('@db.')) {
            console.log(`  > ${line.trim()}`);
          }
        }
      }
    } catch (e) {}
  }
}

async function run() {
  const dir = '/home/bonnie/Downloads';
  const files = fs.readdirSync(dir);
  for (const file of files) {
    await searchFile(path.join(dir, file));
  }
}

run().catch(console.error);
