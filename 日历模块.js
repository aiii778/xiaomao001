/* ============================================================
   日历模块（豆包版）· 独立组件脚本
   依赖：solarlunar.min.js（可选，提供农历小字）；无其他依赖
   宿主接线：
     CalendarModule.onChange(function(day){ ... });   // day 为 'YYYY-MM-DD' 或 'all'
     宿主侧切换日期后调用 CalendarModule.redraw() 同步高亮
   ============================================================ */
/* ========= 日历模块（豆包版，独立组件） ========= */
(function () {
  const WEEK = ['日','一','二','三','四','五','六'];
  const bar     = document.getElementById('cmBar');
  const barText = document.getElementById('cmBarText');
  const toggle  = document.getElementById('cmToggle');
  const panel   = document.getElementById('cmPanel');
  const title   = document.getElementById('cmTitle');
  const grid    = document.getElementById('cmGrid');

  let open = false;
  let viewY = new Date().getFullYear();
  let viewM = new Date().getMonth();

  // 农历/节气提供者：solarlunar 已引入则显示小字，否则自动隐藏该行
  let lunarProvider = null;
  try { if (window.solarLunar) lunarProvider = lunarOf; } catch (e) {}
  // 兼容不同构建：有的把 API 挂在 .default 下
  function SL() { return solarLunar.solar2lunar ? solarLunar : solarLunar.default; }
  function pad(n) { return String(n).padStart(2, '0'); }
  function fmt(d) { return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()); }
  function lunarOf(y, m, d) {
    try {
      const r = SL().solar2lunar(y, m, d);
      if (r.isTerm && r.term) return r.term;
      if (r.dayCn === '初一') return r.monthCn;
      return r.dayCn;
    } catch (e) { return ''; }
  }

  /* 折叠条：时间每秒刷新，永不空白 */
  function tick() {
    const t = new Date();
    barText.textContent =
      t.getFullYear() + '/' + pad(t.getMonth()+1) + '/' + pad(t.getDate()) +
      ' 星期' + WEEK[t.getDay()] + ' ' + pad(t.getHours()) + ':' + pad(t.getMinutes());
  }
  tick();
  setInterval(tick, 1000);

  /* 面板定位：贴折叠条正下方，放不下翻到上方 */
  function place() {
    const r = bar.getBoundingClientRect();
    const h = panel.offsetHeight || 360;
    const w = panel.offsetWidth  || 296;
    let left = r.left;
    if (left + w > innerWidth - 8) left = innerWidth - w - 8;
    if (left < 8) left = 8;
    const top = (r.bottom + 6 + h > innerHeight - 8) ? (r.top - h - 6) : (r.bottom + 6);
    panel.style.left = left + 'px';
    panel.style.top  = Math.max(8, top) + 'px';
  }

  let onPick = null;   // 宿主通过 CalendarModule.onChange(fn) 接收日期切换

  function setOpen(v) {
    open = v;
    panel.classList.toggle('show', open);
    toggle.textContent = open ? '⌃' : '⌄';
    if (open) { draw(); place(); }
  }
  bar.addEventListener('click', function (e) { if (!e.target.closest('.cm-toggle')) setOpen(!open); });
  toggle.addEventListener('click', function (e) { e.stopPropagation(); setOpen(!open); });
  document.getElementById('cmPrev').addEventListener('click', function (e) { e.stopPropagation(); viewM--; if (viewM < 0) { viewM = 11; viewY--; } draw(); });
  document.getElementById('cmNext').addEventListener('click', function (e) { e.stopPropagation(); viewM++; if (viewM > 11) { viewM = 0; viewY++; } draw(); });
  document.getElementById('cmToday').addEventListener('click', function (e) { e.stopPropagation(); if (onPick) onPick(fmt(new Date())); setOpen(false); });
  document.getElementById('cmAll').addEventListener('click', function (e) { e.stopPropagation(); if (onPick) onPick('all'); setOpen(false); });
  // 点面板外部关闭
  document.addEventListener('mousedown', function (e) {
    if (open && !e.target.closest('#cmPanel') && !e.target.closest('#cmBar')) setOpen(false);
  });
  window.addEventListener('resize', function () { if (open) place(); });

  function draw() {
    title.textContent = viewY + '年' + (viewM + 1) + '月';
    const now = new Date();
    const selDs = (typeof viewDay !== 'undefined' && viewDay !== 'all') ? viewDay : null;
    const startWk  = (new Date(viewY, viewM, 1).getDay() + 6) % 7;  // 周一起始
    const daysInM  = new Date(viewY, viewM + 1, 0).getDate();
    const daysPrev = new Date(viewY, viewM, 0).getDate();

    let h = ['一','二','三','四','五','六','日']
      .map(function (w) { return '<div class="cm-wk">' + w + '</div>'; }).join('');

    for (let i = 0; i < 42; i++) {
      const n = i - startWk + 1;
      let y, m, num, cls = 'cm-d';
      if (n < 1)            { y = viewY; m = viewM;     num = daysPrev + n; cls += ' other'; }
      else if (n > daysInM) { y = viewY; m = viewM + 2; num = n - daysInM; cls += ' other'; }
      else {
        y = viewY; m = viewM + 1; num = n;
        const ds = fmt(new Date(y, m - 1, num));
        if (ds === fmt(now)) cls += ' today';
        if (ds === selDs)    cls += ' sel';
      }
      const real = new Date(y, m - 1, num);
      const lu = lunarProvider ? (lunarProvider(y, m, num) || '&nbsp;') : '';
      if (!lunarProvider) cls += ' no-lunar';
      h += '<div class="' + cls + '" data-ds="' + fmt(real) + '">' +
             '<span class="cm-num">' + num + '</span>' +
             '<span class="cm-lu">' + (lu || '&nbsp;') + '</span>' +
           '</div>';
    }
    grid.innerHTML = h;
    grid.querySelectorAll('.cm-d').forEach(function (c) {
      c.addEventListener('click', function () { if (onPick) onPick(c.dataset.ds); setOpen(false); });
    });
  }

  /* 对外接口：onChange 接收日期切换；redraw 供宿主同步高亮 */
  window.CalendarModule = {
    open:  function () { setOpen(true); },
    close: function () { setOpen(false); },
    redraw: function () { if (open) draw(); },
    setLunar: function (fn) { lunarProvider = fn; draw(); },
    onChange: function (fn) { onPick = fn; }
  };
})();
/* ================= 日历模块结束 ================= */