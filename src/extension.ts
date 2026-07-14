import * as vscode from 'vscode';
import { createHash } from 'node:crypto';
import { ClaudeCliTranslate } from './claudeCliTranslate';
import { renderMarkdown } from './markdown';
import { isRefreshRequest } from './webviewMessages';

const MARKDOWN_LANGUAGES = new Set(['markdown', 'mdx']);
const LANGUAGE_NAMES: Record<string, string> = {
  'zh-CN': '中文', 'zh-TW': '繁體中文', en: 'English', ja: '日本語',
  ko: '한국어', es: 'Español', fr: 'Français', de: 'Deutsch'
};

export function activate(context: vscode.ExtensionContext): void {
  const reader = new TranslationReader();
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownTranslator.refresh', () => reader.refresh()),
    vscode.commands.registerCommand('markdownTranslator.open', () => reader.open()),
    vscode.window.onDidChangeActiveTextEditor(editor => reader.follow(editor?.document)),
    vscode.workspace.onDidChangeTextDocument(event => {
      if (event.document === reader.document) reader.refreshDebounced();
    })
  );
}

class TranslationReader {
  private panel?: vscode.WebviewPanel;
  document?: vscode.TextDocument;
  private readonly claude = new ClaudeCliTranslate();
  private readonly cache = new Map<string, string>();
  private activeLanguage = 'zh-CN';
  private generation = 0;
  private timer?: NodeJS.Timeout;
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

  refreshDebounced(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.refresh(), 450);
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
    try {
      const translated = selectedLanguage === 'original'
        ? source
        : await this.translateCached(source, selectedLanguage, request.signal);
      const html = renderMarkdown(translated);
      if (generation !== this.generation) return;
      panel.webview.postMessage({ type: 'document', html, fileName, selectedLanguage });
    } catch (error) {
      if (generation !== this.generation) return;
      const message = error instanceof Error ? error.message : 'Unknown translation error';
      panel.webview.postMessage({ type: 'error', message, selectedLanguage });
    } finally {
      if (this.activeRequest === request) this.activeRequest = undefined;
    }
  }

  private async translateCached(markdown: string, targetLanguage: string, signal: AbortSignal): Promise<string> {
    const digest = createHash('sha256').update(markdown).digest('hex');
    const key = `${targetLanguage}\u0000${digest}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const translated = await this.claude.translate(markdown, targetLanguage, signal);
    this.cache.set(key, translated);
    return translated;
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
main { padding: 18px 16px 52px; } .file { font: 10px/1.4 ui-monospace, monospace; letter-spacing: .03em; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 18px; }
.status { color: var(--muted); font-style: italic; padding: 28px 0; } .loading { display: flex; align-items: center; gap: 10px; padding: 28px 0; color: var(--muted); } .spinner { width: 15px; height: 15px; flex: 0 0 auto; border: 2px solid color-mix(in srgb, var(--amber) 22%, transparent); border-top-color: var(--amber); border-radius: 50%; animation: spin .75s linear infinite; } .loading-copy { display: grid; gap: 2px; } .loading-title { color: var(--ink); font-style: normal; } .elapsed { font: 10px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--muted); } @keyframes spin { to { transform: rotate(360deg); } } @media (prefers-reduced-motion: reduce) { .spinner { animation-duration: 2s; } } .error { border-left: 3px solid #d26a55; padding: 12px; background: color-mix(in srgb, #d26a55 10%, transparent); } .error strong { display: block; font-family: ui-monospace, monospace; font-size: 12px; margin-bottom: 5px; }
.reader { animation: arrive .25s ease-out; } @keyframes arrive { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
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
const label = key => key === 'original' ? '原文' : names[key] || key;
const save = () => vscode.setState(state);
const safe = value => { const el = document.createElement('span'); el.textContent = value || ''; return el.innerHTML; };
const keys = () => [...base.slice(0, 1), ...state.extra.filter(key => key !== 'zh-CN' && key !== 'original'), 'original'];
const stopElapsed = () => { if (elapsedTimer) { clearInterval(elapsedTimer); elapsedTimer = undefined; } };
function drawTabs() { tabs.innerHTML = keys().map(key => '<button class="tab" role="tab" data-language="' + key + '" aria-selected="' + (key === state.active) + '">' + safe(label(key)) + '</button>').join(''); const available = Object.keys(names).filter(key => !keys().includes(key)); chooser.innerHTML = available.map(key => '<button class="choice" data-language="' + key + '">' + safe(label(key)) + '</button>').join('') || '<span class="status">All languages are open.</span>'; }
function select(key) { if (key !== 'zh-CN' && key !== 'original' && !state.extra.includes(key)) state.extra.push(key); state.active = key; save(); chooser.classList.remove('visible'); drawTabs(); vscode.postMessage({type: 'selectLanguage', value: key}); }
function showLoading(fileName) { stopElapsed(); const started = Date.now(); app.innerHTML = '<div class="file">' + safe(fileName) + '</div><div class="loading"><span class="spinner" aria-hidden="true"></span><div class="loading-copy"><span class="loading-title">Claude Haiku 正在翻译…</span><span class="elapsed" id="elapsed">已用时 0 秒</span></div></div>'; const update = () => { const elapsed = document.getElementById('elapsed'); if (elapsed) elapsed.textContent = '已用时 ' + Math.floor((Date.now() - started) / 1000) + ' 秒'; }; elapsedTimer = setInterval(update, 1000); }
tabs.addEventListener('click', event => { const key = event.target.closest('[data-language]')?.dataset.language; if (key) select(key); });
chooser.addEventListener('click', event => { const key = event.target.closest('[data-language]')?.dataset.language; if (key) select(key); });
document.getElementById('add').addEventListener('click', () => chooser.classList.toggle('visible'));
document.getElementById('refresh').addEventListener('click', () => vscode.postMessage({type: 'refresh'}));
window.addEventListener('message', event => { const message = event.data; if (message.selectedLanguage && message.selectedLanguage !== state.active) return; if (message.type === 'loading') { if (state.active === 'original') { stopElapsed(); app.innerHTML = '<div class="file">' + safe(message.fileName) + '</div><div class="status">正在渲染原文…</div>'; } else showLoading(message.fileName); } if (message.type === 'empty') { stopElapsed(); app.innerHTML = '<div class="status">打开一个 Markdown 文件，即可在这里阅读。</div>'; } if (message.type === 'error') { stopElapsed(); app.innerHTML = '<div class="error"><strong>Translation unavailable</strong>' + safe(message.message) + '<br><br>Claude Code could not complete this translation. Confirm that Claude Code is installed and signed in, then try again.</div>'; } if (message.type === 'document') { stopElapsed(); app.innerHTML = '<div class="file">' + safe(message.fileName) + '</div><article class="reader">' + message.html + '</article>'; } });
drawTabs();
vscode.postMessage({type: 'ready'});
vscode.postMessage({type: 'selectLanguage', value: state.active});
</script></body></html>`;
  }
}
