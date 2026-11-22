/* ============================================================
   多轨剪辑模块（豆包多轨剪辑台 v2 · 独立组件）
   5 轨：视频×2 / 音频×2 / 字幕×1；拖动/裁剪/吸附/分割；导出 webm
   依赖宿主：idbGet(key)、init({findBox, saveResult})
   接口：MultiTrackEditor.open(boxId) / close() / isOpen()
   ============================================================ */
(function(){

const app = document.createElement('div');
app.id = 'mt-app';
app.innerHTML = "\n  <div id=\"mt-top\">\n    <span class=\"logo\">\ud83c\udfac \u591a\u8f68\u526a\u8f91\u53f0</span>\n    <button class=\"mt-close\" id=\"mt-btnClose\">\u2715 \u5173\u95ed</button>\n    <button class=\"primary\" id=\"mt-btnVid\">\uff0b \u89c6\u9891</button>\n    <button id=\"mt-btnAud\">\uff0b \u97f3\u9891</button>\n    <button id=\"mt-btnText\">\uff0b \u5b57\u5e55</button>\n    <button id=\"mt-btnSplit\">\u2702 \u5206\u5272</button>\n    <button class=\"danger\" id=\"mt-btnDel\">\ud83d\uddd1 \u5220\u9664</button>\n    <span class=\"spacer\"></span>\n    <span class=\"tc\" id=\"mt-tc\">00:00.0 / 00:00.0</span>\n    <button id=\"mt-btnPlay\">\u25b6 \u64ad\u653e</button>\n    <span class=\"zoom\">\u7f29\u653e <input type=\"range\" id=\"mt-zoom\" min=\"10\" max=\"160\" value=\"42\"></span>\n    <span class=\"zoom\">\u9884\u89c8\n      <select id=\"mt-qsel\" style=\"background:#0f1319;color:#c6cfdb;border:1px solid #3a4250;\n        border-radius:6px;padding:3px 6px;font-size:12px\">\n        <option value=\"640\">\u6d41\u7545 640</option>\n        <option value=\"960\" selected>\u6807\u51c6 960</option>\n        <option value=\"1280\">\u9ad8\u6e05 1280</option>\n      </select></span>\n    <button class=\"export\" id=\"mt-btnExport\">\u2b07 \u5bfc\u51fa\u89c6\u9891</button>\n    <button id=\"mt-btnAbout\">\u8bf4\u660e</button>\n  </div>\n\n  <div id=\"mt-stage\">\n    <canvas id=\"mt-out\" width=\"1280\" height=\"720\"></canvas>\n    <div class=\"empty\" id=\"mt-stageEmpty\">\u62d6\u89c6\u9891/\u97f3\u9891\u6587\u4ef6\u8fdb\u6765\uff0c\u6216\u70b9\u4e0a\u65b9\u6309\u94ae\u6dfb\u52a0<br>5 \u6761\u8f68\uff1a\u89c6\u9891 \u00d72 \u00b7 \u97f3\u9891 \u00d72 \u00b7 \u5b57\u5e55 \u00d71\uff0c\u5171\u7528\u4e00\u6761\u65f6\u95f4\u8f74</div>\n    <div class=\"badge\" id=\"mt-badge\" style=\"display:none\"></div>\n  </div>\n\n  <div id=\"mt-tl\">\n    <div id=\"mt-tlbar\">\n      <span>\u8f68\u9053</span>\n      <span class=\"hint\">\u62d6\u52a8\u7247\u6bb5\u6539\u4f4d\u7f6e/\u8de8\u8f68 \u00b7 \u62d6\u4e24\u7aef\u88c1\u526a \u00b7 \u9760\u8fd1\u8fb9\u7f18\u81ea\u52a8\u5438\u9644 \u00b7 \u7a7a\u683c\u64ad\u653e \u00b7 S \u5206\u5272 \u00b7 Delete \u5220\u9664</span>\n      <span class=\"snapflag\">\u5438\u9644\uff1a\u5f00</span>\n    </div>\n    <div id=\"mt-scroll\">\n      <div id=\"mt-inner\">\n        <div id=\"mt-ruler\"></div>\n      </div>\n    </div>\n  </div>\n  <div id=\"mt-audios\"></div>\n\n<div id=\"mt-drop\">\u677e\u624b\u5bfc\u5165\u5230\u65f6\u95f4\u8f74</div>\n\n<div id=\"mt-expMask\">\n  <div class=\"card\">\n    <h3 id=\"mt-expTitle\">\u6b63\u5728\u5f55\u5236\u5bfc\u51fa\u2026</h3>\n    <p id=\"mt-expTip\">\u5bfc\u51fa\u65b9\u5f0f\u662f\u300c\u8fb9\u64ad\u8fb9\u5f55\u300d\uff0c\u8017\u65f6\u7ea6\u7b49\u4e8e\u6210\u7247\u65f6\u957f\uff0c\u8bf7\u52ff\u5207\u6362\u5230\u5176\u5b83\u6807\u7b7e\u9875\u3002</p>\n    <div id=\"mt-expBar\"><i></i></div>\n    <button id=\"mt-expCancel\">\u53d6\u6d88\u5bfc\u51fa</button>\n  </div>\n</div>\n\n<input type=\"file\" id=\"mt-fVid\" accept=\"video/*\" multiple hidden>\n<input type=\"file\" id=\"mt-fAud\" accept=\"audio/*\" multiple hidden>\n\n<script>\n/* ============================================================\n   \u591a\u8f68\u526a\u8f91\u7f16\u8f91\u5668 \u00b7 \u539f\u578b v2\n     \u2713 5 \u8f68\uff08\u89c6\u9891 2 / \u97f3\u9891 2 / \u5b57\u5e55 1\uff09\uff0c\u540c\u4e00\u65f6\u95f4\u8f74\u3001\u540c\u4e00\u64ad\u653e\u5934\n     \u2713 \u7247\u6bb5\u62d6\u52a8\u3001\u8de8\u8f68\u62d6\u52a8\uff08\u540c\u7c7b\u578b\u8f68\u4e4b\u95f4\uff09\u3001\u4e24\u7aef\u88c1\u526a\n     \u2713 \u5438\u9644\uff1a0 / \u5176\u5b83\u7247\u6bb5\u9996\u5c3e / \u64ad\u653e\u5934 \u4e09\u8005\u90fd\u53ef\u5438\n     \u2713 \u5206\u5272\u3001\u5220\u9664\u3001\u7f29\u653e\n     \u2713 \u5b57\u5e55\u8f68\uff1a\u53cc\u51fb\u6539\u6587\u5b57\uff0c\u753b\u9762\u5e95\u90e8\u6e32\u67d3\n     \u2713 \u5bfc\u51fa\uff1acanvas \u5408\u6210 + \u97f3\u9891\u6df7\u6d41 \u2192 MediaRecorder \u5b9e\u65f6\u5f55\u5236\u6210 webm\n     \u2717 \u6ca1\u6709\u8f6c\u573a/\u6ee4\u955c/\u591a\u9009/\u64a4\u9500\n   ============================================================ */\nconst HEAD_W = 110;\nconst $ = id => document.getElementById(id);\nconst SNAP_PX = 8;\n\nconst state = {\n  t: 0, playing: false, pps: 42, sel: null, exporting: false,\n  tracks: [\n    { id:'v1', type:'video', name:'\u89c6\u9891\u8f68 1', clips:[] },\n    { id:'v2', type:'video', name:'\u89c6\u9891\u8f68 2\uff08\u4e0a\u5c42\uff09', clips:[] },\n    { id:'a1', type:'audio', name:'\u97f3\u9891\u8f68 1', clips:[] },\n    { id:'a2', type:'audio', name:'\u97f3\u9891\u8f68 2', clips:[] },\n    { id:'t1', type:'text',  name:'\u5b57\u5e55\u8f68', clips:[] }\n  ]\n};\n\nconst stage = $('stage'), audios = $('audios'), inner = $('inner'), cv = $('out');\nconst g2d = cv.getContext('2d');\n/* \u9884\u89c8\u964d\u5206\u8fa8\u7387\uff1a\u5185\u90e8\u53ea\u753b 960\u00d7540\uff0c\u9760 CSS \u6491\u6ee1\uff1b\u5bfc\u51fa\u7528\u72ec\u7acb\u7684 1280\u00d7720 \u79bb\u5c4f\u753b\u5e03\uff0c\n   \u8fd9\u6837\u9884\u89c8\u7684\u50cf\u7d20\u586b\u5145\u91cf\u964d\u5230\u539f\u6765\u7684 56%\uff0c\u62d6\u52a8\u548c\u64ad\u653e\u90fd\u8ddf\u624b\u5f88\u591a\u3002 */\ncv.width = 960; cv.height = 540;\nconst expCv = document.createElement('canvas'); expCv.width = 1280; expCv.height = 720;\nconst expG = expCv.getContext('2d');\nlet uid = 1, dirty = true;\nfunction setPreviewRes(w) {\n  cv.width = w; cv.height = Math.round(w * 9 / 16);\n  dirty = true;\n}\n$('qsel').onchange = e => setPreviewRes(+e.target.value);\n\n/* ---------- \u5c0f\u5de5\u5177 ---------- */\nconst fmtT = s => {\n  s = Math.max(0, s);\n  const m = Math.floor(s/60), sec = Math.floor(s%60), d = Math.floor((s%1)*10);\n  return String(m).padStart(2,'0') + ':' + String(sec).padStart(2,'0') + '.' + d;\n};\nconst totalDur = () => {\n  let m = 0;\n  state.tracks.forEach(tr => tr.clips.forEach(c => { m = Math.max(m, c.start + c.dur); }));\n  return m;\n};\nconst findClip = ref => {\n  if (!ref) return null;\n  const tr = state.tracks.find(t => t.id === ref.trackId);\n  return (tr && tr.clips.find(c => c.id === ref.clipId)) || null;\n};\nconst trackOf = ref => state.tracks.find(t => t.id === ref.trackId);\nconst snap = v => Math.round(v * 20) / 20;   // 0.05 \u79d2\u7cbe\u5ea6\n\n/* ---------- \u5438\u9644\uff1a\u5019\u9009\u70b9 = 0 / \u6240\u6709\u7247\u6bb5\u9996\u5c3e / \u64ad\u653e\u5934 ---------- */\nfunction snapPoints(exclude) {\n  const pts = [0];\n  state.tracks.forEach(tr => tr.clips.forEach(c => {\n    if (c === exclude) return;\n    pts.push(c.start, c.start + c.dur);\n  }));\n  pts.push(state.t);\n  return pts;\n}\nfunction snapTime(t, exclude) {\n  const tol = SNAP_PX / state.pps;\n  let best = null, bd = 1e9;\n  snapPoints(exclude).forEach(p => {\n    const d = Math.abs(p - t);\n    if (d < bd) { bd = d; best = p; }\n  });\n  return bd <= tol ? best : t;\n}\n\n/* ---------- \u97f3\u9891\u56fe\uff08\u5bfc\u51fa\u6df7\u6d41\u7528\uff09 ---------- */\nlet actx = null, destNode = null;\nfunction ensureAudio() {\n  if (actx) return;\n  try {\n    actx = new (window.AudioContext || window.webkitAudioContext)();\n    destNode = actx.createMediaStreamDestination();\n  } catch (e) { actx = null; }\n}\nfunction hookMedia(el) {\n  ensureAudio();\n  if (!actx || el.__hooked || !el.src) return;\n  try {\n    const src = actx.createMediaElementSource(el);\n    src.connect(actx.destination);   // \u9884\u89c8\u80fd\u542c\u5230\n    src.connect(destNode);           // \u5bfc\u51fa\u65f6\u8fdb\u6df7\u6d41\n    el.__hooked = true;\n  } catch (e) { /* \u540c\u4e00\u5143\u7d20\u53ea\u80fd hook \u4e00\u6b21\uff0c\u5ffd\u7565 */ }\n}\n\n/* ---------- \u5a92\u4f53\u521b\u5efa ---------- */\nfunction makeMedia(url, kind) {\n  let el;\n  if (kind === 'video') {\n    el = document.createElement('video');\n    el.playsInline = true;\n    el.preload = 'metadata';   // \u539f\u6765 auto\uff1a\u4e00\u5bfc\u5165 29 \u5206\u949f\u7684\u7247\u5b50\u5c31\u5168\u901f\u7f13\u51b2\uff0c\u76f4\u63a5\u62d6\u57ae\u4e3b\u7ebf\u7a0b\n    el.crossOrigin = 'anonymous';\n    el.style.display = 'none';\n    stage.appendChild(el);\n  } else {\n    el = document.createElement('audio');\n    el.preload = 'metadata';\n    audios.appendChild(el);\n  }\n  el.src = url;\n  hookMedia(el);\n  return el;\n}\nasync function waitMeta(el) {\n  await new Promise(res => {\n    if (el.readyState >= 1) return res();\n    el.addEventListener('loadedmetadata', res, { once:true });\n    el.addEventListener('error', res, { once:true });\n  });\n  // \u6709\u4e9b webm \u7f3a\u65f6\u957f\u4fe1\u606f\uff0c\u7528 seek \u903c\u51fa\u6765\n  if (!isFinite(el.duration) || !el.duration) {\n    await new Promise(res => {\n      const h = () => { el.removeEventListener('timeupdate', h); res(); };\n      el.addEventListener('timeupdate', h);\n      try { el.currentTime = 1e7; } catch (e) { res(); }\n      setTimeout(res, 800);\n    });\n    try { el.currentTime = 0; } catch (e) {}\n  }\n  return el.duration || 0;\n}\nfunction grabThumb(el, time) {\n  return new Promise(res => {\n    const t = Math.min(time, (el.duration || 1) - 0.05);\n    const go = () => {\n      try {\n        const c = document.createElement('canvas');\n        c.width = 160; c.height = 90;\n        c.getContext('2d').drawImage(el, 0, 0, c.width, c.height);\n        res(c.toDataURL('image/jpeg', 0.7));\n      } catch (e) { res(null); }\n    };\n    el.addEventListener('seeked', go, { once:true });\n    try { el.currentTime = Math.max(0, t); } catch (e) { res(null); }\n  });\n}\n\n/* ---------- \u52a0\u7247\u6bb5 ---------- */\nasync function addClip(kind, url, name, durOverride, text) {\n  let track;\n  if (kind === 'text') {\n    track = state.tracks.find(t => t.type === 'text');\n  } else {\n    track = state.tracks.find(t => t.type === kind && t.clips.length === 0)\n         || state.tracks.filter(t => t.type === kind).pop();\n  }\n\n  let el = null, dur = durOverride || 0, thumb = null;\n  if (kind !== 'text') {\n    el = makeMedia(url, kind);\n    dur = await waitMeta(el);\n    if (!dur || !isFinite(dur)) dur = durOverride || 0;\n    if (!dur) { el.remove(); alert('\u8fd9\u4e2a\u6587\u4ef6\u8bfb\u4e0d\u51fa\u65f6\u957f\uff1a' + name); return null; }\n  }\n  if (!dur) dur = 3;\n\n  let start = 0;\n  track.clips.forEach(c => { start = Math.max(start, c.start + c.dur); });\n\n  const clip = {\n    id:'c'+(uid++), name, kind, url, start, offset:0, dur,\n    media: el, thumb, text: text || ''\n  };\n  if (kind === 'video') thumb = clip.thumb = await grabThumb(el, 0.2);  // \u53d6\u7b2c 0.2 \u79d2\uff0c\u4e0d\u53bb seek \u5230\u7247\u5b50\u4e2d\u95f4\uff08seek \u4f1a\u89e6\u53d1\u5927\u8303\u56f4\u7f13\u51b2\uff09\n  track.clips.push(clip);\n  render();\n  return clip;\n}\n\n/* ---------- \u6e32\u67d3\u65f6\u95f4\u8f74 ---------- */\nfunction render() {\n  dirty = true;\n  const td = totalDur();\n  const W = Math.max(600, (td + 6) * state.pps);\n  inner.style.width = (HEAD_W + W) + 'px';\n\n  const ruler = $('ruler');\n  let step = state.pps >= 60 ? 1 : state.pps >= 26 ? 2 : 5;\n  while (W / state.pps / step > 600) step *= 2;   // \u523b\u5ea6\u4e0a\u9650 600 \u6839\uff0c\u8d85\u957f\u7247\u5b50\u4e0d\u518d\u94fa\u51e0\u5343\u4e2a DOM\n  let rh = '';\n  for (let s = 0; s <= W / state.pps; s += step) {\n    const x = HEAD_W + s * state.pps;\n    rh += '<div class=\"tick\" style=\"left:' + x + 'px\"></div>';\n    if (s % (step * 2) === 0) rh += '<div class=\"tlab\" style=\"left:' + (x + 3) + 'px\">' + fmtT(s).slice(0,-2) + '</div>';\n  }\n  ruler.innerHTML = rh;\n\n  document.querySelectorAll('.track').forEach(n => n.remove());\n  state.tracks.forEach(tr => {\n    const row = document.createElement('div');\n    row.className = 'track';\n    row.dataset.track = tr.id;\n\n    const head = document.createElement('div');\n    head.className = 'thead';\n    head.innerHTML = '<div class=\"tn\">' + tr.name + '</div><div class=\"tt\">' +\n      ({video:'\u89c6\u9891',audio:'\u97f3\u9891',text:'\u5b57\u5e55'}[tr.type]) + ' \u00b7 ' + tr.clips.length + ' \u6bb5</div>';\n    row.appendChild(head);\n\n    const body = document.createElement('div');\n    body.className = 'tbody';\n    const lane = document.createElement('div');\n    lane.className = 'lane';\n    body.appendChild(lane);\n\n    tr.clips.forEach(c => {\n      const d = document.createElement('div');\n      d.className = 'clip ' + c.kind;\n      if (state.sel && state.sel.clipId === c.id) d.className += ' sel';\n      d.style.left = (c.start * state.pps) + 'px';\n      d.style.width = Math.max(12, c.dur * state.pps) + 'px';\n      d.dataset.clip = c.id;\n      d.dataset.track = tr.id;\n      const icon = c.kind === 'audio' ? '\ud83c\udfb5 ' : c.kind === 'text' ? '\ud83d\udcac ' : '\ud83c\udfac ';\n      d.innerHTML =\n        (c.thumb ? '<div class=\"bg\" style=\"background-image:url(' + c.thumb + ')\"></div>' : '') +\n        '<div class=\"nm\">' + icon + escapeHtml(c.kind === 'text' ? (c.text || '\uff08\u7a7a\u5b57\u5e55\uff09') : c.name) + '</div>' +\n        '<div class=\"l\"></div><div class=\"r\"></div>';\n      body.appendChild(d);\n    });\n    row.appendChild(body);\n    inner.appendChild(row);\n  });\n\n  let ph = $('mt-ph');\n  if (!ph) {\n    ph = document.createElement('div'); ph.id = 'mt-ph'; inner.appendChild(ph);\n    const hh = document.createElement('div'); hh.id = 'mt-phHead'; inner.appendChild(hh);\n  }\n  ph.style.transform = 'translateX(' + (HEAD_W + state.t * state.pps) + 'px)';\n  ph.style.height = (24 + state.tracks.length * 54 + 4) + 'px';   // \u4e0d\u518d\u8bfb scrollHeight\uff08\u8bfb\u5b83\u4f1a\u5f3a\u5236\u5168\u91cf\u91cd\u6392\uff09\n  const hh = $('mt-phHead');\n  if (hh) hh.style.transform = 'translateX(' + (HEAD_W + state.t * state.pps - 8) + 'px)';\n\n  $('stageEmpty').style.display = td ? 'none' : 'block';\n  updateTC();\n}\nfunction escapeHtml(s){ return String(s).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c])); }\nfunction updateTC(){ $('tc').textContent = fmtT(state.t) + ' / ' + fmtT(totalDur()); }\n\n/* ---------- \u64ad\u653e\u5934 ---------- */\nfunction moveHead() {\n  dirty = true;\n  const ph = $('mt-ph');\n  if (ph) ph.style.transform = 'translateX(' + (HEAD_W + state.t * state.pps) + 'px)';\n  const hh = $('mt-phHead');\n  if (hh) hh.style.transform = 'translateX(' + (HEAD_W + state.t * state.pps - 8) + 'px)';\n  const s = fmtT(state.t) + ' / ' + fmtT(totalDur());\n  const tc = $('tc');\n  if (tc.textContent !== s) tc.textContent = s;   // \u6587\u672c\u53ea\u5728\u771f\u7684\u53d8\u4e86\u624d\u5199\n}\nfunction setT(t, doSync) {\n  state.t = Math.max(0, Math.min(totalDur() || 0, t));\n  moveHead();\n  if (doSync !== false) syncMedia(true);\n}\n\n/* ---------- \u64ad\u653e\u5f15\u64ce ---------- */\nlet rafId = null, lastNow = 0;\nfunction play() {\n  if (!totalDur() || state.t >= totalDur() - 0.02) setT(0, true);\n  ensureAudio(); if (actx && actx.state === 'suspended') actx.resume().catch(()=>{});\n  state.playing = true;\n  lastNow = performance.now();\n  $('btnPlay').textContent = '\u23f8 \u6682\u505c';\n  syncMedia(true);\n  loop();\n}\nfunction pause() {\n  state.playing = false;\n  cancelAnimationFrame(rafId); rafId = null;\n  $('btnPlay').textContent = '\u25b6 \u64ad\u653e';\n  state.tracks.forEach(tr => tr.clips.forEach(c => { if (c.media) { try { c.media.pause(); } catch(e){} } }));\n}\nfunction loop() {\n  if (!state.playing) return;\n  const now = performance.now();\n  state.t += (now - lastNow) / 1000; lastNow = now;\n  const td = totalDur();\n  if (state.t >= td) { state.t = td; moveHead(); pause(); return; }\n  moveHead();\n  syncMedia(false);\n  rafId = requestAnimationFrame(loop);\n}\nfunction syncMedia(force) {\n  state.tracks.forEach(tr => tr.clips.forEach(c => {\n    if (!c.media) return;\n    const on = state.t >= c.start && state.t < c.start + c.dur;\n    const expected = c.offset + (state.t - c.start);\n    if (!on) {\n      if (!c.media.paused) { try { c.media.pause(); } catch(e){} }\n      return;\n    }\n    if (force || Math.abs(c.media.currentTime - expected) > 0.3) {\n      try { c.media.currentTime = Math.max(0, expected); } catch(e){}\n    }\n    if (state.playing && c.media.paused) c.media.play().catch(()=>{});\n    if (!state.playing && !c.media.paused) { try { c.media.pause(); } catch(e){} }\n  }));\n}\n\n/* ---------- \u753b\u9762\u5408\u6210\uff08\u9884\u89c8 = \u5bfc\u51fa\uff0c\u6240\u89c1\u5373\u6240\u5f97\uff09 ---------- */\nfunction drawContain(g, el, W, H) {\n  const vw = el.videoWidth || 0, vh = el.videoHeight || 0;\n  if (!vw || !vh || el.readyState < 2) return;\n  const s = Math.min(W / vw, H / vh);\n  const w = vw * s, h = vh * s;\n  g.drawImage(el, (W - w) / 2, (H - h) / 2, w, h);\n}\nconst wrapCache = new Map();\n/* \u5b57\u5e55\u6362\u884c\u6309 (\u6587\u5b57+\u5b57\u4f53+\u53ef\u7528\u5bbd\u5ea6) \u7f13\u5b58\uff1a\u539f\u6765\u6bcf\u5e27\u90fd\u8981\u9010\u5b57 measureText \u4e0a\u767e\u6b21\uff0c\u767d\u70e7 CPU */\nfunction wrapText(g, text, maxW) {\n  const key = text + '\\u0001' + g.font + '\\u0001' + Math.round(maxW);\n  let hit = wrapCache.get(key);\n  if (hit) return hit;\n  const lines = [];\n  let cur = '';\n  for (const ch of text) {\n    if (g.measureText(cur + ch).width > maxW && cur) { lines.push(cur); cur = ch; }\n    else cur += ch;\n  }\n  if (cur) lines.push(cur);\n  let maxLineW = 0;\n  lines.forEach(l => { maxLineW = Math.max(maxLineW, g.measureText(l).width); });\n  hit = { lines, maxLineW };\n  if (wrapCache.size > 300) wrapCache.clear();\n  wrapCache.set(key, hit);\n  return hit;\n}\nfunction drawSubtitle(g, text, W, H) {\n  if (!text) return;\n  const fs = Math.round(H * 0.056);\n  g.font = 'bold ' + fs + 'px \"Microsoft YaHei\",\"PingFang SC\",sans-serif';\n  g.textAlign = 'center';\n  g.textBaseline = 'top';\n  const maxW = W * 0.84;\n  const { lines, maxLineW } = wrapText(g, text, maxW);\n  const lh = fs * 1.4;\n  const blockH = lines.length * lh;\n  const y0 = H - H * 0.07 - blockH;\n  g.fillStyle = 'rgba(0,0,0,.55)';\n  const padX = fs * 0.6, padY = fs * 0.35;\n  g.fillRect((W - maxLineW) / 2 - padX, y0 - padY, maxLineW + padX * 2, blockH + padY * 2);\n  // \u6587\u5b57\n  g.fillStyle = '#ffffff';\n  lines.forEach((l, i) => g.fillText(l, W / 2, y0 + i * lh));\n  g.textAlign = 'left';\n  g.textBaseline = 'alphabetic';\n}\nlet lastBadge = '';\nfunction drawFrame(g, W, H) {\n  g.fillStyle = '#000';\n  g.fillRect(0, 0, W, H);\n  let act = null;\n  // \u89c6\u9891\u8f68\uff1av1 \u5728\u4e0b\u3001v2 \u5728\u4e0a\uff0c\u6309\u6570\u7ec4\u987a\u5e8f\u53e0\n  for (let i = 0; i < state.tracks.length; i++) {\n    const tr = state.tracks[i];\n    if (tr.type !== 'video') continue;\n    for (let j = 0; j < tr.clips.length; j++) {\n      const c = tr.clips[j];\n      if (state.t >= c.start && state.t < c.start + c.dur) { drawContain(g, c.media, W, H); act = c; }\n    }\n  }\n  // \u5b57\u5e55\u8f68\n  for (let i = 0; i < state.tracks.length; i++) {\n    const tr = state.tracks[i];\n    if (tr.type !== 'text') continue;\n    for (let j = 0; j < tr.clips.length; j++) {\n      const c = tr.clips[j];\n      if (state.t >= c.start && state.t < c.start + c.dur) drawSubtitle(g, c.text, W, H);\n    }\n  }\n  if (g === g2d) {\n    const b = $('badge');\n    const s = act ? act.name + ' \u00b7 ' + fmtT(state.t - act.start) + ' / ' + fmtT(act.dur) : '';\n    if (s !== lastBadge) {\n      lastBadge = s;\n      b.style.display = s ? 'block' : 'none';\n      if (s) b.textContent = s;\n    }\n  }\n}\n/* \u53ea\u5728\u64ad\u653e\u4e2d\u6216\u753b\u9762\u53d8\u4e86\u624d\u91cd\u753b \u2014\u2014 \u7a7a\u95f2\u65f6\u5b8c\u5168\u505c\u624b\uff0c\u4e0d\u518d\u6bcf\u5e27\u7a7a\u8f6c */\n(function drawLoop() {\n  requestAnimationFrame(drawLoop);\n  if (state.exporting) { drawFrame(expG, expCv.width, expCv.height); return; }\n  if (state.playing || dirty) { drawFrame(g2d, cv.width, cv.height); dirty = false; }\n})();\n\n/* ---------- \u4ea4\u4e92\uff1a\u9009\u4e2d / \u62d6\u52a8 / \u8de8\u8f68 / \u88c1\u526a ---------- */\nlet drag = null, moveEv = null, movePending = false;\n\nfunction cacheRows() {\n  return [...document.querySelectorAll('.track')].map(row => {\n    const r = row.getBoundingClientRect();\n    return { id: row.dataset.track, top: r.top, bottom: r.bottom };\n  });\n}\nfunction trackRowAt(clientY) {\n  if (!drag) return null;\n  let hit = null;\n  for (const r of drag.rows) if (clientY >= r.top && clientY <= r.bottom) hit = r.id;\n  return hit;\n}\nfunction setSel(trackId, clipId) {\n  state.sel = { trackId, clipId };\n  inner.querySelectorAll('.clip.sel').forEach(n => n.classList.remove('sel'));\n  const el = inner.querySelector('.clip[data-clip=\"' + clipId + '\"]');\n  if (el) el.classList.add('sel');\n}\nfunction clearSel() {\n  state.sel = null;\n  inner.querySelectorAll('.clip.sel').forEach(n => n.classList.remove('sel'));\n  dirty = true;\n}\n\ninner.addEventListener('mousedown', e => {\n  if (state.exporting) return;\n  const phHead = e.target.closest('#phHead');\n  const clipEl = e.target.closest('.clip');\n  const rulerEl = e.target.closest('#ruler');\n\n  if (phHead || rulerEl) { drag = { mode:'seek', rows:[] }; seekFromEvent(e); return; }\n  if (!clipEl) { clearSel(); return; }\n\n  const tr = state.tracks.find(t => t.id === clipEl.dataset.track);\n  const c = tr && tr.clips.find(x => x.id === clipEl.dataset.clip);\n  if (!c) return;\n\n  setSel(tr.id, c.id);\n  const r = clipEl.getBoundingClientRect();\n  const leftEdge = e.clientX - r.left < 9;\n  const rightEdge = r.right - e.clientX < 9;\n  drag = {\n    mode: leftEdge ? 'trimL' : rightEdge ? 'trimR' : 'move',\n    tr, c, x0: e.clientX, y0: e.clientY,\n    s0: c.start, o0: c.offset, d0: c.dur,\n    rows: cacheRows()\n  };\n  document.body.classList.add('dragging');\n  // \u4e0d\u518d\u6574\u4f53\u91cd\u5efa DOM\uff0c\u53ea\u6539\u9009\u4e2d\u72b6\u6001\n});\n\nfunction seekFromEvent(e) {\n  const r = inner.getBoundingClientRect();\n  setT((e.clientX - r.left - HEAD_W) / state.pps);\n}\n\n/* mousemove \u53ea\u8bb0\u6700\u65b0\u4e00\u6b21\uff0c\u771f\u6b63\u5904\u7406\u653e\u5230\u4e0b\u4e00\u5e27 \u2014\u2014 \u9ad8\u56de\u62a5\u7387\u9f20\u6807\u4e0d\u4f1a\u518d\u5835\u6b7b\u4e3b\u7ebf\u7a0b */\nwindow.addEventListener('mousemove', e => {\n  if (!drag || state.exporting) return;\n  moveEv = e;\n  if (movePending) return;\n  movePending = true;\n  requestAnimationFrame(() => { movePending = false; if (drag && moveEv) onMove(moveEv); });\n});\n\nfunction onMove(e) {\n  if (drag.mode === 'seek') { seekFromEvent(e); return; }\n  const dx = (e.clientX - drag.x0) / state.pps;\n  const { c, tr } = drag;\n\n  if (drag.mode === 'move') {\n    // \u8de8\u8f68\uff1a\u540c\u7c7b\u578b\u8f68\u4e4b\u95f4\u624d\u80fd\u843d\n    let target = tr;\n    if (Math.abs(e.clientY - drag.y0) > 10) {\n      const id = trackRowAt(e.clientY);\n      if (id) {\n        const tt = state.tracks.find(t => t.id === id);\n        if (tt && tt.type === c.kind) target = tt;\n      }\n    }\n    if (!drag.dropT || drag.dropT.id !== target.id) {\n      drag.dropT = target;\n      inner.querySelectorAll('.track').forEach(r =>\n        r.classList.toggle('dropok', r.dataset.track === target.id && target !== tr));\n    }\n\n    if (target !== drag.tr) {\n      drag.tr.clips = drag.tr.clips.filter(x => x !== c);\n      target.clips.push(c);\n      drag.tr = target;\n      state.sel.trackId = target.id;\n    }\n    c.start = Math.max(0, snap(snapTime(drag.s0 + dx, c)));\n    paintClip(c);\n  } else if (drag.mode === 'trimL') {\n    const targetStart = Math.max(0, drag.s0 + dx);\n    const snapped = snapTime(targetStart, c);\n    let d = snapped - drag.s0;\n    d = Math.max(-drag.o0, Math.min(drag.d0 - 0.15, d));\n    c.start = Math.max(0, drag.s0 + d);\n    c.offset = Math.max(0, drag.o0 + d);\n    c.dur = Math.max(0.15, drag.d0 - d);\n    paintClip(c);\n  } else if (drag.mode === 'trimR') {\n    const endT = snapTime(drag.s0 + drag.d0 + dx, c);\n    c.dur = Math.max(0.15, endT - c.start);\n    paintClip(c);\n  }\n  dirty = true;\n}\n\nwindow.addEventListener('mouseup', () => {\n  if (!drag) return;\n  document.body.classList.remove('dragging');\n  inner.querySelectorAll('.track').forEach(r => r.classList.remove('dropok'));\n  if (drag.mode !== 'seek') render();\n  drag = null; moveEv = null;\n});\n\n/* \u62d6\u52a8\u4e2d\u53ea\u6539\u8fd9\u4e00\u4e2a\u7247\u6bb5\u7684 left/width\uff0c\u7edd\u4e0d\u91cd\u5199\u65f6\u95f4\u8f74\u603b\u5bbd\u5ea6\uff08\u90a3\u4f1a\u8ba9\u6574\u6761\u8f74\u91cd\u6392\uff09 */\nfunction paintClip(c) {\n  const el = inner.querySelector('.clip[data-clip=\"' + c.id + '\"]');\n  if (!el) return;\n  el.style.width = Math.max(12, c.dur * state.pps) + 'px';\n  const row = inner.querySelector('.track[data-track=\"' + state.sel.trackId + '\"] .tbody');\n  if (row && el.parentElement !== row) row.appendChild(el);\n  el.style.left = (c.start * state.pps) + 'px';\n}\n\n/* ---------- \u5206\u5272 / \u5220\u9664 / \u5b57\u5e55 ---------- */\nfunction split() {\n  const c = findClip(state.sel);\n  if (!c) { toast('\u5148\u70b9\u9009\u4e00\u4e2a\u7247\u6bb5'); return; }\n  if (state.t <= c.start + 0.05 || state.t >= c.start + c.dur - 0.05) {\n    toast('\u64ad\u653e\u5934\u8981\u5728\u8fd9\u4e2a\u7247\u6bb5\u5185\u90e8'); return;\n  }\n  const cut = state.t - c.start;\n  const tr = trackOf(state.sel);\n  let right;\n  if (c.kind === 'text') {\n    right = { id:'c'+(uid++), name:c.name, kind:'text', start:c.start+cut, offset:c.offset+cut,\n              dur:c.dur-cut, media:null, thumb:null, text:c.text };\n  } else {\n    const el2 = makeMedia(c.url, c.kind);\n    right = { id:'c'+(uid++), name:c.name, kind:c.kind, url:c.url, start:c.start+cut,\n              offset:c.offset+cut, dur:c.dur-cut, media:el2, thumb:c.thumb, text:'' };\n  }\n  c.dur = cut;\n  tr.clips.push(right);\n  tr.clips.sort((a,b) => a.start - b.start);\n  state.sel = { trackId: tr.id, clipId: right.id };\n  render();\n  toast('\u5df2\u5206\u5272');\n}\nfunction delClip() {\n  const c = findClip(state.sel);\n  if (!c) { toast('\u5148\u70b9\u9009\u4e00\u4e2a\u7247\u6bb5'); return; }\n  const tr = trackOf(state.sel);\n  tr.clips = tr.clips.filter(x => x.id !== c.id);\n  if (c.media) { try { c.media.pause(); } catch(e){} c.media.remove(); }\n  state.sel = null;\n  render();\n  toast('\u5df2\u5220\u9664');\n}\nfunction addSubtitle() {\n  const text = prompt('\u5b57\u5e55\u6587\u5b57\uff08\u4e5f\u53ef\u4ee5\u5148\u7559\u7a7a\uff0c\u53cc\u51fb\u7247\u6bb5\u518d\u6539\uff09\uff1a', '');\n  if (text === null) return;\n  const track = state.tracks.find(t => t.type === 'text');\n  const clip = { id:'c'+(uid++), name:'\u5b57\u5e55', kind:'text', start: state.t, offset:0, dur:3, text: text || '' };\n  // \u81ea\u52a8\u907f\u5f00\u5df2\u6709\u5b57\u5e55\n  track.clips.forEach(c => { if (Math.abs(c.start - clip.start) < 0.1) clipboardShift(clip, c); });\n  track.clips.push(clip);\n  state.sel = { trackId: track.id, clipId: clip.id };\n  render();\n  toast('\u5df2\u52a0\u5b57\u5e55\uff083 \u79d2\uff0c\u53cc\u51fb\u53ef\u6539\u5b57\uff09');\n}\nfunction clipboardShift(c, other) { c.start = other.start + other.dur; }\n\n// \u53cc\u51fb\u5b57\u5e55\u7247\u6bb5\u6539\u6587\u5b57\ninner.addEventListener('dblclick', e => {\n  const el = e.target.closest('.clip');\n  if (!el) return;\n  const tr = state.tracks.find(t => t.id === el.dataset.track);\n  const c = tr && tr.clips.find(x => x.id === el.dataset.clip);\n  if (!c || c.kind !== 'text') return;\n  const v = prompt('\u4fee\u6539\u5b57\u5e55\uff1a', c.text || '');\n  if (v === null) return;\n  c.text = v; render();\n});\n\n/* ---------- \u63d0\u793a ---------- */\nlet toastEl = null, toastTimer = null;\nfunction toast(msg) {\n  if (!toastEl) {\n    toastEl = document.createElement('div');\n    toastEl.style.cssText = 'position:fixed;left:50%;top:64px;transform:translateX(-50%);' +\n      'background:rgba(24,29,37,.96);border:1px solid #3a4250;color:#dde3ea;padding:8px 16px;' +\n      'border-radius:8px;font-size:12.5px;z-index:80;pointer-events:none;transition:opacity .2s';\n    document.body.appendChild(toastEl);\n  }\n  toastEl.textContent = msg; toastEl.style.opacity = '1';\n  clearTimeout(toastTimer);\n  toastTimer = setTimeout(() => { toastEl.style.opacity = '0'; }, 1800);\n}\n\n/* ---------- \u5bfc\u5165 ---------- */\nasync function importFiles(files) {\n  let n = 0;\n  for (const f of files) {\n    const kind = f.type.startsWith('video') ? 'video'\n               : f.type.startsWith('audio') ? 'audio' : null;\n    if (!kind) { toast('\u8df3\u8fc7\u975e\u97f3\u89c6\u9891\uff1a' + f.name); continue; }\n    await addClip(kind, URL.createObjectURL(f), f.name);\n    n++;\n  }\n  if (n) toast('\u5df2\u5bfc\u5165 ' + n + ' \u4e2a\u6587\u4ef6');\n}\n$('btnVid').onclick = () => $('fVid').click();\n$('btnAud').onclick = () => $('fAud').click();\n$('btnText').onclick = addSubtitle;\n$('fVid').onchange = e => { importFiles(e.target.files); e.target.value=''; };\n$('fAud').onchange = e => { importFiles(e.target.files); e.target.value=''; };\n\n['dragenter','dragover'].forEach(ev => document.addEventListener(ev, e => {\n  e.preventDefault(); if (e.dataTransfer.types.includes('Files')) $('drop').style.display = 'flex';\n}));\ndocument.addEventListener('dragleave', e => {\n  if (e.relatedTarget === null) $('drop').style.display = 'none';\n});\ndocument.addEventListener('drop', e => {\n  e.preventDefault(); $('drop').style.display = 'none';\n  if (e.dataTransfer.files.length) importFiles(e.dataTransfer.files);\n});\n\n/* ---------- \u5bfc\u51fa\uff08canvas \u5408\u6210 + \u97f3\u9891\u6df7\u6d41 \u2192 \u5b9e\u65f6\u5f55 webm\uff09 ---------- */\nlet rec = null, exportCancel = false, exporting = false;\nfunction pickMime() {\n  const c = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];\n  for (const m of c) if (window.MediaRecorder && MediaRecorder.isTypeSupported(m)) return m;\n  return 'video/webm';\n}\nasync function exportVideo() {\n  if (exporting) return;\n  if (!totalDur()) { toast('\u65f6\u95f4\u8f74\u662f\u7a7a\u7684\uff0c\u5148\u5bfc\u5165\u7d20\u6750'); return; }\n  if (!window.MediaRecorder) { alert('\u8fd9\u4e2a\u6d4f\u89c8\u5668\u4e0d\u652f\u6301 MediaRecorder\uff0c\u65e0\u6cd5\u5bfc\u51fa'); return; }\n  if (!confirm('\u5bfc\u51fa\u662f\u300c\u8fb9\u64ad\u8fb9\u5f55\u300d\u7684\u5b9e\u65f6\u5f55\u5236\uff1a\\n\u6210\u7247 ' + fmtT(totalDur()) + '\uff0c\u5927\u7ea6\u8981\u7b49\u540c\u6837\u7684\u65f6\u95f4\u3002\\n\\n\u671f\u95f4\u8bf7\u4fdd\u6301\u9875\u9762\u5728\u524d\u53f0\u3001\u4e0d\u8981\u6700\u5c0f\u5316\u3002\u7ee7\u7eed\uff1f')) return;\n\n  exporting = true; exportCancel = false; state.exporting = true;\n  $('expMask').classList.add('on');\n  $('expTitle').textContent = '\u6b63\u5728\u5f55\u5236\u5bfc\u51fa\u2026';\n  $('expTip').textContent = '\u5b9e\u65f6\u5f55\u5236\u4e2d\uff0c\u8bf7\u52ff\u5207\u6362\u6807\u7b7e\u9875\u6216\u6700\u5c0f\u5316\u7a97\u53e3\u3002';\n  pause(); setT(0, true);\n  ensureAudio();\n  if (actx && actx.state === 'suspended') { try { await actx.resume(); } catch(e){} }\n  await new Promise(r => setTimeout(r, 300));  // \u7b49\u753b\u9762\u7a33\u5b9a\n\n  const cstream = expCv.captureStream(30);   // \u7528 1280\u00d7720 \u7684\u79bb\u5c4f\u753b\u5e03\u5f55\u5236\uff0c\u9884\u89c8\u4ecd\u5728\u4f4e\u5206\u8fa8\u7387\u8dd1\n  const tracks = [...cstream.getVideoTracks()];\n  if (destNode) destNode.stream.getAudioTracks().forEach(t => tracks.push(t));\n  const ms = new MediaStream(tracks);\n\n  const chunks = [];\n  const r = new MediaRecorder(ms, { mimeType: pickMime(), videoBitsPerSecond: 4000000, audioBitsPerSecond: 128000 });\n  r.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };\n  rec = r;\n  const recDone = new Promise(res => { r.onstop = () => res(new Blob(chunks, { type:'video/webm' })); });\n  r.start(200);\n\n  play();\n  const bar = $('expBar').firstElementChild;\n  const td = totalDur();\n\n  await new Promise(res => {\n    const timer = setInterval(() => {\n      bar.style.width = Math.min(100, (state.t / td) * 100) + '%';\n      if (exportCancel || !state.playing || state.t >= td - 0.05) { clearInterval(timer); res(); }\n    }, 100);\n  });\n\n  await new Promise(r2 => setTimeout(r2, 400));  // \u6536\u5c3e\u51e0\u5e27\n  pause();\n  try { r.stop(); } catch (e) {}\n  const blob = await recDone;\n  rec = null;\n\n  $('expMask').classList.remove('on');\n  exporting = false; state.exporting = false;\n\n  if (exportCancel) { toast('\u5df2\u53d6\u6d88\u5bfc\u51fa'); setT(0); return; }\n\n  if (!blob.size) { alert('\u5f55\u5236\u7ed3\u679c\u4e3a\u7a7a\uff0c\u53ef\u80fd\u662f\u6d4f\u89c8\u5668\u9650\u5236\u4e86 canvas \u5f55\u5236'); setT(0); return; }\n  const a = document.createElement('a');\n  a.href = URL.createObjectURL(blob);\n  a.download = '\u6210\u7247-' + new Date().toISOString().slice(11,19).replace(/:/g,'') + '.webm';\n  document.body.appendChild(a); a.click(); a.remove();\n  setTimeout(() => URL.revokeObjectURL(a.href), 60000);\n  toast('\u5bfc\u51fa\u5b8c\u6210\uff1a' + (blob.size/1048576).toFixed(1) + ' MB\uff08webm\uff09');\n  setT(0);\n}\n$('btnExport').onclick = exportVideo;\n$('expCancel').onclick = () => { exportCancel = true; };\n\n/* ---------- \u6309\u94ae / \u5feb\u6377\u952e ---------- */\n$('btnPlay').onclick = () => state.playing ? pause() : play();\n$('btnSplit').onclick = split;\n$('btnDel').onclick = delClip;\n$('zoom').oninput = e => { state.pps = +e.target.value; render(); };\ndocument.addEventListener('keydown', e => {\n  if (state.exporting) return;\n  if (e.target.closest('input,textarea')) return;\n  if (e.code === 'Space') { e.preventDefault(); state.playing ? pause() : play(); }\n  else if (e.key === 's' || e.key === 'S') { e.preventDefault(); split(); }\n  else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); delClip(); }\n});\n\n/* ---------- \u8bf4\u660e ---------- */\n$('btnAbout').onclick = () => {\n  const old = document.getElementById('aboutBox'); if (old) { old.remove(); return; }\n  const b = document.createElement('div');\n  b.id = 'aboutBox';\n  b.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:120;' +\n    'width:min(580px,92vw);max-height:82vh;overflow:auto;background:#161b22;border:1px solid #3a4250;' +\n    'border-radius:14px;padding:22px 24px;box-shadow:0 20px 70px rgba(0,0,0,.7);font-size:12.5px;line-height:1.9;color:#aeb7c4';\n  b.innerHTML =\n    '<h2 style=\"font-size:15px;color:#e8ecf1;margin-bottom:10px\">v2 \u5df2\u5b9e\u73b0 / \u672a\u5b9e\u73b0</h2>' +\n    '<p style=\"color:#8fb8ff;margin:8px 0 4px\">\u5df2\u5b9e\u73b0\uff1a</p>' +\n    '<ul style=\"padding-left:18px\">' +\n    '<li>5 \u6761\u8f68\uff1a\u89c6\u9891 \u00d72\u3001\u97f3\u9891 \u00d72\u3001\u5b57\u5e55 \u00d71\uff0c\u540c\u4e00\u65f6\u95f4\u8f74\u540c\u4e00\u64ad\u653e\u5934</li>' +\n    '<li><b>\u5438\u9644</b>\uff1a\u62d6\u52a8/\u88c1\u526a\u4f1a\u5438\u9644\u5230 0\u3001\u5176\u5b83\u7247\u6bb5\u7684\u5f00\u5934\u548c\u7ed3\u5c3e\u3001\u5f53\u524d\u64ad\u653e\u5934\uff08\u9608\u503c 8px\uff09</li>' +\n    '<li><b>\u8de8\u8f68\u62d6\u52a8</b>\uff1a\u89c6\u9891\u7247\u6bb5\u53ef\u5728\u4e24\u6761\u89c6\u9891\u8f68\u4e4b\u95f4\u62d6\uff0c\u97f3\u9891\u5728\u4e24\u6761\u97f3\u9891\u8f68\u4e4b\u95f4\u62d6\uff08\u540c\u7c7b\u578b\u624d\u80fd\u843d\uff09</li>' +\n    '<li><b>\u5b57\u5e55\u8f68</b>\uff1a\u70b9\u300c\uff0b\u5b57\u5e55\u300d\u5728\u64ad\u653e\u5934\u63d2\u5165\uff0c\u53cc\u51fb\u7247\u6bb5\u6539\u5b57\uff1b\u9884\u89c8\u548c\u5bfc\u51fa\u90fd\u4f1a\u70e7\u8fdb\u753b\u9762</li>' +\n    '<li><b>\u5bfc\u51fa\u89c6\u9891</b>\uff1acanvas \u5408\u6210\u753b\u9762 + \u97f3\u9891\u6df7\u6d41\uff0cMediaRecorder \u5b9e\u65f6\u5f55\u6210 webm \u5e76\u81ea\u52a8\u4e0b\u8f7d</li>' +\n    '</ul>' +\n    '<p style=\"color:#d6b16b;margin:10px 0 4px\">\u5bfc\u51fa\u7684\u91cd\u8981\u9650\u5236\uff08\u5fc5\u987b\u77e5\u9053\uff09\uff1a</p>' +\n    '<ul style=\"padding-left:18px\">' +\n    '<li>\u662f<b>\u5b9e\u65f6\u5f55\u5236</b>\uff0c\u6210\u7247 10 \u5206\u949f\u5c31\u8981\u5f55 10 \u5206\u949f\uff0c\u4e2d\u9014\u5207\u6807\u7b7e\u9875\u4f1a\u6389\u5e27</li>' +\n    '<li>\u8f93\u51fa\u662f <b>webm</b>\uff0c\u4e0d\u662f mp4\u3002\u8981 mp4 \u9700\u8981 WebCodecs \u91cd\u7f16\u7801\uff08\u514d\u8d39\uff0c\u4f46\u8981\u53e6\u505a\uff09</li>' +\n    '<li>\u753b\u8d28\u53d7\u5b9e\u65f6\u5f55\u5236\u5f71\u54cd\uff0c\u6bd4\u539f\u7d20\u6750\u5dee\u4e00\u4e9b\uff1b\u5bfc\u51fa\u5206\u8fa8\u7387\u56fa\u5b9a 1280\u00d7720</li>' +\n    '<li>\u97f3\u753b\u540c\u6b65\u9760\u5b9e\u65f6\u64ad\u653e\uff0c\u957f\u7247\u53ef\u80fd\u6709\u51e0\u5341\u6beb\u79d2\u6f02\u79fb</li>' +\n    '</ul>' +\n    '<p style=\"color:#ff9ba0;margin:12px 0 4px\">\u4e3a\u4ec0\u4e48\u8fd9\u4e48\u5361\uff08\u4e09\u4e2a\u771f\u51f6\uff09\uff1a</p>' +\n    '<ul style=\"padding-left:18px\">' +\n    '<li><b>\u5bfc\u51fa\u662f\u8fb9\u64ad\u8fb9\u5f55</b>\uff1a\u6210\u7247 10 \u5206\u949f\u5c31\u8981\u5360 10 \u5206\u949f\uff0c\u8fd9\u51e0\u5206\u949f\u91cc CPU \u540c\u65f6\u5728\u89e3\u7801\u3001\u5408\u6210\u3001\u7f16\u7801</li>' +\n    '<li><b>\u6bcf\u6761\u89c6\u9891\u8f68\u5404\u81ea\u89e3\u7801</b>\uff1a\u4e24\u6761\u8f68\u53e0\u7740\u64ad\uff1d\u540c\u65f6\u89e3 2 \u8def\u89c6\u9891\uff1b1080p \u8f6f\u89e3\u4e00\u8def\u5c31\u80fd\u5403\u6389 1~2 \u4e2a\u6838</li>' +\n    '<li><b>\u753b\u9762\u9010\u5e27\u91cd\u753b</b>\uff1a\u8f93\u51fa 720p \u6bcf\u5e27\u7ea6 92 \u4e07\u50cf\u7d20\u300130fps\uff1d\u6bcf\u79d2 2760 \u4e07\u50cf\u7d20\uff1b\u7d20\u6750\u82e5\u662f 4K\uff0c\u6bcf\u5e27\u8fd8\u8981\u5148\u7f29\u5230 720p\uff0c\u6210\u672c\u518d\u7ffb\u51e0\u500d</li>' +\n    '</ul>' +\n    '<p style=\"color:#8fb8ff;margin:12px 0 6px\">\u914d\u7f6e\u53c2\u8003\uff08\u8f93\u51fa 720p\u30012 \u89c6\u9891\u8f68 + 2 \u97f3\u9891\u8f68 + \u5b57\u5e55\uff09\uff1a</p>' +\n    '<table style=\"width:100%;border-collapse:collapse;font-size:12px\">' +\n    '<tr style=\"color:#8b93a1\"><td style=\"padding:4px 6px;border-bottom:1px solid #2b323d\">\u6210\u7247\u65f6\u957f</td>' +\n    '<td style=\"padding:4px 6px;border-bottom:1px solid #2b323d\">\u5185\u5b58</td>' +\n    '<td style=\"padding:4px 6px;border-bottom:1px solid #2b323d\">CPU</td>' +\n    '<td style=\"padding:4px 6px;border-bottom:1px solid #2b323d\">\u663e\u5361</td>' +\n    '<td style=\"padding:4px 6px;border-bottom:1px solid #2b323d\">\u5b9e\u9645\u4f53\u9a8c</td></tr>' +\n    '<tr><td style=\"padding:4px 6px\">\u2264 3 \u5206\u949f</td><td style=\"padding:4px 6px\">8GB</td><td style=\"padding:4px 6px\">4 \u6838</td><td style=\"padding:4px 6px\">\u96c6\u663e</td><td style=\"padding:4px 6px\">\u6d41\u7545\uff0c\u5bfc\u51fa\u7ea6 1~1.5 \u500d\u65f6\u957f</td></tr>' +\n    '<tr><td style=\"padding:4px 6px\">3~10 \u5206\u949f</td><td style=\"padding:4px 6px\">16GB</td><td style=\"padding:4px 6px\">6 \u6838</td><td style=\"padding:4px 6px\">\u96c6\u663e / \u5165\u95e8\u72ec\u663e</td><td style=\"padding:4px 6px\">\u53ef\u7528\uff0c\u5bfc\u51fa\u65f6\u522b\u5f00\u5176\u5b83\u7a0b\u5e8f</td></tr>' +\n    '<tr><td style=\"padding:4px 6px\">10~30 \u5206\u949f</td><td style=\"padding:4px 6px\">32GB</td><td style=\"padding:4px 6px\">8 \u6838\u4ee5\u4e0a</td><td style=\"padding:4px 6px\">\u72ec\u663e\uff08\u5e26\u786c\u89e3\uff09</td><td style=\"padding:4px 6px\">\u660e\u663e\u5403\u529b\uff0c\u9884\u89c8\u6389\u5e27\uff0c\u5efa\u8bae\u5206\u6bb5\u5bfc\u51fa</td></tr>' +\n    '<tr><td style=\"padding:4px 6px\">&gt; 30 \u5206\u949f</td><td style=\"padding:4px 6px\">\u2014</td><td style=\"padding:4px 6px\">\u2014</td><td style=\"padding:4px 6px\">\u2014</td><td style=\"padding:4px 6px\">\u522b\u7528\u6d4f\u89c8\u5668\u65b9\u6848\uff0c\u6539\u684c\u9762 ffmpeg / \u526a\u6620</td></tr>' +\n    '</table>' +\n    '<p style=\"color:#d6b16b;margin:12px 0 6px\">\u7d20\u6750\u89c4\u683c\u4f1a\u8ba9\u4e0a\u9762\u6574\u5f20\u8868\u7ffb\u500d\uff1a</p>' +\n    '<ul style=\"padding-left:18px\">' +\n    '<li>1080p \u7d20\u6750\uff1a\u5185\u5b58\u548c CPU \u7ea6 \u00d72\uff1b4K \u7d20\u6750\uff1a\u00d74 \u4ee5\u4e0a\uff0c\u5e27\u7387\u6389\u4e00\u534a\u2014\u2014\u5148\u8f6c 720p \u4ee3\u7406\u518d\u526a\u6700\u7701\u4e8b</li>' +\n    '<li>\u53ef\u53d8\u5e27\u7387\u5f55\u5c4f\uff08\u6bd4\u5982 EV \u5f55\u5c4f 16.66fps \u90a3\u79cd\uff09\uff1a<b>\u62d6\u8fdb\u5ea6\u6761\u6700\u5361</b>\uff0c\u56e0\u4e3a\u6bcf\u6b21\u8df3\u8f6c\u90fd\u8981\u91cd\u65b0\u627e\u5173\u952e\u5e27</li>' +\n    '<li>\u97f3\u9891\u8f68\u51e0\u4e4e\u4e0d\u5403\u8d44\u6e90\uff0c2 \u6761\u653e\u5fc3\u5f00</li>' +\n    '<li>\u5185\u5b58\u7c97\u7565\u4f30\u7b97\uff1a\u8d77\u6b65\u7ea6 500MB\uff0c\u6bcf\u6761 1080p \u89c6\u9891\u8f68\u518d +200~400MB</li>' +\n    '</ul>' +\n    '<p style=\"color:#8fb8ff;margin:12px 0 4px\">\u7701\u8d44\u6e90\u7684\u56db\u4e2a\u529e\u6cd5\uff1a</p>' +\n    '<ul style=\"padding-left:18px\">' +\n    '<li>\u5148\u628a\u7d20\u6750\u8f6c\u6210 720p\u3001\u6052\u5b9a\u5e27\u7387\u7684\u4ee3\u7406\u6587\u4ef6\u518d\u526a\uff0c\u5bfc\u51fa\u524d\u7528\u539f\u7247\u5957\u5e95</li>' +\n    '<li>\u540c\u4e00\u65f6\u523b\u5c3d\u91cf\u53ea\u8ba9\u4e00\u6761\u89c6\u9891\u8f68\u6709\u5185\u5bb9\uff08\u53e6\u4e00\u6761\u7559\u7a7a\uff09</li>' +\n    '<li>\u957f\u7247\u5206\u6bb5\u5bfc\u51fa\uff0c\u518d\u62fc\u6210\u4e00\u6761</li>' +\n    '<li>\u7528 Chrome / Edge\uff0c\u522b\u7528 Safari\uff08\u5bf9 canvas \u6d41\u5f55\u5236\u652f\u6301\u5dee\uff09</li>' +\n    '</ul>' +\n    '<p style=\"color:#46a758;margin:12px 0 4px\">\u4e3a\u300c\u4e0d\u5361\u300d\u8fd9\u4e00\u7248\u6539\u4e86\u4ec0\u4e48\uff1a</p>' +\n    '<ul style=\"padding-left:18px\">' +\n    '<li><b>\u9884\u89c8\u964d\u5206\u8fa8\u7387</b>\uff1a\u9876\u680f\u300c\u9884\u89c8\u300d\u53ef\u5207 640 / 960 / 1280\uff0c\u9ed8\u8ba4 960\uff0c\u50cf\u7d20\u586b\u5145\u91cf\u53ea\u6709\u539f\u6765\u7684 56%</li>' +\n    '<li><b>\u7a7a\u95f2\u4e0d\u518d\u91cd\u753b</b>\uff1a\u4ee5\u524d\u4e0d\u7ba1\u5728\u4e0d\u5728\u64ad\u653e\u90fd\u6bcf\u5e27\u91cd\u753b\uff0c\u73b0\u5728\u53ea\u5728\u64ad\u653e\u4e2d\u6216\u753b\u9762\u771f\u7684\u53d8\u4e86\u624d\u753b</li>' +\n    '<li><b>\u62d6\u52a8\u4e0d\u518d\u5168\u91cf\u91cd\u6392</b>\uff1a\u62d6\u7247\u6bb5\u53ea\u6539\u90a3\u4e00\u4e2a\u7247\u6bb5\u7684 left/width\uff0c\u4e0d\u518d\u91cd\u5199\u6574\u6761\u65f6\u95f4\u8f74\u5bbd\u5ea6</li>' +\n    '<li><b>\u9f20\u6807\u4e8b\u4ef6\u8282\u6d41\u5230\u5e27</b>\uff1a\u9ad8\u56de\u62a5\u7387\u9f20\u6807\u6bcf\u79d2\u4e0a\u5343\u6b21\u79fb\u52a8\uff0c\u6539\u6210\u6bcf\u5e27\u53ea\u5904\u7406\u6700\u540e\u4e00\u6b21</li>' +\n    '<li><b>\u64ad\u653e\u5934\u8d70\u5408\u6210\u5c42</b>\uff1a\u7528 transform \u79fb\u52a8\uff0c\u4e0d\u518d\u89e6\u53d1\u5e03\u5c40</li>' +\n    '<li><b>\u7d20\u6750\u4e0d\u518d\u9884\u7f13\u51b2</b>\uff1a\u5bfc\u5165\u65f6\u53ea\u8bfb\u65f6\u957f\uff0c\u4e0d\u4f1a\u628a 29 \u5206\u949f\u7684\u6587\u4ef6\u5168\u901f\u62c9\u4e0b\u6765</li>' +\n    '<li><b>\u523b\u5ea6\u4e0a\u9650 600 \u6839</b>\uff1a\u957f\u7247\u5b50\u4e0d\u518d\u94fa\u51e0\u5343\u4e2a DOM \u8282\u70b9</li>' +\n    '</ul>' +\n    '<p style=\"color:#d6b16b;margin:10px 0 4px\">\u5982\u679c\u8fd8\u5361\uff0c\u6309\u8fd9\u4e2a\u987a\u5e8f\u8bd5\uff1a</p>' +\n    '<ul style=\"padding-left:18px\">' +\n    '<li>\u9884\u89c8\u5207\u5230\u300c\u6d41\u7545 640\u300d</li>' +\n    '<li>\u628a\u5927\u6587\u4ef6\u5148\u8f6c\u6210 720p\u3001\u6052\u5b9a\u5e27\u7387\u7684\u7248\u672c\u518d\u5bfc\u5165</li>' +\n    '<li>\u5173\u6389\u5176\u5b83\u6807\u7b7e\u9875\u548c\u540e\u53f0\u7a0b\u5e8f\uff1b\u5bfc\u51fa\u65f6\u522b\u5207\u6807\u7b7e\u9875</li>' +\n    '<li>\u540c\u4e00\u65f6\u523b\u53ea\u8ba9\u4e00\u6761\u89c6\u9891\u8f68\u6709\u5185\u5bb9</li>' +\n    '</ul>' +\n    '<p style=\"color:#8fb8ff;margin:10px 0 4px\">\u8fd8\u6ca1\u505a\uff1a</p>' +\n    '<ul style=\"padding-left:18px\">' +\n    '<li>\u7f29\u7565\u56fe\u6574\u6761\u94fa\u6ee1\u3001\u97f3\u9891\u6ce2\u5f62</li>' +\n    '<li>\u591a\u9009\u3001\u6846\u9009\u3001\u6574\u8f68\u62d6\u52a8\u3001\u64a4\u9500\u6808</li>' +\n    '<li>\u8f6c\u573a\u3001\u6ee4\u955c\u3001\u53d8\u901f\u3001\u97f3\u91cf\u8c03\u8282</li>' +\n    '<li>\u89c6\u9891\u753b\u4e2d\u753b\u7684\u4f4d\u7f6e/\u5927\u5c0f/\u900f\u660e\u5ea6\uff08\u73b0\u5728 v2 \u662f\u5168\u5c4f\u8986\u76d6\uff09</li>' +\n    '<li>\u5b57\u5e55\u6837\u5f0f\uff08\u5b57\u4f53/\u5b57\u53f7/\u4f4d\u7f6e/\u63cf\u8fb9\uff09</li>' +\n    '</ul>';\n  document.body.appendChild(b);\n  b.addEventListener('mousedown', e => e.stopPropagation());\n  setTimeout(() => document.addEventListener('mousedown', function h() {\n    b.remove(); document.removeEventListener('mousedown', h);\n  }), 0);\n};\n\n/* ---------- \u542f\u52a8 ---------- */\nrender();\n</script>\n";
document.body.appendChild(app);

// 以下为豆包原型逻辑

/* ============================================================
   多轨剪辑编辑器 · 原型 v2
     ✓ 5 轨（视频 2 / 音频 2 / 字幕 1），同一时间轴、同一播放头
     ✓ 片段拖动、跨轨拖动（同类型轨之间）、两端裁剪
     ✓ 吸附：0 / 其它片段首尾 / 播放头 三者都可吸
     ✓ 分割、删除、缩放
     ✓ 字幕轨：双击改文字，画面底部渲染
     ✓ 导出：canvas 合成 + 音频混流 → MediaRecorder 实时录制成 webm
     ✗ 没有转场/滤镜/多选/撤销
   ============================================================ */
const HEAD_W = 110;
const $ = id => document.getElementById(id);
const SNAP_PX = 8;

const state = {
  t: 0, playing: false, pps: 42, sel: null, exporting: false,
  tracks: [
    { id:'v1', type:'video', name:'视频轨 1', clips:[] },
    { id:'v2', type:'video', name:'视频轨 2（上层）', clips:[] },
    { id:'a1', type:'audio', name:'音频轨 1', clips:[] },
    { id:'a2', type:'audio', name:'音频轨 2', clips:[] },
    { id:'t1', type:'text',  name:'字幕轨', clips:[] }
  ]
};

const stage = document.getElementById('mt-stage'), audios = $('mt-audios'), inner = $('mt-inner'), cv = $('mt-out');
const g2d = cv.getContext('2d');
/* 预览降分辨率：内部只画 960×540，靠 CSS 撑满；导出用独立的 1280×720 离屏画布，
   这样预览的像素填充量降到原来的 56%，拖动和播放都跟手很多。 */
cv.width = 960; cv.height = 540;
const expCv = document.createElement('canvas'); expCv.width = 1280; expCv.height = 720;
const expG = expCv.getContext('2d');
let uid = 1, dirty = true;
let host = {}, srcBoxId = null, exportName = '剪辑成片.webm';
function setPreviewRes(w) {
  cv.width = w; cv.height = Math.round(w * 9 / 16);
  dirty = true;
}
$('mt-qsel').onchange = e => setPreviewRes(+e.target.value);

/* ---------- 小工具 ---------- */
const fmtT = s => {
  s = Math.max(0, s);
  const m = Math.floor(s/60), sec = Math.floor(s%60), d = Math.floor((s%1)*10);
  return String(m).padStart(2,'0') + ':' + String(sec).padStart(2,'0') + '.' + d;
};
const totalDur = () => {
  let m = 0;
  state.tracks.forEach(tr => tr.clips.forEach(c => { m = Math.max(m, c.start + c.dur); }));
  return m;
};
const findClip = ref => {
  if (!ref) return null;
  const tr = state.tracks.find(t => t.id === ref.trackId);
  return (tr && tr.clips.find(c => c.id === ref.clipId)) || null;
};
const trackOf = ref => state.tracks.find(t => t.id === ref.trackId);
const snap = v => Math.round(v * 20) / 20;   // 0.05 秒精度

/* ---------- 吸附：候选点 = 0 / 所有片段首尾 / 播放头 ---------- */
function snapPoints(exclude) {
  const pts = [0];
  state.tracks.forEach(tr => tr.clips.forEach(c => {
    if (c === exclude) return;
    pts.push(c.start, c.start + c.dur);
  }));
  pts.push(state.t);
  return pts;
}
function snapTime(t, exclude) {
  const tol = SNAP_PX / state.pps;
  let best = null, bd = 1e9;
  snapPoints(exclude).forEach(p => {
    const d = Math.abs(p - t);
    if (d < bd) { bd = d; best = p; }
  });
  return bd <= tol ? best : t;
}

/* ---------- 音频图（导出混流用） ---------- */
let actx = null, destNode = null;
function ensureAudio() {
  if (actx) return;
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    destNode = actx.createMediaStreamDestination();
  } catch (e) { actx = null; }
}
function hookMedia(el) {
  ensureAudio();
  if (!actx || el.__hooked || !el.src) return;
  try {
    const src = actx.createMediaElementSource(el);
    src.connect(actx.destination);   // 预览能听到
    src.connect(destNode);           // 导出时进混流
    el.__hooked = true;
  } catch (e) { /* 同一元素只能 hook 一次，忽略 */ }
}

/* ---------- 媒体创建 ---------- */
function makeMedia(url, kind) {
  let el;
  if (kind === 'video') {
    el = document.createElement('video');
    el.playsInline = true;
    el.preload = 'metadata';   // 原来 auto：一导入 29 分钟的片子就全速缓冲，直接拖垮主线程
    el.crossOrigin = 'anonymous';
    el.style.display = 'none';
    stage.appendChild(el);
  } else {
    el = document.createElement('audio');
    el.preload = 'metadata';
    audios.appendChild(el);
  }
  el.src = url;
  hookMedia(el);
  return el;
}
async function waitMeta(el) {
  await new Promise(res => {
    if (el.readyState >= 1) return res();
    el.addEventListener('loadedmetadata', res, { once:true });
    el.addEventListener('error', res, { once:true });
  });
  // 有些 webm 缺时长信息，用 seek 逼出来
  if (!isFinite(el.duration) || !el.duration) {
    await new Promise(res => {
      const h = () => { el.removeEventListener('timeupdate', h); res(); };
      el.addEventListener('timeupdate', h);
      try { el.currentTime = 1e7; } catch (e) { res(); }
      setTimeout(res, 800);
    });
    try { el.currentTime = 0; } catch (e) {}
  }
  return el.duration || 0;
}
function grabThumb(el, time) {
  return new Promise(res => {
    const t = Math.min(time, (el.duration || 1) - 0.05);
    const go = () => {
      try {
        const c = document.createElement('canvas');
        c.width = 160; c.height = 90;
        c.getContext('2d').drawImage(el, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.7));
      } catch (e) { res(null); }
    };
    el.addEventListener('seeked', go, { once:true });
    try { el.currentTime = Math.max(0, t); } catch (e) { res(null); }
  });
}

