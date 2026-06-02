const fs = require('fs');
const path = require('path');

const files = ['.env.local.bak', '.env.vercel.local', '.env.preview.local'];
for (const file of files) {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    console.log(`--- Checking ${file} ---`);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const key = trimmed.split('=')[0].trim();
      if (['DATABASE_URL', 'SUPABASE_DB_URL', 'POSTGRES_URL', 'POSTGRES_PASSWORD'].includes(key)) {
        let val = trimmed.split('=')[1].trim();
        if (val) {
          if (val.includes('@')) {
            val = `[URL obfuscated]@${val.split('@')[1]}`;
          }
          console.log(`  ${key}: ${val}`);
        }
      }
    }
  }
}
