# Yükegel — Yapılacaklar

> 📋 **BU DOSYADA YALNIZ BEKLEYEN İŞ VAR.** Bir madde kapandığında buradan
> **SİLİNİR**; gerekçesi/olay kaydı `docs/ARSIV_YAPILACAKLAR.md`'ye, kalıcı dersi
> `docs/PROJE_HARITASI.md` §9 KURALLAR & TUZAKLAR'a yazılır.
>
> 🚨 **KURAL — kapanan maddeyi "✅" diye burada bırakma.** 10 Ağu 2026'da bu dosya
> 4.962 satıra çıkmıştı ve `⏳` işaretlerinin çoğu bayattı: iş kapanmış, satır
> kalmıştı. Listeye bakan **yapılmış işi yapılacak sanıyordu** — bu iki kez
> gerçekten oldu (#31 "hayalet engel", #91 "bayat DEPLOY BEKLİYOR"). Liste ancak
> kısa kaldığı sürece doğru kalır.
>
> ⚠️ **Bir maddeyi kapatmadan önce VERİYE bak, listeye değil.** "Yapıldı mı?"
> sorusunun cevabı görev listesinde değil, canlı DB'de / dosya sisteminde.
>
> Son doğrulama turu: **10 Ağu 2026** (aşağıdaki her madde o gün canlıya karşı
> sınandı; kapanmış olanlar silindi).

---

## 🟡 1 — Güvenli Etkileşim modülü: Faz 1-2 ekranları bitti, iki karar + Faz 3-4 bekliyor

Kaynak PRD: `doc/GuvenEtkilesim.docx` · plan `docs/20260810_guven_etkilesim_plan.sql`
Bugünkü veri: `deals` 0 satır, `reviews` 0 satır — **ekranlar 10 Ağu'da açıldı ve
uçtan uca tarayıcıda geçici test hesaplarıyla doğrulandı** (bkz.
`docs/ARSIV_YAPILACAKLAR.md`), ama henüz GERÇEK kullanıcı kullanımı yok.

### Faz 2'den kalanlar (ekran YOK'tu, artık VAR — bkz. `docs/ARSIV_YAPILACAKLAR.md`)
- **`listings.completed_at` ↔ `deals.completed_at` ilişkisi belirsiz.** İlki tek
  taraflı ("işi aldım" işareti), ikincisi çift teyitli. İkisi ayrışırsa hangisi
  doğru sayılacak — karar verilmemiş.
- **İletişim bilgisini eşleşmeye bağlama** (PRD md.4): `/api/ilan/[id]/telefon`
  şu an eşleşme aramadan numara veriyor. Ürün kararı — daraltmak ilan
  görünürlüğünü düşürür, o yüzden tek başıma yapmadım.

### Faz 3 — profil / rozet / güven puanı
✅ **"/u/[id] yayınlanmış yorumlar + ortalamalar" bitti (11 Ağu 2026)** —
`app/u/[username]/page.tsx`'e `DegerlendirmelerKarti` eklendi: RLS'in zaten
public'e açtığı yayınlanmış+gizlenmemiş yorumları ham gösteriyor (ortalama +
yıldız + yorumcu adı + rol bağlamı + metin), **hiçbir yeni skor İCAT
ETMİYOR**. Uçtan uca (tamamlanmış anlaşma → çift kör yayın → profil sayfası)
gerçek tarayıcıda doğrulandı, hem şirket hem nakliyeci profili doğru rol
etiketiyle göründü. Ayrıntı: `docs/ARSIV_YAPILACAKLAR.md`.
- Kullanıcı düzeyi güven puanı — **hâlâ yapılmadı, bilerek.** 🚨
  **`audit_score`'dan BAĞIMSIZ olacak.** O skorun "Kalite Skoru" olarak
  yayınlanması 10 Ağu'da kaldırıldı (kayıt: `docs/ARSIV_YAPILACAKLAR.md`); aynı
  hatayı güven puanında tekrarlamamak için sinyal SIFIRDAN tanımlanacak. Bu,
  yukarıdaki "yayınlanmış yorumlar" maddesinden FARKLI: o ham veri gösterimiydi
  (risk yok), bu bir FORMÜL/SKOR İCADI — hangi sinyallerin ne ağırlıkla
  sayılacağı ürün kararı, tek başına atılmayacak.
