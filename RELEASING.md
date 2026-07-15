# Releasing / 发布指南

This project ships one VSIX to two registries:

本项目使用同一个 VSIX 发布到两个扩展仓库：

| Product / 产品 | Registry / 仓库 | Required credential / 所需凭据 |
| --- | --- | --- |
| VS Code | Visual Studio Marketplace | Azure DevOps PAT with `Marketplace > Manage` / 具备 `Marketplace > Manage` 权限的 Azure DevOps PAT |
| Cursor | Open VSX | Open VSX personal access token / Open VSX 个人访问令牌 |

The Cursor Agent Plugin Marketplace is separate from the extension registry and is not used by this VS Code extension.

Cursor 的 Agent Plugin Marketplace 与扩展仓库不同；本 VS Code 扩展不发布到该市场。

## One-time setup / 首次设置

1. Create the `kian-zh` publisher in the Visual Studio Marketplace and log in locally:
   在 Visual Studio Marketplace 创建 `kian-zh` 发布者，并在本机登录：

   ```sh
   npx @vscode/vsce login kian-zh
   ```

2. Create an Open VSX account and personal access token, then claim the namespace that matches `package.json`:
   创建 Open VSX 账户和个人访问令牌，然后认领与 `package.json` 相同的命名空间：

   ```sh
   npx ovsx create-namespace kian-zh -p "$OVSX_PAT"
   ```

Keep both credentials outside this repository. Never commit tokens or `.env` files.

两类凭据均须保存在仓库外，绝不可提交令牌或 `.env` 文件。

## Release checklist / 发布清单

1. Update `version` in `package.json` and add release notes to `CHANGELOG.md`.
   更新 `package.json` 的 `version`，并在 `CHANGELOG.md` 添加发布说明。
2. Run the complete validation suite:
   运行完整校验：

   ```sh
   npm test
   npm run package
   npm run vsix
   ```

3. Install the generated `.vsix` manually in both VS Code and Cursor. Verify that a signed-in local `claude -p "Reply with OK only."` succeeds, then open and refresh a Markdown translation.
   在 VS Code 和 Cursor 中手动安装生成的 `.vsix`。确认本地已登录的 `claude -p "Reply with OK only."` 能成功执行，再打开 Markdown 翻译器并刷新一次。
4. Publish the identical VSIX to both registries:
   将同一个 VSIX 发布到两个仓库：

   ```sh
   npx @vscode/vsce publish --packagePath markdown-translator-<version>.vsix
   npx ovsx publish markdown-translator-<version>.vsix -p "$OVSX_PAT"
   ```

5. Confirm that `kian-zh.markdown-translator` is searchable in VS Code and Open VSX. Cursor search can lag while its Open VSX mirror completes scanning; the VSIX remains an installation fallback.
   确认 `kian-zh.markdown-translator` 可在 VS Code 和 Open VSX 中搜索到。Cursor 的 Open VSX 镜像完成扫描前，搜索可能会有延迟；此时仍可通过 VSIX 安装。
