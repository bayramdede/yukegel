#!/bin/bash
# ─────────────────────────────────────────────
#  Yükegel — Otomatik Git Push + Supabase Deploy
#  launchd tarafından arka planda çalıştırılır
#  (com.yukegel.autodeploy.plist)
# ─────────────────────────────────────────────
#
# 29 Tem 2026 — REVİZYON. Eski sürüm üç somut zarar veriyordu:
#   1) Kullanıcının elle attığı `git push` daemon'la yarışıp "cannot lock ref"
#      ile düşüyordu; daemon reddedilen push'tan sonra da kendini toparlamıyordu.
#   2) Editör geçici dosyaları (`x.ts.tmp.32349.…`) her kaydetmede iki-üç ayrı
#      fswatch olayı üretiyor, her olay bir commit + bir deploy tetikliyordu.
#      `parse-listing` 2 saniye içinde 4 kez deploy edilmeye çalışıldı.
#   3) `supabase functions deploy` 1 Haziran'dan beri "Access token not provided"
#      ile başarısızdı ama hata yalnız log'a yazıldığı için ~2 ay görülmedi.
#      Kod push'landı, edge function ESKİ kaldı.

set -uo pipefail

PROJECT_DIR="/Users/bayramdede/yukegel"
FUNCTIONS_DIR="$PROJECT_DIR/supabase/functions"
LOG_FILE="$PROJECT_DIR/scripts/auto-deploy.log"
STATE_DIR="$HOME/.local/state/yukegel-autodeploy"
# 🔑 Token repo DIŞINDA tutulur — repoya girse `git add -A` onu commit'ler.
ENV_FILE="$HOME/.config/yukegel/auto-deploy.env"
PROJECT_REF="gobepcswwsoswodhaufy"
LOG_MAX_BYTES=$((5 * 1024 * 1024))

mkdir -p "$STATE_DIR"

# launchd minimal PATH'e sahip; araçları açıkça tanımla
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.npm-global/bin:$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node" 2>/dev/null | tail -1)/bin"

# 🔑 SUPABASE_ACCESS_TOKEN. launchd oturumu `supabase login`'in yazdığı keychain
# girdisini GÖRMEZ — deploy'un iki ay sessizce düşmesinin sebebi tam olarak bu.
# Dosya biçimi (chmod 600):  SUPABASE_ACCESS_TOKEN=sbp_xxxxx
if [[ -f "$ENV_FILE" ]]; then
  set -a; . "$ENV_FILE"; set +a
fi

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Log dosyası 18.000 satıra / 2 MB'a çıkmıştı; kendi kendini döndürsün.
log_rotate() {
  local boyut
  boyut=$(stat -f%z "$LOG_FILE" 2>/dev/null || echo 0)
  if (( boyut > LOG_MAX_BYTES )); then
    mv -f "$LOG_FILE" "${LOG_FILE}.1"
    log "=== log döndürüldü (önceki: ${LOG_FILE}.1) ==="
  fi
}

# Aynı hatayı her olayda bildirip masaüstünü boğmamak için: bir hata türü
# yalnızca durum DEĞİŞTİĞİNDE bildirilir.
bildir() {
  local anahtar="$1" mesaj="$2"
  local damga="$STATE_DIR/uyari-$anahtar"
  [[ -f "$damga" ]] && return 0          # zaten bildirildi, sus
  : > "$damga"
  log "🔔 BİLDİRİM: $mesaj"
  osascript -e "display notification \"$mesaj\" with title \"Yükegel auto-deploy\"" 2>/dev/null
}

bildirim_temizle() {
  rm -f "$STATE_DIR/uyari-$1"
}

# ── Git ──────────────────────────────────────────────────────────────────────

