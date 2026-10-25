# 技术方案

> **2026-10-24 晚注：** 实际实现已改为**零构建静态站**：`v2/` 是主入口，根路径重定向；旧根在 `/legacy.html`；罗盘用 `compass-kit/` 图层素材。本页的 Vite/目录结构是早期方案，当前以 `v2/README.md`、`CLAUDE.md`、`docs/STATUS.md` 为准。
>
> 目标：24 小时内做出一个手机浏览器能完整玩一局的网页游戏，同时把真实城市的罗盘模式留出接口。
> 原则：**没有后端也能玩，没有网络也能玩，没有 AI 接口也能玩。**

---

## 1. 技术选型

| 层 | 选择 | 理由 |
|---|---|---|
| 构建 | Vite | 启动快、打包小、零配置 |
| 框架 | 原生 JavaScript + CSS | 24 小时不需要 React 的复杂度；包更小 |
| 样式 | CSS 变量 + 原生 CSS | 深色/浅色切换、设计 token 一个文件 |
| 路由 | 自己写的状态机 | 只有 8-10 个屏，不需要路由库 |
| 存储 | localStorage + IndexedDB | 设置和文字放 localStorage，照片放 IndexedDB |
| 部署 | Vercel / Netlify / GitHub Pages | 一条命令上线，HTTPS 自带 |
| AI（可选） | Vercel Serverless Function | 代理 LLM，密钥不暴露给浏览器 |
| 测试 | Vitest（单元）+ 手动清单 | 只测关键算法：方位角、BFS、计分、分享链接 |
| 字体 | 系统字体栈 + 自托管中文衬线（可选） | 避免第三方字体拖慢首屏 |

**不选**：React、Next.js、任何 UI 组件库、任何地图 SDK、任何数据库。
理由：黑客松的敌人是集成成本，不是代码量。

---

## 2. 架构

```
浏览器
├── index.html
├── src/
│   ├── main.js            启动、状态机
│   ├── state.js           全局状态 + 订阅
│   ├── screens/           每个屏幕一个模块
│   │   ├── home.js
│   │   ├── forge.js
│   │   ├── companion.js
│   │   ├── destination.js
│   │   ├── briefing.js
│   │   ├── game.js        网格、迷雾、移动、罗盘
│   │   ├── result.js
│   │   ├── journal.js
│   │   └── share.js
│   ├── compass.js         方位角计算、平滑、校准
│   ├── geo.js             真实定位、真实罗盘、到达判断
│   ├── map.js             地图数据、BFS、NPC 指路生成
│   ├── score.js           计分、星级、标签
│   ├── storage.js         localStorage / IndexedDB 封装
│   ├── poster.js          Canvas 海报
│   ├── share-link.js      URL 编码/解码
│   └── constants.js       GAME / ANIM / STRINGS / COLORS
├── assets/                AI 生成的图片（WebP）
└── api/forge.js           可选：LLM 代理
```

### 2.1 数据流

```
用户操作 → state 更新 → 订阅者重绘对应屏幕
```

不做虚拟 DOM。每个屏幕自己管理自己的 DOM，切换时整块替换。

### 2.2 状态机

```
boot
  → home
  → forge
  → companion
  → destination
  → briefing
  → playing
      ↔ journal（抽屉，不离开 playing）
  → arrived
  → result
  → journal（全屏）
  → share
  → home / playing（再玩一局）
```

状态存在一个对象里：

```js
const state = {
  screen: "home",
  character: null,
  mode: "drill",          // drill | real
  destination: null,
  run: null,              // 当前一局
  journal: null,
  settings: { theme: "dark", sound: true, distance: false }
};
```

---

## 3. 屏幕与组件

| 屏幕 | 关键组件 | 状态 |
|---|---|---|
| 首页 | 品牌、开始按钮、冒险广场、我的冒险 | 空/有日记 |
| 铸造 | 输入框、示例芯片、铸造动画 | 输入/加载/结果 |
| 角色卡 | 立绘、名字、特质、口头禅 | 默认/换一个 |
| 目的地 | 3 张卡、换一批 | 默认 |
| 出发说明 | 三句话、开始按钮 | 默认 |
| 游戏 | 罗盘、迷雾网格、方向键、HUD、日记抽屉 | 游戏中/问路/抵达 |
| 结果 | 数据、星级、标签 | 默认 |
| 日记 | 时间线、照片位、成稿、编辑 | 空/编辑/已保存 |
| 分享 | 海报预览、下载、挑战链接 | 生成中/完成 |
| 设置 | 主题、声音、距离、隐私、清除数据 | 默认 |

