import sanitizeHtml from 'sanitize-html';

function escapeText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Presentation-only normalization. Never write this result over signed source content. */
export function normalizeDocumentHtml(source: string): string {
  return sanitizeHtml(source, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img'],
    allowedAttributes: {
      a: ['href', 'title'], img: ['src', 'alt'],
      td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan', 'scope'],
      ol: ['start', 'reversed', 'type'], li: ['value'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: { img: ['http', 'https', 'data'] },
    allowProtocolRelative: false,
    transformTags: {
      img: (_tag, attrs) => ({ tagName: 'img', attribs: {
        ...attrs,
        ...(attrs.src?.startsWith('data:') && !/^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(attrs.src) ? { src: '' } : {}),
      } }),
    },
  });
}

/** Convert blocks individually so headings and lists never become children of paragraphs. */
export function documentContentToHtml(source: string): string {
  if (/<[a-z][\s\S]*>/i.test(source)) return normalizeDocumentHtml(source);
  const inline = (value: string) => escapeText(value).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let listTag = '';
  const flushParagraph = () => { if (paragraph.length) blocks.push(`<p>${paragraph.join('<br/>')}</p>`); paragraph = []; };
  const flushList = () => { if (list.length) blocks.push(`<${listTag}>${list.join('')}</${listTag}>`); list = []; listTag = ''; };
  for (const line of source.replace(/\r\n/g, '\n').split('\n')) {
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    const item = /^\s*(?:([-*])\s+|\d+[.)]\s+)(.+)$/.exec(line);
    if (!line.trim() || heading || /^---+$/.test(line)) {
      flushParagraph(); flushList();
      if (heading) blocks.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`);
      else if (/^---+$/.test(line)) blocks.push('<hr/>');
    } else if (item) {
      flushParagraph();
      const tag = item[1] ? 'ul' : 'ol';
      if (listTag && listTag !== tag) flushList();
      listTag = tag; list.push(`<li>${inline(item[2])}</li>`);
    } else { flushList(); paragraph.push(inline(line)); }
  }
  flushParagraph(); flushList();
  return normalizeDocumentHtml(blocks.join('\n'));
}
