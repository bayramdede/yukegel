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
# 🔴 İLK ÇÖZÜM YETMEDİ (aynı gün, 19:00). `vercel.json → ignoreCommand` build'i
# atlıyordu ama DEPLOYMENT yine oluşuyordu ("Canceled" satırlar) — ve Vercel'in
# KAYAN 24 SAATTE 100 DEPLOYMENT kotası Canceled'ları da sayıyor. 24 saatte 266
# commit push'lanınca kota bitti; Vercel artık hiçbir deployment oluşturmuyordu,
# `deploy:` commit'i de dahil. Dashboard'da hiçbir kayıt yok, hata da yok — push
# başarılı görünüyor, site güncellenmiyor. Sessiz arıza.
#
# GERÇEK ÇÖZÜM: daemon artık `main`'e değil `yedek` dalına push ediyor
# (`scripts/auto-deploy.sh`), `vercel.json → git.deploymentEnabled.yedek = false`
# de o dal için deployment OLUŞTURULMASINI engelliyor. Kota harcanmıyor.
# `ignoreCommand` ikinci katman olarak duruyor: bu script `main`'e push ederken
# yanındaki `auto:` commit'leri de taşır, HEAD `deploy:` olduğu için build 1 kez olur.
#
# Bu script `main`'e giden TEK kapıdır.
#
# 🚨 Yeni bir deploy yolu ekleme — özellikle daemon'ı `main`'e geri döndürme.
#    Dönersen kota gün içinde biter ve deploy edemez hale gelirsin.

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
