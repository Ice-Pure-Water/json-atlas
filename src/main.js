import {
  diffNodes,
  expandNested,
  flatten,
  parseInput,
  serializeNode,
  stringify,
  toPlain,
} from './core.js';
import { stringify as stringifyToml } from 'smol-toml';
import YAML from 'yaml';
import Papa from 'papaparse';
import * as LosslessJSON from 'lossless-json';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import 'tabulator-tables/dist/css/tabulator.min.css';
import { basicSetup } from 'codemirror';
import { json } from '@codemirror/lang-json';
import { yaml } from '@codemirror/lang-yaml';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';
import { mountGraph } from './graph.js';
import './style.css';
import './editor-shell.css';
import './vendor.css';

const innerPreferences = JSON.stringify({ 颜色: '蓝色', 通知: true });
const innerConfig = JSON.stringify({ 地址: '苏州', 偏好: innerPreferences });
const sample = `{
  "用户id": 8000000000000000001,
  "配置": ${JSON.stringify(innerConfig)},
  "备注": "普通备注 {随便写，不解析}",
  "过期时间": "2026-12-31 23:59:59"
}`;

const $ = (selector) => document.querySelector(selector);
const state = {
  root: null,
  shown: null,
  format: 'json',
  mode: 'graph',
  graphDirection: 'LR',
  lastDataMode: 'graph',
  selected: '$',
  query: '',
  expand: true,
  compare: false,
  documents: [
    {
      id: 1,
      name: 'untitled.json',
      text: '',
      originalText: '',
      originalFormat: 'json',
      format: 'json',
      compareText: '',
      compareOriginalText: '',
      compareName: 'comparison.json',
      compareFormat: 'json',
      compareFormatError: '',
      compareInitialized: false,
    },
  ],
  activeDocumentId: 1,
  nextDocumentId: 2,
};

$('#app').innerHTML = `
  <div class="editor-shell">
    <aside class="app-sidebar">
      <div class="sidebar-brand-row"><a class="brand" href="./" aria-label="JSON Atlas 首页"><span class="brand-mark">J</span><span>json<span class="brand-accent">atlas</span></span></a><a class="sidebar-home" href="./" title="介绍页">↗</a></div>
      <nav class="sidebar-nav" aria-label="工具">
        <button id="editor-view-toggle" class="sidebar-action active"><span class="nav-icon">✧</span>整理 JSON</button>
        <div class="sidebar-divider"></div>
        <button id="compare-toggle" class="sidebar-action"><span class="nav-icon">⇄</span>比较文档</button>
        <button id="convert-toggle" class="sidebar-action"><span class="nav-icon">⇆</span>转换格式</button>
      </nav>
      <div class="sidebar-bottom"><label class="theme-control">主题 <select id="theme-select" aria-label="选择主题"><option value="system">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option></select></label><label class="toggle"><input id="expand-toggle" type="checkbox" checked/><span class="switch"></span><span>展开嵌套 JSON</span></label><label class="depth-control">最大深度 <input id="depth" type="number" min="1" max="100" value="25"/></label><div class="sidebar-privacy"><i></i>仅在本机处理</div></div>
    </aside>
    <main class="app-main">
      <header class="work-toolbar">
        <div class="source-tools"><label class="format-wrap"><span class="format-glyph">{ }</span><select id="format"><option value="json">JSON</option><option value="jsonl">JSONL</option><option value="ndjson">NDJSON</option><option value="yaml">YAML</option><option value="toml">TOML</option><option value="csv">CSV</option><option value="log">混合日志</option></select></label></div>
        <div class="result-tools"><div class="view-tabs" role="tablist"><button data-mode="graph" class="active">⌘ 关系图</button><button data-mode="tree">树形</button><button data-mode="table">表格</button><button data-mode="columns">路径</button><button data-mode="source">格式化源码</button><button data-mode="original">原始源码</button></div><button id="graph-direction-toggle" class="graph-direction-toggle" type="button" title="切换为纵向布局" aria-label="切换为纵向布局">↕ <span>纵向</span></button><span class="result-status" id="status">等待输入</span></div>
      </header>
      <section class="workspace">
        <aside class="input-panel"><div class="editor-toolbar"><div class="file-label"><span class="file-dot"></span><span id="input-name">untitled.json</span></div><div class="toolbar-actions"><button id="load-sample" title="载入示例">示例</button><button id="open-file" title="导入当前文档">导入</button><button id="export-input" title="导出当前文档">导出</button><button id="clear-input" title="清空">清空</button><button id="format-input" title="整理为 JSON">格式化</button><input id="file-input" type="file" hidden accept=".json,.jsonl,.ndjson,.yaml,.yml,.toml,.csv,.log,.txt"/></div></div><div id="source" class="source-editor-host" aria-label="输入数据"></div><div class="editor-status"><span><b id="input-format-label">JSON</b><span id="input-bytes">等待输入</span></span></div></aside>
        <section class="compare-input-panel hidden" id="compare-input-panel"><div class="compare-pane-toolbar"><div><span class="file-dot"></span><strong id="compare-name">comparison.json</strong></div><div class="compare-file-actions"><button id="import-compare" title="导入对比文档">导入</button><button id="export-compare" title="导出对比文档">导出</button><button id="clear-compare" title="清空对比文档">清空</button><button id="format-compare" title="格式化对比文档">格式化</button><input id="compare-file-input" type="file" hidden accept=".json,.jsonl,.ndjson,.yaml,.yml,.toml,.csv,.log,.txt"/></div></div><div id="compare-source" class="source-editor-host" aria-label="对比文档"></div><div class="editor-status"><span><b id="compare-format-label">JSON</b><span id="compare-bytes">等待输入</span></span></div></section>
        <section class="result-panel"><div class="browser-toolbar"><div class="breadcrumbs" id="crumbs"><span class="crumb-root" data-path="$">$</span></div><div class="toolbar-actions"><input id="search" class="search" placeholder="⌕  搜索字段或路径"/><button id="copy-output" title="复制结果">复制</button><button id="download-output" title="导出展开结果">导出结果</button></div></div><div class="viewer" id="viewer"><div class="empty-state"><div class="empty-icon">⌘</div><strong>准备好探索你的数据</strong><span>在左侧粘贴数据，或载入示例开始。</span></div></div><div class="canvas-status"><span id="stats">—</span><span class="canvas-status-right"><i></i>本机处理</span></div></section>
      </section>
      <section id="convert-panel" class="utility-panel panel hidden"><div class="utility-head"><div><span class="step">03</span><strong>转换与整理</strong></div><button class="close-button" data-close="convert">×</button></div><div class="convert-actions"><button data-action="minify">压缩 JSON</button><button data-action="sort">按键排序</button><button data-action="csv">导出 CSV</button><button data-action="yaml">转为 YAML</button><button data-action="toml">转为 TOML</button><button data-action="types">生成 TypeScript 类型</button></div><textarea id="convert-output" class="convert-output" readonly placeholder="转换结果会显示在这里"></textarea><div class="utility-actions"><button id="copy-convert" class="button button-dark">复制结果</button><button id="download-convert" class="button button-quiet">下载结果</button></div></section>
      <div class="document-dock"><div class="document-tabs" id="document-tabs"></div><button class="dock-add" id="add-tab" title="新建文档">＋</button><a href="./" class="dock-home">JSON Atlas · 开源 · 本地优先</a></div>
    </main>
  </div>`;

const themeSelect = $('#theme-select');
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme(choice) {
  const dark = choice === 'dark' || (choice === 'system' && systemTheme.matches);
  document.body.classList.toggle('theme-dark', dark);
  document.body.dataset.theme = choice;
}
const savedTheme = localStorage.getItem('json-atlas-theme') || 'system';
themeSelect.value = savedTheme;
applyTheme(savedTheme);
themeSelect.addEventListener('change', () => {
  localStorage.setItem('json-atlas-theme', themeSelect.value);
  applyTheme(themeSelect.value);
});
systemTheme.addEventListener('change', () => {
  if (themeSelect.value === 'system') applyTheme('system');
});

