# Codex 任务卡 4b：风格返工，改用 styles-pack.js

日期：2026-11-08
工作目录：`E:\GeneralCommander\ccgs-hive`

## 为什么返工

卡 4 要求移植 `views.html` 的画面，交付的 `styles.js`（8KB）是重写的简化版（原型约 50KB）：
- 网状视图只有两列点，没有 49 岗位、规则卡、287 条协作线、交付物；
- 星系等风格只有圆圈和点，没有原型的星球、叶脉、电路走线、暗河、工位、神经元；
- 画在蜂巢原来的中间小框（`width:HW`）里，没有按卡 4 第 1 节做全宽布局；
- 截图都在回放开头拍，画面上没有蜂在飞；第 6 节第 3、4、7 条（切换不中断、派单联动、2 分钟不闪）没有交付证据。

## 这次不需要你写画面

我已把原型的 7 种风格**原样**抽成独立模块：
- `styles-pack.js`：画面代码与 `views.html` 一致，CSS 类名全部加了 `csp-` 前缀，不会和大屏已有的 `.tag`、`.card` 等冲突；
- `styles-pack-demo.html`：接线示例，用模拟蜂驱动 7 种风格，可以直接打开看接口怎么用。

文件头注释就是接口文档。你只做**接线**，**不要修改 `styles-pack.js` 里的画面代码**。发现模块有缺陷就写进交付说明，由我来改。

## 1. 替换

- `bigscreen.html` 不再加载 `styles.js`，改为加载 `styles-pack.js`（放在 d3 之后）。删除 `styles.js`。
- `dispatch_server.py` 静态白名单：去掉 `/styles.js`，加上 `/styles-pack.js`、`/styles-pack-demo.html`。
- 风格下拉保留 8 项：`hive`（蜂巢，现有画面）+ `CCGSStylePack.STYLES` 的 7 项。保留已做好的 `?style=`、localStorage、快捷键 1–8、30 秒轮换、抽屉打开时暂停轮换。

## 2. 布局（按卡 4 第 1 节）

- **蜂巢**：现有布局不变。
- **其他 7 种**：隐藏左右面板、中间蜂巢画布和底部时间线，在标题栏下方显示：
  - 统计条，高 52px：岗位 / 运行中 / 已完成运行 / 输入 / 协作关系 / 评测 已执行/总数 / 工作流，取值与现有 KPI 一致；
  - 风格宿主 `div`，逻辑尺寸 1920×852，随整页一起缩放，不要再单独缩放；
  - 底部日志条，用剩余高度（约 88px，4 行），内容复用现有"实时流水"。
- 建一次：`const pack=CCGSStylePack.create(hostDiv, window.CCGS49, {legend:true});`。整页缩放变化时调用 `pack.resize(scale*Math.min(devicePixelRatio||1,2))`。

## 3. 接线：每帧把蜂交给模块

先给蜂加一个统一的进度字段 `b.frac`（0 = 中心/蜂巢，1 = 资料源），两处都要设：

- 演示模式 `updateBee`：`out` 时 `b.frac=Math.min(1,b.t/b.dur)`；`back` 时 `b.frac=Math.max(0,1-b.t/b.dur)`；`collect` 时为 1；`drop`、`dock` 时为 0。
- 真实模式 `updateRealBee`：`local<.35` 时 `b.frac=local/.35`；`collect` 时为 1；`back` 时 `b.frac=1-(local-.65)/.35`；`realDone` 入仓阶段为 0。

主循环里，当前风格不是蜂巢时：
```js
const list=bees.filter(b=>b.state!=='dock'&&b.src).map(b=>({
  key:b.role.id, roleId:b.role.id, src:b.src.id, state:b.state, frac:b.frac??0 }));
pack.frame(playing?dt*speed:0, list, {
  mode: realState.mode,              // 'replay' | 'live' | 'demo'
  centerText: realState.mode==='demo' ? '演示归集 '+total : '已完成运行 '+realState.done+'（真实）',
  reduced, runs: RUN_DATA?.runs||[] });   // 字段名以大屏实际变量为准
```
- 回放从头开始（`resetReal`）、切到演示时（重置演示状态）调用 `pack.reset()`。
- 切换风格只调用 `pack.setStyle(id)`，**不要**重置回放、实时状态和蜂。
- 当前风格是蜂巢时，不调用 `pack.frame`（省性能）。

## 4. 边界

- 不改 `styles-pack.js` 的画面代码。不新增依赖。
- 第 0 步的安全修正保持不变（本机才能派单，静态白名单）。
- 你只能跑一次只读冒烟派单（CGS-25），用于验收第 3 条。

## 5. 验收

1. 切到**演示调度**，7 种风格各截一张 1920×1080 图，画面要和 `views.html` 同风格、同细节（例如网状视图能看到 49 岗位、两张规则卡、交付物列，蜂或粒子正在移动），每张图里都要有正在飞的智能体。另截 1280×800 两张（网状、星系）。
2. **回放**模式下，从蜂巢切到星系再切到网状：回放时刻、日志、已完成运行数不重置；附切换前后两张截图，标出回放时刻。
3. **实时 + 网状**：本机给 CGS-25 派一条只读任务，CGS-25 岗位亮起，结束后熄灭，次数变为 ×3；再派之前切到星系，能看到它的飞船。附 audit log 新增两行和 `git status` 前后对比。
4. 网状视图悬停 CGS-04：只高亮它的资料源、协作线、交付物，提示框显示真实运行时间。
5. 实时模式连续 2 分钟（网状或星系）：没有整屏闪烁，附连续截图或录屏。
6. 局域网地址打开：所有风格可看，派发按钮禁用；`/styles.js` 返回 404，`/styles-pack.js` 返回 200。
7. 控制台无报错（不含服务重启时的 `ERR_CONNECTION_RESET`）。

## 6. 交付说明（分三类写）

已完成 / 已验证（附命令输出、截图路径）/ 未验证或需确认。截图请注明拍摄时的模式和回放时刻。
