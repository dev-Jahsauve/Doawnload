# Politique publicitaire SmartDownload

## Principe

Le téléchargement est **100 % gratuit** : aucune publicité n'est une condition
préalable, aucun compte à rebours, aucun paiement. La monétisation repose sur un
seul emplacement discret — le **Native Banner Adsterra** — placé sous la zone de
travail, **visible en continu pendant toute l'opération** (arrivée, analyse,
choix du format, téléchargement) et **masqué uniquement une fois le fichier
réellement obtenu** (fin confirmée côté serveur), jusqu'à la prochaine analyse.

## Formats utilisés et retirés

| Format          | État     | Détail                                                                                                                         |
| --------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Native Banner   | ✅ Actif | Slot unique `components/NativeBanner.tsx`, hauteur réservée (anti-CLS), une seule charge par page, visible pendant toute l'opération, masqué après la fin confirmée du téléchargement |
| Social Bar      | ❌ Retiré | `components/GlobalAdsterra.tsx` supprimé : plus aucune notification flottante ni overlay                                      |
| Popunder        | ❌ Retiré | Plus aucun nouvel onglet automatique                                                                                           |
| Bannière iframe | ❌ Retiré | `components/BannerAd.tsx` supprimé (remplacé par le Native Banner)                                                             |
| Interstitiel    | ❌ Retiré | `components/InterstitialAd.tsx` et la modale de choix supprimés                                                                |
| Direct/Smartlink | ❌ Jamais utilisé | Le bouton « Télécharger gratuitement » pointe toujours vers le vrai fichier, jamais vers un lien pub                  |

## Configuration recommandée dans le dashboard Adsterra

À activer depuis **Adsterra → Websites → (votre site)**, sur l'unité Native
Banner et au niveau du compte :

1. **Désactiver les formats** Social Bar et Popunder pour ce site (supprimer les
   unités correspondantes ; les variables `NEXT_PUBLIC_ADSTERRA_GLOBAL_SRC` et
   `NEXT_PUBLIC_ADSTERRA_INVOKE_URL` peuvent être retirées de Vercel, le code ne
   les lit plus).
2. **Filtrage de catégories** : dans les paramètres de diffusion, exclure les
   catégories adultes si l'option est proposée pour votre compte (pornographie,
   contenus sexuels explicites, rencontres pour adultes, contenus suggestifs,
   jeux à caractère sexuel, publicités trompeuses/frauduleuses).
3. **Frequency Capping** : conserver la limite par défaut (pas de renouvellement
   artificiel côté site — le script est chargé une seule fois par page).

## Limites honnêtes du filtrage

- Adsterra **ne garantit pas** un filtrage absolu : la sélection des créas est
  faite par le réseau côté serveur. Les exclusions ci-dessus réduisent fortement
  les risques mais un contenu inapproprié peut exceptionnellement passer.
- Le code source ne peut pas inspecter le contenu des créas servies (iframe/JSON
  tiers) : **aucun filtrage supplémentaire fiable n'est possible côté client**
  sans violer les règles du réseau. Tout masquage visuel post-chargement serait
  illusoire et fausserait les statistiques de facturation.
- Si une publicité inappropriée apparaît malgré les exclusions, la seule action
  efficace est un **signalement au support Adsterra** (support@adsterra.com ou
  chat du dashboard) avec capture d'écran, URL de la créa si visible et date/heure.

## Mécanisme de signalement utilisateur

Aucun mécanisme automatisé de retrait n'existe côté Adsterra pour les éditeurs.
La procédure retenue : l'utilisateur signale via le contact du site, l'exploitant
transmet au support Adsterra sous 48 h. En cas de récidive sur une même campagne,
demander à Adsterra l'exclusion de l'annonceur/campagne concernée.

## Fin de téléchargement : ce qui est réellement détectable

- **Mode taches (backend Fastify/BullMQ)** : la fin est **fiable côté serveur**
  (état `completed` du job) — c'est la voie de référence : l'espace publicitaire
  est masqué à ce moment précis.
- **Mode direct (serverless Vercel)** : le fichier transite par un tunnel tiers,
  le navigateur n'expose aucun événement de fin de téléchargement. Comme la fin
  réelle n'est pas confirmable, **l'espace publicitaire n'est jamais masqué sur
  une supposition** : il reste en place jusqu'à ce que l'utilisateur lance une
  nouvelle opération (bouton « Nouveau téléchargement »). Le libellé affiché («
  Fichier prêt, téléchargement lancé ») ne prétend pas confirmer la réception
  complète du fichier.
