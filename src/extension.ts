import * as vscode from 'vscode';
import { createHash } from 'node:crypto';
import { ClaudeCliTranslate, TranslationProgress } from './claudeCliTranslate';
import { mapTranslatedBlocksToSource, renderMarkdown, renderMarkdownBlocks, splitStreamingMarkdown } from './markdown';
import { isRefreshRequest, isSourceAnchorRequest } from './webviewMessages';

const MARKDOWN_LANGUAGES = new Set(['markdown', 'mdx']);
const STREAM_RENDER_INTERVAL_MS = 160;
const LANGUAGE_NAMES: Record<string, string> = {
  'zh-CN': '中文', 'zh-TW': '繁體中文', en: 'English', ja: '日本語',
  ko: '한국어', es: 'Español', fr: 'Français', de: 'Deutsch'
};

export function activate(context: vscode.ExtensionContext): void {
  const reader = new TranslationReader();
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownTranslator.refresh', () => reader.refresh()),
    vscode.commands.registerCommand('markdownTranslator.open', () => reader.open()),
    vscode.window.onDidChangeActiveTextEditor(editor => reader.follow(editor?.document))
  );
}

class TranslationReader {
  private panel?: vscode.WebviewPanel;
  document?: vscode.TextDocument;
  private readonly claude = new ClaudeCliTranslate();
  private readonly cache = new Map<string, string>();
  private activeLanguage = 'zh-CN';
  private generation = 0;
  private activeRequest?: AbortController;

  open(): void {
    const document = vscode.window.activeTextEditor?.document;
    if (!document || !MARKDOWN_LANGUAGES.has(document.languageId)) {
      void vscode.window.showInformationMessage('Markdown Translator: open a Markdown file first.');
      return;
    }
    this.document = document;
    let created = false;
    if (!this.panel) {
      created = true;
      this.panel = vscode.window.createWebviewPanel(
        'markdownTranslator.reader',
        'Markdown Translation',
        vscode.ViewColumn.Beside,
        { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [] }
      );
      this.panel.webview.html = this.shell(this.panel.webview);
      this.panel.webview.onDidReceiveMessage(message => {
        if (isRefreshRequest(message)) this.refresh();
        if (isSourceAnchorRequest(message)) this.revealSourceOffset(message.sourceOffset);
        if (message?.type === 'selectLanguage' && typeof message.value === 'string' && (message.value === 'original' || message.value in LANGUAGE_NAMES)) {
          this.activeLanguage = message.value;
          this.refresh();
        }
      });
      this.panel.onDidDispose(() => {
        this.activeRequest?.abort();
        this.activeRequest = undefined;
        this.panel = undefined;
        this.document = undefined;
        this.generation++;
      });
    } else {
      this.panel.reveal(vscode.ViewColumn.Beside);
    }
    if (!created) this.refresh();
  }

  follow(document?: vscode.TextDocument): void {
    if (this.panel && document && MARKDOWN_LANGUAGES.has(document.languageId)) {
      this.document = document;
      this.refresh();
    }
  }

  async refresh(): Promise<void> {
    const panel = this.panel;
    const document = this.document;
    if (!panel || !document) return;

    const generation = ++this.generation;
    this.activeRequest?.abort();
    const request = new AbortController();
    this.activeRequest = request;
    const source = document.getText();
    const fileName = vscode.workspace.asRelativePath(document.uri);
    const selectedLanguage = this.activeLanguage;
    panel.webview.postMessage({ type: 'loading', fileName, selectedLanguage });
    let streamTimer: NodeJS.Timeout | undefined;
    let pendingMarkdown = '';
    let committedLength = 0;
    const flushStream = (): void => {
      streamTimer = undefined;
      if (generation !== this.generation || !pendingMarkdown) return;
      const stream = splitStreamingMarkdown(pendingMarkdown);
      if (stream.committed.length < committedLength) committedLength = 0;
      const committed = stream.committed.slice(committedLength);
      committedLength = stream.committed.length;
      panel.webview.postMessage({
        type: 'stream',
        committedHtml: committed ? renderMarkdown(committed) : '',
        tailHtml: renderMarkdown(stream.tail),
        fileName,
        selectedLanguage
      });
    };
    try {
      const translated = selectedLanguage === 'original'
        ? source
        : await this.translateCached(source, selectedLanguage, request.signal, progress => {
          if (generation !== this.generation) return;
          if (progress.type === 'retry') {
            if (streamTimer) clearTimeout(streamTimer);
            streamTimer = undefined;
            pendingMarkdown = '';
            committedLength = 0;
            panel.webview.postMessage({ type: 'retry', fileName, selectedLanguage, attempt: progress.attempt });
            return;
          }
          pendingMarkdown = progress.markdown;
          if (!streamTimer) streamTimer = setTimeout(flushStream, STREAM_RENDER_INTERVAL_MS);
        });
      if (streamTimer) clearTimeout(streamTimer);
      const html = renderMarkdownBlocks(translated, mapTranslatedBlocksToSource(source, translated));
      if (generation !== this.generation) return;
      panel.webview.postMessage({ type: 'document', html, fileName, selectedLanguage });
    } catch (error) {
      if (streamTimer) clearTimeout(streamTimer);
      if (generation !== this.generation) return;
      const message = error instanceof Error ? error.message : 'Unknown translation error';
      panel.webview.postMessage({ type: 'error', message, selectedLanguage });
    } finally {
      if (this.activeRequest === request) this.activeRequest = undefined;
    }
  }