git_push() {
  cd "$PROJECT_DIR" || return

  # 🚨 Kullanıcı o anda elle git komutu çalıştırıyorsa karışma. Eski sürüm
  # karışıyordu ve log'da "Unable to create '.git/index.lock': File exists"
  # kalıntıları bırakıyordu; bir kere de takılı kalan lock'u temizlemek gerekti.
  if [[ -e "$PROJECT_DIR/.git/index.lock" ]]; then
    log "⏭  index.lock var (elle git komutu çalışıyor) — bu tur atlandı"
    return
  fi

  # Değişiklik var mı? Eski kontrol (`git diff --quiet && git diff --cached
  # --quiet`) TAKİPSİZ dosyaları görmüyordu; oysa `git add -A` onları eklerdi →
  # yeni dosyalar bazen hiç commit'lenmiyordu. `status --porcelain` üçünü de görür.
  [[ -z "$(git status --porcelain)" ]] && return

  git add -A || { log "✗ git add başarısız"; return; }

  # `add`'den sonra hâlâ stage boşsa (yalnız .gitignore'lu dosyalar değişmişse)
  # commit hata verir ve eski sürüm buna rağmen push'a giderdi.
  if git diff --cached --quiet; then
    return
  fi

  git commit -m "auto: $(date '+%Y-%m-%d %H:%M:%S')" --quiet \
    || { log "✗ git commit başarısız"; return; }

  # 🚨 29 Tem 2026 — DAEMON ARTIK `main`'E PUSH ETMEZ, `yedek` DALINA PUSH EDER.
  #
  # NEDEN: Vercel Hobby'de KAYAN 24 SAATTE 100 DEPLOYMENT sınırı var. Bu daemon
  # her dosya kaydında commit + push atıyor → günde ~256 push → 24 saat dolmadan
  # kota bitiyor ve Vercel HİÇBİR deployment oluşturmuyor; `deploy:` commit'i de
  # dahil. Belirti sinsi: dashboard'da hiçbir kayıt YOK (Canceled bile değil),
  # hata da yok — push başarılı görünüyor ama site güncellenmiyor.
  #
  # ⚠️ `vercel.json → ignoreCommand` bunu ÇÖZMEZ. O, build'i iptal eder ama
  #    deployment ZATEN OLUŞTURULMUŞTUR ve kotadan DÜŞER. Yani "Canceled" satırlar
  #    build dakikası harcamaz, kota harcar. Kotayı korumanın tek yolu Vercel'in
  #    deployment'ı hiç OLUŞTURMAMASI: push'un izlenen dala gitmemesi.
  #
  # ÇÖZÜM İKİ PARÇA, İKİSİ DE GEREKLİ:
  #   1. burada: daemon `HEAD:yedek`'e push eder → `main` sessiz kalır
  #   2. `vercel.json → git.deploymentEnabled.yedek = false` → Vercel bu dal için
  #      deployment OLUŞTURMAZ (aksi halde her push Preview deployment'ı olur ve
  #      kota yine dolar — Preview de sayılır)
  #
  # Yedeklemeden VAZGEÇİLMEDİ: her kaydetme hâlâ GitHub'a çıkıyor, sadece başka
  # dala. Disk giderse commit'ler `yedek` dalında duruyor. Canlıya çıkış tek kapı:
  # `npm run deploy` → `main` → 1 deployment.
  if git push --quiet origin HEAD:"$YEDEK_DAL" 2>> "$LOG_FILE"; then
    log "✓ yedek push OK ($YEDEK_DAL)"
    bildirim_temizle push
    return
  fi

  # 🚨 Reddedilen push'tan sonra TOPARLAN. `yedek` yalnızca bir aynadır: `main`
  # rebase'lendiyse ileri sarmaz. `--force-with-lease` kullanılır — düz `--force`
  # DEĞİL: uzaktaki dalı son gördüğümüzden beri başkası değiştirdiyse yine durur.
  log "… yedek push reddedildi, --force-with-lease ile tekrar deneniyor"
  if git push --quiet --force-with-lease origin HEAD:"$YEDEK_DAL" 2>> "$LOG_FILE"; then
    log "✓ yedek push OK (force-with-lease)"
    bildirim_temizle push
  else
    log "✗ yedek push FAILED"
    bildir push "yedek dalına push başarısız — elle müdahale gerekiyor"
  fi
}

# ── Supabase ─────────────────────────────────────────────────────────────────

