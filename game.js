/* ============================================================
   问津 · 会场微定向
   引擎只做四件事：读罗盘、走关卡、验码、出旅程卡。
   关卡内容全在 levels.js，不要改这里。
   ============================================================ */

(() => {
  'use strict';

  const LEVELS = window.LEVELS || [];
  const CFG = Object.assign({
    venue: '会场',
    event: '问津',
    baseScore: 1000,
    timePenalty: 1.2,
    hintPenalty: 40
  }, window.GAME_CONFIG || {});

  const $ = (id) => document.getElementById(id);

  const screens = {
    start: $('screen-start'),
    play: $('screen-play'),
    code: $('screen-code'),
    end: $('screen-end')
  };

  const state = {
    screen: 'start',
    level: 0,
    startAt: 0,
    elapsed: 0,
    hints: 0,
    hintShown: 0,
    heading: null,
    headingAbsolute: false,
    relativeOnly: false,
    target: null,
    aligned: false,
    sensorSeen: false,
    simulating: false,
    codeInput: '',
    checking: false,
    startLevelIndex: 0,
    completed: 0,
    checkTimer: null,
    resetTimer: null,
    finished: false,
    score: 0
  };

  const params = new URLSearchParams(location.search);
  const startLevel = clamp(parseInt(params.get('level') || '0', 10) || 0, 0, Math.max(0, LEVELS.length - 1));
  const forceDemo = params.get('demo') === '1';

  /* ---------------- 工具 ---------------- */

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function norm(h) { return ((h % 360) + 360) % 360; }
  function fmtTime(sec) {
    const s = Math.max(0, Math.floor(sec));
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }
  function rating(score) {
    if (score >= 850) return '活 地 图';
    if (score >= 700) return '老 向 导';
    if (score >= 500) return '认 得 路';
    return '第 一 次 来';
  }

  /* ---------------- 罗盘 ---------------- */

  const cv = $('compass');
  const ctx = cv.getContext('2d');
  const CSIZE = 600, CC = 300, CR = 258;
  let cscale = 1;

  function fitCompass() {
    const rect = cv.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    cv.width = Math.max(1, Math.round(rect.width * dpr));
    cv.height = cv.width;
    cscale = cv.width / CSIZE;
  }

  let lastAbs = 0;

  function onOrient(e, isAbs) {
    // 演示模式下忽略真实传感器：拖出来的角度不能被覆盖
    if (forceDemo) return;

    const now = performance.now();
    if (isAbs) lastAbs = now;
    else if (now - lastAbs < 600) return;      // 有绝对事件时忽略相对事件

    let h = null;
    let absolute = false;

    if (typeof e.webkitCompassHeading === 'number' && isFinite(e.webkitCompassHeading)) {
      h = e.webkitCompassHeading;               // iOS，天然绝对
      absolute = true;
    } else if (typeof e.alpha === 'number' && isFinite(e.alpha)) {
      absolute = (e.absolute === true) || isAbs;
      if (!absolute) {
        // 相对 alpha 的零点随开机姿态变，不能当绝对方位用
        state.relativeOnly = true;
        return;
      }
      h = 360 - e.alpha;
    }

    if (h === null) return;

    state.heading = norm(h);
    state.headingAbsolute = true;
    state.sensorSeen = true;

    if (state.simulating && !forceDemo) {
      state.simulating = false;
      $('sim-tip').hidden = true;
    }
  }

  window.addEventListener('deviceorientationabsolute', (e) => onOrient(e, true), true);
  window.addEventListener('deviceorientation', (e) => onOrient(e, false), true);

  function updateAlign() {
    if (!state.headingAbsolute || state.target == null || state.heading == null) {
      state.aligned = false;
      return;
    }
    const diff = Math.abs(((state.heading - state.target + 540) % 360) - 180);
    state.aligned = diff <= 6;
  }

  function drawCompass() {
    if (!cscale) return;
    const live = state.heading != null;
    const h = live ? state.heading : 0;

    ctx.setTransform(cscale, 0, 0, cscale, 0, 0);
    ctx.clearRect(0, 0, CSIZE, CSIZE);

    // 外圈
    ctx.beginPath();
    ctx.arc(CC, CC, CR + 22, 0, Math.PI * 2);
    ctx.fillStyle = '#080a0d';
    ctx.fill();
    ctx.strokeStyle = '#1d2228';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 顶端固定指标
    ctx.beginPath();
    ctx.moveTo(CC, CC - CR - 2);
    ctx.lineTo(CC - 14, CC - CR - 28);
    ctx.lineTo(CC + 14, CC - CR - 28);
    ctx.closePath();
    ctx.fillStyle = state.aligned ? '#79b473' : (live ? '#e8b04b' : '#3a3f47');
    ctx.fill();

    ctx.save();
    ctx.translate(CC, CC);
    ctx.rotate(-h * Math.PI / 180);

    // 盘面
    const g = ctx.createRadialGradient(0, -CR * 0.3, 20, 0, 0, CR);
    g.addColorStop(0, '#1b2027');
    g.addColorStop(0.7, '#12161b');
    g.addColorStop(1, '#0c0f13');
    ctx.beginPath();
    ctx.arc(0, 0, CR, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#2c333b';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 刻度
    for (let d = 0; d < 360; d += 5) {
      const a = (d - 90) * Math.PI / 180;
      const major = d % 90 === 0;
      const mid = d % 30 === 0;
      const outer = CR - 10;
      const inner = CR - (major ? 36 : mid ? 24 : 13);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * outer, Math.sin(a) * outer);
      ctx.lineTo(Math.cos(a) * inner, Math.sin(a) * inner);
      ctx.strokeStyle = major ? '#e6e0d2' : mid ? '#79828d' : '#39404a';
      ctx.lineWidth = major ? 5 : mid ? 3 : 1.5;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // 度数
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '500 20px ui-monospace, Menlo, Consolas, monospace';
    for (let d = 0; d < 360; d += 30) {
      if (d % 90 === 0) continue;
      const a = (d - 90) * Math.PI / 180;
      const rr = CR - 74;
      ctx.save();
      ctx.translate(Math.cos(a) * rr, Math.sin(a) * rr);
      ctx.rotate(d * Math.PI / 180);
      ctx.fillStyle = '#6b7480';
      ctx.fillText(String(d), 0, 0);
      ctx.restore();
    }

    // 方位字
    const cards = [['N', 0, '#d9534f'], ['E', 90, '#d6d0c2'], ['S', 180, '#d6d0c2'], ['W', 270, '#d6d0c2']];
    for (const [t, deg, col] of cards) {
      const a = (deg - 90) * Math.PI / 180;
      const rr = CR - 52;
      ctx.save();
      ctx.translate(Math.cos(a) * rr, Math.sin(a) * rr);
      ctx.rotate(deg * Math.PI / 180);
      ctx.fillStyle = col;
      ctx.font = '700 40px -apple-system, "PingFang SC", sans-serif';
      ctx.fillText(t, 0, 0);
      ctx.restore();
    }

    // 中心
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fillStyle = live ? '#e8b04b' : '#3a3f47';
    ctx.fill();

    ctx.restore();
  }

  let lastDraw = 0;
  function loop(t) {
    requestAnimationFrame(loop);
    if (state.screen !== 'play') return;       // 只有行进页需要刷新罗盘
    if (t - lastDraw < 33) return;
    lastDraw = t;
    updateAlign();
    drawCompass();
    paintHUD();
  }

  function paintHUD() {
    const num = $('bearing-num');
    const wrap = document.querySelector('.bearing');
    if (state.heading == null) {
      num.textContent = '--';
      wrap.classList.remove('live');
    } else {
      num.textContent = String(Math.round(state.heading) % 360).padStart(3, '0');
      wrap.classList.add('live');
    }
    $('align-badge').classList.toggle('on', state.aligned);
  }

  setInterval(() => {
    if (state.screen !== 'play' && state.screen !== 'code') return;
    if (!state.finished) state.elapsed = (Date.now() - state.startAt) / 1000;
    $('hud-time').textContent = fmtTime(state.elapsed);
  }, 250);

  /* ---------------- 屏幕 ---------------- */

  function showScreen(name) {
    if (name !== 'code') {
      // 离开输码页时，取消上一轮的验码 / 清空回调
      clearTimeout(state.checkTimer);
      clearTimeout(state.resetTimer);
      state.checkTimer = null;
      state.resetTimer = null;
    }
    Object.keys(screens).forEach((k) => screens[k].classList.toggle('active', k === name));
    state.screen = name;
    if (name === 'play') requestAnimationFrame(fitCompass);
  }

  /* ---------------- 关卡 ---------------- */

  function renderLevel() {
    const lv = LEVELS[state.level];
    state.target = lv.bearing != null ? lv.bearing : null;
    state.hintShown = 0;
    state.codeInput = '';
    state.checking = false;
    state.aligned = false;

    $('hud-level').textContent = `第 ${state.level + 1} / ${LEVELS.length} 站`;
    $('clue-text').textContent = lv.clue;
    $('clue-meta').textContent = lv.bearing != null
      ? `目标方位 ${String(Math.round(lv.bearing)).padStart(3, '0')}° · 约 ${lv.steps} 步`
      : `约 ${lv.steps} 步`;

    const box = $('hint-box');
    box.hidden = true;
    box.textContent = '';
    $('btn-hint').textContent = '要提示';

    showScreen('play');
    requestAnimationFrame(fitCompass);

    setTimeout(() => {
      if (state.sensorSeen || state.simulating) return;
      state.simulating = true;
      const tip = $('sim-tip');
      tip.hidden = false;
      tip.textContent = state.relativeOnly
        ? '浏览器只给了相对方向，不能找北：换 Chrome，或拖动表盘模拟'
        : '没检测到罗盘：拖动表盘模拟';
    }, 2500);
  }

  /* ---------------- 开始 / 权限 ---------------- */

  function requestMotionPermission() {
    return new Promise((resolve) => {
      if (typeof DeviceOrientationEvent !== 'undefined' &&
          typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
          .then((res) => {
            if (res !== 'granted') alert('需要「动作与方向」权限才能玩。iPhone：设置 → Safari → 动作与方向。');
            resolve();
          })
          .catch(() => resolve());
      } else {
        resolve();
      }
    });
  }

  let wakeLock = null;
  async function requestWakeLock() {
    try {
      if (navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen');
    } catch (e) { /* 忽略 */ }
  }

  async function releaseWakeLock() {
    try {
      if (wakeLock) {
        await wakeLock.release();
        wakeLock = null;
      }
    } catch (e) { /* 忽略 */ }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' &&
        (state.screen === 'play' || state.screen === 'code')) requestWakeLock();
  });

  async function startGame() {
    if (!LEVELS.length) {
      alert('levels.js 里还没有关卡');
      return;
    }
    await requestMotionPermission();

    state.level = startLevel;
    state.startLevelIndex = startLevel;
    state.completed = 0;
    state.hints = 0;
    state.hintShown = 0;
    state.elapsed = 0;
    state.finished = false;
    state.score = 0;
    state.startAt = Date.now();

    if (forceDemo) {
      state.simulating = true;
      const tip = $('sim-tip');
      tip.hidden = false;
      tip.textContent = '模拟模式：拖动表盘';
    }

    renderLevel();
    requestWakeLock();
  }

  /* ---------------- 提示 ---------------- */

  $('btn-hint').addEventListener('click', () => {
    const lv = LEVELS[state.level];
    if (state.hintShown >= lv.hints.length) return;

    const text = lv.hints[state.hintShown++];
    state.hints++;

    const box = $('hint-box');
    box.hidden = false;
    box.textContent = text;

    if (state.hintShown >= lv.hints.length) $('btn-hint').textContent = '没有更多提示';
  });

  /* ---------------- 输码 ---------------- */

  $('btn-arrive').addEventListener('click', () => {
    clearTimeout(state.checkTimer);
    clearTimeout(state.resetTimer);
    state.codeInput = '';
    state.checking = false;
    $('code-msg').textContent = '';
    renderCode();
    showScreen('code');
  });

  function renderCode() {
    const s = state.codeInput;
    $('code-display').textContent = s + '·'.repeat(4 - s.length);
  }

  function checkCode() {
    if (state.screen !== 'code') return;
    if (state.checking || state.codeInput.length !== 4) return;
    const lv = LEVELS[state.level];

    if (state.codeInput === String(lv.code)) {
      state.completed++;
      state.level++;
      if (state.level >= LEVELS.length) finish();
      else renderLevel();
      return;
    }

    state.checking = true;
    $('code-msg').textContent = '不对，再看看纸上的数字';
    $('code-display').classList.add('shake');
    clearTimeout(state.resetTimer);
    state.resetTimer = setTimeout(() => {
      $('code-display').classList.remove('shake');
      state.codeInput = '';
      state.checking = false;
      $('code-msg').textContent = '';
      renderCode();
    }, 650);
  }

  document.querySelectorAll('.key').forEach((btn) => {
    btn.addEventListener('click', () => {
      const k = btn.dataset.k;
      if (k === 'back') { showScreen('play'); return; }
      if (k === 'clear') { state.codeInput = ''; renderCode(); return; }
      if (state.codeInput.length >= 4 || state.checking) return;

      state.codeInput += k;
      renderCode();
      if (state.codeInput.length === 4) {
        clearTimeout(state.checkTimer);
        state.checkTimer = setTimeout(checkCode, 250);
      }
    });
  });

  window.addEventListener('keydown', (e) => {
    if (state.screen !== 'code') return;
    if (/^[0-9]$/.test(e.key)) {
      if (state.codeInput.length < 4 && !state.checking) {
        state.codeInput += e.key;
        renderCode();
        if (state.codeInput.length === 4) {
          clearTimeout(state.checkTimer);
          state.checkTimer = setTimeout(checkCode, 250);
        }
      }
    } else if (e.key === 'Backspace') {
      state.codeInput = state.codeInput.slice(0, -1);
      renderCode();
    }
  });

  /* ---------------- 模拟罗盘 ---------------- */

  let dragX = null;

  cv.addEventListener('pointerdown', (e) => {
    if (!state.simulating) return;
    dragX = e.clientX;
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
  });

  cv.addEventListener('pointermove', (e) => {
    if (!state.simulating || dragX === null) return;
    const dx = e.clientX - dragX;
    dragX = e.clientX;
    state.heading = norm((state.heading == null ? 0 : state.heading) + dx * 0.7);
  });

  cv.addEventListener('pointerup', () => { dragX = null; });
  cv.addEventListener('pointercancel', () => { dragX = null; });

  window.addEventListener('keydown', (e) => {
    if (!state.simulating) return;
    if (e.key === 'ArrowLeft') state.heading = norm((state.heading || 0) - 5);
    if (e.key === 'ArrowRight') state.heading = norm((state.heading || 0) + 5);
  });

  /* ---------------- 结算 ---------------- */

  function finish() {
    state.finished = true;
    state.elapsed = (Date.now() - state.startAt) / 1000;
    state.score = Math.max(100, Math.round(
      CFG.baseScore - state.elapsed * CFG.timePenalty - state.hints * CFG.hintPenalty
    ));

    $('end-time').textContent = fmtTime(state.elapsed);
    $('end-hints').textContent = String(state.hints);
    $('end-score').textContent = String(state.score);
    $('end-rating').textContent = rating(state.score);

    const debug = state.startLevelIndex > 0;
    const debugEl = $('end-debug');
    debugEl.hidden = !debug;
    debugEl.textContent = debug
      ? `调试模式 · 从第 ${state.startLevelIndex + 1} 站开始，只完成 ${state.completed} 站`
      : '';

    drawCard(state.score, {
      startLevel: state.startLevelIndex,
      completed: state.completed
    });
    showScreen('end');
    releaseWakeLock();
  }

  function drawRose(x, cx, cy, r) {
    for (let i = 0; i < 8; i++) {
      const long = i % 2 === 0;
      const a = i * Math.PI / 4;
      const len = long ? r : r * 0.6;
      const w = long ? 16 : 10;
      const tipX = cx + Math.sin(a) * len;
      const tipY = cy - Math.cos(a) * len;
      const leftX = cx + Math.sin(a - Math.PI / 2) * w;
      const leftY = cy - Math.cos(a - Math.PI / 2) * w;
      const rightX = cx + Math.sin(a + Math.PI / 2) * w;
      const rightY = cy - Math.cos(a + Math.PI / 2) * w;
      const inX = cx + Math.sin(a) * len * 0.18;
      const inY = cy - Math.cos(a) * len * 0.18;

      x.beginPath();
      x.moveTo(tipX, tipY);
      x.lineTo(leftX, leftY);
      x.lineTo(inX, inY);
      x.lineTo(rightX, rightY);
      x.closePath();
      x.fillStyle = long ? '#e8b04b' : 'rgba(232,176,75,.42)';
      x.fill();
    }
  }

  function drawCard(score, opts) {
    const doneStart = opts ? opts.startLevel : 0;
    const doneEnd = opts ? opts.startLevel + opts.completed : LEVELS.length;
    const W = 750, H = 1200;
    const card = $('card');
    card.width = W;
    card.height = H;
    const x = card.getContext('2d');

    const bg = x.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#11151a');
    bg.addColorStop(1, '#080a0d');
    x.fillStyle = bg;
    x.fillRect(0, 0, W, H);

    x.strokeStyle = 'rgba(232,176,75,.22)';
    x.lineWidth = 2;
    x.strokeRect(26, 26, W - 52, H - 52);

    if (doneStart > 0) {
      x.fillStyle = 'rgba(232,176,75,.55)';
      x.font = '400 20px -apple-system,"PingFang SC",sans-serif';
      x.textAlign = 'right';
      x.fillText('调试成绩', W - 56, 78);
    }

    x.textAlign = 'center';

    x.fillStyle = '#e8b04b';
    x.font = '700 96px "Songti SC","SimSun",serif';
    x.fillText('問 津', W / 2, 190);

    x.fillStyle = '#8a8578';
    x.font = '400 26px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    x.fillText('只带指南针的一次找路', W / 2, 240);

    x.fillStyle = '#f0ece3';
    x.font = '200 150px ui-monospace,Menlo,Consolas,monospace';
    x.fillText(fmtTime(state.elapsed), W / 2, 440);

    x.fillStyle = '#6b7280';
    x.font = '400 24px -apple-system,"PingFang SC",sans-serif';
    x.fillText('用 时', W / 2, 490);

    const sy = 580;
    x.fillStyle = '#e8b04b';
    x.font = '400 46px ui-monospace,Menlo,Consolas,monospace';
    x.fillText(String(score), W / 2 - 150, sy);
    x.fillText(String(state.hints), W / 2 + 150, sy);
    x.fillStyle = '#6b7280';
    x.font = '400 22px -apple-system,"PingFang SC",sans-serif';
    x.fillText('得分', W / 2 - 150, sy + 40);
    x.fillText('提示', W / 2 + 150, sy + 40);

    x.strokeStyle = 'rgba(255,255,255,.08)';
    x.beginPath();
    x.moveTo(120, 680);
    x.lineTo(W - 120, 680);
    x.stroke();

    x.fillStyle = '#e8b04b';
    x.font = '400 34px "Songti SC","SimSun",serif';
    x.fillText(rating(score), W / 2, 748);

    // 五站圆点
    const n = LEVELS.length;
    const gap = Math.min(86, 520 / Math.max(1, n - 1));
    const startX = W / 2 - (n - 1) * gap / 2;
    for (let i = 0; i < n; i++) {
      const cx = startX + i * gap;
      const done = i >= doneStart && i < doneEnd;
      x.beginPath();
      x.arc(cx, 820, 10, 0, Math.PI * 2);
      if (done) {
        x.fillStyle = '#e8b04b';
        x.fill();
        x.strokeStyle = '#0b0d10';
        x.lineWidth = 3;
        x.beginPath();
        x.moveTo(cx - 4, 820);
        x.lineTo(cx - 1, 824);
        x.lineTo(cx + 5, 815);
        x.stroke();
      } else {
        x.strokeStyle = 'rgba(232,176,75,.28)';
        x.lineWidth = 2;
        x.stroke();
      }
    }

    drawRose(x, W / 2, 950, 88);

    x.fillStyle = '#565d66';
    x.font = '400 22px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    x.fillText(`${CFG.event} · ${CFG.venue}`, W / 2, 1096);
    x.fillText(new Date().toLocaleDateString('zh-CN'), W / 2, 1136);

    $('btn-save').href = card.toDataURL('image/png');
  }

  /* ---------------- 事件 ---------------- */

  $('btn-start').addEventListener('click', startGame);

  $('btn-again').addEventListener('click', () => {
    state.finished = false;
    state.elapsed = 0;
    startGame();
  });

  window.addEventListener('resize', fitCompass);
  window.addEventListener('orientationchange', () => setTimeout(fitCompass, 150));

  requestAnimationFrame(loop);
})();