/* ---------- 加片段 ---------- */
async function addClip(kind, url, name, durOverride, text) {
  let track;
  if (kind === 'text') {
    track = state.tracks.find(t => t.type === 'text');
  } else {
    track = state.tracks.find(t => t.type === kind && t.clips.length === 0)
         || state.tracks.filter(t => t.type === kind).pop();
  }

  let el = null, dur = durOverride || 0, thumb = null;
  if (kind !== 'text') {
    el = makeMedia(url, kind);
    dur = await waitMeta(el);
    if (!dur || !isFinite(dur)) dur = durOverride || 0;
    if (!dur) { el.remove(); alert('这个文件读不出时长：' + name); return null; }
  }
  if (!dur) dur = 3;

  let start = 0;
  track.clips.forEach(c => { start = Math.max(start, c.start + c.dur); });

  const clip = {
    id:'c'+(uid++), name, kind, url, start, offset:0, dur,
    media: el, thumb, text: text || ''
  };
  if (kind === 'video') thumb = clip.thumb = await grabThumb(el, 0.2);  // 取第 0.2 秒，不去 seek 到片子中间（seek 会触发大范围缓冲）
  track.clips.push(clip);
  render();
  return clip;
}

/* ---------- 渲染时间轴 ---------- */
function render() {
  dirty = true;
  const td = totalDur();
  const W = Math.max(600, (td + 6) * state.pps);
  inner.style.width = (HEAD_W + W) + 'px';

  const ruler = $('mt-ruler');
  let step = state.pps >= 60 ? 1 : state.pps >= 26 ? 2 : 5;
  while (W / state.pps / step > 600) step *= 2;   // 刻度上限 600 根，超长片子不再铺几千个 DOM
  let rh = '';
  for (let s = 0; s <= W / state.pps; s += step) {
    const x = HEAD_W + s * state.pps;
    rh += '<div class="tick" style="left:' + x + 'px"></div>';
    if (s % (step * 2) === 0) rh += '<div class="tlab" style="left:' + (x + 3) + 'px">' + fmtT(s).slice(0,-2) + '</div>';
  }
  ruler.innerHTML = rh;

  document.querySelectorAll('.track').forEach(n => n.remove());
  state.tracks.forEach(tr => {
    const row = document.createElement('div');
    row.className = 'track';
    row.dataset.track = tr.id;

    const head = document.createElement('div');
    head.className = 'thead';
    head.innerHTML = '<div class="tn">' + tr.name + '</div><div class="tt">' +
      ({video:'视频',audio:'音频',text:'字幕'}[tr.type]) + ' · ' + tr.clips.length + ' 段</div>';
    row.appendChild(head);

    const body = document.createElement('div');
    body.className = 'tbody';
    const lane = document.createElement('div');
    lane.className = 'lane';
    body.appendChild(lane);

    tr.clips.forEach(c => {
      const d = document.createElement('div');
      d.className = 'clip ' + c.kind;
      if (state.sel && state.sel.clipId === c.id) d.className += ' sel';
      d.style.left = (c.start * state.pps) + 'px';
      d.style.width = Math.max(12, c.dur * state.pps) + 'px';
      d.dataset.clip = c.id;
      d.dataset.track = tr.id;
      const icon = c.kind === 'audio' ? '🎵 ' : c.kind === 'text' ? '💬 ' : '🎬 ';
      d.innerHTML =
        (c.thumb ? '<div class="bg" style="background-image:url(' + c.thumb + ')"></div>' : '') +
        '<div class="nm">' + icon + escapeHtml(c.kind === 'text' ? (c.text || '（空字幕）') : c.name) + '</div>' +
        '<div class="l"></div><div class="r"></div>';
      body.appendChild(d);
    });
    row.appendChild(body);
    inner.appendChild(row);
  });

  let ph = $('mt-ph');
  if (!ph) {
    ph = document.createElement('div'); ph.id = 'mt-ph'; inner.appendChild(ph);
    const hh = document.createElement('div'); hh.id = 'mt-phHead'; inner.appendChild(hh);
  }
  ph.style.transform = 'translateX(' + (HEAD_W + state.t * state.pps) + 'px)';
  ph.style.height = (24 + state.tracks.length * 54 + 4) + 'px';   // 不再读 scrollHeight（读它会强制全量重排）
  const hh = $('mt-phHead');
  if (hh) hh.style.transform = 'translateX(' + (HEAD_W + state.t * state.pps - 8) + 'px)';

  $('mt-stageEmpty').style.display = td ? 'none' : 'block';
  updateTC();
}
function escapeHtml(s){ return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function updateTC(){ $('mt-tc').textContent = fmtT(state.t) + ' / ' + fmtT(totalDur()); }

/* ---------- 播放头 ---------- */
function moveHead() {
  dirty = true;
  const ph = $('mt-ph');
  if (ph) ph.style.transform = 'translateX(' + (HEAD_W + state.t * state.pps) + 'px)';
  const hh = $('mt-phHead');
  if (hh) hh.style.transform = 'translateX(' + (HEAD_W + state.t * state.pps - 8) + 'px)';
  const s = fmtT(state.t) + ' / ' + fmtT(totalDur());
  const tc = $('mt-tc');
  if (tc.textContent !== s) tc.textContent = s;   // 文本只在真的变了才写
}
function setT(t, doSync) {
  state.t = Math.max(0, Math.min(totalDur() || 0, t));
  moveHead();
  if (doSync !== false) syncMedia(true);
}

/* ---------- 播放引擎 ---------- */
let rafId = null, lastNow = 0;
function play() {
  if (!totalDur() || state.t >= totalDur() - 0.02) setT(0, true);
  ensureAudio(); if (actx && actx.state === 'suspended') actx.resume().catch(()=>{});
  state.playing = true;
  lastNow = performance.now();
  $('mt-btnPlay').textContent = '⏸ 暂停';
  syncMedia(true);
  loop();
}
function pause() {
  state.playing = false;
  cancelAnimationFrame(rafId); rafId = null;
  $('mt-btnPlay').textContent = '▶ 播放';
  state.tracks.forEach(tr => tr.clips.forEach(c => { if (c.media) { try { c.media.pause(); } catch(e){} } }));
}
function loop() {
  if (!state.playing) return;
  const now = performance.now();
  state.t += (now - lastNow) / 1000; lastNow = now;
  const td = totalDur();
  if (state.t >= td) { state.t = td; moveHead(); pause(); return; }
  moveHead();
  syncMedia(false);
  rafId = requestAnimationFrame(loop);
}
function syncMedia(force) {
  state.tracks.forEach(tr => tr.clips.forEach(c => {
    if (!c.media) return;
    const on = state.t >= c.start && state.t < c.start + c.dur;
    const expected = c.offset + (state.t - c.start);
    if (!on) {
      if (!c.media.paused) { try { c.media.pause(); } catch(e){} }
      return;
    }
    if (force || Math.abs(c.media.currentTime - expected) > 0.3) {
      try { c.media.currentTime = Math.max(0, expected); } catch(e){}
    }
    if (state.playing && c.media.paused) c.media.play().catch(()=>{});
    if (!state.playing && !c.media.paused) { try { c.media.pause(); } catch(e){} }
  }));
}

/* ---------- 画面合成（预览 = 导出，所见即所得） ---------- */
function drawContain(g, el, W, H) {
  const vw = el.videoWidth || 0, vh = el.videoHeight || 0;
  if (!vw || !vh || el.readyState < 2) return;
  const s = Math.min(W / vw, H / vh);
  const w = vw * s, h = vh * s;
  g.drawImage(el, (W - w) / 2, (H - h) / 2, w, h);
}
const wrapCache = new Map();
/* 字幕换行按 (文字+字体+可用宽度) 缓存：原来每帧都要逐字 measureText 上百次，白烧 CPU */
function wrapText(g, text, maxW) {
  const key = text + '\u0001' + g.font + '\u0001' + Math.round(maxW);
  let hit = wrapCache.get(key);
  if (hit) return hit;
  const lines = [];
  let cur = '';
  for (const ch of text) {
    if (g.measureText(cur + ch).width > maxW && cur) { lines.push(cur); cur = ch; }
    else cur += ch;
  }
  if (cur) lines.push(cur);
  let maxLineW = 0;
  lines.forEach(l => { maxLineW = Math.max(maxLineW, g.measureText(l).width); });
  hit = { lines, maxLineW };
  if (wrapCache.size > 300) wrapCache.clear();
  wrapCache.set(key, hit);
  return hit;
}
function drawSubtitle(g, text, W, H) {
  if (!text) return;
  const fs = Math.round(H * 0.056);
  g.font = 'bold ' + fs + 'px "Microsoft YaHei","PingFang SC",sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'top';
  const maxW = W * 0.84;
  const { lines, maxLineW } = wrapText(g, text, maxW);
  const lh = fs * 1.4;
  const blockH = lines.length * lh;
  const y0 = H - H * 0.07 - blockH;
  g.fillStyle = 'rgba(0,0,0,.55)';
  const padX = fs * 0.6, padY = fs * 0.35;
  g.fillRect((W - maxLineW) / 2 - padX, y0 - padY, maxLineW + padX * 2, blockH + padY * 2);
  // 文字
  g.fillStyle = '#ffffff';
  lines.forEach((l, i) => g.fillText(l, W / 2, y0 + i * lh));
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
}
let lastBadge = '';
function drawFrame(g, W, H) {
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  let act = null;
  // 视频轨：v1 在下、v2 在上，按数组顺序叠
  for (let i = 0; i < state.tracks.length; i++) {
    const tr = state.tracks[i];
    if (tr.type !== 'video') continue;
    for (let j = 0; j < tr.clips.length; j++) {
      const c = tr.clips[j];
      if (state.t >= c.start && state.t < c.start + c.dur) { drawContain(g, c.media, W, H); act = c; }
    }
  }
  // 字幕轨
  for (let i = 0; i < state.tracks.length; i++) {
    const tr = state.tracks[i];
    if (tr.type !== 'text') continue;
    for (let j = 0; j < tr.clips.length; j++) {
      const c = tr.clips[j];
      if (state.t >= c.start && state.t < c.start + c.dur) drawSubtitle(g, c.text, W, H);
    }
  }
  if (g === g2d) {
    const b = $('mt-badge');
    const s = act ? act.name + ' · ' + fmtT(state.t - act.start) + ' / ' + fmtT(act.dur) : '';
    if (s !== lastBadge) {
      lastBadge = s;
      b.style.display = s ? 'block' : 'none';
      if (s) b.textContent = s;
    }
  }
}
/* 只在播放中或画面变了才重画 —— 空闲时完全停手，不再每帧空转 */
(function drawLoop() {
  requestAnimationFrame(drawLoop);
  if (state.exporting) { drawFrame(expG, expCv.width, expCv.height); return; }
  if (state.playing || dirty) { drawFrame(g2d, cv.width, cv.height); dirty = false; }
})();

/* ---------- 交互：选中 / 拖动 / 跨轨 / 裁剪 ---------- */
let drag = null, moveEv = null, movePending = false;

function cacheRows() {
  return [...document.querySelectorAll('.track')].map(row => {
    const r = row.getBoundingClientRect();
    return { id: row.dataset.track, top: r.top, bottom: r.bottom };
  });
}
function trackRowAt(clientY) {
  if (!drag) return null;
  let hit = null;
  for (const r of drag.rows) if (clientY >= r.top && clientY <= r.bottom) hit = r.id;
  return hit;
}
function setSel(trackId, clipId) {
  state.sel = { trackId, clipId };
  inner.querySelectorAll('.clip.sel').forEach(n => n.classList.remove('sel'));
  const el = inner.querySelector('.clip[data-clip="' + clipId + '"]');
  if (el) el.classList.add('sel');
}
function clearSel() {
  state.sel = null;
  inner.querySelectorAll('.clip.sel').forEach(n => n.classList.remove('sel'));
  dirty = true;
}

inner.addEventListener('mousedown', e => {
  if (state.exporting) return;
  const phHead = e.target.closest('#phHead');
  const clipEl = e.target.closest('.clip');
  const rulerEl = e.target.closest('#ruler');

  if (phHead || rulerEl) { drag = { mode:'seek', rows:[] }; seekFromEvent(e); return; }
  if (!clipEl) { clearSel(); return; }

  const tr = state.tracks.find(t => t.id === clipEl.dataset.track);
  const c = tr && tr.clips.find(x => x.id === clipEl.dataset.clip);
  if (!c) return;

  setSel(tr.id, c.id);
  const r = clipEl.getBoundingClientRect();
  const leftEdge = e.clientX - r.left < 9;
  const rightEdge = r.right - e.clientX < 9;
  drag = {
    mode: leftEdge ? 'trimL' : rightEdge ? 'trimR' : 'move',
    tr, c, x0: e.clientX, y0: e.clientY,
    s0: c.start, o0: c.offset, d0: c.dur,
    rows: cacheRows()
  };
  document.body.classList.add('dragging');
  // 不再整体重建 DOM，只改选中状态
});

function seekFromEvent(e) {
  const r = inner.getBoundingClientRect();
  setT((e.clientX - r.left - HEAD_W) / state.pps);
}

/* mousemove 只记最新一次，真正处理放到下一帧 —— 高回报率鼠标不会再堵死主线程 */
window.addEventListener('mousemove', e => {
  if (!drag || state.exporting) return;
  moveEv = e;
  if (movePending) return;
  movePending = true;
  requestAnimationFrame(() => { movePending = false; if (drag && moveEv) onMove(moveEv); });
});

function onMove(e) {
  if (drag.mode === 'seek') { seekFromEvent(e); return; }
  const dx = (e.clientX - drag.x0) / state.pps;
  const { c, tr } = drag;

  if (drag.mode === 'move') {
    // 跨轨：同类型轨之间才能落
    let target = tr;
    if (Math.abs(e.clientY - drag.y0) > 10) {
      const id = trackRowAt(e.clientY);
      if (id) {
        const tt = state.tracks.find(t => t.id === id);
        if (tt && tt.type === c.kind) target = tt;
      }
    }
    if (!drag.dropT || drag.dropT.id !== target.id) {
      drag.dropT = target;
      inner.querySelectorAll('.track').forEach(r =>
        r.classList.toggle('dropok', r.dataset.track === target.id && target !== tr));
    }

    if (target !== drag.tr) {
      drag.tr.clips = drag.tr.clips.filter(x => x !== c);
      target.clips.push(c);
      drag.tr = target;
      state.sel.trackId = target.id;
    }
    c.start = Math.max(0, snap(snapTime(drag.s0 + dx, c)));
    paintClip(c);
  } else if (drag.mode === 'trimL') {
    const targetStart = Math.max(0, drag.s0 + dx);
    const snapped = snapTime(targetStart, c);
    let d = snapped - drag.s0;
    d = Math.max(-drag.o0, Math.min(drag.d0 - 0.15, d));
    c.start = Math.max(0, drag.s0 + d);
    c.offset = Math.max(0, drag.o0 + d);
    c.dur = Math.max(0.15, drag.d0 - d);
    paintClip(c);
  } else if (drag.mode === 'trimR') {
    const endT = snapTime(drag.s0 + drag.d0 + dx, c);
    c.dur = Math.max(0.15, endT - c.start);
    paintClip(c);
  }
  dirty = true;
}

window.addEventListener('mouseup', () => {
  if (!drag) return;
  document.body.classList.remove('dragging');
  inner.querySelectorAll('.track').forEach(r => r.classList.remove('dropok'));
  if (drag.mode !== 'seek') render();
  drag = null; moveEv = null;
});

/* 拖动中只改这一个片段的 left/width，绝不重写时间轴总宽度（那会让整条轴重排） */
function paintClip(c) {
  const el = inner.querySelector('.clip[data-clip="' + c.id + '"]');
  if (!el) return;
  el.style.width = Math.max(12, c.dur * state.pps) + 'px';
  const row = inner.querySelector('.track[data-track="' + state.sel.trackId + '"] .tbody');
  if (row && el.parentElement !== row) row.appendChild(el);
  el.style.left = (c.start * state.pps) + 'px';
}

/* ---------- 分割 / 删除 / 字幕 ---------- */
function split() {
  const c = findClip(state.sel);
  if (!c) { toast('先点选一个片段'); return; }
  if (state.t <= c.start + 0.05 || state.t >= c.start + c.dur - 0.05) {
    toast('播放头要在这个片段内部'); return;
  }
  const cut = state.t - c.start;
  const tr = trackOf(state.sel);
  let right;
  if (c.kind === 'text') {
    right = { id:'c'+(uid++), name:c.name, kind:'text', start:c.start+cut, offset:c.offset+cut,
              dur:c.dur-cut, media:null, thumb:null, text:c.text };
  } else {
    const el2 = makeMedia(c.url, c.kind);
    right = { id:'c'+(uid++), name:c.name, kind:c.kind, url:c.url, start:c.start+cut,
              offset:c.offset+cut, dur:c.dur-cut, media:el2, thumb:c.thumb, text:'' };
  }
  c.dur = cut;
  tr.clips.push(right);
  tr.clips.sort((a,b) => a.start - b.start);
  state.sel = { trackId: tr.id, clipId: right.id };
  render();
  toast('已分割');
}
function delClip() {
  const c = findClip(state.sel);
  if (!c) { toast('先点选一个片段'); return; }
  const tr = trackOf(state.sel);
  tr.clips = tr.clips.filter(x => x.id !== c.id);
  if (c.media) { try { c.media.pause(); } catch(e){} c.media.remove(); }
  state.sel = null;
  render();
  toast('已删除');
}
function addSubtitle() {
  const text = prompt('字幕文字（也可以先留空，双击片段再改）：', '');
  if (text === null) return;
  const track = state.tracks.find(t => t.type === 'text');
  const clip = { id:'c'+(uid++), name:'字幕', kind:'text', start: state.t, offset:0, dur:3, text: text || '' };
  // 自动避开已有字幕
  track.clips.forEach(c => { if (Math.abs(c.start - clip.start) < 0.1) clipboardShift(clip, c); });
  track.clips.push(clip);
  state.sel = { trackId: track.id, clipId: clip.id };
  render();
  toast('已加字幕（3 秒，双击可改字）');
}
function clipboardShift(c, other) { c.start = other.start + other.dur; }

// 双击字幕片段改文字
inner.addEventListener('dblclick', e => {
  const el = e.target.closest('.clip');
  if (!el) return;
  const tr = state.tracks.find(t => t.id === el.dataset.track);
  const c = tr && tr.clips.find(x => x.id === el.dataset.clip);
  if (!c || c.kind !== 'text') return;
  const v = prompt('修改字幕：', c.text || '');
  if (v === null) return;
  c.text = v; render();
});

/* ---------- 提示 ---------- */
let toastEl = null, toastTimer = null;
function toast(msg) {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.style.cssText = 'position:fixed;left:50%;top:64px;transform:translateX(-50%);' +
      'background:rgba(24,29,37,.96);border:1px solid #3a4250;color:#dde3ea;padding:8px 16px;' +
      'border-radius:8px;font-size:12.5px;z-index:80;pointer-events:none;transition:opacity .2s';
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg; toastEl.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.style.opacity = '0'; }, 1800);
}

