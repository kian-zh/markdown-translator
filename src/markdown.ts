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
  position?: {
    start?: {
      offset?: number;
    };
    end?: {
      offset?: number;
    };
  };
};

export type MarkdownBlock = {
  type: string;
  depth?: number;
  startOffset: number;
};

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter, ['yaml', 'toml']);

/** Renders Markdown without ever calling a translation provider. */
export function renderMarkdown(markdown: string): string {
  return render(parser.parse(markdown) as unknown as Node);
}

/** Renders top-level Markdown blocks with optional source-file scroll anchors. */
export function renderMarkdownBlocks(markdown: string, sourceOffsets: number[]): string {
  const root = parser.parse(markdown) as unknown as Node;
  return (root.children ?? []).map((node, index) => {
    const offset = sourceOffsets[index];
    const attribute = Number.isInteger(offset) && offset >= 0 ? ` data-source-offset="${offset}"` : '';
    return `<section class="markdown-block"${attribute}>${render(node)}</section>`;
  }).join('');
}

/** Returns the source offsets of top-level Markdown blocks. */
export function markdownBlocks(markdown: string): MarkdownBlock[] {
  const root = parser.parse(markdown) as unknown as Node;
  return (root.children ?? []).flatMap(node => {
    const startOffset = node.position?.start?.offset;
    return typeof startOffset === 'number'
      ? [{ type: node.type, depth: node.depth, startOffset }]
      : [];
  });
}

/**
 * Maps translated top-level blocks back to source offsets. Matching is both
 * monotonic and type-aware, so a heading/list/code block remains aligned even
 * when translated prose has a different length.
 */
export function mapTranslatedBlocksToSource(source: string, translated: string): number[] {
  const sourceBlocks = markdownBlocks(source);
  const translatedBlocks = markdownBlocks(translated);
  if (!sourceBlocks.length) return translatedBlocks.map(() => 0);

  let previousSourceIndex = 0;
  return translatedBlocks.map((translatedBlock, translatedIndex) => {
    const expected = translatedBlocks.length <= 1 || sourceBlocks.length <= 1
      ? 0
      : (translatedIndex * (sourceBlocks.length - 1)) / (translatedBlocks.length - 1);
    let bestIndex = previousSourceIndex;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let sourceIndex = previousSourceIndex; sourceIndex < sourceBlocks.length; sourceIndex++) {
      const sourceBlock = sourceBlocks[sourceIndex];
      let score = -Math.abs(sourceIndex - expected) * 2;
      if (sourceBlock.type === translatedBlock.type) score += 12;
      if (sourceBlock.type === 'heading' && translatedBlock.type === 'heading' && sourceBlock.depth === translatedBlock.depth) score += 4;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = sourceIndex;
      }
    }
    previousSourceIndex = bestIndex;
    return sourceBlocks[bestIndex].startOffset;
  });
}

/**
 * Separates completed top-level blocks from the final, still-growing block.
 * The final block remains replaceable during streaming; earlier blocks can be
 * appended to the DOM once and never need to be recreated.
 */
export function splitStreamingMarkdown(markdown: string): { committed: string; tail: string } {
  const root = parser.parse(markdown) as unknown as Node;
  const children = root.children ?? [];
  if (children.length < 2) return { committed: '', tail: markdown };

  const end = children[children.length - 2].position?.end?.offset;
  if (end === undefined || end <= 0 || end > markdown.length) return { committed: '', tail: markdown };
  return { committed: markdown.slice(0, end), tail: markdown.slice(end) };
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
