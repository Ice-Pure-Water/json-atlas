# JSON Atlas

[Live demo](https://ice-pure-water.github.io/json-atlas/) · [English](#json-atlas) · [简体中文](#中文文档) · [GitHub](https://github.com/Ice-Pure-Water/json-atlas) · [MIT License](LICENSE)

JSON Atlas is a free, open-source data workbench for inspecting, formatting, comparing, and converting structured data. It runs in the browser and does not require an account. Parsing and editing stay on the device; the project has no upload, cloud-save, or sharing service.

## Features

- **Input formats:** JSON, JSONL, NDJSON, YAML, TOML, CSV, and JSON values embedded in mixed log text.
- **Nested JSON expansion:** recursively expands strings containing a complete JSON object or array, up to a configurable depth. Text that merely contains braces stays text.
- **Lossless JSON numbers:** preserves the original spelling of large and high precision JSON numbers during parsing and JSON output.
- **Linked views:** inspect the same parsed document in a relationship graph, tree, or recursive table. The graph and editable path panel appear together; the source pane keeps the editable original input above the editable formatted content.
- **Document comparison:** edit two documents side by side and view their merged structure with additions, removals, and changes highlighted. Scrolling is synchronized.
- **Conversion:** format or compact JSON, sort object keys, and export JSON, JSONL, YAML, TOML, CSV, or TypeScript types where the target format supports the data.
- **Appearance:** system, light, and dark themes. The selected theme is shared by the landing page and workbench.
- **Local document tabs:** keep multiple working documents open in the current browser tab. Documents are held in page memory and are not persisted across reloads.

## Quick start

Requirements: Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Open the URL printed by Vite. The root route is the introduction page; open `/workspace.html` for the data workbench.

```sh
npm test       # core parsing, expansion, conversion, and diff tests
npm run format:check # formatting check
npm run build  # production build
npm run preview # serve the production build locally
```

The static files in `dist/` can be deployed to any static host. The host serves the application files; it does not receive document contents through application requests.

The public demo is hosted on GitHub Pages: <https://ice-pure-water.github.io/json-atlas/>. Every push to `main` builds and deploys `dist/` through the `Deploy GitHub Pages` workflow. The build uses relative asset paths so both the landing page and `/workspace.html` work under the repository subpath.

## Using the workbench

1. Paste data into the editor, load the example, or import a local file. Imported file extensions select the input format.
2. The editor formats valid input automatically. Choose another format in the format selector to convert the current document where conversion is supported.
3. Switch among graph, tree, and table using the result-pane tabs. The graph supports horizontal and vertical layouts; edit primitive values and object keys in place, click a nested value to open its card, and click that card's header to return to its parent. Graph and path edits update both source editors.
4. Select **比较** to compare another document. On first open, the current document is copied into the comparison editor as a starting point; replace or edit it to see differences. It follows the current document's format. The third pane displays the merged result and highlights changes; scrolling across all three panes stays synchronized. Select **返回查看** in the same toolbar location to leave comparison mode.
5. Select **转换** for compact JSON, sorted JSON, CSV, YAML, TOML, or TypeScript output.

The original input editor preserves the entered or imported text and remains editable. Valid changes are automatically parsed into the formatted editor after a short pause; the formatted editor can also be edited independently. Clearing a document clears both editors. The two editors are vertically resizable, and the original-input pane can be collapsed.

## Supported format behavior

| Format         | Input           | Output | Notes                                                                                                                                         |
| -------------- | --------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| JSON           | Yes             | Yes    | Uses `lossless-json`; large and high precision number tokens are preserved in JSON output.                                                    |
| JSONL / NDJSON | Yes             | Yes    | Each non-empty line is parsed as one JSON value. Output writes array items as separate lines.                                                 |
| YAML           | Yes             | Yes    | YAML scalar and tag semantics follow the `yaml` library.                                                                                      |
| TOML           | Yes             | Yes    | TOML has no `null` value and imposes restrictions on valid root values and keys; unsupported values are reported instead of silently omitted. |
| CSV            | Yes             | Yes    | Input cells remain strings. Output expects tabular records; nested structures and scalar arrays are flattened or represented as cell text.    |
| Mixed log      | JSON extraction | JSON   | Extracts complete JSON objects and arrays from surrounding text and includes their one-based source offset.                                   |

Nested expansion applies after parsing. It only expands a string when its trimmed contents are one complete JSON object or array. It does not parse brace-like text, partial JSON, or JSON scalar strings.

## Project structure

```text
src/
  core.js             Parsing, lossless JSON model, expansion, serialization, flattening, diff
  main.js             Workbench browser entry point
  workbench/
    app.js            Workbench state, editors, views, import/export, and comparison UI
    shell.js          Workbench structure and controls
    data-views.js     Tree, table, path mapping, and path updates
    diff-renderer.js  Format-aware difference display
    formatting.js     Formatting, parsing, and format conversion
  graph.js            React Flow relationship graph and navigation
  landing.js          Introduction page and shared theme preference
  style.css           Shared base and component styles
  editor-shell.css    Workbench layout and theme styles
  graph.css           Relationship graph styles
  landing.css         Introduction page styles
  landing-theme.css   Introduction page theme variants
  vendor.css          Third-party editor overrides
test/
  core.test.js        Node test suite for the data core
docs/
  ARCHITECTURE.md     Data flow and module responsibilities
  FORMATS.md          Format behavior and conversion limits
PRIVACY.md            Local processing and hosting boundary
.github/
  workflows/ci.yml    Formatting, test, and build checks on pull requests
  ISSUE_TEMPLATE/     Bug and feature request forms
```

The application uses `lossless-json` for JSON number preservation, CodeMirror for source editing, `vanilla-jsoneditor` for tree/source display, Tabulator for the recursive table, React Flow for the graph, `yaml` for YAML, `smol-toml` for TOML, and Papa Parse for CSV. The graph layout is implemented by this project; it does not depend on Dagre.

## Development and verification

```sh
npm test
npm run format:check
npm run build
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidance and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for community expectations. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for state and rendering details, [docs/FORMATS.md](docs/FORMATS.md) for parsing and conversion semantics, and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for dependency licenses. Security reports, privacy details, and support instructions are in [SECURITY.md](SECURITY.md), [PRIVACY.md](PRIVACY.md), and [SUPPORT.md](SUPPORT.md).

## License

MIT. See [LICENSE](LICENSE).

---

## 中文文档

JSON Atlas 是免费的开源结构化数据工作台，用于查看、整理、比较和转换结构化数据。应用运行在浏览器中，无需账号。解析和编辑在本机完成；项目不提供数据上传、云端保存或分享服务。

### 功能

- **输入格式：** JSON、JSONL、NDJSON、YAML、TOML、CSV，以及混合日志中的 JSON 数据提取。
- **嵌套 JSON 展开：** 递归展开完整 JSON 对象或数组字符串，最大深度可调整。普通文本中仅包含花括号时会保留原文。
- **精确保留 JSON 数字：** 解析和 JSON 导出时保留大整数及高精度数字的原始文本，避免 JavaScript 数值精度损失。
- **多种联动视图：** 在关系图、树形和递归表格间切换。关系图与可编辑路径上下联动；左侧源码区上方是可编辑原始输入，下方是可编辑格式化内容。
- **文档比较：** 并排编辑两份文档，在融合结果中标记新增、删除和修改；三个区域支持滚动同步。
- **格式转换：** 格式化或压缩 JSON、排序对象键，并按目标格式能力导出 JSON、JSONL、YAML、TOML、CSV 或 TypeScript 类型。
- **三种主题：** 跟随系统、浅色和深色。主页和工作台共用主题设置。
- **多文档标签：** 在当前浏览器页面中打开多个工作文档。文档内容仅保存在页面内存中，刷新后不会保留。

### 快速开始

需要 Node.js 20.19+ 或 22.12+。

```sh
npm install
npm run dev
```

打开 Vite 输出的本地地址。根路径为产品介绍页，数据处理工作台位于 `workspace.html`。在线版本通过 [GitHub Pages](https://ice-pure-water.github.io/json-atlas/) 访问；每次推送到 `main` 都会自动构建并部署 `dist/`。

```sh
npm test       # 核心解析、展开、转换和比较测试
npm run build  # 生产构建
npm run preview # 本地预览生产构建
```

`dist/` 中的静态文件可以部署到任意静态网站托管服务。托管服务负责提供应用文件，应用不会通过请求上传文档内容。

公开体验网址：<https://ice-pure-water.github.io/json-atlas/>。构建采用相对资源路径，因此项目站点部署在仓库子路径下时，主页和 `workspace.html` 仍可正常访问。

### 工作台使用方法

1. 在编辑器粘贴数据、载入示例或导入本地文件。导入时根据文件扩展名选择输入格式。
2. 有效输入会自动格式化。也可以在格式选择器中选择其他格式，对当前文档进行支持范围内的转换。
3. 在关系图、树形和表格间切换。关系图与路径面板上下同步展示，支持横向和纵向布局；可直接修改图卡或路径中的字段名和值。点击嵌套值进入下级卡片，点击卡片表头返回父级；修改会同步到两个源码编辑区和其他视图。
4. 点击**比较**对照另一份文档。首次打开时，会将当前文档复制到对比编辑区作为起点；随后可直接替换或修改内容查看差异。对比格式跟随当前文档。第三个区域显示融合结果并标出差异；三个区域支持滚动同步。点击同一位置的**返回查看**回到之前的数据视图。
5. 点击**转换**，可生成压缩 JSON、键排序后的 JSON、CSV、YAML、TOML 或 TypeScript 类型。

左侧源码区上方是可编辑的原始输入，下方是可编辑的格式化内容。原始输入会保留录入或导入的文本；有效内容修改后会自动解析并更新格式化内容。两个区域可拖动调整高度，原始输入也可折叠。清空文档会同时清除两个编辑区。

### 格式支持与行为

| 格式           | 输入      | 输出 | 说明                                                                                           |
| -------------- | --------- | ---- | ---------------------------------------------------------------------------------------------- |
| JSON           | 支持      | 支持 | 使用 `lossless-json`；JSON 输出保留大整数和高精度数字原文。                                    |
| JSONL / NDJSON | 支持      | 支持 | 每个非空行解析为一个 JSON 值；数组输出时每个元素占一行。                                       |
| YAML           | 支持      | 支持 | 标量和标签语义遵循 `yaml` 库。                                                                 |
| TOML           | 支持      | 支持 | TOML 不支持 `null`，且根节点和值有格式限制；无法表示的数据会报错，不会静默丢弃。               |
| CSV            | 支持      | 支持 | 导入的单元格都保留为字符串。导出面向表格记录；嵌套数据或标量数组会被扁平化或转换为单元格文本。 |
| 混合日志       | 提取 JSON | JSON | 从周围文本提取完整 JSON 对象和数组，并记录从 1 开始的字符位置。                                |

嵌套展开在解析后进行。只有去除首尾空白后恰好是一个完整 JSON 对象或数组的字符串才会展开；包含花括号的普通文本、不完整 JSON 和 JSON 标量字符串都不会展开。

### 项目结构

```text
src/
  core.js             解析、无损 JSON 数据模型、嵌套展开、序列化、扁平化和差异计算
  main.js             工作台浏览器入口
  shared/theme.js     主页与工作台共用的主题偏好控制器
  workbench/
    app.js            工作台状态编排、编辑器接线、导入导出和交互
    shell.js          工作台结构与控件标记
    data-views.js     树、表格、路径视图的数据映射与路径值更新
    diff-renderer.js  按文档格式生成差异视图
    formatting.js     文档格式化、解析与格式转换
  landing/
    shell.js          主页结构与产品介绍内容
  graph.js            React Flow 关系图和节点导航
  landing.js          主页浏览器入口
  style.css           共享基础与组件样式
  editor-shell.css    工作台布局和主题样式
  graph.css           关系图样式
  landing.css         产品介绍页样式
  landing-theme.css   产品介绍页主题样式
  vendor.css          第三方编辑器样式覆盖
test/
  core.test.js        数据核心的 Node 测试
docs/
  ARCHITECTURE.md     数据流和模块职责
  FORMATS.md          格式行为和转换限制
PRIVACY.md            本地处理及托管边界
.github/
  workflows/ci.yml    PR 格式、测试和构建检查
  ISSUE_TEMPLATE/     问题反馈与功能建议模板
```

项目使用 `lossless-json` 保留 JSON 数字原文，使用 CodeMirror 编辑源码、`vanilla-jsoneditor` 展示树和源码、Tabulator 展示递归表格、React Flow 绘制关系图，并使用 `yaml`、`smol-toml` 和 Papa Parse 处理 YAML、TOML 和 CSV。关系图布局由本项目实现，不依赖 Dagre。

### 开发和验证

```sh
npm run format:check
npm test
npm run build
```

贡献规范见 [CONTRIBUTING.md](CONTRIBUTING.md)，社区行为准则见 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。应用状态和渲染流程见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)，格式解析和转换语义见 [docs/FORMATS.md](docs/FORMATS.md)，依赖许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。安全报告、隐私说明和使用帮助分别见 [SECURITY.md](SECURITY.md)、[PRIVACY.md](PRIVACY.md) 与 [SUPPORT.md](SUPPORT.md)。

### 许可证

MIT，详见 [LICENSE](LICENSE)。
