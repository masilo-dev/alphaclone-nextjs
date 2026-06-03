const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function run() {
  const dryRunFile = path.join(process.cwd(), 'db_push_dry_run.txt');
  if (!fs.existsSync(dryRunFile)) {
    console.error('❌ Dry run file not found. Please run dry run first.');
    process.exit(1);
  }

  const content = fs.readFileSync(dryRunFile, 'utf8');
  const lines = content.split('\n');
  const filesToMove = [];

  for (const line of lines) {
    // Look for lines starting with "supabase/migrations/" or having it in them
    const match = line.match(/(supabase\/migrations\/[a-zA-Z0-9_\-\.]+)/);
    if (match) {
      filesToMove.push(match[1]);
    }
  }

  console.log(`Found ${filesToMove.length} historical migration files to move temporarily.`);

  const tempDir = path.join(process.cwd(), 'tmp', 'migrations_backup');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const movedFiles = [];
  for (const relPath of filesToMove) {
    const src = path.join(process.cwd(), relPath);
    const dest = path.join(tempDir, path.basename(relPath));
    if (fs.existsSync(src)) {
      fs.renameSync(src, dest);
      movedFiles.push({ src, dest });
    }
  }

  console.log(`Successfully moved ${movedFiles.length} files to backup.`);

  let errorOccurred = null;
  try {
    console.log('Running: npx supabase db push -p "Amgseries@22" --yes');
    const output = execSync('npx supabase db push -p "Amgseries@22" --yes', { stdio: 'inherit' });
    console.log('✅ Push completed successfully!');
  } catch (err) {
    console.error('❌ Push failed:', err.message);
    errorOccurred = err;
  }

  console.log('Restoring migration files...');
  let restoredCount = 0;
  for (const file of movedFiles) {
    if (fs.existsSync(file.dest)) {
      fs.renameSync(file.dest, file.src);
      restoredCount++;
    }
  }
  console.log(`Restored ${restoredCount} files.`);

  // Clean up temp dir
  try {
    fs.rmdirSync(tempDir);
  } catch (e) {}

  if (errorOccurred) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run();
