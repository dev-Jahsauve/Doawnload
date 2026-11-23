# SmartDownload

Télécharge une vidéo à partir de son seul lien : colle-le, choisis la qualité (MP4 360p/720p/1080p ou audio MP3), récupère le fichier. Gratuit, sans inscription.

> **Avertissement légal** : l'utilisateur est responsable du respect des droits d'auteur du contenu téléchargé. SmartDownload n'héberge aucun fichier et ne conserve rien au-delà de 30 minutes.

## Fonctionnement

```
Navigateur ── /api/* (rewrite Next.js, même origine) ──▶ API Fastify
                                                        │
                                            file BullMQ (Redis, priorités)
                                                        │
                                     Worker (yt-dlp) ──▶ fichier temporaire
                                                        │
                          purge automatique après 30 min
```

- **Analyse d'un lien** : whitelist stricte de domaines (aucune requête sortante ailleurs), métadonnées (titre, durée, miniature) et formats disponibles.
- **Téléchargement** : job BullMQ avec progression en temps réel, livraison du fichier en streaming au navigateur, puis suppression à 30 min.
- **Mode prioritaire** : l'utilisateur regarde une publicité (Adsterra) et son job passe devant la file (priorité BullMQ 1 au lieu de 10).
- **Rate limiting** : 10 téléchargements/heure par IP via Redis (configurable).
- **Publicité** : bannière accueil + interstitiel pré-téléchargement via Adsterra (compatible PropellerAds/Monetag). Sans clé configurée, les emplacements restent vides mais l'application fonctionne.
- **Historique local** : stocké uniquement dans le navigateur (localStorage), aucune inscription, aucune donnée serveur.
- **Fournisseur remplaçable** : tout passe par l'interface `DownloadProvider` (`server/src/services/download-provider.ts`). Le remplacer par une API tierce = écrire une nouvelle classe et changer `DOWNLOAD_PROVIDER`.

## Structure

```
server/            API Fastify + worker + provider yt-dlp
  src/routes/      analyze, download, jobs (statut + fichier)
  src/jobs/        worker BullMQ + purge
  src/services/    DownloadProvider (interface) + YtDlpProvider
web/               Next.js 14 + Tailwind + Framer Motion
Dockerfile.web     frontend (build standalone)
Dockerfile.server  API et worker (Node + yt-dlp + ffmpeg)
docker-compose.yml redis + server + worker + web
```

## Installation

### Avec Docker (recommandé)

```bash
cp .env.example .env    # renseigne les clés pub si tu en as déjà
docker compose up --build
```

L'application est sur http://localhost:3000.

### En local (développement)

Prérequis : Node 20+, Python 3 (`pip install yt-dlp`), ffmpeg, Redis en cours d'exécution.

```bash
npm install
npm run dev:server    # API sur :4000
npm run dev:worker    # worker + purge
npm run dev:web       # frontend sur :3000
```

### Variables d'environnement

Voir `.env.example`. Les principales :

| Variable | Rôle | Défaut |
|---|---|---|
| `REDIS_URL` | connexion Redis | `redis://localhost:6379` |
| `RATE_LIMIT_MAX` | téléchargements/heure par IP | `10` |
| `DOWNLOAD_PROVIDER` | implémentation de l'extraction | `ytdlp` |
| `YTDLP_PATH` | binaire yt-dlp | `yt-dlp` |
| `WORKER_CONCURRENCY` | téléchargements parallèles | `2` |
| `NEXT_PUBLIC_ADSTERRA_BANNER_KEY` | clé bannière Adsterra | vide |
| `NEXT_PUBLIC_ADSTERRA_PRIORITY_KEY` | clé interstitiel Adsterra | vide |

## Déploiement sur VPS

1. Privilégie une offre avec beaucoup de trafic sortant (Hetzner, OVH, Contabo) : ce service consomme de la bande passante.
2. `git clone`, puis `cp .env.example .env`, puis `docker compose up -d --build`.
3. Place Nginx ou Caddy devant `web` (port 3000) pour le TLS.
4. Surveille le worker : `docker compose logs -f worker`.

Les sites sources évoluent souvent : mets à jour régulièrement yt-dlp (`pip install -U yt-dlp` ou rebuild de l'image) pour rester compatible.

## Sécurité

- Whitelist de domaines vérifiée à l'entrée **et** à nouveau dans le worker.
- Chemins de fichiers systématiquement résolus et contrôlés avant tout streaming.
- Aucune donnée personnelle : pas de compte, historique 100 % côté navigateur.
- Purge automatique des fichiers au-delà de 30 minutes.
