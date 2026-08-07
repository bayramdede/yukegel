# Blockers — ilerlemeyi tıkayan, Bayram'ın kararı/eli gereken maddeler

> Format: madde · neden ilerlenemiyor · ne zaman kapanır.

## 🔴 #92 deploy — parse-listing hâlâ v89, düzeltme sahada değil
- **Durum (7 Ağu 2026, doğrulandı):** `list_edge_functions` → `parse-listing` hâlâ
  **v89**, `updated_at = 2026-08-07 05:41:56 UTC` — #92 düzeltmesini içeren commit
  `78cc902` (08:18 UTC) bu deploy'dan **2.5 saat sonra** yazıldı. Düzeltme commit
  edilmiş ve push edilmiş ama **deploy edilmemiş**.
- **Neden bu ortamdan yapılamıyor:** `deploy_edge_function` (MCP) 58 KB'lık Türkçe-
  diakritik + emoji yoğun kodu elle yeniden yazmayı gerektiriyor; #89 notunda bu
  yüzden reddedilmişti (geri alınamaz bir hata riski). CLI (`supabase functions
  deploy`) burada mevcut değil.
- **Ne yapılmalı (Bayram):** `supabase functions deploy parse-listing`
- **Sonra:** `npm run olc:87` tekrar — iki kapı: `≥1→0` KAYIP = 0 **ve** `yeni`
  satırında KENDİNE ŞERİT = 0.

---

## ✅ KAPANDI — git commit → push zinciri
- `.next-dogrulama/` takipten düştü (`e8bb862`), iki eksik `.xlsx` takipten
  düştü + doküman güncellemeleri (`03f0b6a`). **Push başarılı** — `main` artık
  `origin/main` ile birebir aynı.
- 📌 **Ortam notu — önceki oturumların "sandbox" varsayımı burada geçersiz:**
  bu oturumda `rm -f .git/*.lock` ve `git push` **doğrudan çalıştı**, önceki
  kayıtlardaki "FUSE izin vermiyor" / "push için kimlik yok" kısıtları burada
  yoktu. Yani kısıt evrensel değil, **çalıştırıldığı ortama bağlı** — bir daha
  "sandbox'ta X imkânsız" yazmadan önce o oturumda gerçekten dene.

## ✅ KAPANDI — iki `.xlsx` takipten düşürüldü
- Bayram onayı: "temizle". `Freelancer_Veri_Giris_Sablonu.xlsx` ve
  `kofteci_yusuf_subeler.xlsx` `git rm` edildi, commit `03f0b6a` ile gitti.

## ✅ KAPANDI — `.rmtest`
- Dosya zaten yoktu (önceki oturumdan kalma değil ya da bu arada temizlenmiş).
  Bayram onayı alındı, kontrol edildi, yapılacak iş kalmadı.