/* ---------- 导入 ---------- */
async function importFiles(files) {
  let n = 0;
  for (const f of files) {
    const kind = f.type.startsWith('video') ? 'video'
               : f.type.startsWith('audio') ? 'audio' : null;
    if (!kind) { toast('跳过非音视频：' + f.name); continue; }
    await addClip(kind, URL.createObjectURL(f), f.name);
    n++;
  }
  if (n) toast('已导入 ' + n + ' 个文件');
}
$('mt-btnVid').onclick = () => $('mt-fVid').click();
$('mt-btnAud').onclick = () => $('mt-fAud').click();
$('mt-btnText').onclick = addSubtitle;
$('mt-fVid').onchange = e => { importFiles(e.target.files); e.target.value=''; };
$('mt-fAud').onchange = e => { importFiles(e.target.files); e.target.value=''; };

['dragenter','dragover'].forEach(ev => document.addEventListener(ev, e => {
  e.preventDefault(); if (e.dataTransfer.types.includes('Files')) $('mt-drop').style.display = 'flex';
}));
document.addEventListener('dragleave', e => {
  if (e.relatedTarget === null) $('mt-drop').style.display = 'none';
});
document.addEventListener('drop', e => {
  e.preventDefault(); $('mt-drop').style.display = 'none';
  if (e.dataTransfer.files.length) importFiles(e.dataTransfer.files);
});

