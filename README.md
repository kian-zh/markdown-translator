# Markdown Translator / Markdown 文档翻译器

Open a translation reader beside the active Markdown file in Cursor, translated directly through Google Translate's web service. Code stays exactly as written.

在 Cursor 中于当前 Markdown 文档旁打开译文阅读器，直接使用 Google 翻译网页服务。代码内容保持完全不变。

## What it does / 功能

- Opens from the Markdown editor toolbar and appears in a split editor column beside the source file.
  通过 Markdown 编辑器右上角的按钮打开，并在源文件右侧以分屏编辑器列展示。
- Follows the active Markdown editor while the reader panel is open.
  阅读面板打开后，会跟随当前活动的 Markdown 编辑器。
- Renders a translation in a dedicated sidebar reader.
  在专用侧边栏阅读器中渲染译文。
- Keeps fenced code, inline code, YAML/TOML frontmatter, raw HTML, and link URLs out of translation requests.
  围栏代码块、行内代码、YAML/TOML Frontmatter、原始 HTML 与链接 URL 不会进入翻译请求。
- Opens Chinese by default, with tabs for the original text and any additional translation languages.
  默认打开中文译文，并通过标签切换原文或新增的其他语言。
- Caches repeated text locally for the current extension session.
  在当前扩展会话中本地缓存重复文本。

## Privacy and network use / 隐私与网络使用

This extension has no account, API key, telemetry, or developer-operated backend. Natural-language Markdown text selected for translation is sent directly from your device to Google Translate's web service. Code and the other protected content listed above are not sent.

本扩展不需要账户或 API Key，不收集遥测数据，也没有开发者运营的后端服务。需要翻译的 Markdown 自然语言文本会从你的设备直接发送到 Google 翻译网页服务；代码及上文列出的受保护内容不会发送。

The Google web endpoint is not a documented, supported public API. It can be unavailable because of network restrictions, rate limits, or upstream changes. This extension does not provide a fallback provider, proxy, or mirror.

Google 网页接口不是公开文档化或官方支持的 API，可能因网络限制、限流或上游变更而不可用。本扩展不提供备用翻译服务、代理或镜像。

Do not use it to translate confidential text unless your organisation permits sending that text to Google.

除非你的组织允许将文本发送给 Google，否则请勿使用本扩展翻译机密内容。

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
