# Blockers — ilerlemeyi tıkayan, Bayram'ın kararı/eli gereken maddeler

> Format: madde · neden ilerlenemiyor · ne zaman kapanır.

## 🔴 #92 deploy SONRASI olc:87 — KENDİNE ŞERİT kapısı geçti, KAYIP kapısı GEÇMEDİ
- **Deploy oldu:** `supabase functions deploy parse-listing` bu makineden
  çalıştırıldı (CLI mevcutmuş, `deploy_edge_function` MCP'ye hiç gerek kalmadı).
  `list_edge_functions` → **v90 ACTIVE**, `updated_at 2026-08-07 12:51:38 UTC`.
  `git diff origin/main -- supabase/functions/parse-listing/index.ts` boş —
  deploy edilen baytlar = commit `78cc902` = bu ağaç.
- **`npm run olc:87` canlıya karşı koşuldu (10.126 satır, son 30 gün):**
  - ✅ **KENDİNE ŞERİT** `yeni` satırında **0** (canlıda 163 vardı) — #92 düzeltmesi
    çalışıyor.
  - 🚨 **KAYIP (`≥1→0`) = 3** — kapı gereği 0 olması gerekiyordu, değil.
- **3 KAYIP satırın hepsi elle okundu:**
  1. `4aadf724` — `"ANKARA -> ANKARA Ş.İÇİ"` (şehir içi taşıma). Eski: `Ankara→Ankara`
     (gerçek bir iş — Ş.İÇİ = aynı şehir içi sevkiyat, kendine şerit BUG değil).
     Yeni: **(yok)**. Bu, düzeltmenin **meşru bir aynı-il vakasını** kurban etmesi.
  2-3. `d7d6edda`, `59169e5a` — Mersin/Esenyurt → **Rusya** (St. Petersburg /
     Ivanovo / Rostov). Sistem yalnız 81 ilin id'sini biliyor, yurt dışı hedef
     zaten çözülemiyordu; eski kod bunu yanlışlıkla `Mersin→Mersin`e düşürüyordu
     (asıl kendine-şerit bug'ı), yeni kod doğru şekilde reddediyor ve **0 şerit**
     bırakıyor. Bunlar muhtemelen kabul edilebilir — yurt dışı hedefi olan satırın
     zaten temsil edilecek bir il çifti yok.
- **Karar gereken tek nokta:** `Ankara Ş.İçi` gibi **aynı il içi meşru** işleri
  KENDİNE ŞERİT korumasından muaf tutmak gerekiyor mu (ör. metinde "Ş.İÇİ/şehir
  içi" geçiyorsa istisna)? 30 günde bu kalıptan yalnız 1 örnek var, ama örneklem
  küçük diye kural yanlış olmayabilir.
- **Ne yapılmalı:** Bayram karar versin — (a) v90 kalsın, "Ş.İçi" istisnası ayrı
  bir küçük düzeltme olarak sıraya girsin, ya da (b) v90 geri alınsın. (a) daha
  olası doğru: v89'daki 163 yanlış kendine-şeride karşı 1 gerçek kayıp, net kazanç
  hâlâ pozitif — ama bu benim kararım değil, **veriyi görmeden karar verilmiş
  olmasın** diye buraya yazdım.

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
