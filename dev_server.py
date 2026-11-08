#!/usr/bin/env python3
"""Mock dev server for Google Apps Script web app.
Replaces <?!= include('X') ?> with file contents, mocks BOOT JSON.
"""
import http.server
import os
import re
import json
import sys
import urllib.parse
from pathlib import Path

PROJECT_DIR = Path(__file__).parent

# Files to include
CSS_FILE = 'Style.html'
JS_FILE = 'JavaScript.html'

# Regex to match include statements like <?!= include('File'); ?>
INCLUDE_RE = re.compile(r"<\?!=\s*include\(['\"]([^'\"]+)['\"]\);?\s*\?>", re.IGNORECASE)

# Regex to match boot expression
BOOT_RE = re.compile(r"<\?!=\s*boot\s*\?>", re.IGNORECASE)

# Regex to strip live-reload scripts
LIVE_RE = re.compile(r"<!--\s*impeccable-live-start.*?impeccable-live-end\s*-->", re.DOTALL | re.IGNORECASE)

def read_file(name):
    """Read .html/.js file from project dir (case-insensitive)."""
    for candidate in [name, name.lower(), name.title()]:
        p = PROJECT_DIR / candidate
        if p.exists():
            return p.read_text(encoding='utf-8')
    raise FileNotFoundError(f'{name} not found')

def strip_wrapper(text, tag):
    text = re.sub(r'^\s*<' + tag + r'\b[^>]*>\s*', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\s*</' + tag + r'>\s*$', '', text, flags=re.IGNORECASE)
    return text

def compile_template(path, query=''):
    """Process a template file, inlining CSS/JS and mocking BOOT."""
    content = path.read_text(encoding='utf-8')

    # Inject CSS
    try:
        css = read_file(CSS_FILE)
    except FileNotFoundError as e:
        print(f'[WARN] {e}', file=sys.stderr)
        css = ''
    css_html = f'<style>\n{strip_wrapper(css, "style")}</style>\n'
    content = INCLUDE_RE.sub(lambda m: css_html, content, count=1)

    # Inject dev mock + JS
    try:
        js = strip_wrapper(read_file(JS_FILE), 'script')
    except FileNotFoundError as e:
        print(f'[WARN] {e}', file=sys.stderr)
        js = ''
    try:
        mock = read_file('dev_mock.js')
    except FileNotFoundError:
        mock = ''
    js_html = '<script>\n' + mock + '\n' + js + '\n</script>\n'
    # Use function to avoid backslash interpretation in replacement
    content = INCLUDE_RE.sub(lambda m: js_html, content, count=1)

    # Mock BOOT
    start_event = ''
    qs = urllib.parse.parse_qs(query)
    if qs.get('event') and re.match(r'^[A-Za-z0-9-]{3,40}$', qs['event'][0]):
        start_event = qs['event'][0]
    musik = ''
    musik_nama = ''
    if qs.get('musik'):
        musik = '/tests/fixtures/lagu-uji.mp3'
        musik_nama = 'Lagu Uji'
    mock_boot = {
        "org": "Organisasi Demo",
        "url": "http://localhost:8500/Admin.html",
        "warna": "#1d4ed8",
        "aksen": "#f59e0b",
        "latar": "#020617",
        "kontak": "panitia@example.com",
        "maxQty": 10,
        "startEvent": start_event,
        "musik": musik,
        "musikLoop": bool(musik),
        "musikNama": musik_nama,
        "debug": True
    }
    content = BOOT_RE.sub(json.dumps(mock_boot), content)

    # Remove live reload
    content = LIVE_RE.sub('', content)

    return content

class DevHandler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        # Strip query/hash
        path = path.split('?')[0].split('#')[0]
        if not path:
            path = '/'
        return super().translate_path(path)

    def do_GET(self):
        path = self.translate_path(self.path)
        query = urllib.parse.urlparse(self.path).query
        try:
            # Check if it's an HTML template file
            basename = os.path.basename(path)
            if basename.lower() in ['index.html', 'admin.html']:
                # Find the actual file (case-insensitive)
                for f in [basename, basename.lower(), basename.title()]:
                    p = PROJECT_DIR / f
                    if p.exists():
                        content = compile_template(p, query)
                        self.send_response(200)
                        self.send_header('Content-type', 'text/html; charset=utf-8')
                        self.end_headers()
                        self.wfile.write(content.encode('utf-8'))
                        return

            # Serve other files as-is
            return super().do_GET()
        except Exception as e:
            print(f'[ERROR] {path}: {e}', file=sys.stderr)
            self.send_error(500, f"Internal Server Error: {e}")

def main():
    port = int(os.environ.get('PORT', 8500))
    server = http.server.HTTPServer(('0.0.0.0', port), DevHandler)
    print(f'Dev server running on http://localhost:{port}')
    print(f'Open http://localhost:{port}/Index.html')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nServer stopped.')

if __name__ == '__main__':
    main()
