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
import { basicSetup } from 'codemirror';
import { json } from '@codemirror/lang-json';
import { yaml } from '@codemirror/lang-yaml';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';
import { mountThemeControls } from '../shared/theme.js';
import { mountWorkspaceShell } from './shell.js';
import {
  countNodes,
  findPath,
  nearestContainerPath,
  renderColumns,
  renderTable,
  renderTree,
  renamePathKey,
  replacePath,
} from './data-views.js';
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
  pathPreviewMode: 'selected',
  pathNavRatio: 60,
  treeCollapsed: new Set(),
  treeExpanded: new Set(),
  tableSort: { key: 'path', direction: 'asc' },
  originalSourceOpen: true,
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
mountThemeControls({
  buttons: [...document.querySelectorAll('.theme-switcher [data-theme-choice]')],
});
const mainSplitter = $('#main-splitter');
const editorWorkspace = $('.workspace');
let mainSplitterDragging = false;
mainSplitter.addEventListener('pointerdown', (event) => {
  mainSplitterDragging = true;
  mainSplitter.classList.add('dragging');
  mainSplitter.setPointerCapture(event.pointerId);
  event.preventDefault();
});
mainSplitter.addEventListener('pointermove', (event) => {
  if (!mainSplitterDragging || editorWorkspace.classList.contains('compare-mode')) return;
  const bounds = editorWorkspace.getBoundingClientRect();
  if (window.matchMedia('(max-width: 760px)').matches) {
    const ratio = Math.max(0.25, Math.min(0.72, (event.clientY - bounds.top) / bounds.height));
    editorWorkspace.style.setProperty('--pane-top', `${ratio * 100}%`);
  } else {
    const ratio = Math.max(0.25, Math.min(0.68, (event.clientX - bounds.left) / bounds.width));
    editorWorkspace.style.setProperty('--pane-left', `${ratio * 100}%`);
  }
});
mainSplitter.addEventListener('pointerup', () => {
  mainSplitterDragging = false;
  mainSplitter.classList.remove('dragging');
});
mainSplitter.addEventListener('pointercancel', () => {
  mainSplitterDragging = false;
  mainSplitter.classList.remove('dragging');
});
mainSplitter.addEventListener('keydown', (event) => {
  const mobile = window.matchMedia('(max-width: 760px)').matches;
  const property = mobile ? '--pane-top' : '--pane-left';
  const current =
    parseFloat(getComputedStyle(editorWorkspace).getPropertyValue(property)) || (mobile ? 52 : 36);
  if ((!mobile && event.key === 'ArrowLeft') || (mobile && event.key === 'ArrowUp'))
    editorWorkspace.style.setProperty(property, `${Math.max(25, current - 2)}%`);
  else if ((!mobile && event.key === 'ArrowRight') || (mobile && event.key === 'ArrowDown'))
    editorWorkspace.style.setProperty(property, `${Math.min(mobile ? 72 : 68, current + 2)}%`);
  else return;
  event.preventDefault();
});
$('#fullscreen-toggle').addEventListener('click', async () => {
  if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
  else await document.exitFullscreen?.();
});
const sourceStack = $('.source-stack');
const sourceSplitter = $('#source-stack-splitter');
function setSourcePaneRatio(ratio) {
  const boundedRatio = Math.max(0.2, Math.min(0.8, ratio));
  sourceStack.style.setProperty('--source-top-height', `${boundedRatio * 100}%`);
  sourceSplitter.setAttribute('aria-valuenow', String(Math.round(boundedRatio * 100)));
}
function updateSourceSplitterState() {
  sourceSplitter.setAttribute(
    'aria-disabled',
    String($('#original-source-section').classList.contains('collapsed')),
  );
}
let sourceSplitterDragging = false;
sourceSplitter.addEventListener('pointerdown', (event) => {
  if ($('#original-source-section').classList.contains('collapsed')) return;
  sourceSplitterDragging = true;
  sourceSplitter.setPointerCapture(event.pointerId);
  event.preventDefault();
});
sourceSplitter.addEventListener('pointermove', (event) => {
  if (!sourceSplitterDragging) return;
  const bounds = sourceStack.getBoundingClientRect();
  setSourcePaneRatio((event.clientY - bounds.top) / bounds.height);
});
sourceSplitter.addEventListener('pointerup', () => {
  sourceSplitterDragging = false;
});
sourceSplitter.addEventListener('pointercancel', () => {
  sourceSplitterDragging = false;
});
sourceSplitter.addEventListener('keydown', (event) => {
  if ($('#original-source-section').classList.contains('collapsed')) return;
  const current = Number(sourceSplitter.getAttribute('aria-valuenow')) / 100;
  if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
    setSourcePaneRatio(current - 0.02);
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
    setSourcePaneRatio(current + 0.02);
  } else if (event.key === 'Home') {
    setSourcePaneRatio(0.2);
  } else if (event.key === 'End') {
    setSourcePaneRatio(0.8);
  } else return;
  event.preventDefault();
});
$('#original-source-toggle').addEventListener('click', () => {
  const pane = $('#original-source-section');
  pane.classList.toggle('collapsed');
  $('#original-source-toggle').setAttribute(
    'aria-expanded',
    String(!pane.classList.contains('collapsed')),
  );
  state.originalSourceOpen = !pane.classList.contains('collapsed');
  updateSourceSplitterState();
});
updateSourceSplitterState();

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
      placeholder('在此输入或编辑格式化内容…'),
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
function createCodeEditor(
  parent,
  text,
  format = 'json',
  readOnly = false,
  placeholderText = '',
  onDocumentChange = null,
) {
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
        ...(placeholderText ? [placeholder(placeholderText)] : []),
        ...(readOnly ? [EditorState.readOnly.of(true), EditorView.editable.of(false)] : []),
        ...(onDocumentChange
          ? [
              EditorView.updateListener.of((update) => {
                if (update.docChanged) onDocumentChange(update.state.doc.toString());
              }),
            ]
          : []),
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
let resultCodeView = null;
let pathPreviewView = null;
let pathPreviewTimer;
let syncingPathPreview = false;
let originalCodeView = null;
let graphModulePromise;
let graphCleanup = null;
let pathPreviewResizing = false;
const formatLabel = (format) =>
  ({ jsonl: 'JSONL', ndjson: 'NDJSON', yaml: 'YAML', toml: 'TOML', csv: 'CSV', log: 'LOG' })[
    format
  ] ?? 'JSON';
function syncOriginalSourceView(text, format) {
  const host = $('#original-source');
  if (!host) return;
  originalCodeView?.destroy();
  host.replaceChildren();
  originalCodeView = createCodeEditor(
    host,
    text ?? '',
    format ?? 'json',
    false,
    '原始输入会保留导入时的内容…',
    (currentText) => {
      const active = state.documents.find((item) => item.id === state.activeDocumentId);
      if (active) {
        active.originalText = currentText;
        active.originalFormat = active.originalFormat || state.format;
      }
      $('#original-format-label').textContent =
        `${formatLabel(active?.originalFormat ?? state.format)} · 输入格式`;
      $('#original-bytes').textContent = `${new Blob([currentText]).size.toLocaleString()} B`;
      clearTimeout(originalAutoFormatTimer);
      const documentId = state.activeDocumentId;
      originalAutoFormatTimer = setTimeout(() => {
        if (documentId !== state.activeDocumentId) return;
        if (!currentText.trim()) {
          source.value = '';
          syncActiveDocument();
          parseAndRender();
          return;
        }
        try {
          formatCurrentDocument();
          parseAndRender();
        } catch (error) {
          $('#status').textContent = `等待有效输入：${error.message}`;
        }
      }, 500);
    },
  );
  $('#original-format-label').textContent = text ? `${formatLabel(format)} · 输入格式` : '—';
  $('#original-bytes').textContent = text
    ? `${new Blob([text]).size.toLocaleString()} B`
    : '尚未载入原始内容';
}
syncOriginalSourceView('', state.format);
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
  resultCodeView?.destroy();
  resultCodeView = null;
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
  syncOriginalSourceView(next.originalText, next.originalFormat);
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
function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
}
function renderPathPanel() {
  const explorer = $('#path-explorer');
  if (!explorer || !state.shown) return;
  clearTimeout(pathPreviewTimer);
  pathPreviewView?.destroy();
  pathPreviewView = null;
  const selectedNode = findPath(state.shown, state.selected);
  const navigationPath =
    selectedNode?.type === 'object' || selectedNode?.type === 'array'
      ? state.selected
      : nearestContainerPath(state.shown, state.selected);
  const previewNode =
    state.pathPreviewMode === 'full' ? state.shown : (selectedNode ?? state.shown);
  const previewText = stringify(previewNode);
  explorer.innerHTML = `<div class="path-explorer-heading"><strong>路径</strong><code>${escapeHtml(state.selected)}</code><span>直接编辑字段名和值</span></div><div class="path-explorer-body"><div class="path-columns-host">${renderColumns(state.shown, navigationPath, state.query, state.selected)}</div><div class="path-preview-splitter" data-path-preview-splitter role="separator" aria-label="调整路径浏览与 JSON 编辑区宽度" aria-orientation="vertical" tabindex="0"></div><aside class="path-preview-panel" aria-label="JSON 内容编辑"><div class="path-preview-toolbar"><div class="path-preview-tabs" role="tablist" aria-label="预览内容范围"><button type="button" data-preview-mode="selected" class="${state.pathPreviewMode === 'selected' ? 'active' : ''}" aria-pressed="${state.pathPreviewMode === 'selected'}">所选内容</button><button type="button" data-preview-mode="full" class="${state.pathPreviewMode === 'full' ? 'active' : ''}" aria-pressed="${state.pathPreviewMode === 'full'}">完整结果</button></div><span id="path-preview-status">编辑即同步</span><button class="path-preview-copy" type="button" data-path-preview-copy>复制</button></div><div id="path-preview-editor" class="path-preview-editor" aria-label="可编辑 JSON 预览"></div></aside></div>`;
  explorer.style.setProperty('--path-nav-width', `${state.pathNavRatio}%`);
  pathPreviewView = createCodeEditor(
    $('#path-preview-editor'),
    previewText,
    'json',
    false,
    '编辑 JSON，合法内容会自动同步…',
    (text) => {
      if (!syncingPathPreview) schedulePathPreviewUpdate(text);
    },
  );
  requestAnimationFrame(() => {
    if (!explorer.isConnected) return;
    const columnsView = explorer.querySelector('.columns-view');
    const selectedRow = [...explorer.querySelectorAll('.path-item[data-selected-path]')].find(
      (item) => item.dataset.selectedPath === state.selected,
    );
    const selectedColumn = selectedRow?.closest('.path-column');
    if (!columnsView || !selectedColumn) return;
    const scrollTarget = Math.max(
      0,
      selectedColumn.offsetLeft - (columnsView.clientWidth - selectedColumn.offsetWidth) / 2,
    );
    columnsView.scrollTo({ left: scrollTarget, behavior: 'auto' });
    selectedColumn.scrollTop = Math.max(
      0,
      selectedRow.offsetTop - (selectedColumn.clientHeight - selectedRow.offsetHeight) / 2,
    );
  });
}