- Profil OG kartı — ilan kartı deseni hazır (`app/ilan/[id]/opengraph-image.tsx`).
  ⚠️ Satori `₺` (U+20BA) glifini basmıyor, tofu çıkıyor; orada `TL` yazıldı.

### Faz 4 — vade / escrow-light / tesis karnesi
- Ödeme vadesi cron'u (`deals.payment_maturity_date` yazılıyor, okuyan yok).
- "Ödemeyi yaptım / aldım" çift teyidi.
- Gecikme alarmı → moderatör paneli.
- **Tesis karnesi** — `poi_reviews` tablosu var ve **0 satır**, birebir uygun.

> 🚨 **FAZ 4 UYUYAN BİR HATAYI UYANDIRIR — birlikte düzeltilecek.**
> `update_poi_rating` (`poi_reviews` trigger'ı) RLS'li `pois`'e yazıyor ve
> `SECURITY DEFINER` **değil**; `pois`'te anon/authenticated için UPDATE
> politikası yok. Bugün zararsız çünkü `poi_reviews` 0 satır (`pois` 9.178).
> Tesis karnesi o tabloya ilk satırı yazdığı gün trigger **sessizce düşer.**

### PRD'nin bilinçli UYGULANMAYAN iki maddesi (yeniden açılmasın diye kayıtta)
- `quality_score += 50` — `audit_score` risk skoru olduğu için +50 ilanı
  **yayından düşürürdü.** Skor artık hiçbir yerde yayınlanmıyor; bu madde
  yeniden ele alınacaksa `quality_score` diye AYRI bir alan tanımlanmalı.
- 2 "ödeme gecikti" bildiriminde **otomatik shadow ban** — anlaşmalı iki hesap
  bunu silah olarak kullanır. Yerine moderatör kuyruğuna düşürülüyor.

---

## ⏳ 2 — Şirket ilişkisi + ilan detayında "diğer ilanlar"

Bayram'ın 9 Ağu talebi: *(1) kullanıcılar şirkete bağlı olabilsin, (2) ilan
detayında kullanıcının tüm ilanları ve şirketin tüm ilanları butonları olsun.*

- **Şimdi kurmak için doğru zaman:** `company_name` 108 kullanıcının **1'inde**
  dolu, yani taşınacak kirli veri yok.
- Şema: `companies` tablosu + `users.company_id`.
- ⚠️ **VKN hassas kolon.** `public.users` sızıntısının dersi burada geçerli:
  tablo geneline verilen `GRANT`, kolon bazlı `REVOKE`'u **ezer**. Migration
  önce tablo yetkisini alıp kolonları tek tek geri vermeli.
- 🔓 **KARAR GEREKİYOR:** şirkete bağlı kullanıcı, aynı şirketteki başkasının
  ilanını düzenleyebilir mi? Cevap RLS politikalarını **ve**
  `app/api/ilan/duzelt/route.ts`'teki `ilan.user_id !== user.id` sahiplik
  kontrolünü değiştirir.
- **"Diğer ilanlar" butonları:** kullanıcı tarafı artık sadece link eklemek —
  `/u/[username]` çalışıyor ve aktif ilanları listeliyor. Şirket tarafı yukarıdaki
  şemaya bağımlı. ⚠️ Buton **yalnız `user_id` doluysa** görünecek: ilanların
  **%99,95'i sahipsiz** (WhatsApp'tan geliyor), aksi hâlde her ilanda ölü buton olur.

---

