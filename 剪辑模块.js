/* ============================================================
   剪辑模块（剪映式音频剪辑台）· 独立组件
   依赖：宿主提供 idbGet(key)/idbPut(key,blob)（IndexedDB 文件存取）
   对外接口 window.AudioEditor：
     .isAudio(att)            判断附件是否音频
     .open(boxId, attIdx)     打开剪辑台（单文件）
     .pick(boxId)             多个音频时弹出选择菜单
     .merge(boxId)            按附件顺序首尾合并，结果存新盒子
     .isOpen()                剪辑台是否打开
   交互：点击/拖动定位 · 空格播放暂停 · B 下刀 · 退格删片段 ·
         保存时保留片段自动首尾相接（消除空白）
   ============================================================ */
(function () {
  let boxOf = null;
  let ae = null;
  let PEAKS = null;
  const PEAK_N = 2000;

  /* ---------- 自建 DOM ---------- */
  const root = document.createElement('div');
  root.id = 'audEd';
  root.innerHTML =
    '<div id="audEdMain">' +
      '<div id="audEdHead">' +
        '<span id="audEdName"></span>' +
        '<button id="aePlay">▶ 播放</button>' +
        '<button id="aeSave" class="primary">💾 保存到盒子</button>' +
        '<button id="aeClose">✕ 关闭</button>' +
      '</div>' +
      '<canvas id="aeWave"></canvas>' +
      '<div id="aeTip">点击/拖动时间轴定位 · <b>空格</b> 播放/暂停 · <b>B</b> 在播放头下刀 · 点选片段后 <b>退格键</b> 删除 · 保存时片段<b>自动首尾相接</b>（消除空白）</div>' +
    '</div>';
  document.body.appendChild(root);

  const cv = root.querySelector('#aeWave');
  const playBtn = root.querySelector('#aePlay');
  const fmtT = t => { const m = Math.floor(t / 60), s2 = Math.floor(t % 60); return m + ':' + String(s2).padStart(2, '0'); };
  const isAudio = a => {
    const m = (a.mime || '').trim().toLowerCase(), n = (a.name || '').trim().toLowerCase();
    return m.startsWith('audio') || /\.(mp3|wav|m4a|aac|ogg|flac|webm)$/.test(n);
  };
  const isVideo = a => {
    const m = (a.mime || '').trim().toLowerCase(), n = (a.name || '').trim().toLowerCase();
    return m.startsWith('video') || /\.(mp4|mov|mkv|avi|m4v)$/.test(n);
  };

  /* ---------- 轻提示 toast 与处理中遮罩 ---------- */
  function toast(msg, ms) {
    let t = document.getElementById('aeToast');
    if (!t) {
      t = document.createElement('div'); t.id = 'aeToast';
      t.style.cssText = 'position:fixed;top:64px;left:50%;transform:translateX(-50%);z-index:230;background:#2a3240;color:#e8ecf1;border:1px solid #4f8cff;border-radius:10px;padding:10px 18px;font-size:13px;box-shadow:0 8px 30px rgba(0,0,0,.5);transition:opacity .3s;pointer-events:none';
      document.body.appendChild(t);
    }
    t.textContent = msg; t.style.opacity = '1';
    clearTimeout(t._tm);
    t._tm = setTimeout(() => t.style.opacity = '0', ms || 3200);
  }
  function mask(msg) {
    let m = document.getElementById('aeMask');
    if (!msg) { if (m) m.remove(); return; }
    if (!m) {
      m = document.createElement('div'); m.id = 'aeMask';
      m.style.cssText = 'position:fixed;inset:0;z-index:225;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center';
      m.innerHTML = '<div style="background:#1e232b;border:1px solid #4f8cff;border-radius:12px;padding:16px 28px;color:#e8ecf1;font-size:14px">' + msg + '</div>';
      document.body.appendChild(m);
    } else m.querySelector('div').innerHTML = msg;
  }

  /* ---------- 打开 / 关闭 ---------- */
  async function open(boxId, attIdx) {
    const b = boxOf(boxId); if (!b) return;
    const att = (b.atts || [])[attIdx]; if (!att) return;
    const blob = await idbGet(att.key);
    if (!blob) { alert('文件读取失败：' + (att.name || '（未命名附件）') + '。可能文件已被删除，请重新拖入。'); return; }
    if (blob.size > 50 * 1024 * 1024 && !confirm('这个音频超过 50MB，解码需要一些时间，可能卡顿。继续打开？')) return;
    mask('⏳ 正在解码音频…');
    await new Promise(r => setTimeout(r, 30));   // 让遮罩先画出来
    const acx = new (window.AudioContext || window.webkitAudioContext)();
    let buf;
    try { buf = await acx.decodeAudioData(await blob.arrayBuffer()); }
    catch (e) { mask(); acx.close(); alert('无法解码该音频：' + (att.name || '') + '（' + e.message + '）。当前支持 mp3 / wav / m4a / aac / ogg / flac。'); return; }
    acx.close();
    mask();
    if (buf.duration > 1800 && !confirm('该音频长约 ' + fmtT(buf.duration) + '，波形与导出都会较慢，继续？')) return;
    const ch = buf.getChannelData(0), spp = ch.length / PEAK_N;
    PEAKS = [];
    for (let i = 0; i < PEAK_N; i++) {
      let mn = 1, mx = -1;
      const i0 = Math.floor(i * spp), i1 = Math.min(ch.length, Math.floor((i + 1) * spp));
      for (let j = i0; j < i1; j++) { const v = ch[j]; if (v < mn) mn = v; if (v > mx) mx = v; }
      PEAKS.push([mn, mx]);
    }
    ae = { box: b, att, buf, segs: [{ a: 0, b: buf.duration, gone: false }], sel: 0, ph: 0, playing: false };
    root.querySelector('#audEdName').textContent = '✂ 剪辑 · ' + att.name;
    root.classList.add('show');
    draw();
  }
  function close() {
    stopPlay();
    ae = null; PEAKS = null;
    root.classList.remove('show');
  }
  function isOpen() { return !!ae; }

  /* ---------- 片段模型 ---------- */
  const segAt = t => ae.segs.findIndex(s => t >= s.a && t <= s.b);
  const kept = () => ae.segs.filter(s => !s.gone).reduce((s, x) => s + (x.b - x.a), 0);

  function splitAt() {
    const i = segAt(ae.ph); if (i < 0) return;
    const s = ae.segs[i];
    if (ae.ph - s.a < 0.05 || s.b - ae.ph < 0.05) return;
    ae.segs.splice(i, 1, { a: s.a, b: ae.ph, gone: s.gone }, { a: ae.ph, b: s.b, gone: s.gone });
    ae.sel = i + 1; draw();
  }
  function delSeg() {
    if (ae.segs[ae.sel] && !ae.segs[ae.sel].gone) ae.segs[ae.sel].gone = true;
    const next = ae.segs.findIndex(s => !s.gone);
    ae.sel = next >= 0 ? next : 0;
    if (segAt(ae.ph) < 0) { const k = ae.segs.find(s => !s.gone); ae.ph = k ? k.a : 0; }
    draw();
  }

  /* ---------- 播放（自动跳过已删除片段） ---------- */
  function playPause() {
    if (ae.playing) { stopPlay(false); return; }
    const acx = new (window.AudioContext || window.webkitAudioContext)();
    const src = acx.createBufferSource();
    src.buffer = ae.buf; src.connect(acx.destination);
    const plan = [];
    let cursor = acx.currentTime + 0.06, started = false;
    ae.segs.forEach(s => {
      if (s.gone) return;
      let a = s.a;
      if (!started) { if (ae.ph >= s.b) return; a = Math.max(a, ae.ph); started = true; }
      plan.push({ sa: a, sb: s.b, pa: cursor - acx.currentTime, pb: cursor - acx.currentTime + (s.b - a) });
      src.start(cursor, a, s.b - a);
      cursor += s.b - a;
    });
    ae.ctx = acx; ae.src = src; ae.plan = plan; ae.t0 = acx.currentTime; ae.playing = true;
    playBtn.textContent = '⏸ 暂停';
    src.onended = () => { if (ae && ae.playing && ae.ctx === acx) stopPlay(true); };
    (function tick() {
      if (!ae || !ae.playing || ae.ctx !== acx) return;
      const el = acx.currentTime - ae.t0;
      let ph = null;
      for (const p of plan) if (el >= p.pa && el <= p.pb) { ph = p.sa + (el - p.pa); break; }
      if (ph === null) { if (plan.length && el > plan[plan.length - 1].pb) { stopPlay(true); } return; }
      ae.ph = ph; draw();
      requestAnimationFrame(tick);
    })();
  }
  function stopPlay(atEnd) {
    if (!ae || !ae.playing) return;
    try { ae.src.onended = null; ae.src.stop(); } catch (e) {}
    try { ae.ctx.close(); } catch (e) {}
    if (atEnd) { const k = ae.segs.filter(s => !s.gone); if (k.length) ae.ph = k[k.length - 1].b; }
    ae.playing = false; ae.src = null; ae.ctx = null;
    playBtn.textContent = '▶ 播放';
    draw();
  }

  /* ---------- 波形绘制 ---------- */
  function draw() {
    if (!ae) return;
    const w = cv.clientWidth || 800, h = 190;
    if (cv.width !== w) cv.width = w;
    cv.height = h;
    const g = cv.getContext('2d');
    const dur = ae.buf.duration;
    g.fillStyle = '#12161d'; g.fillRect(0, 0, w, h);
    const stepT = dur > 600 ? 60 : dur > 120 ? 10 : 5;
    g.font = '10px sans-serif'; g.fillStyle = '#5a6270'; g.strokeStyle = '#232a34';
    for (let t = 0; t <= dur; t += stepT) {
      const x = Math.round(t / dur * w) + 0.5;
      g.beginPath(); g.moveTo(x, h - 16); g.lineTo(x, h); g.stroke();
      g.fillText(fmtT(t), x + 3, h - 4);
    }
    const mid = (h - 16) / 2;
    for (let x = 0; x < w; x++) {
      const pk = PEAKS[Math.floor(x / w * PEAK_N)];
      if (!pk) continue;
      const si = segAt(x / w * dur);
      const gone = si < 0 || ae.segs[si].gone;
      g.strokeStyle = gone ? 'rgba(90,98,112,.35)' : '#4f8cff';
      g.beginPath();
      g.moveTo(x + 0.5, mid - pk[1] * mid * 0.92);
      g.lineTo(x + 0.5, mid - pk[0] * mid * 0.92 + 1);
      g.stroke();
    }
    g.setLineDash([3, 3]);
    ae.segs.forEach((s, i) => {
      [s.a, s.b].forEach(t => {
        const x = Math.round(t / dur * w) + 0.5;
        g.strokeStyle = (i === ae.sel && !s.gone) ? '#ffb84f' : '#7a828f';
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h - 16); g.stroke();
      });
    });
    g.setLineDash([]);
    const px = Math.round(ae.ph / dur * w) + 0.5;
    g.strokeStyle = '#e5484d'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(px, 0); g.lineTo(px, h); g.stroke();
    g.lineWidth = 1;
  }

  /* ---------- 时间轴交互 ---------- */
  let scrub = false;
  function seekEvt(e) {
    const r = cv.getBoundingClientRect();
    ae.ph = Math.max(0, Math.min(ae.buf.duration, (e.clientX - r.left) / r.width * ae.buf.duration));
    const i = segAt(ae.ph); if (i >= 0) ae.sel = i;
    draw();
  }
  cv.addEventListener('mousedown', e => { scrub = true; seekEvt(e); });
  window.addEventListener('mousemove', e => { if (scrub && ae) seekEvt(e); });
  window.addEventListener('mouseup', () => { scrub = false; });

  /* ---------- 键盘（面板打开时接管，阻止画布快捷键） ---------- */
  window.addEventListener('keydown', e => {
    if (!ae) return;
    if (e.target.closest && e.target.closest('input,textarea')) return;
    if (e.code === 'Space') { e.preventDefault(); e.stopPropagation(); playPause(); }
    else if (e.key === 'b' || e.key === 'B') { e.preventDefault(); e.stopPropagation(); splitAt(); }
    else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); e.stopPropagation(); delSeg(); }
    else if (e.key === 'Escape') { e.stopPropagation(); close(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); e.stopPropagation(); saveCut(); }
  }, true);

  /* ---------- WAV 编码 ---------- */
  function encodeWAV(chans, rate) {
    const nCh = chans.length, len = chans[0].length;
    const buf = new ArrayBuffer(44 + len * nCh * 2), v = new DataView(buf);
    const ws = (o, s2) => { for (let i = 0; i < s2.length; i++) v.setUint8(o + i, s2.charCodeAt(i)); };
    ws(0, 'RIFF'); v.setUint32(4, 36 + len * nCh * 2, true); ws(8, 'WAVE');
    ws(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, nCh, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * nCh * 2, true);
    v.setUint16(32, nCh * 2, true); v.setUint16(34, 16, true);
    ws(36, 'data'); v.setUint32(40, len * nCh * 2, true);
    let o = 44;
    for (let i = 0; i < len; i++) for (let c = 0; c < nCh; c++) {
      let x = Math.max(-1, Math.min(1, chans[c][i]));
      v.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7FFF, true); o += 2;
    }
    return new Blob([buf], { type: 'audio/wav' });
  }

  function saveCut() {
    mask('⏳ 正在导出剪辑结果…');
    setTimeout(() => { try { doSaveCut(); } finally { mask(); } }, 30);
  }
  function doSaveCut() {
    const D = ae.buf, rate = D.sampleRate, nCh = Math.min(2, D.numberOfChannels);
    const perCh = []; for (let c = 0; c < nCh; c++) perCh.push(new Float32Array(Math.ceil(kept() * rate)));
    let off = 0;
    ae.segs.filter(s => !s.gone).forEach(s => {
      const a = Math.floor(s.a * rate), b2 = Math.floor(s.b * rate), n = b2 - a;
      for (let c = 0; c < nCh; c++) {
        const src = D.getChannelData(Math.min(c, D.numberOfChannels - 1));
        perCh[c].set(src.subarray(a, b2), off);
      }
      off += n;
    });
    const box = ae.box, name = ae.att.name.replace(/\.[^.]+$/, '') + '-剪辑.wav';
    putResult(encodeWAV(perCh, rate), name, box, null, null, () => close());
  }

  /* ---------- 多文件选择菜单 ---------- */
  function pick(boxId) {
    const b = boxOf(boxId); if (!b) return;
    const auds = (b.atts || []).map((a, i) => ({ a, i })).filter(x => isAudio(x.a));
    if (!auds.length) { alert('盒子里没有音频文件'); return; }
    if (auds.length === 1) { open(boxId, auds[0].i); return; }
    const old = document.getElementById('aePicker'); if (old) old.remove();
    const m = document.createElement('div');
    m.id = 'aePicker';
    m.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:220;background:#1e232b;border:1px solid #3a4250;border-radius:12px;padding:10px;min-width:260px;box-shadow:0 12px 50px rgba(0,0,0,.6)';
    m.innerHTML = '<div style="color:#8b93a1;font-size:12px;padding:4px 8px 8px">选择要剪辑的音频：</div>' +
      auds.map((x, k) => '<button data-i="' + x.i + '" style="display:block;width:100%;text-align:left;background:none;border:none;color:#dde3ea;padding:9px 12px;border-radius:8px;cursor:pointer;font-size:13px;' + (k ? 'border-top:1px solid #262c36;' : '') + '">🎵 ' + x.a.name + '</button>').join('');
    document.body.appendChild(m);
    m.addEventListener('click', e => {
      const btn = e.target.closest('button[data-i]'); if (!btn) return;
      m.remove(); open(boxId, +btn.dataset.i);
    });
    setTimeout(() => document.addEventListener('mousedown', function h(ev) {
      if (!ev.target.closest('#aePicker')) { m.remove(); document.removeEventListener('mousedown', h); }
    }), 0);
  }

  /* ---------- 合并：按附件顺序首尾拼接，不弹界面 ---------- */
  function resampleF32(data, from, to) {
    if (from === to) return data;
    const ratio = to / from, out = new Float32Array(Math.round(data.length * ratio));
    for (let i = 0; i < out.length; i++) {
      const p = i / ratio, i0 = Math.floor(p), fr = p - i0;
      const a = data[i0] || 0, b2 = data[i0 + 1] !== undefined ? data[i0 + 1] : a;
      out[i] = a + (b2 - a) * fr;
    }
    return out;
  }
  async function decodeAll(attList) {
    const acx = new (window.AudioContext || window.webkitAudioContext)();
    const bufs = [];
    for (const a of attList) {
      const blob = await idbGet(a.key);
      if (!blob) { acx.close(); throw new Error('文件读取失败：' + a.name); }
      try { bufs.push(await acx.decodeAudioData(await blob.arrayBuffer())); }
      catch (e) { acx.close(); throw new Error('无法解码：' + a.name); }
    }
    acx.close();
    return bufs;
  }
  async function merge(boxId) {
    const b = boxOf(boxId); if (!b) return;
    const auds = (b.atts || []).filter(isAudio);
    if (auds.length < 2) { toast('合并需要盒子里有 2 个以上音频文件'); return; }
    const totalMB = Math.round(auds.reduce((s, a) => s + (a.size || 0), 0) / 1048576);
    if (totalMB > 50 && !confirm('待合并音频共约 ' + totalMB + 'MB，处理需要一些时间。继续？')) return;
    let bufs;
    mask('⏳ 正在合并 ' + auds.length + ' 段音频…');
    await new Promise(r => setTimeout(r, 30));
    try { bufs = await decodeAll(auds); }
    catch (e) { mask(); alert(e.message + '。当前支持 mp3 / wav / m4a / aac / ogg / flac。'); return; }
    const rate = bufs[0].sampleRate;
    const nCh = Math.min(2, Math.max(...bufs.map(x => x.numberOfChannels)));
    const total = bufs.reduce((s, x) => s + Math.round(x.length * rate / x.sampleRate), 0);
    const perCh = []; for (let c = 0; c < nCh; c++) perCh.push(new Float32Array(total));
    let off = 0;
    bufs.forEach(x => {
      const n = Math.round(x.length * rate / x.sampleRate);
      for (let c = 0; c < nCh; c++) {
        const src = resampleF32(x.getChannelData(Math.min(c, x.numberOfChannels - 1)), x.sampleRate, rate);
        perCh[c].set(src.subarray(0, n), off);
      }
      off += n;
    });
    const dur = total / rate;
    const name = auds[0].name.replace(/\.[^.]+$/, '') + '-合并' + auds.length + '段.wav';
    mask();
    putResult(encodeWAV(perCh, rate), name, null, b, '🔗 合并音频 · ' + auds.length + ' 段 · ' + fmtT(dur), null, { center: true, doneMsg: '✅ 已合并 ' + auds.length + ' 段，时长 ' + fmtT(dur) });
  }

  /* ---------- 结果写回：有 targetBox 则加附件，否则建新盒子 ---------- */
  function putResult(blob, name, targetBox, srcBox, newText, after, opts) {
    opts = opts || {};
    const key = 'att_' + Date.now();
    idbPut(key, blob).then(() => {
      const att = { name: name, mime: 'audio/wav', key: key, size: blob.size };
      let newId = null;
      if (targetBox) { (targetBox.atts = targetBox.atts || []).push(att); }
      else {
        const sb = srcBox;
        let wx = sb.x + 60, wy = sb.y + 60;
        if (opts.center && typeof view !== 'undefined') {
          // 放到当前视口中央（世界坐标 = (屏幕中心 - 视图平移) / 缩放）
          wx = (innerWidth / 2 - view.x) / view.s;
          wy = (innerHeight / 2 - view.y) / view.s;
        }
        newId = 'b' + Date.now() + Math.floor(Math.random() * 999);
        boxes.push({
          id: newId, x: wx, y: wy, text: newText || '', img: null, type: 'text',
          font: '', color: '', atts: [att],
          day: sb.day || (typeof viewDay !== 'undefined' && viewDay !== 'all' ? viewDay : (typeof todayStr !== 'undefined' ? todayStr : undefined))
        });
      }
      save(); render();
      if (newId) {   // 高亮新盒子 2 秒
        const el = document.querySelector('.box[data-id="' + newId + '"]');
        if (el) { el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 2000); }
      }
      if (opts.doneMsg) toast(opts.doneMsg);
      if (after) after();
    });
  }

  /* ---------- 按钮 ---------- */
  playBtn.addEventListener('click', playPause);
  root.querySelector('#aeClose').addEventListener('click', close);
  root.querySelector('#aeSave').addEventListener('click', saveCut);
  root.addEventListener('mousedown', e => { if (e.target === root) close(); });

  /* ---------- 对外接口 ---------- */
  window.AudioEditor = { isAudio, isVideo, isOpen, open, pick, merge, toast, init: h => { boxOf = h.findBox; } };
})();