function syncPathPreviewSelection() {
  if (!pathPreviewView || state.pathPreviewMode !== 'selected') return;
  const selectedNode = findPath(state.shown, state.selected) ?? state.shown;
  const nextText = stringify(selectedNode);
  if (pathPreviewView.state.doc.toString() === nextText) return;
  clearTimeout(pathPreviewTimer);
  syncingPathPreview = true;
  pathPreviewView.dispatch({
    changes: { from: 0, to: pathPreviewView.state.doc.length, insert: nextText },
  });
  syncingPathPreview = false;
  const status = $('#path-preview-status');
  if (status) {
    status.textContent = '编辑即同步';
    delete status.dataset.state;
  }
}

function schedulePathPreviewUpdate(text) {
  clearTimeout(pathPreviewTimer);
  const mode = state.pathPreviewMode;
  const selectedPath = state.selected;
  pathPreviewTimer = setTimeout(() => {
    try {
      const editedNode = parseInput(text, 'json');
      const updated =
        mode === 'full' ? editedNode : replacePath(state.shown, selectedPath, editedNode);
      if (updated === state.shown) throw new Error('所选路径已不存在，请重新选择。');
      applyPathPreviewUpdate(updated, mode === 'full' ? '$' : selectedPath);
      const status = $('#path-preview-status');
      if (status) {
        status.textContent = '已同步';
        status.dataset.state = 'valid';
      }
    } catch (error) {
      const status = $('#path-preview-status');
      if (status) {
        status.textContent = `未同步：${error.message}`;
        status.dataset.state = 'error';
      }
    }
  }, 300);
}