## ⏳ 3 — Güvenlik takibi (7 Ağu'da açıldı)

- 🔴 **OTP doğrulama denemesinde kaba kuvvet koruması yok — sanılandan BÜYÜK
  bir açık.** (11 Ağu 2026'da kapsam netleşti.) `kotaDene`
  (`app/api/auth/otp/route.ts:70/78/90`) SMS **gönderimini** sınırlıyor; 6
  haneli kodu **deneme** sayısını sınırlayan bir şey yok. Asıl mesele bu
  maddenin ilk yazıldığından daha büyük: giriş akışının ASIL doğrulama çağrısı
  `app/giris/page.tsx:381` `supabase.auth.verifyOtp({ phone, token: otp, type:
  'sms' })`u **doğrudan istemciden**, hiçbir `kotaDene` katmanından geçmeden
  çağırıyor — `/api/auth/otp/route.ts` yalnız SMS GÖNDERİMİNİ kontrol ediyor,
  DOĞRULAMAYA hiç karışmıyor. Yani 6 haneli kodu deneme hızını sınırlayan
  TEK şey Supabase Auth'un kendi (bu kod tabanınca denetlenmemiş/bilinmeyen)
  iç davranışı. Aynı desen `app/api/ilan/[id]/sahiplen/route.ts` ve YENİ
  `app/api/auth/telefon-degistir/route.ts`de de var: ikisi de gönderim
  tarafında kota koyuyor ama `verifyOtp` çağrısının kendisinde deneme sayısı
  sınırı yok (ikisi en azından SUNUCUDA çalışıyor, `giris/page.tsx` gibi tümüyle
  istemcide değil — risk farklı katmanda ama var).
  ⚠️ **Neden bu turda dokunulmadı:** `giris/page.tsx`'teki düzeltme, giriş
  akışının ANA yolunu (client → server taşıma + oturum sonrası merge/is_active/
  redirect mantığının yeniden ele alınması) değiştirmeyi gerektiriyor — 8 Ağu'da
  tam bu tabloda ("`public.users`te 20+ yer atlandı") bir login kırılması
  yaşanmıştı. Bu ölçekte bir değişiklik ayrı, dikkatli bir tur ister; aceleye
  getirilmemeli.
- ⏳ **`app/api/auth/switch-account/route.ts` tutarlılık kontrolü hiç yapılmadı.**
  Implicit-flow izi arayan grep boş döndü, ama dosya elle okunmadı.
- 🟡 **`anon`/`authenticated` public şemadaki NEREDEYSE HER tabloda SELECT
  dışında her şeye (INSERT/UPDATE/DELETE/TRUNCATE) sahip — sistemik, tek
  tabloya özgü değil.** (11 Ağu 2026, `deals`/`reviews` incelenirken bulundu —
  ayrıntı `docs/ARSIV_YAPILACAKLAR.md`.) Supabase'in yeni tablo için varsayılan
  şema-geneli GRANT'ı; migration özel REVOKE yazmadıysa hep böyle gelir.
  `safety_rules`, `system_config`, `blacklist`, `pois`, `raw_posts`,
  `shadow_profiles` dahil taranan tabloların BÜYÜK ÇOĞUNLUĞU aynı desende.
  🚨 **Şu an sömürülebilir DEĞİL** — RLS açık ve INSERT/UPDATE/DELETE için
  policy yoksa Postgres varsayılanı REDDET; `deals`/`reviews` üzerinde bizzat
  denendi, hepsi reddedildi. Risk şu: RLS'in TEK savunma katmanı olması —
  gelecekte biri gevşek bir policy eklerse (`USING (true)` gibi) GRANT açık
  olduğu için o hata anında sömürülebilir hale gelir, ikinci bir engel yok.
  **Yapılacak iş:** her tabloyu tek tek gözden geçirip GERÇEKTEN istemciden
  yazılması gereken (varsa) hariç tümünde INSERT/UPDATE/DELETE/TRUNCATE'i
  `anon`/`authenticated`dan geri almak — `deals`/`reviews`de yapıldığı gibi
  (`docs/20260811_deals_reviews_grant_hardening.sql`). ⚠️ Tek bir migration'la
  YAPILMAMALI: `pois`/`poi_reviews`/`poi_visit_logs`/`archived_links`/`vehicles`
  gibi bazı tablolarda GERÇEKTEN INSERT/UPDATE policy'si VAR (istemci meşru
  olarak yazıyor) — o kolonlar/tablolar için REVOKE yanlış olur. Her tablo
  önce "istemci buraya meşru olarak yazıyor mu?" sorusuyla tek tek
  sınıflandırılmalı, sonra yalnız "yazmaması gereken" grup için REVOKE
  yazılmalı. Geniş kapsamlı, dikkatli bir tur ister.

