# -*- coding: utf-8 -*-
"""Local-only dispatcher for the CCGS screen. Standard library only."""
import contextlib
import importlib.util
import ipaddress
import json
import os
import shutil
import subprocess
import threading
import time
import uuid
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parent
CCGS = Path(r"E:\GeneralCommander\Labs\CCGS")
CLAUDE_ADD_DIRS = [Path(r"E:\cloudtemple-worktrees\ccgs-integration"), Path(r"E:\cloudtemple\CCGS")]
HOST = "0.0.0.0"
PORT = 3300
BUILD_OUT = ROOT / "ccgs49-data.js"
STATIC_FILES = {"/bigscreen.html", "/views.html", "/ccgs49-data.js", "/source.html", "/styles-pack.js", "/styles-pack-demo.html", "/vietnam-temple-town.html", "/ui-kit-directory.html", "/ui-kit.html", "/assets/drlife-logo.png", "/assets/drlife-logo-mark.png", "/assets/ui-kit-BV2TlDxx.js", "/assets/ui-kit-HokK2JGS.css"}
DESIGN_DOCS = {
    "01-master-plan": CCGS / "design" / "vietnam-temple-town" / "01-master-plan.md",
    "02-3d-visual-interaction": CCGS / "design" / "vietnam-temple-town" / "02-3d-visual-interaction.md",
    "03-culture-compliance-checklist": CCGS / "design" / "vietnam-temple-town" / "03-culture-compliance-checklist.md",
    "04-vietnamese-copy-drafts": CCGS / "design" / "vietnam-temple-town" / "04-vietnamese-copy-drafts.md",
    "05-acceptance-and-decisions": CCGS / "design" / "vietnam-temple-town" / "05-acceptance-and-decisions.md",
}
for _favicon in ("/favicon.ico", "/favicon.svg", "/favicon.png"):
    if (ROOT / _favicon.lstrip("/")).is_file():
        STATIC_FILES.add(_favicon)

spec = importlib.util.spec_from_file_location("ccgs_build_data", ROOT / "build_data.py")
build_data = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build_data)

state = {"run": None, "history": {}, "last_dispatch": None, "data_checked_at": 0, "lock": threading.Lock()}


def roles():
    path = Path(build_data.DEFAULT_LIB) / "data" / "roles.json"
    with path.open(encoding="utf-8-sig") as f:
        return {r["id"]: r for r in json.load(f)}


ROLE_BY_ID = roles()


def dispatch_prompt(role, text):
    return (f"必须使用 Task 工具调用 `{role['slug']}` 子代理完成以下任务，不要自己直接回答。\n\n{text}"
            if role else text)


def start_dispatch(role, text, source="web", telegram_user_id=None):
    with state["lock"]:
        if state["run"] is not None:
            raise RuntimeError("当前已有任务运行中，请稍后再试")
        now_ms = int(time.time() * 1000)
        run = {"id": uuid.uuid4().hex[:12], "events": [], "condition": threading.Condition(),
               "done": False, "cancelled": False, "process": None,
               "roleId": role.get("id") if role else None, "roleName": role.get("name_zh") if role else None,
               "roleSlug": role.get("slug") if role else None, "status": "running",
               "startedAt": now_ms, "endedAt": None, "source": source,
               "telegramUserId": telegram_user_id, "prompt": dispatch_prompt(role, text)}
        state["run"] = run
    threading.Thread(target=run_claude, args=(run, run["prompt"], role), daemon=True).start()
    return run


def cancel_dispatch(run_id):
    with state["lock"]:
        run = state["run"] if state["run"] and state["run"]["id"] == run_id else None
    if not run or not run["process"]:
        raise RuntimeError("运行不存在")
    run["cancelled"] = True
    if os.name == "nt":
        subprocess.run(["taskkill", "/PID", str(run["process"].pid), "/T", "/F"],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, shell=False)
    else:
        run["process"].terminate()
    return run


