#!/bin/bash
# ─────────────────────────────────────────────
#  Yükegel — Otomatik Git Push + Supabase Deploy
#  launchd tarafından arka planda çalıştırılır
# ─────────────────────────────────────────────

PROJECT_DIR="/Users/bayramdede/yukegel"
FUNCTIONS_DIR="$PROJECT_DIR/supabase/functions"
LOG_FILE="$PROJECT_DIR/scripts/auto-deploy.log"

# launchd minimal PATH'e sahip; araçları açıkça tanımla
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.npm-global/bin:$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node 2>/dev/null | tail -1)/bin"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

git_push() {
  cd "$PROJECT_DIR" || return
  # Staged değişiklik var mı kontrol et
  if git diff --quiet && git diff --cached --quiet; then
    return  # Değişiklik yok, sessizce çık
  fi

  TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
  git add -A
  git commit -m "auto: $TIMESTAMP" --quiet
  if git push --quiet 2>> "$LOG_FILE"; then
    log "✓ git push OK"
  else
    log "✗ git push FAILED"
  fi
}

supabase_deploy() {
  local FUNC_NAME="$1"
  cd "$PROJECT_DIR" || return
  log "→ supabase deploy: $FUNC_NAME"
  if supabase functions deploy "$FUNC_NAME" --project-ref gobepcswwsoswodhaufy 2>> "$LOG_FILE"; then
    log "✓ supabase deploy OK: $FUNC_NAME"
  else
    log "✗ supabase deploy FAILED: $FUNC_NAME"
  fi
}

log "=== auto-deploy başlatıldı ==="

# fswatch: değişen dosya yolunu satır satır alır
# --latency 3 → 3 saniye sessizlik sonrası tetikle (debounce)
# --recursive → alt klasörler dahil
# .next, node_modules, .git klasörlerini ve log dosyasını hariç tut
fswatch \
  --latency 3 \
  --recursive \
  --exclude "\.next" \
  --exclude "node_modules" \
  --exclude "\.git" \
  --exclude "auto-deploy\.log" \
  --exclude "\.DS_Store" \
  "$PROJECT_DIR" | while read -r CHANGED_FILE; do

  log "Değişiklik: $CHANGED_FILE"

  # 1) Her değişiklikte git push
  git_push

  # 2) supabase/functions/ altında bir değişiklik varsa ilgili fonksiyonu deploy et
  if [[ "$CHANGED_FILE" == "$FUNCTIONS_DIR"* ]]; then
    # Fonksiyon adını path'ten çıkar: supabase/functions/<FUNC_NAME>/...
    FUNC=$(echo "$CHANGED_FILE" | sed "s|$FUNCTIONS_DIR/||" | cut -d'/' -f1)
    if [[ -n "$FUNC" && "$FUNC" != "." ]]; then
      supabase_deploy "$FUNC"
    fi
  fi

done