/* ---------- 导出（canvas 合成 + 音频混流 → 实时录 webm） ---------- */
let rec = null, exportCancel = false, exporting = false;
function pickMime() {
  const c = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  for (const m of c) if (window.MediaRecorder && MediaRecorder.isTypeSupported(m)) return m;
  return 'video/webm';
}
async function exportVideo(quiet) {
  if (exporting) return;
  if (!totalDur()) { toast('时间轴是空的，先导入素材'); return; }
  if (!window.MediaRecorder) { alert('这个浏览器不支持 MediaRecorder，无法导出'); return; }
  if (!quiet && !confirm('导出是「边播边录」的实时录制：\n成片 ' + fmtT(totalDur()) + '，大约要等同样的时间。\n\n期间请保持页面在前台、不要最小化。继续？')) return;
  const expMaskEl = $('mt-expMask');
  if (quiet && app && !app.classList.contains('show')) document.body.appendChild(expMaskEl);
  else if (expMaskEl.parentElement !== app) app.appendChild(expMaskEl);

  exporting = true; exportCancel = false; state.exporting = true;
  $('mt-expMask').classList.add('on');
  $('mt-expTitle').textContent = '正在录制导出…';
  $('mt-expTip').textContent = '实时录制中，请勿切换标签页或最小化窗口。';
  pause(); setT(0, true);
  ensureAudio();
  if (actx && actx.state === 'suspended') { try { await actx.resume(); } catch(e){} }
  await new Promise(r => setTimeout(r, 300));  // 等画面稳定

  const cstream = expCv.captureStream(30);   // 用 1280×720 的离屏画布录制，预览仍在低分辨率跑
  const tracks = [...cstream.getVideoTracks()];
  if (destNode) destNode.stream.getAudioTracks().forEach(t => tracks.push(t));
  const ms = new MediaStream(tracks);

  const chunks = [];
  const r = new MediaRecorder(ms, { mimeType: pickMime(), videoBitsPerSecond: 4000000, audioBitsPerSecond: 128000 });
  r.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  rec = r;
  const recDone = new Promise(res => { r.onstop = () => res(new Blob(chunks, { type:'video/webm' })); });
  r.start(200);

  play();
  const bar = $('mt-expBar').firstElementChild;
  const td = totalDur();

  await new Promise(res => {
    const timer = setInterval(() => {
      bar.style.width = Math.min(100, (state.t / td) * 100) + '%';
      if (exportCancel || !state.playing || state.t >= td - 0.05) { clearInterval(timer); res(); }
    }, 100);
  });

  await new Promise(r2 => setTimeout(r2, 400));  // 收尾几帧
  pause();
  try { r.stop(); } catch (e) {}
  const blob = await recDone;
  rec = null;

  $('mt-expMask').classList.remove('on');
  if (quiet && app && !app.classList.contains('show')) app.appendChild($('mt-expMask'));
  exporting = false; state.exporting = false;

  if (exportCancel) { toast('已取消导出'); setT(0); return; }

  if (!blob.size) { alert('录制结果为空，可能是浏览器限制了 canvas 录制'); setT(0); return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '成片-' + new Date().toISOString().slice(11,19).replace(/:/g,'') + '.webm';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  toast('导出完成：' + (blob.size/1048576).toFixed(1) + ' MB（webm），已保存到画布');
  setT(0);
  if (host.saveResult) host.saveResult(blob, exportName || '剪辑成片.webm', srcBoxId);
}
$('mt-btnExport').onclick = exportVideo;
$('mt-expCancel').onclick = () => { exportCancel = true; };

/* ---------- 按钮 / 快捷键 ---------- */
$('mt-btnPlay').onclick = () => state.playing ? pause() : play();
$('mt-btnSplit').onclick = split;
$('mt-btnDel').onclick = delClip;
$('mt-zoom').oninput = e => { state.pps = +e.target.value; render(); };
document.addEventListener('keydown', e => {
  if (!appOpen) return;
  if (e.key === 'Escape' && !state.exporting) { closeApp(); return; }
  if (state.exporting) return;
  if (e.target.closest('input,textarea')) return;
  e.stopPropagation();
  if (e.code === 'Space') { e.preventDefault(); state.playing ? pause() : play(); }
  else if (e.key === 's' || e.key === 'S') { e.preventDefault(); split(); }
  else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); delClip(); }
}, true);

