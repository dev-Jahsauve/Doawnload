#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SmartDownload — service d'extraction yt-dlp, compatible avec l'API Cobalt.

Endpoint unique (POST /) qui imite le contrat Cobalt utilise par
lib/server/extractor.ts :
    { "url": "...", "downloadMode": "auto"|"audio",
      "videoQuality": "1080"|"720"|"360", "audioFormat": "mp3" }
reponse : { "status": "tunnel", "url": "<tunnel signe>", "filename": "..." }

Endpoints supplementaires :
    POST /info    -> { "title", "duration", "thumbnail" } (metadonnees yt-dlp)
    GET  /tunnel  -> stream du fichier telecharge (signature HMAC + expiration)
    GET  /        -> sante (JSON), utile pour UptimeRobot

Cookies Facebook/YouTube : si l'environnement COOKIES_PATH pointe vers un
fichier cookies.txt (export Netscape) existant, il est passe a yt-dlp.

Python stdlib uniquement (hors yt-dlp) : aucune dependance de framework.
"""
import base64
import hashlib
import hmac
import json
import os
import re
import shutil
import subprocess
import tempfile
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, quote

PORT = int(os.environ.get("PORT", "9000"))
COOKIES_PATH = os.environ.get("COOKIES_PATH", "")
TUNNEL_SECRET = os.environ.get("TUNNEL_SECRET", "smartdownload-change-me")
TUNNEL_TTL = int(os.environ.get("TUNNEL_TTL", "1800"))  # 30 min
YT_DLP = os.environ.get("YT_DLP_BIN", "yt-dlp")

# Meme whitelist que lib/server/validators.ts — jamais de requete ailleurs.
ALLOWED_HOSTS = {
    "youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be",
    "facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com",
    "fb.watch", "fb.me",
    "tiktok.com", "www.tiktok.com", "m.tiktok.com", "vm.tiktok.com", "vt.tiktok.com",
}


class ApiError(Exception):
    def __init__(self, code, status=400):
        super().__init__(code)
        self.code = code
        self.status = status


def has_ffmpeg():
    return shutil.which("ffmpeg") is not None


def ytdlp_common_args():
    args = [YT_DLP, "--no-playlist", "--no-warnings", "--no-progress", "--no-check-certificates"]
    if COOKIES_PATH and os.path.exists(COOKIES_PATH):
        args += ["--cookies", COOKIES_PATH]
    return args


def validate_url(raw):
    try:
        u = urlparse(raw.strip())
    except Exception:
        raise ApiError("error.api.link.invalid")
    if u.scheme not in ("http", "https") or not u.hostname:
        raise ApiError("error.api.link.invalid")
    if u.hostname.lower() not in ALLOWED_HOSTS:
        raise ApiError("error.api.service.unsupported")
    return raw.strip()


def ytdlp_json(url):
    """Metadonnees completes (-J)."""
    cmd = ytdlp_common_args() + ["-J", url]
    try:
        r = subprocess.run(cmd, capture_output=True, timeout=90)
    except subprocess.TimeoutExpired:
        raise ApiError("error.api.fetch.timeout", 504)
    if r.returncode != 0:
        tail = r.stderr.decode("utf-8", "replace")[-400:]
        print("[ytdlp-json] echec:", tail, flush=True)
        if "log-in" in tail or "cookies" in tail.lower() or "login" in tail.lower():
            raise ApiError("error.api.fetch.auth_required")
        raise ApiError("error.api.fetch.fail")
    try:
        return json.loads(r.stdout.decode("utf-8", "replace"))
    except Exception:
        raise ApiError("error.api.fetch.empty")


def pick_format(meta, mode, quality):
    """Choisit le format yt-dlp selon le mode et la qualite demandee."""
    if mode == "audio":
        return "bestaudio[abr<=160]/bestaudio/best"
    h = {"1080": 1080, "720": 720, "360": 360}.get(str(quality), 720)
    return (
        f"best[ext=mp4][height<={h}][vcodec!=none][acodec!=none]"
        f"/best[height<={h}][vcodec!=none][acodec!=none]"
        f"/best[ext=mp4][height<={h}]/best[height<={h}]/best"
    )


def safe_filename(title, ext):
    name = re.sub(r"[^A-Za-z0-9._ -]+", "", (title or "video"))[:80].strip() or "video"
    return f"{name}.{ext}"


def sign(payload_b64):
    return hmac.new(TUNNEL_SECRET.encode(), payload_b64.encode(), hashlib.sha256).hexdigest()


def make_tunnel_url(base, url, fmt, mode, filename):
    payload = json.dumps({
        "u": url, "f": fmt, "m": mode, "n": filename, "e": int(time.time()) + TUNNEL_TTL,
    }, separators=(",", ":")).encode()
    p = base64.urlsafe_b64encode(payload).decode().rstrip("=")
    return f"{base}/tunnel?p={quote(p)}&s={sign(p)}"


def read_tunnel_payload(p, s):
    try:
        payload = json.loads(base64.urlsafe_b64decode(p + "=" * (-len(p) % 4)))
    except Exception:
        raise ApiError("error.api.tunnel.invalid", 403)
    if not hmac.compare_digest(sign(p), s or ""):
        raise ApiError("error.api.tunnel.invalid", 403)
    if payload.get("e", 0) < time.time():
        raise ApiError("error.api.tunnel.expired", 410)
    validate_url(payload["u"])
    return payload


def download_to_file(url, fmt, mode):
    """Telecharge dans un dossier temporaire, renvoie (chemin, content_type)."""
    tmp = tempfile.mkdtemp(prefix="sd-")
    out_tpl = os.path.join(tmp, "out.%(ext)s")
    cmd = ytdlp_common_args() + ["-f", fmt, "--print", "after_move:filepath", "-o", out_tpl]
    if has_ffmpeg():
        cmd += ["--merge-output-format", "mp4"]
        if mode == "audio":
            cmd += ["-x", "--audio-format", "mp3", "--audio-quality", "5"]
    cmd.append(url)
    try:
        r = subprocess.run(cmd, capture_output=True, timeout=900)
    except subprocess.TimeoutExpired:
        shutil.rmtree(tmp, ignore_errors=True)
        raise ApiError("error.api.fetch.timeout", 504)
    if r.returncode != 0:
        shutil.rmtree(tmp, ignore_errors=True)
        tail = r.stderr.decode("utf-8", "replace")[-300:]
        print("[tunnel] echec:", tail, flush=True)
        raise ApiError("error.api.fetch.fail")
    path = ""
    for line in r.stdout.decode("utf-8", "replace").strip().splitlines():
        if os.path.exists(line.strip()):
            path = line.strip()
    if not path:
        # repli : premier fichier du dossier temporaire
        files = [os.path.join(tmp, f) for f in os.listdir(tmp)]
        if not files:
            shutil.rmtree(tmp, ignore_errors=True)
            raise ApiError("error.api.fetch.empty")
        path = files[0]
    ctype = "audio/mpeg" if path.endswith(".mp3") else (
        "audio/mp4" if path.endswith((".m4a", ".mp4a")) else "video/mp4")
    return tmp, path, ctype


class Handler(BaseHTTPRequestHandler):
    server_version = "SmartDownloadExtractor/1.0"
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        print("[http]", fmt % args, flush=True)

    def _send_json(self, obj, status=200):
        body = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self):
        try:
            n = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            n = 0
        if n <= 0 or n > 64_000:
            return {}
        try:
            return json.loads(self.rfile.read(n).decode("utf-8", "replace"))
        except Exception:
            return {}

    def _base_url(self):
        host = self.headers.get("X-Forwarded-Host") or self.headers.get("Host") or f"localhost:{PORT}"
        proto = self.headers.get("X-Forwarded-Proto") or ("https" if self.headers.get("X-Forwarded-Ssl") else "http")
        return f"{proto}://{host}"

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Accept")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/":
            return self._send_json({
                "status": "ok",
                "service": "smartdownload-extractor",
                "backend": "yt-dlp",
                "cookies": bool(COOKIES_PATH and os.path.exists(COOKIES_PATH)),
                "ffmpeg": has_ffmpeg(),
            })
        if parsed.path == "/tunnel":
            q = parse_qs(parsed.query)
            try:
                payload = read_tunnel_payload(q.get("p", [""])[0], q.get("s", [""])[0])
            except ApiError as e:
                return self._send_json({"status": "error", "error": {"code": e.code}}, e.status)
            tmp, path, ctype = download_to_file(
                payload["u"], payload["f"], payload.get("m", "video"))
            try:
                size = os.path.getsize(path)
                fname = payload.get("n") or os.path.basename(path)
                self.send_response(200)
                self.send_header("Content-Type", ctype)
                self.send_header("Content-Length", str(size))
                self.send_header("Content-Disposition",
                                 f'attachment; filename="{fname}"')
                self.end_headers()
                with open(path, "rb") as f:
                    while True:
                        chunk = f.read(262144)
                        if not chunk:
                            break
                        self.wfile.write(chunk)
            except (BrokenPipeError, ConnectionResetError):
                pass
            finally:
                shutil.rmtree(tmp, ignore_errors=True)
            return
        return self._send_json({"status": "error", "error": {"code": "error.api.not_found"}}, 404)

    def do_POST(self):
        body = self._read_body()
        if urlparse(self.path).path == "/info":
            try:
                url = validate_url(body.get("url", ""))
                meta = ytdlp_json(url)
                return self._send_json({
                    "title": meta.get("title") or "Video partagee",
                    "duration": int(meta.get("duration") or 0),
                    "thumbnail": meta.get("thumbnail") or "",
                })
            except ApiError as e:
                return self._send_json({"status": "error", "error": {"code": e.code}}, e.status)
        if urlparse(self.path).path != "/":
            return self._send_json({"status": "error", "error": {"code": "error.api.not_found"}}, 404)

        try:
            url = validate_url(body.get("url", ""))
            mode = "audio" if body.get("downloadMode") == "audio" else "video"
            quality = body.get("videoQuality") or "720"
            meta = ytdlp_json(url)
            fmt = pick_format(meta, mode, quality)
            ext = "mp3" if mode == "audio" else "mp4"
            filename = safe_filename(meta.get("title"), ext)
            tunnel = make_tunnel_url(self._base_url(), url, fmt, mode, filename)
            return self._send_json({"status": "tunnel", "url": tunnel, "filename": filename})
        except ApiError as e:
            return self._send_json({"status": "error", "error": {"code": e.code, "text": e.code}}, e.status)
        except Exception as exc:  # filet de securite
            print("[post] erreur inattendue:", repr(exc), flush=True)
            return self._send_json(
                {"status": "error", "error": {"code": "error.api.fetch.fail"}}, 500)


if __name__ == "__main__":
    print(f"SmartDownload extractor (yt-dlp) sur le port {PORT} — "
          f"cookies={'oui' if COOKIES_PATH and os.path.exists(COOKIES_PATH) else 'non'}, "
          f"ffmpeg={'oui' if has_ffmpeg() else 'non'}", flush=True)
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
