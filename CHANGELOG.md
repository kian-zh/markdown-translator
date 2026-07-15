# Changelog / 更新日志

All notable changes to this project are documented in this file.

本文件记录项目的主要更新。

## 0.1.0 — 2026-07-15

- Initial public release of Markdown Translator.
  Markdown Translator 首个公开版本。
- Opens a translated Markdown reader beside the active document in VS Code and Cursor.
  在 VS Code 和 Cursor 中于当前文档旁打开译文阅读器。
- Uses the locally installed and signed-in Claude Code CLI with Claude Haiku at low effort; no extension API key or hosted proxy is used.
  使用本机已安装、已登录的 Claude Code CLI，并采用 Claude Haiku low 推理强度；不使用扩展 API Key 或开发者代理服务。
- Streams rendered Markdown, supports language tabs, and preserves protected Markdown data such as code and URLs.
  支持流式 Markdown 渲染、语言标签页，并保护代码、URL 等 Markdown 数据。
