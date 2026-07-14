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

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter, ['yaml', 'toml']);

/** Renders Markdown without ever calling a translation provider. */
export function renderMarkdown(markdown: string): string {
  return render(parser.parse(markdown) as unknown as Node);
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
