# -*- coding: utf-8 -*-
"""
把 CCGS49 岗位库转换成蜂巢大屏可直接加载的 ccgs49-data.js。

用法（Windows，在 ccgs-hive 文件夹里）：
    python build_data.py
    python build_data.py "E:\\GeneralCommander\\AgentLibrary\\CCGS49_2026-10-28_v1.0"

只用 Python 标准库。岗位库更新后重新运行一次，再刷新 bigscreen.html 即可。
"""
import json
import os
import sys
import argparse
import time
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_LIB = r"E:\GeneralCommander\AgentLibrary\CCGS49_2026-10-28_v1.0"

# 18 个数据源蜂室：把每个岗位“输入”条目按关键词归类到其中一个蜂室。
# 顺序即并列时的优先级。
SOURCES = [
    ("req",     "需求规格",   "需求", ["需求", "规格", "故事", "验收", "GDD", "假设", "任务范围", "授权", "概念说明", "功能规格"]),
    ("pillar",  "支柱与体验", "支柱", ["支柱", "核心幻想", "体验", "目标玩家", "情绪", "主题", "玩家任务", "受众", "品牌"]),
    ("code",    "代码仓库",   "代码", ["代码", "源码", "脚本", ".gd", ".cs", "程序集", "蓝图", "C++", "Actor", "扩展源码", "组件和系统", "仓库"]),
    ("api",     "接口契约",   "接口", ["接口", "API", "调用方", "信号", "契约", "命令/事件", "跨语言"]),
    ("arch",    "架构决定",   "架构", ["ADR", "架构", "系统图", "编码规范", "技术偏好", "治理", "规范", "依赖"]),
    ("engine",  "引擎版本",   "引擎", ["引擎", "版本", "Godot", "Unity", "UE", "渲染器", "SDK", "工具链", "包版本", "插件", "Autoload", "CommonUI", "框架"]),
    ("perf",    "性能剖析",   "性能", ["性能", "剖析", "Profiler", "帧", "内存", "GPU", "CPU", "基线", "捕获", "Draw Call", "热点", "GC"]),
    ("build",   "构建日志",   "构建", ["构建", "日志", "CI", "导出", "编译", "制品", "签名", "密钥", "changeset", "Bundle"]),
    ("test",    "测试证据",   "测试", ["测试", "截图", "签认", "复现", "证据", "运行结果", "缺陷", "回归", "QA", "门槛", "人工"]),
    ("ux",      "UX与无障碍", "UX",   ["UX", "流程", "无障碍", "输入方法", "输入方式", "焦点", "分辨率", "屏幕", "键鼠", "手柄", "辅助技术", "文本缩放", "模态"]),
    ("art",     "美术素材",   "美术", ["美术", "素材", "视觉", "参考图", "材质", "VFX", "Widget", "样式", "UI稿", "资产", "粒子", "Shader", "着色"]),
    ("audio",   "音频素材",   "音频", ["音频", "声音", "音效", "音乐", "响度", "混音", "配音", "中间件"]),
    ("lore",    "叙事设定",   "叙事", ["叙事", "世界", "剧情", "对白", "角色", "正典", "正史", "设定", "术语", "阵营"]),
    ("level",   "关卡场景",   "关卡", ["关卡", "场景", "遭遇", "布局", "导航", "环境", "巡逻", "节点"]),
    ("econ",    "数值经济",   "数值", ["数值", "公式", "经济", "货币", "物品", "奖励", "难度", "成长", "实体", "参数", "Attribute", "保底", "价格"]),
    ("i18n",    "本地化文本", "本地化", ["本地化", "语言", "翻译", "字符串", "字幕", "字体", "字数"]),
    ("metrics", "数据埋点",   "埋点", ["指标", "事件字典", "数据", "遥测", "实验", "留存", "玩家行为", "隐私", "样本", "流失"]),
    ("release", "发布排期",   "发布", ["里程碑", "日期", "发布", "商店", "容量", "工期", "预算", "平台", "补丁", "渠道", "反馈", "赛季", "活动", "认证", "上线", "CDN", "产能"]),
]


# 得分相同时，越具体的类别越优先；需求、支柱、发布这类宽泛类别兜底。
PRIORITY = ["engine", "code", "api", "arch", "perf", "build", "test", "art", "audio", "lore",
            "level", "econ", "i18n", "metrics", "ux", "release", "pillar", "req"]


def classify(text):
    kw = {s[0]: s[3] for s in SOURCES}
    best, best_score = "req", 0
    for sid in PRIORITY:
        score = sum(1 for k in kw[sid] if k.lower() in text.lower())
        if score > best_score:
            best, best_score = sid, score
    return best