---

## 4. 数据模型

### 4.1 角色

```js
{
  id: "north",
  name: "阿针·北",
  oneLine: "一枚只认一个方向的铜罗盘。",
  traits: ["嘴硬", "心软", "方向感极好"],
  catchphrase: "往那边。",
  portrait: "assets/azhen-north.webp",
  createdAt: "2026-10-25T09:00:00+08:00"
}
```

### 4.2 目的地

```js
{
  id: "wangping",
  name: "望平街",
  aliases: ["望平街", "河边", "香香巷"],   // 搜索用，用户会说的词
  flavor: "河边一条街，咖啡馆挨着茶馆",
  photo: "assets/dest/wangping.webp",       // 16:9，真实照片，记录拍摄日期
  reasons: [
    "去河边找一张能坐着看落日的长椅",
    "找一家门口有竹椅的茶馆，点一碗盖碗茶",
    "看咖啡馆和茶馆隔着一棵树做生意"
  ],
  bestTime: "傍晚",                          // 白天 | 傍晚 | 晚上
  access: "河边步道全天开放",                // 没数据写"入口情况未知"
  difficulty: "medium",                      // near | medium | far，不显示米数
  coords: { lat: 30.6575, lng: 104.0960 }    // 真实城市 & 模拟
}
```

**搜索匹配**：`name`、`aliases`、`flavor`、`reasons` 都参与；不搜地址，不搜任意 POI。

### 4.3 地图

见 `GAME-DESIGN.md` 第 5.2 节。

### 4.4 一局

```js
{
  id: "run_1729...",
  seed: 123456,
  mode: "journey",           // journey | game
  scene: "sim",              // sim | real
  destinationId: "wangping",
  start: { lat: 30.655, lng: 104.096 },
  steps: 38,
  shortestSteps: 16,
  asks: 3,                   // 不同问路人数
  events: 1,                 // 游戏模式计分用
  landmarks: 2,              // 游戏模式计分用
  bumpCount: 2,
  visited: [{ lat, lng }],
  score: {                   // 游戏模式才有
    speed: 420,
    encounter: 250,
    total: 670
  },
  startedAt: 1729...,
  endedAt: 1729...,
  status: "arrived"          // arrived | abandoned
}
```

### 4.5 日记

```js
{
  id: "journal_1729...",
  runId: "run_1729...",
  destination: "望平街",
  date: "2026-10-25",
  companion: "阿针·北",
  stats: { seconds: 2520, steps: 4200, asks: 3, photos: 4 },
  photos: [                 // 最多 9 张；第一张是封面
    { id: "photo_1", blobKey: "idb://photo_1", caption: "", takenAt: 1729... }
  ],
  entries: [
    { type: "start", time: 0, text: "从河边出发。" },
    { type: "ask", time: 320, text: "问了第 1 个人。" },
    { type: "photo", time: 600, src: "idb://photo_1", caption: "最迷茫的时候" },
    { type: "note", time: 900, text: "河风很大。" },
    { type: "arrive", time: 2520, text: "你站在望平街口。" }
  ],
  draft: "今天你从……",
  tone: "humor",
  updatedAt: 1729...
}
```

**生成规则**：`draft` 只能用 `stats`、`photos`、`entries` 里已有的事实；没有照片也没有 `note` 时，不生成 `draft`，只出旅程卡。

---

## 5. 罗盘

### 5.1 网格模式

北固定朝上，指针指向目的地：

```js
function gridBearing(player, target) {
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  return (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
}
```

### 5.1.1 旅程模拟（转身 + 前进）

> 网格只用于游戏模式。旅程模拟是连续经纬度，不是网格。

```js
const SIM_STEP_METERS = 18;
const ARRIVE_METERS = 30;

function simStep(pos, heading, dest) {
  const rad = heading * Math.PI / 180;
  const lat = pos.lat + Math.cos(rad) * SIM_STEP_METERS / 111320;
  const lng = pos.lng + Math.sin(rad) * SIM_STEP_METERS /
    (111320 * Math.cos(pos.lat * Math.PI / 180));
  return { lat, lng };
}
```

