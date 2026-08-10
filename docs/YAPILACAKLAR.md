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

## 🟢 1 — #92 `Ş.İçi` istisnası (düşük öncelik — KARAR VERİLMİŞ, yeniden tartışılmayacak)

> ✅ **Bayram'ın kararı (bkz. `docs/PROJE_HARITASI.md`:386): "v90 kalıyor."**
> 163 yanlış kendine-şeride karşı 1 gerçek + 2 kabul edilebilir kayıp; net kazanç
> pozitif. **"Ş.İçi" istisnası düşük öncelikli backlog maddesi.** Aşağıdaki tablo
> o kararın dayanağıdır — kararı yeniden açmak için değil, istisnayı yazacak kişi
> hangi vakayı kurtaracağını bilsin diye duruyor.

`KAYIP = 3` satırın üçü elle okundu (dosyanın kendi kuralı: örnekleri elle oku):

| satır | eski şerit | yeni | hüküm |
|---|---|---|---|
| `4aadf724` `ANKARA -> ANKARA Ş.İÇİ` | `Ankara/→Ankara/` | (yok) | 🚨 **GERİLEME** — meşru şehir içi iş |
| `59169e5a` Mersin → Rusya | `Mersin/→Mersin/` | (yok) | ✅ doğru temizlik (yurt dışı varış temsil edilemiyor) |
| `d7d6edda` Mersin → Rusya | `Mersin/→Mersin/` | (yok) | ✅ doğru temizlik |

Düzeltme **aynı il** şeritlerini toptan reddediyor; `Ş.İÇİ` / `ŞEHİR İÇİ` meşru
bir taşıma sınıfı ve onunla birlikte düşüyor.

**Hacim ölçüldü ve kararı destekliyor:** son 30 günde **34.112 ilanın 3'ü**
(%0,01) şehir içi kalıbı taşıyor. Yazılacak istisna: `kendineSerit` kontrolüne
"satırda şehir içi ibaresi varsa aynı il şeridine izin ver".

📌 **Ölçüm altyapısı hazır ve artık güvenilir:** `npm run olc:87` tabanı v91'e
taşındı ve `BEYAN_EDILEN` bekçisiyle korunuyor. İstisnayı yazınca `geri92*`
teşhis satırları kazancı, `KAYIP` sütunu da bedeli doğrudan gösterecek.

---

## 🟡 2 — Güvenli Etkileşim modülü: Faz 1-2 bitti, Faz 3-4 bekliyor

Kaynak PRD: `doc/GuvenEtkilesim.docx` · plan `docs/20260810_guven_etkilesim_plan.sql`
Bugünkü veri: `deals` 0 satır, `reviews` 0 satır (modül henüz kullanılmadı).

### Faz 2'den kalanlar
- **Panel arayüzü** — `deals` aksiyon butonları (anlaş / onayla / yola çıktı /
  tamamla) ve değerlendirme formu. API'ler hazır ve 22/22 test geçiyor, **ekran yok.**
- **`listings.completed_at` ↔ `deals.completed_at` ilişkisi belirsiz.** İlki tek
  taraflı ("işi aldım" işareti), ikincisi çift teyitli. İkisi ayrışırsa hangisi
  doğru sayılacak — karar verilmemiş.
- **İletişim bilgisini eşleşmeye bağlama** (PRD md.4): `/api/ilan/[id]/telefon`
  şu an eşleşme aramadan numara veriyor. Ürün kararı — daraltmak ilan
  görünürlüğünü düşürür, o yüzden tek başıma yapmadım.

### Faz 3 — profil / rozet / güven puanı
- Kullanıcı düzeyi güven puanı. 🚨 **`audit_score`'dan BAĞIMSIZ olacak.** O skorun "Kalite Skoru" olarak
  yayınlanması 10 Ağu'da kaldırıldı (kayıt: `docs/ARSIV_YAPILACAKLAR.md`); aynı
  hatayı güven puanında tekrarlamamak için sinyal SIFIRDAN tanımlanacak.
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

## ⏳ 3 — Şirket ilişkisi + ilan detayında "diğer ilanlar"

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

## ⏳ 4 — Güvenlik takibi (7 Ağu'da açıldı, 10 Ağu'da hâlâ açık)

- 🔴 **`phone_verified` istemciden yazılabiliyor** — `app/panel/PanelClient.tsx:961`
  doğrudan `supabase.from('users').update({ phone: yeniTel, phone_verified: true })`
  çağırıyor. Kullanıcı "doğrulanmış telefon" rozetini **kendine verebilir**.
  Doğrulama sunucu tarafına taşınacak (OTP'yi kim doğruladıysa o yazsın).
- 🔴 **OTP doğrulama denemesinde kaba kuvvet koruması yok.** `kotaDene`
  (`app/api/auth/otp/route.ts:70/78/90`) SMS **gönderimini** sınırlıyor;
  6 haneli kodu **deneme** sayısını sınırlayan bir şey yok.
- 🟡 **`auth_leaked_password_protection` kapalı** — yalnız Supabase Dashboard'dan
  açılabiliyor, kod/SQL ile yapılamaz → **Bayram'da** (madde 7).
- ⏳ **`app/api/auth/switch-account/route.ts` tutarlılık kontrolü hiç yapılmadı.**
  Implicit-flow izi arayan grep boş döndü, ama dosya elle okunmadı.

---

## ⏳ 5 — Küçük ama gerçek açıklar

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

## ⏳ 6 — Trafik bekleyen ölçümler (kod tarafı bitti, örneklem yok)

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

## 👤 7 — Bayram'da (kod/SQL ile yapılamaz)

- ⏳ **`auth_leaked_password_protection`** — Supabase Dashboard → Authentication →
  Password. Sızmış parola kontrolü kapalı.
- ⏳ **Google Search Console → Rich Results Test.** Son durumda "1 geçerli öğe
  algılandı" (BreadcrumbList) alındı. `Service` şeması Google'ın zengin sonuç
  listesinde **yok** — o yüzden onun görünmemesi normal, arıza değil.
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