def load(lib, rel):
    with open(os.path.join(lib, rel), encoding="utf-8-sig") as f:
        return json.load(f)


def iso_local(ts):
    return ts.strftime("%Y-%m-%dT%H:%M:%S")


def read_title(path):
    try:
        with open(path, encoding="utf-8-sig") as f:
            lines = [f.readline().rstrip("\n\r") for _ in range(12)]
    except OSError:
        return ""
    for line in lines:
        if line.startswith("# "):
            return line[2:].strip()
        if line.startswith("name:"):
            return line.split(":", 1)[1].strip().strip("'\"")
    return ""


def collect_runs(project, role_by_slug):
    log_path = os.path.join(project, "production", "session-logs", "agent-audit.log")
    result = {"project": project, "logPath": log_path, "generatedAt": iso_local(datetime.now()),
              "events": [], "runs": [], "artifacts": {}}
    if not os.path.isdir(project) or not os.path.isfile(log_path):
        return result

    pending = {}
    with open(log_path, encoding="utf-8-sig") as f:
        for line in f:
            parts = [p.strip() for p in line.split("|", 2)]
            if len(parts) != 3:
                continue
            try:
                stamp = datetime.strptime(parts[0], "%Y%m%d_%H%M%S")
            except ValueError:
                continue
            session, message = parts[1], parts[2]
            marker = "Agent invoked: " if message.startswith("Agent invoked: ") else "Agent completed: " if message.startswith("Agent completed: ") else None
            if not marker:
                continue
            kind = "start" if marker.startswith("Agent invoked") else "end"
            agent = message[len(marker):].strip()
            role = role_by_slug.get(agent)
            event = {"t": iso_local(stamp), "session": session, "kind": kind, "agent": agent,
                     "roleId": role["id"] if role else None}
            result["events"].append(event)
            key = (session, agent)
            if kind == "start":
                pending.setdefault(key, []).append(event)
            elif pending.get(key):
                start = pending[key].pop(0)
                result["runs"].append({"agent": agent, "roleId": event["roleId"], "session": session,
                                       "start": start["t"], "end": event["t"]})
    for queue in pending.values():
        for start in queue:
            result["runs"].append({"agent": start["agent"], "roleId": start["roleId"], "session": start["session"],
                                   "start": start["t"], "end": None})
    result["events"].sort(key=lambda e: e["t"])
    result["runs"].sort(key=lambda r: r["start"])

    memory_root = os.path.join(project, ".claude", "agent-memory")
    for slug in role_by_slug:
        folder = os.path.join(memory_root, slug)
        if not os.path.isdir(folder):
            continue
        items = []
        for name in sorted(os.listdir(folder)):
            path = os.path.join(folder, name)
            if not os.path.isfile(path) or not name.lower().endswith(".md"):
                continue
            stat = os.stat(path)
            items.append({"path": os.path.relpath(path, project).replace(os.sep, "/"),
                          "mtime": iso_local(datetime.fromtimestamp(stat.st_mtime)), "title": read_title(path)})
        if items:
            result["artifacts"][slug] = items
    return result


def source_mtime(paths):
    newest = 0
    for root in paths:
        if not os.path.exists(root):
            continue
        if os.path.isfile(root):
            newest = max(newest, os.path.getmtime(root))
            continue
        for base, _, names in os.walk(root):
            for name in names:
                try:
                    newest = max(newest, os.path.getmtime(os.path.join(base, name)))
                except OSError:
                    pass
    return newest


