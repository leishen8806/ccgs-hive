"""CCGS-independent demo page server. No project data or logs are read."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent

class DemoHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        super().end_headers()

    def do_GET(self):
        route = self.path.split("?", 1)[0]
        if route == "/ccgs49-data.js":
            self.path = "/demo-ccgs49-data.js"
            return super().do_GET()
        if route in ("/", "/demo.html"):
            self.path = "/bigscreen.html" if route == "/" else "/demo.html"
            return super().do_GET()
        if route == "/bigscreen.html":
            self.path = "/bigscreen.html"
            return super().do_GET()
        if route in ("/styles-pack.js", "/assets/drlife-logo-mark.png", "/assets/drlife-logo.png"):
            return super().do_GET()
        self.send_error(404)

    def do_HEAD(self):
        route = self.path.split("?", 1)[0]
        if route == "/ccgs49-data.js":
            self.path = "/demo-ccgs49-data.js"
            return super().do_HEAD()
        if route in ("/", "/demo.html"):
            self.path = "/bigscreen.html" if route == "/" else "/demo.html"
            return super().do_HEAD()
        if route == "/bigscreen.html":
            self.path = "/bigscreen.html"
            return super().do_HEAD()
        if route in ("/styles-pack.js", "/assets/drlife-logo-mark.png", "/assets/drlife-logo.png"):
            return super().do_HEAD()
        self.send_error(404)

if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 3300), lambda *a, **k: DemoHandler(*a, directory=str(ROOT), **k)).serve_forever()
