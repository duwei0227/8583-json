# 8583 ⇄ JSON

ISO 8583 报文与 JSON 双向转换工具。同一套代码同时交付 **Web 版**（纯静态部署）和 **桌面客户端**（Tauri 2）。
所有解析都在本机完成，报文不会上传到任何服务器。

架构设计见 [docs/architecture.md](docs/architecture.md)。

## 当前进度

| 里程碑 | 状态 |
|---|---|
| 项目骨架：Cargo workspace、WASM 构建、Vue + PrimeVue + Tailwind、Tauri 壳 | ✅ |
| M1 编解码核心：`decode` / `encode`，11 个黄金样例与 500 条随机报文往返通过 | ✅ |
| M2 转换页：CodeMirror 编辑器、报文结构、逐段解析表、位图、详情面板，五处选中联动 | ✅ |
| M3 规范管理：多套规范、草稿编辑与校验、报文结构与子域配置、导入导出、恢复默认、确认弹窗 | ✅ |
| M4 桌面端：原生菜单与快捷键（Web 端页面快捷键）、打开 .bin / .hex / .json、拖入文件、版本号统一 | ✅ |
| M5 发布：Windows 安装包 + 绿色版、Web 部署到 Cloudflare | ✅（代码签名、自动更新暂不做） |

## 目录

```
crates/iso8583-core   编解码核心（纯 Rust，无 IO），含内置银联 POS 规范
crates/iso8583-wasm   WASM 封装，供前端调用
src-tauri/            桌面壳（窗口、文件、存储、剪贴板）
src/                  前端（Web 与桌面共用）
  codec/              WASM 加载与类型（types/ 由 Rust 自动生成，勿手改）
  platform/           Web / 桌面差异的唯一出口
  commands/           命令注册表：工具栏、原生菜单、快捷键共用
  stores/             Pinia 状态
  features/           界面：shell · convert · spec · history
  samples/            示例报文，同时是黄金测试样例
e2e/                  端到端测试（Playwright）
```

## 环境要求

- Node.js 22+ 与 pnpm 10+
- Rust（stable）及 `wasm32-unknown-unknown` 目标：`rustup target add wasm32-unknown-unknown`
- [wasm-pack](https://rustwasm.github.io/wasm-pack/)：`cargo install wasm-pack`
- 桌面端额外需要各平台的 Tauri 依赖，见 [Tauri 前置条件](https://tauri.app/start/prerequisites/)
  （Linux 需安装 `libwebkit2gtk-4.1-dev` 等）

## 常用命令

| 命令 | 作用 |
|---|---|
| `pnpm install` | 安装前端依赖 |
| `pnpm dev` | 构建 WASM 并启动 Web 开发服务器（http://localhost:1420） |
| `pnpm tauri dev` | 桌面端开发模式（需先执行一次 `pnpm wasm`） |
| `pnpm build:web` | 构建 Web 版，产物在 `dist/` |
| `pnpm build:desktop` | 打包桌面安装包 |
| `pnpm test` | 前端单元测试（Vitest） |
| `pnpm test:e2e` | 端到端测试（Playwright，自动启动开发服务器；需先执行一次 `pnpm wasm`，首次还需 `pnpm exec playwright install chromium`） |
| `pnpm typecheck` | 前端类型检查 |
| `cargo test` | Rust 测试；同时把 Rust 类型导出到 `src/codec/types/` |
| `cargo clippy --workspace --all-targets -- -D warnings` | Rust lint（含桌面壳） |

## 依赖版本说明

- **PrimeVue 固定为 4.5.5、PrimeIcons 固定为 7.x**：两者从 5.x / 8.x 起改为需要 License Key 的 PrimeUI 授权，4.5.5 / 7.x 仍为 MIT。升级前请先确认授权。
- **TypeScript 使用 6.x**：TypeScript 7（原生版）暂不提供 vue-tsc 依赖的 JS API。
- **WASM 暂不经过 wasm-opt**：旧版 binaryen（如 Ubuntu 自带的 108）会破坏新版 Rust 的产物，浏览器加载时报 `Table.grow` 失败。详见 `crates/iso8583-wasm/Cargo.toml`。

## 发布

### Windows 客户端

先把 `package.json` 里的 `version` 改成要发布的版本并提交，然后任选一种方式（工作流见 `.github/workflows/release.yml`）：

- **网页手动发布**：GitHub 的 Actions 页面选择「Release (Windows)」→「Run workflow」，「发布版本」填 `v0.1.0`。工作流在所选分支的最新提交上创建该标签，构建后发布 GitHub Release
- **推送标签**：

  ```bash
  git tag v0.1.0
  git push origin v0.1.0
  ```

两种方式都会检查版本号与 `package.json` 一致；手动发布时标签已存在会直接失败，不会覆盖。

产物有两个：

- `8583-json_<版本>_x64-setup.exe`：安装包，中文界面，安装到当前用户目录，不需要管理员权限
- `8583-json_<版本>_x64_portable.zip`：绿色版，解压后直接运行 `8583-json.exe`

发布前想先试构建：手动运行时「发布版本」留空，产物会出现在该次运行的 Artifacts 里，不会发布 Release。

程序目前没有代码签名，首次运行时 Windows 可能提示「已保护你的电脑」，点「更多信息」→「仍要运行」即可。运行需要 WebView2 运行时，Windows 10 / 11 一般已自带。

### Web 版（Cloudflare Workers）

Cloudflare 直接连接本仓库，推送到 `master` 后自动构建部署。一次性配置：

1. 登录 Cloudflare 控制台 → **Workers & Pages** → **Create** → 导入 GitHub 仓库 `duwei0227/8583-json`
2. 构建设置：
   - **Build command**：`bash scripts/cf-build.sh`
   - **Deploy command**：`npx wrangler deploy`（默认值）
   - 根目录保持仓库根目录，生产分支选 `master`
3. 保存并部署。完成后网址为 `https://iso8583-json.<你的子域>.workers.dev`，可在设置里绑定自己的域名

说明：

- Cloudflare 的构建镜像不含 Rust，`scripts/cf-build.sh` 会先安装 Rust 与 wasm-pack 再构建，每次部署大约需要 4 分钟
- 站点配置在 `wrangler.jsonc`；响应头（CSP 等）在 `public/_headers`，构建时复制到 `dist/`
- CSP 只允许加载本站资源，报文不会被发送到任何其他地址
