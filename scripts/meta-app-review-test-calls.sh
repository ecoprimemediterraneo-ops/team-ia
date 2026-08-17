#!/usr/bin/env bash
# scripts/meta-app-review-test-calls.sh
# ---------------------------------------------------------------------------
# YA NO HACE FALTA USAR ESTO. Lo mismo se hace desde el navegador, con la sesión
# de fundador, en:  https://aiteam.marketing/api/admin/instagram-app-review?llamar=1
#
# Se queda aquí por si algún día hace falta probar con un token distinto al que
# hay en producción. Pero para el App Review, usa la ruta: pegar a mano el token
# y el App Secret en una terminal es como se acabó viendo el secreto en una
# captura de pantalla.
# ---------------------------------------------------------------------------
# UNA llamada real por cada permiso de la familia instagram_business_*, que es
# lo que Meta exige antes de dejar enviar el App Review: mientras la columna de
# llamadas esté a cero, el botón de enviar no se activa.
#
# POR QUÉ ESTE SCRIPT CAMBIÓ (julio → agosto 2026)
# -----------------------------------------------
# La versión de julio llamaba a graph.facebook.com con un token de Página. Tres
# llamadas devolvieron 200 y el contador siguió a cero, porque esas llamadas
# registran los permisos de la familia VIEJA (instagram_manage_*), que es la del
# producto "Instagram Graph API" con Facebook Login.
#
# Los permisos instagram_business_* son de OTRO producto: "Instagram API con
# Instagram Login". Sus llamadas van a graph.instagram.com y su token sale del
# login de Instagram, no del Business Manager. Llamar al host equivocado suma en
# la familia equivocada, y por fuera se ve idéntico: un 200 tan tranquilo.
#
# Por eso aquí se hace lo primero de todo un debug_token: si el token no trae los
# cuatro permisos business_*, el script para y lo dice. Mejor eso que cuatro
# doscientos que no cuentan para nada. Con --sin-comprobar se salta y se llama
# igualmente: perder la comprobación previa no es motivo para no intentarlo,
# porque el resultado de las cuatro llamadas ya dice si el token sirve.
#
# EL TOKEN NO SE IMPRIME NUNCA. Ni entero, ni en trozos, ni en los ficheros de
# salida, ni dentro de los mensajes de error de Meta — que los devuelve enteros
# ("Malformed access token EAA…"). Todo lo que se enseña pasa por un filtro.
#
# USO
#   read -s TOKEN && export TOKEN
#   read -s META_APP_SECRET && export META_APP_SECRET
#   bash scripts/meta-app-review-test-calls.sh
#
#   ... --sin-publicar     hace todo menos publicar en la cuenta
#   ... --sin-comprobar    se salta el debug_token y llama directamente
#
# POR QUÉ HACE FALTA EL APP SECRET: `debug_token` NO puede inspeccionarse a sí
# mismo. El parámetro `access_token` tiene que ser un TOKEN DE APLICACIÓN
# —"APP_ID|APP_SECRET"— y el token a mirar va en `input_token`. Pasando el mismo
# token en los dos sitios, Meta contesta un error y parecía que el token estaba
# mal cuando lo que estaba mal era la pregunta.
#
# Variables opcionales: META_APP_ID IG_USER_ID PAGE_ID API_VERSION IMAGE_URL
#                       CAPTION OUTDIR
# ---------------------------------------------------------------------------
set -uo pipefail   # ni -e ni -x: no queremos parar en un error de Meta ni filtrar el token

API_VERSION="${API_VERSION:-v21.0}"
FB="https://graph.facebook.com/${API_VERSION}"
IG="https://graph.instagram.com/${API_VERSION}"
IG_USER_ID="${IG_USER_ID:-17841410811816797}"
PAGE_ID="${PAGE_ID:-1110804952118807}"
OUTDIR="${OUTDIR:-/tmp/meta-app-review}"
META_APP_ID="${META_APP_ID:-2156272571817837}"
PUBLICAR=1
COMPROBAR=1
for a in "$@"; do
  case "$a" in
    --sin-publicar)  PUBLICAR=0 ;;
    --sin-comprobar) COMPROBAR=0 ;;
  esac
done

