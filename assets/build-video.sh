#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCENES_DIR="$ROOT_DIR/assets/video-scenes"
OUT_DIR="$ROOT_DIR/public/videos"
OUT_FILE="${1:-$OUT_DIR/ai-team-promo-draft.mp4}"
TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

mkdir -p "$OUT_DIR"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "No encuentro ffmpeg. Instala ffmpeg y vuelve a ejecutar este script." >&2
  exit 1
fi

scene_dirs=(
  "$SCENES_DIR/scene-01-chaos-clinic"
  "$SCENES_DIR/scene-02-pablo"
  "$SCENES_DIR/scene-03-sergio-central"
  "$SCENES_DIR/scene-04-ai-team-dashboard"
  "$SCENES_DIR/scene-05-results"
  "$SCENES_DIR/final-cta"
)

durations=(4 4 4 5 4 4)
clips=()

build_clip_from_video() {
  local src="$1"
  local duration="$2"
  local dest="$3"

  ffmpeg -y \
    -stream_loop -1 -i "$src" \
    -t "$duration" \
    -vf "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1,fps=30" \
    -an -c:v libx264 -pix_fmt yuv420p -preset medium -crf 18 \
    "$dest" >/dev/null 2>&1
}

build_clip_from_image() {
  local src="$1"
  local duration="$2"
  local dest="$3"

  ffmpeg -y \
    -loop 1 -i "$src" \
    -t "$duration" \
    -vf "scale=2100:1182:force_original_aspect_ratio=increase,crop=2100:1182,zoompan=z='min(zoom+0.0015,1.08)':d=$((duration * 30)):s=1920x1080:fps=30,setsar=1" \
    -an -c:v libx264 -pix_fmt yuv420p -preset medium -crf 18 \
    "$dest" >/dev/null 2>&1
}

for i in "${!scene_dirs[@]}"; do
  scene_dir="${scene_dirs[$i]}"
  duration="${durations[$i]}"
  clip="$TMP_DIR/scene-$((i + 1)).mp4"

  if [[ ! -d "$scene_dir" ]]; then
    echo "Falta carpeta de escena: $scene_dir" >&2
    continue
  fi

  video_src="$(find "$scene_dir" -maxdepth 1 -type f \( -iname '*.mp4' -o -iname '*.mov' -o -iname '*.m4v' \) | sort | head -n 1)"
  image_src="$(find "$scene_dir" -maxdepth 1 -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.webp' \) | sort | head -n 1)"

  if [[ -n "$video_src" ]]; then
    echo "Escena $((i + 1)): usando video $(basename "$video_src")"
    build_clip_from_video "$video_src" "$duration" "$clip"
    clips+=("$clip")
  elif [[ -n "$image_src" ]]; then
    echo "Escena $((i + 1)): usando imagen $(basename "$image_src")"
    build_clip_from_image "$image_src" "$duration" "$clip"
    clips+=("$clip")
  else
    echo "Escena $((i + 1)): sin video ni imagen, se omite por ahora."
  fi
done

if [[ "${#clips[@]}" -eq 0 ]]; then
  echo "No hay material de video o imagen para montar." >&2
  exit 1
fi

concat_file="$TMP_DIR/concat.txt"
: > "$concat_file"
for clip in "${clips[@]}"; do
  printf "file '%s'\n" "$clip" >> "$concat_file"
done

SILENT="$TMP_DIR/silent.mp4"
ffmpeg -y \
  -f concat -safe 0 -i "$concat_file" \
  -c:v libx264 -pix_fmt yuv420p -movflags +faststart \
  "$SILENT" >/dev/null 2>&1

AUDIO="$ROOT_DIR/assets/audio/voz-promocional.mp3"
if [[ -f "$AUDIO" ]]; then
  ffmpeg -y -i "$SILENT" -i "$AUDIO" \
    -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest \
    -movflags +faststart "$OUT_FILE" >/dev/null 2>&1
  echo "Video con voz generado: $OUT_FILE"
else
  cp "$SILENT" "$OUT_FILE"
  echo "Video sin audio (no encontré $AUDIO): $OUT_FILE"
fi