- `heading` = 手机朝向（0° = 北，顺时针）。
- 按一次"前进"走 18 米；方向就是手机朝向，不对准就会走偏。
- 没有方向传感器时，允许拖动表盘改 `heading`，但仍然只有"前进"一个移动按钮。
- 初始位置在目的地附近约 300 米；首次模拟 4-6 步可到。
- 罗盘盘面固定，只有指针转：`needle = normalize(bearing - heading)`，盘面 DOM 不旋转。

### 5.2 真实模式

**方位角**（从当前位置指向目的地的角度，正北为 0°，顺时针）：

```js
function bearing(from, to) {
  const φ1 = from.lat * Math.PI / 180;
  const φ2 = to.lat * Math.PI / 180;
  const Δλ = (to.lng - from.lng) * Math.PI / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2)
          - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
```

**手机朝向**（手机顶端指向的世界角度）：

```js
// iOS Safari
if (typeof event.webkitCompassHeading === "number") {
  heading = event.webkitCompassHeading;
}
// Android：deviceorientationabsolute 的 alpha
else if (event.absolute && typeof event.alpha === "number") {
  heading = (360 - event.alpha) % 360;
}
```

**指针角度**：

```js
needle = normalize(bearing - heading);
```

**平滑**：不要每帧直接赋值，用最短角差做低通：

```js
function smooth(current, target, k = 0.15) {
  let delta = ((target - current + 540) % 360) - 180;
  return (current + delta * k + 360) % 360;
}
```

**校准**：

- iOS 的 `webkitCompassAccuracy` 小于 0 或大于 25 时，提示"罗盘有点晕，拿着手机画个 8 字"。
- 连续 10 帧角度抖动 > 12°，同样提示。
- 没有方向权限时，用 `position.coords.heading`（移动时的 GPS 航向）兜底，并显示"按走路方向估算"。
- 真实出行提供「罗盘校准」入口：内嵌 `compass-kit/demo.html`，通过 URL 参数带入当前主题、朝向和目标；iframe 方向权限失败时，直接打开 `compass-kit/demo.html`。
- v2 的游戏罗盘使用 `v2/assets/compass/` 的高清图层，盘面静态，只转指针。

### 5.3 到达判断

```js
function distanceMeters(a, b) {
  const R = 6371000;
  const φ1 = a.lat * Math.PI / 180;
  const φ2 = b.lat * Math.PI / 180;
  const Δφ = φ2 - φ1;
  const Δλ = (b.lng - a.lng) * Math.PI / 180;
  const h = Math.sin(Δφ/2)**2
          + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
```

- 距离 ≤ 30 米：解锁"到了"按钮。
- GPS 精度 > 50 米：提示"信号有点飘，再等几秒"。
- 用户点"到了"后才算抵达，避免 GPS 漂移误判。

**定位可信（v2 已实现）**：

- 目的地坐标先做 GCJ-02 → WGS-84 转换；不要直接混算，否则约 360 米偏移。
- 只有精度 ≤ 50 米、采样 ≤ 15 秒、连续 3 次有效采样，才显示"接近目的地"。
- 过期或漂移的位置不再使用；页面隐藏时停止监听，回来重新定位。
- 进入范围后由用户点「我到了」；不自动结算。

---

## 6. 定位与权限

| 能力 | API | 注意 |
|---|---|---|
| 定位 | `navigator.geolocation.watchPosition` | 必须 HTTPS；`enableHighAccuracy: true`；1Hz 足够 |
| 方向 | `DeviceOrientationEvent` | iOS 需要在用户点击里调用 `requestPermission()` |
| 防锁屏 | `navigator.wakeLock.request("screen")` | 页面切后台会释放，回来要重新申请 |
| 分享 | `navigator.share` | 不支持就下载图片 |
| 拍照 | `<input type="file" accept="image/*" capture="environment">` | 不需要 getUserMedia，兼容性更好 |

### 6.1 iOS 方向权限