# Imagen de marca: la portada que genera la propia web (fondo crema, tipografía
# de la casa). wsrv.nl la pasa a JPG 1080x1080, que es lo que traga Instagram.
IMAGE_URL="${IMAGE_URL:-https://wsrv.nl/?url=aiteam.marketing/api/og/post%3Ffrase%3DTu%2520equipo%2520de%2520IA%252C%2520trabajando%26rol%3DAI-TEAM&output=jpg&w=1080&h=1080}"
CAPTION="${CAPTION:-En AI-Team montamos agentes de IA que trabajan por tu negocio: contestan el WhatsApp, cuadran las citas y llevan las redes.

Menos tareas repetidas, mas tiempo para lo que importa.

Mas en aiteam.marketing

#IA #Automatizacion #PYMES #InteligenciaArtificial}"

# --- token ----------------------------------------------------------------
if [ -z "${TOKEN:-}" ]; then
  TOKEN="${INSTAGRAM_ACCESS_TOKEN:-}"
fi
if [ -z "${TOKEN:-}" ]; then
  echo "ERROR: no hay token."
  echo "Pásalo sin que quede en el historial:"
  echo "  read -s TOKEN && export TOKEN"
  exit 1
fi

mkdir -p "$OUTDIR"
rm -f "$OUTDIR"/*.json "$OUTDIR"/*.txt 2>/dev/null

# Filtro que tapa el token Y EL APP SECRET en cualquier cosa que se imprima o se
# guarde. El App Secret viaja dentro del token de aplicación ("APP_ID|SECRET"), y
# Meta devuelve enteros los tokens que no le gustan: sin esto, un error de
# debug_token escupiría el secreto de la app en pantalla.
tapar() { python3 -c '
import sys, re
t, sec = sys.argv[1], sys.argv[2]
d = sys.stdin.read()
if t: d = d.replace(t, "«token oculto»")
if sec: d = d.replace(sec, "«app secret oculto»")
d = re.sub(r"(EAA|IGAA)[A-Za-z0-9_-]{15,}", "«token oculto»", d)
sys.stdout.write(d)
' "$TOKEN" "${META_APP_SECRET:-}"; }

log() { echo "[$(date -u +%H:%M:%S)] $*"; }
jget() { python3 -c "import json,sys
try: d=json.load(open(sys.argv[1]))
except Exception: raise SystemExit
def cava(o,c):
    for k in c.split('.'):
        if isinstance(o,dict): o=o.get(k)
        else: return ''
    return o if o is not None else ''
print(cava(d, sys.argv[2]))" "$1" "$2" 2>/dev/null; }

# Enseña el error de Meta ENTERO, que es lo que hace falta para arreglarlo.
pinta_error() {
  local f="$1"
  local msg; msg=$(jget "$f" error.message)
  [ -z "$msg" ] && return 0
  echo "       mensaje ...: $(printf '%s' "$msg" | tapar)"
  echo "       tipo ......: $(jget "$f" error.type)"
  echo "       código ....: $(jget "$f" error.code) / subcódigo $(jget "$f" error.error_subcode)"
  local um; um=$(jget "$f" error.error_user_msg)
  [ -n "$um" ] && echo "       explicación: $(printf '%s' "$um" | tapar)"
  echo "       fbtrace_id : $(jget "$f" error.fbtrace_id)"
}

SUMMARY="$OUTDIR/resumen.txt"
: > "$SUMMARY"
anota() { printf '%-38s %s\n' "$1" "$2" >> "$SUMMARY"; }

echo "═══════════════════════════════════════════════════════════════════"
echo " App Review · llamadas de prueba de la familia instagram_business_*"
echo " token: puesto (${#TOKEN} caracteres) · cuenta IG: $IG_USER_ID"
echo "═══════════════════════════════════════════════════════════════════"

# --- 0) ¿Qué permisos trae el token DE VERDAD? ----------------------------
if [ "$COMPROBAR" = "0" ]; then
  echo "[$(date -u +%H:%M:%S)] 0) debug_token SALTADO (--sin-comprobar)"
  echo "   Se llama directamente. El resultado de las cuatro llamadas dirá si el"
  echo "   token sirve: un 200 cuenta, y un error de permiso lo dirá con su código."
  anota "debug_token" "saltado por --sin-comprobar"
else
log "0) debug_token — qué permisos trae el token"

# El token de aplicación. Es lo que exige Meta como `access_token` para poder
# inspeccionar otro token; el que se quiere mirar va en `input_token`.
if [ -z "${META_APP_SECRET:-}" ]; then
  echo "   ✗ FALTA META_APP_SECRET, y sin él no se puede preguntar por los permisos."
  echo
  echo "     debug_token necesita un token de aplicación (APP_ID|APP_SECRET) para"
  echo "     inspeccionar otro token. El App Secret está en Meta → Configuración de"
  echo "     la app → Básica, y en Vercel como META_APP_SECRET."
  echo
  echo "     Pásalo así, sin que quede en el historial:"
  echo "       read -s META_APP_SECRET && export META_APP_SECRET"
  echo
  echo "     O sáltate la comprobación y llama directamente:"
  echo "       bash scripts/meta-app-review-test-calls.sh --sin-comprobar"
  anota "resultado" "PARADO: falta META_APP_SECRET"
  exit 1
fi

APP_TOKEN="${META_APP_ID}|${META_APP_SECRET}"
curl -sg -m 30 -o "$OUTDIR/00_debug.json" \
  --data-urlencode "input_token=$TOKEN" \
  --data-urlencode "access_token=$APP_TOKEN" \
  -G "$FB/debug_token" >/dev/null

SCOPES=$(python3 -c "
import json
try: d=json.load(open('$OUTDIR/00_debug.json')).get('data',{})
except Exception: d={}
print(','.join(d.get('scopes',[])))" 2>/dev/null)
TIPO=$(jget "$OUTDIR/00_debug.json" data.type)
CADUCA=$(jget "$OUTDIR/00_debug.json" data.expires_at)
APP_DEL_TOKEN=$(jget "$OUTDIR/00_debug.json" data.app_id)
VALIDO=$(jget "$OUTDIR/00_debug.json" data.is_valid)

if [ -z "$SCOPES" ]; then
  echo "   ✗ debug_token no ha devuelto la lista de permisos."
  pinta_error "$OUTDIR/00_debug.json"
  echo
  echo "   RESPUESTA CRUDA DE META (sin el token):"
  tapar < "$OUTDIR/00_debug.json" | python3 -m json.tool 2>/dev/null | sed 's/^/     /' \
    || tapar < "$OUTDIR/00_debug.json" | sed 's/^/     /'
  echo
  echo "   Si el error habla del App Secret, revisa que META_APP_SECRET sea el de"
  echo "   la app $META_APP_ID y no el de otra."
  echo
  echo "   Puedes seguir de todos modos: perder la comprobación previa no es"
  echo "   motivo para no intentarlo, porque las cuatro llamadas ya dicen si el"
  echo "   token sirve. Relánzalo con:"
  echo "       bash scripts/meta-app-review-test-calls.sh --sin-comprobar"
  anota "resultado" "PARADO: debug_token sin permisos"
  exit 1
fi

echo "   token válido: ${VALIDO:-?}   tipo: ${TIPO:-?}   caduca: ${CADUCA:-0 (no caduca)}"
[ -n "$APP_DEL_TOKEN" ] && [ "$APP_DEL_TOKEN" != "$META_APP_ID" ] && \
  echo "   ⚠ OJO: el token es de la app $APP_DEL_TOKEN, no de $META_APP_ID."
echo "   permisos:"
printf '%s' "$SCOPES" | tr ',' '\n' | sed 's/^/     · /'
anota "scopes" "$SCOPES"

FALTAN=""
for P in instagram_business_basic instagram_business_content_publish \
         instagram_business_manage_comments instagram_business_manage_messages; do
  case ",$SCOPES," in *",$P,"*) : ;; *) FALTAN="$FALTAN $P" ;; esac
done

if [ -n "$FALTAN" ]; then
  echo
  echo "   ✗ AL TOKEN LE FALTAN ESTOS PERMISOS:"
  for p in $FALTAN; do echo "       · $p"; done
  echo
  echo "   Cualquier llamada ahora registraría el permiso equivocado —o ninguno— y"
  echo "   el contador seguiría a cero, que es lo que pasó en julio. Genera el"
  echo "   token otra vez con los cuatro marcados."
  echo
  echo "   Si quieres intentarlo igualmente y ver qué contesta Meta:"
  echo "       bash scripts/meta-app-review-test-calls.sh --sin-comprobar"
  anota "resultado" "PARADO: faltan permisos"
  exit 1
fi
echo "   ✓ Los cuatro permisos business_* están en el token."
fi

# --- ¿Qué host acepta este token? ----------------------------------------
# graph.instagram.com es el host de la familia business_*. Si el token es de
# System User puede que solo valga en graph.facebook.com; se comprueba en vez de
# suponerlo, y se dice cuál se ha usado.
log "0b) ¿qué host acepta este token?"
IGH=$(curl -sg -m 30 -o "$OUTDIR/00b_ig_me.json" -w "%{http_code}" "$IG/me?fields=id,username&access_token=$TOKEN")
if [ "$IGH" = "200" ]; then
  HOST="$IG"; HOSTN="graph.instagram.com"; BASE="me"
else
  HOST="$FB"; HOSTN="graph.facebook.com"; BASE="$IG_USER_ID"
  echo "   graph.instagram.com devolvió $IGH; se usará graph.facebook.com."
  pinta_error "$OUTDIR/00b_ig_me.json"
fi
echo "   host: $HOSTN"
anota "host_usado" "$HOSTN"

# =========================================================================
# 1) instagram_business_basic  ->  GET /me (o /{ig-user-id})
# =========================================================================
log "1) instagram_business_basic"
EP1="GET $HOSTN/$BASE?fields=id,username"
H1=$(curl -sg -m 30 -o "$OUTDIR/01_basic.json" -w "%{http_code}" \
  "$HOST/$BASE?fields=id,username,account_type&access_token=$TOKEN")
echo "   $H1  $EP1"
[ "$H1" != "200" ] && pinta_error "$OUTDIR/01_basic.json"
[ "$H1" = "200" ] && echo "       cuenta: @$(jget "$OUTDIR/01_basic.json" username)"
anota "instagram_business_basic" "$H1  $EP1"

# =========================================================================
# 2) instagram_business_content_publish  ->  POST /media + /media_publish
# =========================================================================
log "2) instagram_business_content_publish"
MEDIA_ID=""; PERMALINK=""
if [ "$PUBLICAR" = "0" ]; then
  echo "   (saltado por --sin-publicar)"
  anota "instagram_business_content_publish" "saltado"
else
  EP2="POST $HOSTN/$BASE/media + /media_publish"
  H2A=$(curl -sg -m 60 -o "$OUTDIR/02a_container.json" -w "%{http_code}" -X POST "$HOST/$BASE/media" \
    --data-urlencode "image_url=$IMAGE_URL" \
    --data-urlencode "caption=$CAPTION" \
    --data-urlencode "access_token=$TOKEN")
  CID=$(jget "$OUTDIR/02a_container.json" id)
  echo "   $H2A  crear contenedor${CID:+ (id $CID)}"
  [ "$H2A" != "200" ] && pinta_error "$OUTDIR/02a_container.json"

  if [ -n "$CID" ]; then
    # El contenedor tarda unos segundos en quedar listo; publicar antes falla.
    for _ in 1 2 3 4 5 6 7 8; do
      curl -sg -m 30 -o "$OUTDIR/02b_status.json" "$HOST/$CID?fields=status_code&access_token=$TOKEN" >/dev/null
      ST=$(jget "$OUTDIR/02b_status.json" status_code)
      [ "$ST" = "FINISHED" ] && break
      [ "$ST" = "ERROR" ] && break
      sleep 3
    done
    echo "       contenedor: ${ST:-sin estado}"
    if [ "$ST" = "FINISHED" ]; then
      H2B=$(curl -sg -m 60 -o "$OUTDIR/02c_publish.json" -w "%{http_code}" -X POST "$HOST/$BASE/media_publish" \
        --data-urlencode "creation_id=$CID" --data-urlencode "access_token=$TOKEN")
      MEDIA_ID=$(jget "$OUTDIR/02c_publish.json" id)
      echo "   $H2B  publicar${MEDIA_ID:+ (media $MEDIA_ID)}"
      [ "$H2B" != "200" ] && pinta_error "$OUTDIR/02c_publish.json"
      if [ -n "$MEDIA_ID" ]; then
        curl -sg -m 30 -o "$OUTDIR/02d_media.json" \
          "$HOST/$MEDIA_ID?fields=id,permalink,timestamp&access_token=$TOKEN" >/dev/null
        PERMALINK=$(jget "$OUTDIR/02d_media.json" permalink)
        echo "       PERMALINK: $PERMALINK"
      fi
      anota "instagram_business_content_publish" "$H2B  $EP2"
      anota "permalink" "${PERMALINK:-—}"
    else
      anota "instagram_business_content_publish" "$H2A  contenedor no llegó a FINISHED"
    fi
  else
    anota "instagram_business_content_publish" "$H2A  $EP2 (sin contenedor)"
  fi
fi

# =========================================================================
# 3) instagram_business_manage_comments  ->  GET /{media}/comments
# =========================================================================
log "3) instagram_business_manage_comments"
if [ -z "$MEDIA_ID" ]; then
  # Sin publicación nueva, vale la última que haya en la cuenta.
  curl -sg -m 30 -o "$OUTDIR/03a_media_list.json" "$HOST/$BASE/media?fields=id&limit=1&access_token=$TOKEN" >/dev/null
  MEDIA_ID=$(python3 -c "
import json
try: d=json.load(open('$OUTDIR/03a_media_list.json')).get('data',[])
except Exception: d=[]
print(d[0]['id'] if d else '')" 2>/dev/null)
fi
if [ -n "$MEDIA_ID" ]; then
  EP3="GET $HOSTN/$MEDIA_ID/comments"
  H3=$(curl -sg -m 30 -o "$OUTDIR/03_comments.json" -w "%{http_code}" \
    "$HOST/$MEDIA_ID/comments?fields=id,text,username&access_token=$TOKEN")
  echo "   $H3  $EP3"
  [ "$H3" != "200" ] && pinta_error "$OUTDIR/03_comments.json"
  anota "instagram_business_manage_comments" "$H3  $EP3"
else
  echo "   ✗ no hay ninguna publicación en la cuenta contra la que llamar"
  anota "instagram_business_manage_comments" "sin media"
fi

# =========================================================================
# 4) instagram_business_manage_messages  ->  GET /conversations
# =========================================================================
log "4) instagram_business_manage_messages"
EP4="GET $HOSTN/$BASE/conversations"
H4=$(curl -sg -m 30 -o "$OUTDIR/04_conversations.json" -w "%{http_code}" \
  "$HOST/$BASE/conversations?fields=id,updated_time&access_token=$TOKEN")
echo "   $H4  $EP4"
if [ "$H4" != "200" ]; then
  pinta_error "$OUTDIR/04_conversations.json"
  # En el host de Facebook las conversaciones cuelgan de la PÁGINA, no de la
  # cuenta de Instagram.
  EP4B="GET graph.facebook.com/$PAGE_ID/conversations?platform=instagram"
  H4B=$(curl -sg -m 30 -o "$OUTDIR/04b_conversations_page.json" -w "%{http_code}" \
    "$FB/$PAGE_ID/conversations?platform=instagram&fields=id,updated_time&access_token=$TOKEN")
  echo "   $H4B  $EP4B  (segundo intento, por la Página)"
  [ "$H4B" != "200" ] && pinta_error "$OUTDIR/04b_conversations_page.json"
  anota "instagram_business_manage_messages" "$H4 / $H4B  $EP4 · $EP4B"
else
  anota "instagram_business_manage_messages" "$H4  $EP4"
fi

# --- Las respuestas guardadas se limpian de tokens ------------------------
for f in "$OUTDIR"/*.json; do
  [ -f "$f" ] || continue
  tapar < "$f" > "$f.limpio" && mv "$f.limpio" "$f"
done

echo
echo "═══════════════════════════════════════════════════════════════════"
cat "$SUMMARY"
echo "═══════════════════════════════════════════════════════════════════"
[ -n "${PERMALINK:-}" ] && echo "Publicación: $PERMALINK"
echo "Respuestas crudas en $OUTDIR (ya sin token)."
echo
echo "META TARDA HASTA 24 HORAS en reflejar estas llamadas en el formulario."
echo "Si mañana la columna sigue a cero, no es que hayan fallado: vuelve a mirar"
echo "pasado ese plazo antes de tocar nada."
