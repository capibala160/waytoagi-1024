# 设计稿 · 犟针

20 个手机屏幕，4 份 HTML。深色默认，右上角可切浅色与 390 / 430 宽度。

| 文件 | 屏幕 |
|---|---|
| `01-onboarding.html` | 首页、铸造、装配、角色卡、模式、目的地、出发说明 |
| `02-game.html` | 雾城、问路、日记抽屉、抵达、结果 |
| `03-journal-share.html` | 日记全屏、抵达证明、首页广场、挑战链接 |
| `04-real-settings.html` | 实战罗盘、设置与安全、定位失败、空状态 |

## 打开

```bash
open -a "Google Chrome" designs/01-onboarding.html
```

或起一个本地服务器：

```bash
python3 -m http.server 8000
```

然后访问 `http://localhost:8000/designs/01-onboarding.html`。

## 约定

- 手机里的按钮是**视觉元素**，不是可交互控件；本页真正可点的只有右上角的主题和宽度切换。
- 素材位用"印章 + 线稿 + CSS 纹理"占位，正式版替换为 AI 生图。
- 所有文案以 `docs/COPY.md` 为准。
- 设计 token 在 `assets/mockup.css` 顶部；改颜色、字号、间距只改那里。
- 下一轮团队可以继续细化，不需要把这一版当最终稿。
