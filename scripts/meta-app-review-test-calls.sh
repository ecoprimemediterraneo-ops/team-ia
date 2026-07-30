#!/usr/bin/env bash
# scripts/meta-app-review-test-calls.sh
# ---------------------------------------------------------------------------
# Hace UNA llamada real a la Graph API por cada permiso de Instagram que
# AI-Team necesita aprobar en el App Review de Meta. Sirve para dejar registrada
# la llamada de prueba que Meta exige por permiso (el Explorador no mete el
# permiso en el token, por eso se hacen por curl).
#
# SEGURIDAD: el token NUNCA se imprime. Se toma, por orden, de:
#   1) $TOKEN
#   2) $INSTAGRAM_ACCESS_TOKEN
#   3) INSTAGRAM_ACCESS_TOKEN en ./.env.local
#
# Uso:
#   bash scripts/meta-app-review-test-calls.sh
# Variables opcionales (todas con default):
#   IG_USER_ID PAGE_ID API_VERSION IMAGE_URL IMAGE_URL_FALLBACK CAPTION OUTDIR
#
# Los 4 permisos y su llamada de prueba:
#   instagram_content_publish            -> POST /{IG_USER_ID}/media (+ /media_publish)
#   instagram_manage_comments            -> GET  /{MEDIA_ID}/comments
#   instagram_manage_contents            -> POST /{MEDIA_ID} comment_enabled=true
#   instagram_business_manage_messages   -> GET  /{PAGE_ID}/conversations?platform=instagram
# ---------------------------------------------------------------------------
set -uo pipefail   # NO usamos -e ni -x: no queremos parar en errores de Meta ni filtrar el token

API_VERSION="${API_VERSION:-v21.0}"
API="https://graph.facebook.com/${API_VERSION}"
IG_USER_ID="${IG_USER_ID:-17841410811816797}"
PAGE_ID="${PAGE_ID:-1110804952118807}"
OUTDIR="${OUTDIR:-/tmp/meta-app-review}"
IMAGE_URL="${IMAGE_URL:-https://wsrv.nl/?url=aiteam.marketing/api/og/post%3Ffrase%3DAutomatiza%2520tu%2520negocio%2520con%2520IA%26rol%3DINSTAGRAM&output=jpg&w=1080&h=1080}"
IMAGE_URL_FALLBACK="${IMAGE_URL_FALLBACK:-https://picsum.photos/1080}"
CAPTION="${CAPTION:-🤖 En AI-Team montamos agentes de IA que trabajan por tu negocio 24/7: responden WhatsApp, agendan citas y publican en redes por ti.

Menos tareas repetitivas, más tiempo para lo que de verdad importa.

👉 Pide tu demo en aiteam.marketing

#IA #Automatizacion #PYMES #MarketingDigital #InteligenciaArtificial}"

# --- token (nunca se imprime) ---------------------------------------------
if [ -z "${TOKEN:-}" ]; then
  if [ -n "${INSTAGRAM_ACCESS_TOKEN:-}" ]; then
    TOKEN="$INSTAGRAM_ACCESS_TOKEN"
  elif [ -f .env.local ]; then
    TOKEN="$(grep -E '^INSTAGRAM_ACCESS_TOKEN=' .env.local | head -1 | cut -d= -f2- | tr -d '\042\047\r' | xargs)"
  fi
fi
if [ -z "${TOKEN:-}" ]; then
  echo "ERROR: no hay token. Define \$TOKEN o \$INSTAGRAM_ACCESS_TOKEN o ponlo en .env.local"
  exit 1
fi

mkdir -p "$OUTDIR"
jget() { python3 -c "import json,sys; d=json.load(open(sys.argv[1])); print(d.get(sys.argv[2],'') if isinstance(d,dict) else '')" "$1" "$2" 2>/dev/null; }
log() { echo "[$(date -u +%H:%M:%S)] $*"; }

SUMMARY="$OUTDIR/summary.txt"
: > "$SUMMARY"
put() { echo "$1=$2" >> "$SUMMARY"; }

# --- 0) debug_token: qué permisos lleva realmente -------------------------
log "0) debug_token"
DBG_HTTP=$(curl -sg -m 30 -o "$OUTDIR/00_debug_token.json" -w "%{http_code}" \
  "$API/debug_token?input_token=$TOKEN&access_token=$TOKEN")
SCOPES=$(python3 -c "import json;d=json.load(open('$OUTDIR/00_debug_token.json')).get('data',{});print(','.join(d.get('scopes',[])))" 2>/dev/null)
put debug_token_http "$DBG_HTTP"
put scopes "$SCOPES"
log "   scopes: ${SCOPES:-<none>}"

