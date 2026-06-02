const fs = require('fs');
const path = require('path');

const files = ['.env.local', '.env.production.local', '.env'];
console.log('Checking environment files:');
for (const file of files) {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    const keys = [];
    const content = fs.readFileSync(filePath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const key = trimmed.split('=')[0].trim();
      keys.push(key);
    }
    console.log(`- ${file}:`, keys);
  } else {
    console.log(`- ${file} (not found)`);
  }
}
