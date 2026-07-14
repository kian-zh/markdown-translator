import { unified } from 'unified';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';

type Node = {
  type: string;
  value?: string;
  url?: string;
  alt?: string;
  depth?: number;
  ordered?: boolean;
  start?: number;
  checked?: boolean | null;
  children?: Node[];
};

export interface RenderedMarkdown {
  translatedHtml: string;
}

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter, ['yaml', 'toml']);

export async function translateMarkdown(
  markdown: string,
  translate: (text: string) => Promise<string>
): Promise<RenderedMarkdown> {
  const translated = parser.parse(markdown) as unknown as Node;
  const textNodes: Node[] = [];
  collectTranslatableText(translated, [], textNodes);

  for (const node of textNodes) {
    node.value = await translateInChunks(node.value ?? '', translate);
  }

  return { translatedHtml: render(translated) };
}

/** Renders Markdown without ever calling a translation provider. */
export function renderMarkdown(markdown: string): string {
  return render(parser.parse(markdown) as unknown as Node);
}

function collectTranslatableText(node: Node, ancestors: string[], found: Node[]): void {
  const protectedNodeTypes = new Set(['code', 'inlineCode', 'html', 'yaml', 'toml', 'definition']);
  if (node.type === 'text' && !ancestors.some(type => protectedNodeTypes.has(type))) {
    found.push(node);
  }
  for (const child of node.children ?? []) {
    collectTranslatableText(child, [...ancestors, node.type], found);
  }
}

async function translateInChunks(text: string, translate: (text: string) => Promise<string>): Promise<string> {
  if (!text.trim()) return text;
  const chunks = splitForWebTranslate(text, 450);
  const translated = await Promise.all(chunks.map(async chunk => ({
    raw: chunk,
    value: chunk.trim() ? await translate(chunk) : chunk
  })));
  return translated.map(chunk => preserveOuterWhitespace(chunk.raw, chunk.value)).join('');
}

function splitForWebTranslate(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text];
  const pieces: string[] = [];
  let remaining = text;
  while (remaining.length > maxLength) {
    const candidates = [remaining.lastIndexOf('. ', maxLength), remaining.lastIndexOf('。', maxLength), remaining.lastIndexOf(' ', maxLength)];
    const boundary = Math.max(...candidates);
    const index = boundary > maxLength * 0.45 ? boundary + 1 : maxLength;
    pieces.push(remaining.slice(0, index));
    remaining = remaining.slice(index);
  }
  pieces.push(remaining);
  return pieces;
}

function preserveOuterWhitespace(original: string, translated: string): string {
  const leading = original.match(/^\s*/)?.[0] ?? '';
  const trailing = original.match(/\s*$/)?.[0] ?? '';
  return `${leading}${translated.trim()}${trailing}`;
}

function render(node: Node): string {
  const children = () => (node.children ?? []).map(render).join('');
  switch (node.type) {
    case 'root': return children();
    case 'paragraph': return `<p>${children()}</p>`;
    case 'heading': return `<h${Math.min(node.depth ?? 1, 4)}>${children()}</h${Math.min(node.depth ?? 1, 4)}>`;
    case 'text': return escapeHtml(node.value ?? '');
    case 'emphasis': return `<em>${children()}</em>`;
    case 'strong': return `<strong>${children()}</strong>`;
    case 'delete': return `<del>${children()}</del>`;
    case 'inlineCode': return `<code>${escapeHtml(node.value ?? '')}</code>`;
    case 'code': return `<pre><code>${escapeHtml(node.value ?? '')}</code></pre>`;
    case 'blockquote': return `<blockquote>${children()}</blockquote>`;
    case 'list': return node.ordered ? `<ol start="${node.start ?? 1}">${children()}</ol>` : `<ul>${children()}</ul>`;
    case 'listItem': return `<li>${node.checked === true ? '<span class="task">✓</span>' : node.checked === false ? '<span class="task">○</span>' : ''}${children()}</li>`;
    case 'link': return `<a href="${safeUrl(node.url ?? '')}">${children()}</a>`;
    case 'image': return `<img src="${safeUrl(node.url ?? '')}" alt="${escapeAttribute(node.alt ?? '')}" />`;
    case 'break': return '<br />';
    case 'thematicBreak': return '<hr />';
    case 'table': return `<div class="table-wrap"><table>${children()}</table></div>`;
    case 'tableRow': return `<tr>${children()}</tr>`;
    case 'tableCell': return `<td>${children()}</td>`;
    case 'html': return `<pre class="raw-html"><code>${escapeHtml(node.value ?? '')}</code></pre>`;
    case 'yaml':
    case 'toml': return `<details class="frontmatter"><summary>Frontmatter (not translated)</summary><pre><code>${escapeHtml(node.value ?? '')}</code></pre></details>`;
    default: return children();
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

function safeUrl(value: string): string {
  return /^(https?:|mailto:|#|\/)/i.test(value) ? escapeAttribute(value) : '#';
}
