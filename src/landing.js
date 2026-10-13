import './style.css';
import './landing.css';
import './landing-theme.css';

document.querySelector('#landing').innerHTML = `
  <header class="landing-nav">
    <a class="brand" href="./"><span class="brand-mark">J</span><span>json<span class="brand-accent">atlas</span></span></a>
    <nav><a href="#features">功能</a><a href="#privacy">隐私</a><label class="landing-theme-control"><span>主题</span><select id="landing-theme-select" aria-label="选择主题"><option value="system">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option></select></label><a class="button button-dark" href="./workspace.html">打开工作台 <span>↗</span></a></nav>
  </header>
  <main class="landing-main">
    <section class="landing-hero">
      <div class="landing-copy">
        <div class="eyebrow"><span class="status-dot"></span> 免费 · 开源 · 本地优先</div>
        <h1>把复杂数据，<br/><em>看清楚。</em></h1>
        <p>展开嵌套 JSON，在源码、结构表格、关系图和路径之间自由切换。无需账号，数据只在你的设备上处理。</p>
        <div class="landing-actions"><a class="button button-dark button-large" href="./workspace.html">开始处理数据 <span>→</span></a><a class="landing-secondary" href="#features">了解功能 <span>↓</span></a></div>
        <div class="landing-proof"><span>✓ 支持大整数精确解析</span><span>✓ 递归展开字符串 JSON</span><span>✓ JSON / YAML / TOML / CSV</span></div>
      </div>
      <div class="landing-preview" aria-label="关系图预览">
        <div class="preview-toolbar"><span><i></i><i></i><i></i></span><span>数据关系预览</span><span>⌕　＋　−</span></div>
        <div class="preview-canvas">
          <div class="preview-card preview-root"><small>对象 · $</small><b>用户信息</b><div><span>用户 id</span><strong>8000000000000000001</strong></div><div><span>配置</span><strong>对象 · 2</strong></div><div><span>备注</span><strong>普通备注文字…</strong></div></div>
          <div class="preview-edge edge-one"></div><div class="preview-edge edge-two"></div>
          <div class="preview-card preview-child"><small>对象 · $.配置</small><b>配置</b><div><span>地址</span><strong>苏州</strong></div><div><span>偏好</span><strong>对象 · 2</strong></div></div>
          <div class="preview-card preview-leaf"><small>对象 · $.配置.偏好</small><b>偏好</b><div><span>颜色</span><strong>蓝色</strong></div><div><span>通知</span><strong>true</strong></div></div>
        </div>
        <div class="preview-caption"><span>结构关系一目了然</span><span>拖动 · 缩放 · 搜索</span></div>
      </div>
    </section>
    <section class="landing-stats"><div><strong>5 种</strong><span>数据格式</span></div><div><strong>100%</strong><span>浏览器本地处理</span></div><div><strong>MIT</strong><span>开源许可</span></div><div><strong>0</strong><span>账号与云端保存</span></div></section>
    <section class="feature-section" id="features">
      <div class="feature-intro"><div class="eyebrow">A CLEARER WAY TO READ DATA</div><h2>一个文档，<em>多种视角。</em></h2><p>浏览、搜索和整理结构化数据，不必在几个工具之间来回搬运。</p></div>
      <div class="feature-grid">
        <article class="feature-card feature-wide"><span class="feature-index">01 / EXPLORE</span><div class="feature-icon">⌘</div><h3>沿着关系读懂嵌套结构</h3><p>对象用字段卡片呈现，嵌套对象通过连线展开，数组以表格形式显示。缩放、拖动，快速定位数据。</p><div class="feature-tags"><span>关系图</span><span>树形表格</span><span>路径导航</span></div></article>
        <article class="feature-card"><span class="feature-index">02 / EXPAND</span><div class="feature-icon">{ }</div><h3>递归解析字符串 JSON</h3><p>自动展开多层字符串化 JSON，普通文字中的花括号保持原样。</p></article>
        <article class="feature-card"><span class="feature-index">03 / CONVERT</span><div class="feature-icon">⇄</div><h3>格式化、比较与转换</h3><p>整理和压缩 JSON，比较结构差异，转换 JSON、YAML、TOML 与 CSV。</p></article>
        <article class="feature-card feature-privacy" id="privacy"><span class="feature-index">04 / PRIVATE</span><div class="feature-icon">◉</div><h3>数据留在你的设备</h3><p>解析与展示都在浏览器中完成，不需要账号，也不上传数据。</p><a href="./workspace.html">在本地开始使用　→</a></article>
      </div>
    </section>
    <section class="landing-cta"><div><div class="eyebrow">READY WHEN YOU ARE</div><h2>现在就把数据看清楚。</h2><p>免费使用，打开即用。</p></div><a class="button button-dark button-large" href="./workspace.html">打开 JSON Atlas <span>→</span></a></section>
  </main>
  <footer class="landing-footer"><span><b>JSON ATLAS</b>　·　开源　·　本地优先</span><span>MIT License</span></footer>
`;

const themeSelect = document.querySelector('#landing-theme-select');
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