const sourceHost = $('#source');
const sourceLanguage = new Compartment();
const sourceView = new EditorView({
  parent: sourceHost,
  state: EditorState.create({
    doc: '',
    extensions: [
      basicSetup,
      keymap.of([indentWithTab]),
      sourceLanguage.of(json()),
      EditorView.lineWrapping,
      placeholder('粘贴 JSON、YAML、TOML、CSV 或日志…'),
      EditorView.theme({
        '&': { height: '100%', fontSize: '12px', backgroundColor: '#fff', color: '#344238' },
        '.cm-scroller': { fontFamily: "'DM Mono','Noto Sans SC',monospace", lineHeight: '1.8' },
        '.cm-gutters': { backgroundColor: '#fff', border: 'none', color: '#a5aea1' },
        '.cm-activeLineGutter': { backgroundColor: '#f7f9f5' },
        '.cm-activeLine': { backgroundColor: '#fafbf9' },
        '.cm-content': { padding: '0' },
        '.cm-line': { paddingLeft: '16px' },
        '&.cm-focused': { outline: 'none' },
        '.cm-cursor': { borderLeftColor: '#718b61' },
        '.cm-selectionBackground, ::selection': { backgroundColor: '#eaf1e4' },
      }),
    ],
  }),
});
const source = {
  get value() {
    return sourceView.state.doc.toString();
  },
  set value(value) {
    sourceView.dispatch({
      changes: { from: 0, to: sourceView.state.doc.length, insert: String(value ?? '') },
    });
  },
  addEventListener(...args) {
    sourceView.dom.addEventListener(...args);
  },
};
const compareHost = $('#compare-source');
const compareLanguage = new Compartment();
const compareView = new EditorView({
  parent: compareHost,
  state: EditorState.create({
    doc: '',
    extensions: [
      basicSetup,
      keymap.of([indentWithTab]),
      compareLanguage.of(json()),
      EditorView.lineWrapping,
      placeholder('粘贴或导入要比较的数据…'),
      EditorView.theme({
        '&': { height: '100%', fontSize: '12px', backgroundColor: '#fff', color: '#344238' },
        '.cm-scroller': { fontFamily: "'DM Mono','Noto Sans SC',monospace", lineHeight: '1.8' },
        '.cm-gutters': { backgroundColor: '#fff', border: 'none', color: '#a5aea1' },
        '.cm-activeLineGutter': { backgroundColor: '#f7f9f5' },
        '.cm-activeLine': { backgroundColor: '#fafbf9' },
        '.cm-content': { padding: '0' },
        '.cm-line': { paddingLeft: '16px' },
        '&.cm-focused': { outline: 'none' },
        '.cm-cursor': { borderLeftColor: '#718b61' },
        '.cm-selectionBackground, ::selection': { backgroundColor: '#eaf1e4' },
      }),
    ],
  }),
});
const comparisonSource = {
  get value() {
    return compareView.state.doc.toString();
  },
  set value(value) {
    compareView.dispatch({
      changes: { from: 0, to: compareView.state.doc.length, insert: String(value ?? '') },
    });
  },
};
function setSourceLanguage(format = state.format) {
  sourceView.dispatch({
    effects: sourceLanguage.reconfigure(
      format === 'yaml' ? yaml() : format === 'json' || format === 'jsonl' ? json() : [],
    ),
  });
}
function setCompareLanguage(format = 'json') {
  compareView.dispatch({
    effects: compareLanguage.reconfigure(
      format === 'yaml' ? yaml() : format === 'json' || format === 'jsonl' ? json() : [],
    ),
  });
}
function createCodeEditor(parent, text, format = 'json', readOnly = false) {
  const language =
    format === 'yaml' ? yaml() : format === 'json' || format === 'jsonl' ? json() : [];
  return new EditorView({
    parent,
    state: EditorState.create({
      doc: text,
      extensions: [
        basicSetup,
        keymap.of([indentWithTab]),
        language,
        EditorView.lineWrapping,
        ...(readOnly ? [EditorState.readOnly.of(true), EditorView.editable.of(false)] : []),
        EditorView.theme({
          '&': { height: '100%', fontSize: '12px', backgroundColor: '#fff', color: '#344238' },
          '.cm-scroller': { fontFamily: "'DM Mono','Noto Sans SC',monospace", lineHeight: '1.8' },
          '.cm-gutters': { backgroundColor: '#fff', border: 'none', color: '#a5aea1' },
          '.cm-activeLineGutter': { backgroundColor: '#f7f9f5' },
          '.cm-activeLine': { backgroundColor: '#fafbf9' },
          '.cm-content': { padding: '0' },
          '.cm-line': { paddingLeft: '16px' },
          '&.cm-focused': { outline: 'none' },
          '.cm-cursor': { borderLeftColor: '#718b61' },
          '.cm-selectionBackground, ::selection': { backgroundColor: '#eaf1e4' },
        }),
      ],
    }),
  });
}
const viewer = $('#viewer');
const workspace = $('.workspace');
const compareInputPanel = $('#compare-input-panel');
let jsonEditor = null;
let resultCodeView = null;
let dataTable = null;
let graphCleanup = null;
let editorModulePromise;
const formatLabel = (format) =>
  ({ jsonl: 'JSONL', ndjson: 'NDJSON', yaml: 'YAML', toml: 'TOML', csv: 'CSV', log: 'LOG' })[
    format
  ] ?? 'JSON';
