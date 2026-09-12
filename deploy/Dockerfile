# Image de service statique pour Wilaya 01–69 — voir DEPLOY.md.
# Contexte de build attendu : la racine du dépôt (pour lire app/build.py
# et ses sources), afin que l'image embarque toujours un build frais.
FROM python:3.12-alpine AS build
ARG APP_REVISION=development
WORKDIR /src
COPY app/ ./app/
RUN mkdir -p /out && python3 app/build.py /out/index.html && ls -la /out
RUN python3 -c 'import json,os; json.dump({"revision":os.environ["APP_REVISION"]},open("/out/release.json","w"))'

FROM nginx:1.30.4-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /out/index.html /out/index.html.gz /out/sw.js /usr/share/nginx/html/
COPY --from=build /out/release.json /usr/share/nginx/html/
# Confidentialite et conditions d'utilisation : des pages a part, lisibles
# sans l'application et sans compte. Google les exige pour ouvrir la
# connexion Google a tout le monde, mais elles se justifient d'elles-memes
# des lors qu'on garde des adresses e-mail.
COPY deploy/pages/ /usr/share/nginx/html/
# La musique de fond. Elle vit A COTE de l'application, jamais dedans :
# index.html doit rester le fichier unique de 0,7 Mo qui s'ouvre sur un
# reseau mobile. Rien n'est telecharge tant que personne n'allume la
# musique, et ce qui l'est se lit en flux.
COPY deploy/media/ /usr/share/nginx/html/media/
EXPOSE 8080
