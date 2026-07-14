# Markdown Translator / Markdown 文档翻译器

Read the active Markdown file in a Cursor sidebar, translated directly through Google Translate's web service. Code stays exactly as written.

在 Cursor 侧边栏中阅读当前 Markdown 文档的译文，直接使用 Google 翻译网页服务。代码内容保持完全不变。

## What it does / 功能

- Follows the active Markdown editor.
  跟随当前活动的 Markdown 编辑器。
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

Launch the `Run Extension` configuration from VS Code/Cursor to test the extension locally. Before publishing, add a 128×128 PNG marketplace icon, then publish the generated VSIX to Open VSX.

在 VS Code 或 Cursor 中启动 `Run Extension` 配置即可本地调试。发布前，请添加一张 128×128 PNG 商店图标，再将生成的 VSIX 发布到 Open VSX。

## License / 许可证

MIT
