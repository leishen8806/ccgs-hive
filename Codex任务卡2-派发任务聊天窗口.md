# Codex 任务卡 2：大屏「派发任务」聊天窗口（第一版：先出效果）

日期：2026-11-07
工作目录：`E:\GeneralCommander\ccgs-hive`
前置：任务卡 1（接入真实运行记录）完成后再做。本卡要用到它的真实模式、`runs` 数据和数据自动刷新。

## 目标

在大屏上加一个聊天窗口：选岗位，输入任务，发送。
本地服务在 `E:\GeneralCommander\Labs\CCGS` 里用 `claude -p` 执行，输出实时显示在窗口里。CCGS 钩子写入 `agent-audit.log` 后，对应机械蜂出巢、回巢。

**第一版只求效果跑通，不做设置项。** 其余放到文末"后续再加"。

## 1. `dispatch_server.py`（新增，只用标准库）

- 监听 `127.0.0.1:8765`，同时提供 `bigscreen.html` 等静态文件（浏览器打开 `http://127.0.0.1:8765/`，同源，不处理跨域）。
- 后台复用 `build_data.py` 的生成逻辑（import 调用），日志变化时自动重新生成 `ccgs49-data.js`。
- `POST /api/dispatch {roleId, text}`：
  - 用 `shutil.which("claude")` 找 CLI；`subprocess` 以参数列表启动（`shell=False`），`cwd=E:\GeneralCommander\Labs\CCGS`，UTF-8。
  - 先运行 `claude --help`，按实际参数名实现。预期是：`-p <提示词> --output-format stream-json --verbose --permission-mode acceptEdits --disallowedTools "Bash(git push:*)"`。
  - 提示词：`请使用 <slug> 子代理（<CGS-xx> <名称>）处理以下任务：` + 用户原文。不选岗位时直接发原文。
  - 返回 `runId`。
- `GET /api/runs/{id}/stream`：SSE，逐行转发 stream-json 事件。
- `POST /api/runs/{id}/cancel`：结束进程（Windows 下连子进程一起结束）。
- 同时只跑一个任务；有任务在跑时，新的派发直接返回"忙"。

## 2. 聊天窗口（`bigscreen.html`）

- 标题区加"派发任务"按钮，打开右侧约 600px 宽的抽屉，覆盖在右侧面板上。
- 终端风格，参照用户现在的 Claude Code 终端：深色、等宽字体。
  - 用户消息：目标岗位 + 原文；
  - 助手文本：流式追加；
  - 工具调用：`● Update(路径)`，下一行 `└ Added x lines, removed y lines`；Bash 显示命令摘要；
  - 系统行：`▶ CGS-xx 岗位启动`、`✓ 岗位完成`（来自 audit log 的真实事件）、`已取消`、`出错`；
  - 结束行：`✻ 用时 2分31秒`（result 里有费用就一起显示）。
- 输入区：岗位下拉（49 岗按分组，加"不指定"）、多行输入（Enter 发送，Shift+Enter 换行）、发送 / 取消按钮。
- 岗位详情面板加"派发给此岗位"按钮，打开窗口并预选该岗位。
- 连上派发服务时，大屏自动切到"实时监控"模式，派发的岗位按真实日志出巢、回巢。
- 用 file:// 打开、或服务没启动时，窗口显示"未连接：请运行 python dispatch_server.py"，其他功能照常。

## 3. 边界

- 只用标准库和页面现有的 D3 CDN。
- 不改 `source.html`，不恢复 `index.html`，不改 CCGS 的 hooks、settings、agents。
- 你（Codex）开发时自己不在 `Labs\CCGS` 里跑会改文件的任务，只做下面的冒烟测试。

## 4. 验收

1. `python dispatch_server.py` 启动，浏览器打开 `http://127.0.0.1:8765/`，窗口显示已连接。
2. 冒烟测试：选 CGS-25 测试执行专员，输入"只列出你完成任务需要的输入清单，不读写任何文件，不运行命令"，发送后：
   - 窗口流式出字，有结束行；
   - `agent-audit.log` 新增 qa-tester 的 invoked / completed，大屏对应的蜂出巢、回巢；
   - 用 `git status` 前后对比，证明 `Labs\CCGS` 除 `production\session-logs\` 外没有变化。
3. 再发一条同样的任务，几秒后点取消，进程结束，窗口显示已取消。
4. file:// 打开：回放和演示照常，窗口显示未连接。
5. 截图：窗口打开、运行中、结束三种状态。

## 5. 交付说明（分三类写）

已完成 / 已验证（附命令输出、截图路径，冒烟测试写入 audit log 的行原样贴出）/ 未验证或需确认。

## 后续再加（本版不做）

权限模式选择、允许提交/推送开关、发送前确认框、访问令牌、排队、继续上次会话（--resume）、运行历史与记录文件、超时设置、按工作流派发。
