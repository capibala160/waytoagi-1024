/* ============================================================
   犟针 · 阿针浮层
   独立小部件，不碰引擎（game.js）：只看屏幕上已有的 DOM。
   右下角一枚小铜罗盘；点他说台词；✕ 关掉后本局不再出现。
   打开提示条时自动抬高，不压住「我到了」。
   ============================================================ */

(() => {
  'use strict';

  const saved = (() => {
    try { return JSON.parse(localStorage.getItem('wenjin-variant') || 'null'); } catch (e) { return null; }
  })();
  const LINES = saved && Array.isArray(saved.lines) && saved.lines.length
    ? saved.lines
    : ['往那边。', '你确定？', '到了。我早说过。'];
  const NAME = saved && saved.name ? saved.name : '阿针';
  const ASK_LINE = '又问？行吧。';
  const GREET_DELAY_MS = 900;
  const BUBBLE_MS = 3800;
  const NEEDLE_POLL_MS = 100;

  const root = document.getElementById('azhen');
  if (!root) return;

  const avatar = document.getElementById('azhen-avatar');
  const bubble = document.getElementById('azhen-bubble');
  const line = document.getElementById('azhen-line');
  const closeBtn = document.getElementById('azhen-close');
  const needle = root.querySelector('.azhen-needle');
  const play = document.getElementById('screen-play');
  const hintBox = document.getElementById('hint-box');
  const btnAsk = document.getElementById('btn-ask');
  const headingNum = document.getElementById('bearing-num');

  let next = 0;
  let closed = false;
  let greeted = false;
  let bubbleTimer = null;

  function say(text) {
    if (closed) return;
    line.textContent = text;
    bubble.hidden = false;
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => { bubble.hidden = true; }, BUBBLE_MS);
  }

  avatar.setAttribute('aria-label', NAME);
  avatar.addEventListener('click', () => say(LINES[(next++) % LINES.length]));

  closeBtn.addEventListener('click', () => {
    closed = true;
    clearTimeout(bubbleTimer);
    root.hidden = true;
  });

  // 「我问了个人」被点时搭一句：只听按钮的 DOM 事件，不碰引擎状态
  if (btnAsk) btnAsk.addEventListener('click', () => say(ASK_LINE));

  // 提示条展开时把阿针抬高，别挡住下面的按钮
  if (hintBox) {
    new MutationObserver(() => {
      root.classList.toggle('lift', !hintBox.hidden);
    }).observe(hintBox, { attributes: true, attributeFilter: ['hidden'] });
  }

  // 进行页出现时：露出阿针，并主动开口一句
  if (play) {
    const app = document.getElementById('app');
    const syncPlaying = () => {
      const active = play.classList.contains('active');
      if (app) app.classList.toggle('playing', active);
      if (active && !closed && !greeted) {
        greeted = true;
        setTimeout(() => say(LINES[(next++) % LINES.length]), GREET_DELAY_MS);
      }
    };
    new MutationObserver(syncPlaying).observe(play, { attributes: true, attributeFilter: ['class'] });
    syncPlaying();
  }

  // 小指针跟着大罗盘读数转：读屏幕上的度数文字，不读引擎内部
  if (needle && headingNum) {
    setInterval(() => {
      const v = parseInt(headingNum.textContent, 10);
      if (Number.isFinite(v)) needle.style.transform = `rotate(${-v}deg)`;
    }, NEEDLE_POLL_MS);
  }
})();