def today_summary_text():
    try:
        raw = (ROOT / "ccgs49-data.js").read_text(encoding="utf-8")
        data = json.loads(raw.split("= ", 1)[1].rstrip(";\n "))
        runs = data.get("runs", {})
        today = time.strftime("%Y-%m-%d")
        events = [e for e in runs.get("events", []) if e.get("t", "").startswith(today)]
        role_runs = [r for r in runs.get("runs", []) if r.get("roleId") and r.get("start", "").startswith(today)]
        sessions = len({e.get("session") for e in events})
        seconds = sum(max(0, (time.mktime(time.strptime(r["end"].replace("T", " "), "%Y-%m-%d %H:%M:%S")) - time.mktime(time.strptime(r["start"].replace("T", " "), "%Y-%m-%d %H:%M:%S")))) for r in role_runs if r.get("end"))
        first, last = (events[0].get("t", "—")[11:19], events[-1].get("t", "—")[11:19]) if events else ("—", "—")
        return f"今日运行摘要\n会话数：{sessions}\n岗位运行次数：{len(role_runs)}\n累计时长：{int(seconds)//60}分{int(seconds)%60:02d}秒\n首末事件：{first} – {last}"
    except Exception:
        return "今日运行摘要暂不可用。"


def start_telegram():
    from telegram_bot import TelegramBot, load_config
    token, allowed = load_config()
    if not token or not allowed:
        print("Telegram 未配置", flush=True)
        return
    bot = TelegramBot(token, allowed, ROLE_BY_ID,
                     lambda: state["run"], start_dispatch, cancel_dispatch, today_summary_text)
    threading.Thread(target=bot.loop, daemon=True, name="telegram-bot").start()


def claude_bin():
    return shutil.which("claude.exe") or shutil.which("claude") or shutil.which("claude.cmd")


def refresh_data():
    with contextlib.redirect_stdout(open(os.devnull, "w")):
        build_data.main(["--runs", str(CCGS)])


def snapshot_inputs():
    paths = [CCGS / "production" / "session-logs" / "agent-audit.log", CCGS / ".claude" / "agent-memory"]
    return tuple((str(p), p.stat().st_mtime_ns if p.exists() else 0) for p in paths)


def refresher():
    previous = None
    while True:
        try:
            state["data_checked_at"] = int(time.time() * 1000)
            current = snapshot_inputs()
            if current != previous:
                refresh_data()
                previous = current
        except Exception:
            pass
        time.sleep(2)


def claude_help():
    binary = claude_bin()
    if not binary:
        raise RuntimeError("未找到 claude CLI")
    return subprocess.run([binary, "--help"], cwd=str(CCGS), stdout=subprocess.PIPE,
                          stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace",
                          shell=False, check=False).stdout


def push(run, event):
    if event is None:
        return
    with run["condition"]:
        run["events"].append(event)
        run["condition"].notify_all()


