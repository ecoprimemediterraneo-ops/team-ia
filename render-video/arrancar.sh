#!/bin/sh
# Arranca el contenedor de render en el VPS. Va como root DENTRO del contenedor
# solo para poder leer la clave privada de Let's Encrypt (600 root). El secreto vive en /opt/aiteam-render/.env (no en git).
docker run -d --name aiteam-render --restart unless-stopped \
  --user 0 \
  --cpus=2 --memory=3g --shm-size=1g \
  --env-file /opt/aiteam-render/.env \
  -e TLS_CERT=/etc/letsencrypt/live/api.aiteam.marketing/fullchain.pem \
  -e TLS_KEY=/etc/letsencrypt/live/api.aiteam.marketing/privkey.pem \
  -v /etc/letsencrypt:/etc/letsencrypt:ro \
  -v /opt/aiteam-render/videos:/data/videos \
  -e VIDEOS_DIR=/data/videos \
  -e PUBLIC_BASE_URL=https://api.aiteam.marketing:8790 \
  -p 8790:3900 aiteam-render
