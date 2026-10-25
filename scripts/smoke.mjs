#!/usr/bin/env node
/* ============================================================
   冒烟测试 · 主流程走一遍
   起本地静态服务 → 无头 Chrome → 搜索/确认/模拟罗盘/刷新续玩
   用法：node scripts/smoke.mjs
   退出码 0 = 全过；1 = 有失败项（会打印哪一项）
   ============================================================ */

import { createServer } from 'node:http';
import { readFile, rm, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve, normalize, sep } from 'node:path';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';

const ROOT = resolve(import.meta.dirname, '..');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

const CHROME_CANDIDATES = [
  process.env.CHROME,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium'
].filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function startServer() {
  const server = createServer(async (req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const rel = url.endsWith('/') ? url + 'index.html' : url;
    const target = normalize(join(ROOT, rel));
    if (!target.startsWith(ROOT + sep)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    try {
      const body = await readFile(target);
      res.writeHead(200, { 'content-type': MIME[extname(target)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

function findChrome() {
  return CHROME_CANDIDATES.find((p) => existsSync(p));
}

async function launchChrome(bin, profile) {
  const proc = spawn(bin, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', '--remote-allow-origins=*',
    `--user-data-dir=${profile}`, 'about:blank'
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  const wsUrl = await new Promise((ok, fail) => {
    let buf = '';
    const timer = setTimeout(() => fail(new Error('Chrome 没在 15 秒内启动调试端口')), 15000);
    proc.stderr.on('data', (chunk) => {
      buf += chunk.toString();
      const m = buf.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (m) {
        clearTimeout(timer);
        ok(m[1]);
      }
    });
    proc.on('exit', (code) => {
      clearTimeout(timer);
      fail(new Error(`Chrome 退出，code=${code}`));
    });
  });

  const port = new URL(wsUrl).port;
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = list.find((t) => t.type === 'page');
  if (!page) throw new Error('没有可用的页面 target');
  return { proc, pageWs: page.webSocketDebuggerUrl };
}

function connect(url) {
  const ws = new WebSocket(url);
  const pending = new Map();
  const events = [];
  let seq = 0;

  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { ok, fail } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) fail(new Error(JSON.stringify(msg.error)));
      else ok(msg.result);
    } else if (msg.method) {
      events.push(msg);
    }
  });

  const ready = new Promise((ok, fail) => {
    ws.addEventListener('open', ok, { once: true });
    ws.addEventListener('error', fail, { once: true });
  });

  function send(method, params = {}) {
    const id = ++seq;
    return new Promise((ok, fail) => {
      pending.set(id, { ok, fail });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (res.exceptionDetails) {
      const d = res.exceptionDetails;
      throw new Error(d.exception?.description || d.text || '浏览器里抛异常');
    }
    return res.result?.value;
  }

  async function waitFor(expression, label, timeout = 5000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      try {
        if (await evaluate(expression)) return true;
      } catch {
        // 导航过程中执行上下文会被销毁，下一轮再试
      }
      await sleep(100);
    }
    throw new Error(`等待超时：${label}`);
  }

  return { ws, send, evaluate, waitFor, events, ready };
}

async function main() {
  const chrome = findChrome();
  if (!chrome) {
    console.error('找不到 Chrome/Edge，可用 CHROME=/path/to/chrome 指定');
    process.exit(1);
  }

  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}`;
  const profile = await mkdtemp(join(tmpdir(), 'wenxin-smoke-'));
  let browser;
  let page;
  const results = [];

  const check = (name, pass, detail = '') => {
    results.push({ name, pass, detail });
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  };

  try {
    const launched = await launchChrome(chrome, profile);
    browser = launched.proc;
    page = connect(launched.pageWs);
    await page.ready;
    await page.send('Runtime.enable');
    await page.send('Page.enable');

    const goto = async (path) => {
      await page.send('Page.navigate', { url: base + path });
      await page.waitFor(
        `location.pathname === '${path}' && document.readyState === 'complete'`,
        path + ' 加载完成',
        10000
      );
      await sleep(200);
    };

    // 1. 首页品牌与标题
    await goto('/v2/');
    const brand = await page.evaluate("document.querySelector('.brand-name').textContent.trim()");
    check('首页顶栏品牌是「问心」', brand === '问心', brand);
    const title = await page.evaluate('document.title');
    check('页面标题含「问心·指南针」', title.includes('问心·指南针'), title);

    // 2. 搜索目的地
    await page.evaluate(`(() => {
      const input = document.getElementById('dest-input');
      input.value = '太古';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await page.waitFor("document.querySelectorAll('#dest-suggest .result-item').length > 0", '搜索结果出现');
    const firstHit = await page.evaluate("document.querySelector('#dest-suggest .result-item').innerText.trim().split('\\n')[0]");
    check('输入「太古」能搜到结果', Boolean(firstHit), firstHit);

    // 3. 确认页
    await page.evaluate("document.querySelector('#dest-suggest .result-item').click()");
    await page.waitFor("document.getElementById('screen-confirm').classList.contains('active')", '进入确认页');
    const confirmName = await page.evaluate("document.getElementById('confirm-name').textContent.trim()");
    check('确认页显示目的地名', Boolean(confirmName), confirmName);

    // 4. 怎么走 → 雾城模拟 → 行进页
    await page.evaluate("document.getElementById('btn-confirm-go').click()");
    await page.waitFor("document.getElementById('screen-how').classList.contains('active')", '进入怎么走');
    await page.evaluate("document.getElementById('btn-how-sim').click()");
    await page.waitFor("document.getElementById('screen-play').classList.contains('active')", '进入行进页');
    await sleep(300);
    const needle = await page.evaluate("document.getElementById('compass-needle').style.transform");
    check('罗盘指针已开始转动', /rotate\(/.test(needle), needle);

    // 5. 走一步 → 存档
    await page.evaluate("document.querySelector('.dpad-btn').click()");
    await sleep(300);
    const saved = await page.evaluate("Boolean(localStorage.getItem('wenjin-save-v1'))");
    check('走一步后写入本地存档', saved);

    // 6. 刷新后续玩
    await goto('/v2/');
    await page.waitFor("!document.getElementById('btn-resume').hidden", '出现「继续上次」', 5000);
    check('刷新后出现「继续上次」', true);
    await page.evaluate("document.getElementById('btn-resume').click()");
    await page.waitFor("document.getElementById('screen-play').classList.contains('active')", '续玩回到行进页');
    check('点「继续上次」回到行进页', true);

    // 7. 旧根应用能打开
    await goto('/legacy.html');
    const legacyBrand = await page.evaluate("(document.querySelector('.home-brand') || {}).textContent || ''");
    check('旧根应用品牌是「问心」', legacyBrand.trim() === '问心', legacyBrand.trim());

    // 8. 全程没有 JS 异常 / console.error
    const errors = page.events.filter((e) => e.method === 'Runtime.exceptionThrown'
      || (e.method === 'Runtime.consoleAPICalled' && e.params?.type === 'error'));
    check('全程无 JS 异常', errors.length === 0, errors.length ? JSON.stringify(errors[0]).slice(0, 200) : '');
  } catch (err) {
    check('流程未中断', false, err.message);
  } finally {
    try { page?.ws.close(); } catch { /* 已关闭 */ }
    if (browser) browser.kill();
    server.close();
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} 通过`);
  process.exit(failed.length ? 1 : 0);
}

main();
