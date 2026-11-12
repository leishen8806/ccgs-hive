# Codex 任务卡：蜂巢大屏接入真实运行记录

日期：2026-11-07
工作目录：`E:\GeneralCommander\ccgs-hive`

## 一、目标

让 `bigscreen.html` 除了现有的"演示调度"，还能按**真实运行记录**显示 CCGS 岗位的运行情况。
数据来自 `E:\GeneralCommander\Labs\CCGS` 里 Claude Code 钩子写下的日志。真实模式下，标题区不再显示"调度为演示 · 岗位未实际运行"。

## 二、现状（先读这些文件再动手）

| 文件 | 作用 |
|---|---|
| `bigscreen.html` | 1920×1080 大屏，D3 蜂巢布局 + Canvas 粒子。机械蜂 = 49 个岗位，按 9 个团队工作流做**模拟**派工 |
| `build_data.py` | 读岗位库，生成 `ccgs49-data.js`（`window.CCGS49 = {...}`）。只用 Python 标准库 |
| `ccgs49-data.js` | 生成的数据：`meta / sources(18 个资料蜂室) / roles(49) / workflows(9)` |
| `README.md` | 使用说明 |
| `source.html` | 早期原型，不改 |

页面以 `<script src="ccgs49-data.js">` 加载数据（双击 file:// 打开，不能用 fetch 读本地 JSON）。

`bigscreen.html` 里的关键函数：`updateBee`（蜂的状态机 dock→out→collect→back→drop）、`deposit`、`scheduler / startRun / finishRun`（模拟派工）、`renderFlows`、`renderKpis`、`renderRoster`、`renderChart`、`openRole / openFlow / openCell`。

岗位库（只读）：`E:\GeneralCommander\AgentLibrary\CCGS49_2026-10-28_v1.0`。岗位 slug 与 CCGS agent 名一致（如 `game-designer` = `CGS-04`）。

## 三、真实数据源（只读）

### 1. 运行日志
`E:\GeneralCommander\Labs\CCGS\production\session-logs\agent-audit.log`

由 `.claude/hooks/log-agent.sh`（SubagentStart）和 `log-agent-stop.sh`（SubagentStop）写入，每行格式：

```
20261107_114223 | ae35f43c-6410-41e9-a540-91703da62270 | Agent invoked: game-designer
20261107_114442 | ae35f43c-6410-41e9-a540-91703da62270 | Agent completed: economy-designer
```

- 时间为写入机器的**本地时间**（`date +%Y%m%d_%H%M%S`，无时区）。
- 当前共 16 行，一个会话 `ae35f43c…`：game-designer ×2、economy-designer、narrative-director、qa-lead、analytics-engineer、fork ×2。
- `fork` 等不在 49 岗里的名字是 Claude Code 通用子代理，**不是 CCGS 岗位**：只记日志和计数，不分配机械蜂。
- 配对规则：按 (session, agent) 先进先出配对 invoked/completed。例：game-designer 11:42:23 invoked、11:45:03 completed、11:45:03 invoked、11:45:18 completed → 两次运行。没有 completed 的视为"运行中"。
- 同目录 `session-cost.md`（每会话 spawn 统计）可用于核对，不是必需。

### 2. 岗位产出
`E:\GeneralCommander\Labs\CCGS\.claude\agent-memory\<slug>\*.md`

目前有 economy-designer（`MEMORY.md`、`project_chuamay.md`）、narrative-director（`MEMORY.md`、`project-cloud-temple.md`）。
取文件名、修改时间、标题（第一行 `# ` 或 frontmatter 的 `name:`），**不要把正文写进数据文件**。

注意：`git status` 显示大量 M，基本是换行符差异，不要当作岗位产出。

### 3. 能说什么、不能说什么
日志只记录"哪个岗位何时开始、何时结束"，**不记录读了哪些输入**。所以：
- 开始/结束时间、时长、次数、产出文件 = 真实；
- 蜂在资料蜂室之间的飞行路线 = 按岗位"输入"归类的示意。页面必须写明这一点（左下说明 + 蜂室提示）。
- 真实模式下不得生成假的"已归集 N 包"。中心计数改为"已完成运行"次数。

## 四、要做的事

### A. `build_data.py`
1. 增加参数（argparse，保持原有位置参数兼容）：
   - `--runs <CCGS 项目路径>`，默认 `E:\GeneralCommander\Labs\CCGS`；目录或日志不存在时跳过，不报错。
   - `--watch [秒]`：循环运行，日志、agent-memory 或岗位库有变化时重新生成，默认每 5 秒检查一次。Ctrl+C 退出。
2. 在输出里增加 `runs` 字段，例如：
   ```json
   "runs": {
     "project": "E:\\GeneralCommander\\Labs\\CCGS",
     "logPath": "...agent-audit.log",
     "generatedAt": "2026-11-07T17:20:05",
     "events": [{"t":"2026-11-07T11:42:23","session":"ae35f43c-…","kind":"start","agent":"game-designer","roleId":"CGS-04"}],
     "runs":   [{"agent":"game-designer","roleId":"CGS-04","session":"…","start":"…","end":"…或null"}],
     "artifacts": {"economy-designer":[{"path":".claude/agent-memory/economy-designer/project_chuamay.md","mtime":"…","title":"…"}]}
   }
   ```
   无法匹配 49 岗的 agent，`roleId` 为 null。