def library_built_at(lib):
    paths = [os.path.join(lib, "data", name) for name in ("roles.json", "team_workflows.json", "source_snapshot.json")]
    stamp = max((os.path.getmtime(p) for p in paths if os.path.exists(p)), default=time.time())
    return datetime.fromtimestamp(stamp).strftime("%Y-%m-%d %H:%M")


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("lib", nargs="?", default=DEFAULT_LIB)
    parser.add_argument("out", nargs="?", default=os.path.join(HERE, "ccgs49-data.js"))
    parser.add_argument("--runs", default=r"E:\GeneralCommander\Labs\CCGS")
    parser.add_argument("--watch", nargs="?", const=5, type=float)
    args = parser.parse_args(argv)
    lib, out = args.lib, args.out
    if not os.path.isdir(lib):
        sys.exit("找不到岗位库文件夹：" + lib)

    roles_raw = load(lib, "data/roles.json")
    flows_raw = load(lib, "data/team_workflows.json")
    snapshot = load(lib, "data/source_snapshot.json")
    evals = []
    ep = os.path.join(lib, "evals", "evaluation_cases.jsonl")
    if os.path.exists(ep):
        with open(ep, encoding="utf-8-sig") as f:
            evals = [json.loads(l) for l in f if l.strip()]

    eval_by_role = {}
    for e in evals:
        d = eval_by_role.setdefault(e["role_id"], {"total": 0, "run": 0})
        d["total"] += 1
        if e.get("status") not in (None, "not_run"):
            d["run"] += 1

    roles = []
    for r in roles_raw:
        fm = r.get("upstream_frontmatter") or {}
        roles.append({
            "id": r["id"],
            "slug": r["slug"],
            "name": r["name_zh"],
            "group": r["group"],
            "tier": r.get("upstream_tier"),
            "model": fm.get("model"),
            "tools": fm.get("tools"),
            "goal": r.get("goal", ""),
            "responsibilities": r.get("responsibilities", []),
            "inputs": [{"text": t, "src": classify(t)} for t in r.get("inputs", [])],
            "deliverables": [d.get("name") for d in r.get("deliverables", [])],
            "boundaries": r.get("boundaries", []),
            "collaboration": [{"to": c["target_slug"], "dir": c["direction"], "purpose": c.get("purpose", "")}
                              for c in r.get("collaboration", [])],
            "sourceUrl": r.get("source_url"),
            "execution": r.get("execution_status", "not_run"),
            "evals": eval_by_role.get(r["id"], {"total": 0, "run": 0}),
        })

    flows = [{
        "id": w["id"], "slug": w["slug"], "name": w["name_zh"], "roles": w["roles"],
        "sequence": w.get("sequence_summary", ""), "outputs": w.get("outputs", ""),
        "conditions": w.get("conditions", ""), "status": w.get("status", ""),
    } for w in flows_raw]

    src_count = {s[0]: 0 for s in SOURCES}
    for r in roles:
        for i in r["inputs"]:
            src_count[i["src"]] += 1

    runs = collect_runs(args.runs, {r["slug"]: r for r in roles})
    data = {
        "meta": {
            "release": snapshot.get("collection", os.path.basename(lib)),
            "repository": snapshot.get("repository"),
            "sourceHead": snapshot.get("source_head"),
            "checkedAt": snapshot.get("checked_at"),
            "libraryPath": lib,
            "builtAt": library_built_at(lib),
            "generatedAt": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "counts": {
                "roles": len(roles),
                "groups": len({r["group"] for r in roles}),
                "workflows": len(flows),
                "collaboration": sum(len(r["collaboration"]) for r in roles),
                "inputs": sum(len(r["inputs"]) for r in roles),
                "evals": len(evals),
                "evalsRun": sum(1 for e in evals if e.get("status") not in (None, "not_run")),
            },
        },
        "sources": [{"id": s[0], "name": s[1], "short": s[2], "inputs": src_count[s[0]]} for s in SOURCES],
        "roles": roles,
        "workflows": flows,
        "runs": runs,
    }

    js = "/* 由 build_data.py 生成，勿手动修改。来源：" + lib.replace("*/", "") + " */\n"
    js += "window.CCGS49 = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n"
    with open(out, "w", encoding="utf-8") as f:
        f.write(js)
    c = data["meta"]["counts"]
    print("已生成 %s：%d 个岗位、%d 个工作流、%d 条输入、%d 个评测用例（已执行 %d）"
          % (out, c["roles"], c["workflows"], c["inputs"], c["evals"], c["evalsRun"]))
    for s in data["sources"]:
        print("  %-6s %-8s %d" % (s["id"], s["name"], s["inputs"]))
    rs = runs["runs"]
    role_agents = {r["agent"] for r in rs if r["roleId"]}
    other_agents = sorted({r["agent"] for r in rs if not r["roleId"]})
    print("真实记录：%d 个事件、%d 次运行、%d 个运行中、%d 个岗位、非岗位 agent：%s" %
          (len(runs["events"]), len(rs), sum(1 for r in rs if not r["end"]), len(role_agents),
           ", ".join(other_agents) if other_agents else "无"))
    return data


if __name__ == "__main__":
    if "--watch" not in sys.argv:
        main()
    else:
        # Watch only the declared inputs; the real log and memory are never written here.
        args = sys.argv[1:]
        delay_index = args.index("--watch") + 1
        delay = float(args[delay_index]) if delay_index < len(args) and not args[delay_index].startswith("-") else 5
        while True:
            data = main(args)
            project = data["runs"]["project"]
            watch_roots = [os.path.join(project, "production", "session-logs"),
                           os.path.join(project, ".claude", "agent-memory"), data["meta"]["libraryPath"]]
            before = source_mtime(watch_roots)
            try:
                while source_mtime(watch_roots) == before:
                    time.sleep(delay)
            except KeyboardInterrupt:
                print("已退出 watch。")
                break