def run_claude(run, prompt, role):
    try:
        binary = claude_bin()
        if not binary:
            raise RuntimeError("未找到 claude CLI")
        help_text = claude_help()
        required = ("--output-format", "--permission-mode", "--disallowedTools", "--verbose")
        if not all(flag in help_text for flag in required):
            raise RuntimeError("当前 claude CLI 不支持任务卡要求的输出或权限参数")
        args = [binary, "--add-dir", *[str(p) for p in CLAUDE_ADD_DIRS if p.exists()],
                "-p", "--output-format", "stream-json", "--verbose",
                "--permission-mode", "acceptEdits", "--disallowedTools", "Bash(git push:*)"]
        run["process"] = subprocess.Popen(args, cwd=str(CCGS), stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                           stdin=subprocess.PIPE, text=True, encoding="utf-8", errors="replace",
                                           bufsize=1, shell=False, creationflags=getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0))
        run["process"].stdin.write(prompt)
        run["process"].stdin.close()
        for line in run["process"].stdout:
            line = line.rstrip("\r\n")
            if not line:
                continue
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                event = {"type": "text", "text": line}
            push(run, event)
        code = run["process"].wait()
        if run["cancelled"]:
            run["status"] = "cancelled"
            push(run, {"type": "system", "text": "已取消"})
        elif code:
            run["status"] = "failed"
            push(run, {"type": "error", "text": f"claude 退出码 {code}"})
        else:
            run["status"] = "completed"
            push(run, {"type": "system", "text": "任务进程已完成"})
    except Exception as exc:
        push(run, {"type": "error", "text": str(exc)})
    finally:
        run["endedAt"] = int(time.time() * 1000)
        with run["condition"]:
            run["done"] = True
            run["condition"].notify_all()
        with state["lock"]:
            state["history"][run["id"]] = run
            state["last_dispatch"] = run
            if state["run"] is run:
                state["run"] = None


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):
        pass

    def local_request(self):
        try:
            address = ipaddress.ip_address(self.client_address[0].split("%", 1)[0])
            return address.is_loopback
        except ValueError:
            return False

    def safe_event(self, event):
        if self.local_request():
            return event
        if event.get("type") == "result":
            return {"type": "result"}
        if event.get("type") == "error":
            return {"type": "error", "text": "运行失败（详细输出仅本机可见）"}
        if event.get("type") == "system":
            return {"type": "system", "text": "运行状态更新（详细输出仅本机可见）"}
        return {"type": "system", "text": "运行输出仅本机可见"}

    def static_path(self):
        path = unquote(urlparse(self.path).path)
        if path == "/":
            path = "/bigscreen.html"
        if ".." in path.split("/") or path.startswith("/.") or path not in STATIC_FILES:
            return None
        return path

    def json_response(self, payload, status=200):
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        path = unquote(urlparse(self.path).path)
        if path.startswith("/api/design-docs/"):
            doc = DESIGN_DOCS.get(path.rsplit("/", 1)[-1])
            if not doc or not doc.is_file():
                self.json_response({"error": "文档不存在"}, 404)
                return
            raw = doc.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/markdown; charset=utf-8")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
            return
        if path == "/api/health":
            with state["lock"]:
                active = state["run"]
                dispatch = active or state["last_dispatch"]
                public_dispatch = None if not dispatch else {
                    "id": dispatch["id"], "roleId": dispatch.get("roleId"),
                    "roleName": dispatch.get("roleName"), "status": dispatch.get("status"),
                    "startedAt": dispatch.get("startedAt"), "endedAt": dispatch.get("endedAt"),
                    "source": dispatch.get("source", "web"),
                }
            self.json_response({"ok": True, "busy": active is not None,
                                "dataCheckedAt": state["data_checked_at"], "dispatch": public_dispatch})
            return
        if path.startswith("/api/runs/") and path.endswith("/stream"):
            run_id = path.split("/")[3]
            with state["lock"]:
                run = state["run"] if state["run"] and state["run"]["id"] == run_id else state["history"].get(run_id)
            if not run:
                self.json_response({"error": "运行不存在"}, 404)
                return
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream; charset=utf-8")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.end_headers()
            index = 0
            while True:
                with run["condition"]:
                    while index >= len(run["events"]) and not run["done"]:
                        run["condition"].wait(1)
                    batch = run["events"][index:]
                    index = len(run["events"])
                    done = run["done"] and not batch
                if done:
                    break
                for event in batch:
                    self.wfile.write(("data: " + json.dumps(self.safe_event(event), ensure_ascii=False) + "\n\n").encode("utf-8"))
                    self.wfile.flush()
                if run["done"] and index >= len(run["events"]):
                    break
            return
        path = self.static_path()
        if not path:
            self.send_error(404)
            return
        self.path = path
        super().do_GET()

    def do_HEAD(self):
        path = self.static_path()
        if not path:
            self.send_error(404)
            return
        self.path = path
        super().do_HEAD()

    def do_POST(self):
        path = unquote(urlparse(self.path).path)
        local_only = path == "/api/dispatch" or (path.startswith("/api/runs/") and path.endswith("/cancel"))
        if local_only and not self.local_request():
            self.json_response({"error": "只能在本机派发"}, 403)
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            body = json.loads(self.rfile.read(size) or b"{}")
        except (ValueError, json.JSONDecodeError):
            self.json_response({"error": "请求格式错误"}, 400)
            return
        if path == "/api/dispatch":
            role = ROLE_BY_ID.get(body.get("roleId")) if body.get("roleId") else None
            text = str(body.get("text", "")).strip()
            if not text:
                self.json_response({"error": "任务不能为空"}, 400)
                return
            try:
                run = start_dispatch(role, text)
            except RuntimeError as exc:
                self.json_response({"error": str(exc)}, 409)
                return
            self.json_response({"runId": run["id"], "prompt": run["prompt"]})
            return
        if path.startswith("/api/runs/") and path.endswith("/cancel"):
            run_id = path.split("/")[3]
            try:
                cancel_dispatch(run_id)
            except RuntimeError:
                self.json_response({"error": "运行不存在"}, 404)
                return
            self.json_response({"ok": True})
            return
        self.json_response({"error": "未找到接口"}, 404)


if __name__ == "__main__":
    refresh_data()
    threading.Thread(target=refresher, daemon=True).start()
    start_telegram()
    print("局域网查看：http://<本机局域网地址>:3300/bigscreen.html")
    print("本机派发：http://127.0.0.1:3300/bigscreen.html")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