---

## ⏳ 4 — Küçük ama gerçek açıklar

- **Kaba dil kuralı yanlış pozitif üretebilir.** `safety_rules`'taki kaba dil
  kuralı (40 puan) `mal` kelimesini yakalıyor; nakliyede "mal" = **yük**, tamamen
  meşru. Kural 10 Ağu'ya kadar JavaScript'te hiç çalışmıyordu, **artık çalışıyor**
  → gözden geçirilecek. Bekçi: `npm run test:safety-rules`.
- **E-posta bildirim altyapısı YOK.** `lib/` altında mail/resend/bildirim modülü
  yok. İlan süresi dolunca, iş onaylandığında, durum değişince bildirim
  gönderilemiyor. Faz 4'ün gecikme alarmı da buna dayanacak.
- **Gizlilik Politikası ayrı sayfası yok.** `app/kullanim-kosullari` ve `app/kvkk`
  var; "Gizlilik" yalnız kullanım koşulları metninin içinde geçiyor.
- **W5 alias runbook Adım 3, 4, 6** (ilçe yazım birleştirme, NULL ilçe, elle
  kararlar) hâlâ açık. Önemi arttı: coğrafi geçiş `origin_city` ve
  `listing_stops.city`'yi düşürdü, **ilçe sistemde kalan tek metin konum alanı.**
  Adım 0.3 ölçümü de bunu söylüyordu: 16 çakışma grubunun **14'ü ilçe kolonunda.**
  Detay: `docs/20260729_alias_runbook.md`.

---

## ⏳ 5 — Trafik bekleyen ölçümler (kod tarafı bitti, örneklem yok)

Bunlar "yapılacak iş" değil, **doğrulanacak iddia**. Üçü de canlı trafik gerektiriyor.