```js
async function requestCompass() {
  if (typeof DeviceOrientationEvent?.requestPermission === "function") {
    const res = await DeviceOrientationEvent.requestPermission();
    if (res !== "granted") throw new Error("motion-denied");
  }
  window.addEventListener("deviceorientationabsolute", onOrient, true);
  window.addEventListener("deviceorientation", onOrient, true);
}
```

必须在"开始"按钮的点击事件里调用，不能在页面加载时自动调用。

### 6.2 失败文案

| 情况 | 文案 | 动作 |
|---|---|---|
| 定位被拒 | "没有定位，罗盘转不起来。去浏览器设置里打开定位，再试一次。" | 重试按钮 |
| 方向被拒 | "手机不让我看方向。你可以看文字提示，或者打开系统指南针校准。" | 文字方向模式 |
| 信号弱 | "信号有点飘。走到开阔一点的地方。" | 继续等待 |
| 不支持 | "这个浏览器不支持罗盘。换 Safari 或 Chrome 试试。" | 复制链接 |

---

## 7. 存储

### 7.1 分工

| 数据 | 位置 | 理由 |
|---|---|---|
| 设置 | localStorage | 小、同步、简单 |
| 角色 | localStorage | 一个 JSON，几 KB |
| 日记文字 | localStorage | 几 KB 到几十 KB |
| 照片 | IndexedDB（Blob） | localStorage 只有约 5MB，照片会撑爆 |
| 星级/成绩 | localStorage | 小 |

### 7.2 照片压缩

```js
async function compress(file, maxEdge = 1280, quality = 0.7) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = new OffscreenCanvas(
    Math.round(bitmap.width * scale),
    Math.round(bitmap.height * scale)
  );
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.convertToBlob({ type: "image/jpeg", quality });
}
```

- 每篇日记最多 9 张照片（R9）。
- 单张目标 < 300KB。
- 存 IndexedDB 时用 `Blob`，不要转 base64。
- 第一张照片当封面，进旅程小结图和分享图；用户可换封面、可删除。

### 7.3 容量与降级

- 启动时 `navigator.storage.estimate()` 检查剩余空间。
- 剩余 < 20MB：提示"空间不多了，导出旧日记再继续"。
- IndexedDB 不可用：退化为 localStorage data URL，最多 3 张、800px、0.6 质量。
- 写入失败：明确报错，不静默丢数据。

### 7.4 导出

- 单篇日记导出为图片（海报）或 JSON。
- 全部数据导出为 JSON 文件（设置页）。
- "清除本地数据"二次确认，说明不可恢复。

---

## 8. 分享链接

### 8.1 目标

没有后端也能让朋友看到你的成绩，并挑战同一条路线。

### 8.2 编码

**旅程邀请链接（R7）**：

```js
const url = `${origin}/?from=share&mode=journey&d=wangping`;
```

- 二维码编码这条 URL；不带坐标、不带照片、不带日记正文。
- 朋友打开：显示同一目的地的详情卡 + "朋友走到了这里。你会怎么走？" + "我也走一遍"。
- 目的地在 URL 里只用 ID；落地页从策展数据里取名字、照片、理由。

**游戏挑战链接**：