function renderDocumentTabs() {
  $('#document-tabs').innerHTML = state.documents
    .map(
      (document) =>
        `<button class="document-tab ${document.id === state.activeDocumentId ? 'active' : ''}" data-document="${document.id}" title="${escapeHtml(document.name)}"><span>{ }</span><span class="document-name">${escapeHtml(document.name.replace(/\.[^.]+$/, ''))}</span><span class="doc-close" data-close-document="${document.id}" aria-label="关闭文档">×</span></button>`,
    )
    .join('');
}
function syncActiveDocument() {
  const document = state.documents.find((item) => item.id === state.activeDocumentId);
  if (!document) return;
  document.text = source.value;
  document.name = $('#input-name').textContent;
  document.format = state.format;
  document.compareText = comparisonSource.value;
  const compareName = $('#compare-name')?.textContent;
  if (compareName) document.compareName = compareName;
  if (!document.compareText.trim()) document.compareFormat = state.format;
  renderDocumentTabs();
}
function resetResultView() {
  jsonEditor?.destroy();
  jsonEditor = null;
  resultCodeView?.destroy();
  resultCodeView = null;
  dataTable?.destroy();
  dataTable = null;
  graphCleanup?.();
  graphCleanup = null;
  viewer.innerHTML =
    '<div class="empty-state"><div class="empty-icon">⌘</div><strong>准备好探索你的数据</strong><span>在左侧粘贴数据，或载入示例开始。</span></div>';
  viewer.className = `viewer mode-${state.mode}`;
  state.root = state.shown = null;
  $('#status').textContent = '等待输入';
  $('#stats').textContent = '—';
  $('#input-bytes').textContent = '等待输入';
}
function switchDocument(id) {
  if (id === state.activeDocumentId) return;
  clearTimeout(sourceAutoFormatTimer);
  clearTimeout(compareAutoFormatTimer);
  clearTimeout(originalTextTimer);
  clearTimeout(compareOriginalTextTimer);
  clearTimeout(originalFormatTimer);
  syncActiveDocument();
  const next = state.documents.find((item) => item.id === id);
  if (!next) return;
  state.activeDocumentId = id;
  state.format = next.format;
  state.root = state.shown = null;
  state.selected = '$';
  source.value = next.text;
  $('#input-name').textContent = next.name;
  $('#format').value = next.format;
  comparisonSource.value = next.compareText ?? '';
  $('#compare-name').textContent = next.compareName ?? 'comparison.json';
  setCompareLanguage(next.format);
  $('#compare-format-label').textContent = formatLabel(next.format);
  $('#input-format-label').textContent = formatLabel(next.format);
  setSourceLanguage(next.format);
  renderDocumentTabs();
  if (next.text.trim()) parseAndRender();
  else if (state.mode === 'compare') render();
  else resetResultView();
}
function addDocument() {
  syncActiveDocument();
  const id = state.nextDocumentId++;
  state.documents.push({
    id,
    name: `untitled-${id}.json`,
    text: '',
    originalText: '',
    originalFormat: 'json',
    format: 'json',
    compareText: '',
    compareOriginalText: '',
    compareName: 'comparison.json',
    compareFormat: 'json',
    compareFormatError: '',
    compareInitialized: false,
  });
  switchDocument(id);
}
function closeDocument(id) {
  if (state.documents.length === 1) {
    if (id === state.activeDocumentId) clearDocument();
    return;
  }
  const index = state.documents.findIndex((item) => item.id === id);
  if (index < 0) return;
  const wasActive = id === state.activeDocumentId;
  state.documents.splice(index, 1);
  if (wasActive) {
    const next = state.documents[Math.min(index, state.documents.length - 1)];
    switchDocument(next.id);
  } else renderDocumentTabs();
}
$('#document-tabs').addEventListener('click', (event) => {
  const close = event.target.closest('[data-close-document]');
  if (close) {
    event.stopPropagation();
    closeDocument(Number(close.dataset.closeDocument));
    return;
  }
  const tab = event.target.closest('[data-document]');
  if (tab) switchDocument(Number(tab.dataset.document));
});
$('#add-tab').addEventListener('click', addDocument);
renderDocumentTabs();
const losslessParser = {
  parse: (text) => LosslessJSON.parse(text),
  stringify: (value, replacer, space) => LosslessJSON.stringify(value, replacer, space),
};
function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
}
function typeName(node) {
  return node.type === 'object'
    ? '对象'
    : node.type === 'array'
      ? '数组'
      : node.type === 'null'
        ? 'null'
        : node.type === 'number'
          ? '数字'
          : node.type === 'boolean'
            ? '布尔值'
            : '字符串';
}
function valueText(node) {
  if (node.type === 'string') return JSON.stringify(node.value);
  if (node.type === 'number') return node.raw;
  if (node.type === 'null') return 'null';
  return String(node.value);
}
function children(node) {
  return node.type === 'object'
    ? node.entries.map(({ key, value }) => [key, value])
    : node.type === 'array'
      ? node.items.map((value, index) => [String(index), value])
      : [];
}
function countNodes(node) {
  return 1 + children(node).reduce((sum, [, child]) => sum + countNodes(child), 0);
}
function findPath(node, path, current = '$') {
  if (current === path) return node;
  for (const [key, child] of children(node)) {
    const next = node.type === 'array' ? `${current}[${key}]` : `${current}.${key}`;
    const found = findPath(child, path, next);
    if (found) return found;
  }
  return null;
}
function matchesQuery(node, path, label) {
  return (
    `${label} ${valueText(node)} ${path}`.toLowerCase().includes(state.query.toLowerCase()) ||
    children(node).some(([key, child]) => matchesQuery(child, `${path}.${key}`, key))
  );
}
function renderColumns(node, path = '$', depth = 0) {
  const chain =
    path === '$'
      ? []
      : path
          .replace(/^\$\.?/, '')
          .replace(/\[(\d+)\]/g, '.$1')
          .split('.');
  let cursor = state.shown;
  let current = '$';
  const cols = [];
  for (let level = 0; level <= chain.length; level += 1) {
    const entries = children(cursor).filter(
      ([key, child]) => !state.query || matchesQuery(child, `${current}.${key}`, key),
    );
    cols.push(
      `<div class="path-column">${
        entries
          .map(([key, child]) => {
            const childPath = cursor.type === 'array' ? `${current}[${key}]` : `${current}.${key}`;
            const active = childPath === path;
            return `<button class="path-item ${active ? 'selected' : ''}" data-path="${escapeHtml(childPath)}"><span>${escapeHtml(key)}</span><small>${escapeHtml(child.type === 'object' ? `{${children(child).length}}` : child.type === 'array' ? `[${children(child).length}]` : valueText(child))}</small>${children(child).length ? '<b>›</b>' : ''}</button>`;
          })
          .join('') || '<span class="column-empty">没有子字段</span>'
      }</div>`,
    );
    const next = entries.find(([key]) => key === chain[level]);
    if (!next) break;
    current = cursor.type === 'array' ? `${current}[${next[0]}]` : `${current}.${next[0]}`;
    cursor = next[1];
  }
  return `<div class="columns-view">${cols.join('')}</div>`;
}
function toTableRows(node, path = '$', label = '$') {
  const kids = children(node);
  const value = kids.length
    ? `${node.type === 'object' ? '对象' : '数组'} · ${kids.length} 项`
    : valueText(node);
  const ownMatch =
    !state.query ||
    `${label} ${path} ${typeName(node)} ${value}`.toLowerCase().includes(state.query.toLowerCase());
  const nested = kids
    .map(([key, child]) =>
      toTableRows(child, node.type === 'array' ? `${path}[${key}]` : `${path}.${key}`, key),
    )
    .filter(Boolean);
  if (!ownMatch && !nested.length) return null;
  return { path, field: label, kind: typeName(node), value, _children: nested };
}
function render() {
  const mode = state.mode;
  const directionButton = $('#graph-direction-toggle');
  directionButton.hidden = mode !== 'graph';
  directionButton.innerHTML =
    state.graphDirection === 'LR' ? '↕ <span>纵向</span>' : '↔ <span>横向</span>';
  directionButton.title = `切换为${state.graphDirection === 'LR' ? '纵向' : '横向'}布局`;
  directionButton.setAttribute('aria-label', directionButton.title);
  workspace.classList.toggle('compare-mode', mode === 'compare');
  compareInputPanel.classList.toggle('hidden', mode !== 'compare');
  if (!state.shown && mode !== 'compare' && mode !== 'original') {
    jsonEditor?.destroy();
    jsonEditor = null;
    resultCodeView?.destroy();
    resultCodeView = null;
    dataTable?.destroy();
    dataTable = null;
    graphCleanup?.();
    graphCleanup = null;
    viewer.className = `viewer mode-${mode}`;
    viewer.innerHTML =
      '<div class="empty-state"><div class="empty-icon">⌘</div><strong>等待数据</strong><span>输入或载入 JSON 后，这里会显示对应视图。</span></div>';
    $('#status').textContent = '等待输入';
    $('#stats').textContent = '—';
    return;
  }
  const node = state.shown ? (findPath(state.shown, state.selected) ?? state.shown) : null;
  $('#crumbs').innerHTML = `<span class="crumb-root" data-path="$">$</span>${
    state.selected === '$'
      ? ''
      : state.selected
          .replace(/^\$\.?/, '')
          .replace(/\[(\d+)\]/g, '.$1')
          .split('.')
          .filter(Boolean)
          .map(
            (part) =>
              `<span class="crumb-sep">›</span><span data-path="${escapeHtml(pathForPart(part))}">${escapeHtml(part)}</span>`,
          )
          .join('')
  }`;
  viewer.className = `viewer mode-${mode}`;
  jsonEditor?.destroy();
  jsonEditor = null;
  resultCodeView?.destroy();
  resultCodeView = null;
  dataTable?.destroy();
  dataTable = null;
  graphCleanup?.();
  graphCleanup = null;
  if (mode === 'compare') {
    const active = state.documents.find((item) => item.id === state.activeDocumentId);
    if (comparisonSource.value !== (active?.compareText ?? ''))
      comparisonSource.value = active?.compareText ?? '';
    $('#compare-name').textContent = active?.compareName ?? 'comparison.json';
    $('#compare-format-label').textContent = formatLabel(state.format);
    setCompareLanguage(active?.compareFormat ?? state.format);
    viewer.innerHTML =
      '<div class="diff-pane-heading"><strong>差异</strong><span id="diff-summary">输入对比文档后自动对照</span></div><div id="diff-results" class="diff-results"><div class="diff-placeholder">完整结构会显示在这里，差异将用颜色标出</div></div>';
    $('#status').textContent = '比较文档';
    $('#stats').textContent = '';
    $('#compare-bytes').textContent = comparisonSource.value
      ? `${new Blob([comparisonSource.value]).size.toLocaleString()} B`
      : '等待输入';
    if (comparisonSource.value.trim()) runDiff();
    else syncCompareScroll();
    return;
  } else if (mode === 'original') {
    const active = state.documents.find((item) => item.id === state.activeDocumentId);
    const originalText = active?.originalText ?? active?.text ?? '';
    viewer.innerHTML = '<div class="source-editor-host result-code-editor"></div>';
    resultCodeView = createCodeEditor(
      viewer.firstElementChild,
      originalText,
      active?.originalFormat ?? state.format,
      true,
    );
    $('#status').textContent = '原始输入 · 只读';
    $('#stats').textContent = `${new Blob([originalText]).size.toLocaleString()} 字节`;
    $('#input-bytes').textContent = `${new Blob([source.value]).size.toLocaleString()} B`;
    return;
  } else if (mode === 'source') {
    viewer.innerHTML = '<div class="source-editor-host result-code-editor"></div>';
    resultCodeView = createCodeEditor(viewer.firstElementChild, source.value, state.format);
    resultCodeView.dom.addEventListener('input', () => {
      const text = resultCodeView.state.doc.toString();
      source.value = text;
      setSourceLanguage(state.format);
      $('#input-format-label').textContent = formatLabel(state.format);
      const active = state.documents.find((item) => item.id === state.activeDocumentId);
      if (active) {
        active.text = text;
        active.format = state.format;
      }
      syncActiveDocument();
      try {
        state.root = parseInput(text, state.format);
        state.shown = state.expand
          ? expandNested(state.root, Number($('#depth').value) || 25)
          : state.root;
        $('#status').textContent = '格式化源码已同步';
        $('#stats').textContent =
          `${countNodes(state.shown).toLocaleString()} 个节点 · ${new Blob([text]).size.toLocaleString()} 字节`;
      } catch (error) {
        state.root = state.shown = null;
        $('#status').textContent = error.message;
        $('#stats').textContent = '—';
      }
      $('#input-bytes').textContent = `${new Blob([text]).size.toLocaleString()} B`;
    });
    $('#status').textContent = '格式化后的源码';
    $('#stats').textContent = `${new Blob([source.value]).size.toLocaleString()} 字节`;
    return;
  } else if (mode === 'table') {
    viewer.innerHTML = '<div class="table-view-host"></div>';
    dataTable = new Tabulator(viewer.firstElementChild, {
      data: [toTableRows(state.shown)].filter(Boolean),
      dataTree: true,
      dataTreeStartExpanded: true,
      dataTreeChildField: '_children',
      layout: 'fitColumns',
      height: '100%',
      placeholder: '没有匹配的字段',
      columns: [
        { title: '路径', field: 'path', minWidth: 180, widthGrow: 2 },
        { title: '字段', field: 'field', minWidth: 110 },
        { title: '类型', field: 'kind', width: 88 },
        { title: '值 / 子项', field: 'value', minWidth: 160, widthGrow: 2 },
      ],
      rowClick: (_event, row) => {
        state.selected = row.getData().path;
        updateCrumbs();
      },
    });
  } else if (mode === 'graph') {
    viewer.innerHTML = '<div class="graph-view-host"></div>';
    graphCleanup = mountGraph(
      viewer.firstElementChild,
      state.shown,
      state.selected,
      state.query,
      (path) => {
        state.selected = path;
        updateCrumbs();
      },
      state.graphDirection,
    );
  } else if (mode === 'tree') {
    viewer.innerHTML = '<div class="json-editor-host"></div>';
    const host = viewer.firstElementChild;
    editorModulePromise ??= import('vanilla-jsoneditor');
    editorModulePromise.then(({ createJSONEditor, stringifyJSONPath }) => {
      if (!host.isConnected) return;
      jsonEditor = createJSONEditor({
        target: host,
        props: {
          content: { text: stringify(state.shown, 2) },
          mode,
          parser: losslessParser,
          mainMenuBar: false,
          navigationBar: false,
          statusBar: false,
          onSelect: (selection) => {
            if (selection?.path) {
              state.selected = stringifyJSONPath(selection.path);
              updateCrumbs();
            }
          },
          onChange: (content) => {
            try {
              const jsonText = content.text ?? losslessParser.stringify(content.json, null, 2);
              const editedNode = parseInput(jsonText, 'json');
              const text = serializeNode(editedNode, state.format);
              source.value = text;
              updateInputExtension(state.format);
              $('#input-format-label').textContent = formatLabel(state.format);
              state.root = parseInput(text, state.format);
              state.shown = state.expand
                ? expandNested(state.root, Number($('#depth').value) || 25)
                : state.root;
              $('#status').textContent = '编辑已同步';
              $('#stats').textContent =
                `${countNodes(state.shown).toLocaleString()} 个节点 · ${new Blob([stringify(state.shown)]).size.toLocaleString()} 字节`;
              $('#input-bytes').textContent = `${new Blob([text]).size.toLocaleString()} B`;
              syncActiveDocument();
            } catch (error) {
              state.root = state.shown = null;
              $('#status').textContent = '源码编辑中…';
              $('#stats').textContent = '—';
            }
          },
        },
      });
    });
  } else {
    viewer.innerHTML = renderColumns(node, state.selected);
    viewer.querySelectorAll('[data-path]').forEach((el) =>
      el.addEventListener('click', () => {
        state.selected = el.dataset.path;
        render();
      }),
    );
  }
  $('#stats').textContent =
    `${countNodes(state.shown).toLocaleString()} 个节点 · ${new Blob([stringify(state.shown)]).size.toLocaleString()} 字节`;
  $('#input-bytes').textContent = `${new Blob([source.value]).size.toLocaleString()} B`;
  $('#status').textContent = `解析完成 · ${state.expand ? '已展开嵌套 JSON' : '原始结构'}`;
}
function updateCrumbs() {
  $('#crumbs').innerHTML = `<span class="crumb-root" data-path="$">$</span>${
    state.selected === '$'
      ? ''
      : state.selected
          .replace(/^\$\.?/, '')
          .replace(/\[(\d+)\]/g, '.$1')
          .split('.')
          .filter(Boolean)
          .map((part) => `<span class="crumb-sep">›</span><span>${escapeHtml(part)}</span>`)
          .join('')
  }`;
}
function pathForPart(part) {
  let path = '$';
  const chunks = state.selected
    .replace(/^\$\.?/, '')
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);
  for (const chunk of chunks) {
    path += /^\d+$/.test(chunk) ? `[${chunk}]` : `.${chunk}`;
    if (chunk === part) break;
  }
  return path;
}
function parseAndRender() {
  const text = source.value;
  syncActiveDocument();
  if (!text.trim()) {
    state.root = state.shown = null;
    state.selected = '$';
    state.query = '';
    if (state.mode === 'compare') {
      render();
      return;
    }
    resetResultView();
    return;
  }
  try {
    const root = parseInput(text, state.format);
    state.root = root;
    state.shown = state.expand ? expandNested(root, Number($('#depth').value) || 25) : root;
    state.selected = '$';
    state.query = $('#search').value;
    render();
  } catch (error) {
    state.root = state.shown = null;
    $('#status').textContent = '解析失败';
    jsonEditor?.destroy();
    jsonEditor = null;
    resultCodeView?.destroy();
    resultCodeView = null;
    dataTable?.destroy();
    dataTable = null;
    graphCleanup?.();
    graphCleanup = null;
    viewer.className = 'viewer error-view';
    viewer.innerHTML = `<div class="error-card"><strong>无法解析输入</strong><pre>${escapeHtml(error.message)}</pre><span>请检查所选格式、引号和括号是否匹配。</span></div>`;
    $('#stats').textContent = '—';
    $('#input-bytes').textContent = `${new Blob([text]).size.toLocaleString()} B`;
  }
}
function download(name, value, type = 'application/json;charset=utf-8') {
  const blob = new Blob([value], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function formatFromName(name) {
  const ext = name.split('.').pop().toLowerCase();
  return (
    {
      jsonl: 'jsonl',
      ndjson: 'jsonl',
      yml: 'yaml',
      yaml: 'yaml',
      toml: 'toml',
      csv: 'csv',
      log: 'log',
      txt: 'log',
    }[ext] ?? 'json'
  );
}
function formattedName(name, suffix = '.formatted.json') {
  const base = name.replace(/\.[^.]+$/, '').replace(/\.formatted$/, '');
  return `${base}${suffix}`;
}
function formatEditorToJson(editor, format) {
  return stringify(
    expandNested(parseInput(editor.value, format), Number($('#depth').value) || 25),
    2,
  );
}
function convertEditorFormat(editor, oldFormat, nextFormat) {
  if (!editor.value.trim()) return;
  editor.value = convertTextFormat(editor.value, oldFormat, nextFormat);
}
function convertTextFormat(text, oldFormat, nextFormat) {
  if (!text.trim()) return text;
  const parsed = expandNested(parseInput(text, oldFormat), Number($('#depth').value) || 25);
  return serializeNode(parsed, nextFormat);
}
function extensionForFormat(format) {
  return (
    { jsonl: 'jsonl', ndjson: 'ndjson', log: 'log', yaml: 'yaml', toml: 'toml', csv: 'csv' }[
      format
    ] ?? 'json'
  );
}
function autoFormatEditor(editor, format) {
  if (!editor.value.trim()) return;
  const parsed = expandNested(parseInput(editor.value, format), Number($('#depth').value) || 25);
  editor.value = serializeNode(parsed, format);
}
function updateInputExtension(format) {
  const ext = extensionForFormat(format);
  const name = $('#input-name').textContent;
  $('#input-name').textContent = name.replace(/\.[^.]+$/, `.${ext}`);
}
function formatCurrentDocument() {
  const active = state.documents.find((item) => item.id === state.activeDocumentId);
  if (!source.value.trim()) return;
  if (active && !active.originalText) {
    active.originalText = source.value;
    active.originalFormat = state.format;
  }
  const formatted = formatEditorToJson(source, state.format);
  let formattedCompare = comparisonSource.value;
  let compareError = '';
  if (formattedCompare.trim()) {
    try {
      formattedCompare = convertTextFormat(
        formattedCompare,
        active?.compareFormat ?? state.format,
        'json',
      );
    } catch (error) {
      compareError = error.message;
    }
  }
  source.value = formatted;
  if (!compareError && comparisonSource.value.trim()) comparisonSource.value = formattedCompare;
  state.format = 'json';
  $('#format').value = 'json';
  $('#input-format-label').textContent = 'JSON';
  $('#input-name').textContent = formattedName($('#input-name').textContent);
  setSourceLanguage('json');
  $('#compare-format-label').textContent = 'JSON';
  setCompareLanguage('json');
  if (active) {
    active.compareFormat = compareError ? (active.compareFormat ?? 'json') : 'json';
    active.compareFormatError = compareError;
    if (!compareError) {
      active.compareText = formattedCompare;
      active.compareName = active.compareName.replace(/\.[^.]+$/, '.json');
      $('#compare-name').textContent = active.compareName;
    }
  }
  syncActiveDocument();
}
function formatComparisonDocument() {
  const active = state.documents.find((item) => item.id === state.activeDocumentId);
  if (!comparisonSource.value.trim()) return;
  if (active && !active.compareOriginalText) active.compareOriginalText = comparisonSource.value;
  const oldFormat = active?.compareFormat ?? state.format;
  const formatted = convertTextFormat(comparisonSource.value, oldFormat, state.format);
  comparisonSource.value = formatted;
  if (active) {
    active.compareFormat = state.format;
    active.compareFormatError = '';
    active.compareName = formattedName(
      active.compareName,
      `.formatted.${extensionForFormat(state.format)}`,
    );
    active.compareText = formatted;
  }
  $('#compare-name').textContent = active?.compareName ?? `comparison.${state.format}`;
  $('#compare-format-label').textContent = formatLabel(state.format);
  setCompareLanguage(state.format);
  $('#compare-bytes').textContent = `${new Blob([formatted]).size.toLocaleString()} B`;
}
function setInput(text, name = 'untitled.json', format = 'json') {
  const active = state.documents.find((item) => item.id === state.activeDocumentId);
  let compareText = comparisonSource.value;
  let compareError = '';
  const previousCompareFormat = active?.compareFormat ?? state.format;
  if (compareText.trim()) {
    try {
      compareText = convertTextFormat(compareText, previousCompareFormat, format);
    } catch (error) {
      compareError = error.message;
    }
  }
  if (compareText.trim() && !compareError) comparisonSource.value = compareText;
  if (active) {
    active.originalText = text;
    active.originalFormat = format;
    active.compareFormat = compareError ? previousCompareFormat : format;
    active.compareFormatError = compareError;
    if (!compareError && comparisonSource.value.trim()) {
      active.compareText = compareText;
      active.compareName = active.compareName.replace(/\.[^.]+$/, `.${extensionForFormat(format)}`);
      $('#compare-name').textContent = active.compareName;
    }
  }
  source.value = text;
  $('#input-name').textContent = name;
  $('#format').value = format;
  state.format = format;
  $('#input-format-label').textContent = formatLabel(format);
  setSourceLanguage(format);
  $('#compare-format-label').textContent = formatLabel(format);
  setCompareLanguage(format);
  try {
    autoFormatEditor(source, format);
  } catch {
    /* Leave invalid input visible so its parse error can be corrected. */
  }
  syncActiveDocument();
  parseAndRender();
}
source.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') parseAndRender();
});
$('#load-sample').addEventListener('click', () => setInput(sample));
$('#format').addEventListener('change', (event) => {
  const nextFormat = event.target.value;
  const previousFormat = state.format;
  const active = state.documents.find((item) => item.id === state.activeDocumentId);
  let convertedCompare = comparisonSource.value;
  let compareError = '';
  try {
    convertEditorFormat(source, previousFormat, nextFormat);
  } catch (error) {
    $('#status').textContent = `格式转换失败：${error.message}`;
    event.target.value = previousFormat;
    return;
  }
  if (convertedCompare.trim()) {
    try {
      convertedCompare = convertTextFormat(
        convertedCompare,
        active?.compareFormat ?? previousFormat,
        nextFormat,
      );
    } catch (error) {
      compareError = error.message;
    }
  }
  if (!compareError && comparisonSource.value.trim()) comparisonSource.value = convertedCompare;
  state.format = nextFormat;
  setSourceLanguage(nextFormat);
  $('#input-format-label').textContent = formatLabel(nextFormat);
  if (active) {
    active.compareFormat = compareError ? (active.compareFormat ?? previousFormat) : nextFormat;
    active.compareFormatError = compareError;
    if (!compareError && comparisonSource.value.trim()) {
      active.compareText = convertedCompare;
      active.compareName = active.compareName.replace(
        /\.[^.]+$/,
        `.${extensionForFormat(nextFormat)}`,
      );
      $('#compare-name').textContent = active.compareName;
    }
  }
  $('#compare-format-label').textContent = formatLabel(nextFormat);
  setCompareLanguage(nextFormat);
  updateInputExtension(nextFormat);
  syncActiveDocument();
  parseAndRender();
});
$('#expand-toggle').addEventListener('change', (event) => {
  state.expand = event.target.checked;
  parseAndRender();
});
$('#depth').addEventListener('change', parseAndRender);
$('#search').addEventListener('input', (event) => {
  state.query = event.target.value;
  if (['graph', 'columns', 'table'].includes(state.mode)) render();
});
document.querySelectorAll('.view-tabs button').forEach((button) =>
  button.addEventListener('click', () => {
    document
      .querySelectorAll('.view-tabs button')
      .forEach((item) => item.classList.toggle('active', item === button));
    $('#compare-toggle').classList.remove('active');
    $('#editor-view-toggle').classList.add('active');
    state.mode = button.dataset.mode;
    state.lastDataMode = state.mode;
    render();
  }),
);
$('#graph-direction-toggle').addEventListener('click', () => {
  state.graphDirection = state.graphDirection === 'LR' ? 'TB' : 'LR';
  render();
});
$('#editor-view-toggle').addEventListener('click', () => {
  state.mode = state.lastDataMode || 'graph';
  $('#compare-toggle').classList.remove('active');
  $('#editor-view-toggle').classList.add('active');
  document
    .querySelectorAll('.view-tabs button')
    .forEach((item) => item.classList.toggle('active', item.dataset.mode === state.mode));
  render();
});
function clearDocument() {
  source.value = '';
  clearTimeout(originalTextTimer);
  clearTimeout(sourceAutoFormatTimer);
  clearTimeout(originalFormatTimer);
  const active = state.documents.find((item) => item.id === state.activeDocumentId);
  if (active) {
    active.text = '';
    active.originalText = '';
    active.originalFormat = state.format;
  }
  parseAndRender();
  renderDocumentTabs();
}
$('#clear-input').addEventListener('click', clearDocument);
$('#format-input').addEventListener('click', () => {
  if (!source.value.trim()) {
    $('#status').textContent = '请先输入或载入 JSON';
    return;
  }
  try {
    formatCurrentDocument();
    parseAndRender();
  } catch (error) {
    $('#status').textContent = error.message;
  }
});
$('#open-file').addEventListener('click', () => $('#file-input').click());
$('#file-input').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  setInput(await file.text(), file.name, formatFromName(file.name));
  event.target.value = '';
});
$('#export-input').addEventListener('click', () => {
  if (source.value)
    download(
      $('#input-name').textContent || 'document.json',
      source.value,
      'text/plain;charset=utf-8',
    );
});
$('#copy-output').addEventListener('click', async () => {
  if (!state.shown) return;
  await navigator.clipboard.writeText(stringify(state.shown));
  $('#copy-output').textContent = '已复制';
  setTimeout(() => {
    $('#copy-output').textContent = '复制';
  }, 1200);
});
$('#download-output').addEventListener(
  'click',
  () => state.shown && download('expanded.json', stringify(state.shown)),
);
$('#compare-toggle').addEventListener('click', () => {
  if (state.mode !== 'compare') state.lastDataMode = state.mode;
  const active = state.documents.find((item) => item.id === state.activeDocumentId);
  if (active && !active.compareInitialized) {
    active.compareText = source.value;
    active.compareOriginalText = source.value;
    active.compareFormat = state.format;
    active.compareName = `comparison.${extensionForFormat(state.format)}`;
    active.compareInitialized = true;
    comparisonSource.value = source.value;
    $('#compare-name').textContent = active.compareName;
  }
  if (active && !active.compareText.trim()) active.compareFormat = state.format;
  $('#compare-format-label').textContent = formatLabel(state.format);
  setCompareLanguage(state.format);
  if (active) {
    active.text = source.value;
    active.format = state.format;
    active.compareText = comparisonSource.value;
  }
  state.mode = 'compare';
  $('#compare-toggle').classList.add('active');
  $('#editor-view-toggle').classList.remove('active');
  document.querySelectorAll('.view-tabs button').forEach((item) => item.classList.remove('active'));
  render();
});
$('#import-compare').addEventListener('click', () => $('#compare-file-input').click());
$('#compare-file-input').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const active = state.documents.find((item) => item.id === state.activeDocumentId);
  const originalText = await file.text();
  const importedFormat = formatFromName(file.name);
  let text = originalText;
  let compareError = '';
  try {
    text = convertTextFormat(originalText, importedFormat, state.format);
  } catch (error) {
    compareError = error.message;
  }
  comparisonSource.value = text;
  $('#compare-name').textContent = compareError
    ? file.name
    : file.name.replace(/\.[^.]+$/, `.${extensionForFormat(state.format)}`);
  if (active) {
    active.compareText = text;
    active.compareOriginalText = originalText;
    active.compareName = $('#compare-name').textContent;
    active.compareFormat = compareError ? importedFormat : state.format;
    active.compareFormatError = compareError;
    active.compareInitialized = true;
    setCompareLanguage(active.compareFormat);
    $('#compare-format-label').textContent = formatLabel(state.format);
  }
  event.target.value = '';
  runDiff();
});
$('#export-compare').addEventListener('click', () => {
  const active = state.documents.find((item) => item.id === state.activeDocumentId);
  if (comparisonSource.value)
    download(
      active?.compareName || 'comparison.json',
      comparisonSource.value,
      'text/plain;charset=utf-8',
    );
});
$('#clear-compare').addEventListener('click', () => {
  comparisonSource.value = '';
  const active = state.documents.find((item) => item.id === state.activeDocumentId);
  clearTimeout(compareOriginalTextTimer);
  clearTimeout(compareAutoFormatTimer);
  if (active) {
    active.compareText = '';
    active.compareOriginalText = '';
    active.compareFormat = state.format;
    active.compareFormatError = '';
    active.compareInitialized = true;
  }
  $('#compare-bytes').textContent = '等待输入';
  scheduleDiff();
});
$('#format-compare').addEventListener('click', () => {
  if (!comparisonSource.value.trim()) {
    $('#diff-summary').textContent = '请先输入或导入对比文档';
    return;
  }
  try {
    formatComparisonDocument();
    scheduleDiff();
  } catch (error) {
    $('#diff-summary').textContent = error.message;
  }
});
$('#convert-toggle').addEventListener('click', () =>
  $('#convert-panel').classList.toggle('hidden'),
);
document
  .querySelectorAll('[data-close]')
  .forEach((button) =>
    button.addEventListener('click', () =>
      $(`#${button.dataset.close}-panel`).classList.add('hidden'),
    ),
  );