3. 打印摘要：事件数、运行次数、运行中数量、涉及岗位、非岗位 agent。

### B. `bigscreen.html`
1. 标题区加模式选择（有 `runs` 数据时默认第 1 项；没有则只有演示）：
   - **回放真实记录**：按日志时间回放。有岗位运行时以 20× 推进；全部空闲时在约 1.5 秒内跳到下一个事件。播完停 4 秒后从头循环。速度下拉对它仍然生效。
   - **实时监控**：用当前时钟。每 5 秒重新加载 `ccgs49-data.js`（新建 script 标签，加 `?t=时间戳`），处理新事件。进入时把已有历史一次性计入（不放特效），未结束的运行立即出巢。
   - **演示调度**：保留现有模拟，行为不变。
2. 标题徽标按模式显示：
   - 回放：`真实运行记录 · 回放 2026-11-07 11:42–16:27`，并显示当前回放时刻；
   - 实时：`实时 · 最近事件 HH:MM:SS · 每 5 秒刷新`；数据超过 30 秒未更新时提示"数据未刷新，请运行 python build_data.py --watch"；
   - 演示：保留"调度为演示 · 岗位未实际运行"。
3. 真实模式下机械蜂的行为：
   - invoked → 对应岗位的蜂出巢，运行期间按该岗位 4 条输入轮流往返对应蜂室（示意）。
   - completed → 蜂完成当前往返后回巢，放一次入仓特效，中心"已完成运行"+1，储蜜蜂室液位上升。
   - 非岗位 agent（fork）只进流水和计数。
4. 面板按模式切换：
   - 左侧 KPI 后 4 格改为：运行中岗位 / 已完成运行 / 累计运行时长 / 涉及岗位数（岗位库的 4 格保持不变）。
   - 49 岗六边形：有运行记录的描琥珀边，运行中填亮蓝，其余变暗。
   - 右上"团队工作流"在真实模式下换成"本次记录 · 岗位"：岗位编号与名称、运行次数、累计时长、状态（运行中 / 已完成 n 次），最后一行是非岗位 agent。点击打开岗位详情。
   - 实时流水只写真实事件：`▶ CGS-04 游戏设计主管 开始运行`、`✓ … 运行完成 · 用时 2分40秒`，显示真实时刻；有产出文件的在完成行带出文件名。
   - 底部吞吐图在真实模式下换成**运行时间线**：每个出现过的岗位一行，用条形表示每次运行，带回放/当前时刻的播放头。空闲间隔压缩显示（单段最多按 10 分钟宽度画），断开处标出真实时长，如"≈2 小时 47 分"。
   - 蜂室底部数字在真实模式下显示"N 条输入"，不显示采集包数。
   - 岗位详情增加"真实运行记录"（每次的起止时间、时长、会话 ID 前 8 位）和"产出文件"（路径、修改时间、标题）。
5. 左下说明文字按模式切换，真实模式写明："运行起止时间来自 agent-audit.log；飞行路线按岗位输入归类示意。"

### C. `README.md`
在"大屏版"一节补充：三种模式、`--runs`、`--watch` 用法，以及实时监控需要 watch 一直开着。

## 五、边界

- `Labs\CCGS` 和 `AgentLibrary` **只读**，不修改、不提交、不删除。
- 不改 `source.html`。`index.html` 已不在文件夹里，本任务不要恢复或重建它。
- 不引入新依赖：页面只用现有的 D3 7.9.0 CDN；脚本只用标准库。
- 保持双击 file:// 打开可用，不要求起服务器。
- 不把日志里的会话内容或 agent-memory 正文写进数据文件或页面。

## 六、验收

1. `python build_data.py`：生成成功，摘要里有 16 个事件、8 次运行（其中 fork 2 次）、0 个运行中、5 个涉及岗位（含 fork 共 6 个 agent）；`ccgs49-data.js` 含 `runs`。
2. 用 Node 加载 `ccgs49-data.js` 做一致性检查：每个 `roleId` 都存在于 `roles`，每个 completed 都有对应 invoked，时间可被 `new Date()` 解析。
3. 浏览器打开（Chrome/Edge，1920×1080 和 1280×800 各一次），控制台无报错：
   - 默认进入"回放真实记录"，徽标正确；game-designer 两次运行、economy-designer、narrative-director、qa-lead、analytics-engineer 依次出巢、完成；fork 只在流水里；11:49→14:36 的空闲约 1.5 秒跳过；
   - 点 CGS-14 能看到运行记录和 `project_chuamay.md`；
   - 切到"演示调度"与现在一致；
   - 实时监控：运行 `--watch` 后，在**测试副本**日志里追加一行 invoked，5–10 秒内对应蜂出巢；再追加 completed，蜂回巢、计数 +1。**不要往真实日志写测试数据**：复制 `Labs\CCGS\production\session-logs` 到临时目录，用 `--runs` 指向副本测试。
4. 删掉或改名测试副本后重新生成正式数据。

## 七、交付说明（分三类写）

1. **已完成**：改了哪些文件、各自做了什么。
2. **已验证**：上面每条验收的实际结果和证据（命令输出、截图路径）。
3. **未验证 / 需要用户确认**：例如日志时间是否确为本地时间、是否还有其他会话日志位置等。
