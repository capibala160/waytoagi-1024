/* ============================================================
   问津 · 会场微定向
   引擎只做四件事：读罗盘、走关卡、验码、出旅程卡。
   关卡内容全在 levels.js，不要改这里。
   ============================================================ */

(() => {
  'use strict';

  const SETS = window.LEVEL_SETS || {};
  if (!SETS.outdoor && window.LEVELS) {
    SETS.outdoor = { key: 'outdoor', name: '出门玩', desc: '', levels: window.LEVELS };
  }

  const SAVE_KEY = 'wenjin-save-v1';
  const SAVE_TTL_MS = 7 * 864e5;

  const CFG = Object.assign({
    venue: '会场',
    event: '问津',
    baseScore: 1000,
    timePenalty: 250,
    hintSeconds: 6
  }, window.GAME_CONFIG || {});

  const $ = (id) => document.getElementById(id);

  const screens = {
    start: $('screen-start'),
    modes: $('screen-modes'),
    confirm: $('screen-confirm'),
    how: $('screen-how'),
    play: $('screen-play'),
    code: $('screen-code'),
    end: $('screen-end')
  };

  const state = {
    screen: 'start',
    mode: 'outdoor',
    levels: SETS.outdoor ? SETS.outdoor.levels : [],
    free: false,
    dest: null,
    pendingDest: null,
    gps: null,
    gpsStatus: '',
    dist: null,
    path: [],
    lastPathAt: 0,
    watchId: null,
    simPos: null,
    simSteps: 0,
    level: 0,
    startAt: 0,
    elapsed: 0,
    hints: 0,
    hintShown: 0,
    asks: 0,
    lastVibeAt: 0,
    toastTimer: null,
    heading: null,
    headingAbsolute: false,
    relativeOnly: false,
    lastOrientAt: 0,
    target: null,
    aligned: false,
    sensorSeen: false,
    simulating: false,
    codeInput: '',
    checking: false,
    startLevelIndex: 0,
    par: 300,
    completed: 0,
    usedSimulation: false,
    story: [],
    stamps: [],
    lamps: 3,
    puzzleHints: 0,
    optionalDone: false,
    bonusMode: false,
    alignSince: 0,
    alignLocked: false,
    stampTimer: null,
    checkTimer: null,
    resetTimer: null,
    finished: false,
    score: 0
  };

  const params = new URLSearchParams(location.search);
  const paramLevel = parseInt(params.get('level') || '0', 10) || 0;
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

  function isPlaying() {
    return !state.finished && (state.screen === 'play' || state.screen === 'code');
  }

  function practiceRun() {
    return forceDemo || state.usedSimulation || state.startLevelIndex > 0;
  }

  function saveSignatureFor(mode, levels) {
    return mode + ':' + levels.map((l) => l.code + '/' + l.bearing + '/' + l.steps).join('|');
  }

  function validateSet(set) {
    const errors = [];
    if (!set || !Array.isArray(set.levels) || !set.levels.length) {
      return ['至少配置一个站点。'];
    }
    set.levels.forEach((lv, i) => {
      const p = `第 ${i + 1} 站：`;
      if (!lv || typeof lv !== 'object') { errors.push(p + '站点必须是对象。'); return; }
      if (typeof lv.code !== 'string' || !/^\d{4}$/.test(lv.code)) errors.push(p + 'code 必须是四位数字字符串。');
      if (!Number.isFinite(lv.bearing) || lv.bearing < 0 || lv.bearing >= 360) errors.push(p + 'bearing 必须在 0–359。');
      if (!Number.isFinite(lv.steps) || lv.steps < 0) errors.push(p + 'steps 必须是非负数字。');
      if (typeof lv.clue !== 'string' || !lv.clue.trim()) errors.push(p + '请填写 clue。');
      if (!Array.isArray(lv.hints) || lv.hints.some((h) => typeof h !== 'string' || !h.trim())) errors.push(p + 'hints 必须是文字数组。');
    });
    if (!Number.isFinite(set.par) || set.par <= 0) errors.push('par 必须是正数。');
    return errors;
  }

  function validateAll() {
    const errors = [];
    Object.keys(SETS).forEach((key) => {
      const set = SETS[key];
      validateSet(set).forEach((e) => errors.push(`${set.name || key}：${e}`));
    });
    validateDestinations().forEach((e) => errors.push('自由行：' + e));
    return errors;
  }

  function saveProgress() {
    if (!isPlaying()) return;
    if (state.mode === 'sim') return;
    try {
      if (state.mode === 'free') {
        localStorage.setItem(SAVE_KEY, JSON.stringify({
          v: 1,
          mode: 'free',
          sig: 'free:' + state.dest.id,
          destId: state.dest.id,
          elapsed: state.elapsed,
          asks: state.asks,
          savedAt: Date.now(),
          path: state.path.slice(-40)
        }));
        return;
      }
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        v: 1,
        mode: state.mode,
        sig: saveSignatureFor(state.mode, state.levels),
        level: state.level,
        startLevel: state.startLevelIndex,
        completed: state.completed,
        hints: state.hints,
        hintShown: state.hintShown,
        asks: state.asks,
        story: state.story.slice(),
        stamps: state.stamps.slice(),
        lamps: state.lamps,
        puzzleHints: state.puzzleHints,
        optionalDone: state.optionalDone,
        elapsed: state.elapsed,
        savedAt: Date.now(),
        usedSimulation: state.usedSimulation
      }));
    } catch (e) { /* 隐私模式或存储满时照常玩 */ }
  }

  function readProgress() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!d || d.v !== 1) return null;

      if (d.mode === 'free') {
        const dest = (window.DESTINATIONS || []).find((x) => x.id === d.destId);
        if (!dest || d.sig !== 'free:' + dest.id) return null;
        if (!Number.isFinite(d.elapsed) || d.elapsed < 0 || d.elapsed > 604800) return null;
        if (!Number.isInteger(d.asks) || d.asks < 0) return null;
        if (!Number.isFinite(d.savedAt) || d.savedAt > Date.now() + 300000 || Date.now() - d.savedAt > SAVE_TTL_MS) return null;
        return d;
      }

      const set = SETS[d.mode];
      if (!set || !Array.isArray(set.levels) || !set.levels.length) return null;
      if (d.sig !== saveSignatureFor(d.mode, set.levels)) return null;
      if (!Number.isInteger(d.level) || d.level < 0 || d.level >= set.levels.length) return null;
      if (!Number.isInteger(d.startLevel) || d.startLevel < 0 || d.startLevel > d.level) return null;
      if (!Number.isInteger(d.completed) || d.completed < 0) return null;
      if (!Number.isInteger(d.hints) || d.hints < 0) return null;
      if (!Number.isInteger(d.hintShown) || d.hintShown < 0) return null;
      if (!Number.isInteger(d.asks) || d.asks < 0) return null;
      if (!Number.isFinite(d.elapsed) || d.elapsed < 0 || d.elapsed > 604800) return null;
      if (!Number.isFinite(d.savedAt) || d.savedAt > Date.now() + 300000 || Date.now() - d.savedAt > SAVE_TTL_MS) return null;
      if (typeof d.usedSimulation !== 'boolean') return null;
      if (!Array.isArray(d.story) || d.story.some((s) => typeof s !== 'string')) return null;
      if (!Array.isArray(d.stamps) || d.stamps.some((s) => typeof s !== 'string')) return null;
      if (!Number.isInteger(d.lamps) || d.lamps < 0 || d.lamps > 9) return null;
      if (!Number.isInteger(d.puzzleHints) || d.puzzleHints < 0) return null;
      if (typeof d.optionalDone !== 'boolean') return null;
      return d;
    } catch (e) {
      return null;
    }
  }

  function clearProgress() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* 忽略 */ }
    $('btn-resume').hidden = true;
  }

  function refreshResume() {
    const d = readProgress();
    $('btn-resume').hidden = !d;
    if (!d) return;

    if (d.mode === 'free') {
      const dest = (window.DESTINATIONS || []).find((x) => x.id === d.destId);
      $('start-message').textContent = `上次去「${dest.name}」没走完，可继续。关闭页面期间仍计时。`;
      return;
    }

    const set = SETS[d.mode];
    $('start-message').textContent = `上次走到「${set.name}」第 ${d.level + 1} 站，可继续。关闭页面期间仍计时。`;
  }

  function resumeGame() {
    const d = readProgress();
    if (!d) {
      refreshResume();
      $('start-message').textContent = '没有可恢复的旅程，请重新开始。';
      return;
    }

    if (d.mode === 'free') {
      const dest = (window.DESTINATIONS || []).find((x) => x.id === d.destId);
      if (!dest) {
        refreshResume();
        $('start-message').textContent = '这个目的地已不在列表里，请重新选。';
        return;
      }
      requestMotionPermission();

      const closed = Math.max(0, (Date.now() - d.savedAt) / 1000);
      const total = Math.max(0, d.elapsed + closed);

      state.mode = 'free';
      state.free = true;
      state.dest = dest;
      state.levels = [];
      state.par = FREE_PAR;
      state.level = 0;
      state.startLevelIndex = 0;
      state.completed = 0;
      state.hints = 0;
      state.hintShown = 0;
      state.asks = d.asks;
      state.story = [];
      state.stamps = [];
      state.puzzleHints = 0;
      state.optionalDone = false;
      state.usedSimulation = false;
      state.finished = false;
      state.score = 0;
      state.elapsed = total;
      state.startAt = Date.now() - total * 1000;
      state.path = Array.isArray(d.path) ? d.path.slice() : [];
      state.lastPathAt = 0;
      state.gps = null;
      state.dist = null;
      state.gpsStatus = '定位中…';
      state.target = null;
      state.heading = null;
      state.headingAbsolute = false;
      state.relativeOnly = false;
      state.sensorSeen = false;
      state.lastOrientAt = 0;
      state.simulating = false;
      state.aligned = false;
      $('sim-tip').hidden = true;

      renderFree();
      wantWakeLock = true;
      requestWakeLock();
      return;
    }

    const set = SETS[d.mode];
    const errors = validateSet(set);
    if (errors.length) {
      $('start-message').textContent = errors.slice(0, 3).join('\n');
      return;
    }

    requestMotionPermission();

    state.mode = d.mode;
    state.levels = set.levels;
    state.par = set.par || 300;
    state.startLevelIndex = d.startLevel;
    state.level = d.level;
    state.completed = d.completed;
    state.hints = d.hints;
    state.hintShown = d.hintShown;
    state.asks = d.asks;
    state.story = d.story.slice();
    state.stamps = d.stamps.slice();
    state.lamps = d.lamps;
    state.puzzleHints = d.puzzleHints;
    state.optionalDone = d.optionalDone;
    state.bonusMode = false;
    state.alignLocked = false;
    state.alignSince = 0;
    state.usedSimulation = d.usedSimulation;
    state.finished = false;
    state.score = 0;
    state.codeInput = '';
    state.checking = false;

    const closed = Math.max(0, (Date.now() - d.savedAt) / 1000);
    const total = Math.max(0, d.elapsed + closed);
    state.elapsed = total;
    state.startAt = Date.now() - total * 1000;

    state.heading = null;
    state.headingAbsolute = false;
    state.relativeOnly = false;
    state.sensorSeen = false;
    state.lastOrientAt = 0;
    state.simulating = false;
    state.aligned = false;
    $('sim-tip').hidden = true;

    renderLevel();
    state.hintShown = d.hintShown;
    renderHints();
    saveProgress();

    if (state.usedSimulation) goSimulation('上次用了模拟罗盘，继续模拟');

    wantWakeLock = true;
    requestWakeLock();
  }

  /* ---------------- 罗盘 ---------------- */

  const cv = $('compass');
  const ctx = cv.getContext('2d');
  const CSIZE = 600, CC = 300, CR = 258;
  const HEADING_STALE_MS = 2500;
  const ARRIVE_METERS = 30;
  const FREE_PAR = 600;
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
    if (!isAbs && now - lastAbs < 600) return;  // 有绝对事件时忽略相对事件

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

    // 无效事件不能占用 lastAbs，否则会压掉随后到达的有效读数
    if (h === null) return;
    if (absolute) lastAbs = now;

    state.heading = norm(h);
    state.headingAbsolute = true;
    state.lastOrientAt = now;
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
      state.alignSince = 0;
      state.alignLocked = false;
      return;
    }
    // 断流：旧角度不再算“已对准”
    if (performance.now() - state.lastOrientAt > HEADING_STALE_MS) {
      state.aligned = false;
      state.alignSince = 0;
      state.alignLocked = false;
      return;
    }
    const was = state.aligned;
    const diff = Math.abs(((state.heading - state.target + 540) % 360) - 180);
    state.aligned = diff <= 6;

    // 进入对准区间时震一下，走路不用一直盯屏
    if (state.aligned && !was && typeof navigator.vibrate === 'function' &&
        performance.now() - state.lastVibeAt > 1200) {
      navigator.vibrate(25);
      state.lastVibeAt = performance.now();
    }

    // 稳定对准 0.9 秒后锁定，出现光环和确认语
    if (!state.aligned) {
      state.alignSince = 0;
      state.alignLocked = false;
    } else if (!state.alignSince) {
      state.alignSince = performance.now();
    } else if (!state.alignLocked && performance.now() - state.alignSince > 900) {
      state.alignLocked = true;
      if (typeof navigator.vibrate === 'function') navigator.vibrate([15, 40, 15]);
    }
  }

  function goSimulation(reason) {
    if (!state.simulating) {
      state.simulating = true;
      state.usedSimulation = true;
      state.heading = null;
      state.headingAbsolute = false;
      state.aligned = false;
    }
    const tip = $('sim-tip');
    tip.hidden = false;
    tip.textContent = reason || '拖动表盘模拟';
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

    // 稳定对准：绿色光环
    if (state.alignLocked) {
      ctx.save();
      ctx.translate(CC, CC);
      ctx.beginPath();
      ctx.arc(0, 0, CR + 10, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(121,180,115,.85)';
      ctx.lineWidth = 3;
      ctx.shadowColor = 'rgba(121,180,115,.9)';
      ctx.shadowBlur = 24;
      ctx.stroke();
      ctx.restore();
    }

    // 自由行：目标方位标记（相对手机顶部）
    if ((state.mode === 'free' || state.mode === 'sim') && state.target != null && live) {
      const rel = norm(state.target - h);
      ctx.save();
      ctx.translate(CC, CC);
      ctx.rotate(rel * Math.PI / 180);
      ctx.beginPath();
      ctx.moveTo(0, -CR - 4);
      ctx.lineTo(-12, -CR - 26);
      ctx.lineTo(12, -CR - 26);
      ctx.closePath();
      ctx.fillStyle = state.aligned ? '#79b473' : '#e8b04b';
      ctx.fill();
      ctx.restore();
    }
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
    $('halo-text').classList.toggle('on', state.alignLocked);
  }

  let lastSaveAt = 0;
  setInterval(() => {
    if (!isPlaying()) return;
    state.elapsed = Math.max(0, (Date.now() - state.startAt) / 1000);
    $('hud-time').textContent = fmtTime(state.elapsed);

    if (performance.now() - lastSaveAt > 1000) {
      saveProgress();
      lastSaveAt = performance.now();
    }

    // 罗盘断流：不再沿用旧角度，切模拟兜底
    if (!forceDemo && !state.simulating && state.heading != null &&
        performance.now() - state.lastOrientAt > HEADING_STALE_MS) {
      goSimulation('罗盘数据中断：拖动表盘模拟');
    }
  }, 250);

  /* ---------------- 屏幕 ---------------- */

  function showToast(text) {
    const el = $('toast');
    el.textContent = text;
    el.classList.add('on');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => el.classList.remove('on'), 1300);
  }

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

  function distanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const p1 = lat1 * Math.PI / 180;
    const p2 = lat2 * Math.PI / 180;
    const dp = (lat2 - lat1) * Math.PI / 180;
    const dl = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function bearingTo(lat1, lon1, lat2, lon2) {
    const p1 = lat1 * Math.PI / 180;
    const p2 = lat2 * Math.PI / 180;
    const dl = (lon2 - lon1) * Math.PI / 180;
    const y = Math.sin(dl) * Math.cos(p2);
    const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
    return norm(Math.atan2(y, x) * 180 / Math.PI);
  }

  function validateDestinations() {
    const list = window.DESTINATIONS || [];
    const errors = [];
    if (!Array.isArray(list) || !list.length) return ['destinations.js 里还没有目的地。'];
    list.forEach((d, i) => {
      const p = `目的地 ${i + 1}：`;
      if (!d || typeof d !== 'object') { errors.push(p + '必须是对象。'); return; }
      if (typeof d.id !== 'string' || !d.id) errors.push(p + 'id 必填。');
      if (typeof d.name !== 'string' || !d.name.trim()) errors.push(p + 'name 必填。');
      if (!Number.isFinite(d.lat) || d.lat < -90 || d.lat > 90) errors.push(p + 'lat 不合法。');
      if (!Number.isFinite(d.lon) || d.lon < -180 || d.lon > 180) errors.push(p + 'lon 不合法。');
    });
    return errors;
  }

  function paintFreeStatus() {
    if (state.mode !== 'free') return;
    let text = state.gpsStatus || '定位中…';
    if (state.gps && state.dist != null) {
      if (state.dist <= ARRIVE_METERS) text = '到了';
      else if (state.dist <= 80) text = '很近了';
      else text = '跟着指针走';
    }
    const el = $('free-status');
    if (el.textContent !== text) el.textContent = text;
  }

  function stopGps() {
    if (state.watchId != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(state.watchId);
      state.watchId = null;
    }
  }

  function startGps() {
    if (!navigator.geolocation) {
      state.gpsStatus = '这台设备没有定位能力';
      paintFreeStatus();
      return;
    }
    stopGps();
    state.gpsStatus = '定位中…';
    paintFreeStatus();
    state.watchId = navigator.geolocation.watchPosition(onPos, onGpsErr, {
      enableHighAccuracy: true,
      maximumAge: 2000,
      timeout: 12000
    });
  }

  function onPos(pos) {
    if (state.mode !== 'free' || state.finished) return;
    const c = pos.coords;
    state.gps = { lat: c.latitude, lon: c.longitude };
    state.dist = distanceMeters(c.latitude, c.longitude, state.dest.lat, state.dest.lon);
    state.target = bearingTo(c.latitude, c.longitude, state.dest.lat, state.dest.lon);
    state.gpsStatus = c.accuracy > 60 ? '信号弱，走两步再看看' : '已定位';

    const now = performance.now();
    if (!state.path.length || now - state.lastPathAt > 5000) {
      state.path.push({ lat: c.latitude, lon: c.longitude });
      if (state.path.length > 240) state.path.shift();
      state.lastPathAt = now;
    }

    paintFreeStatus();
    if (state.dist <= ARRIVE_METERS) finishFree(true);
  }

  function onGpsErr(err) {
    if (state.mode !== 'free') return;
    state.gpsStatus = err && err.code === 1
      ? '定位权限被拒绝'
      : '定位失败，换个开阔处再试';
    paintFreeStatus();
  }

  function renderSuggestions(filter) {
    const q = (filter || '').trim();
    const list = (window.DESTINATIONS || [])
      .filter((d) => !q || d.name.includes(q) || (d.blurb || '').includes(q))
      .slice(0, 6);
    const box = $('dest-suggest');
    box.replaceChildren();
    list.forEach((d) => {
      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.textContent = d.name;
      chip.addEventListener('click', () => showConfirm(d));
      box.appendChild(chip);
    });
  }

  function renderRecent() {
    let recent = [];
    try { recent = JSON.parse(localStorage.getItem('wenjin-recent') || '[]'); } catch (e) { recent = []; }
    if (!Array.isArray(recent)) recent = [];

    const items = recent
      .map((r) => (window.DESTINATIONS || []).find((d) => d.id === r.id))
      .filter(Boolean)
      .slice(0, 3);

    const block = $('recent-block');
    const list = $('recent-list');
    list.replaceChildren();
    block.hidden = !items.length;

    items.forEach((d) => {
      const row = document.createElement('button');
      row.className = 'recent-item';
      const name = document.createElement('b');
      name.textContent = d.name;
      const when = document.createElement('span');
      const at = recent.find((r) => r.id === d.id);
      when.textContent = at && at.at
        ? new Date(at.at).toLocaleDateString('zh-CN')
        : '再去';
      row.appendChild(name);
      row.appendChild(when);
      row.addEventListener('click', () => showConfirm(d));
      list.appendChild(row);
    });
  }

  function rememberDest(dest) {
    let recent = [];
    try { recent = JSON.parse(localStorage.getItem('wenjin-recent') || '[]'); } catch (e) { recent = []; }
    if (!Array.isArray(recent)) recent = [];
    recent = recent.filter((r) => r.id !== dest.id);
    recent.unshift({ id: dest.id, name: dest.name, at: Date.now() });
    recent = recent.slice(0, 5);
    try { localStorage.setItem('wenjin-recent', JSON.stringify(recent)); } catch (e) { /* 忽略 */ }
    renderRecent();
  }

  function renderHome() {
    renderSuggestions('');
    renderRecent();
  }

  function showConfirm(dest) {
    if (!dest) return;
    state.pendingDest = dest;
    $('confirm-name').textContent = dest.name;
    $('confirm-blurb').textContent = dest.blurb || '';
    showScreen('confirm');
  }

  function showHow(dest) {
    if (!dest) return;
    state.pendingDest = dest;
    $('how-name').textContent = dest.name;
    showScreen('how');
  }

  function randomDest() {
    const list = window.DESTINATIONS || [];
    if (!list.length) return null;
    return list[Math.floor(Math.random() * list.length)];
  }

  function startFree(dest) {
    if (!dest) return;
    requestMotionPermission();
    rememberDest(dest);

    stopGps();
    clearProgress();

    state.mode = 'free';
    state.free = true;
    state.dest = dest;
    state.simPos = null;
    state.simSteps = 0;
    state.levels = [];
    state.par = FREE_PAR;
    state.level = 0;
    state.startLevelIndex = 0;
    state.completed = 0;
    state.hints = 0;
    state.hintShown = 0;
    state.asks = 0;
    state.story = [];
    state.stamps = [];
    state.puzzleHints = 0;
    state.optionalDone = false;
    state.usedSimulation = false;
    state.finished = false;
    state.score = 0;
    state.elapsed = 0;
    state.startAt = Date.now();
    state.path = [];
    state.lastPathAt = 0;
    state.gps = null;
    state.dist = null;
    state.gpsStatus = '定位中…';
    state.target = null;
    state.heading = null;
    state.headingAbsolute = false;
    state.relativeOnly = false;
    state.sensorSeen = false;
    state.lastOrientAt = 0;
    state.simulating = false;
    state.aligned = false;
    $('sim-tip').hidden = true;

    renderFree();
    wantWakeLock = true;
    requestWakeLock();
  }

  function renderFree() {
    $('hud-level').textContent = '自由行';
    $('clue-card').hidden = true;
    $('free-card').hidden = false;
    $('free-name').textContent = state.dest.name;
    $('free-blurb').textContent = state.dest.blurb || '';
    $('btn-hint').hidden = true;
    $('hint-box').hidden = true;
    $('btn-forward').hidden = true;
    $('btn-arrive').textContent = '我到了';
    $('stat-hints').hidden = true;
    $('clue-type').textContent = '';
    $('halo-text').textContent = `方向确认，去「${state.dest.name}」`;
    $('halo-text').classList.remove('on');
    $('btn-bonus').hidden = true;
    state.bonusMode = false;
    state.alignLocked = false;
    state.alignSince = 0;
    paintFreeStatus();
    showScreen('play');
    requestAnimationFrame(fitCompass);
    startGps();
    saveProgress();

    setTimeout(() => {
      if (state.sensorSeen || state.simulating) return;
      goSimulation('没检测到罗盘：拖动表盘模拟');
    }, 2500);
  }

  function finishFree(auto) {
    if (state.finished) return;
    state.finished = true;
    state.elapsed = Math.max(0, (Date.now() - state.startAt) / 1000);

    const reasons = [];
    if (state.usedSimulation) reasons.push('含模拟罗盘');
    if (!auto && (!state.gps || state.dist == null || state.dist > 60)) reasons.push('手动结算');
    const practice = reasons.length > 0;
    state.usedSimulation = practice;
    state.score = Math.max(100, Math.min(1000, Math.round(
      1000 - 250 * (state.elapsed / FREE_PAR)
    )));
    stopGps();

    $('end-time').textContent = fmtTime(state.elapsed);
    $('end-hints').textContent = '0';
    $('end-asks').textContent = String(state.asks);
    $('end-score').textContent = String(state.score);
    $('end-rating').textContent = '到 了';
    $('stat-hints').hidden = true;
    renderEndExtras();

    const debugEl = $('end-debug');
    debugEl.hidden = !practice;
    debugEl.textContent = practice ? `练习成绩 · 不计入活动（${reasons.join(' · ')}）` : '';

    drawCard(state.score, {
      free: true,
      dest: state.dest,
      path: state.path,
      practice,
      badges: earnedBadges()
    });
    showScreen('end');
    releaseWakeLock();
    clearProgress();
  }

  function renderSim() {
    $('hud-level').textContent = '手机模拟';
    $('clue-card').hidden = true;
    $('free-card').hidden = false;
    $('free-name').textContent = state.dest.name;
    $('free-blurb').textContent = state.dest.blurb || '';
    $('free-status').textContent = '模拟 · 已走 0 步';
    $('btn-hint').hidden = true;
    $('hint-box').hidden = true;
    $('btn-forward').hidden = false;
    $('btn-arrive').textContent = '我到了';
    $('stat-hints').hidden = true;
    $('clue-type').textContent = '';
    $('halo-text').textContent = `方向确认，去「${state.dest.name}」`;
    $('halo-text').classList.remove('on');
    $('btn-bonus').hidden = true;
    state.bonusMode = false;
    state.alignLocked = false;
    state.alignSince = 0;
    showScreen('play');
    requestAnimationFrame(fitCompass);
  }

  function startSim(dest) {
    if (!dest) return;
    requestMotionPermission();
    rememberDest(dest);
    stopGps();
    clearProgress();

    state.mode = 'sim';
    state.free = false;
    state.dest = dest;
    state.levels = [];
    state.par = FREE_PAR;
    state.level = 0;
    state.startLevelIndex = 0;
    state.completed = 0;
    state.hints = 0;
    state.hintShown = 0;
    state.asks = 0;
    state.story = [];
    state.stamps = [];
    state.puzzleHints = 0;
    state.optionalDone = false;
    state.usedSimulation = true;
    state.finished = false;
    state.score = 0;
    state.elapsed = 0;
    state.startAt = Date.now();
    state.path = [];
    state.gps = null;
    state.dist = null;
    state.gpsStatus = '';

    state.simPos = { lat: dest.lat - 0.0027, lon: dest.lon };
    state.simSteps = 0;
    state.path.push({ lat: state.simPos.lat, lon: state.simPos.lon });
    state.target = bearingTo(state.simPos.lat, state.simPos.lon, dest.lat, dest.lon);
    state.dist = distanceMeters(state.simPos.lat, state.simPos.lon, dest.lat, dest.lon);

    state.heading = null;
    state.headingAbsolute = false;
    state.relativeOnly = false;
    state.sensorSeen = false;
    state.lastOrientAt = 0;
    state.simulating = false;
    state.aligned = false;
    state.alignLocked = false;
    state.alignSince = 0;
    $('sim-tip').hidden = true;

    renderSim();
    setTimeout(() => {
      if (state.sensorSeen || state.simulating) return;
      goSimulation('没检测到罗盘：拖动表盘模拟');
    }, 2500);

    wantWakeLock = true;
    requestWakeLock();
  }

  function simStep() {
    if (state.mode !== 'sim' || state.finished) return;
    const h = state.heading != null ? state.heading : state.target;
    const rad = h * Math.PI / 180;
    const lat = state.simPos.lat + Math.cos(rad) * 18 / 111320;
    const lon = state.simPos.lon + Math.sin(rad) * 18 /
      (111320 * Math.cos(state.simPos.lat * Math.PI / 180));

    state.simPos = { lat, lon };
    state.simSteps++;
    state.path.push({ lat, lon });
    state.target = bearingTo(lat, lon, state.dest.lat, state.dest.lon);
    state.dist = distanceMeters(lat, lon, state.dest.lat, state.dest.lon);
    $('free-status').textContent = `模拟 · 已走 ${state.simSteps} 步`;
    if (state.dist <= ARRIVE_METERS) finishSim();
  }

  function finishSim() {
    if (state.finished) return;
    state.finished = true;
    state.elapsed = Math.max(0, (Date.now() - state.startAt) / 1000);
    state.usedSimulation = true;
    state.score = Math.max(100, Math.min(1000, Math.round(
      1000 - 250 * (state.elapsed / FREE_PAR)
    )));

    $('end-time').textContent = fmtTime(state.elapsed);
    $('end-hints').textContent = '0';
    $('end-asks').textContent = String(state.asks);
    $('end-score').textContent = String(state.score);
    $('end-rating').textContent = '到 了';
    $('stat-hints').hidden = true;
    renderEndExtras();

    const debugEl = $('end-debug');
    debugEl.hidden = false;
    debugEl.textContent = '模拟成绩 · 不计入活动（手机模拟）';

    drawCard(state.score, {
      free: true,
      dest: state.dest,
      path: state.path,
      practice: true,
      badges: earnedBadges()
    });
    showScreen('end');
    releaseWakeLock();
    clearProgress();
  }

  function renderHints() {
    const lv = state.levels[state.level];
    const n = state.hintShown || 0;
    const free = !!lv.freeHint || lv.type === 'tutorial';
    const box = $('hint-box');

    if (!n) {
      box.hidden = true;
      box.textContent = '';
    } else {
      box.hidden = false;
      const lines = lv.hints.slice(0, n).map((h, i) => `${i + 1}. ${h}`);
      lines.push(free
        ? `教学提示 · 不耗灯 · 折算 +${n * CFG.hintSeconds} 秒`
        : `已用 ${n} 条 · 折算 +${n * CFG.hintSeconds} 秒 · 灯 ${state.lamps}`);
      box.textContent = lines.join('\n');
    }

    const btn = $('btn-hint');
    const exhausted = n >= lv.hints.length;
    const noLamp = !free && state.lamps <= 0;
    btn.disabled = exhausted || noLamp;
    if (exhausted) btn.textContent = '没有更多提示';
    else if (noLamp) btn.textContent = '提示灯用完了';
    else btn.textContent = free ? '要提示' : `要提示 · 灯 ${state.lamps}`;
  }

  function renderLevel() {
    state.free = false;
    state.dest = null;
    stopGps();
    $('clue-card').hidden = false;
    $('free-card').hidden = true;
    $('btn-hint').hidden = false;
    $('btn-forward').hidden = true;
    $('btn-arrive').textContent = '我到了';
    $('stat-hints').hidden = false;

    const lv = state.levels[state.level];
    state.target = lv.bearing != null ? lv.bearing : null;
    state.bonusMode = false;
    state.alignLocked = false;
    state.alignSince = 0;
    $('clue-type').textContent = lv.typeLabel || '';
    $('halo-text').textContent = lv.confirm || '';
    $('halo-text').classList.remove('on');
    $('btn-bonus').hidden = true;
    state.hintShown = 0;
    state.codeInput = '';
    state.checking = false;
    state.aligned = false;

    $('hud-level').textContent = `第 ${state.level + 1} / ${state.levels.length} 站`;
    $('clue-text').textContent = lv.clue;
    $('clue-meta').textContent = lv.bearing != null
      ? `目标方位 ${String(Math.round(lv.bearing)).padStart(3, '0')}° · 约 ${lv.steps} 步`
      : `约 ${lv.steps} 步`;

    renderHints();

    showScreen('play');
    requestAnimationFrame(fitCompass);
    saveProgress();

    setTimeout(() => {
      if (state.sensorSeen || state.simulating) return;
      goSimulation(state.relativeOnly
        ? '浏览器只给了相对方向，不能找北：换 Chrome，或拖动表盘模拟'
        : '没检测到罗盘：拖动表盘模拟');
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
  let wantWakeLock = false;

  async function requestWakeLock() {
    if (!wantWakeLock) return;
    try {
      if (!navigator.wakeLock) return;
      const lock = await navigator.wakeLock.request('screen');
      if (!wantWakeLock) {
        lock.release().catch(() => {});
        return;
      }
      wakeLock = lock;
    } catch (e) { /* 忽略 */ }
  }

  async function releaseWakeLock() {
    wantWakeLock = false;
    try {
      if (wakeLock) {
        await wakeLock.release();
        wakeLock = null;
      }
    } catch (e) { /* 忽略 */ }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      saveProgress();
      return;
    }
    if (state.screen === 'play' || state.screen === 'code') {
      wantWakeLock = true;
      requestWakeLock();
    }
  });

  window.addEventListener('pagehide', saveProgress);

  async function startGame(mode) {
    const set = SETS[mode] || SETS.outdoor;
    if (!set || !set.levels.length) {
      alert('levels.js 里还没有关卡');
      return;
    }
    const errors = validateSet(set);
    if (errors.length) {
      $('start-message').textContent = errors.slice(0, 3).join('\n');
      return;
    }
    await requestMotionPermission();

    clearProgress();
    state.usedSimulation = false;
    state.mode = mode;
    state.levels = set.levels;
    state.par = set.par || 300;
    state.story = [];
    state.stamps = [];
    state.lamps = 3;
    state.puzzleHints = 0;
    state.optionalDone = false;
    state.bonusMode = false;
    state.alignLocked = false;
    state.alignSince = 0;

    // 重开必须清掉上一局的罗盘状态，否则断流时不会触发模拟兜底
    state.heading = null;
    state.headingAbsolute = false;
    state.relativeOnly = false;
    state.sensorSeen = false;
    state.lastOrientAt = 0;
    state.simulating = false;
    state.aligned = false;
    $('sim-tip').hidden = true;

    const lv = clamp(paramLevel, 0, set.levels.length - 1);
    state.level = lv;
    state.startLevelIndex = lv;
    state.completed = 0;
    state.hints = 0;
    state.hintShown = 0;
    state.asks = 0;
    state.elapsed = 0;
    state.finished = false;
    state.score = 0;
    state.startAt = Date.now();

    if (forceDemo) {
      state.usedSimulation = true;
      state.simulating = true;
      const tip = $('sim-tip');
      tip.hidden = false;
      tip.textContent = '模拟模式：拖动表盘';
    }

    renderLevel();
    wantWakeLock = true;
    requestWakeLock();
  }

  /* ---------------- 提示 ---------------- */

  $('btn-hint').addEventListener('click', () => {
    const lv = state.levels[state.level];
    if (state.hintShown >= lv.hints.length) return;
    const free = !!lv.freeHint || lv.type === 'tutorial';
    if (!free && state.lamps <= 0) return;

    if (!free) {
      state.lamps--;
      state.puzzleHints++;
    }
    state.hintShown++;
    state.hints++;
    renderHints();
    saveProgress();
  });

  $('btn-ask').addEventListener('click', () => {
    state.asks++;
    showToast(`问了第 ${state.asks} 个人`);
    saveProgress();
  });

  /* ---------------- 输码 ---------------- */

  $('btn-arrive').addEventListener('click', () => {
    if (state.mode === 'sim') {
      if (state.dist != null && state.dist <= 80) finishSim();
      else showToast('还没到，跟着指针走');
      return;
    }
    if (state.mode === 'free') {
      if (state.dist != null && state.dist <= 80) finishFree(state.dist <= ARRIVE_METERS);
      else showToast('还没到，跟着指针走');
      return;
    }
    clearTimeout(state.checkTimer);
    clearTimeout(state.resetTimer);
    state.codeInput = '';
    state.checking = false;
    state.bonusMode = false;
    $('code-title').textContent = '输入纸上的四位码';
    $('code-msg').textContent = '';
    const lv = state.levels[state.level];
    $('btn-bonus').hidden = !(lv && lv.bonus && !state.optionalDone);
    $('btn-bonus').disabled = false;
    $('btn-bonus').textContent = '加试一题（可选）';
    renderCode();
    showScreen('code');
  });

  $('btn-bonus').addEventListener('click', () => {
    const lv = state.levels[state.level];
    if (!lv || !lv.bonus) return;
    state.bonusMode = true;
    state.codeInput = '';
    state.checking = false;
    $('code-title').textContent = lv.bonus.label || '加试题';
    $('code-msg').textContent = '';
    $('btn-bonus').hidden = true;
    renderCode();
  });

  function renderCode() {
    const s = state.codeInput;
    $('code-display').textContent = s + '·'.repeat(4 - s.length);
  }

  function showStamp(lv) {
    const el = $('stamp');
    $('stamp-mark').textContent = lv.stamp || '✓';
    $('stamp-story').textContent = lv.story || '';
    el.classList.add('on');
    clearTimeout(state.stampTimer);
    state.stampTimer = setTimeout(() => el.classList.remove('on'),
      state.levels.length <= 3 ? 1100 : 1600);
  }

  function shakeCode(message) {
    state.checking = true;
    $('code-msg').textContent = message;
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

  function checkCode() {
    if (state.screen !== 'code') return;
    if (state.checking || state.codeInput.length !== 4) return;
    const lv = state.levels[state.level];

    if (state.bonusMode) {
      if (state.codeInput === String(lv.bonus.code)) {
        state.optionalDone = true;
        state.bonusMode = false;
        state.codeInput = '';
        state.checking = false;
        $('code-title').textContent = '输入纸上的四位码';
        $('code-msg').textContent = '';
        $('btn-bonus').hidden = false;
        $('btn-bonus').disabled = true;
        $('btn-bonus').textContent = '加试题已完成';
        renderCode();
        showToast('加试题完成 · 细节观察家');
        saveProgress();
        return;
      }
      shakeCode('再想想，加试题的答案不在纸上');
      return;
    }

    if (state.codeInput === String(lv.code)) {
      state.completed++;
      if (lv.story) state.story.push(lv.story);
      if (lv.stamp) state.stamps.push(lv.stamp);
      showStamp(lv);
      state.level++;
      if (state.level >= state.levels.length) finish();
      else renderLevel();
      return;
    }

    shakeCode('不对，再看看纸上的数字');
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

  function earnedBadges() {
    const list = [];
    if (state.mode !== 'free' && state.mode !== 'sim' && state.completed >= state.levels.length) list.push('记忆拼图');
    if (state.puzzleHints === 0) list.push('独立寻路者');
    if (state.optionalDone) list.push('细节观察家');
    if (state.asks >= 3) list.push('同行向导');
    if (state.score >= 850) list.push('活地图');
    return list;
  }

  function renderEndExtras() {
    const box = $('end-badges');
    box.replaceChildren();
    earnedBadges().forEach((name) => {
      const chip = document.createElement('span');
      chip.className = 'badge-chip';
      chip.textContent = name;
      box.appendChild(chip);
    });
    $('end-story').textContent = state.story.length ? state.story.join('\n') : '';
  }

  function finish() {
    state.finished = true;
    state.free = false;
    state.dest = null;
    stopGps();
    $('stat-hints').hidden = false;
    state.elapsed = Math.max(0, (Date.now() - state.startAt) / 1000);
    // 按模式的目标时间（par）计分：正常发挥 ≈ 750，快 ≈ 850+
    const par = state.par || 300;
    const effective = state.elapsed + state.hints * CFG.hintSeconds;
    state.score = Math.max(100, Math.min(CFG.baseScore, Math.round(
      CFG.baseScore - CFG.timePenalty * (effective / par)
    )));

    $('end-time').textContent = fmtTime(state.elapsed);
    $('end-hints').textContent = String(state.hints);
    $('end-asks').textContent = String(state.asks);
    $('end-score').textContent = String(state.score);
    $('end-rating').textContent = rating(state.score);
    renderEndExtras();

    const practice = practiceRun();
    const reasons = [];
    if (state.startLevelIndex > 0) reasons.push(`第 ${state.startLevelIndex + 1} 站起，完成 ${state.completed} 站`);
    if (state.usedSimulation || forceDemo) reasons.push('含模拟罗盘');

    const debugEl = $('end-debug');
    debugEl.hidden = !practice;
    debugEl.textContent = practice ? `练习成绩 · 不计入活动（${reasons.join(' · ')}）` : '';

    drawCard(state.score, {
      startLevel: state.startLevelIndex,
      completed: state.completed,
      practice,
      badges: earnedBadges(),
      story: state.story
    });
    showScreen('end');
    releaseWakeLock();
    clearProgress();
  }

  function drawRoute(x, cx, cy, boxW, boxH, from, to) {
    const pts = [{ x: 0, y: 0 }];
    let px = 0, py = 0;

    for (let i = from; i < to; i++) {
      const lv = state.levels[i];
      const a = (lv.bearing || 0) * Math.PI / 180;
      const step = lv.steps || 10;
      px += Math.sin(a) * step;
      py -= Math.cos(a) * step;
      pts.push({ x: px, y: py });
    }
    drawPolyline(x, cx, cy, boxW, boxH, pts);
  }

  function drawGpsPath(x, cx, cy, boxW, boxH, pts) {
    if (!pts || pts.length < 2) return;
    const lat0 = pts[0].lat;
    const lon0 = pts[0].lon;
    const meters = pts.map((p) => ({
      x: (p.lon - lon0) * Math.cos(lat0 * Math.PI / 180) * 111320,
      y: -(p.lat - lat0) * 110540
    }));
    drawPolyline(x, cx, cy, boxW, boxH, meters);
  }

  function drawPolyline(x, cx, cy, boxW, boxH, pts) {
    if (!pts || pts.length < 2) return;

    let minX = 0, maxX = 0, minY = 0, maxY = 0;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);
    const scale = Math.min(boxW / spanX, boxH / spanY) * 0.82;
    const ox = cx - ((minX + maxX) / 2) * scale;
    const oy = cy - ((minY + maxY) / 2) * scale;
    const X = (p) => ox + p.x * scale;
    const Y = (p) => oy + p.y * scale;

    x.lineJoin = 'round';
    x.lineCap = 'round';
    x.strokeStyle = 'rgba(232,176,75,.72)';
    x.lineWidth = 4;
    x.beginPath();
    pts.forEach((p, i) => {
      if (i === 0) x.moveTo(X(p), Y(p));
      else x.lineTo(X(p), Y(p));
    });
    x.stroke();

    for (let i = 1; i < pts.length; i++) {
      x.beginPath();
      x.arc(X(pts[i]), Y(pts[i]), 8, 0, Math.PI * 2);
      x.fillStyle = '#e8b04b';
      x.fill();
      x.strokeStyle = '#0b0d10';
      x.lineWidth = 3;
      x.stroke();
    }

    x.beginPath();
    x.arc(X(pts[0]), Y(pts[0]), 11, 0, Math.PI * 2);
    x.strokeStyle = 'rgba(232,176,75,.9)';
    x.lineWidth = 3;
    x.stroke();

    x.fillStyle = '#6b7280';
    x.font = '400 18px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    x.fillText('起', X(pts[0]), Y(pts[0]) - 20);
  }

  function drawCard(score, opts) {
    const doneStart = opts && Number.isInteger(opts.startLevel) ? opts.startLevel : 0;
    const doneEnd = opts && Number.isInteger(opts.completed) ? doneStart + opts.completed : state.levels.length;
    const practice = !!(opts && opts.practice);
    const free = !!(opts && opts.free);
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

    if (practice) {
      x.fillStyle = 'rgba(232,176,75,.55)';
      x.font = '400 20px -apple-system,"PingFang SC",sans-serif';
      x.textAlign = 'right';
      x.fillText('练习成绩 · 不计入', W - 56, 78);
    }

    x.textAlign = 'center';

    x.fillStyle = '#e8b04b';
    x.font = '700 96px "Songti SC","SimSun",serif';
    x.fillText('犟 针', W / 2, 190);

    x.fillStyle = '#8a8578';
    x.font = '400 26px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    x.fillText(practice ? '练习旅程 · 含模拟或调试模式' : '只带指南针的一次找路', W / 2, 240);

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
    x.fillText(String(free ? state.asks : state.hints), W / 2 + 150, sy);
    x.fillStyle = '#6b7280';
    x.font = '400 22px -apple-system,"PingFang SC",sans-serif';
    x.fillText('得分', W / 2 - 150, sy + 40);
    x.fillText(free ? '问路' : '提示', W / 2 + 150, sy + 40);

    x.strokeStyle = 'rgba(255,255,255,.08)';
    x.beginPath();
    x.moveTo(120, 680);
    x.lineTo(W - 120, 680);
    x.stroke();

    x.fillStyle = '#e8b04b';
    x.font = '400 34px "Songti SC","SimSun",serif';
    x.fillText(free ? '到 了' : rating(score), W / 2, 745);

    if (free) {
      x.fillStyle = '#e8b04b';
      x.font = '400 32px "Songti SC","SimSun",serif';
      x.fillText(`目的地 · ${opts.dest.name}`, W / 2, 810);
    } else {
      x.fillStyle = '#6b7280';
      x.font = '400 22px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
      x.fillText(`问了 ${state.asks} 个人`, W / 2, 785);

      // 五站圆点
      const n = state.levels.length;
      const gap = Math.min(86, 520 / Math.max(1, n - 1));
      const startX = W / 2 - (n - 1) * gap / 2;
      for (let i = 0; i < n; i++) {
        const cx = startX + i * gap;
        const done = i >= doneStart && i < doneEnd;
        x.beginPath();
        x.arc(cx, 832, 10, 0, Math.PI * 2);
        if (done) {
          x.fillStyle = '#e8b04b';
          x.fill();
          x.strokeStyle = '#0b0d10';
          x.lineWidth = 3;
          x.beginPath();
          x.moveTo(cx - 4, 832);
          x.lineTo(cx - 1, 836);
          x.lineTo(cx + 5, 827);
          x.stroke();
        } else {
          x.strokeStyle = 'rgba(232,176,75,.28)';
          x.lineWidth = 2;
          x.stroke();
        }
      }
    }

    x.fillStyle = '#565d66';
    x.font = '400 18px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    x.fillText('你 走 的 路', W / 2, 872);
    if (free) drawGpsPath(x, W / 2, 955, 470, 150, opts.path);
    else drawRoute(x, W / 2, 955, 470, 150, doneStart, doneEnd);

    if (opts && opts.badges && opts.badges.length) {
      x.fillStyle = 'rgba(232,176,75,.82)';
      x.font = '400 19px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
      x.fillText(opts.badges.join(' · '), W / 2, 1052);
    }

    if (opts && opts.story && opts.story.length) {
      const last = opts.story[opts.story.length - 1] || '';
      const short = last.length > 26 ? last.slice(0, 26) + '…' : last;
      x.fillStyle = '#565d66';
      x.font = '400 18px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
      x.fillText(short, W / 2, 1082);
    }

    x.fillStyle = '#565d66';
    x.font = '400 22px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    x.fillText(`${CFG.event} · ${CFG.venue}`, W / 2, 1128);
    x.fillText(new Date().toLocaleDateString('zh-CN'), W / 2, 1162);

    $('btn-save').href = card.toDataURL('image/png');
  }

  /* ---------------- 事件 ---------------- */

  $('btn-start').addEventListener('click', () => startGame('outdoor'));
  $('btn-start-indoor').addEventListener('click', () => startGame('indoor'));

  $('btn-search').addEventListener('click', () => renderSuggestions($('dest-input').value));
  $('dest-input').addEventListener('input', (e) => renderSuggestions(e.target.value));
  $('btn-random').addEventListener('click', () => {
    const d = randomDest();
    if (d) showConfirm(d);
  });
  $('btn-hunt').addEventListener('click', () => showScreen('modes'));
  $('btn-modes-back').addEventListener('click', () => showScreen('start'));
  $('btn-confirm-back').addEventListener('click', () => showScreen('start'));
  $('btn-confirm-go').addEventListener('click', () => {
    if (state.pendingDest) showHow(state.pendingDest);
  });
  $('btn-how-back').addEventListener('click', () => {
    if (state.pendingDest) showConfirm(state.pendingDest);
    else showScreen('start');
  });
  $('btn-how-sim').addEventListener('click', () => {
    if (state.pendingDest) startSim(state.pendingDest);
  });
  $('btn-how-real').addEventListener('click', () => {
    if (state.pendingDest) startFree(state.pendingDest);
  });

  $('btn-resume').addEventListener('click', resumeGame);
  $('btn-forward').addEventListener('click', simStep);

  $('btn-free-exit').addEventListener('click', () => {
    stopGps();
    state.finished = true;
    state.free = false;
    state.dest = null;
    state.simPos = null;
    state.simSteps = 0;
    state.mode = 'outdoor';
    clearProgress();
    showScreen('start');
    $('btn-forward').hidden = true;
    refreshResume();
  });

  $('btn-again').addEventListener('click', () => {
    state.finished = false;
    state.elapsed = 0;
    if (state.mode === 'free' && state.dest) startFree(state.dest);
    else startGame(state.mode);
  });

  window.addEventListener('resize', fitCompass);
  window.addEventListener('orientationchange', () => setTimeout(fitCompass, 150));

  renderHome();
  refreshResume();
  const configErrors = validateAll();
  if (configErrors.length) {
    $('start-message').textContent = configErrors.slice(0, 3).join('\n');
  }

  requestAnimationFrame(loop);
})();
