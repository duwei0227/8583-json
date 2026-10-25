# 8583 ⇄ JSON 转换工具 · 项目架构设计

> 状态：v0.2（项目骨架已按本文搭建）
> 范围：同一套代码同时交付 **Web 版**（静态部署）和 **桌面客户端**（Tauri 2，Windows / macOS / Linux）
> 技术栈：Tauri 2 · Vue 3 · TypeScript 6 · PrimeVue 4.5.5（MIT）· Tailwind CSS 4 · Rust（编解码核心，编译为 WASM）

---

## 1. 目标与约束

| 目标 | 说明 |
|---|---|
| 双向转换 | 8583 HEX ⇄ JSON，结果必须可往返（encode → decode 不丢信息） |
| 逐段解析说明 | 长度头、TPDU、报文头、MTI、位图、每个数据域都给出偏移、原始字节、解析值和含义 |
| 规范可配置 | 内置「银联 POS」默认规范；可编辑域定义和报文结构，可导入、导出 |
| 双端一致 | Web 和桌面使用**同一份编解码代码**，解析结果逐字节一致 |
| 数据不出本机 | 报文含卡号、磁道等敏感数据，所有解析都在本地完成，不上传任何服务器 |

非目标（第一版不做）：联机发送报文到主机（TCP），多标签同时打开多条报文，主题切换，多语言。架构上为这些功能预留位置。

---

## 2. 总体分层

```
┌──────────────────────────────────────────────────────────────────┐
│ UI 层          Vue 3 组件 · PrimeVue · Tailwind 4                  │
│                shell（菜单 / 工具栏 / 状态栏） · convert · spec · history │
├──────────────────────────────────────────────────────────────────┤
│ 应用层         Pinia stores · 命令注册表（commands） · explain（含义文案） │
├───────────────────────────────┬──────────────────────────────────┤
│ 领域层  codec（TS 封装）         │ 平台层  platform 适配器              │
│        ↓ 调用                  │        web.ts      │  tauri.ts      │
├───────────────────────────────┤        浏览器 API   │  Tauri 插件     │
│ iso8583-wasm（wasm-bindgen）    ├────────────────────┴──────────────┤
│        ↓ 依赖                  │ src-tauri（仅桌面）：窗口、文件、       │
│ iso8583-core（纯 Rust，无 IO）   │ 本地存储、剪贴板、更新                 │
└───────────────────────────────┴──────────────────────────────────┘
```

依赖方向**只能从上往下**：UI 不直接调用 WASM，也不直接调用 Tauri API；只通过 `codec` 和 `platform` 两个入口。

---

## 3. 仓库结构

沿用 Tauri 的默认约定（前端在根目录 `src/`，壳在 `src-tauri/`），另加 Cargo workspace 放 Rust 核心。