```js
const payload = {
  d: "post-office",   // 目的地
  s: 123456,          // 种子
  t: 102,             // 用时（秒）
  st: 38,             // 步数
  a: 3,               // 问路
  n: "阿针·北"        // 旅伴
};
const url = `${origin}/#c=${base64url(JSON.stringify(payload))}`;
```

- 目标长度 < 1800 字符。
- 不包含坐标、照片、日记正文。
- 打开链接：还原目的地和种子，显示对方的得分卡（速度分 + 相遇分）+ "我也走一遍"。
- 种子决定地图、起点、NPC 位置，保证公平。

**二维码**：

- 180×180px，容错级别 M，四周留白 ≥ 16px。
- 本地生成或预生成；不依赖网络。
- 生成失败时保留可点链接，不白屏。

### 8.3 解码失败

- 提示"这个链接有点问题"，回到首页，不白屏。

---

## 9. 海报

### 9.1 规格

**旅程小结图（R7）**：

- 1080 × 1440（3:4，小红书 feed）。
- 同时可导出 1080 × 1920（9:16，微信状态/故事）。
- 背景：AI 生成的纸纹/铜版纹理 + CSS 渐变兜底。
- 元素：目的地照片（用户封面或策展图）、目的地、日期、用时、问路人数、照片数、路线折线、阿针的话、邀请语、二维码、品牌。
- 邀请语：**"我走到了这里，你会怎么走？"**
- 二维码：右下角 180×180px，编码 `?from=share&mode=journey&d=<id>`；四周留白 ≥ 16px。
- 路线折线：把 `visited` 的经纬度映射到画布，画一条 6px 的线，端点加圆点。
- 字体：系统中文衬线 + 无衬线；数字用等宽。

**游戏挑战卡**：

- 1080 × 1440 或 1080 × 1920。
- 元素：目的地、速度分、相遇分、总分、星级、挑战语、二维码、品牌。
- 二维码编码游戏挑战链接。

### 9.2 生成

```js
const canvas = document.createElement("canvas");
canvas.width = 1080; canvas.height = 1440;  // 或 1920
// ... draw ...
const blob = await new Promise(r => canvas.toBlob(r, "image/jpeg", 0.92));
```

- 分享：`navigator.canShare({ files: [file] })` → `navigator.share`。
- 不支持：触发下载，文件名 `问心-望平街-2026-10-25.jpg`。
- 生成时间目标 < 500ms。
- 二维码必须在图片生成时画进去；不要依赖外部截图。

---

## 10. 性能

| 指标 | 目标 |
|---|---|
| 首屏 | < 1s（本地）/ < 3s（4G） |
| JS（gzip） | < 200KB |
| 图片 | WebP，单张 < 150KB，懒加载 |
| 动画 | 只用 transform / opacity，60fps |
| 计时 | `performance.now()`，显示每 250ms 更新 |
| 内存 | 一局 < 50MB |

- 不用大图做背景；用 CSS 渐变 + 小纹理。
- 预加载下一屏需要的 2-3 张图。
- 低电量模式：关闭抖动、降低阴影、减少粒子。

---

## 11. 浏览器支持

| 浏览器 | 版本 | 支持 |
|---|---|---|
| iOS Safari | 16.4+ | 完整（含方向权限） |
| Android Chrome | 110+ | 完整 |
| 桌面 Chrome / Edge | 最近两个版本 | 完整（键盘可玩） |
| 微信内置浏览器 | 较新版本 | 基本可玩；方向权限可能受限，降级为文字方向 |
| 旧版 Safari | < 16.4 | 可玩网格模式；真实模式降级 |

---

## 12. 隐私与安全

1. **位置不上传。** 真实模式的坐标只在本机内存里，不写日志、不发请求。
2. **日记默认私有。** 只有用户点"分享"才生成海报/链接。
3. **分享链接不含坐标。** 只有目的地 ID、种子、成绩。
4. **不后台追踪。** 页面隐藏时停止定位；回来再开。
5. **用户输入安全。** 所有用户文字用 `textContent` 渲染，不用 `innerHTML`。
6. **CSP。** 加 `Content-Security-Policy` meta，禁止内联脚本（Vite 构建后）。
7. **密钥。** 前端永远不放 LLM key；需要时走 `/api/forge`。
8. **服务端代理。** 限制输入 30 字、超时 3 秒、每 IP 每分钟 10 次。
9. **删除权。** 设置页可一键清除本地数据。

---

## 13. 测试

### 13.1 单元

- `gridBearing`：8 个方向 + 边界。
- `bearing`：已知坐标对。
- `smooth`：跨 0°/360° 不跳变。
- `simStep`：朝向 0/90/180/270；走偏后距离变大；对准后距离变小。
- BFS：最短路长度、指路段压缩、错误注入。
- 计分：速度分边界（par、超时、0 分）、相遇分上限、三星条件。
- 搜索：名字、别名、理由关键词；无结果；回车。
- 分享链接：编码/解码往返、超长截断、二维码 payload 与落地页一致。
- 日记：有片段才生成；无片段只出旅程卡；照片最多 9 张。

### 13.2 手动

| 项 | 方法 |
|---|---|
| 完整一局 | 5 个陌生试玩者，记录时间与卡点 |
| 首次模拟 | 5 个新用户，至少 4 个在 75 秒内抵达 |
| 移动端 | iPhone Safari、Android Chrome |
| 尺寸 | 390×844、430×932，横屏不要求 |
| 罗盘 | 盘面固定，只有指针转；表盘 ≥ 330px；60fps |
| 明暗 | 两套都走一遍 |
| 文字缩放 | 浏览器 125%，不裁切 |
| 断网 | 关网，刷新，仍能玩网格模式 |
| 存储满 | 填满 localStorage，看提示 |
| 照片 | 加到 9 张，看上限提示；删除、换封面 |
| 二维码 | 用另一台手机扫旅程小结图，能打开同一目的地 |
| 模式 | 旅程结果页无分数；游戏结果页有两条分 |
| 权限拒绝 | 拒绝定位/方向，看降级 |

### 13.3 提交前 30 分钟清单

- [ ] 线上链接可打开（无痕窗口）
- [ ] 完整走一局
- [ ] 首次模拟 75 秒内能到
- [ ] 刷新后日记还在
- [ ] 分享图能下载
- [ ] 二维码能在另一台手机扫开
- [ ] 挑战链接能在另一台设备打开
- [ ] 旅程结果页没有分数
- [ ] 游戏结果页同时有速度分和相遇分
- [ ] 390 和 430 都不裁切
- [ ] 没有控制台报错
- [ ] 没有空按钮
- [ ] 主角卡已导出
- [ ] 视频已录

---

## 14. 未来：什么时候需要服务器

| 功能 | 需要服务器？ | 原因 |
|---|---|---|
| 旅程模式 | 否 | 纯前端 |
| 游戏模式 | 否 | 纯前端 |
| 本地日记 | 否 | IndexedDB |
| 分享链接 + 二维码 | 否 | 数据在 URL 里；二维码本地生成 |
| 真实城市走法 | 否（定位在端上） | 但目的地搜索需要 POI 接口 |
| 账号/云同步 | 是 | 跨设备 |
| 应用内广场 | 是 | 多人内容 |
| 排行榜 | 是 | 聚合 |
| 品牌目的地 | 是 | 配置、核销、审核 |
| 图片存储 | 是 | 对象存储 |

### 14.1 推荐后端（v1.0）

```
静态前端（Vercel）
  + Serverless API（Vercel Functions）
  + Postgres（Supabase / Neon）
  + 对象存储（Supabase Storage / S3）
  + 地图 POI（高德/腾讯，合规接口）
