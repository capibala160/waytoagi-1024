#!/usr/bin/env node
/* ============================================================
   部署前数据体检 · 只读，不改任何文件
   检查 v2 的关卡与目的地：编号/方位/步数/验证码/坐标/入口/重复 ID
   用法：node scripts/check-data.mjs
   退出码 0 = 没有错误（警告不影响）；1 = 有错误，先修再发
   ============================================================ */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const FILES = ['v2/levels.js', 'v2/destinations.js', 'v2/destinations-city.js'];

const LEVEL_TYPES = new Set(['tutorial', 'observe', 'combine', 'optional', 'final']);
const DATUMS = new Set(['gcj02', 'wgs84']);

const errors = [];
const warnings = [];
const notes = [];

const err = (where, msg) => errors.push(`${where}：${msg}`);
const warn = (where, msg) => warnings.push(`${where}：${msg}`);
const isText = (v) => typeof v === 'string' && v.trim().length > 0;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

async function loadData() {
  const win = {};
  for (const rel of FILES) {
    const code = await readFile(resolve(ROOT, rel), 'utf8');
    try {
      new Function('window', code)(win);
    } catch (e) {
      err(rel, `加载失败：${e.message}`);
    }
  }
  return win;
}

function checkLevels(sets) {
  if (!sets || typeof sets !== 'object') {
    err('levels.js', '没有 window.LEVEL_SETS');
    return;
  }
  const allCodes = new Map();

  for (const [key, set] of Object.entries(sets)) {
    const where = `关卡组 ${key}`;
    if (!set || typeof set !== 'object') { err(where, '不是对象'); continue; }
    if (set.key !== key) warn(where, `set.key 是「${set.key}」，和键名不一致`);
    if (!isText(set.name)) err(where, '缺 name');
    if (!Array.isArray(set.levels) || !set.levels.length) { err(where, 'levels 为空'); continue; }
    if (!isNum(set.par) || set.par <= 0) warn(where, 'par 不是正数');
    if (typeof set.ready !== 'boolean') warn(where, 'ready 不是布尔值');

    const setIds = new Map();   // 关卡 id 只在组内唯一；outdoor/indoor 各从 1 开始是正常的

    set.levels.forEach((lv, i) => {
      const at = `${where} 第 ${i + 1} 站`;
      if (!lv || typeof lv !== 'object') { err(at, '不是对象'); return; }

      if (!Number.isInteger(lv.id) || lv.id < 1) err(at, `id 不是正整数（${lv.id}）`);
      else if (setIds.has(lv.id)) err(at, `id ${lv.id} 与同组「第 ${setIds.get(lv.id)} 站」重复`);
      else setIds.set(lv.id, i + 1);

      if (!isText(lv.name)) err(at, '缺 name');
      for (const field of ['place', 'npc', 'clue', 'arriveClue']) {
        if (!isText(lv[field])) err(at, `缺 ${field}`);
      }

      if (!/^\d{4}$/.test(String(lv.code ?? ''))) err(at, `code 不是四位数字（${lv.code}）`);
      else if (allCodes.has(lv.code)) warn(at, `code ${lv.code} 与「${allCodes.get(lv.code)}」相同`);
      else allCodes.set(lv.code, at);

      if (!isNum(lv.bearing) || lv.bearing < 0 || lv.bearing > 360) {
        err(at, `bearing 不在 0–360（${lv.bearing}）`);
      }
      if (!Number.isInteger(lv.steps) || lv.steps < 1 || lv.steps > 999) {
        err(at, `steps 不是 1–999 的整数（${lv.steps}）`);
      }
      if (lv.type && !LEVEL_TYPES.has(lv.type)) warn(at, `未知 type「${lv.type}」`);
      if (lv.stamp != null && [...String(lv.stamp)].length !== 1) warn(at, `stamp 不是单字（${lv.stamp}）`);
      if (lv.piece && !isText(lv.piece.mark)) warn(at, 'piece.mark 为空');

      if (lv.observe) {
        if (!isText(lv.observe.question)) err(at, 'observe.question 为空');
        const opts = lv.observe.options;
        if (!Array.isArray(opts) || opts.length < 2) err(at, 'observe.options 少于 2 个');
        else opts.forEach((o, oi) => {
          if (!o || !isText(o.text)) err(at, `observe.options[${oi}].text 为空`);
        });
      }

      if (lv.sets && typeof lv.sets === 'object') {
        for (const [variant, v] of Object.entries(lv.sets)) {
          if (!v || !/^\d{4}$/.test(String(v.code ?? ''))) err(at, `变体 ${variant} 的 code 不是四位数字`);
          if (!v || !isText(v.clue)) err(at, `变体 ${variant} 缺 clue`);
          if (!v || !isText(v.arriveClue)) err(at, `变体 ${variant} 缺 arriveClue`);
        }
      }
      if (Array.isArray(lv.hints) && lv.hints.some((h) => !isText(h))) {
        warn(at, '有空的提示文案');
      }
    });

    notes.push(`${set.name || key} · ${set.levels.length} 站 · ${set.ready ? '已布置' : '演示路线'}`);
  }
}

