# CCGS 蜂巢分工集群 · 交互原型

> 安全警告：`dispatch_server.py` 当前没有登录保护，仅适合本机/受控环境演示。不要把它暴露到局域网或公网；公开仓库不代表服务端已具备访问控制。

## 使用

解压后双击 `bigscreen.html`，使用 Chrome、Edge 或其他现代浏览器打开。
页面需要联网加载 D3 7.9.0；无需安装 Node.js、Python、框架或启动服务器。

## 文件

- `bigscreen.html`：完整、可直接打开的大屏页面。
- `ccgs49-data.js`：由岗位库和可选真实运行记录生成的数据文件。
- `source.html`：可继续编辑的原始 HTML 片段，包含 CSS、JavaScript 与 49 个岗位定义数据；用于后续集成或重新导出。
- `README.md`：使用说明。

Dr.life+ 标识素材来源：`E:\VirtualAIOffice\paperclip-ops\office3d\assets\logo.png` / `logo-mark.png`；MD5 分别为 `5ae08ea5ea4b80fd0114ef4a01c4f514` / `0d6090a00339a8126cb4ee5dcd34039d`。

## 已包含

49 个 CCGS 岗位目录、18 个演示资料源与中心归集仓、8 只演示机械蜂、采集与回巢动画、蜜滴数据包、归集记录、点击详情、播放/暂停、重新播放、阶段切换、速度调整、进度拖动、减少动态效果与窄屏布局。

## 运行边界

全部任务与数据包均为本地演示数据；没有连接真实 Agent、调用模型或启动任务。数据归集完成后仍为待核验，不代表验收通过。

## 版本说明

保存日期：2026-11-07。
岗位定义核验基准：Donchitos/Claude-Code-Game-Studios，提交 05ad7c8a5b8aa2aa86bbd3439ae7cf7295cac418。
该提交号仅用于说明此原型采用的岗位版本，不代表后续远端最新版本。

## 大屏版（bigscreen.html）

`bigscreen.html` 是 B 端大屏（1920×1080 设计稿，自动等比缩放），数据来自岗位库
`E:\GeneralCommander\AgentLibrary\CCGS49_2026-10-28_v1.0`：

- **机械蜂 = 49 个岗位**：按 9 个团队工作流派工（最多 3 组并行），每个岗位飞到自己“输入”所属的资料蜂室，采回该条输入，存入中心。
- **18 个资料蜂室**：196 条岗位输入按关键词归类（规则在 `build_data.py` 的 `SOURCES`）。
- **真实数字**：岗位、分组、工作流、协作关系、评测用例（已执行 / 总数）均读自岗位库。
- 点击左侧六边形岗位、蜂巢里的工蜂或资料蜂室、右侧工作流，可查看岗位目标、输入、交付物、边界、协作关系和上游原文链接；工作流可“优先派工”。
- 蜂群飞行与归集是调度演示，岗位并未实际运行；“已归集 ≠ 已验收”。

### 更新数据

岗位库更新后，在本文件夹运行一次再刷新页面：

    python build_data.py
    python build_data.py "其他岗位库路径"
    python build_data.py --runs "E:\GeneralCommander\Labs\CCGS"
    python build_data.py --runs "E:\GeneralCommander\Labs\CCGS" --watch 5

脚本只用 Python 标准库，会重新生成 `ccgs49-data.js`（页面直接以 `<script>` 加载，双击打开即可，无需启动服务器）。页面仍需联网加载 D3 7.9.0。

### 大屏运行模式

- **回放真实记录**：默认按 `agent-audit.log` 的开始/完成时间回放，显示运行次数、时长、岗位与产出文件。
- **实时监控**：页面每 5 秒重新加载 `ccgs49-data.js`，需要持续运行 `python build_data.py --runs "E:\GeneralCommander\Labs\CCGS" --watch 5`。
- **演示调度**：保留原有团队工作流和机械蜂模拟派工行为。

真实模式中的飞行路线只是按岗位输入归类的示意；日志只记录 agent 的开始/结束时间，不记录实际读取过的输入。`Labs\CCGS`、岗位库和真实日志均只读。实时测试必须将日志目录复制到临时副本后，用 `--runs` 指向副本，不能向真实日志写测试数据。

派发服务默认监听 `0.0.0.0:3300`。局域网只读地址示例为 `http://<本机局域网地址>:3300/bigscreen.html`，本机派发地址为 `http://127.0.0.1:3300/bigscreen.html`。只有本机可调用派发、取消和详细运行流；静态文件按白名单提供。启动前需确保该端口未被其他服务占用。

Telegram 派单：复制 `telegram.example.json` 为 `telegram.local.json`，填入 `bot_token` 和 `allowed_user_ids`；也可用 `CCGS_TG_TOKEN` 覆盖 token。该配置只由本机服务读取，不进入静态白名单、日志或 Telegram 回报。