```
8583-json/
├─ Cargo.toml                    # workspace：crates/* + src-tauri
├─ package.json                  # 前端依赖与脚本（pnpm）
├─ vite.config.ts
├─ index.html
├─ crates/
│  ├─ iso8583-core/              # 编解码核心：纯函数、无 IO、无 panic
│  │  ├─ src/
│  │  │  ├─ lib.rs               # 对外 API：decode / encode / presets
│  │  │  ├─ spec.rs              # 规范模型（serde）
│  │  │  ├─ decode.rs            # 解析：长度头 / TPDU / 报文头 / MTI / 位图 / 各域
│  │  │  ├─ encode.rs            # 组包：编码各域、生成位图、拼接头部
│  │  │  ├─ field.rs             # 单个数据域的读写（定长 / LL / LLL）
│  │  │  ├─ encoding.rs          # BCD / ASCII / 长度前缀 / 补位
│  │  │  ├─ tlv.rs               # 55 域等 TLV 解析
│  │  │  ├─ hex.rs               # 十六进制文本与字节互转
│  │  │  ├─ message.rs           # 解析结果模型（含偏移，供 UI 联动）
│  │  │  └─ error.rs             # 带偏移和域号的错误
│  │  ├─ presets/cup_pos.json    # 内置银联 POS 规范（include_str! 编译进库）
│  │  └─ tests/                  # 单元测试、往返测试、黄金样例
│  └─ iso8583-wasm/              # wasm-bindgen 封装，产物供前端 import
│     └─ src/lib.rs
├─ src-tauri/                    # 桌面壳（只在桌面端存在）
│  ├─ src/
│  │  ├─ main.rs
│  │  └─ lib.rs                  # 注册插件（原生菜单由前端生成，见 5.2）
│  ├─ capabilities/default.json  # 最小权限声明
│  └─ tauri.conf.json
├─ src/                          # 前端（Web 与桌面共用）
│  ├─ main.ts · App.vue
│  ├─ codec/                     # 加载 WASM、类型安全封装
│  │  ├─ index.ts
│  │  └─ types.ts                # 由 Rust 类型自动生成，不手写
│  ├─ platform/                  # 平台适配层
│  │  ├─ types.ts                # Platform 接口
│  │  ├─ index.ts                # isTauri() 判断后动态 import
│  │  ├─ web.ts
│  │  └─ tauri.ts
│  ├─ commands/                  # 命令注册表：菜单、工具栏、快捷键的唯一来源
│  │  └─ index.ts
│  ├─ stores/                    # Pinia
│  │  ├─ message.ts              # 当前 HEX / JSON / 解析结果 / 选中段
│  │  ├─ spec.ts                 # 规范列表、当前规范、未应用修改
│  │  ├─ history.ts              # 转换历史
│  │  └─ ui.ts                   # 抽屉、弹窗、布局（左右 / 上下）
│  ├─ explain/                   # 「含义」文案：MTI 每位取值、域值翻译、TLV 标签名
│  ├─ samples/                   # 示例报文（JSON），同时作为测试用例
│  ├─ features/
│  │  ├─ shell/                  # AppToolbar · StatusBar · WebMenu（Web 端「更多」菜单）
│  │  │                          # AboutDialog · ShortcutsDialog · FieldRefDialog
│  │  ├─ convert/                # ConvertView · StructureStrip
│  │  │                          # SegmentTable · BitmapGrid · SegmentDetail · CodeEditor
│  │  ├─ spec/                   # SpecDialog · FrameSettings · FieldTable · FieldEditor
│  │  └─ history/                # HistoryDrawer
│  └─ styles/main.css            # @import tailwindcss + tailwindcss-primeui
├─ e2e/                         # Playwright 端到端用例（Web 版）
├─ docs/
└─ .github/workflows/ci.yml
```

---

## 4. 编解码核心（`iso8583-core`）

### 4.1 设计原则

- **纯函数**：输入字节和规范，输出结构化结果；不读文件、不联网、不打印日志。所以它既能编译成 WASM，也能被 Tauri 原生调用，以后还能复用到命令行工具或服务端。
- **不 panic**：所有越界、非法长度都返回 `Err`，错误里带**字节偏移**和**域号**，供 UI 精确提示（例如「第 64 域越界：需要 8 字节，剩余 5 字节」）。
- **结果自带偏移**：每一段都记录 `offset` 和 `len`。这是 UI 里报文结构、逐段解析表、位图三处联动的数据基础。

### 4.2 规范模型（serde，JSON 可导入导出）

```rust
pub struct Spec {
    pub schema: u32,                 // 规范文件格式版本，从 1 开始
    pub name: String,                // "银联 POS"
    pub frame: FrameSpec,
    pub fields: BTreeMap<u8, FieldSpec>,   // 2..=128
}

pub struct FrameSpec {
    pub length_header: LengthHeader,       // None | Binary2 | Ascii4
    pub tpdu_len: u8,                      // 0 或 5
    pub header: HeaderSpec,                // 长度 + 子段切分（可自定义）
    pub mti_encoding: NumEncoding,         // Bcd | Ascii
    pub bitmap_encoding: BitmapEncoding,   // Binary | AsciiHex
    pub len_prefix_encoding: NumEncoding,  // Bcd | Ascii
}

pub struct FieldSpec {
    pub name: String,
    pub kind: FieldKind,        // N | Z | An | Ans | B
    pub max_len: u16,           // b 型定长按 bit，其余按位数 / 字符数 / 字节数
    pub len_type: LenType,      // Fixed | LlVar | LllVar
    pub pad: Option<PadRule>,   // 缺省时按类型取默认补位规则
    pub sub: Option<SubSpec>,   // Tlv | Positional(Vec<SubField>)，例如 55 域、60 域
}
```