  private async translateCached(markdown: string, targetLanguage: string, signal: AbortSignal, onProgress: (progress: TranslationProgress) => void): Promise<string> {
    const digest = createHash('sha256').update(markdown).digest('hex');
    const key = `${targetLanguage}\u0000${digest}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const translated = await this.claude.translate(markdown, targetLanguage, signal, onProgress);
    this.cache.set(key, translated);
    return translated;
  }

  private revealSourceOffset(sourceOffset: number): void {
    const document = this.document;
    if (!document) return;
    const editor = vscode.window.visibleTextEditors.find(candidate => candidate.document.uri.toString() === document.uri.toString());
    if (!editor) return;
    const position = document.positionAt(Math.min(sourceOffset, document.getText().length));
    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.AtTop);
  }

  private shell(webview: vscode.Webview): string {
    const nonce = String(Math.random()).slice(2);
    const csp = `default-src 'none'; img-src ${webview.cspSource} https: data:; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'`;
    const languageNames = JSON.stringify(LANGUAGE_NAMES);
    return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8" /><meta http-equiv="Content-Security-Policy" content="${csp}" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style nonce="${nonce}">
:root { --paper: var(--vscode-sideBar-background); --ink: var(--vscode-sideBar-foreground); --muted: var(--vscode-descriptionForeground); --line: color-mix(in srgb, var(--ink) 14%, transparent); --amber: #d8a23b; --code: color-mix(in srgb, var(--vscode-textCodeBlock-background) 86%, #1d1911); }
* { box-sizing: border-box; } body { margin: 0; background: var(--paper); color: var(--ink); font-family: Georgia, 'Times New Roman', serif; font-size: 14px; line-height: 1.7; }
header { position: sticky; top: 0; z-index: 2; padding: 7px 16px 0; background: color-mix(in srgb, var(--paper) 95%, transparent); backdrop-filter: blur(14px); border-bottom: 1px solid var(--line); }
.bar { display: flex; align-items: end; gap: 6px; } .tabs { display: flex; min-width: 0; flex: 1; overflow-x: auto; scrollbar-width: none; } .tabs::-webkit-scrollbar { display: none; }
button { border: 0; background: transparent; color: var(--muted); cursor: pointer; } .tab { position: relative; flex: 0 0 auto; padding: 7px 8px 8px; font: 11px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; } .tab:hover { color: var(--ink); } .tab[aria-selected="true"] { color: var(--ink); } .tab[aria-selected="true"]::after { content: ''; position: absolute; right: 8px; bottom: -1px; left: 8px; height: 2px; background: var(--amber); }
.add, .refresh { flex: 0 0 auto; padding: 6px 7px 8px; color: var(--muted); font: 14px/1 ui-monospace, monospace; } .add:hover, .refresh:hover { color: var(--amber); }
.chooser { display: none; gap: 5px; flex-wrap: wrap; padding: 8px 0 10px; border-top: 1px solid var(--line); } .chooser.visible { display: flex; } .choice { border: 1px solid var(--line); padding: 4px 7px; font: 10px/1.2 ui-monospace, monospace; } .choice:hover { border-color: var(--amber); color: var(--amber); }
main { padding: 18px 16px 52px; } .file { font: 10px/1.4 ui-monospace, monospace; letter-spacing: .03em; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 18px; } .file.live { display: flex; align-items: center; gap: 6px; } .stream-meta { display: inline-flex; align-items: center; gap: 5px; color: var(--amber); } .stream-meta .spinner { width: 10px; height: 10px; border-width: 1.5px; }
.status { color: var(--muted); font-style: italic; padding: 28px 0; } .loading { display: flex; align-items: center; gap: 10px; padding: 28px 0; color: var(--muted); } .spinner { width: 15px; height: 15px; flex: 0 0 auto; border: 2px solid color-mix(in srgb, var(--amber) 22%, transparent); border-top-color: var(--amber); border-radius: 50%; animation: spin .75s linear infinite; } .loading-copy { display: grid; gap: 2px; } .loading-title { color: var(--ink); font-style: normal; } .elapsed { font: 10px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--muted); } @keyframes spin { to { transform: rotate(360deg); } } @media (prefers-reduced-motion: reduce) { .spinner { animation-duration: 2s; } } .error { border-left: 3px solid #d26a55; padding: 12px; background: color-mix(in srgb, #d26a55 10%, transparent); } .error strong { display: block; font-family: ui-monospace, monospace; font-size: 12px; margin-bottom: 5px; }
h1,h2,h3,h4 { font-family: 'Bodoni 72', Georgia, serif; line-height: 1.12; letter-spacing: -.015em; margin: 1.45em 0 .55em; } h1 { font-size: 1.8em; } h2 { font-size: 1.45em; } h3 { font-size: 1.18em; } p { margin: .8em 0; } a { color: var(--amber); } blockquote { margin: 1em 0; padding: .15em 0 .15em 14px; border-left: 2px solid var(--amber); color: color-mix(in srgb, var(--ink) 82%, var(--muted)); } pre { overflow: auto; padding: 12px; border: 1px solid var(--line); background: var(--code); font: 12px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace; } :not(pre) > code { padding: .12em .28em; background: var(--code); font: .85em ui-monospace, monospace; } ul,ol { padding-left: 1.35em; } .task { color: var(--amber); margin-right: 5px; } hr { border: 0; border-top: 1px solid var(--line); margin: 2em 0; } table { width: 100%; border-collapse: collapse; font-size: .9em; } td { border: 1px solid var(--line); padding: 6px; vertical-align: top; } .table-wrap { overflow: auto; } img { max-width: 100%; } details { margin-top: 28px; border-top: 1px solid var(--line); color: var(--muted); } summary { cursor: pointer; padding-top: 8px; font: 10px ui-monospace, monospace; }
</style></head><body><header><div class="bar"><div class="tabs" id="tabs" role="tablist" aria-label="Translation language"></div><button class="add" id="add" title="Add language">+</button><button class="refresh" id="refresh" title="Refresh translation">↻</button></div><div class="chooser" id="chooser" aria-label="Choose a language"></div></header><main id="app"><div class="status">正在准备中文译文…</div></main>
<script nonce="${nonce}">
const vscode = acquireVsCodeApi();
const app = document.getElementById('app');
const tabs = document.getElementById('tabs');
const chooser = document.getElementById('chooser');
const names = ${languageNames};
const stored = vscode.getState() || {};
const state = { active: stored.active || 'zh-CN', extra: Array.isArray(stored.extra) ? stored.extra : [] };
const base = ['zh-CN', 'original'];
let elapsedTimer;
let translationStartedAt;
let scrollFrame;
let lastSourceOffset = -1;
const label = key => key === 'original' ? '原文' : names[key] || key;
const save = () => vscode.setState(state);
const safe = value => { const el = document.createElement('span'); el.textContent = value || ''; return el.innerHTML; };
const keys = () => [...base.slice(0, 1), ...state.extra.filter(key => key !== 'zh-CN' && key !== 'original'), 'original'];
const stopElapsed = () => { if (elapsedTimer) { clearInterval(elapsedTimer); elapsedTimer = undefined; } };
function drawTabs() { tabs.innerHTML = keys().map(key => '<button class="tab" role="tab" data-language="' + key + '" aria-selected="' + (key === state.active) + '">' + safe(label(key)) + '</button>').join(''); const available = Object.keys(names).filter(key => !keys().includes(key)); chooser.innerHTML = available.map(key => '<button class="choice" data-language="' + key + '">' + safe(label(key)) + '</button>').join('') || '<span class="status">All languages are open.</span>'; }
function select(key) { if (key !== 'zh-CN' && key !== 'original' && !state.extra.includes(key)) state.extra.push(key); state.active = key; save(); chooser.classList.remove('visible'); drawTabs(); vscode.postMessage({type: 'selectLanguage', value: key}); }
function elapsedText() { return '已用时 ' + Math.floor((Date.now() - translationStartedAt) / 1000) + ' 秒'; }
function showLoading(fileName, title) { stopElapsed(); translationStartedAt = Date.now(); app.innerHTML = '<div class="file">' + safe(fileName) + '</div><div class="loading"><span class="spinner" aria-hidden="true"></span><div class="loading-copy"><span class="loading-title">' + safe(title || 'Claude Haiku 正在翻译…') + '</span><span class="elapsed" id="elapsed">已用时 0 秒</span></div></div>'; const update = () => { const elapsed = document.getElementById('elapsed'); if (elapsed) elapsed.textContent = elapsedText(); }; elapsedTimer = setInterval(update, 1000); }
function showStream(fileName, committedHtml, tailHtml) { let committed = document.getElementById('stream-committed'); let tail = document.getElementById('stream-tail'); if (!committed || !tail) { app.innerHTML = '<div class="file live">' + safe(fileName) + '<span class="stream-meta"><span class="spinner" aria-hidden="true"></span><span id="elapsed">生成中 · ' + elapsedText() + '</span></span></div><article class="reader"><section id="stream-committed"></section><section id="stream-tail"></section></article>'; committed = document.getElementById('stream-committed'); tail = document.getElementById('stream-tail'); } if (committedHtml) committed.insertAdjacentHTML('beforeend', committedHtml); tail.innerHTML = tailHtml; }
function reportScrollAnchor() { scrollFrame = undefined; const blocks = [...document.querySelectorAll('.markdown-block[data-source-offset]')]; if (!blocks.length) return; const anchorY = window.innerHeight * .35; let block = blocks.find(candidate => { const rect = candidate.getBoundingClientRect(); return rect.top <= anchorY && rect.bottom > anchorY; }); if (!block) block = blocks.find(candidate => candidate.getBoundingClientRect().top > anchorY) || blocks[blocks.length - 1]; const sourceOffset = Number(block.dataset.sourceOffset); if (Number.isSafeInteger(sourceOffset) && sourceOffset !== lastSourceOffset) { lastSourceOffset = sourceOffset; vscode.postMessage({type: 'sourceAnchor', sourceOffset}); } }
window.addEventListener('scroll', () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(reportScrollAnchor); }, { passive: true });
tabs.addEventListener('click', event => { const key = event.target.closest('[data-language]')?.dataset.language; if (key) select(key); });
chooser.addEventListener('click', event => { const key = event.target.closest('[data-language]')?.dataset.language; if (key) select(key); });
document.getElementById('add').addEventListener('click', () => chooser.classList.toggle('visible'));
document.getElementById('refresh').addEventListener('click', () => vscode.postMessage({type: 'refresh'}));
window.addEventListener('message', event => { const message = event.data; if (message.selectedLanguage && message.selectedLanguage !== state.active) return; if (message.type === 'loading') { lastSourceOffset = -1; if (state.active === 'original') { stopElapsed(); app.innerHTML = '<div class="file">' + safe(message.fileName) + '</div><div class="status">正在渲染原文…</div>'; } else showLoading(message.fileName); } if (message.type === 'stream') showStream(message.fileName, message.committedHtml, message.tailHtml); if (message.type === 'retry') showLoading(message.fileName, '正在进行第 ' + message.attempt + ' 次保护性重试…'); if (message.type === 'empty') { stopElapsed(); app.innerHTML = '<div class="status">打开一个 Markdown 文件，即可在这里阅读。</div>'; } if (message.type === 'error') { stopElapsed(); app.innerHTML = '<div class="error"><strong>Translation unavailable</strong>' + safe(message.message) + '<br><br>Claude Code could not complete this translation. Confirm that Claude Code is installed and signed in, then try again.</div>'; } if (message.type === 'document') { lastSourceOffset = -1; stopElapsed(); app.innerHTML = '<div class="file">' + safe(message.fileName) + '</div><article class="reader">' + message.html + '</article>'; } });
drawTabs();
vscode.postMessage({type: 'ready'});
vscode.postMessage({type: 'selectLanguage', value: state.active});
</script></body></html>`;
  }
}
