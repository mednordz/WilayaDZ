# Image de service statique pour Wilaya 01–69 — voir DEPLOY.md.
# Contexte de build attendu : la racine du dépôt (pour lire app/build.py
# et ses sources), afin que l'image embarque toujours un build frais.
FROM python:3.12-alpine AS build
WORKDIR /src
COPY app/ ./app/
RUN mkdir -p /out && python3 app/build.py /out/index.html && ls -la /out

FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /out/index.html /out/sw.js /usr/share/nginx/html/
# Confidentialite et conditions d'utilisation : des pages a part, lisibles
# sans l'application et sans compte. Google les exige pour ouvrir la
# connexion Google a tout le monde, mais elles se justifient d'elles-memes
# des lors qu'on garde des adresses e-mail.
COPY deploy/pages/ /usr/share/nginx/html/
EXPOSE 8080