原型里写死的「位图编码」「长度前缀编码」「报文头子段」，在模型里都是可配置项。第一版界面可以只开放其中一部分，但数据模型一次定好，避免以后规范文件不兼容。

### 4.3 解析结果模型

```rust
pub struct Decoded {
    pub total: usize,
    pub segments: Vec<Segment>,   // 按报文顺序：len, tpdu, header, mti, bitmap, F2..F128
    pub mti: String,
    pub bits: Vec<u8>,
    pub warnings: Vec<Warning>,   // 长度头不一致、末尾多余字节等，不中断解析
}

pub struct Segment {
    pub id: SegmentId,            // Len | Tpdu | Header | Mti | Bitmap | Field(u8)
    pub offset: usize,
    pub len: usize,
    pub raw: Vec<u8>,
    pub len_prefix: Option<Vec<u8>>,
    pub value: String,            // 去补位后的值；b 型为大写 HEX
    pub parts: Vec<Part>,         // 子段拆解：报文头子段、MTI 四位、TLV、60 域子域
}
```

**「含义」文案不放在 Rust 里**：比如「05 = IC 卡插卡」「MTI 第 2 位 2 = 金融类」。它们是面向界面的中文说明，放在前端 `src/explain/`，用数据表驱动，以后做多语言也方便。Rust 只负责「切分」，不负责「翻译」。

### 4.4 WASM 接口（`iso8583-wasm`）

```rust
#[wasm_bindgen] pub fn decode(hex: &str, spec_json: &str) -> Result<JsValue, JsError>;
#[wasm_bindgen] pub fn encode(message_json: &str, spec_json: &str) -> Result<String, JsError>;
#[wasm_bindgen] pub fn preset(name: &str) -> Result<String, JsError>;   // "cup_pos"
```

- 数据转换用 `serde-wasm-bindgen`。
- Rust 类型用 `ts-rs` 或 `tsify` 自动生成 `src/codec/types.ts`，CI 检查生成结果没有漂移。
- 规范在前端解析一次后缓存；WASM 内部按规范的哈希值缓存反序列化结果，避免每次解析都重新反序列化。

### 4.5 JSON 报文格式（对外契约）

```json
{
  "length": "208",
  "tpdu": "6000030000",
  "header": "603100000000",
  "mti": "0200",
  "bitmap": "7024…",
  "fields": { "2": "6222021234567890123", "3": "000000", "55": "9F2608…" }
}
```

这个格式是复制、保存、导入时的公共契约，变更时必须保持向后兼容。键顺序与报文字节顺序一致；`length`、`bitmap` 只在解析结果里展示，组包时由规范和 `fields` 重新生成，传入的值会被忽略。

---

## 5. 前端架构

### 5.1 状态管理（Pinia）

| Store | 状态 | 关键动作 |
|---|---|---|
| `message` | `hex` · `json` · `decoded` · `error` · `selectedId` · `hoverId` | `parse()` · `pack()` · `select(id)` · `loadSample(key)` |
| `spec` | `entries[]`（内置预设 + 自定义，持久化） · `currentId` · `draft`（编辑中副本） · `dirty` · `draftProblems` | `edit()` · `apply()`（先校验） · `resetDraftToPreset()` · `create()` · `remove()` · `importJson()` · `exportJson()` |
| `history` | `items[]`（最多 50 条） | `push()` · `remove()` · `clear()`，通过 `platform.storage` 持久化 |
| `ui` | `menuOpen` · `drawer` · `specDialog` · `modal` · `layout` | 纯 UI 状态，不持久化（`layout` 除外） |