function runDiff() {
  const current = source.value;
  const comparison = comparisonSource.value;
  const active = state.documents.find((item) => item.id === state.activeDocumentId);
  if (!current.trim()) {
    $('#diff-summary').textContent = '左侧当前文件为空';
    $('#diff-results').innerHTML = '<div class="diff-placeholder">先在左侧输入当前文档</div>';
    syncCompareScroll();
    return;
  }
  if (!comparison.trim()) {
    $('#diff-summary').textContent = '等待对比文档';
    $('#diff-results').innerHTML = '<div class="diff-placeholder">在中间输入或导入文档</div>';
    syncCompareScroll();
    return;
  }
  if (active?.compareFormat && active.compareFormat !== state.format) {
    const reason =
      active.compareFormatError ||
      `对比文档为 ${formatLabel(active.compareFormat)}，当前文档为 ${formatLabel(state.format)}`;
    $('#diff-summary').textContent = '对比文档格式未能同步';
    $('#diff-results').innerHTML =
      `<div class="diff-placeholder">${escapeHtml(reason)}。请修复或重新导入对比文档后再比较。</div>`;
    syncCompareScroll();
    return;
  }
  try {
    const a = parseFormattedSource(current, state.format);
    const b = parseFormattedSource(comparison, state.format);
    const changes = diffNodes(a, b);
    $('#diff-summary').textContent = changes.length
      ? `${changes.length} 处差异 · 已按 ${formatLabel(state.format)} 格式比较`
      : `两个文档一致 · 已按 ${formatLabel(state.format)} 格式比较`;
    $('#diff-results').innerHTML = renderDiffByFormat(a, b, state.format);
    syncCompareScroll();
  } catch (error) {
    $('#diff-summary').textContent = '无法生成差异';
    $('#diff-results').innerHTML =
      `<div class="diff-placeholder">${escapeHtml(error.message)}</div>`;
    syncCompareScroll();
  }
}
function parseFormattedSource(text, format) {
  const expanded = expandNested(parseInput(text, format), Number($('#depth').value) || 25);
  const formattedSource = stringify(expanded, 2);
  return parseInput(formattedSource, 'json');
}
function renderMergedDiff(left, right, path = '$', key = null, depth = 0, comma = false) {
  const indent = depth * 16;
  const field =
    key === null ? '' : `<span class="merged-key">${escapeHtml(JSON.stringify(key))}: </span>`;
  const suffix = comma ? ',' : '';
  const line = (content, kind = '', rowPath = path) =>
    `<div class="merged-line ${kind}" data-path="${escapeHtml(rowPath)}" style="--indent:${indent}px">${content}</div>`;
  const pretty = (node) => stringify(node, 2);
  if (!left)
    return line(`${field}<pre>${escapeHtml(pretty(right))}</pre>${suffix}`, 'merged-added', path);
  if (!right)
    return line(`${field}<pre>${escapeHtml(pretty(left))}</pre>${suffix}`, 'merged-deleted', path);
  if (left.type !== right.type) {
    return line(
      `${field}<span class="merged-before">${escapeHtml(stringify(left, 0))}</span><span class="merged-arrow"> → </span><span class="merged-after">${escapeHtml(stringify(right, 0))}</span>${suffix}`,
      'merged-changed',
      path,
    );
  }
  if (left.type === 'object' || left.type === 'array') {
    const isObject = left.type === 'object';
    const leftChildren = isObject
      ? left.entries.map(({ key: childKey, value }) => [childKey, value])
      : left.items.map((value, index) => [String(index), value]);
    const rightChildren = isObject
      ? right.entries.map(({ key: childKey, value }) => [childKey, value])
      : right.items.map((value, index) => [String(index), value]);
    const leftMap = new Map(leftChildren);
    const rightMap = new Map(rightChildren);
    const keys = [
      ...leftChildren.map(([childKey]) => childKey),
      ...rightChildren.map(([childKey]) => childKey).filter((childKey) => !leftMap.has(childKey)),
    ];
    const open = isObject ? '{' : '[';
    const close = isObject ? '}' : ']';
    if (!keys.length) return line(`${field}${open}${close}${suffix}`, '', path);
    let html = line(`${field}${open}`, '', path);
    keys.forEach((childKey, index) => {
      const childPath = isObject ? `${path}.${childKey}` : `${path}[${childKey}]`;
      html += renderMergedDiff(
        leftMap.get(childKey),
        rightMap.get(childKey),
        childPath,
        isObject ? childKey : null,
        depth + 1,
        index < keys.length - 1,
      );
    });
    html += `<div class="merged-line" style="--indent:${indent}px">${close}${suffix}</div>`;
    return html;
  }
  const same = left.type === 'number' ? left.raw === right.raw : left.value === right.value;
  const value = stringify(left, 0);
  if (same) return line(`${field}<span>${escapeHtml(value)}</span>${suffix}`, '', path);
  return line(
    `${field}<span class="merged-before">${escapeHtml(value)}</span><span class="merged-arrow"> → </span><span class="merged-after">${escapeHtml(stringify(right, 0))}</span>${suffix}`,
    'merged-changed',
    path,
  );
}
function renderDiffByFormat(left, right, format) {
  if (format === 'toml') return renderTomlDiff(left, right);
  if (format === 'csv') return renderCsvDiff(left, right);
  if (format === 'jsonl' || format === 'ndjson') {
    const before = left.type === 'array' ? left.items : [left];
    const after = right.type === 'array' ? right.items : [right];
    const lines = [];
    for (let index = 0; index < Math.max(before.length, after.length); index += 1) {
      const a = before[index];
      const b = after[index];
      const oldText = a ? stringify(a, 0) : null;
      const newText = b ? stringify(b, 0) : null;
      const value =
        oldText === null
          ? `<span class="merged-added">${escapeHtml(newText)}</span>`
          : newText === null
            ? `<span class="merged-deleted">${escapeHtml(oldText)}</span>`
            : oldText === newText
              ? escapeHtml(oldText)
              : `<span class="merged-before">${escapeHtml(oldText)}</span><span class="merged-arrow"> → </span><span class="merged-after">${escapeHtml(newText)}</span>`;
      lines.push(
        `<div class="merged-line ${oldText === null ? 'merged-added' : newText === null ? 'merged-deleted' : oldText === newText ? '' : 'merged-changed'}" data-path="$[${index}]"><pre>${value}</pre></div>`,
      );
    }
    return lines.join('');
  }
  if (format !== 'yaml') return renderMergedDiff(left, right);
  const rows = [];
  const scalar = (node) =>
    node.type === 'object'
      ? '{}'
      : node.type === 'array'
        ? '[]'
        : YAML.stringify(toPlain(node)).trim();
  const safeKey = (key) =>
    /^[\w-]+$/.test(String(key)) ? String(key) : JSON.stringify(String(key));
  const add = (text, path, depth, kind = '') =>
    rows.push(
      `<div class="merged-line ${kind}" data-path="${escapeHtml(path)}" style="--indent:${depth * 16}px"><pre>${text}</pre></div>`,
    );
  const walk = (a, b, path, key, depth, forced = '') => {
    const prefix = `${key === null ? '- ' : key === undefined ? '' : `${safeKey(key)}: `}`;
    if (!a || !b) {
      const node = a ?? b;
      const kind = a ? 'merged-deleted' : 'merged-added';
      if (node.type === 'object' || node.type === 'array') {
        const pairs =
          node.type === 'object'
            ? node.entries.map(({ key: k, value }) => [k, value])
            : node.items.map((value, i) => [String(i), value]);
        if (key !== undefined) add(escapeHtml(prefix.trimEnd()), path, depth, kind);
        if (!pairs.length)
          add(`${escapeHtml(prefix)}${node.type === 'object' ? '{}' : '[]'}`, path, depth, kind);
        pairs.forEach(([childKey, child]) =>
          walk(
            a ? child : undefined,
            b ? child : undefined,
            node.type === 'array' ? `${path}[${childKey}]` : `${path}.${childKey}`,
            node.type === 'array' ? null : childKey,
            depth + 1,
            kind,
          ),
        );
        return;
      }
    }
    if (!a || !b || a.type !== b.type || !['object', 'array'].includes(a.type)) {
      const before = a ? scalar(a) : null;
      const after = b ? scalar(b) : null;
      const same =
        a &&
        b &&
        a.type === b.type &&
        (a.type === 'number' ? a.raw === b.raw : a.value === b.value);
      const value = same
        ? escapeHtml(before)
        : before === null
          ? `<span class="merged-added">${escapeHtml(after)}</span>`
          : after === null
            ? `<span class="merged-deleted">${escapeHtml(before)}</span>`
            : `<span class="merged-before">${escapeHtml(before)}</span><span class="merged-arrow"> → </span><span class="merged-after">${escapeHtml(after)}</span>`;
      add(
        `${escapeHtml(prefix)}${value}`,
        path,
        depth,
        same
          ? forced
          : before === null
            ? 'merged-added'
            : after === null
              ? 'merged-deleted'
              : 'merged-changed',
      );
      return;
    }
    const items = (n) =>
      n.type === 'object'
        ? n.entries.map(({ key: k, value }) => [k, value])
        : n.items.map((value, i) => [String(i), value]);
    const am = new Map(items(a));
    const bm = new Map(items(b));
    const keys = [...am.keys(), ...[...bm.keys()].filter((k) => !am.has(k))];
    if (key !== undefined) add(escapeHtml(prefix.trimEnd()), path, depth, forced);
    if (!keys.length)
      add(`${escapeHtml(prefix)}${a.type === 'object' ? '{}' : '[]'}`, path, depth, forced);
    keys.forEach((childKey) =>
      walk(
        am.get(childKey),
        bm.get(childKey),
        a.type === 'array' ? `${path}[${childKey}]` : `${path}.${childKey}`,
        a.type === 'array' ? null : childKey,
        depth + 1,
        !am.has(childKey) ? 'merged-added' : !bm.has(childKey) ? 'merged-deleted' : forced,
      ),
    );
  };
  walk(left, right, '$', undefined, 0);
  return rows.join('');
}
function tomlValue(node) {
  if (node.type === 'string') return JSON.stringify(node.value);
  if (node.type === 'number') return node.raw;
  if (node.type === 'boolean') return String(node.value);
  if (node.type === 'null') return '"null"';
  if (node.type === 'array') return `[${node.items.map(tomlValue).join(', ')}]`;
  return `{ ${node.entries.map(({ key, value }) => `${/^[A-Za-z0-9_-]+$/.test(key) ? key : JSON.stringify(key)} = ${tomlValue(value)}`).join(', ')} }`;
}
function renderTomlDiff(left, right) {
  const rows = [];
  const keyText = (key) =>
    /^[A-Za-z0-9_-]+$/.test(String(key)) ? String(key) : JSON.stringify(String(key));
  const add = (text, path, depth, kind = '') =>
    rows.push(
      `<div class="merged-line ${kind}" data-path="${escapeHtml(path)}" style="--indent:${depth * 16}px"><pre>${text}</pre></div>`,
    );
  const walk = (a, b, path, key, depth, forced = '') => {
    const prefix = key === undefined ? '' : `${keyText(key)} = `;
    if (
      !a ||
      !b ||
      a.type !== b.type ||
      !['object', 'array'].includes(a.type) ||
      a.type === 'array'
    ) {
      const before = a ? tomlValue(a) : null;
      const after = b ? tomlValue(b) : null;
      const same =
        a &&
        b &&
        a.type === b.type &&
        (a.type === 'number' ? a.raw === b.raw : a.value === b.value);
      const value = same
        ? escapeHtml(before)
        : before === null
          ? `<span class="merged-added">${escapeHtml(after)}</span>`
          : after === null
            ? `<span class="merged-deleted">${escapeHtml(before)}</span>`
            : `<span class="merged-before">${escapeHtml(before)}</span><span class="merged-arrow"> → </span><span class="merged-after">${escapeHtml(after)}</span>`;
      add(
        `${escapeHtml(prefix)}${value}`,
        path,
        depth,
        same
          ? forced
          : before === null
            ? 'merged-added'
            : after === null
              ? 'merged-deleted'
              : 'merged-changed',
      );
      return;
    }
    const pairs = (n) => n.entries.map(({ key: k, value }) => [k, value]);
    const am = new Map(pairs(a));
    const bm = new Map(pairs(b));
    const keys = [...am.keys(), ...[...bm.keys()].filter((k) => !am.has(k))];
    if (key !== undefined) add(`[${path.slice(2)}]`, path, depth, forced);
    keys.forEach((childKey) =>
      walk(
        am.get(childKey),
        bm.get(childKey),
        `${path}.${childKey}`,
        childKey,
        depth + 1,
        !am.has(childKey) ? 'merged-added' : !bm.has(childKey) ? 'merged-deleted' : forced,
      ),
    );
  };
  walk(left, right, '$', undefined, 0);
  return rows.join('');
}
function renderCsvDiff(left, right) {
  const asRows = (node) => (node.type === 'array' ? node.items : [node]);
  const rowsA = asRows(left);
  const rowsB = asRows(right);
  const columns = [
    ...new Set(
      [...rowsA, ...rowsB].flatMap((row) =>
        row.type === 'object' ? row.entries.map(({ key }) => key) : ['值'],
      ),
    ),
  ];
  const fields = (row) =>
    row?.type === 'object'
      ? new Map(row.entries.map(({ key, value }) => [key, value]))
      : new Map(row ? [['值', row]] : []);
  const cell = (node) =>
    node
      ? node.type === 'string'
        ? node.value
        : node.type === 'number'
          ? node.raw
          : stringify(node, 0)
      : '';
  const quote = (value) => `"${String(value).replace(/"/g, '""')}"`;
  const line = (content, path, kind = '') =>
    `<div class="merged-line ${kind}" data-path="${escapeHtml(path)}"><pre>${content}</pre></div>`;
  const output = [line(columns.map(quote).join(','), '$')];
  for (let index = 0; index < Math.max(rowsA.length, rowsB.length); index += 1) {
    const a = fields(rowsA[index]);
    const b = fields(rowsB[index]);
    const values = columns.map((column) => {
      const before = a.get(column);
      const after = b.get(column);
      if (!before) return `<span class="merged-added">${escapeHtml(quote(cell(after)))}</span>`;
      if (!after) return `<span class="merged-deleted">${escapeHtml(quote(cell(before)))}</span>`;
      if (cell(before) === cell(after)) return escapeHtml(quote(cell(before)));
      return `<span class="merged-before">${escapeHtml(quote(cell(before)))}</span><span class="merged-arrow"> → </span><span class="merged-after">${escapeHtml(quote(cell(after)))}</span>`;
    });
    output.push(
      line(
        values.join(','),
        `$[${index}]`,
        index >= rowsA.length ? 'merged-added' : index >= rowsB.length ? 'merged-deleted' : '',
      ),
    );
  }
  return output.join('');
}
let diffTimer;
let scrollSyncController;
function syncCompareScroll() {
  scrollSyncController?.abort();
  if (state.mode !== 'compare') return;
  const panes = [
    sourceView.dom.querySelector('.cm-scroller'),
    compareView.dom.querySelector('.cm-scroller'),
    $('#diff-results'),
  ].filter(Boolean);
  scrollSyncController = new AbortController();
  let syncing = false;
  for (const pane of panes)
    pane.addEventListener(
      'scroll',
      () => {
        if (syncing) return;
        syncing = true;
        const max = Math.max(0, pane.scrollHeight - pane.clientHeight);
        const ratio = max ? pane.scrollTop / max : 0;
        for (const other of panes)
          if (other !== pane)
            other.scrollTop = ratio * Math.max(0, other.scrollHeight - other.clientHeight);
        requestAnimationFrame(() => {
          syncing = false;
        });
      },
      { passive: true, signal: scrollSyncController.signal },
    );
}
function scheduleDiff() {
  clearTimeout(diffTimer);
  diffTimer = setTimeout(runDiff, 160);
}
function selectTextPath(editor, path) {
  const match = path.match(/(?:^|\.)([^.[\]]+)$|\[(\d+)\]$/);
  const key = match?.[1];
  if (!key) return;
  const quoted = JSON.stringify(key);
  const doc = editor.state.doc;
  for (let number = 1; number <= doc.lines; number += 1) {
    const line = doc.line(number);
    const local = line.text.indexOf(quoted);
    if (
      local >= 0 &&
      line.text
        .slice(local + quoted.length)
        .trimStart()
        .startsWith(':')
    ) {
      editor.dispatch({
        selection: { anchor: line.from + local, head: line.to },
        scrollIntoView: true,
      });
      editor.focus();
      return;
    }
  }
}
compareView.dom.addEventListener('input', () => {
  const active = state.documents.find((item) => item.id === state.activeDocumentId);
  if (active) {
    active.compareText = comparisonSource.value;
    active.compareFormat = state.format;
    active.compareFormatError = '';
    clearTimeout(compareOriginalTextTimer);
    if (!active.compareOriginalText) {
      const documentId = active.id;
      const originalText = comparisonSource.value;
      compareOriginalTextTimer = setTimeout(() => {
        const document = state.documents.find((item) => item.id === documentId);
        if (document && !document.compareOriginalText) document.compareOriginalText = originalText;
      }, 650);
    }
  }
  clearTimeout(compareAutoFormatTimer);
  compareAutoFormatTimer = setTimeout(() => {
    try {
      const format = state.format;
      autoFormatEditor(comparisonSource, format);
      if (active) active.compareText = comparisonSource.value;
    } catch {
      /* Keep incomplete text editable until it parses. */
    }
    scheduleDiff();
  }, 800);
  $('#compare-bytes').textContent = `${new Blob([comparisonSource.value]).size.toLocaleString()} B`;
  scheduleDiff();
});
function selectEditorPath(path) {
  const match = path.match(/(?:^|\.)([^.[\]]+)$|\[(\d+)\]$/);
  const key = match?.[1];
  if (!key) return;
  const quoted = JSON.stringify(key);
  const doc = sourceView.state.doc;
  for (let number = 1; number <= doc.lines; number += 1) {
    const line = doc.line(number);
    const local = line.text.indexOf(quoted);
    if (
      local >= 0 &&
      line.text
        .slice(local + quoted.length)
        .trimStart()
        .startsWith(':')
    ) {
      sourceView.dispatch({
        selection: { anchor: line.from + local, head: line.to },
        scrollIntoView: true,
      });
      sourceView.focus();
      return;
    }
  }
}
viewer.addEventListener('click', (event) => {
  const row = event.target.closest('.merged-line[data-path]');
  if (!row) return;
  const path = row.dataset.path;
  selectEditorPath(path);
  selectTextPath(compareView, path);
  viewer
    .querySelectorAll('.merged-line.selected')
    .forEach((item) => item.classList.remove('selected'));
  row.classList.add('selected');
});
let originalTextTimer;
let compareOriginalTextTimer;
let sourceAutoFormatTimer;
let compareAutoFormatTimer;
let originalFormatTimer;
sourceView.dom.addEventListener('input', () => {
  syncActiveDocument();
  const active = state.documents.find((item) => item.id === state.activeDocumentId);
  clearTimeout(originalTextTimer);
  if (active && !active.originalText) {
    const documentId = active.id;
    const originalText = source.value;
    const originalFormat = state.format;
    originalTextTimer = setTimeout(() => {
      const document = state.documents.find((item) => item.id === documentId);
      if (document && !document.originalText) {
        document.originalText = originalText;
        document.originalFormat = originalFormat;
      }
    }, 650);
  }
  clearTimeout(sourceAutoFormatTimer);
  sourceAutoFormatTimer = setTimeout(() => {
    try {
      autoFormatEditor(source, state.format);
      syncActiveDocument();
    } catch {
      /* Keep incomplete text editable until it parses. */
    }
    parseAndRender();
  }, 800);
  if (state.mode === 'compare') scheduleDiff();
});
document.querySelectorAll('.convert-actions button').forEach((button) =>
  button.addEventListener('click', () => {
    if (!state.shown) return;
    try {
      const action = button.dataset.action;
      let result = '';
      let ext = 'json';
      if (action === 'minify') result = stringify(state.shown, 0);
      if (action === 'sort') result = stringify(sortNode(state.shown), 2);
      if (action === 'csv') {
        result = Papa.unparse(flatten(state.shown));
        ext = 'csv';
      }
      if (action === 'yaml') {
        result = YAML.stringify(toPlain(state.shown));
        ext = 'yaml';
      }
      if (action === 'toml') {
        result = stringifyToml(toPlain(state.shown));
        ext = 'toml';
      }
      if (action === 'types') {
        result = `export type Root = ${typeFor(state.shown)};`;
        ext = 'ts';
      }
      $('#convert-output').value = result;
      $('#convert-output').dataset.ext = ext;
    } catch (error) {
      $('#convert-output').value = `转换失败：${error.message}`;
    }
  }),
);
function sortNode(node) {
  if (node.type === 'object')
    return {
      ...node,
      entries: [...node.entries]
        .sort((a, b) => a.key.localeCompare(b.key))
        .map(({ key, value }) => ({ key, value: sortNode(value) })),
    };
  if (node.type === 'array') return { ...node, items: node.items.map(sortNode) };
  return node;
}
function typeFor(node) {
  if (node.type === 'object')
    return `{ ${node.entries.map(({ key, value }) => `${JSON.stringify(key)}: ${typeFor(value)}`).join('; ')} }`;
  if (node.type === 'array')
    return node.items.length
      ? `Array<${[...new Set(node.items.map(typeFor))].join(' | ')}>`
      : 'unknown[]';
  return { string: 'string', number: 'number', boolean: 'boolean', null: 'null' }[node.type];
}
$('#copy-convert').addEventListener(
  'click',
  () => $('#convert-output').value && navigator.clipboard.writeText($('#convert-output').value),
);
$('#download-convert').addEventListener(
  'click',
  () =>
    $('#convert-output').value &&
    download(`converted.${$('#convert-output').dataset.ext || 'txt'}`, $('#convert-output').value),
);
