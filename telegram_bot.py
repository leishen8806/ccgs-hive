"""Standard-library Telegram long-polling bot for the local CCGS dispatcher."""
import json
import re
import threading
import time
from datetime import date
from urllib.parse import urlencode
from urllib.request import Request, urlopen


PATH_RE = re.compile(r"(?:[A-Za-z]:[\\/][^\s`<>\"']+|/(?:Users|home|mnt|tmp|var|opt)/[^\s`<>\"']+)")


def redact(value):
    text = str(value or "")
    return PATH_RE.sub("[本机路径已隐藏]", text).replace("telegram.local.json", "[配置文件已隐藏]")


class TelegramBot:
    def __init__(self, token, allowed_user_ids, roles, get_current, start_dispatch, cancel_dispatch, today_summary):
        self.token = token
        self.allowed = {int(x) for x in allowed_user_ids}
        self.roles = roles
        self.get_current = get_current
        self.start_dispatch = start_dispatch
        self.cancel_dispatch = cancel_dispatch
        self.today_summary = today_summary
        self.base = "https://api.telegram.org/bot" + token + "/"
        self.offset = 0
        self.pending = {}
        self.recent = {}
        self.stop_event = threading.Event()

    def api(self, method, payload=None, timeout=40):
        body = urlencode(payload or {}).encode("utf-8")
        request = Request(self.base + method, data=body, headers={"Content-Type": "application/x-www-form-urlencoded"})
        with urlopen(request, timeout=timeout) as response:
            data = json.loads(response.read().decode("utf-8"))
        if not data.get("ok"):
            raise RuntimeError("Telegram API 调用失败")
        return data.get("result")

    def send(self, chat_id, text, reply_markup=None):
        payload = {"chat_id": chat_id, "text": redact(text)}
        if reply_markup:
            payload["reply_markup"] = json.dumps(reply_markup, ensure_ascii=False)
        return self.api("sendMessage", payload, timeout=20)

    def edit(self, chat_id, message_id, text, reply_markup=None):
        payload = {"chat_id": chat_id, "message_id": message_id, "text": redact(text)}
        if reply_markup:
            payload["reply_markup"] = json.dumps(reply_markup, ensure_ascii=False)
        try:
            return self.api("editMessageText", payload, timeout=20)
        except Exception:
            return None

    def answer(self, callback_id, text=""):
        try:
            self.api("answerCallbackQuery", {"callback_query_id": callback_id, "text": text}, timeout=10)
        except Exception:
            pass

    def role(self, value):
        key = str(value or "").strip().lower()
        return next((r for r in self.roles.values() if r["id"].lower() == key or r["slug"].lower() == key), None)

    def help(self):
        return ("CCGS Telegram 派单\n"
                "/roles 查看 49 岗\n/send CGS-25 任务内容\n/status 当前运行\n/cancel 取消当前运行\n/today 今日摘要\n"
                "也可直接发送文字，再选择岗位。")

    def roles_text(self):
        groups = {}
        for r in self.roles.values():
            groups.setdefault(r.get("group", "其他"), []).append(f"{r['id']} {r['name_zh']}")
        text = "\n".join(f"【{g}】\n" + "\n".join(v) for g, v in groups.items())
        return [text[i:i + 3800] for i in range(0, len(text), 3800)]

    def status_text(self):
        run = self.get_current()
        if not run:
            return "当前空闲。"
        sec = max(0, int(time.time() * 1000 - run["startedAt"]) // 1000)
        return f"运行中：{run.get('roleId') or '未指定'} {run.get('roleName') or ''} · 已运行 {sec // 60}分{sec % 60:02d}秒"

    def confirm(self, chat_id, user_id, role, text):
        if self.get_current():
            run = self.get_current()
            self.send(chat_id, f"忙：{run.get('roleId') or '未指定'} 正在运行，可 /status 查看或 /cancel")
            return
        key = f"{chat_id}:{user_id}:{time.time_ns()}"
        self.pending[key] = {"user": user_id, "role": role, "text": text, "expires": time.time() + 600}
        label = f"{role['id']} {role['name_zh']}" if role else "不指定岗位"
        shown = text if len(text) <= 1200 else text[:1200] + f"\n\n（任务原文共 {len(text)} 字，已截断）"
        self.send(chat_id, f"请确认派单\n岗位：{label}\n权限：可改文件\ngit push：已禁止\n\n任务原文：\n{shown}",
                  {"inline_keyboard": [[{"text": "确认执行", "callback_data": "confirm:" + key},
                                        {"text": "取消", "callback_data": "cancel:" + key}]]})

    def common_buttons(self, user_id, text):
        recent = [self.roles[x] for x in self.recent.get(user_id, []) if x in self.roles][:6]
        rows = [[{"text": f"{r['id']} {r['name_zh']}", "callback_data": f"textrole:{r['id']}:{text}"}] for r in recent]
        rows.append([{"text": "选择岗位", "callback_data": f"groups:{text}"}, {"text": "不指定", "callback_data": f"textrole:none:{text}"}])
        return {"inline_keyboard": rows}

    def handle_message(self, message):
        user = message.get("from", {}).get("id")
        chat = message.get("chat", {})
        if user not in self.allowed or chat.get("type") != "private":
            print(f"忽略来自 {user} 的消息", flush=True)
            return
        chat_id, text = chat["id"], str(message.get("text", "")).strip()
        if not text:
            return
        if text in ("/start", "/help"):
            self.send(chat_id, self.help())
        elif text == "/roles":
            for part in self.roles_text(): self.send(chat_id, part)
        elif text == "/status":
            self.send(chat_id, self.status_text())
        elif text == "/today":
            self.send(chat_id, self.today_summary())
        elif text == "/cancel":
            run = self.get_current()
            if not run: self.send(chat_id, "当前空闲。"); return
            try: self.cancel_dispatch(run["id"]); self.send(chat_id, "已发送取消请求。")
            except Exception: self.send(chat_id, "取消失败：运行已结束或不存在。")
        elif text.startswith("/send"):
            parts = text.split(None, 2)
            if len(parts) < 3: self.send(chat_id, "格式：/send CGS-25 任务内容"); return
            role = self.role(parts[1])
            if not role: self.send(chat_id, "找不到岗位，请使用 /roles 查看。"); return
            self.recent.setdefault(user, [])[:0] = [role["id"]]
            self.confirm(chat_id, user, role, parts[2].strip())
        else:
            self.send(chat_id, "请选择岗位：", self.common_buttons(user, text))

    def handle_callback(self, callback):
        user = callback.get("from", {}).get("id")
        if user not in self.allowed:
            self.answer(callback.get("id"), "无权限"); return
        data = callback.get("data", "")
        message = callback.get("message", {})
        chat_id, message_id = message.get("chat", {}).get("id"), message.get("message_id")
        if data.startswith(("confirm:", "cancel:")):
            action, key = data.split(":", 1); item = self.pending.pop(key, None)
            if not item or item["user"] != user or item["expires"] < time.time(): self.answer(callback.get("id"), "确认已过期"); return
            self.answer(callback.get("id"))
            if action == "cancel": self.edit(chat_id, message_id, "已取消，未执行。"); return
            try:
                run = self.start_dispatch(item["role"], item["text"], "telegram", user)
            except Exception as exc:
                self.edit(chat_id, message_id, "派发失败：" + redact(exc)); return
            self.edit(chat_id, message_id, "运行中 · Telegram 派单")
            self.recent.setdefault(user, [])[:0] = [item["role"]["id"]] if item["role"] else []
            threading.Thread(target=self.monitor, args=(run, chat_id, message_id), daemon=True).start()
        elif data.startswith("textrole:"):
            _, role_id, text = data.split(":", 2); role = self.roles.get(role_id) if role_id != "none" else None
            self.answer(callback.get("id")); self.confirm(chat_id, user, role, text)
        elif data.startswith("groups:"):
            _, text = data.split(":", 1); groups = sorted({r.get("group", "其他") for r in self.roles.values()})
            buttons = [[{"text": g, "callback_data": f"group:{i}:{text}"}] for i, g in enumerate(groups)]
            self.answer(callback.get("id")); self.edit(chat_id, message_id, "选择岗位分组：", {"inline_keyboard": buttons})
        elif data.startswith("group:"):
            _, index, text = data.split(":", 2); groups = sorted({r.get("group", "其他") for r in self.roles.values()}); group = groups[int(index)]
            buttons = [[{"text": f"{r['id']} {r['name_zh']}", "callback_data": f"textrole:{r['id']}:{text}"}] for r in self.roles.values() if r.get("group") == group]
            self.answer(callback.get("id")); self.edit(chat_id, message_id, f"【{group}】选择岗位：", {"inline_keyboard": buttons[:49]})

    def monitor(self, run, chat_id, message_id):
        index, last_edit, latest = 0, 0, ""
        self.send(chat_id, f"▶ {run.get('roleId') or '未指定'} {run.get('roleName') or ''} 开始运行（Telegram）")
        while True:
            with run["condition"]:
                while index >= len(run["events"]) and not run["done"]: run["condition"].wait(1)
                batch, index = run["events"][index:], len(run["events"]); done = run["done"] and not batch
            for event in batch:
                text = event.get("text") or event.get("message", {}).get("content") or event.get("type", "")
                if isinstance(text, list): text = " ".join(str(x.get("text", "")) for x in text if isinstance(x, dict))
                if text: latest = redact(text)[-3000:]
            if latest and time.time() - last_edit >= 5:
                self.edit(chat_id, message_id, "运行中 · 最近输出：\n" + latest); last_edit = time.time()
            if done: break
        status = {"completed": "完成", "failed": "失败", "cancelled": "已取消"}.get(run.get("status"), run.get("status", "结束"))
        sec = max(0, int((run.get("endedAt") or int(time.time()*1000) - run["startedAt"]) / 1000))
        self.send(chat_id, f"✓ {run.get('roleId') or '未指定'} {run.get('roleName') or ''} 运行完成（Telegram）")
        self.edit(chat_id, message_id, f"{status} · 用时 {sec//60}分{sec%60:02d}秒\n\n{latest[-3000:] or '无文本回报'}\n\n完整内容见大屏")

    def loop(self):
        backoff = 1
        try:
            me = self.api("getMe", timeout=20)
            print(f"Telegram 已连接 @{me.get('username', 'bot')}", flush=True)
        except Exception:
            print("Telegram 连接失败，稍后重试", flush=True)
        while not self.stop_event.is_set():
            try:
                updates = self.api("getUpdates", {"offset": self.offset, "timeout": 30}, timeout=40)
                backoff = 1
                for update in updates or []:
                    self.offset = update["update_id"] + 1
                    if update.get("message"): self.handle_message(update["message"])
                    if update.get("callback_query"): self.handle_callback(update["callback_query"])
            except Exception:
                self.stop_event.wait(backoff); backoff = min(60, backoff * 2)


def load_config(path="telegram.local.json"):
    token = __import__("os").environ.get("CCGS_TG_TOKEN", "").strip()
    allowed = []
    try:
        with open(path, encoding="utf-8") as f: data = json.load(f)
        token = token or str(data.get("bot_token", "")).strip()
        allowed = data.get("allowed_user_ids", [])
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        pass
    return token, allowed