**选中段只有一个来源**：`message.selectedId`。报文结构色块、逐段解析表、位图、详情面板都从它派生，点任何一处都只调用 `select(id)`。这样从结构上保证四处联动不会不同步。

**规范编辑用草稿**：在域定义面板里修改的是 `spec.draft`；点「完成并重新解析」时才写回当前规范，并触发 `message.parse()`。对应原型里「● 有未应用的修改」的提示。

**规范校验只有一份**：`Spec::validate()` 在 Rust 核心里实现（子段位数、LLVAR / LLLVAR 上限、b 型定长须为 8 的倍数、TLV 只用于 b 型等），通过 WASM 的 `validateSpec` 暴露给前端；草稿实时校验、应用前和导入前都调用它。

### 5.2 命令注册表（`src/commands`）

原型里菜单、工具栏、快捷键列表是三份重复定义；正式版合并为一份：

```ts
export interface Command {
  id: string                      // 'message.parse'
  label: string                   // '解析 8583 → JSON'
  icon: string                    // PrimeIcons 或自定义 SVG
  shortcut?: string               // 'CmdOrCtrl+Enter'
  group: 'file' | 'edit' | 'view' | 'spec' | 'help'
  when?: () => boolean            // 是否可用
  checked?: () => boolean         // 视图类的勾选状态
  run: () => void | Promise<void>
}
```

- **工具栏**：挑出常用的几条渲染成按钮。
- **桌面原生菜单**：前端用 `@tauri-apps/api/menu` 按 `group` 生成并设为应用菜单（`src/platform/tauri.ts`），菜单项直接调用同一个 `run`，Rust 侧不重复定义菜单。
- **Web 端**：工具栏右侧「⋯ 更多」菜单渲染同一份列表。
- **快捷键列表弹窗**：直接从注册表生成。
- **快捷键**：桌面端由原生菜单注册；Web 端在页面内监听，用同一份 `shortcut` 定义。

### 5.3 组件与 PrimeVue 选型

| 原型模块 | 组件 | PrimeVue / 其他 |
|---|---|---|
| 工具栏 | `AppToolbar` | `Toolbar` · `Button` · `Select` |
| 状态栏 | `StatusBar` | 自绘（Tailwind） |
| HEX / JSON 编辑器 | `CodeEditor`（`language` 区分） | **CodeMirror 6**，按需拆包加载：JSON 语法高亮和校验；HEX 非法字符标红、高亮选中段的字节、点击字节选中所在段 |
| 报文结构色块 | `StructureStrip` | 自绘 |
| 逐段解析表 | `SegmentTable` | 原生 `<table>` + Tailwind（选中态需要左侧竖条、徽标反白等细节，比定制 `DataTable` 更直接） |
| 位图 | `BitmapGrid` | 自绘（8 列网格） |
| 详情面板 | `SegmentDetail` | 自绘（逐位拆解、取值选项、TLV 列表） |
| 域定义 | `SpecDialog` · `SpecList` · `FrameSettings` · `FieldTable` · `FieldEditor` · `PartsEditor` · `ImportSpecDialog` | `Drawer`（全屏） · `InputText` · `Select` · `InputNumber` · `ConfirmDialog` · `Message` |
| 历史 | `HistoryDrawer` | `Drawer` |
| 关于、快捷键、字段速查 | `*Dialog` | `Dialog` |

授权：PrimeVue 从 5.x、PrimeIcons 从 8.x 起改为需要 License Key 的 PrimeUI 授权，因此固定使用 MIT 协议的 PrimeVue 4.5.5 与 PrimeIcons 7.x，升级前必须先确认授权。

样式方面：PrimeVue 用 styled 模式加 Aura 预设，主题色映射到原型的主色 `#1F6FEB`；开启 `cssLayer`，层顺序放在 Tailwind utilities 之前，这样工具类可以覆盖组件样式；引入 `tailwindcss-primeui` 使用 `bg-primary`、`text-surface-*` 等语义色。

### 5.4 平台适配层（`src/platform`）