function applyPathPreviewUpdate(updated, selectedPath) {
  const text = serializeNode(updated, state.format);
  source.value = text;
  const active = state.documents.find((item) => item.id === state.activeDocumentId);
  if (active) {
    active.originalText = text;
    active.originalFormat = state.format;
  }
  syncOriginalSourceView(text, state.format);
  setSourceLanguage(state.format);
  updateInputExtension(state.format);
  state.root = parseInput(text, state.format);
  state.shown = state.expand ? expandNested(state.root, getDepthLimit()) : state.root;
  state.selected = findPath(state.shown, selectedPath) ? selectedPath : '$';
  syncActiveDocument();
  $('#input-format-label').textContent = formatLabel(state.format);
  $('#input-bytes').textContent = `${new Blob([text]).size.toLocaleString()} B`;
  $('#stats').textContent =
    `${countNodes(state.shown).toLocaleString()} 个节点 · ${new Blob([stringify(state.shown)]).size.toLocaleString()} 字节`;
  $('#status').textContent = '路径预览已同步';
  const selectedNode = findPath(state.shown, state.selected);
  const navigationPath =
    selectedNode?.type === 'object' || selectedNode?.type === 'array'
      ? state.selected
      : nearestContainerPath(state.shown, state.selected);
  const columnsHost = $('#path-explorer .path-columns-host');
  if (columnsHost)
    columnsHost.innerHTML = renderColumns(state.shown, navigationPath, state.query, state.selected);
  graphCleanup?.update?.(state.shown, state.selected, state.query, state.graphDirection);
  updateCrumbs();
}

