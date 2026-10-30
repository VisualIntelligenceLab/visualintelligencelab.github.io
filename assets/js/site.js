/* Shared site shell and progressive enhancements. Works over file:// and HTTP. */
(() => {
  'use strict';
  const page = document.body.dataset.page || '';
  // Public account homepages, shared by the footer and platform directories.
  const platforms = [
    { name: 'GitHub', username: 'VisualIntelligenceLab', href: 'https://github.com/VisualIntelligenceLab' },
    { name: 'Gitee', username: 'VisualIntelligenceLab', href: 'https://gitee.com/VisualIntelligenceLab' },
    { name: 'GitCode', username: 'VisualIntelligenceLab', href: 'https://gitcode.com/VisualIntelligenceLab' },
    { name: 'ModelScope', username: 'VisualIntelligence', href: 'https://www.modelscope.cn/profile/VisualIntelligence' },
    { name: 'Hugging Face', username: 'VisualIntelligence', href: 'https://huggingface.co/VisualIntelligence' },
    { name: 'OpenDataLab', username: 'VisualIntelligenceLab', href: 'https://openxlab.org.cn/usercenter/VisualIntelligenceLab?vtab=create&module=datasets' }
  ];
  const platformFooter = platforms.map(platform => platform.href
    ? `<a href="${platform.href}" target="_blank" rel="noopener noreferrer">${platform.name} ↗</a>`
    : `<span class="platform-pending">${platform.name} · 主页待补充</span>`
  ).join('');
  const links = [
    ['index.html', 'index', '首页'],
    ['research.html', 'research', '研究方向'],
    ['publications.html', 'publications', '成果与开源'],
    ['team.html', 'team', '团队'],
    ['join.html', 'join', '加入我们'],
    ['portal.html', 'portal', '成员入口 ↗']
  ];
  const nav = links.map(([href, key, label]) =>
    `<a href="${href}"${key === 'portal' ? ' class="nav-portal"' : ''}${key === page ? ' aria-current="page"' : ''}>${label}</a>`
  ).join('');

  document.getElementById('site-header').innerHTML = `
    <header class="site-head">
      <div class="wrap">
        <a class="brand" href="index.html" aria-label="智能视觉实验室首页">
          <span class="brand-mark" aria-hidden="true">VIL</span>
          <span class="brand-copy"><b>智能视觉实验室</b><small>Visual Intelligence Lab · HIT</small></span>
        </a>
        <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav">
          <span class="menu-label">菜单</span><span class="menu-lines" aria-hidden="true"></span>
        </button>
        <nav class="nav" id="site-nav" aria-label="主导航">${nav}</nav>
      </div>
    </header>`;

  document.getElementById('site-footer').innerHTML = `
    <footer class="site-foot"><div class="wrap">
      <div class="foot-grid">
        <div>
          <h4>Visual Intelligence Lab · HIT</h4>
          <p class="foot-name">让研究经得起验证。</p>
          <p>哈尔滨工业大学 · 智能视觉实验室<br>中国 · 哈尔滨 南岗区西大直街 92 号</p>
          <a href="mailto:visualintelligence@163.com">visualintelligence@163.com ↗</a>
        </div>
        <div><h4>Explore / 探索</h4>
          <a href="research.html">研究方向</a><a href="publications.html">成果与开源</a>
          <a href="team.html">我们的团队</a><a href="join.html">加入我们</a>
        </div>
        <div><h4>Connect / 连接</h4>
          ${platformFooter}
          <a href="portal.html">成员入口 ↗</a>
        </div>
      </div>
      <div class="copy"><span>© ${new Date().getFullYear()} Visual Intelligence Lab, Harbin Institute of Technology</span>
        <span>内容更新 / 2026.10</span></div>
    </div></footer>`;

  document.querySelectorAll('[data-platform-links]').forEach(mount => {
    mount.innerHTML = platforms.map(platform => {
      const content = `<b>${platform.name}</b><span class="platform-account">${platform.username}</span>`;
      return platform.href
        ? `<a data-platform-entry href="${platform.href}" target="_blank" rel="noopener noreferrer">${content}</a>`
        : `<div data-platform-entry class="platform-pending-card">${content}<span>公开主页地址待补充</span></div>`;
    }).join('');
  });

  const toggle = document.querySelector('.menu-toggle');
  const navigation = document.getElementById('site-nav');
  const mobile = window.matchMedia('(max-width: 900px)');
  function closeMenu(returnFocus = false) {
    navigation.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.querySelector('.menu-label').textContent = '菜单';
    if (returnFocus) toggle.focus();
  }
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('.menu-label').textContent = open ? '收起' : '菜单';
    navigation.classList.toggle('is-open', open);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') closeMenu(true);
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.site-head')) closeMenu();
  });
  navigation.addEventListener('click', event => {
    if (event.target.closest('a')) closeMenu();
  });
  mobile.addEventListener('change', () => closeMenu());

  // Keep wide tables scrollable without causing the whole page to overflow.
  const tableRegions = [];
  document.querySelectorAll('table').forEach((table, index) => {
    const heading = table.closest('section')?.querySelector('h2');
    const region = document.createElement('div');
    region.className = 'table-scroll';
    region.setAttribute('role', 'region');
    region.setAttribute('aria-label', `${heading?.textContent || `数据表 ${index + 1}`}（可横向滚动）`);
    table.before(region);
    region.append(table);
    table.querySelectorAll('thead th').forEach(th => th.scope = 'col');
    tableRegions.push(region);
  });
  function updateTableFocus() {
    tableRegions.forEach(region => {
      if (region.scrollWidth > region.clientWidth) region.tabIndex = 0;
      else region.removeAttribute('tabindex');
    });
  }
  updateTableFocus();
  window.addEventListener('resize', updateTableFocus, { passive: true });

  const search = document.getElementById('resource-search');
  if (search) {
    document.querySelector('.portal-tools').hidden = false;
    const sections = [...document.querySelectorAll('.resource-section')];
    const resources = [...document.querySelectorAll('.portal-grid a, .portal-grid .platform-pending-card')];
    const count = document.getElementById('resource-count');
    const empty = document.getElementById('resource-empty');
    const reset = document.getElementById('resource-reset');
    const normalize = text => text.normalize('NFKC').toLocaleLowerCase().trim();
    function filterResources() {
      const terms = normalize(search.value).split(/\s+/).filter(Boolean);
      let visible = 0;
      resources.forEach(link => {
        const match = terms.every(term => normalize(link.textContent).includes(term));
        link.hidden = !match;
        if (match) visible++;
      });
      sections.forEach(section => {
        section.hidden = ![...section.querySelectorAll('.portal-grid a, .portal-grid .platform-pending-card')].some(link => !link.hidden);
      });
      count.textContent = `显示 ${visible} / ${resources.length} 项资源`;
      empty.hidden = visible !== 0;
      reset.hidden = search.value.length === 0;
    }
    search.addEventListener('input', filterResources);
    search.addEventListener('keydown', event => {
      if (event.key === 'Escape') { search.value = ''; filterResources(); }
    });
    reset.addEventListener('click', () => { search.value = ''; filterResources(); search.focus(); });
    filterResources();
  }
})();
