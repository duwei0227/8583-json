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
| M3 规范编辑与历史 · M4 桌面菜单与文件 · M5 发布 | 待开始 |

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
| `pnpm typecheck` | 前端类型检查 |
| `cargo test` | Rust 测试；同时把 Rust 类型导出到 `src/codec/types/` |
| `cargo clippy --workspace --all-targets -- -D warnings` | Rust lint（含桌面壳） |

## 依赖版本说明

- **PrimeVue 固定为 4.5.5、PrimeIcons 固定为 7.x**：两者从 5.x / 8.x 起改为需要 License Key 的 PrimeUI 授权，4.5.5 / 7.x 仍为 MIT。升级前请先确认授权。
- **TypeScript 使用 6.x**：TypeScript 7（原生版）暂不提供 vue-tsc 依赖的 JS API。
- **WASM 暂不经过 wasm-opt**：旧版 binaryen（如 Ubuntu 自带的 108）会破坏新版 Rust 的产物，浏览器加载时报 `Table.grow` 失败。详见 `crates/iso8583-wasm/Cargo.toml`。