/* ---------- 说明 ---------- */
$('mt-btnAbout').onclick = () => {
  const old = document.getElementById('aboutBox'); if (old) { old.remove(); return; }
  const b = document.createElement('div');
  b.id = 'aboutBox';
  b.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:120;' +
    'width:min(580px,92vw);max-height:82vh;overflow:auto;background:#161b22;border:1px solid #3a4250;' +
    'border-radius:14px;padding:22px 24px;box-shadow:0 20px 70px rgba(0,0,0,.7);font-size:12.5px;line-height:1.9;color:#aeb7c4';
  b.innerHTML =
    '<h2 style="font-size:15px;color:#e8ecf1;margin-bottom:10px">v2 已实现 / 未实现</h2>' +
    '<p style="color:#8fb8ff;margin:8px 0 4px">已实现：</p>' +
    '<ul style="padding-left:18px">' +
    '<li>5 条轨：视频 ×2、音频 ×2、字幕 ×1，同一时间轴同一播放头</li>' +
    '<li><b>吸附</b>：拖动/裁剪会吸附到 0、其它片段的开头和结尾、当前播放头（阈值 8px）</li>' +
    '<li><b>跨轨拖动</b>：视频片段可在两条视频轨之间拖，音频在两条音频轨之间拖（同类型才能落）</li>' +
    '<li><b>字幕轨</b>：点「＋字幕」在播放头插入，双击片段改字；预览和导出都会烧进画面</li>' +
    '<li><b>导出视频</b>：canvas 合成画面 + 音频混流，MediaRecorder 实时录成 webm，自动下载并存回画布</li>' +
    '</ul>' +
    '<p style="color:#46a758;margin:10px 0 4px">素材进入轨道的三种途径（仅此三种）：</p>' +
    '<ul style="padding-left:18px">' +
    '<li>① 盒子里附件右侧点 ✂：只载入这一个文件（视频进视频轨、音频进音频轨）</li>' +
    '<li>② 选中盒子按空格点 ✂ / 🔗：载入盒内全部音视频（最多 2 视频 + 2 音频，正好填满轨道）</li>' +
    '<li>③ 剪辑台里的「＋ 视频 / ＋ 音频」按钮：从盒外选文件导入</li>' +
    '</ul>' +
    '<p style="color:#d6b16b;margin:10px 0 4px">导出与卡顿的边界（必须知道）：</p>' +
    '<ul style="padding-left:18px">' +
    '<li><b>导出是实时录制</b>：成片 10 分钟就要等 10 分钟，中途别切标签页</li>' +
    '<li><b>卡顿边界</b>：≤3 分钟素材流畅；3~10 分钟可用；10~30 分钟明显吃力（CPU 解码的物理极限，内存再大也救不了）；超过 30 分钟建议分段剪</li>' +
    '<ul style="padding-left:18px">' +
    '<li>是<b>实时录制</b>，成片 10 分钟就要录 10 分钟，中途切标签页会掉帧</li>' +
    '<li>输出是 <b>webm</b>，不是 mp4。要 mp4 需要 WebCodecs 重编码（免费，但要另做）</li>' +
    '<li>画质受实时录制影响，比原素材差一些；导出分辨率固定 1280×720</li>' +
    '<li>音画同步靠实时播放，长片可能有几十毫秒漂移</li>' +
    '</ul>' +
    '<p style="color:#ff9ba0;margin:12px 0 4px">为什么这么卡（三个真凶）：</p>' +
    '<ul style="padding-left:18px">' +
    '<li><b>导出是边播边录</b>：成片 10 分钟就要占 10 分钟，这几分钟里 CPU 同时在解码、合成、编码</li>' +
    '<li><b>每条视频轨各自解码</b>：两条轨叠着播＝同时解 2 路视频；1080p 软解一路就能吃掉 1~2 个核</li>' +
    '<li><b>画面逐帧重画</b>：输出 720p 每帧约 92 万像素、30fps＝每秒 2760 万像素；素材若是 4K，每帧还要先缩到 720p，成本再翻几倍</li>' +
    '</ul>' +
    '<p style="color:#8fb8ff;margin:12px 0 6px">配置参考（输出 720p、2 视频轨 + 2 音频轨 + 字幕）：</p>' +
    '<table style="width:100%;border-collapse:collapse;font-size:12px">' +
    '<tr style="color:#8b93a1"><td style="padding:4px 6px;border-bottom:1px solid #2b323d">成片时长</td>' +
    '<td style="padding:4px 6px;border-bottom:1px solid #2b323d">内存</td>' +
    '<td style="padding:4px 6px;border-bottom:1px solid #2b323d">CPU</td>' +
    '<td style="padding:4px 6px;border-bottom:1px solid #2b323d">显卡</td>' +
    '<td style="padding:4px 6px;border-bottom:1px solid #2b323d">实际体验</td></tr>' +
    '<tr><td style="padding:4px 6px">≤ 3 分钟</td><td style="padding:4px 6px">8GB</td><td style="padding:4px 6px">4 核</td><td style="padding:4px 6px">集显</td><td style="padding:4px 6px">流畅，导出约 1~1.5 倍时长</td></tr>' +
    '<tr><td style="padding:4px 6px">3~10 分钟</td><td style="padding:4px 6px">16GB</td><td style="padding:4px 6px">6 核</td><td style="padding:4px 6px">集显 / 入门独显</td><td style="padding:4px 6px">可用，导出时别开其它程序</td></tr>' +
    '<tr><td style="padding:4px 6px">10~30 分钟</td><td style="padding:4px 6px">32GB</td><td style="padding:4px 6px">8 核以上</td><td style="padding:4px 6px">独显（带硬解）</td><td style="padding:4px 6px">明显吃力，预览掉帧，建议分段导出</td></tr>' +
    '<tr><td style="padding:4px 6px">&gt; 30 分钟</td><td style="padding:4px 6px">—</td><td style="padding:4px 6px">—</td><td style="padding:4px 6px">—</td><td style="padding:4px 6px">别用浏览器方案，改桌面 ffmpeg / 剪映</td></tr>' +
    '</table>' +
    '<p style="color:#d6b16b;margin:12px 0 6px">素材规格会让上面整张表翻倍：</p>' +
    '<ul style="padding-left:18px">' +
    '<li>1080p 素材：内存和 CPU 约 ×2；4K 素材：×4 以上，帧率掉一半——先转 720p 代理再剪最省事</li>' +
    '<li>可变帧率录屏（比如 EV 录屏 16.66fps 那种）：<b>拖进度条最卡</b>，因为每次跳转都要重新找关键帧</li>' +
    '<li>音频轨几乎不吃资源，2 条放心开</li>' +
    '<li>内存粗略估算：起步约 500MB，每条 1080p 视频轨再 +200~400MB</li>' +
    '</ul>' +
    '<p style="color:#8fb8ff;margin:12px 0 4px">省资源的四个办法：</p>' +
    '<ul style="padding-left:18px">' +
    '<li>先把素材转成 720p、恒定帧率的代理文件再剪，导出前用原片套底</li>' +
    '<li>同一时刻尽量只让一条视频轨有内容（另一条留空）</li>' +
    '<li>长片分段导出，再拼成一条</li>' +
    '<li>用 Chrome / Edge，别用 Safari（对 canvas 流录制支持差）</li>' +
    '</ul>' +
    '<p style="color:#46a758;margin:12px 0 4px">为「不卡」这一版改了什么：</p>' +
    '<ul style="padding-left:18px">' +
    '<li><b>预览降分辨率</b>：顶栏「预览」可切 640 / 960 / 1280，默认 960，像素填充量只有原来的 56%</li>' +
    '<li><b>空闲不再重画</b>：以前不管在不在播放都每帧重画，现在只在播放中或画面真的变了才画</li>' +
    '<li><b>拖动不再全量重排</b>：拖片段只改那一个片段的 left/width，不再重写整条时间轴宽度</li>' +
    '<li><b>鼠标事件节流到帧</b>：高回报率鼠标每秒上千次移动，改成每帧只处理最后一次</li>' +
    '<li><b>播放头走合成层</b>：用 transform 移动，不再触发布局</li>' +
    '<li><b>素材不再预缓冲</b>：导入时只读时长，不会把 29 分钟的文件全速拉下来</li>' +
    '<li><b>刻度上限 600 根</b>：长片子不再铺几千个 DOM 节点</li>' +
    '</ul>' +
    '<p style="color:#d6b16b;margin:10px 0 4px">如果还卡，按这个顺序试：</p>' +
    '<ul style="padding-left:18px">' +
    '<li>预览切到「流畅 640」</li>' +
    '<li>把大文件先转成 720p、恒定帧率的版本再导入</li>' +
    '<li>关掉其它标签页和后台程序；导出时别切标签页</li>' +
    '<li>同一时刻只让一条视频轨有内容</li>' +
    '</ul>' +
    '<p style="color:#8fb8ff;margin:10px 0 4px">还没做：</p>' +
    '<ul style="padding-left:18px">' +
    '<li>缩略图整条铺满、音频波形</li>' +
    '<li>多选、框选、整轨拖动、撤销栈</li>' +
    '<li>转场、滤镜、变速、音量调节</li>' +
    '<li>视频画中画的位置/大小/透明度（现在 v2 是全屏覆盖）</li>' +
    '<li>字幕样式（字体/字号/位置/描边）</li>' +
    '</ul>';
  document.body.appendChild(b);
  b.addEventListener('mousedown', e => e.stopPropagation());
  setTimeout(() => document.addEventListener('mousedown', function h() {
    b.remove(); document.removeEventListener('mousedown', h);
  }), 0);
};

