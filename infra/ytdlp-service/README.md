# Service d'extraction yt-dlp (compatible Cobalt) — le repli Facebook

Cobalt, meme avec des cookies, **n'extrait pas Facebook** : son extracteur
Facebook ne lit aucun cookie (voir `api/src/processing/services/facebook.js`
dans le depot cobalt). Il se contente de chercher `browser_native_hd_url` /
`browser_native_sd_url` dans le HTML brut de la page — champs que Facebook ne
renvoie pas aux IP de datacenter sans session connectee (le lien `share/v`
redirige en JS vers `story.php`, lui-meme envoye vers le mur de login).

Ce dossier contient donc un **petit service yt-dlp autonome** qui parle exactement
le meme contrat JSON que Cobalt (`POST /` -> `{"status":"tunnel","url":...}`).
SmartDownload l'appelle automatiquement quand Cobalt echoue : il suffit de
renseigner `EXTRACT_FALLBACK_URL` dans Vercel.

---

## 1. Deploiement sur Render (1 clic avec le blueprint)

Un fichier `render.yaml` a la racine du depot definit le service complet.

1. Ouvre https://dashboard.render.com/blueprints
2. **New Blueprint instance** → choisis le depot `dev-Jahsauve/Doawnload`
   (Render lit automatiquement `render.yaml`).
3. Le service `smartdownload-ytdlp` s'affiche : **Apply / Create resources**.
   - runtime **Docker**, `Dockerfile : infra/ytdlp-service/Dockerfile`
   - plan **Free** (l'instance s'endort sans trafic — comme Cobalt, ajoute un
     moniteur UptimeRobot toutes les 5 min sur son URL).
4. Note l'URL obtenue, ex. `https://smartdownload-ytdlp.onrender.com`

Test de sante : ouvrir `https://<ton-service>/` →
`{"status":"ok","service":"smartdownload-extractor","backend":"yt-dlp","cookies":false,"ffmpeg":true}`

## 2. Brancher le repli dans Vercel

Dans Vercel → projet **doawnload** → Settings → Environment Variables :

| Cle | Valeur |
|---|---|
| `EXTRACT_FALLBACK_URL` | `https://<ton-service>.onrender.com/` (le `/` final) |

Puis **Redeploy** (Production). Rien d'autre : l'app essaie d'abord Cobalt,
puis le service yt-dlp en cas d'echec (YouTube/TikTok restent donc sur Cobalt).

## 3. Cookies Facebook (obligatoire pour la plupart des liens `share/v`)

Sans session, Facebook envoie les IP de serveurs vers le mur de login —
**aucun extracteur sans cookies ne peut passer** (verifie avec yt-dlp :
`No video found. Check if this post is accessible without being logged-in`).

1. Sur ton PC, installe une extension d'export de cookies (ex. « Get cookies.txt
   LOCALLY » sur Chrome/Firefox).
2. Connecte-toi a Facebook avec un **compte jetable** (pas ton compte principal).
3. Sur une page facebook.com, exporte les cookies au format **Netscape**
   (`cookies.txt`).
4. Render → service `smartdownload-ytdlp` → **Environment → Secret Files** :
   - nom du fichier : `facebook-cookies.txt`, contenu = le fichier exporte
     (il sera monte dans `/etc/secrets/`)
5. Environment Variables : ajoute `COOKIES_PATH = /etc/secrets/facebook-cookies.txt`
6. Le service redemarre → `/` doit renvoyer `"cookies": true`.

⚠️ Les cookies Facebook expirent (quelques semaines a quelques mois). Si
Facebook se remet a echouer, re-exporte le fichier. Le compte utilise peut
recevoir des alertes de securite — d'ou le compte jetable.

## 4. Endpoints

| Methode | Route | Role |
|---|---|---|
| `GET` | `/` | sante (JSON) — UptimeRobot |
| `POST` | `/` | contrat Cobalt : `{url, downloadMode, videoQuality, audioFormat}` → `{status:"tunnel", url, filename}` |
| `POST` | `/info` | metadonnees : `{title, duration, thumbnail}` (utilise par `/api/analyze` pour Facebook) |
| `GET` | `/tunnel?p=<payload>&s=<signature>` | stream du fichier (HMAC + expiration 30 min, whitelist de domaines re-verifiee) |

Variables d'environnement : `PORT` (Render la fournit), `COOKIES_PATH`,
`TUNNEL_SECRET` (genere par le blueprint), `TUNNEL_TTL` (defaut 1800 s).

## 5. Test local (PC, sans Docker)

```bash
cd infra/ytdlp-service
pip install -r requirements.txt
python3 service.py            # http://localhost:9000
curl -X POST http://localhost:9000/ -H "Content-Type: application/json" \
     -d '{"url":"https://www.tiktok.com/@user/video/123","downloadMode":"auto"}'
```

`ffmpeg` est requis pour le 1080p (fusion) et le MP3 ; sans lui, le service
delivre le meilleur format pre-monte.