function render() {
  const mode = state.mode;
  clearTimeout(pathPreviewTimer);
  pathPreviewView?.destroy();
  pathPreviewView = null;
  workspace.classList.toggle('compare-mode', mode === 'compare');
  compareInputPanel.classList.toggle('hidden', mode !== 'compare');
  if (!state.shown && mode !== 'compare') {
    resultCodeView?.destroy();
    resultCodeView = null;
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
  resultCodeView?.destroy();
  resultCodeView = null;
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
  } else if (mode === 'table') {
    viewer.innerHTML = renderTable(state.shown, state.selected, state.query, state.tableSort);
  } else if (mode === 'graph') {
    viewer.innerHTML = `<div class="graph-path-workspace"><section class="graph-panel"><div class="graph-panel-toolbar"><strong>关系图</strong><button id="graph-direction-toggle" class="graph-direction-toggle" type="button" title="切换布局方向">${state.graphDirection === 'LR' ? '↕ 纵向' : '↔ 横向'}</button></div><div class="graph-view-host"></div></section><section id="path-explorer" class="path-explorer" aria-label="路径导航与编辑"></section></div>`;
    const host = viewer.querySelector('.graph-view-host');
    renderPathPanel();
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
            renderPathPanel();
          },
          (path, editType, value, valueType) => {
            try {
              let updated;
              let nextPath = path;
              if (editType === 'key') {
                const nextKey = value.trim();
                if (!nextKey) throw new Error('字段名不能为空。');
                updated = renamePathKey(state.shown, path, nextKey);
                if (updated === state.shown) throw new Error('找不到要修改的字段。');
                nextPath = `${path.slice(0, path.lastIndexOf('.') + 1)}${nextKey}`;
              } else {
                let replacement;
                if (valueType === 'string') replacement = { type: 'string', value };
                else if (valueType === 'boolean')
                  replacement = { type: 'boolean', value: value === 'true' };
                else if (valueType === 'null') replacement = parseInput(value, 'json');
                else {
                  replacement = parseInput(value, 'json');
                  if (replacement.type !== 'number') throw new Error('请输入有效数字。');
                }
                updated = replacePath(state.shown, path, replacement);
                if (updated === state.shown) throw new Error('找不到要修改的值。');
              }
              commitPathUpdate(updated, nextPath);
            } catch (error) {
              $('#status').textContent = `修改失败：${error.message}`;
              render();
            }
          },
          state.graphDirection,
        );
      })
      .catch((error) => {
        if (host.isConnected) host.textContent = `关系图加载失败：${error.message}`;
      });
  } else if (mode === 'tree') {
    viewer.innerHTML = renderTree(
      state.shown,
      state.selected,
      state.query,
      state.treeCollapsed,
      state.treeExpanded,
    );
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
    resultCodeView?.destroy();
    resultCodeView = null;
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
  const originalText = originalCodeView.state.doc.toString();
  if (!originalText.trim()) return;
  const originalFormat = active?.originalFormat ?? state.format;
  if (active) {
    active.originalText = originalText;
    active.originalFormat = originalFormat;
  }
  const formatted = formatEditorToJson({ value: originalText }, originalFormat, getDepthLimit());
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
  syncOriginalSourceView(text, format);
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
  if (['graph', 'tree', 'table'].includes(state.mode)) render();
});
document.querySelectorAll('.view-tabs button').forEach((button) =>
  button.addEventListener('click', () => {
    document
      .querySelectorAll('.view-tabs button')
      .forEach((item) => item.classList.toggle('active', item === button));
    $('#compare-toggle').classList.remove('active');
    $('#compare-toggle').setAttribute('aria-pressed', 'false');
    $('#view-toggle').classList.add('active');
    $('#view-toggle').setAttribute('aria-pressed', 'true');
    state.mode = button.dataset.mode;
    state.lastDataMode = state.mode;
    render();
  }),
);
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
  syncOriginalSourceView('', state.format);
  parseAndRender();
  renderDocumentTabs();
}
$('#clear-input').addEventListener('click', clearDocument);
$('#format-input').addEventListener('click', () => {
  if (!originalCodeView.state.doc.toString().trim()) {
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
  if (state.mode === 'compare') return;
  state.lastDataMode = state.mode;
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
  $('#compare-toggle').setAttribute('aria-pressed', 'true');
  $('#view-toggle').classList.remove('active');
  $('#view-toggle').setAttribute('aria-pressed', 'false');
  document.querySelectorAll('.view-tabs button').forEach((item) => item.classList.remove('active'));
  render();
});
$('#view-toggle').addEventListener('click', () => {
  if (state.mode !== 'compare') return;
  state.mode = state.lastDataMode || 'graph';
  $('#compare-toggle').classList.remove('active');
  $('#compare-toggle').setAttribute('aria-pressed', 'false');
  $('#view-toggle').classList.add('active');
  $('#view-toggle').setAttribute('aria-pressed', 'true');
  document
    .querySelectorAll('.view-tabs button')
    .forEach((item) => item.classList.toggle('active', item.dataset.mode === state.mode));
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
  if (event.target.closest('[data-path-preview-copy]')) {
    const button = event.target.closest('[data-path-preview-copy]');
    navigator.clipboard.writeText(pathPreviewView?.state.doc.toString() ?? '');
    button.textContent = '已复制';
    setTimeout(() => {
      if (button.isConnected) button.textContent = '复制';
    }, 1200);
    return;
  }
  const previewModeButton = event.target.closest('[data-preview-mode]');
  if (previewModeButton) {
    state.pathPreviewMode = previewModeButton.dataset.previewMode;
    renderPathPanel();
    return;
  }
  if (event.target.closest('#graph-direction-toggle')) {
    state.graphDirection = state.graphDirection === 'LR' ? 'TB' : 'LR';
    render();
    return;
  }
  const treeToggle = event.target.closest('[data-tree-toggle]');
  if (treeToggle) {
    const path = treeToggle.dataset.treeToggle;
    if (treeToggle.dataset.collapsed === 'true') {
      state.treeCollapsed.delete(path);
      state.treeExpanded.add(path);
    } else {
      state.treeExpanded.delete(path);
      state.treeCollapsed.add(path);
    }
    render();
    return;
  }
  const sortButton = event.target.closest('[data-table-sort]');
  if (sortButton) {
    const key = sortButton.dataset.tableSort;
    state.tableSort = {
      key,
      direction:
        state.tableSort.key === key && state.tableSort.direction === 'asc' ? 'desc' : 'asc',
    };
    render();
    return;
  }
  const editorInput = event.target.closest('.path-key-input, .path-value-input');
  if (editorInput) {
    state.selected = editorInput.dataset.path;
    updateCrumbs();
    const pathLabel = $('#path-explorer .path-explorer-heading code');
    if (pathLabel) pathLabel.textContent = state.selected;
    viewer
      .querySelectorAll('.path-item.selected')
      .forEach((item) => item.classList.remove('selected'));
    editorInput.closest('.path-item')?.classList.add('selected');
    syncPathPreviewSelection();
    graphCleanup?.select?.(nearestContainerPath(state.shown, state.selected));
    return;
  }
  const treeRow = event.target.closest('.json-tree-row[data-path]');
  if (treeRow) {
    state.selected = treeRow.dataset.path;
    updateCrumbs();
    viewer
      .querySelectorAll('.json-tree-row.selected')
      .forEach((row) => row.classList.remove('selected'));
    treeRow.classList.add('selected');
    return;
  }
  const tableRow = event.target.closest('.data-table tbody tr[data-path]');
  if (tableRow) {
    state.selected = tableRow.dataset.path;
    updateCrumbs();
    viewer
      .querySelectorAll('.data-table tbody tr.selected')
      .forEach((row) => row.classList.remove('selected'));
    tableRow.classList.add('selected');
    return;
  }
  const drill = event.target.closest('.path-drill[data-path]');
  if (drill) {
    state.selected = drill.dataset.path;
    updateCrumbs();
    renderPathPanel();
    graphCleanup?.select?.(nearestContainerPath(state.shown, state.selected));
    return;
  }
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
viewer.addEventListener('pointerdown', (event) => {
  const splitter = event.target.closest('[data-path-preview-splitter]');
  if (!splitter) return;
  pathPreviewResizing = true;
  splitter.setPointerCapture(event.pointerId);
  splitter.classList.add('dragging');
  event.preventDefault();
});
viewer.addEventListener('pointermove', (event) => {
  if (!pathPreviewResizing) return;
  const body =
    event.target.closest('.path-explorer-body') ?? $('#path-explorer .path-explorer-body');
  if (!body) return;
  const bounds = body.getBoundingClientRect();
  const vertical = window.matchMedia('(max-width: 560px)').matches;
  const position = vertical ? event.clientY - bounds.top : event.clientX - bounds.left;
  const length = vertical ? bounds.height : bounds.width;
  state.pathNavRatio = Math.max(30, Math.min(75, (position / length) * 100));
  $('#path-explorer').style.setProperty(
    vertical ? '--path-nav-height' : '--path-nav-width',
    `${state.pathNavRatio}%`,
  );
});
const stopPathPreviewResize = () => {
  pathPreviewResizing = false;
  viewer.querySelector('[data-path-preview-splitter]')?.classList.remove('dragging');
};
viewer.addEventListener('pointerup', stopPathPreviewResize);
viewer.addEventListener('pointercancel', stopPathPreviewResize);
function commitPathUpdate(updated, selectedPath = state.selected) {
  const text = serializeNode(updated, state.format);
  source.value = text;
  const active = state.documents.find((item) => item.id === state.activeDocumentId);
  if (active) {
    active.originalText = text;
    active.originalFormat = state.format;
  }
  syncOriginalSourceView(text, state.format);
  setSourceLanguage(state.format);
  updateInputExtension(state.format);
  state.root = parseInput(text, state.format);
  state.shown = state.expand ? expandNested(state.root, getDepthLimit()) : state.root;
  state.selected = findPath(state.shown, selectedPath) ? selectedPath : '$';
  syncActiveDocument();
  $('#input-format-label').textContent = formatLabel(state.format);
  $('#input-bytes').textContent = `${new Blob([text]).size.toLocaleString()} B`;
  render();
  $('#status').textContent = '路径内容已更新';
}
viewer.addEventListener('change', (event) => {
  const keyInput = event.target.closest('.path-key-input');
  const valueInput = event.target.closest('.path-value-input');
  if (!keyInput && !valueInput) return;
  const path = (keyInput ?? valueInput).dataset.path;
  try {
    let updated;
    let selectedPath = state.selected;
    if (keyInput) {
      const nextKey = keyInput.value.trim();
      const previousKey = keyInput.dataset.originalKey;
      if (!nextKey) throw new Error('字段名不能为空。');
      if (nextKey === previousKey) return;
      updated = renamePathKey(state.shown, path, nextKey);
      if (updated === state.shown) throw new Error('找不到要修改的字段。');
      const newPath = `${path.slice(0, path.lastIndexOf('.') + 1)}${nextKey}`;
      if (
        selectedPath === path ||
        selectedPath.startsWith(`${path}.`) ||
        selectedPath.startsWith(`${path}[`)
      ) {
        selectedPath = `${newPath}${selectedPath.slice(path.length)}`;
      }
    } else {
      const type = valueInput.dataset.valueType;
      let replacement;
      if (type === 'boolean') replacement = { type, value: valueInput.value === 'true' };
      else if (type === 'string') replacement = { type, value: valueInput.value };
      else if (type === 'null') replacement = parseInput(valueInput.value, 'json');
      else {
        replacement = parseInput(valueInput.value, 'json');
        if (replacement.type !== 'number') throw new Error('请输入有效数字。');
      }
      updated = replacePath(state.shown, path, replacement);
      if (updated === state.shown) throw new Error('找不到要修改的值。');
      selectedPath = path;
    }
    commitPathUpdate(updated, selectedPath);
  } catch (error) {
    $('#status').textContent = `修改失败：${error.message}`;
    if (state.mode === 'graph') renderPathPanel();
    else render();
  }
});
viewer.addEventListener('keydown', (event) => {
  if (event.target.matches('[data-path-preview-splitter]')) {
    const vertical = window.matchMedia('(max-width: 560px)').matches;
    if ((!vertical && event.key === 'ArrowLeft') || (vertical && event.key === 'ArrowUp'))
      state.pathNavRatio = Math.max(30, state.pathNavRatio - 2);
    else if ((!vertical && event.key === 'ArrowRight') || (vertical && event.key === 'ArrowDown'))
      state.pathNavRatio = Math.min(75, state.pathNavRatio + 2);
    else return;
    $('#path-explorer').style.setProperty(
      vertical ? '--path-nav-height' : '--path-nav-width',
      `${state.pathNavRatio}%`,
    );
    event.preventDefault();
    return;
  }
  if (event.key === 'Enter' && event.target.matches('.path-key-input, .path-value-input')) {
    event.preventDefault();
    event.target.blur();
  }
});
let originalTextTimer;
let originalAutoFormatTimer;
let compareOriginalTextTimer;
let sourceAutoFormatTimer;
let compareAutoFormatTimer;
let originalFormatTimer;
sourceView.dom.addEventListener('input', () => {
  syncActiveDocument();
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
