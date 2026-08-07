# Blockers — sandbox ilerleyemiyor, Bayram'ın kararı/eli gerekiyor

> Format: madde · neden sandbox'ta yapılamıyor · ne zaman kapanır.

## 🔴 #92 deploy — parse-listing hâlâ v89, düzeltme sahada değil
- **Durum (7 Ağu 2026, doğrulandı):** `list_edge_functions` → `parse-listing` hâlâ
  **v89**, `updated_at = 2026-08-07 05:41:56 UTC` — #92 düzeltmesini içeren commit
  `78cc902` (08:18 UTC) bu deploy'dan **2.5 saat sonra** yazıldı. Yani düzeltme
  commit edilmiş ve push edilmiş (`git diff origin/main -- supabase/functions/parse-listing/index.ts`
  boş) ama **deploy edilmemiş**.
- **Neden sandbox yapamıyor:** `deploy_edge_function` 58 KB'lık Türkçe-diakritik +
  emoji yoğun kodu elle yeniden yazmayı gerektiriyor; #89 notunda bu yüzden
  reddedilmişti (geri alınamaz bir hata riski).
- **Ne yapılmalı (Bayram):** `supabase functions deploy parse-listing`
- **Sonra:** `npm run olc:87` tekrar — iki kapı: `≥1→0` KAYIP = 0 **ve** `yeni`
  satırında KENDİNE ŞERİT = 0.

## 🟡 git commit → push zinciri, tek atışlık
- Sandbox'ta bekleyen değişiklikler var: `.next-dogrulama/` içindeki ~1218
  dosyanın git takibinden düşürülmesi (fiziksel olarak zaten silinmiş, disk
  temiz) + `CLAUDE.md` ve `docs/YAPILACAKLAR.md`'deki küçük doküman güncellemeleri.
- **Neden sandbox yapamıyor:** `.git/HEAD.lock` bayat kilidi commit sonrası
  temizlenemiyor (`rm` sandbox'ta `Operation not permitted` veriyor) → ikinci
  commit denemesi `cannot lock ref 'HEAD'` ile düşer. Oturum başına en fazla bir
  commit güvenli; onu da kullanıcıya sormadan harcamamak için bekletiliyor.
- **Ne yapılmalı (Bayram, ya da onay verirsen ben):** `git add -A && git commit`
  ardından `rm -f .git/*.lock`, sonra `git push`.
- **7 Ağu, güncelleme:** commit atıldı (bu satırı içeren commit). `.next-dogrulama/`
  takipten düştü. Kilitleri temizleme + push hâlâ Bayram'da.

## 🟡 İki `.xlsx` diskten silinmiş — takipten de düşürülsün mü?
- `Freelancer_Veri_Giris_Sablonu.xlsx` ve `kofteci_yusuf_subeler.xlsx` depo kökünde
  **takipli** ama artık diskte yok. Temizlik sırasında bilerek mi silindiler,
  yoksa `.next-dogrulama` süpürmesine mi takıldılar — bilmiyorum.
- **Neden sandbox karar veremiyor:** ikisi de build çıktısı değil, veri dosyası.
  Silmeyi commit'lemek geçmişte kalır (geri alınabilir) ama yine de bir karar.
- **Ne yapılmalı (Bayram):** kasıtlıysa `git rm --cached` + commit; değilse
  `git checkout -- <dosya>` ile geri getir. O güne kadar `git status` kirli kalır.

## 🟢 `.rmtest` — sandbox'ın bıraktığı çöp
- FUSE'un `rm`'e hâlâ izin verip vermediğini ölçmek için oluşturuldu; ölçüm
  sonucu **hayır**, dolayısıyla silinemedi. İşlevi yok.
- **Ne yapılmalı (Bayram):** `rm -f .rmtest`