```ts
export interface Platform {
  readonly kind: 'web' | 'desktop'
  openFile(accept: string[]): Promise<{ name: string; bytes: Uint8Array } | null>
  saveFile(name: string, data: Uint8Array | string): Promise<boolean>
  copy(text: string): Promise<void>
  storage: KeyValueStore           // get / set / delete，异步
  onMenu(handler: (commandId: string) => void): void   // Web 端为空实现
}
```

| 能力 | 桌面（Tauri 2） | Web |
|---|---|---|
| 打开文件 | `tauri-plugin-dialog` + `tauri-plugin-fs` | `<input type="file">`；Chromium 内核浏览器可用 File System Access API |
| 保存文件 | 原生保存对话框 | 生成 Blob 后触发下载 |
| 存储 | `tauri-plugin-store` | IndexedDB |
| 剪贴板 | `tauri-plugin-clipboard-manager` | `navigator.clipboard`（需要 HTTPS） |
| 菜单 | 原生菜单 → 事件 | 页面内「更多」菜单 |
| 窗口状态 | `tauri-plugin-window-state` | 无 |
| 自动更新 | `tauri-plugin-updater` | 不需要（刷新即更新） |

`index.ts` 用 `isTauri()`（`@tauri-apps/api/core`）判断运行环境，再**动态 import** 对应实现，保证 Web 构建里不打包任何 Tauri 插件代码。

---

## 6. 关键数据流

**解析（8583 → JSON）**

```
工具栏 / 菜单 / 快捷键
  → commands['message.parse'].run()
  → messageStore.parse()
      → codec.decode(hex, specStore.current)      // WASM，同步，毫秒级
      → decoded（含 segments 与偏移）
      → json = toJson(decoded)
      → historyStore.push(...)                    // 经 platform.storage 持久化
  → 组件响应式刷新；状态栏显示「解析成功 · 210 字节 · 18 个数据域」
```

**选中联动**

```
点击 表格行 / 结构色块 / 位图格子
  → messageStore.select(id)
  → 四个视图通过 computed 派生高亮和详情（同一个 selectedId）
```

**规范修改**

```
SpecDialog 编辑 → specStore.draft 改变（dirty = true）
  → 「完成并重新解析」 → specStore.apply() → messageStore.parse()
```

---

## 7. 桌面端（`src-tauri`）

- Rust 侧只做**原生能力**：窗口、插件注册、更新；原生菜单由前端根据命令注册表生成。编解码不走 Tauri command，直接在前端跑 WASM，保证双端行为一致。
- 以后需要批量解析大文件、或联机 TCP 发送时，再在 `src-tauri` 里直接依赖 `iso8583-core` 加 command，不影响现有结构。
- `capabilities/default.json` 只授予必需权限：dialog 的打开和保存、限定作用域的 fs 读写、store、clipboard 写入、updater。
- 窗口标题栏使用**系统原生**的，不自绘。
- **拖入文件由 Rust 读取**：`on_window_event` 收到 `DragDrop::Drop` 后只读取这次拖入的路径（上限 1 MB），以 `file-dropped` 事件发给前端。前端因此不需要文件系统读权限，打开文件只经过系统对话框。
- **「退出」是自定义菜单项**：系统预置的 Quit 在 Linux 上不受支持（显示为禁用），改为调用 `getCurrentWindow().close()`，需要 `core:window:allow-close` 权限。
- 版本号只在 `package.json` 维护：Vite 构建时注入 `__APP_VERSION__`，`tauri.conf.json` 的 `version` 指向 `../package.json`。

## 8. Web 端

- 产物是纯静态文件（`dist/`），可以部署到 Nginx、对象存储或 CDN，**没有后端**。
- 线上部署选用 **Cloudflare Workers 静态资源**：推送到 `master` 后由 GitHub Actions（`.github/workflows/deploy-web.yml`）构建并执行 `wrangler deploy`，自定义域名 `8583.probiecoder.cn`；配置见 `wrangler.jsonc`，响应头见 `public/_headers`。
- 服务器需要把 `.wasm` 配置为 `application/wasm`，并启用 HTTPS（剪贴板 API 要求）。
- 配置 CSP：只允许本域脚本和 `wasm-unsafe-eval`，禁止外连，从机制上保证报文不会被发送出去。
- 不支持的能力（原生菜单、文件系统直写）在 UI 上隐藏或降级，不显示无法使用的按钮。