# Fonksiyon kaynağının içerik özeti. Deploy yalnızca özet DEĞİŞTİYSE yapılır —
# tek kaydetmenin ürettiği 3-4 fswatch olayı böylece tek deploy'a iner.
fonksiyon_ozeti() {
  find "$FUNCTIONS_DIR/$1" -type f ! -name '*.tmp.*' -exec shasum {} + 2>/dev/null \
    | shasum | cut -d' ' -f1
}

supabase_deploy() {
  local FUNC_NAME="$1"
  cd "$PROJECT_DIR" || return

  if [[ ! -d "$FUNCTIONS_DIR/$FUNC_NAME" ]]; then
    # `supabase/functions/` kökündeki bir dosya değiştiğinde eski sürüm dosya
    # adını fonksiyon adı sanıp olmayan bir fonksiyonu deploy etmeye çalışıyordu.
    return
  fi

  local ozet_dosya="$STATE_DIR/deploy-$FUNC_NAME.sha"
  local yeni_ozet; yeni_ozet=$(fonksiyon_ozeti "$FUNC_NAME")
  if [[ -n "$yeni_ozet" && -f "$ozet_dosya" && "$yeni_ozet" == "$(cat "$ozet_dosya")" ]]; then
    return   # içerik aynı, deploy gereksiz
  fi

  if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
    log "✗ supabase deploy ATLANDI: SUPABASE_ACCESS_TOKEN yok ($ENV_FILE)"
    bildir token "Edge function deploy edilemiyor: SUPABASE_ACCESS_TOKEN tanımlı değil"
    return
  fi

  log "→ supabase deploy: $FUNC_NAME"
  if supabase functions deploy "$FUNC_NAME" --project-ref "$PROJECT_REF" 2>> "$LOG_FILE"; then
    log "✓ supabase deploy OK: $FUNC_NAME"
    echo "$yeni_ozet" > "$ozet_dosya"
    bildirim_temizle token
    bildirim_temizle "deploy-$FUNC_NAME"
  else
    log "✗ supabase deploy FAILED: $FUNC_NAME"
    # Özet YAZILMAZ → bir sonraki değişiklikte tekrar denenir.
    bildir "deploy-$FUNC_NAME" "$FUNC_NAME deploy edilemedi — kod push'landı ama edge function ESKİ"
  fi
}

# ── Ana döngü ────────────────────────────────────────────────────────────────

log "=== auto-deploy başlatıldı ==="
[[ -f "$ENV_FILE" ]] || log "⚠ $ENV_FILE yok — edge function deploy'ları atlanacak"

# fswatch: değişen dosya yolunu satır satır alır
# --latency 3 → 3 saniye sessizlik sonrası tetikle (debounce)
#
# Hariç tutmalar (regex — tam yola uygulanır):
#   /\.git/   → eski "\.git" kalıbı `.gitignore`, `.github/` gibi GERÇEK dosyaları
#               da eliyordu; artık yalnız .git klasörü hariç.
#   \.tmp\.   → editörün atomik-kaydetme geçici dosyaları. Commit ve deploy
#               gürültüsünün asıl kaynağı bunlardı.
#   \.log$ / \.tsbuildinfo$ / \.swp$ / ~$ → türetilmiş dosyalar, olay üretmesin.
fswatch \
  --latency 3 \
  --recursive \
  --exclude "/\.git/" \
  --exclude "\.next" \
  --exclude "node_modules" \
  --exclude "\.tmp\." \
  --exclude "\.log$" \
  --exclude "\.tsbuildinfo$" \
  --exclude "\.swp$" \
  --exclude "~$" \
  --exclude "\.DS_Store" \
  "$PROJECT_DIR" | while read -r CHANGED_FILE; do

  log_rotate
  log "Değişiklik: $CHANGED_FILE"

  # 1) Her değişiklikte git push
  git_push

  # 2) supabase/functions/ altında değişiklik varsa ilgili fonksiyonu deploy et
  if [[ "$CHANGED_FILE" == "$FUNCTIONS_DIR"/* ]]; then
    FUNC="${CHANGED_FILE#"$FUNCTIONS_DIR"/}"
    FUNC="${FUNC%%/*}"
    if [[ -n "$FUNC" && "$FUNC" != "." ]]; then
      supabase_deploy "$FUNC"
    fi
  fi

done
