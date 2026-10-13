export function mountWorkspaceShell(root) {
  root.innerHTML = `
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
}