- **#65 / `parse_listing_gonder` süresi** — beklenti: çağrı 150 sn duvarından
  milisaniyelere düşer ve yeni `pending` birikmesi durur. **Beklenti, ölçüm değil.**
  ⚠️ Mevcut 7.896 satırlık yığın **kendi kendine erimez**; ayrı kurtarma işi
  gerekir ve bunların **2.203'ünün ilanı ZATEN var** — yeniden işlenirse çift
  ilan doğar (bkz. #90: `parse_listing_gonder` idempotent DEĞİL).
- **`ilan_olustur` v4 kazancı** — `pg_stat_statements` 5 Ağu'da sıfırlandı.
  Karşılaştırma tabanı: ort **1.400,3 ms** / en kötü 28.939,6 ms.
  Beklenti birkaç yüz ms — **beklenti, iddia değil.**
- **`/yol-rehberi` → "Yakınımdaki Yükler" duman testi** — konum izniyle sonuç
  veriyor mu, `dest_city` dolu mu (elle, tarayıcıda).

📌 **Bir gözlem:** platformda şu an **1 aktif ilan** var. Bu bir bug değil
(`expire-active-listings` 15 dakikada bir süresi geçeni düşürüyor) ama WhatsApp
beslemesi son günlerde ilan üretmemiş görünüyor — ana sayfa akışı ona bağlı.
Ölçüm yapacaksan önce beslemenin çalıştığını doğrula.

---

## 👤 6 — Bayram'da (kod/SQL ile yapılamaz)

- ⏳ **Search Console "Robots.txt ile engellendi" — SIRA ÖNEMLİ.**
  Asıl kök sebep 10 Ağu'da bulundu: `Disallow: /giris` ile `noindex` birbirini
  yok ediyordu (ayrıntı: `docs/ARSIV_YAPILACAKLAR.md`). Düzeltme kodda hazır.
  ✅ **Deploy YAPILDI ve canlıdan doğrulandı (10 Ağu 2026, `3d2ceb8`):**
  canlı `robots.txt`te `Disallow: /giris` **yok**, dört blokta
  `Allow: /api/ilanlar/` **var**; Bayram'ın verdiği URL **HTTP 200** dönüyor ve
  `<meta name="robots" content="noindex, follow">` taşıyor — yani zincir çalışıyor,
  Google artık etiketi okuyabilir. İlan sayfasındaki bağlantıda `rel="nofollow"` var.

  ✅ **"Düzeltmeyi doğrula"ya basıldı — 10 Ağu 2026, "Doğrulama Başladı."**
  ⏳ **Şimdi beklemede ve yapılacak bir şey yok.** Google URL'leri yeniden
  taramak zorunda; doğrulama **günler sürer** ve bu normaldir.
  ⚠️ Bu kez geçmesi gerekiyor çünkü URL artık taranabilir (canlıdan doğrulandı:
  HTTP 200 + `noindex, follow`). **Eğer "Başarısız" derse** bu YENİ bir bulgudur —
  o zaman rapordaki örnek URL'leri getir, birlikte bakarız.
  📌 Sonra o URL'ler **"noindex ile hariç tutuldu"** durumuna geçecek — bu
  **doğru** son durum, yeni bir hata değil. "Engellendi"den "hariç tutuldu"ya
  geçiş düzeltmenin ta kendisi.
  ⚠️ Rapordaki URL'lerin `/giris?redirect=…` olduğunu teyit et; başka bir yol
  çıkarsa ayrı bir bulgudur, haber ver.
- 🔒 **6 EYLÜL 2026'DAN ÖNCE SİLİNMEYECEK — Dalga 5 yedek tabloları.**
  `public.dalga5_yedek_20260806` (14 MB, 234.840 satır) ve
  `public.dalga5_yedek_stops_20260806` (18 MB, 245.086 satır) — coğrafi geçişin
  son geri dönüş yolu. 7 Ağu'da "geçiş bittiyse temizle" istendi, retention
  hatırlatıldı, **Bayram: "Bekleyelim, listede dursun."** İki kez teyitli.
  O tarihten sonra tek kontrol: geçen 30 günde bu tablolara bakan sorgu/rapor
  oldu mu — olmadıysa temiz silinir.

---

## 📌 Bilinçli kapatılan, yeniden açılmayacak maddeler

Bunlar "unutuldu" değil, **karar**. Biri "bu neden düzeltilmemiş?" diye sorarsa
cevap burada.

- **#52 — 5 Orhanlı ilanının yanlış `origin_province_id = 54`'ü onarılmadı.**
  Bayram'ın 4 Ağu kararı: *"geçmiş veriler artık eskidi."*
- **#90 — `parse_listing_gonder` idempotent değil.** İncelendi, ölçüldü,
  yapılmadı. **Geriye dönük yeniden parse YAPMAYIN — kopya ilan üretir.**
- **#87 `contextFrom` / ok-tire davranışı** — `parse-listing/index.ts:741` ve
  `:795` üzerindeki `#92` yorumları uyarıyor: **kapıyı geri alma.** Geri alınırsa
  198 bozuk şerit geri gelir.
