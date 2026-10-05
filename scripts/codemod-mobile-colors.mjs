#!/usr/bin/env node
/**
 * Replace hardcoded hex in mobile/src with theme color tokens.
 * Only mobile/src/styles/theme.ts may keep hex literals.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mobileSrc = path.join(root, 'mobile/src');

const MAP = new Map([
  ['#00d2a0', 'colors.primary'],
  ['#0077ff', 'colors.info'],
  ['#020d1a', 'colors.background'],
  ['#0a1a2f', 'colors.surface'],
  ['#0d0f18', 'colors.background'],
  ['#1e293b', 'colors.card'],
  ['#ffffff', 'colors.textInverse'],
  ['#fff', 'colors.textInverse'],
  ['#94a3b8', 'colors.textSecondary'],
  ['#64748b', 'colors.textMuted'],
  ['#334155', 'colors.border'],
  ['#ffa500', 'colors.warning'],
  ['#ff6b6b', 'colors.error'],
  ['#4199a4', 'colors.teal'],
  ['#212446', 'colors.navy'],
  ['#fb7268', 'colors.coral'],
  ['#16a36a', 'colors.success'],
  ['#e69222', 'colors.warning'],
  ['#d64545', 'colors.error'],
  ['#3196e8', 'colors.info'],
  ['#de4c7a', 'colors.calendar'],
  ['#000000', 'colors.shadow'],
  ['#000', 'colors.shadow'],
]);

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (/\.(tsx|ts)$/.test(ent.name)) out.push(full);
  }
  return out;
}

function ensureImport(src, file) {
  if (/from\s+['"][^'"]*styles\/theme['"]/.test(src)) {
    if (/\bcolors\b/.test(src.match(/import\s*\{([^}]*)\}\s*from\s*['"][^'"]*styles\/theme['"]/)?.[1] || '')) {
      return src;
    }
    return src.replace(
      /import\s*\{([^}]*)\}\s*from\s*(['"][^'"]*styles\/theme['"])/,
      (_m, names, from) => `import { colors, ${names.trim()} } from ${from}`,
    );
  }
  const rel = path.relative(path.dirname(file), path.join(mobileSrc, 'styles/theme'))
    .replace(/\\/g, '/');
  const importPath = rel.startsWith('.') ? rel : `./${rel}`;
  return `import { colors } from '${importPath}';\n${src}`;
}

let changed = 0;
for (const file of walk(mobileSrc)) {
  if (file.endsWith(`${path.sep}theme.ts`)) continue;
  let src = fs.readFileSync(file, 'utf8');
  const before = src;
  let used = false;

  src = src.replace(/(['"])(#[0-9a-fA-F]{3,8})\1/g, (match, q, hex) => {
    const token = MAP.get(hex.toLowerCase());
    if (!token) return match;
    used = true;
    return token;
  });

  // JSX color="#hex" → color={colors.x}
  src = src.replace(/(\b(?:color|placeholderTextColor|borderColor|backgroundColor|shadowColor)=)(["'])(#[0-9a-fA-F]{3,8})\2/g, (match, attr, q, hex) => {
    const token = MAP.get(hex.toLowerCase());
    if (!token) return match;
    used = true;
    return `${attr}{${token}}`;
  });

  // gradient arrays that still contain quoted hex after first pass shouldn't remain;
  // also handle colors={['#a', '#b']} if any slipped
  src = src.replace(/colors=\{\[(.*?)\]\}/gs, (match, inner) => {
    let next = inner;
    let hit = false;
    next = next.replace(/(['"])(#[0-9a-fA-F]{3,8})\1/g, (_m, _q, hex) => {
      const token = MAP.get(hex.toLowerCase());
      if (!token) return _m;
      hit = true;
      used = true;
      return token;
    });
    return hit ? `colors={[${next}]}` : match;
  });

  if (src !== before || used) {
    if (used || /\bcolors\./.test(src)) src = ensureImport(src, file);
    fs.writeFileSync(file, src);
    changed++;
  }
}

console.log(`codemod-mobile-colors: updated ${changed} files`);
