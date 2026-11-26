# Plan B gratuit : heberger l'instance Cobalt sur Hugging Face Spaces
# (pas de carte bancaire, URL publique HTTPS immediately)
#
# 1. Cree un compte gratuit : https://huggingface.co/join
# 2. Nouveau Space : https://huggingface.co/new-space
#       - Proprietaire : ton utilisateur HF
#       - Nom : cobalt
#       - Licence : MIT  |  SDK : **Docker**  |  Public ou Private (marche pour l'app)
# 3. Copie le Dockerfile de ce dossier dans le Space (via "Files" > "Add file").
# 4. Dans Settings du Space > Variables and secrets > New VARIABLE :
#        API_URL = https://<TON-UTILISATEUR>-cobalt.hf.space/
#    (le "/" final est obligatoire)  -> le Space redemarre
# 5. Test : ouvre https://<TON-UTILISATEUR>-cobalt.hf.space/
#    -> JSON {"cobalt":{"version":...,"services":["youtube","facebook","tiktok",...]}}
# 6. Dans SmartDownload (Vercel ou .env.local) :
#        EXTRACT_PROVIDER = cobalt
#        EXTRACT_API_URL  = https://<TON-UTILISATEUR>-cobalt.hf.space/
#
# Important : l'URL du tunnel renvoyee par Cobalt pointera vers ce domaine,
# c'est pour ça que API_URL doit etre exactement l'URL public du Space.

FROM ghcr.io/imputnet/cobalt:11

# Hugging Face Spaces impose : applis sur le port 7860
ENV API_PORT=7860
EXPOSE 7860

# API_URL doit pointer sur l'URL publique du Space.
# Elle se definit apres creation, via une variable dans les Settings du Space :
#   Settings > Variables and secrets > New variable
#   Nom : API_URL  |  Valeur : https://<ton-user>-<nom-du-space>.hf.space/