```

- 账号：手机号或微信登录。
- 日记：文字进 Postgres，照片进对象存储。
- 广场：分页查询 + 举报/审核。
- 排行榜：按目的地 + 周聚合。
- 成本：早期 < $25/月。

---

## 15. 术语表（给非技术读者）

| 词 | 一句话解释 |
|---|---|
| HTTPS | 浏览器和服务器之间的加密连接；定位和罗盘权限要求它 |
| Geolocation API | 浏览器提供的定位接口，能拿到经纬度 |
| DeviceOrientation API | 浏览器提供的手机朝向接口，能拿到手机顶端指向哪 |
| GPS 航向 | 手机移动时根据位置变化推算出的前进方向 |
| BFS | 广度优先搜索，一种在网格里算最短路的算法 |
| 旅程模式 | 自己选目的地、不记分、只记录经历的走法 |
| 游戏模式 | 接受挑战、有速度分和相遇分、有星级的走法 |
| 速度分 | 游戏模式里按用时算的分，最高 600 |
| 相遇分 | 游戏模式里按问路、事件、地标算的分，最高 400 |
| 旅程小结图 | 旅程结束后生成的分享图，带二维码，可发微信/小红书 |
| 静态罗盘 | 盘面不动、只有指针转的罗盘 |
| localStorage | 浏览器自带的小仓库，约 5MB，适合存文字设置 |
| IndexedDB | 浏览器自带的大仓库，适合存照片 |
| PWA | 把网页"安装"到手机桌面，像 App 一样打开 |
| Serverless Function | 跑在云端的一小段代码，用来藏 API 密钥 |
| Canvas | 浏览器里画图的一块画布，用来生成分享图 |
| Wake Lock | 让屏幕不自动熄灭的浏览器接口 |
| POI | Point of Interest，地图上的地点数据（餐厅、邮局等） |
| CDN | 内容分发网络，让静态文件从离用户近的服务器加载 |
