import './style.css';
import './landing.css';
import './landing-theme.css';

document.querySelector('#landing').innerHTML = `
  <header class="landing-nav">
    <a class="brand" href="./"><span class="brand-mark">J</span><span>json<span class="brand-accent">atlas</span></span></a>
    <nav>
      <a href="#features">功能</a><a href="#privacy">隐私</a>
      <div class="theme-switcher" role="group" aria-label="主题模式">
        <button type="button" data-theme-choice="system" aria-label="跟随系统" title="跟随系统" aria-pressed="false"><svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="3.5" width="14" height="10" rx="2"></rect><path d="M7 16.5h6M10 13.5v3"></path></svg></button>
        <button type="button" data-theme-choice="light" aria-label="浅色主题" title="浅色主题" aria-pressed="false"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="3.2"></circle><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.35 4.35l1.4 1.4m8.5 8.5 1.4 1.4m0-11.3-1.4 1.4m-8.5 8.5-1.4 1.4"></path></svg></button>
        <button type="button" data-theme-choice="dark" aria-label="深色主题" title="深色主题" aria-pressed="false"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M15.9 12.7A7 7 0 0 1 7.3 4.1 7 7 0 1 0 15.9 12.7Z"></path></svg></button>
      </div>
      <a class="github-link" href="https://github.com/Ice-Pure-Water/json-atlas" target="_blank" rel="noreferrer" aria-label="在 GitHub 查看 JSON Atlas"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.56.1.76-.24.76-.54v-2.08c-3.1.67-3.76-1.32-3.76-1.32-.5-1.29-1.24-1.63-1.24-1.63-1.01-.69.08-.68.08-.68 1.12.08 1.71 1.15 1.71 1.15 1 1.7 2.61 1.21 3.25.93.1-.72.39-1.21.71-1.49-2.48-.28-5.09-1.24-5.09-5.52 0-1.22.44-2.22 1.15-3-.12-.29-.5-1.43.11-2.98 0 0 .94-.3 3.05 1.15a10.6 10.6 0 0 1 5.55 0c2.11-1.45 3.05-1.15 3.05-1.15.61 1.55.23 2.69.11 2.98.72.78 1.15 1.78 1.15 3 0 4.29-2.62 5.23-5.11 5.51.4.35.76 1.02.76 2.06v3.05c0 .3.2.65.77.54A11.1 11.1 0 0 0 12 .9Z"></path></svg><span>GitHub</span></a>
      <a class="button button-dark" href="./workspace.html">打开工作台 <span>↗</span></a>
    </nav>
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
  <footer class="landing-footer"><span><b>JSON ATLAS</b>　·　开源　·　本地优先</span><a class="landing-repository-link" href="https://github.com/Ice-Pure-Water/json-atlas" target="_blank" rel="noreferrer">github.com/Ice-Pure-Water/json-atlas ↗</a><span>MIT License</span></footer>
`;

const themeButtons = [...document.querySelectorAll('[data-theme-choice]')];
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme(choice) {
  const dark = choice === 'dark' || (choice === 'system' && systemTheme.matches);
  document.body.classList.toggle('theme-dark', dark);
  document.body.dataset.theme = choice;
  themeButtons.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.themeChoice === choice));
  });
}
const savedTheme = localStorage.getItem('json-atlas-theme') || 'system';
applyTheme(savedTheme);
themeButtons.forEach((button) =>
  button.addEventListener('click', () => {
    const choice = button.dataset.themeChoice;
    localStorage.setItem('json-atlas-theme', choice);
    applyTheme(choice);
  }),
);
systemTheme.addEventListener('change', () => {
  if (document.body.dataset.theme === 'system') applyTheme('system');
});
