# Markdown Translator

Read the active Markdown file in a Cursor sidebar, translated directly through Google Translate's web service. Code stays exactly as written.

## What it does

- follows the active Markdown editor;
- renders a translation in a dedicated sidebar reader;
- keeps fenced code, inline code, YAML/TOML frontmatter, raw HTML, and link URLs out of translation requests;
- lets readers switch the target language from the sidebar;
- caches repeated text locally for the current extension session.

## Privacy and network use

This extension has no account, API key, telemetry, or developer-operated backend. Natural-language Markdown text selected for translation is sent directly from your device to Google Translate's web service. Code and the other protected content listed above are not sent.

The Google web endpoint is not a documented, supported public API. It can be unavailable because of network restrictions, rate limits, or upstream changes. This extension does not provide a fallback provider, proxy, or mirror.

Do not use it to translate confidential text unless your organisation permits sending that text to Google.

## Development

```sh
npm install
npm test
npm run build
```

Launch the `Run Extension` configuration from VS Code/Cursor to test the extension locally. Before publishing, add a 128×128 PNG marketplace icon, then publish the generated VSIX to Open VSX.

## License

MIT
