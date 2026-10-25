# 提交包 ·《问心·指南针》

> WaytoAGI 2026 全国 1024 切磋大会 · 游戏赛道
> **提交截止：2026-10-25 16:00**
> 标准：任何一个队友打开这页，10 分钟内能独立完成提交，不需要问别人。

---

## 1. 现在是什么状态

| # | 提交物 | 状态 | 文件 |
|---|---|---|---|
| 1 | 可玩链接 | ✅ 已上线 | `link.txt` + `qr.png`（现场扫码） |
| 2 | 主角卡 1080×1350 | ✅ 两版都在 | `protagonist-card-3panel.png`（赛道规格三格）/ `protagonist-card.png`（产品内一键生成的原样卡） |
| 3 | 演示视频 | 🟡 **40 秒无旁白兜底版已有** | `demo.mp4`（720×1280 / H.264 / 39.9 s / 516 KB，字幕已烧进画面） |
| 4 | 作品说明 ≤300 字 | ✅ 230 字 | `description.md` |
| 5 | 截图 3 张 + 桌面 1 张 | ✅ 390×844 深色；另附 1280 桌面版 | `screenshots/`（`04-desktop.png` 是加分项，可不传） |
| 6 | AI 管线说明 | ✅ | `ai-pipeline.md` |
| 7 | 团队信息 | ✅ 已填赛事表单（2026-10-25，不进仓库） | `team.md` 只留角色 |

没有物料的格子就是缺口，提交前按上表逐项打勾。

---

## 2. 怎么提交（10 分钟）

1. 打开赛事页面 →「我的福利」→ 游戏赛道 → 提交作品。
2. 可玩链接：复制 `link.txt` 第一行。
3. 上传文件：`demo.mp4`、`protagonist-card-3panel.png`、`screenshots/` 里三张。
4. 作品说明：复制 `description.md` 正文全文（不含标题）。
5. AI 管线：复制 `ai-pipeline.md` 正文。
6. 团队信息：**真实姓名 / 手机 / 邮箱填进表单**，不要写进这个公开仓库；邮箱必须和 OpenDev 注册邮箱完全一致。
7. 提交成功后截图，存成 `screenshots/00-submitted.png`，在 `docs/STATUS.md` 记一行。

---

## 3. 链接

| 用途 | 地址 |
|---|---|
| 可玩链接（根路径自动进 v2） | https://capibala160.github.io/waytoagi-1024/ |
| 旧版（仅回滚，别拿去验收） | https://capibala160.github.io/waytoagi-1024/legacy.html |
| 罗盘校准独立页 | https://capibala160.github.io/waytoagi-1024/compass-kit/demo.html |

链接是静态托管（GitHub Pages），改完 `main` 约 1 分钟生效。

---

## 4. 截图怎么复现

三张都是 390×844、深色主题、线上地址实拍：

| 文件 | 页面 |
|---|---|
| `screenshots/01-home.png` | 根路径 `/v2/` |
| `screenshots/02-compass.png` | `/v2/?preview=play&still=1`（真实出行界面） |
| `screenshots/03-arrival.png` | `/v2/?preview=end&still=1`（抵达结果） |

`preview=` 是页面自带的走查参数，只填演示数据，不改产品逻辑；`still=1` 关掉入口动画，截图不会拍到淡入第一帧。

---

## 5. 已知缺口（诚实清单）

| 缺口 | 影响 | 怎么办 |
|---|---|---|
| 演示视频只有 40 秒、没有旁白 | 赛道想要 3 分钟有人声 | 现在这版是「真实界面录屏 + 烧进字幕」，可先交；要人声就在剪映里照着 `subtitles.srt` 配一遍再导 mp4 |
| 华为/鸿蒙浏览器不给方向数据 | 评委用这类手机时指针不跟手 | 不隐藏：进真实出行前会弹自检，给「改用模拟 / 继续拖表盘 / 返回」；视频用 B 版旁白 |
| 真机 GPS / 磁罗盘没实走 | 现场可能提到 | 提交前用两台手机走一小段 |
| 六个目的地 `entrance` 仍是「入口待实测」 | 中心点可能走不到 | `scripts/check-data.mjs` 会报 1 条警告，属已知 |
| 团队真实姓名/联系方式 | 表单必填 | 填表单，不进仓库 |

---

## 6. 材料从哪来

- 三张截图 + 主角卡：从线上地址实拍/导出，不是设计稿。
- 主角卡「三格」版由 `screenshots/02-compass.png` 的同一份素材拼成，未引入任何外部图片。
- 作品说明、AI 管线说明的依据是 `docs/PRODUCT-TRUTH.md` 和 `compass-kit/TECH.md`，没有夸大没做的功能。
