import {
  diffNodes,
  expandNested,
  flatten,
  parseInput,
  serializeNode,
  stringify,
  toPlain,
} from '../core.js';
import { stringify as stringifyToml } from 'smol-toml';
import YAML from 'yaml';
import Papa from 'papaparse';
import * as LosslessJSON from 'lossless-json';
import { basicSetup } from 'codemirror';
import { json } from '@codemirror/lang-json';
import { yaml } from '@codemirror/lang-yaml';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';
import { mountThemeControls } from '../shared/theme.js';
import { mountWorkspaceShell } from './shell.js';
import { countNodes, findPath, renderColumns, toTableRows } from './data-views.js';
import { renderDiffByFormat } from './diff-renderer.js';
import {
  autoFormatEditor,
  convertEditorFormat,
  convertTextFormat,
  extensionForFormat,
  formatEditorToJson,
  formatFromName,
  formattedName,
} from './formatting.js';
import '../style.css';
import '../editor-shell.css';
import '../vendor.css';

const innerPreferences = JSON.stringify({ 颜色: '蓝色', 通知: true });
const innerConfig = JSON.stringify({ 地址: '苏州', 偏好: innerPreferences });
const sample = `{
  "用户id": 8000000000000000001,
  "配置": ${JSON.stringify(innerConfig)},
  "备注": "普通备注 {随便写，不解析}",
  "过期时间": "2026-12-31 23:59:59"
}`;

const $ = (selector) => document.querySelector(selector);
const getDepthLimit = () => Number($('#depth').value) || 25;
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

mountWorkspaceShell($('#app'));
mountThemeControls({ select: $('#theme-select') });

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
let tableModulePromise;
let graphModulePromise;
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
    const host = viewer.firstElementChild;
    tableModulePromise ??= Promise.all([
      import('tabulator-tables'),
      import('tabulator-tables/dist/css/tabulator.min.css'),
    ]);
    tableModulePromise
      .then(([{ TabulatorFull }]) => {
        if (!host.isConnected || state.mode !== 'table' || !state.shown) return;
        dataTable = new TabulatorFull(host, {
          data: [toTableRows(state.shown, '$', '$', state.query)].filter(Boolean),
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
      })
      .catch((error) => {
        if (host.isConnected) host.textContent = `表格视图加载失败：${error.message}`;
      });
  } else if (mode === 'graph') {
    viewer.innerHTML = '<div class="graph-view-host"></div>';
    const host = viewer.firstElementChild;
    graphModulePromise ??= import('../graph.js');
    graphModulePromise
      .then(({ mountGraph }) => {
        if (!host.isConnected || state.mode !== 'graph' || !state.shown) return;
        graphCleanup = mountGraph(
          host,
          state.shown,
          state.selected,
          state.query,
          (path) => {
            state.selected = path;
            updateCrumbs();
          },
          state.graphDirection,
        );
      })
      .catch((error) => {
        if (host.isConnected) host.textContent = `关系图加载失败：${error.message}`;
      });
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
    viewer.innerHTML = renderColumns(state.shown, state.selected, state.query);
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
  const formatted = formatEditorToJson(source, state.format, getDepthLimit());
  let formattedCompare = comparisonSource.value;
  let compareError = '';
  if (formattedCompare.trim()) {
    try {
      formattedCompare = convertTextFormat(
        formattedCompare,
        active?.compareFormat ?? state.format,
        'json',
        getDepthLimit(),
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
  const formatted = convertTextFormat(
    comparisonSource.value,
    oldFormat,
    state.format,
    getDepthLimit(),
  );
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
      compareText = convertTextFormat(compareText, previousCompareFormat, format, getDepthLimit());
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
    autoFormatEditor(source, format, getDepthLimit());
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
    convertEditorFormat(source, previousFormat, nextFormat, getDepthLimit());
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
        getDepthLimit(),
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
    text = convertTextFormat(originalText, importedFormat, state.format, getDepthLimit());
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
      autoFormatEditor(comparisonSource, format, getDepthLimit());
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
      autoFormatEditor(source, state.format, getDepthLimit());
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