# --- helper: crea contenedor de imagen y espera FINISHED ------------------
crear_y_esperar() {
  local img="$1"; local tag="$2"
  curl -sg -m 60 -o "$OUTDIR/${tag}_container.json" -w "%{http_code}" -X POST "$API/$IG_USER_ID/media" \
    --data-urlencode "image_url=$img" \
    --data-urlencode "caption=$CAPTION" \
    --data-urlencode "access_token=$TOKEN" > "$OUTDIR/${tag}_container.http"
  local cid; cid=$(jget "$OUTDIR/${tag}_container.json" id)
  [ -z "$cid" ] && { echo ""; return; }
  local st=""
  for _ in 1 2 3 4 5 6 7 8; do
    curl -sg -m 30 -o "$OUTDIR/${tag}_status.json" \
      "$API/$cid?fields=status_code,status&access_token=$TOKEN" >/dev/null
    st=$(jget "$OUTDIR/${tag}_status.json" status_code)
    [ "$st" = "FINISHED" ] && { echo "$cid"; return; }
    [ "$st" = "ERROR" ] && { echo ""; return; }
    sleep 3
  done
  echo ""
}

# --- 1) instagram_content_publish: PUBLICAR DE VERDAD ---------------------
log "1) instagram_content_publish -> crear contenedor + publicar"
USED_IMG="$IMAGE_URL"
CREATION_ID=$(crear_y_esperar "$IMAGE_URL" "01a")
if [ -z "$CREATION_ID" ]; then
  log "   imagen primaria falló/ERROR; probando imagen de respaldo (una sola vez)"
  USED_IMG="$IMAGE_URL_FALLBACK"
  CREATION_ID=$(crear_y_esperar "$IMAGE_URL_FALLBACK" "01b")
fi
put creation_id "$CREATION_ID"
put image_url_usada "$USED_IMG"

MEDIA_ID=""; PERMALINK=""
if [ -n "$CREATION_ID" ]; then
  PUB_HTTP=$(curl -sg -m 60 -o "$OUTDIR/03_publish.json" -w "%{http_code}" -X POST "$API/$IG_USER_ID/media_publish" \
    --data-urlencode "creation_id=$CREATION_ID" \
    --data-urlencode "access_token=$TOKEN")
  put publish_http "$PUB_HTTP"
  MEDIA_ID=$(jget "$OUTDIR/03_publish.json" id)
  put media_id "$MEDIA_ID"
  if [ -n "$MEDIA_ID" ]; then
    curl -sg -m 30 -o "$OUTDIR/04_media.json" \
      "$API/$MEDIA_ID?fields=id,permalink,caption,media_type,timestamp&access_token=$TOKEN" >/dev/null
    PERMALINK=$(jget "$OUTDIR/04_media.json" permalink)
    put permalink "$PERMALINK"
    log "   PUBLICADO. media_id=$MEDIA_ID  permalink=$PERMALINK"
  else
    log "   media_publish no devolvió id (ver 03_publish.json)"
  fi
else
  put publish_http "no_creation_id"
  log "   no se pudo crear el contenedor (ver 01a_/01b_)"
fi

# --- 2) instagram_manage_comments: GET /{MEDIA_ID}/comments ---------------
log "2) instagram_manage_comments -> GET /{MEDIA_ID}/comments"
if [ -n "$MEDIA_ID" ]; then
  CMT_HTTP=$(curl -sg -m 30 -o "$OUTDIR/05_comments.json" -w "%{http_code}" \
    "$API/$MEDIA_ID/comments?access_token=$TOKEN")
  put comments_http "$CMT_HTTP"
else
  put comments_http "sin_media_id"
fi

# --- 3) instagram_manage_contents: POST /{MEDIA_ID} comment_enabled=true --
log "3) instagram_manage_contents -> POST /{MEDIA_ID} comment_enabled=true"
if [ -n "$MEDIA_ID" ]; then
  CNT_HTTP=$(curl -sg -m 30 -o "$OUTDIR/06_toggle.json" -w "%{http_code}" -X POST "$API/$MEDIA_ID" \
    --data-urlencode "comment_enabled=true" \
    --data-urlencode "access_token=$TOKEN")
  put contents_http "$CNT_HTTP"
  put contents_mode "POST comment_enabled"
  if [ "$CNT_HTTP" != "200" ]; then
    log "   POST falló ($CNT_HTTP); fallback GET /{IG_USER_ID}/media"
    CNT2_HTTP=$(curl -sg -m 30 -o "$OUTDIR/06b_media_list.json" -w "%{http_code}" \
      "$API/$IG_USER_ID/media?fields=id,caption,media_type,permalink&access_token=$TOKEN")
    put contents_fallback_http "$CNT2_HTTP"
    put contents_mode "GET media (fallback)"
  fi
else
  # sin media publicada: usar el GET de media como llamada del permiso
  CNT2_HTTP=$(curl -sg -m 30 -o "$OUTDIR/06b_media_list.json" -w "%{http_code}" \
    "$API/$IG_USER_ID/media?fields=id,caption,media_type,permalink&access_token=$TOKEN")
  put contents_http "$CNT2_HTTP"
  put contents_mode "GET media (sin media_id)"
fi

# --- 4) instagram_business_manage_messages: GET conversations -------------
log "4) instagram_business_manage_messages -> GET /{PAGE_ID}/conversations"
MSG_HTTP=$(curl -sg -m 30 -o "$OUTDIR/07_conversations.json" -w "%{http_code}" \
  "$API/$PAGE_ID/conversations?platform=instagram&fields=id,updated_time&access_token=$TOKEN")
put conversations_http "$MSG_HTTP"

log "LISTO. Resumen -> $SUMMARY (respuestas crudas en $OUTDIR). El token no aparece en ningún archivo."