---

## 9. 构建、测试与 CI

### 9.1 脚本

| 命令 | 作用 |
|---|---|
| `pnpm wasm` | `wasm-pack build crates/iso8583-wasm --target web`，输出到 `src/codec/pkg` |
| `pnpm dev` | 先构建 WASM，再启动 Vite 开发服务器（Web） |
| `pnpm tauri dev` | 桌面开发模式 |
| `pnpm build:web` | 生成 `dist/`，用于 Web 部署 |
| `pnpm build:desktop` | `tauri build`，生成各平台安装包 |
| `pnpm gen:types` | 从 Rust 生成 `src/codec/types.ts` |
| `pnpm test:e2e` | Playwright 端到端测试，自动启动开发服务器（需先 `pnpm wasm`） |

### 9.2 测试分层

| 层 | 工具 | 覆盖内容 |
|---|---|---|
| Rust 单元 | `cargo test` | 各编码方式、补位、定长 / LL / LLL、位图、TLV、错误偏移 |
| 随机往返测试 | 固定种子的伪随机生成 | 按规范随机生成 500 条合法报文：encode → decode 必须还原；随机字节输入绝不 panic |
| 黄金样例 | `src/samples/*.json` + 对应 HEX | Rust 和前端**共用同一批样例**，保证两端结果一致；原型里的 11 个示例直接作为第一批 |
| 前端单元 | Vitest | stores、explain 文案、平台适配层（mock） |
| 端到端 | Playwright（`e2e/`，Web 版） | 载入示例 → 解析 → 选中联动 → 页面滚动定位 → 修改规范 → 组包 → 历史 → 快捷键 → 打开 / 拖入文件；每个用例结束时页面不得有报错 |
| 桌面端到端 | tauri-driver + WebKitWebDriver（Linux） | 真实 Tauri 应用里解析、选中联动、历史经 tauri-plugin-store 重启后仍在 |

### 9.3 CI（GitHub Actions）

1. `cargo fmt --check` · `cargo clippy` · `cargo test`
2. `pnpm gen:types` 后检查没有未提交的差异
3. `pnpm wasm` · `vue-tsc --noEmit` · `vitest` · `pnpm build:web` · Playwright
4. 在 Windows、macOS、Linux 三平台矩阵上执行 `tauri build`；打 tag 时上传安装包并生成更新清单

---

## 10. 安全

- 报文只在本机内存里处理；历史记录只存本机，提供一键清空。
- 不接入任何远程日志或统计。
- Web 端用 CSP 禁止外连；桌面端用 Tauri capabilities 限定权限。
- 示例报文全部是虚构的测试数据。

---

## 11. 里程碑

| 阶段 | 内容 | 完成标准 |
|---|---|---|
| M1 编解码核心 | `iso8583-core` + 银联 POS 预设 + 测试 | 11 个黄金样例往返通过，错误带偏移 |
| M2 WASM 与转换页 | `iso8583-wasm` + 转换页（编辑器、结构色块、逐段解析表、位图、详情） | Web 版可用，四处选中联动 |
| M3 规范与历史 | 域定义弹窗、规范导入导出、历史抽屉 | 改规范后重新解析生效，历史持久化 |
| M4 桌面壳 | Tauri 原生菜单、命令注册表、文件打开保存、窗口状态 | 三平台可安装运行 |
| M5 发布 | 签名、自动更新、Web 部署配置 | 打 tag 自动产出安装包和 Web 产物 |

---

## 12. 待确认事项

1. 编解码核心采用 **Rust → WASM**（本文推荐），还是纯 TypeScript 实现？
2. 包管理器默认用 **pnpm**，是否有团队约定？
3. 第一版是否需要开放「位图编码 / 长度前缀编码 / 报文头子段」的可视化配置，还是只在规范 JSON 里支持？
4. Web 版的部署位置（内网 / 公网）会影响 CSP 和 HTTPS 方案。