/* ---------- 打开/关闭 与 盒子素材导入 ---------- */
let appOpen = false;
function openApp(boxId, opts) {
  opts = opts || {};
  // 每次打开先清空所有轨道（释放旧素材），保证编辑器内容 = 当前盒子的素材
  state.tracks.forEach(tr => {
    tr.clips.forEach(c => { if (c.media) { try { c.media.pause(); } catch(e){} try { c.media.el && (c.media.el.src = ''); } catch(e){} } });
    tr.clips = [];
  });
  setSel(null); setT(0, true);
  srcBoxId = boxId || null;
  const b = host.findBox ? host.findBox(boxId) : null;
  if (b) exportName = (b.text || '剪辑成片').slice(0, 20).replace(/[\\/:*?"<>|]/g, '') + '-剪辑.webm';
  appOpen = true;
  if (!opts.hidden) app.classList.add('show');
  render();
  if (b && b.atts && b.atts.length) loadBoxMedia(b, opts.only, opts.hidden);
}
/* 后台静默合并（纯视频盒）：不显示窗口，顺序载入后直接实时导出 */
async function mergeQuiet(boxId) {
  openApp(boxId, { hidden: true });
  const b = host.findBox ? host.findBox(boxId) : null;
  const n = b ? b.atts.length : 0;
  if (window.AudioEditor) AudioEditor.toast('⏳ 后台合并中（' + n + ' 段），完成后成片自动存回画布…', 8000);
  await new Promise(r => setTimeout(r, 2000));   // 等素材载入排好
  if (!totalDur()) { if (window.AudioEditor) AudioEditor.toast('❌ 合并失败：素材时长读取失败'); appOpen = false; return; }
  await exportVideo(true);
  appOpen = false;
}
function closeApp() { pause(); appOpen = false; app.classList.remove('show'); }
async function loadBoxMedia(b, onlyIdx, silent) {
  let list = b.atts.map((a, i) => ({ a, i }));
  if (typeof onlyIdx === 'number') list = list.filter(x => x.i === onlyIdx);
  else {
    let nv = 0, na = 0;
    list = list.filter(x => {
      const k = kindOf(x.a);
      if (k === 'video') return nv++ < 2;
      if (k === 'audio') return na++ < 2;
      return false;
    });
  }
  for (const x of list) {
    const kind = kindOf(x.a);
    if (!kind) continue;
    try {
      const blob = await idbGet(x.a.key);
      if (!blob) continue;
      await addClip(kind, URL.createObjectURL(blob), x.a.name || (kind === 'video' ? '视频' : '音频'));
    } catch (e) { toast('素材加载失败：' + (x.a.name||'')); }
  }
  if (!silent) toast(typeof onlyIdx === 'number' ? '已载入 1 个素材' : '已载入盒内素材，拖动排好后点「⬇ 导出视频」');
}
function kindOf(a) {
  if ((a.mime||'').startsWith('video') || /\.(mp4|mov|mkv|webm|avi|m4v)$/i.test(a.name||'')) return 'video';
  if ((a.mime||'').startsWith('audio') || /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(a.name||'')) return 'audio';
  return null;
}
document.getElementById('mt-btnClose').addEventListener('click', closeApp);

/* ---------- 对外接口 ---------- */
window.MultiTrackEditor = {
  isOpen: () => appOpen,
  open: openApp,
  openSingle: (boxId, attIdx) => openApp(boxId, { only: attIdx }),
  mergeQuiet,
  close: closeApp,
  init: h => { host = h; }
};

/* ---------- 启动 ---------- */
render();

})();