function checkDestinations(destinations, city, cityDestinations) {
  const venue = Array.isArray(destinations) ? destinations : [];
  const cityList = Array.isArray(cityDestinations) ? cityDestinations : [];
  if (!venue.length) { err('destinations.js', '没有 window.DESTINATIONS'); return; }

  const pendingEntrance = [];
  const seen = {};

  const checkList = (list, label) => {
    const ids = new Map();
    const names = new Map();
    const coords = new Map();

    list.forEach((d, i) => {
      const at = `${label} ${d && d.id ? d.id : `#${i + 1}`}`;
      if (!d || typeof d !== 'object') { err(at, '不是对象'); return; }

      if (!isText(d.id)) err(at, '缺 id');
      else if (ids.has(d.id)) err(at, `id 与「${ids.get(d.id)}」重复`);
      else ids.set(d.id, at);

      if (!isText(d.name)) err(at, '缺 name');
      else if (names.has(d.name)) warn(at, `和「${names.get(d.name)}」重名`);
      else names.set(d.name, at);

      if (!isText(d.blurb)) warn(at, '缺 blurb（列表里会空一行）');
      if (!isNum(d.lat) || d.lat < -90 || d.lat > 90) err(at, `lat 不合法（${d.lat}）`);
      if (!isNum(d.lon) || d.lon < -180 || d.lon > 180) err(at, `lon 不合法（${d.lon}）`);
      if (!DATUMS.has(d.datum)) err(at, `datum 必须是 gcj02 或 wgs84（${d.datum}）`);

      const key = `${Number(d.lat).toFixed(5)},${Number(d.lon).toFixed(5)}`;
      if (coords.has(key)) warn(at, `坐标和「${coords.get(key)}」完全相同`);
      else coords.set(key, at);

      if (!isText(d.entrance)) warn(at, '缺 entrance');
      else if (/待实测/.test(d.entrance)) pendingEntrance.push(at);

      if (isText(d.id)) {
        seen[d.id] = seen[d.id] || [];
        seen[d.id].push({ label, d });
      }
    });
  };

  checkList(venue, '目的地（会场）');
  checkList(cityList, '目的地（城市）');

  // 两个内容包共用一个地点是允许的；只有内容不一致才需要提醒
  Object.entries(seen).forEach(([id, list]) => {
    if (list.length < 2) return;
    const [a, b] = list;
    if (JSON.stringify(a.d) !== JSON.stringify(b.d)) {
      warn(`目的地 ${id}`, `在「${a.label}」与「${b.label}」里内容不一致，改名/坐标时容易漏改一处`);
    }
  });

  if (pendingEntrance.length) {
    warn('目的地', `${pendingEntrance.length} 个仍是「入口待实测」（${pendingEntrance.slice(0, 3).join('、')}${pendingEntrance.length > 3 ? ' 等' : ''}）`);
  }
  notes.push(`目的地 · 会场 ${venue.length} 个 · 城市 ${cityList.length} 个`);
}

async function main() {
  const data = await loadData();
  checkLevels(data.LEVEL_SETS);
  checkDestinations(data.DESTINATIONS, null, data.CITY_DESTINATIONS);

  console.log('数据体检 · v2\n');
  notes.forEach((n) => console.log('· ' + n));
  if (warnings.length) {
    console.log('');
    warnings.forEach((w) => console.log('警告  ' + w));
  }
  if (errors.length) {
    console.log('');
    errors.forEach((e) => console.log('错误  ' + e));
  }
  console.log(`\n${errors.length ? '不通过' : '通过'} · 错误 ${errors.length} · 警告 ${warnings.length}`);
  process.exit(errors.length ? 1 : 0);
}

main().catch((e) => {
  console.error('体检脚本自己出错了：', e);
  process.exit(1);
});
