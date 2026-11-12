# Codex 任务卡 5：大屏标识换成 Dr.life+

日期：2026-11-08
工作目录：`E:\GeneralCommander\ccgs-hive`

## 素材来源（智序工场，只读，不要修改源文件）

| 用途 | 源文件 | 尺寸 | MD5 |
|---|---|---|---|
| 完整标识（DR. LIFE+ 字样 + 图形） | `E:\VirtualAIOffice\paperclip-ops\office3d\assets\logo.png` | 979×544，透明底 | `5ae08ea5ea4b80fd0114ef4a01c4f514` |
| 图形标识（仅图形） | `E:\VirtualAIOffice\paperclip-ops\office3d\assets\logo-mark.png` | 313×390，透明底 | `0d6090a00339a8126cb4ee5dcd34039d` |

`office3d-git\office3d\assets\` 里有同名同 MD5 的副本，任选其一。复制后核对 MD5 一致。

## 要做的

1. 新建 `ccgs-hive\assets\`，复制为 `assets\drlife-logo.png`、`assets\drlife-logo-mark.png`。不缩放、不重新导出。
2. `bigscreen.html` 标题栏：把六边形 SVG（`.logo`）和 `CCGS` 文字（`.wordmark`）换成 `<img src="assets/drlife-logo.png" alt="Dr.life+">`，高约 56px，宽按 979:544 自动计算，垂直居中。右侧主标题"蜂巢分工集群 · 49 岗协作调度"保持不变；副标题里的 `CCGS49_2026-10-28_v1.0` 是数据集名称，保留。
3. 网页图标：`<link rel="icon" href="assets/drlife-logo-mark.png">`，替换现在的 `data:,`；`<title>` 改为 `Dr.life+ · 蜂巢分工集群`。
4. 网状视图中枢：`styles-pack.js` 已升级到 1.1.0（我已更新，**不要改它**），新增 `hubLogo` 参数。创建时传入：
   `CCGSStylePack.create(host, window.CCGS49, { legend:true, hubLogo:'assets/drlife-logo-mark.png' })`
   中枢圆里就会显示 Dr.life+ 图形，"GENERAL COMMANDER" 标签保留。
5. `views.html`（原型）和 `styles-pack-demo.html` 的标题栏同样换成 `assets/drlife-logo.png`，demo 页也传入 `hubLogo`。
6. `dispatch_server.py` 静态白名单加入 `/assets/drlife-logo.png`、`/assets/drlife-logo-mark.png`（只加这两个精确路径，不要放开整个 `assets/` 目录）。HEAD 同步。
7. 图片加载失败时：标题栏退回显示文字 `Dr.life+`（用 `onerror`），不出现破图标。
8. README 记一行素材来源路径和 MD5。

## 不要改

- 蜂巢、星系等画面里的"中央芯片 CCGS CORE"等画面内文字，本卡不动。
- 数据、岗位库、`Labs\CCGS`。

## 验收

1. `assets` 两个文件的 MD5 与上表一致。
2. 截图：蜂巢风格标题栏、网状风格（中枢显示 Dr.life+ 图形）各一张，1920×1080。
3. `GET /assets/drlife-logo.png`、`/assets/drlife-logo-mark.png` → 200；`GET /assets/` → 404。
4. 把图片临时改名后刷新：标题栏显示文字 `Dr.life+`，控制台只有一条图片 404，无脚本报错；测完改回。
5. `file://` 双击打开 `bigscreen.html` 标识正常显示。

## 交付说明（分三类写）

已完成 / 已验证（附截图路径、MD5 输出）/ 未验证或需确认。
