# Markdown Translator / Markdown 文档翻译器

Open a translated Markdown reader beside the active file in Cursor. The extension uses the Claude Code CLI already signed in on your computer, with Claude Haiku at low effort.

在 Cursor 中于当前 Markdown 文件旁打开译文阅读器。扩展复用电脑上已登录的 Claude Code CLI，并使用 Claude Haiku 的 low 推理强度。

## What it does / 功能

- Open it with the Markdown editor's top-right toolbar button; the reader appears in a split editor column beside the source.
  通过 Markdown 编辑器右上角的工具栏按钮打开；阅读器会在源文件旁以分屏编辑器列显示。
- Chinese is the default view. Switch to the original document or add another language through tabs; there is no internal two-column layout.
  默认显示中文译文。可通过标签切换原文或添加其他语言；阅读器内部不会采用双栏布局。
- Send the complete Markdown document to one local Claude Code invocation, rather than making hundreds of short web-translation requests.
  将完整 Markdown 文档交给一次本机 Claude Code 调用，而不是发起数百个短文本网页翻译请求。
- Render the translated Markdown as Claude generates it. The final result is then validated before it is cached.
  Claude 生成译文时即时渲染 Markdown；最终结果会在校验通过后才被缓存。
- Ask Claude to return Markdown only and preserve code, commands, paths, URLs, frontmatter, HTML tags, identifiers, and proper nouns.
  要求 Claude 只返回 Markdown，并保持代码、命令、路径、URL、Frontmatter、HTML 标签、标识符和专有名词不变。
- Validate protected Markdown after every response. If Claude changes protected content, the extension retries once and refuses to display an unsafe result.
  每次响应后校验受保护的 Markdown。若 Claude 改动了受保护内容，扩展会重试一次；仍不符合时不会展示该结果。
- Cache successful translations during the current extension session and cancel obsolete requests when the document or language changes.
  在当前扩展会话中缓存成功译文，并在文档或语言改变时取消过期请求。

## Requirements / 前置条件

Claude Code must be installed and signed in on the same machine that runs Cursor. No API key, extension setting, or separate account configuration is required.

运行 Cursor 的同一台电脑必须已经安装并登录 Claude Code。不需要 API Key、扩展设置或额外账户配置。

```sh
claude --version
```

If this command is unavailable, install Claude Code and complete its normal sign-in flow first. The extension runs Claude with `--safe-mode`, disables tools, and uses `--no-session-persistence`.

如果该命令不可用，请先安装 Claude Code 并完成其常规登录流程。扩展会以 `--safe-mode` 运行 Claude、禁用工具，并使用 `--no-session-persistence`。

## Privacy and cost / 隐私与费用

There is no developer-operated proxy, API key, telemetry, or server. The full Markdown document is passed from the extension to your local Claude Code CLI, which then sends it through your Claude account to Anthropic. This includes code and other protected content so that Claude can preserve document structure; the extension checks that those protected constructs return unchanged.

本扩展没有开发者运营的代理、API Key、遥测或服务器。完整 Markdown 文档会从扩展交给本机 Claude Code CLI，再通过你的 Claude 账户发送给 Anthropic。为保持文档结构，代码等受保护内容也会随文档发送；扩展会检查它们是否原样返回。

Translation consumes your Claude plan or account usage. Do not translate confidential material unless your organisation permits sending it to Anthropic.

翻译会消耗你的 Claude 套餐或账户用量。除非你的组织允许将机密材料发送给 Anthropic，否则请勿使用本扩展翻译机密内容。

## Development / 开发

```sh
npm install
npm test
npm run build
```

Press `F5` and select `Run Extension` in VS Code/Cursor to open an Extension Development Host. The configuration runs `npm: build` first. While iterating, run the `Watch Extension` task from **Tasks: Run Task**, then reload the development host after changes. Before publishing, publish the generated VSIX to Open VSX.

在 VS Code 或 Cursor 中按 `F5` 并选择 `Run Extension`，即可打开 Extension Development Host；该配置会先执行 `npm: build`。持续开发时，从 **Tasks: Run Task** 启动 `Watch Extension`，代码变更后重新加载开发宿主。发布前，将生成的 VSIX 发布到 Open VSX。

## License / 许可证

MIT
