#!/bin/bash
# ─────────────────────────────────────────────
#  Yükegel — ELLE DEPLOY
#  Kullanım:  npm run deploy
#             npm run deploy -- "telefon alanı düzeltildi"
# ─────────────────────────────────────────────
#
# 29 Tem 2026 — NEDEN VAR.
# `scripts/auto-deploy.sh` her dosya kaydetmesinde commit + push atıyor; Vercel de
# `main`'e giden HER push'ta build ediyordu. Sonuç: günde ~79 deploy (Hobby limiti
# 100/gün) ve YARIM kod canlıda. 17:47'deki "TelefonDurumu is not assignable"
# hatası bunun ders niteliğinde örneği: daemon `actions.ts`'i push etmiş,
# `page.tsx`'i henüz commit'lememişti — canlı build, var olmayan bir ara halde
# derlenmeye çalıştı.
#
# `vercel.json` → `ignoreCommand` artık commit mesajı `auto:` ile başlıyorsa
# build'i ATLIYOR. Yani daemon push'lamaya devam eder (kod GitHub'da yedekli
# durur) ama canlı site değişmez. Bu script, mesajı `auto:` ile BAŞLAMAYAN bir
# commit atarak Vercel'i bilerek tetikleyen tek kapıdır.
#
# 🚨 Yeni bir deploy yolu ekleme. Eklersen `ignoreCommand` sessizce devre dışı
#    kalır ve günde 79 deploy'a geri döneriz.

set -uo pipefail

PROJE="/Users/bayramdede/yukegel"
cd "$PROJE" || { echo "✗ $PROJE bulunamadı"; exit 1; }

MESAJ="${*:-elle deploy}"

echo ""
echo "🚀 Yükegel deploy"
echo "─────────────────────────────────────────"

# ── 1) Daemon'la çakışma ─────────────────────────────────────────────────────
# `auto-deploy.sh` aynı anda commit atıyorsa `.git/index.lock` vardır. Beklemek,
# "Unable to create index.lock" ile yarıda kalmaktan iyidir.
for i in {1..15}; do
  [[ -e "$PROJE/.git/index.lock" ]] || break
  [[ $i == 1 ]] && echo "⏳ Otomatik commit çalışıyor, bekleniyor…"
  sleep 1
done
if [[ -e "$PROJE/.git/index.lock" ]]; then
  echo "✗ .git/index.lock 15 sn'dir duruyor. Takılı kalmış olabilir:"
  echo "  rm -f $PROJE/.git/index.lock"
  exit 1
fi

# ── 2) Tip kontrolü ──────────────────────────────────────────────────────────
# Vercel'de patlayacak bir build'i buraya çekiyoruz. Deploy kotası harcanmıyor,
# hatayı 2 dakika sonra e-postadan değil hemen burada görüyorsun.
echo "🔍 TypeScript kontrol ediliyor…"
if ! npx tsc --noEmit; then
  echo ""
  echo "✗ Tip hatası var — deploy DURDURULDU. Yukarıdaki hataları düzeltip tekrar dene."
  exit 1
fi
echo "✓ Tipler temiz"

# ── 3) Commit ────────────────────────────────────────────────────────────────
git add -A

if git diff --cached --quiet; then
  # Değişiklikleri daemon zaten commit'lemiş. Vercel'i tetiklemek için mesajı
  # `auto:` ile BAŞLAMAYAN boş bir commit yeterli.
  echo "ℹ Yeni değişiklik yok (daemon commit'lemiş) — deploy commit'i atılıyor"
  git commit --allow-empty -m "deploy: $MESAJ" --quiet || { echo "✗ commit başarısız"; exit 1; }
else
  git commit -m "deploy: $MESAJ" --quiet || { echo "✗ commit başarısız"; exit 1; }
fi
echo "✓ Commit: deploy: $MESAJ"

# ── 4) Push ──────────────────────────────────────────────────────────────────
if ! git push --quiet; then
  echo "… push reddedildi, rebase ile tekrar deneniyor"
  if ! (git pull --rebase --quiet && git push --quiet); then
    echo "✗ git push başarısız. Elle bak: git status"
    exit 1
  fi
fi

echo "✓ GitHub'a gönderildi"
echo ""
echo "🟢 Vercel build başladı. 1-2 dakika sürer."
echo "   İzle: https://vercel.com/dashboard"
echo ""
