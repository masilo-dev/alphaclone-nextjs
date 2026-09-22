import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const sources = [
  'src/supabase/migrations/20251209_seo_articles.sql',
  'src/DEPLOY_10_ARTICLES.sql',
];
const required = new Set([
  'ai-integration-business-applications-2025',
  'ai-integration-services-business-transformation',
  'api-development-best-practices-2025',
  'cloud-migration-strategy-guide-2025',
  'custom-software-development-enterprise',
  'custom-software-development-guide-2025',
  'cybersecurity-software-applications-2025',
  'devops-implementation-cicd-guide-2025',
  'digital-transformation-strategy-2025',
  'ecommerce-website-development-guide-2025',
  'mobile-app-development-ios-android-2025',
  'react-development-services-modern-web-apps',
]);

function splitFields(body) {
  const fields = [];
  let start = 0;
  let quote = false;
  let square = 0;
  for (let i = 0; i < body.length; i += 1) {
    const char = body[i];
    if (char === "'") {
      if (quote && body[i + 1] === "'") { i += 1; continue; }
      quote = !quote;
    } else if (!quote && char === '[') square += 1;
    else if (!quote && char === ']') square -= 1;
    else if (!quote && square === 0 && char === ',') {
      fields.push(body.slice(start, i).trim());
      start = i + 1;
    }
  }
  fields.push(body.slice(start).trim());
  return fields;
}

function parseValue(raw) {
  if (/^ARRAY\[/i.test(raw)) {
    return [...raw.matchAll(/'((?:''|[^'])*)'/g)].map(match => match[1].replaceAll("''", "'"));
  }
  if (raw.startsWith("'") && raw.endsWith("'")) return raw.slice(1, -1).replaceAll("''", "'");
  if (/^true$/i.test(raw)) return true;
  if (/^false$/i.test(raw)) return false;
  return raw;
}

function parseStatements(sql) {
  const records = [];
  const insert = /INSERT INTO public\.seo_articles\s*\(([^)]+)\)\s*VALUES/gi;
  for (const match of sql.matchAll(insert)) {
    const columns = match[1].split(',').map(value => value.trim());
    let cursor = (match.index ?? 0) + match[0].length;
    while (cursor < sql.length) {
      while (/\s|,/.test(sql[cursor] ?? '')) cursor += 1;
      if (sql[cursor] !== '(') break;
      const start = cursor + 1;
      cursor += 1;
      let depth = 1;
      let quote = false;
      while (cursor < sql.length && depth > 0) {
        const char = sql[cursor];
        if (char === "'") {
          if (quote && sql[cursor + 1] === "'") { cursor += 2; continue; }
          quote = !quote;
        } else if (!quote && char === '(') depth += 1;
        else if (!quote && char === ')') depth -= 1;
        cursor += 1;
      }
      const values = splitFields(sql.slice(start, cursor - 1)).map(parseValue);
      records.push(Object.fromEntries(columns.map((column, index) => [column, values[index]])));
      let probe = cursor;
      while (/\s/.test(sql[probe] ?? '')) probe += 1;
      if (sql[probe] !== ',') break;
      probe += 1;
      while (/\s/.test(sql[probe] ?? '')) probe += 1;
      if (sql[probe] !== '(') break;
      cursor = probe;
    }
  }
  return records;
}

const records = sources.flatMap(file => parseStatements(fs.readFileSync(path.join(root, file), 'utf8')));
const bySlug = new Map(records.filter(record => typeof record.slug === 'string').map(record => [record.slug, record]));

function sanitizeContent(record) {
  const raw = typeof record.content === 'string' ? record.content.trim() : '';
  const looksLikeSeedSummary = /content here|comprehensive .* (covering|article)/i.test(raw) && raw.length < 900;
  const content = looksLikeSeedSummary
    ? `# ${record.title}\n\n${record.meta_description}\n\n## What this guide covers\n\n${raw.replace(/content here\s*-?\s*|2000\+ words\s*/gi, '').trim()}\n\n## A practical starting point\n\nDefine the business outcome, current system boundaries, ownership, approval requirements, and evidence of completion before choosing implementation details.\n\n## Next step\n\nUse these criteria to compare approaches against your team’s real workflow, risk, and maintenance capacity.`
    : raw;
  return content
    .replace(/\*\*Email\*\*:\s*info@alphaclone\.tech\s*/gi, '')
    .replace(/\*\*Phone\*\*:\s*\+1 \(555\) 123-4567\s*/gi, '')
    .replace(/info@alphaclone\.tech/gi, 'contact@alphaclonesystems.com')
    .replace(/\+1 \(555\) 123-4567/gi, '');
}

const selected = [...required].map(slug => {
  const record = bySlug.get(slug);
  if (!record) throw new Error(`Missing local seed article: ${slug}`);
  return {
    id: `fallback-${slug}`,
    title: record.title,
    slug,
    meta_description: record.meta_description,
    meta_keywords: Array.isArray(record.meta_keywords) ? record.meta_keywords : [],
    content: sanitizeContent(record),
    category: record.category,
    tags: Array.isArray(record.tags) ? record.tags : [],
    published: true,
    views: 0,
    created_at: '2025-12-09T00:00:00.000Z',
    updated_at: '2026-09-22T00:00:00.000Z',
  };
});

const output = `/** Generated from the repository's SQL article seeds. Do not edit by hand. */\nimport type { SeoArticleRecord } from '@/services/seoServerService';\n\nexport const SEO_ARTICLE_FALLBACKS: SeoArticleRecord[] = ${JSON.stringify(selected, null, 2)};\n\nexport const SEO_ARTICLE_FALLBACK_BY_SLUG = new Map(SEO_ARTICLE_FALLBACKS.map((article) => [article.slug, article]));\n`;
const target = path.join(root, 'src/content/seoArticleFallbacks.ts');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, output);
console.log(`Wrote ${selected.length} article fallbacks to ${path.relative(root, target)}`);
