# Auto-heberger l'instance d'extraction (Cobalt) — « Option A »

SmartDownload n'extrait pas les vidéos lui-même : il parle à une **instance
Cobalt** qui, elle, sait telecharger video + audio depuis YouTube, Facebook,
TikTok et 20 autres plateformes. Cette documentation explique comment
déployer **la tienne** (gratuitement ou presque, ~5 minutes), puis comment
connecter SmartDownload dessus.

> Chaîne vérifiée de bout en bout : `POST /` de Cobalt renvoie
> `{"status":"tunnel","url":"https://<instance>/tunnel?id=..."}`
> que les routes `/api/analyze` et `/api/download` de SmartDownload
> transmettent directement au navigateur.

---

## 1. Le plus simple : Railway (~5 min, plan gratuit avec crédit)

Railway héberge une **image Docker cobalt** déjà packagée. Tu n'as besoin
d'installer ni Docker, ni Node.

1. Va sur le template : **https://railway.com/deploy/cobalt-tools--cobalt-tools**
2. Clique **Deploy**, prends l'option *API only* (pas besoin de l'UI cobalt).
3. Une fois le service démarré, dans Railway :
   - onglet **Settings → Networking → Generate Domain** : tu obtiens par
     exemple `https://cobalt-production-xxxx.up.railway.app`
   - onglet **Variables** : mets
     - `API_URL = https://cobalt-production-xxxx.up.railway.app/` (⚠️ le `/` final est obligatoire)
     - `DURATION_LIMIT = 10800` (durée max en secondes, 3 h)
4. Le service redémarre automatiquement. Test de santé dans ton navigateur :
   ouvrir `https://<ton-domaine>/` — doit renvoyer un JSON contenant
   `"cobalt":{"version":...}`. Sans ça, l'instance ne doit pas être utilisée.

**Comptes alternatives** qui marchent pareil avec l'image
`ghcr.io/imputnet/cobalt:11` : Render (Web Service « Deploy an image »),
Fly.io (`fly launch --image ghcr.io/imputnet/cobalt:11`), Koyeb, etc.

## 1bis. Alternative 100 % gratuite : Hugging Face Spaces (aucune carte bancaire)

Si tu ne veux pas utiliser Railway, host l'image sur un Space Hugging Face :

1. Compte gratuit : https://huggingface.co/join (ton gmail convient)
2. Nouveau Space : https://huggingface.co/new-space — SDK : **Docker**, nom : `cobalt`
3. Copie le fichier [`infra/cobalt/huggingface-space/Dockerfile`](huggingface-space/Dockerfile)
   dans le Space via "Files" → "Add file" (il contient les étapes 4-6 commentées
   : variable `API_URL` à créer, puis les 2 variables SmartDownload).
4. L'instance répond sur `https://<ton-user>-cobalt.hf.space/`.

Note : le plan gratuit HF "dort" après ~48 h sans trafic (redémarrage auto à la
première requête). Pour un service toujours réveillé, préfère Railway ou un VPS.

## 2. Sur ton propre VPS (le moins cher à l'usage)

Un VPS à ~4 €/mois (OVH/Hetzner/Scaleway) suffit — attention toutefois,
l'extraction YouTube + Facebook + TikTok consomme de la bande passante.

```bash
# sur le serveur, avec docker + docker compose installés
git clone https://github.com/dev-Jahsauve/Doawnload
cd Doawnload/infra/cobalt

# 1. édite docker-compose.yml : remplace API_URL par https://ton-domaine/
# 2. si l'instance est exposée publiquement, protège-la par une clé API
#    (voir section 4) — sinon n'importe qui peut se servir de ton serveur.
docker compose up -d
```

Ensuite, comme toujours : mettre le reverse proxy (Caddy est le plus simple)
en HTTPS devant le port 127.0.0.1:9000 pour que le domaine réponde en `https://`.

## 3. Connecter SmartDownload à ton instance (2 variables)

Que ce soit sur Vercel ou en local, **les deux clés à définir** sont :

| Variable | Valeur | Exemple |
|---|---|---|
| `EXTRACT_PROVIDER` | identifiant du fournisseur | `cobalt` |
| `EXTRACT_API_URL` | URL de ton instance (avec `/` final) | `https://cobalt-production-xxxx.up.railway.app/` |

**Sur Vercel** : Project Settings → Environment Variables → ajoute
`EXTRACT_PROVIDER=cobalt` et `EXTRACT_API_URL=<url de l'etape 1 ou 2>`,
puis **Redeploy**. Sans redéploiement, le mode direct ne verra pas la config.

**En local** : les mêmes valeurs, dans le fichier `.env.local` à la racine :
Déjà pré-rempli — il suffit de remplir `EXTRACT_API_URL`.

- `EXTRACT_API_KEY` / `EXTRACT_API_HEADER` : **laissés vides** tant que
  l'instance n'est pas protégée (voir §4). Avec une clé configurée :
  - `EXTRACT_API_KEY` = l'UUID de ton fichier `keys.json`
  - `EXTRACT_API_HEADER` = **VIDE** (l'en-tête `Authorization: Api-Key` est
    envoyé automatiquement, c'est le format attendu par Cobalt).

## 4. (Fortement conseillé) protéger ton instance par une clé API

Si le domaine est public, n'importe qui peut inclure ton instance dans un
outil et carboniser ton quota Railway. Pour y remédier :

1. Génére une clé au **format UUID** :
   `uuidgen` (Linux/mac), ou un générateur en ligne de UUID v4.
2. Crée `keys.json` (même base que `keys.json.example` de ce dossier) :

   ```json
   {
       "UUID-MAJUSCULES-DE-TA-CLE": {
           "name": "smartdownload",
           "limit": 200
       }
   }
   ```
3. Héberge ce fichier en HTTPS public (par exemple un gist GitHub avec
   `raw.githubusercontent.com` — c'est suffisant : l'instance ne fait que
   le télécharger régulièrement).
4. Définis sur ton instance :
   - `API_KEY_URL = https://.../keys.json`
   - `API_AUTH_REQUIRED = 1`
   - `JWT_SECRET = <chaine aleatoire de 16+ caractères>`

Puis côté SmartDownload : `EXTRACT_API_KEY=<la même clé, format UUID>` +
`EXTRACT_API_HEADER` vide.

Si tu déposes le fichier composé sur un VPS uniquement accessible depuis
chez toi, ou derrière un domaine quasi-privé, ces étapes sont optionnelles.
Rien à configurer côté app dans ce cas.

## 5. Pourquoi ces deux variables seulement ?

Quand les deux sont définies, l'app web fonctionne en **mode direct** :
la fonction serveur Next.js appelle Cobalt et redirige le visiteur sur le
fichier. Aucun worker, aucun Redis requis — c'est ce qui permet d'être
hébergé gratuitement sur le plan hobby de Vercel. Sans ces variables,
l'app continue d'essayer le mode VPS complet (fonctionne, mais requiert
l'API Fastify + un Redis physiques).

## Notes & ressources

- Repository Cobalt : https://github.com/imputnet/cobalt
- Documentation d'instance : https://github.com/imputnet/cobalt/blob/main/docs/run-an-instance.md
- Documentation API : https://github.com/imputnet/cobalt/blob/main/docs/api.md
- Instance publique officielle (api.cobalt.tools) : **ne pas utiliser** pour
  une app — accès interdit aux petits clients tiers (la protection anti-botte
  retourne une erreur). C'est bien pour ça qu'on en héberge une.
