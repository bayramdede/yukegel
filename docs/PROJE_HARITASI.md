# Yükegel — Proje Haritası
> **Kullanım:** Her sohbet başında sadece bu dosyayı oku. Kaynak dosyaları sadece o dosyada değişiklik yapacaksan oku.  
>
> ✅ **8 AĞU 2026 — İlanlarım'da ilan düzenleme açıldı.** `POST /api/ilan/duzelt`
> eskiden yalnız `correction_needed` kabul ediyordu; artık `pending`/`approved`/
> `auto_published` da düzenlenebiliyor (`rejected` + `archived` + `completed_at`
> dolu olanlar 400 ile kesiliyor). Fiyat/pazarlık + tarih/esneklik alanları
> eklendi; güzergâh-durak düzenleme bilerek YOK (durak sil+yeniden-yaz gerektirir,
> moderatör RPC'sinin işi). **3 bug bulundu:** panel SELECT'inde
> `price_negotiable`+`date_flexible` yoktu (form onları `false` sanıp gerçek
> değeri eziyordu), `vehicle_type`/`body_type` beyaz listesiz yazılıyordu, ve
> temiz düzenleme kullanıcının "Pasif Yap" kararını `active` yazarak eziyordu.
> Doğrulama: `npm run test:ilan-duzelt` — 22/22, gerçek HTTP + gerçek oturum
> çerezi, geçici kullanıcı sonunda siliniyor. Ayrıntı: `docs/YAPILACAKLAR.md` başı.
>
> ✅ **8 AĞU 2026 — Mobil header taşması düzeltildi (yatay kaydırma).** Navbar
> tek satır `height:56` + wrap/ellipsis kuralı yoktu; 375px'te `scrollWidth=668`
> ölçüldü (aksiyon grubu ekranın 156px dışında). Mobilde iki satıra ayrıldı
> (2. satır ikincil linkler, yatay kaydırılabilir — gizlenmiyor).
> 🚨 **Yan etki:** filtre barının `sticky top:56` sabiti navbar iki satıra
> çıkınca yalan oluyordu; media query başına sabit yazmak da yetmedi (içeriğe
> bağlı — 320px'de 151px, 768px'te uzun şirket adıyla 113px ölçüldü). Artık
> **ResizeObserver `--yk-nav-h`'yi ölçüyor**, CSS sabitleri yalnız fallback.
> Aynı sınıf `u/[username]` navbar'ında da kapatıldı. `overflow-x:hidden`
> bilerek kullanılmadı (sticky'yi bozar, sebebi gizler).
> Playwright ile 8 genişlikte doğrulandı. Ayrıntı: `docs/YAPILACAKLAR.md` başı.
>
> ✅ **8 AĞU 2026 — Coğrafi standart POI tarafına da uygulandı.** `pois` hiçbir
> dalgaya dahil değildi; artık `province_id` (smallint FK) + `district_official`
> var. Kapsama **%99,96**, resmî ilçe **4.951 → 8.765**. İlçelerin %46'sı
> "serbest" görünüyordu ama %89'u Google Places kaynaklı üç mekanik kalıptı
> (`"<İl> Merkez"`, U+0307 bulaşması, ilçe=il adı). Kalan 402 bilinçli: büyükşehir
> `"<İl> Merkez"`leri — `Merkez` orada resmî ilçe değil, çözücü TAHMİN ETMİYOR.
> Yeni tek kapı `lib/poi-lokasyon.ts::poiKonumCoz()` (5 yazma yolu + 2 form).
> 🚨 `il_key()`e dokunulmadı (3 fonksiyonel indeks ona bağlı) — hoşgörü ayrı
> `ilce_key()`de. Senkron kopya riski `npm run test:poi-senkron` ile teste
> bağlandı. Ayrıntı: `docs/20260808_poi_cografi_standart.sql`.
>
> ✅ **8 AĞU 2026 — İl comboboxları alfabetik + ilçe artık gerçekten seçenekli.**
> Bayram'ın şikâyeti haklıydı: `COGRAFI_GECIS.md`'nin "Searchable Select"
> sözü (spec md.7) hiç uygulanmamıştı, ilçe alanları sıfır önerili düz metindi;
> il comboboxlarının da RadarClient hariç hepsi plaka sırasındaydı. Yeni
> paylaşılan `app/_components/IlceGirisi.tsx` (`<input list>`+`<datalist>`,
> `ilceler()`'den besleniyor, serbest yazıma kapalı değil) 4 listing-formu
> alanına + 3 alias-editörü alanına bağlandı; `lib/lokasyon.ts`'e yeni
> `ILLER_TAM_ALFABETIK` (id'yi koruyan alfabetik liste) eklendi çünkü
> `HomeClient`'ın dropdown'u değeri `index+1`'den türetiyordu. 6 dosya, 11
> combobox alfabetikleştirildi. POI'lerin kendi şehir/ilçe alanı bilinçli
> olarak kapsam dışı (farklı sistem, coğrafi standardizasyona hiç girmedi).
> `tsc`/`test:lokasyon`/`test:districts`/`next build` temiz. Ayrıntı:
> `docs/20260808_il_ilce_combobox.sql`.
>
> ✅ **8 AĞU 2026 — Öğrenme Merkezi (`/admin/ogrenme-merkezi`) incelendi, 3 bug
> düzeltildi:** GET no_lane'de ikinci sorgunun hatası okunmuyordu (backlog
> sayısını yanlış raporlardı), `discover`'da aynı DB yazması kopyala-yapıştırla
> iki kez atılıyordu, toplu-onayla sıralı N ayrı `fetch` + sonuçsuz hataydı →
> 5'li paralel batch + başarısız raporu. Ayrıca `raw_posts`/`aliases`'ın çok
> geniş `anon`/`authenticated` GRANT'ı kontrol edildi — RLS enabled+sıfır
> policy olduğu için (Postgres'te "kimseye hiçbir satır" demek) canlıda
> doğrulanarak SORUN OLMADIĞI kanıtlandı, ek işlem gerekmedi. Ayrıntı:
> `docs/YAPILACAKLAR.md` başı.
>
> 🔴 **8 AĞU 2026 — İkinci PII/iç-veri sızıntısı: `listings.internal_audit_logs`.**
> `public.users` olayıyla AYNI hata sınıfı (satır RLS `using(true)` + dar
> olmayan kolon GRANT'ı) `listings`te de vardı: anti-spam motorunun
> `fired_rules`/`thresholds` (`reject_min`, `auto_publish_max`) alanları
> `anon`+`authenticated`'a açıktı — kayıtsız herkes ham PostgREST çağrısıyla
> motorun tam eşiklerini okuyabiliyordu (canlıda doğrulandı). Kolon revoke
> edildi (`audit_score` yalnız `anon`'dan — `authenticated` moderatör
> panelinin WHERE filtresi için kaldı); panel tarafı SPRINT_01 L1e'nin
> (`contact_phone`) deseniyle yeni `ilanAuditGetir()` server action'ına
> (`requireStaff` + service role) taşındı. Bu kez TÜM tüketiciler grep'lenip
> tek tek doğrulandı (7-8 Ağu'nun "eksik tarama" dersi baştan uygulandı) —
> hiçbiri kırılmadı. Ayrıntı: `docs/20260808_listings_audit_kolon.sql`.
>
> ✅ **8 AĞU 2026 — Moderatör paneli backlog'u kapandı (4/4).** `user_id` eksikti
> (`getIlanlar()` seçmiyordu, "ilan sahibi" paneli muhtemelen hiç çalışmamıştı)
> → eklendi. no_lane düzenleme state'i (`'no_lane_'+id` string-prefix hilesi)
> ayrı `noLaneDuzenleId`'ye alındı. Filtre/sıralama `useMemo`'ya taşındı (200
> satır artık her tuş vuruşunda yeniden hesaplanmıyor). `duzenleKaydet`'in N+1
> yazma deseni yeni **`moderator_ilan_duzenle` RPC**'sine taşındı (tek
> transaction, `SECURITY DEFINER` + kendi rol kontrolü) — bu arada ikinci bir
> bug da bulundu ve kapandı: eski kod formda silinen bir durağı DB'de hiç
> silmiyordu (yalnız update/insert biliyordu, delete yoktu). Doğrulandı
> (`ROLLBACK`lı gerçek çağrı: moderator başarılı, `user` rolü `42501` ile
> reddedildi). Bonus: klavye kısayolları (A/R/S/E, kuyruğun başındaki karta).
> `tsc`/`next build` temiz. Ayrıntı: `docs/YAPILACAKLAR.md` başı.
>
> 🔴 **8 AĞU 2026 — OLAY (kendi hatam, aynı gün düzeltildi): 7 Ağu güvenlik
> düzeltmesi login'i kırdı.** `public.users`teki `REVOKE ALL`+dar `GRANT`
> yalnız 2 bilinen tüketiciyi (rozet, herkese açık profil) taradı; `role`/
> `merged_into`/`is_active`/`phone`/`email`/`tckn`/`vkn` kolonlarının proje
> genelinde (proxy.ts'in "canlı hesap var mı" araması, profil-tamamla'nın
> kendi-profil ön-doldurması, `getCurrentUser()`, moderatör omnisearch)
> `authenticated` client'ıyla okunduğu 20+ yer atlandı — login TAMAMEN
> kilitlendi. Düşük hassasiyetli 3 kolon (`role`/`merged_into`/`is_active`)
> tekrar herkese açıldı; gerçekten hassas olanlar (`phone`/`email`/`tckn`/
> `vkn`) GERİ AÇILMADI, ihtiyaç duyan her yer servis rolüne taşındı (yeni:
> `/api/auth/hesap-eslesme`, `profilOnDoldur()`, `/api/moderator/kullanici-
> ara`). Doğrulama: `authenticated` kendi-profil sorgusu artık çalışıyor,
> `anon` hâlâ PII okuyamıyor (asıl açık bozulmadı). `tsc`/`next build` temiz.
> Kayıt: `docs/20260808_giris_regresyonu.sql`. Ayrıntı: `docs/YAPILACAKLAR.md` başı.
>
> ✅ **8 AĞU 2026 — Moderatör paneli: 13 aksiyon iyimser yerel güncellemeye geçti.**
> Onayla/reddet/arşivle/shadow-ban/düzeltme-iste — hepsi her tıktan sonra TAM
> `getIlanlar()` (200 satır) + `getIstatistik()` çekiyordu; bu, "sonrakine
> yumuşak kaydır" animasyonuyla yarışıp listeyi moderatörün altından kaydırıyordu.
> Yeni `ilanlariYereldeUygula()` sunucunun her aksiyon için yazdığı alanları
> (`toplu-islem/route.ts`ten birebir) bilip `ilanlar` state'ini ağa gitmeden
> günceller — sekme değişmişse satır kalkar, değişmemişse rozeti güncellenir.
> "Sonraya Bırak" listesi de `localStorage`'a taşındı (sayfa yenilenince
> sıfırlanmıyor artık). `tsc`/`next build` temiz. Ayrıntı: `docs/YAPILACAKLAR.md` başı.
>
> ✅ **7 AĞU 2026 — WhatsApp yükleme artık AYRI SAYFA: `/moderator/whatsapp-yukle`.**
> `WhatsappYukle.tsx` (parametresiz, moderasyon kuyruğuyla state paylaşmıyor)
> eskiden `/moderator` (1349 satır, ~35 `useState`) içine gömülüydü — dakikalarca
> sürebilen yükleme akışı gereksiz yere 200 satırlık moderasyon tablosuyla aynı
> React ağacındaydı. Bileşen değiştirilmeden yeni rotaya taşındı, `/moderator`e
> nav linki eklendi. Yetki üç katmanda zaten sağlamdı (proxy `/moderator`
> önekiyle otomatik, sayfanın kendi client kontrolü, `requireStaff()` sunucuda)
> — hiçbiri değişmedi. `tsc`/`next build` temiz. `app/moderator/page.tsx`'in
> geri kalan karmaşıklığına (N+1 update, no_lane state paylaşımı, useMemo'suz
> filtre) dokunulmadı — ayrıntı `docs/YAPILACAKLAR.md` başı.
>
> 🔴 **7 AĞU 2026 — GÜVENLİK: İKİ KRİTİK AÇIK KAPANDI (kayıt/giriş denetimi).**
> **(1) `public.users`** tablo düzeyinde `anon`/`authenticated`'e GENİŞ GRANT
> verilmiş olduğu için RLS'in `using(true)` SELECT policy'si (rozet için
> bilerek yazılmıştı) **herkesin TCKN/VKN/email/telefon/role okumasına** ve
> **her girişli kullanıcının kendini admin yapmasına** izin veriyordu — ikisi
> de bizzat `SET LOCAL ROLE` ile çalıştırılıp kanıtlandı, sonra kapatıldı
> (kolon bazlı GRANT'a geçildi: SELECT yalnız 5 kamuya açık kolon, UPDATE
> yalnız kendi satırında 5 form alanı). **(2)** `app/api/auth/merge/route.ts`
> istemciden gelen `mergeUserId`i doğrulamadan kabul ediyordu — herkese açık
> `/u/<uuid>` profilinden alınan RASTGELE bir kullanıcının hesabı ele
> geçirilebiliyordu (ilan/araç/TCKN transferi + kurbanın hesabını pasifleştirme).
> Artık sunucu iki hesabın gerçekten aynı e-postaya ait olduğunu kendisi
> doğruluyor. Ayrıca `tekil-kontrol` route'una kota eklendi (kotasız TCKN/VKN
> sorgusu). Kayıt: `docs/20260807_guvenlik_kayit_giris.sql`. **Manuel aksiyon
> bekliyor (Bayram):** Supabase Dashboard'dan "leaked password protection"
> açılmalı — kod/SQL ile yapılamaz. Ayrıntı: `docs/YAPILACAKLAR.md` başı.
>
> ✅ **7 AĞU 2026 — PERFORMANS: ANA SAYFA 400 KAT, SAYAÇ 158 KAT HIZLANDI.**
> Ölçüldü (`pg_stat_statements`, tahmin değil): ana sayfa sorgusu ort. 1026ms/
> maks 21,4sn, sayım sorgusu 1269ms. İki kök sebep: (1) planlayıcı `moderation_
> status = ANY(...)` iki değerli koşulda satır sayısını 8 kat yanlış tahmin
> ediyordu → `create statistics` + `analyze` ile düzeldi, 1711ms→**4ms**.
> (2) `listings` hiç manuel VACUUM edilmemişti (%12 dead tuple, autovacuum eşiği
> %20'de hiç tetiklenmemiş) → `vacuum analyze` + eşik %5'e çekildi, 1269ms→**8ms**.
> Ayrıca `app/ilan/[id]/page.tsx` her açılışta aynı ilanı 2 kez sorguluyordu
> (`generateMetadata` + sayfa ayrı sorgu) — `React.cache()` ile tekleştirildi,
> auth kontrolü ilan sorgusuyla paralel atılmaya başlandı. `/api/listings/ara`
> ve `HomeClient.tsx` kod değişikliği gerektirmedi (aynı tabloyu aynı filtreyle
> sorguluyorlar, DB düzeltmesi otomatik yansıdı). Kayıt: `docs/20260807_
> performans_listings.sql`. Ayrıntı: `docs/YAPILACAKLAR.md` başı.
>
> ✅ **7 AĞU 2026 — #93 KAPANDI: `detectAdType` "yuklenecek" DÜZELTMESİ, CANLI v91.**
> Ölçüm: `raw_text`'te tam "yuklenecek" geçen 1350 `arac`-etiketli ilandan 25'i
> elle okundu, **25'i de** gerçekte yük simsarı kalıbıydı ("X'ten büyük balya
> yüklenecek" = yük var/araç aranıyor, boş araç DEĞİL); yalnız 2'sinde başka
> gerçek araç sinyali vardı. Kelime hem Deno (`parse-listing`) hem `lib/lane-
> parser.ts`ten çıkarıldı, `npm run test:ad-type` (yeni, index.ts'ten çalışma
> anında sökülür, mutasyonla doğrulandı) + 6 mevcut regresyon paketi yeşil.
> **Deploy edildi — v91 ACTIVE.** Geçmiş ~1350 yanlış etiketli ilan: yalnız 1'i
> hâlâ aktif+onaylı görünüyordu, **Bayram kararı: DEĞME** (#90 kalıbı — küçük
> kazanç, geçmiş veri olduğu gibi bırakıldı). Ayrıntı: `docs/YAPILACAKLAR.md` başı.
>
> ✅ **7 AĞU 2026 — "YAZARAK İLAN EKLE" ÖNCE REGEX DENİYOR, ÇÖZEMEZSE CLAUDE'A DÜŞÜYOR.**
> Yeni: `lib/lane-parser.ts` (Deno `parse-listing`in deterministik primitiflerinin
> senkron kopyası) + `hizliAyristir()`. `app/api/parse-text/route.ts` artık önce
> bunu dener; çözerse AI kotasına hiç dokunmadan döner. `tsc`/`next build` temiz,
> 1269 alias'lık gerçek veriyle 6 örnek elle doğrulandı. ✅ İki bilinen kusur da
> KAPANDI: frigo/frigorifik veri kalitesi taşındı (dosya haritasında `lib/lane-
> parser.ts` girdisine bak), "yuklenecek" #93 ile düzeltildi (bir üstteki madde).
> Ayrıntı: `docs/YAPILACAKLAR.md` başı, dosya haritasında `lib/lane-parser.ts`.
>
> ✅ **6 AĞU 2026 — DALGA 5 BİTTİ. METİN KOLONLARI DÜŞTÜ, CANLI DOĞRULANDI.**
> `listings.origin_city` ve `listing_stops.city` **artık yok**. Coğrafi standardizasyon
> Dalga 1→5 tamamlandı; il artık **yalnız** `province_id` (plaka kodu 1-81).
> Sıra: BÖLÜM 7 yedek → BÖLÜM 4 yedi `drop index concurrently` (birer birer) →
> BÖLÜM 5 iki `drop column` (tek transaction) → BÖLÜM 6 altı doğrulama. Hepsi geçti.
> 💾 **Yedekler — 30 GÜN SAKLANACAK, 6 EYL 2026'DAN ÖNCE SİLİNMEZ:**
> `public.dalga5_yedek_20260806` (`id, origin_city, origin_province_id`) **234.840 satır** ·
> `public.dalga5_yedek_stops_20260806` (`id, listing_id, stop_order, city, province_id`)
> **245.086 satır**. Her ikisi de metin kolonu **dolu olan** satırları içerir; bu yüzden
> `listings` toplamından (243.644) **8.804 az**. O 8.804 satırın hepsi 3-6 Ağu arası
> yazıldı ve hepsinde `origin_province_id` dolu — yani fark, `ilan_olustur` v4'ün
> 3 Ağu'dan beri metne yazmadığının **kanıtı**, eksik yedek değil.
> 📌 **7 Ağu 2026 — Bayram kararı: BEKLE.** "Coğrafi geçiş tamamlandıysa yedekleri
> temizle" isteği geldi; retention tarihi (6 Eylül) hatırlatılınca **"Bekleyelim,
> listede dursun"** dendi. Yani 6 Eylül'den önce silme **iki kez** teyitli:
> kod-yazılı karar (yukarıda) + Bayram'ın bilerek onayı. 6 Eylül'den önce tekrar
> "sil" istenirse bu not hatırlatılmalı; erken silmek tek geri dönüş yolunu kapatır.
> 🔬 **BÖLÜM 6 sonuçları:** kalan metin kolonu 0 (tanık: iki `*_province_id` kolonu yerinde) ·
> `pg_proc`'ta 21 eşleşme **tek tek gözle** okundu (runbook sınıflandırma regex'ini yasaklıyor —
> 31 Tem'de o kestirme dört fonksiyonu yanlışlıkla temize çıkarmıştı), hepsi zararsız ·
> düşen kolona bakan view / matview / RLS politikası **0** ·
> **çalışma zamanı kanıtı (YAZMA):** `ilan_olustur` `begin; … rollback;` içinde çalıştırıldı ve
> `{"id":"2e51066f-…","moderation_status":"pending"}` döndü → yazma yolu drop sonrası sağlam.
> Rollback artığı da ayrıca arandı: **0 satır**.
> **çalışma zamanı kanıtı (OKUMA):** gövdesinde `city` geçen üç fonksiyonun üçü de
> çalıştırıldı — `get_radar_city_overview(30)` 1 satır · `get_radar_city_detail(34,'giden',30,null)`
> 1 satır · `get_nearby_listings_by_province(34,null,5)` 5 satır. Hiçbiri hata vermedi.
> 📌 **Ders:** plpgsql gövdeleri DDL anında doğrulanmaz. Bir fonksiyonun kolon drop'undan
> sağ çıktığının tek kanıtı onu **çalıştırmaktır** — `create function`'ın hata vermemesi değil.
> 📌 **Runbook sapması (bilerek):** yedek tabloları runbook'taki `_20260807` yerine gerçek
> tarihle `_20260806` adlandırıldı. Yanlış tarihli yedek, 30 gün sonra "silinebilir mi"
> kararını veren kişiyi yanıltır. Runbook BÖLÜM 7 da bu ada güncellendi.
>
> <s>🟢 **6 AĞU 2026 — DALGA 5 DROP'A HAZIR. BÖLÜM 0 ÖNKOŞULLARININ SEKİZİ DE YEŞİL.**</s>
> *(aşağısı drop öncesi kayıttır, tarihsel olarak duruyor)*
> `#21` kapandı (yedi metin indeksi 1g22s pencerede **tam sıfır**, tanık trafiği 864 bin) ·
> `#24` kapandı ve bugün tüm kod tabanı taranarak **kanıtlandı** (kalan `origin_city`
> eşleşmelerinin hepsi RPC jsonb **girdi** anahtarı, LLM JSON şeması veya `provinces.name`
> takma adı) · `0.3` son 24 saatte **5.631 ilan, il çözülemeyen 0, metne yazılan 0** ·
> `0.5` metin dolu/id boş satır **0** · `0.8` `pg_proc` gövde taraması: `city` geçen dört
> fonksiyonun **hiçbiri** düşen kolona dokunmuyor · **ek olarak** `pg_depend` ile view /
> kısıt / RLS / trigger / default bağımlılığı arandı → **sıfır**, yani `drop column`
> `CASCADE`siz de geçer, yedi indeks otomatik düşer.
> ✅ **DROP ÇALIŞTIRILDI (yukarı bak).** Runbook: `docs/20260731_dalga5_metin_kolon_drop.sql`
> BÖLÜM 7 yedek → BÖLÜM 4'ün yedi `drop index concurrently`'si **BİRER BİRER** (tek Run'da
> hepsi = `25001`) → BÖLÜM 5'in iki `drop column`'u → BÖLÜM 6 doğrulama.
> 📊 Ölçek: `listings` 243.644 · `listing_stops` 254.909 satır.
>
> 🚨 **6 AĞU 2026 — #87 KAPANDI (parser).** Solu boş `->` satırı `splitByRelation`'da
> NULL dönüyordu; `contextFrom` yedeği **ulaşılamaz ölü koddu**. 30 günde `processed`
> 6.724 satırın **293**'ü bu kalıbı içeriyor, **133**'ünde okta geçen varış hiçbir şeride
> girmemiş. Üç düzeltme (A/B/D) yazıldı ve **6 Ağu 15:49 UTC'de canlıya çıktı**:
> `parse-listing` **v79 → v85**, #86 + #88 + #87 birlikte gitti.
> 🚨 **AMA `npm run olc:87` CANLIDA BİR REGRESYON BULDU — #87-E AÇIK.**
> Ölçüm (7.299 satır) **"≥1→0 KAYIP = 2"** verdi; o sütun sıfır olmak zorundadır.
> `e5ba7700` · `1d640d19` → `"EYSAN TAŞIMACILIK / -> AVCILAR LİMAN - TUZLA"`.
> #87-A sol boş oku ilişki saydığı için satır Pass 1'de **tüketiliyor**, `contextFrom`
> yoksa `if (!from) continue` satırı **tamamen düşürüyor**. #87 öncesi bu satır tire
> kuralına düşüp doğru çözülüyordu.
> 📌 **DERS: bir kolu "ulaşılabilir" yapmak, o satırların ESKİ yolunu da kapatır.**
> #87-A'nın kazancı sayıldı, kapattığı yol sayılmadı. **Mutasyon testi bunu gösteremezdi** —
> yalnız gerçek veri üzerinde eski/yeni kıyası gösterdi. `olc:*` scriptlerinin KAYIP
> sütunu, birim testlerin koruyamadığı "yazmadığın davranışı" korur.
> ✅ **Düzeltme yazıldı** (`index.ts` Pass 1 `if (!from)` bloğu): kökensiz sol-boş ok
> satırında okun SAĞI tek başına yeniden ilişkiye sokuluyor. Yalnız satırın zaten
> düştüğü yerde çalışır → **şerit ekler, silemez**. Şart `!ayniSehir || !ayniIlce`
> (iki vaka da İstanbul içi; tek başına `ayniSehir` kaybı tekrarlardı).
> `test:87` **20/20** · mutasyonda **tam 2 test düştü** · dört regresyon suite'i yeşil.
>
> 🚨 **6 AĞU 2026 — #87-F: #87-E'NİN KENDİ YAN HASARI. KAYIP=0 AKLAMA BELGESİ DEĞİLMİŞ.**
> #87-E sonrası ölçüm (7.621 satır) **KAYIP = 0** verdi — ama örnekleri elle okuyunca
> iki satırda **kendine şerit** çıktı ve şerit **kaybı** vardı; script bunları "kayıp"
> değil **"changed"** saydığı için alarm çalmadı:
> `6c75aeea` `"-> GEBZE - SİLİVRİ / ->GEBZE - MANİSA"` → Gebze→Silivri · **Gebze→GEBZE** (Manisa yok)
> `9cbb76e1` `"->DİNAR-İSKENDERUN / ->DİNAR-İSTANBUL / ->DİNAR-ERZURUM / ->ESKİŞEHİR-MERSİN"`
> → 4 doğru şerit yerine Dinar→İskenderun · **Dinar→DİNAR** · Dinar→Eskişehir.
> **Kök sebep:** #87-E kolu kurtardığı satırda `contextFrom = altFrom` yazıyordu.
> Böylece **kendi güvencesini kendi bozuyordu** — sonraki sol-boş ok satırında `from`
> artık null olmadığı için kol devreye giremiyor, satır normal yola düşüp okun sağındaki
> **ilk yeri varış sanıyordu**. Düzeltme: o atama kaldırıldı; kol artık **hiçbir duruma
> yazmaz**, yalnız şerit ekler. Her sol-boş ok satırı kendi sağını çözer (#87 öncesi davranış).
> `test:87` **22/22** · mutasyonda (`contextFrom = altFrom` geri kondu) **tam 2 yeni test
> düştü** ve mutant çıktısı **canlı veriyle bit bit aynı** (`Gebze→Gebze`, `Dinar→Dinar`).
> ⚠️ Testin ayırt edici olması için sentetik alias önceliği düzeltildi: `findPlaces`
> isabetleri **önceliğe göre** sıralar, ilçe<il koyarsak sıra tersine döner ve mutant
> yakalanmaz. `Gebze`/`Dinar` → 95.
> 📌 **DERS: KAYIP=0 "temiz" demek değildir.** Yanlış şerit satırda şerit sayısını
> düşürmez → KAYIP sütununa hiç yansımaz. **"Şerit eklendi ≠ şerit doğru"** uyarısını
> scriptin kendisi yazıyor; örnekleri elle okumanın yerini ölçüm tutmuyor.
> 🔴 **VE BU DERS ÜÇÜNCÜ KEZ ISIRDI (#87-E · #87-F · #92).** "Örnekleri elle oku"
> bir kapı değil bir umuttur; üç kerede ikisinde tutmadı. 7 Ağu 2026'da `olc-87.mts`e
> **KENDİNE ŞERİT** sütunu eklendi — artık bu sınıf hata bir SAYI, göz kararı değil.
>
> ✅ **DEPLOY EDİLDİ — canlı `parse-listing` v89 (7 Ağu 2026 05:41:56 UTC, Bayram CLI ile).**
> #87-E + #87-F + #89-A/B birlikte gitti. "Canlı v85" satırı 6 Ağu'da doğruydu, artık değil.
> Kanıt: `list_edge_functions` → v89 ACTIVE; `git diff 9a1940f -- supabase/functions/parse-listing/index.ts` boş,
> yani deploy edilen baytlar bu ağaçla birebir aynı.
> 🔴 **v89 KOŞULDU VE GERİLEME ÇIKTI — #92.** `olc:87` (8.432 satır) `->İL-İLÇE`
> blok kalıbında şeritlerin katledildiğini gösterdi: `17c1d00d` 9 şerit → 2 (biri
> `Mersin→Mersin`), `6dafdfb3` 6 → `Adana→Adana`, +9 vaka daha. İki kusur: **#92-A**
> #87-E kolunun `if (!from)` kapısı (meşru başlık satırı contextFrom'u doldurunca
> kol hiç çalışmıyordu) · **#92-B** Pass 1 ok/tire kolunda kendine-şerit koruması
> yokluğu. Mutasyonla ayrı ayrı doğrulandı (1 / 2 / 5 test).
> ✅ **DEPLOY EDİLDİ — canlı `parse-listing` v90 (7 Ağu 2026 12:51:38 UTC).**
> "sandbox push/deploy edemez" varsayımı bu oturumda çürüdü — `supabase` CLI bu
> makinede kurulu, `supabase functions deploy` doğrudan çalıştı.
> `npm run olc:87` canlıya karşı tekrar koşuldu: KENDİNE ŞERİT `yeni`de **0** ✅
> (canlıda 163'tü) — düzeltme çalışıyor. Ama **KAYIP (`≥1→0`) = 3** 🚨, kapı 0
> istiyordu. 3 satır elle okundu: 1'i gerçek kayıp (`Ankara Ş.İçi` — aynı-il
> şehir-içi taşıma, kendine-şerit BUG'ı değildi), 2'si kabul edilebilir (Mersin/
> Esenyurt → **Rusya**, sistem zaten yalnız 81 ili temsil edebiliyor).
> **✅ KARAR (Bayram): v90 kalıyor** — 163 yanlış kendine-şeride karşı 1 gerçek +
> 2 kabul edilebilir kayıp, net kazanç pozitif. "Ş.İçi" istisnası düşük öncelikli
> backlog maddesi oldu. Ayrıntı: `docs/YAPILACAKLAR.md` #92 bloğunun sonu.
> ⏳ **Kalan gerçek iş:** #86/#88 canlı ölçümü hâlâ yeni trafik bekliyor; deploy'dan
> sonraki 413 satırlık "changed" kümesinin geri kalanı hâlâ tam denetlenmedi.
> ✅ **#89 CANLI DOĞRULAMASI KAPANDI (7 Ağu 13:10 UTC).** v89'un işlediği gerçek
> 2.246 `raw_post`'la ölçüldü (tanık kolonu önce kondu): varış ilçe doluluğu
> **%33,8 → %65,5** yükseldi, kendine-şerit **165 → 64** düştü (sıfıra inmedi çünkü
> v89 henüz #92 fix'ini içermiyordu — o v90'da, henüz trafik almadı). İki yön
> beklentisi de tuttu, tahmin değil ölçüm.
> ✅ **Dalga 5 gerçek trafikle doğrulandı:** deploy sonrası WhatsApp dosyası işlendi →
> **303 ilan · 424 durak · il id boş 0 · duraksız ilan 0.**
> Ayrıntı: `docs/YAPILACAKLAR.md` başı.

> Son güncelleme: 30 Temmuz 2026 — **COĞRAFİ STANDARDİZASYON Dalga 1 CANLIDA, Dalga 2 KODU HAZIR.**
> İl artık **metin değil `province_id` (plaka kodu, 1-81)**. Üç yeni dosya: `lib/constants/locations.json`
> (81 il + **973 resmî ilçe**), `lib/lokasyon.ts` (`ilId`/`ilAdi`/`ilceler`/`ilceNormalize`/`ilCiftYazim`),
> `scripts/test-lokasyon.mts` (`npm run test:lokasyon`). Geçiş **çift yazım**: metin kolonları
> YERİNDE KALIR ve yazılmaya devam eder, `province_id` yanlarında birikir; Dalga 5'te drop edilir.
> ✅ **`docs/20260730_province_id.sql` ÇALIŞTIRILDI (30 Tem 2026).** Backfill %100/%100
> (234.229 ilan + 244.379 durak), çelişki sıfır, GRANT'lar yerinde.
> ✅ **DALGA 2 KODU TAMAM (30 Tem 2026).** `lib/ilan-yaz.ts`, `app/moderator/actions.ts`,
> `app/panel/actions.ts` çift yazıma geçti (`ilCiftYazim` + `ilceNormalize`); `parse-listing`,
> `excel-import`, `whatsapp` **değişiklik gerektirmedi**. tsc temiz · 21/21 · 29/29.
> ✅ **`docs/20260730_ilan_olustur_v3.sql` ÇALIŞTIRILDI (30 Tem 2026).** Duman testi geçti:
> `origin_city='istanbul'` + durak `'ANKARA'` gönderildi, dönen `İstanbul | 34` ve `Ankara | 6`
> — hem metin kanonikleşti hem id doldu, hem kalkışta hem durakta. Kod deploy'u bekliyor;
> migration'daki 6.A geri doldurma güncellemesi idempotent, arada tekrar çalıştırılabilir.
> **v3'ün kilit kararı:** id çağırandan İSTENMİYOR, RPC `origin_city` metnini `il_key()` ile
> katlayıp `provinces`'tan **kendisi türetiyor** ve metni kanonik ada çevirerek yazıyor. Böylece
> jsonb ayrışma tuzağı `province_id` için kapandı ve `origin_city='istanbul'` sınıfı bozulma
> yapısal olarak imkânsız oldu. Deno'daki `parse-listing` bu yüzden hiç dokunulmadan doğru yazıyor.
> Dalgalar ve dokunulacak 20+ dosya: **`docs/COGRAFI_GECIS.md`**.
> ❌ **DÜZELTME — "W5'in il yazımı adımları gereksizleşti" TAVSİYESİ YANLIŞTI.** `il_key()` iki
> yazımı aynı **id**'ye katlıyor, ama **metin kolonu Dalga 3'e kadar canlı arayüzü besliyor.**
> Ölçüm: `origin_city='istanbul'` **22.474 satır**, tamamı `source='whatsapp'`, sonuncusu 29 Tem —
> yani CANLI. `HomeClient:711` `.includes()` büyük/küçük harfe duyarlı + dropdown `ILLER`'den
> kanonik `İstanbul` veriyor ⇒ **kullanıcı İstanbul filtrelerken bu 22.474 ilanı GÖREMİYOR**
> (tüm ilanların ~%9,6'sı). Kaynak: `parse-listing/index.ts:818` `origin_city: firstLane.from`
> = `aliases.normalized` ham değeri.
> ✅ **`docs/20260730_istanbul_kanonik.sql` ÇALIŞTIRILDI (30 Tem 2026).** Blok 1 alias kaynağını
> kuruttu (= runbook Adım 2), Blok 2 metni `province_id`'den onardı. Doğrulama **2.4 = 0** →
> farklı yazımlı aynı il satırı kalmadı; 22.474 ilan İstanbul filtresinde artık görünüyor.
> ✅ **DALGA 3 TAMAM (31 Tem 2026) — ana sayfa filtresi de `province_id`'ye geçti.** Yukarıdaki
> `HomeClient:711 .includes()` satırı ARTIK YOK: filtre `origin_province_id` / `listing_stops.province_id`
> tamsayı eşitliğiyle **sunucuda** çalışıyor (`/api/listings/ara`). Yazım bozulması bu yolu bir daha
> etkileyemez — metin kolonları yalnız gösterim.
> ✅ **DALGA 4 TAMAM (31 Tem 2026) — AI prompt'ları.** Ölçüm planı iki yerde yalanladı:
> (a) `supabase/functions/parse-listing/index.ts`'in **prompt'u yok** (saf regex + `aliases`),
> (b) prompt'un ikinci kopyası plana hiç yazılmamış `app/api/whatsapp/route.ts:47`'de.
> `province_id` tarafı Dalga 2'de zaten kapanmıştı (üç kanal da `ilanYaz()` / `ilan_olustur` v3'ten
> geçiyor; `/api/parse-text` DB'ye hiç yazmıyor, çıktısı forma prefill oluyor). Gerçek risk yazım
> hatası değil **AI'ın il alanına ilçe adı koyması**ydı ("Çorlu" → `ilCiftYazim` null → WhatsApp'ta
> ilan HİÇ oluşmuyor, form yok ki düzeltilsin). İki prompt'a da "sadece 81 ilden biri; ilçe geldiyse
> `district`'e koy, `city`'ye bağlı olduğu ili yaz" kuralı eklendi.
> ✅ **DALGA 2/4 KAPSAMA DOĞRULAMASI GEÇTİ (31 Tem 2026).** Deploy'dan 24 saat sonra:
> `excel` 45/45, `whatsapp` 609/609 — **eksik 0**. Çapraz kontrol (`origin_city <> provinces.name`)
> **sıfır satır**. Yani RPC'yi atlayan yazma yolu yok ve metin ile id hiçbir yerde çelişmiyor.
> ✅ **FORM KANALI DA DOĞRULANDI — 31 Tem 2026** (`docs/20260731_form_kanali_dogrulama.sql`).
> Tüm tablo: `whatsapp` 234.781/234.781 · `excel` 100/100 · `form` 3/3, **eksik 0**.
> Canlı test (2 ilan / 3 durak, Tekirdağ→Van+Malatya ve Tekirdağ/Çorlu→İzmir/Kemalpaşa):
> `origin_province_id` ve `listing_stops.province_id` dolu, metin kanonik, çelişki 0.
> **Dört yazma yolunun dördü de ölçüldü.**
> 🚨 Bu not önce `source='manual'` diyordu; **yanlış**. Canlı kısıt:
> `listings_source_check = source IN ('form','excel','whatsapp','facebook')` — `'manual'` yok.
> O küme `app/moderator/actions.ts:149`'daki **`raw_posts.source`** beyaz listesidir.
> Aynı karışıklık `lib/ilan-yaz.ts`'te de vardı: `IlanKaynak` `'moderator'` içeriyor,
> `'facebook'` içermiyordu → DB'nin reddedeceği bir değeri tip onaylıyordu. Kısıtla
> birebir eşitlendi (31 Tem 2026).
>
> ⏳ **`docs/20260731_dalga5_metin_kolon_drop.sql` + `docs/20260731_districts_tablosu.sql`
> YAZILDI (31 Tem 2026) — İKİSİ DE ÇALIŞTIRILMADI.** Dalga 5 migration'ı bir hafta önceden
> yazıldı ve **iki gizli bağımlılık** çıkardı (ikisi de `COGRAFI_GECIS.md` madde listesinde yoktu):
> 🚨 **`ilan_olustur` hâlâ `origin_city` + `listing_stops.city` INSERT ediyor.** plpgsql gövdesi
> DDL anında doğrulanmaz → `drop column` hatasız geçer, ilk ilan oluşturmada 42703 patlar,
> dört yazma yolu da bu RPC'den geçtiği için **ilan girişi tamamen durur**. v4 drop'tan önce şart.
> ⚠️ **Çözülemeyen yer adları geri getirilemez:** v3'ün `coalesce(provinces.name, ham metin)`
> bacağı bilinçli koruma; `listing_stops`ta `raw_text` yedeği bile yok → boş satır kalır.
> `districts` tablosu (973 ilçe + `ilce_resmi()`) Deno'daki `district_official` boşluğunu
> **kararı DB'ye taşıyarak** kapatıyor. 📌 `district_id` kolonu EKLENMİYOR: ilçe adı tekil değil
> (`Merkez` 51 ilde, 24 ad daha çok ilde) — `provinces_il_key_uniq`'in tek satır garantisi
> ilçede yok, "metinden id çöz" sessizce yanlış il seçer.
>
> ✅ **DALGA 5 BÖLÜM 0 ÖLÇÜMLERİ ALINDI (31 Tem 2026) — `docs/20260731_dalga5_olcumler.sql`.**
> **`ilanlar`** 234.885 satır → `pid_yok_metin_var` **0**, `telafisiz_kayip` **0**.
> **`duraklar`** 245.152 satır → `pid_yok_metin_var` **0**, `zaten_bos` **0**.
> 📌 `origin_serbest_metin` yedek kolonu **gerekmiyor**; drop veri kaybettirmiyor.
> 🚨 **Ölçüm v4'ten (#26) ÖNCE alındı, bilerek:** v4 metin kolonlarına yazmayı bıraktığı an
> her yeni satır `origin_city IS NULL` olur ve bu sayaçlar bir daha okunamaz.
> **Ölçüm, ölçtüğü şeyi değiştiren işlemden önce alınır.**
> 🚨 **Sıfırın sebebi veri değil, uygulama katmanı.** Çağıranlar ili çözemezse ilanı RPC'ye
> hiç göndermiyor → v3'ün `coalesce(provinces.name, ham metin)` koruması çoktan ölü koddu.
> ❌ **"İki korumasız yol var" YANLIŞTI** (31 Tem'de kod okundu):
> `lib/ilan-yaz.ts`:247,271 ✅ · `app/moderator/actions.ts`:180,196 ✅ ·
> `supabase/functions/parse-listing/index.ts`:836 ❌ **tek korumasız yol bu**.
> `moderator/actions.ts` `ilanYaz()`'ı atlıyor ama aynı kontrolleri kendi içinde tekrarlıyor —
> **"ilanYaz()'ı atlıyor" ≠ "korumasız"**; ilki çağrı grafiği, ikincisi davranış.
> → **v4 gövdesine iki `22023` guard eklendi** (`v_origin_pid is null`; ve `p_stops` üzerinde,
> **INSERT'ten ÖNCE**). Guard, tek korumasız kanalın tek koruması.
> ⚠️ "Ölçüm sıfır, guard gereksiz" DENMEZ: ölçüm korumanın bugün çalıştığını gösterir,
> yarın yerinde kalacağını değil.
>
> 📄 **`docs/20260731_ilan_olustur_v4.sql` (31 Tem 2026, #26) — ✅ ÇALIŞTIRILDI 3 Ağu 2026.**
> BÖLÜM 1'in çalıştırılabilir hâli, ayrı dosyada: v4 drop'u beklemez, BÖLÜM 2 koduyla aynı
> release'te çıkar. ADIM 0 ön ölçümü (31 Tem'de ve 3 Ağu'da yeniden): `listings.origin_province_id
> IS NULL` **0 satır**, `listing_stops.province_id IS NULL` **0** → guard geriye dönük hiçbir
> akışı kırmıyor. Doğrulama: 2.2 → `origin_city` NULL · `origin_province_id` 34 · `city` NULL ·
> `province_id` 6 · 2.3 → iki guard da `22023` · guard sonrası yarım satır **0**.
> ✅ **2.5 DUMAN TESTİ DE GEÇTİ (#39, aynı gün).** Gerçek trafikte 149 ilan /
> 176 durak, hepsinde `origin_province_id` dolu ve metin kolonları NULL.
> Beş yol da koştu: whatsapp 135 · excel 13 · form 1 · repost 21 · moderatör 50.
>
> ✅ **`docs/20260804_ilan_olustur_v41_ilce_resmi.sql` (4 Ağu 2026, #50) — ÇALIŞTIRILDI
> ve CANLIDA DOĞRULANDI.** v4 gövdesinin aynısı, yalnız iki satır: `district_official` artık
> `coalesce(çağıranın değeri, public.ilce_resmi(...))`. **Gövde elle kopyalanmadı** —
> v4 dosyasından programla üretilip iki satırı yamandı, sonra `difflib` ile v4'e karşı
> doğrulandı: tam iki hunk, parantez dengesi aynı. Sürüklenme riski sıfır.
> 🔑 **Dalga 5'i BEKLEMEDİ.** Eski karar "v4 ile aynı anda" idi; gerekçesi "fonksiyon
> iki kez elden geçmesin"di ve v4 3 Ağu'da tek başına çıkınca o gerekçe öldü.
> `origin_city`/`city`ye dokunmuyor → drop'tan bağımsız.
> ✅ **Doğrulama:** `prosrc like '%ilce_resmi%'` → 1 · ADIM 0 `true/true/false/null` ·
> `begin; ilan_olustur(... district_official YOK ...); rollback;` →
> `Gebze true` · `Tuzla true` · `Merter false` · ilçesiz durak `null`.
> 🚨 **İlk ölçüm yanlış alarm verdi: canlı satırların hepsi NULL'dı ama hepsi
> deploy'dan ÖNCEKİ 16 saniyelik toplu içe aktarmaya aitti.** "Deploy'dan sonra bak"
> derken saat değil OLAY sırası doğrulanmalı — aynı dakikada olmak, sonra olmak değil.
> 📌 Yazma yolu testlerinde varsayılan yöntem **canlı trafiği beklemek değil**,
> `begin; …; rollback;` ile fonksiyonu doğrudan çağırmak: anında ve kesin.
> ⏭️ Geçmiş satırlar onarılmadı (#52 ile aynı gerekçe); v4.1 öncesi WhatsApp
> ilanlarında `district_official` NULL kalır — anlamı "bilinmiyor", bozuk veri değil.
> ⚠️ Kanal kapsaması `source` ile ÖLÇÜLMEZ — o alan mesajın nereden geldiğini
> tutar, hangi kodun yazdığını değil; moderatör de repost da `whatsapp` görünür.
> Ayıranlar: `is_repost`, `reviewed_at`.
>
> 🚨🚨 **ŞEMA DEĞİŞTİ — `listings.origin_city` ve `listing_stops.city` ARTIK NULLABLE**
> (3 Ağu 2026, v4 ADIM 0.5). v4 uygulandıktan sonra her `ilan_olustur` çağrısı `23502` attı
> (`origin_city` NOT NULL'dı) ve ilan oluşturma **beş kanalda birden durdu**; kısıt düşürülerek
> çözüldü. Kolonlar BÖLÜM 5'te zaten tamamen gidiyor, bu onun ön adımı.
> 📌 Plan "yazmayı bırakmak" ile "düşürmek" arasında günlerce pencere olacağını doğru
> kurgulamıştı; o pencerede kolonun hâlâ **dolu olmayı zorunlu kıldığı** sorulmamıştı — ne v4
> ne drop dosyası "NOT NULL" kelimesini bir kez geçiriyordu.
> → **Kural: bir yazma yolunu kesmeden önce hedef kolonun KISITLARINA bak.**
>
> 📄 **`docs/20260803_pg_metin_kolon_tuketici_taramasi.sql` (3 Ağu 2026, #40) — ✅ ÇALIŞTIRILDI, SONUÇ TEMİZ.**
> Salt okunur 7 bölümlük katalog taraması: `pg_proc` gövdeleri · view/matview · indeks · kısıt ·
> `pg_attribute.attnotnull` · RLS · varsayılan · trigger. **Postgres tarafında metin kolonlarının
> gerçek tüketicisi kalmadı — #37 son taneymiş.** Niye gerekti: Dalga 5 envanteri kapsamını *dile*
> göre kurmuştu (`.ts`/`.tsx`), Postgres hiç envanterlenmedi; #37 tesadüfen bulundu ve tesadüf bir
> yöntem değil. Dört fonksiyon eşleşmesinin dördü de yanlış pozitif: `ilan_olustur`ünki JSONB
> **girdi anahtarı** (`p_listing->>'origin_city'`) — 🔑 bu kalıcı ve doğru, kolon düşse de çağıranlar
> JSON'da `origin_city` göndermeye devam edecek, **Dalga 5'te bu satırlara dokunulmayacak**
> (API sözleşmesi ≠ şema); diğer üçü (`get_nearby_listings_by_province`, `get_radar_city_overview`,
> `get_radar_city_detail`) `provinces.name`i `as origin_city`/`as city` **takma adıyla** döndürüyor.
> Yedi indeks doğrulandı; `drop column` onları kendiliğinden düşürür → drop dosyasına ayrıca
> `drop index` gerekmiyor. İki kolonda kısıt yok, ikisi de nullable, trigger'ların hiçbiri gövdesinde
> `city` geçirmiyor.
> ❗ **Eksik: BÖLÜM 2 (view/matview), 5 (RLS), 6 (varsayılan) çıktıları yapıştırılmadı.** Boş dönmüş
> olsa bile kaydedilmeli — şu an "boş" ile "bakılmadı" ayırt edilemiyor. En kritiği BÖLÜM 2:
> **view/matview `drop column`'u fiilen ENGELLER.**
> 🚨 **Taramanın kendi açığı:** filtre `l !~ '^\s*--'` yalnızca tamamen yorum olan satırı eliyor,
> **satır sonu yorumunu** elemiyor — `… contact_phone,  -- ⬅️ origin_city çıkarıldı` yanlış pozitif
> verdi. Aynı gün v4 sürüm tespitinde yapılan hatanın daha ince hâli: kural "yorum **satırını** at"
> değil, "**yorumu** at" imiş → `regexp_replace(l, '--.*$', '')`.
>
> 🐛 **DÖRDÜNCÜ SESSİZ BUG (v4 yazılırken bulundu, düzeltildi).**
> `parse-listing/index.ts`:884 döngü **dışında koşulsuz** `processing_status='processed'`
> yazıyordu; döngü RPC hatasında `continue` ediyor → hiç ilan oluşmasa bile ham mesaj
> `no_lane` kuyruğundan düşüyordu. v4 ile birleşince guard **amacının tersini** yapardı:
> "görünür bozuk ilan" yerine **hiçbir kuyrukta olmayan kayıp mesaj**.
> 📌 **Bir katmandaki gürültü, üst katman onu yutuyorsa gürültü değildir.**
> Düzeltme: `created > 0 ? 'processed' : 'no_lane'` + WARN log → mesaj kuyrukta kalır,
> alias öğretilince `reprocess-no-lane` yeniden dener. ⚠️ Bug v4'ten bağımsız ve
> öncedendi (23514/22P02 de aynı şekilde mesaj kaybediyordu). → Görev #33 (deploy).
> 🚨 `SUPABASE_ACCESS_TOKEN` eksikken bu düzeltme **sessizce deploy edilmez** — token ve
> deploy zamanı gözle doğrulanmadan v4 çalıştırılmaz.
> 🚨 **KOVA SAYISI ÜÇ DEĞİL, DÖRT (3 Ağu 2026 → Görev #34).** BÖLÜM 2 envanteri
> `origin_city`'yi *geçtiği yere* göre ayırınca **gösterim ile yazma aynı kovaya düştü**:
> `panel/actions.ts`:135 ve `moderator/page.tsx`:580 "gösterim" diye listelenmişti, oysa
> `listings.update({ origin_city })` çağırıyorlar (duraklar: `panel/actions.ts`:167,
> `moderator/page.tsx`:606). Dördü de RPC'yi atlıyor → **v4 guard'ı bunları görmez**, drop 42703 verir.
> 🚨🚨 **DÜZELTME (3 Ağu, aynı gün): DÖRT YAZMA YOLU DEĞİL, İKİ — ve "karar" diye bir şey yok.**
> `panel/actions.ts::ilanGuncelle` **ulaşılamaz kod**: tek import eden `panel/IlanYonetim.tsx`,
> onu import eden **hiç kimse**. Panelin canlı düzenleme yolu `/api/ilan/duzelt` ve o uç nokta
> **tek bir konum alanı bile yazmıyor** — kullanıcı panelden ilinin bugün zaten değiştiremiyor.
> Kalan tek canlı yol moderatör paneli; o da çözülemeyen ili zaten reddediyor
> (`moderator/page.tsx`:543-548, :558-564) ve il girdisi `<select>`. → KOVA D salt mekanik
> anahtar silmeye indi, **3 Ağu'da tamamlandı** (`moderator/page.tsx`:580, :606).
> 📌 Ders: **`grep` bir çağrı grafiği değildir.** "Bu dosya kolona yazıyor mu?" soruldu,
> "bu dosya çalışıyor mu?" sorulmadı — ölü bir dosya üç belgeye kritik madde olarak yazıldı.
> KOVA E ile aynı kök: orada kapsam *dile*, burada *erişilebilirliğe* göre daralmıştı.
> ~~⚠️ Ölü dosyalar duruyor (silme Bayram'da): `panel/actions.ts`, `panel/IlanYonetim.tsx`,
> `u/[username]/IlanListesi.tsx`~~ → ✅ **SİLİNDİ (3 Ağu 2026, #38).** Üç ölü kaynak +
> `scripts/_chk-iller.mjs` + yedi scratch `.txt`, toplam 11 dosya `git rm` ile kalktı;
> `npx tsc --noEmit` temiz — ölü olduklarının kanıtı grep değil derleyici.
> ⚠️ `app/panel/` KARMA dizindi: `page.tsx` + `PanelClient.tsx` CANLI (KOVA B'de çevrildi),
> `app/moderator/actions.ts` de canlı (`moderator/page.tsx`:6). Silme dizin değil dosya bazlı.
> ✅ **4 Ağu 2026 — `app/ilan/[id]/_aksiyonlar_props.txt` de SİLİNDİ (12. dosya).** #38'den
> kalan tek scratch'ti. Düzen için değil **güvenlik için**: 28 Nis'ten (`9e9eac5`) donmuş
> parça `contactPhone={ilan.contact_phone}` diyordu; canlı çağrı `page.tsx`:472-479'da
> SPRINT_01 L1c ile `contactPhone={user && profilTamamlandi ? ilan.contact_phone : null}`.
> Kopyalansaydı misafirin Flight payload'ına telefon geri sızardı. Doğru bilgi zaten
> derleyici denetimli iki yerde: `page.tsx`:472 ve `Aksiyonlar.tsx`:25 (`Props`).
> ✅ **3 Ağu 2026 — BÖLÜM 2 KOD TEMİZLİĞİ BİTTİ (#34 + #35), v4 (#26) artık çıkabilir.**
> Çevrilen dosyalar: `api/admin/radar/route.ts` + `admin/radar/RadarClient.tsx`,
> `api/admin/crm/[id]/route.ts` + `admin/crm/CrmClient.tsx`, `api/admin/learn-aliases/route.ts`
> + `admin/ogrenme-merkezi/OgrenmeMerkeziClient.tsx`, `panel/page.tsx` + `panel/PanelClient.tsx`,
> `moderator/page.tsx` (B+D birlikte). Ölü SELECT alanları çevrilmedi, **silindi**
> (`crm/[id]/analiz/route.ts`:83, `learn-aliases`:88) — ölü alanı taşımak onu canlı gösterir.
> `yol-rehberi/YolRehberiClient.tsx`:64 dokunulmadı: orası RPC ÇIKIŞ kolonu, `provinces.name`'den.
> tsc temiz · `test:lokasyon` + `test:parser` 29/29. #24 bilerek bekliyor (8.B pozitif kontrolü).
> ✅ **3 Ağu 2026 — 81 İL LİSTESİ TEK KAYNAĞA İNDİ (#36).** Aynı 81 elemanlı dizi repoda
> **beş** yerde duruyordu; dördü elle yazılmış ve **hiçbir test tarafından korunmuyordu**:
> `moderator/page.tsx`:14, `admin/poi-onay/PoiOnayClient.tsx`:63, `u/[username]/page.tsx`:10,
> `admin/radar/RadarClient.tsx`:116 (`SEHIRLER`). Dördü de `lib/lokasyon.ts`'in yeni
> `IL_ADLARI` / `IL_ADLARI_ALFABETIK` export'larına indirildi.
> 🚨 **Risk kozmetik değildi:** moderatör il filtresi Dalga 5'ten sonra
> `ilAdi(id) === filtreKalkis` diye **tam eşitlik** karşılaştırıyor; `ilAdi()` `locations.json`'dan,
> dropdown ise ayrı bir kopyadan okuyordu. Tek harflik sapma (bir `Hakkari`/`Hakkâri`) filtreyi
> **patlatmaz, sessizce boş döndürürdü.** Türetmek bu hata sınıfını imkânsız kılıyor.
> 🔧 **RadarClient'ta sıra DEĞİŞTİ (bilerek):** elle yazılmış liste Türkçe kurallı değildi —
> `Şanlıurfa` Siirt'ten ÖNCE, `Kilis` `Kırıkkale`'den önce. `Intl.Collator('tr')` ile dokuz konum
> yer değiştirdi. Seçilen **değer** aynı olduğu için filtre davranışı değişmez; liste düzelir.
> ⚠️ Beşinci kopya `lib/ilan-sabitler.ts::ILLER` **kalıyor** — `lokasyon.ts` ondan `ilKey`
> import ettiği için ters yön döngü olur. İkisini `test-lokasyon.mts`:17 zaten bağlıyor;
> aynı dosyaya `IL_ADLARI ↔ ILLER` birebirliği + alfabetik permütasyon + Türkçe sıra
> kontrolleri eklendi (3 yeni assert). `HomeClient`/`ilan-ver`/`TopluYukle` zaten
> `ilan-sabitler`'den import ediyordu, dokunulmadı. tsc temiz · lokasyon + parser 29/29.
> ✅ KOVA B'nin çözümü **join değil `lib/lokasyon.ts`:83 `ilAdi(id)`** — 81 il zaten
> `locations.json`'da (25 KB), istemci bileşenleri bugün import ediyor. Kalıp: SELECT'te
> `origin_city`→`origin_province_id`, gösterimde `ilAdi(...) ?? '—'`. Tel trafiği de küçülür.
> 🔎 `idx_listings_origin` çözüldü: `btree (origin_city)` — `origin_province_id` değil.
> Drop listesine eklendi (7 indeks) ve 110 taramayla **8.B farkının pozitif kontrol adayı**.
> ⏳ **`docs/20260731_index_temizligi.sql` YAZILDI (31 Tem 2026) — ÇALIŞTIRILMADI.** Dalga 3'ün
> ertelediği çift-index temizliği (`listing_stops` üç özdeş `(listing_id)`, `listings` üç özdeş
> `(created_at DESC)`, artı `raw_posts_dedup_idx`) **ölç-sonra-düşür** runbook'u olarak yazıldı:
> 1 keşif · 2 kullanım ölçümü · 3 `raw_posts_dedup_idx` gerekçesi · 4 DDL üretici (düşür + geri alma)
> · 5 Dalga 5 metin/trigram adayları · 6 doğrulama. **DROP satırları yorumda**, dosya uçtan uca
> çalışmaz — bilerek. 🚨 `idx_scan = 0` tek başına kanıt değil: `pg_stat_database.stats_reset`'ten
> beri **≥ 7 gün** şart. 🚨 `drop index concurrently` transaction içinde çalışmaz (`25001`),
> Supabase editörü çok-ifadeyi örtük sarar → her satır tek başına.
> 📏 **ÖLÇÜM ALINDI 31 Tem 2026 (BÖLÜM 7).** Pencere zaten 122,6 gündü (`stats_reset` 30 Mar),
> yani engel "kısa pencere" değil **"Dalga 3 daha dün deploy edildi"** — sayacın %99'u eski
> kodu ölçtü. 🚨 **Yeni kural, asimetrik okuma:** metin indekslerinde `idx_scan = 0` geçerli
> kanıttır (Dalga 3 metinden uzaklaştırdı, talep artamaz), `> 0` kanıt DEĞİLDİR.
> 🚨 **`idx_scan` ölçümüne TANIK İNDEKS koy — tek başına `0` okunamaz** (4 Ağu 2026, #21).
> `0` iki farklı şeyin cevabı olabilir: "tüketici yok" ya da "pencerede hiç trafik olmamış".
> Ayırt etmenin yolu, aynı fark sorgusuna düşürmeyeceğin indeksleri de koymak. 4 Ağu'da
> metin indeksleri 0 iken `listing_stops_listing_id_idx` +91.927, `listings_pkey` +14.078,
> `listings_origin_province_idx` +19 çıktı → pencere dolu, `province_id` yolu çalışıyor,
> metin yolu ölü. ⚠️ **INSERT `idx_scan` artırmaz** — sayacı besleyen şey okuma trafiği;
> "ilan girdim, ölçüm hazır" yanlış varsayım.
> 🚨 **`pg_stat_statements` UTILITY (DDL) İFADELERİNİ NORMALİZE ETMEZ** (4 Ağu 2026 — bir
> yanlış alarma mal oldu). `create or replace function …` bir utility ifadesidir; gövde
> dolar-tırnaklı string olarak metnin İÇİNDE, sabitleri `$1`'e çevrilmeden saklanır. Yani
> **Dalga 3'te DEĞİŞTİRDİĞİMİZ eski fonksiyon gövdeleri, canlı sorguymuş gibi görünür** —
> `city ILIKE '%'||p_city||'%'` diye onlarca satır döndü, hiçbiri canlı değildi. `calls`
> da sorgu sayısı değil, migration'ı kaç kez çalıştırdığın. **Ayırt edici işaret:** normal
> sorguda sabitler `$1`/`$9` diye normalize, DDL fosilinde ham (`'%'`, `'active'`). Canlı
> tüketici sorusunun tek doğru kaynağı `pg_proc.prosrc`.
> 🚨 **`prosrc` taraması EŞLEŞME BAŞINA değil FONKSİYON BAŞINA sınıflandırılır** (4 Ağu).
> 31 Tem'deki tarama `get_radar_city_*`'te `jsonb_build_object('city', …)` görüp "anahtar,
> zararsız" deyip fonksiyonu aklamıştı. Bir fonksiyonda bir masum eşleşme bulmak, o
> fonksiyonda BAŞKA eşleşme olmadığını kanıtlamaz. Doğrusu: geçiş sayısı + her geçişin
> bağlamı çıkarılır, hepsi tek tek sınıflandırılır (JSON anahtarı / çıktı takma adı /
> yorum / GERÇEK kolon predikatı). Bu şekilde tekrarlandığında dört fonksiyonun dördü de
> temiz çıktı — hüküm aynıydı ama artık dayanağı var.
> 🚨 **Kopya indeks avında iki ayrı tarama gerekir:** `pg_get_indexdef` metnini karşılaştırmak
> yalnız METİNSEL kopyayı bulur. `shadow_profiles`'ta `phone_key` (UNIQUE) + `phone_idx` (düz)
> aynı kolonda — UNIQUE btree düz btree'nin her sorgusunu karşılar, yani düz olan gereksiz;
> ama imzalar farklı metin olduğu için tarama onu KAÇIRIR. **İşlevsel kapsama** için ayrı
> sorgu şart (kolon-öneki karşılaştırması) — `20260731_index_temizligi.sql` BÖLÜM 7.E.
> 🚨 `raw_posts_dedup_idx` kararı tersine döndü — kısıt olarak gereksiz ama **86k tarama** ile
> aktif sorgu indeksi; düşürülmeyecek. Bugün düşürülebilir ≈ **127 MB**.
> ⚠️ **KALICI KORUMA — YARIM KURULMUŞ (30 Tem 2026 · 🚫 4 Ağu 2026'da düzeltildi).**
> `20260730_alias_adim9_kopya_pasiflestir.sql` (612 satır pasif, kayıpsız) çalıştı →
> `20260729_alias_normalize_trigger.sql`'in **yalnız BÖLÜM 2'si** çalıştı.
> 🚫 Bu satır önce "`aliases_normalize_trg` ve kısmi `aliases_katlanmis_anahtar_uniq` canlıda"
> diyordu — **trigger canlıda DEĞİL.** 4 Ağu ön kontrolünde `pg_trigger` `aliases` için
> **0 satır** döndü (`docs/20260804_adim3_4_6_on_kontrol.sql` BÖLÜM 0).
> ✅ Canlı olan: `aliases_katlanmis_anahtar_uniq` (kısmi UNIQUE) — katlanmış kopya DB
>    seviyesinde doğamaz, D3'ün asıl amacı tutuyor.
> ✅ **#43 KAPANDI (4 Ağu 2026)** — yukarıdaki "canlı olmayan" satırı bayattı.
>    `docs/20260804_alias_normalize_trg_a.sql` ile trigger kuruldu (seçenek (a),
>    `lower()` bilerek çıkarıldı — U+0307 riski). **7 Ağu'da yeniden ölçüldü:**
>    `pg_trigger` → `aliases_normalize_trg` `tgenabled='O'`; canlı `insert`
>    (rollback'li) `'  TEST   İĞNE   ALIAS  '` → `TEST İĞNE ALIAS` / uzunluk 15,
>    `district='   '`→`NULL`. Normalizasyon artık DB seviyesinde garanti.
> ✅ **Runbook Adım 1–7 ve 9 ZATEN TAMAM (4 Ağu 2026, #31).** Bu satır önce "ilçe adımları
> (3, 4, 6) hâlâ bekliyor" diyordu; ölçüm aksini gösterdi — Adım 3 ve 7 boş döndü, Adım 4'ün
> 92 satırının 92'si dolu ve **sıfır id kayması**, `payas` ve Adım 6'nın beş kararı uygulanmış.
> ✅ **Adım 8.2 / #44 KAPANDI** — bu satır bayattı, gerçekte #44 4 Ağu'da UPDATE ile
> kapanmıştı (53/53 kanonik). 7 Ağu'da yeniden ölçülüp teyit edildi: `KEMALPAŞA`
> (büyük harf) **0** satır. Ayrıntı: `docs/COGRAFI_GECIS.md` Adım 8.2.
>
> Önceki: 29 Temmuz 2026 — **SPRINT_01 W5 (alias veri bütünlüğü) kod tarafı tamamlandı.**
> **W5:** Bozuk `aliases.normalized` yazımı (`Istanbul` 13 satır / `İstanbul` 154 satır) sahte
> **İstanbul→İstanbul** güzergâhları üretiyordu. Kaynak iki katmanlıydı: `learn-aliases` prompt'unun
> örnekleri ASCII'ye indirgenmişti (**D1** düzeltti) ve dört alias yazma noktasının hiçbiri
> `normalized`/`district`'i normalize etmiyordu (**D2** → yeni `lib/alias-normalize.ts`, dört yolda
> 409 çakışma kontrolü). **D4** `parse-listing/findPlaces`'teki `seen`/`sameCity`/lane dedup
> anahtarlarını katlanmış forma geçirdi (5/5 kabul testi geçiyor; aynı testler HEAD'de 3/5 başarısız).
> **D5** `docs/20260729_alias_runbook.md` — iki hazır SQL script'inin çalıştırma sırası (sıra
> yanlışsa sessizce zarar veriyor). **D3** `docs/20260729_alias_normalize_trigger.sql` — normalize
> trigger + **kısmi** UNIQUE indeks.
> ⚠️ **SQL'lerin HİÇBİRİ ÇALIŞTIRILMADI** (Bayram'ın 29 Tem beyanı). Sıra: runbook Adım 0-9 → sonra
> trigger dosyası. (bkz. `docs/W5_DEVIR.md`)
>
> Önceki: 29 Temmuz 2026 — **SPRINT_01 W3 + W4 tamamlandı.**
> **W3 (SEO & huni):** `layout.tsx` metadata (metadataBase/OG/Twitter/canonical) + statik OG kartı, 4 auth sayfasına `noindex`, sitemap'e `/yol-rehberi` ve profil sayfaları, robots.txt dört bloğu tutarlı hale getirildi, iki CTA `?tip=` ile ayrıştı (`lib/analiz.ts`), misafirin "Ara" butonu artık `?redirect=` taşıyor.
> **W4 (UX cila):** Şifre kuralları tek kaynağa indi (`lib/sifre.ts` — ⚠️ `\p{Lu}`, `[A-Z]` DEĞİL); liste limiti tek sabite indi (`lib/ilan-liste.ts`) ve sayaç artık ekrandakini sayıyor; sekme state'i URL'e yansıyor (pushState + popstate); `profil-tamamla`'da tip değişimi ortak alanları koruyor ve blur yarışına karşı epoch guard'ı var; giriş route'u makine okunur `kod` dönüyor; **yeni** `/api/auth/dogrulama-tekrar` doğrulama e-postasını kotalı biçimde tekrar gönderiyor; Footer tamamen `next/link`.
>
> Önceki: 29 Temmuz 2026 — **SPRINT_01 W2 tamamlandı.** A10 ile `merged_into` giriş döngüsü kapandı: `/auth/devir` oturumu SUNUCUDA canlı hesaba geçiriyor (`hashed_token` + `verifyOtp`), token tarayıcıya hiç gelmiyor. M2 moderatör girişine rol doğrulaması ekledi. K2b TCKN/VKN doğrulayıcılarını `lib/kimlik.ts`'te tek kaynağa indirdi. **G2:** SMS gönderimi istemciden alınıp `/api/auth/otp`'ye taşındı (3 katmanlı kota). **G1:** şifreli giriş istemciden alınıp `/api/auth/giris`'e taşındı (e-posta 5 hata/15dk, IP 20 hata/15dk). Ortak kota altyapısı: `lib/kota.ts`.
>
> Önceki: 28 Temmuz 2026 — **SPRINT_01 W1 tamamlandı.** Auth audit trail açıldı (`/api/auth/log` + `auth_events`), `?hesap=` mesajları görünür oldu, `redirect` param'ı `lib/redirect.ts` ile güvenli şekilde korunuyor, profil upsert'i server action'a taşındı (kolon beyaz listesi), `/auth/reset` artık yalnız gerçek recovery oturumunda form gösteriyor, `/cikis` GET kapatıldı, OTP tekrar gönderimine **sunucu tarafı** 60 sn cooldown geldi. L1e ile `contact_phone`'un son istemci yazma yolu da kapandı — panel ve moderatör artık server action kullanıyor.
> ✅ **SPRINT_01'in 3 SQL'i de çalıştırıldı** (29 Tem 2026): `20260728_kvkk_onay.sql`, `20260728_auth_events.sql`, `20260728_contact_phone_revoke.sql`. Bekleyen migration yok. (bkz. `docs/SPRINT_01.md`)
>
> Önceki: 28 Temmuz 2026 — **SPRINT_01 W0 tamamlandı.** Telefon sızıntısı 4 yüzeyde birden kapatıldı (`/`, `/ilan/[id]`, `/u/[username]`, `/ilan/[id]/sahiplen`), numara artık yalnız `/api/ilan/[id]/telefon` üzerinden dönüyor. Google merge 404'ü çözüldü, merge route'undaki 3 bug giderildi, proxy prefix tuzağı kökten kapatıldı, KVKK açık rıza onayı eklendi.
>
> Önceki: 22 Temmuz 2026 — Ayrı auth kimliğiyle (telefon vs. Google) gelen KAYITLI kullanıcı artık profil-tamamla'ya düşmüyor. Magic-link self-heal SONSUZ DÖNGÜ yaratıyordu (implicit flow yalnız localStorage'ı günceller, SSR cookie eski oturumda kalır → proxy tekrar /giris'e atar); çözüm: proxy ölü oturumun sb- cookie'lerini siler, giriş sayfası ölü/eksik oturumu signOut ile kapatır → kullanıcı Google/e-posta ile temiz yeniden girer (PKCE → cookie doğru set). (bkz. 14. GÖREV DURUMU).

**Referans Dökümanlar:**
- `docs/LOG_VE_GUVENLIK_SPECLERI.md` — Log format standartları, audit trail, SecurityLogger kontrol listesi
- `docs/LANDING_AUTH_ANALIZ.md` — Landing / kayıt / giriş analizi (28 Tem 2026), bulgu kodları L1–L5, A1–A7, K1–K3
- `docs/SPRINT_01.md` — **Aktif sprint.** 30 madde / 78 puan, W0–W4 dalgaları. Yukarıdaki analiz + geniş tarama (M1–M2, R1–R2, C1–C2, G1–G2, S1–S4, F1–F2) birleşik backlog'u. Kabul kriterleri ve bağımlılıklar burada.
- `docs/COGRAFI_GECIS.md` — **Coğrafi standardizasyon (30 Tem 2026).** İl metin → `province_id`.
  Neden (üç ölçülebilir bedel), 5 dalga, dosya bazlı etki tablosu, W5 ile kesişim, tuzaklar.
- `docs/ILAN_VER_ANALIZ.md` — **İlan verme akışı analizi (29 Tem 2026).** 30 madde / 87 puan, bulgu kodları V1–V10 (veri bütünlüğü & güvenlik), B1–B9 (bozuk), U1–U10 (UX/dönüşüm), M1–M5 (mimari). W0–W4 dalgaları, kabul kriterleri ve canlı DB ile doğrulanacak 6 madde burada.

> **✅ İLAN VERME W0 — KANAMA DURDURULDU (29 Tem 2026, `ILAN_VER_ANALIZ` V1–V4):** `app/ilan-ver/actions.ts` baştan yazıldı, `app/ilan-ver/page.tsx` uyarlandı, `lib/ilan-sabitler.ts` eklendi. **Migration yok.** Kazanımlar: **V10** action'ın kendi oturum kapısı var (`proxy.ts`'e tek katmanlı güven bitti); **V1** her istemci değeri beyaz listeden ve sınırlardan geçiyor (`MAX_DURAK=10`, `MAX_ARAC_ADET=50`, `MAX_FIYAT=1e8`, `MAX_NOT=2000`, `MAX_RAW_TEXT=8000`), il adları `ilNormalize()` ile resmî yazıma çevriliyor, tanınmayan il **reddediliyor**; **V2** `contact_phone` artık `users.phone`'dan — istemci farklı numara yollarsa `WARN` loglanıp profil numarası kullanılıyor, profil boşsa doğrulanmış istemci numarası kabul edilip profile **geri yazılıyor** (dal kendini onarıyor); **V3** INSERT sonrası `audit_score` okunup `getAuditThresholds()` eşikleriyle karar veriliyor — 31–70 bandı `moderation_status='pending'` + `status='passive'` (yayında **değil**), `/api/ilan/duzelt` ile birebir aynı mantık; **V4** action `IlanKaydetSonuc` döndürüyor (`{ok, id, durum, mesaj}` \| `{ok:false, hata}`), ekran üç durumu (`yayinda`/`incelemede`/`reddedildi`) gerçekten gösteriyor, "Fiyat Belli" rozeti yalnız gerçekten yayındaysa çıkıyor. Yan kazanımlar: **V5 kısmî** (durak INSERT'i patlarsa ilan telafi edici `DELETE` ile geri alınıyor), **V8/B9** (AI'ın tanımadığı il/araç değeri artık forma ham yazılmıyor), **M2 kısmî** (`ILLER`/`ARAC_TIPLERI`/`UTSYAPI` tek kaynakta), **A2** (istemci `bugun()` de sabit +03:00). ⚠️ **`safety_rules` boşsa V3 kodu doğru ama etkisiz** — her ilan 0 puan alır ve `yayinda` döner; canlı DB'de doğrulanmalı.

> **✅ İLAN VERME W1 — KIRIKLAR ONARILDI (29 Tem 2026, `ILAN_VER_ANALIZ` B1/B3/B4/V5):** İki yeni dosya: **`lib/ilan-yaz.ts`** — `listings` yazan TEK yol; **`lib/toplu-yukle-sozlesme.ts`** — toplu yükleme istemci↔route sözleşmesi. `/api/excel-import` ve `app/ilan-ver/actions.ts` **baştan yazıldı**. **⚠️ İki migration var, KODDAN ÖNCE çalıştır:** `docs/20260729_ilan_olustur_rpc.sql` → `docs/20260729_listings_vehicle_id.sql`.
> **B1** — toplu yükleme aylardır ölüydü: istemci JSON `{action,rows,userId}` yolluyordu, route `formData().get('file')` okuyordu; ayrıca şablon `'Kalkış İli'` ↔ route `'Kalkış Şehri'`. İki taraf da artık `lib/toplu-yukle-sozlesme.ts`'ten import ediyor, istemci gövdeyi `satisfies TopluYukleIstek` ile mühürlüyor → ayrışma **derleme zamanında** patlar. `userId` sözleşmede **YOK**; kimlik oturumdan. Önizleme `aliases` tablosunu sözlük olarak kullanıyor (şablonun vaat ettiği `"ist"`, `"ant."` kısaltmaları gerçekten çözülüyor), `MAX_SATIR=300` / `MAX_ILAN=50` / `maxDuration=60` (B2 kısmî).
> **V5** — ilan + duraklar artık `public.ilan_olustur(jsonb, jsonb)` RPC'siyle **tek transaction'da**. Eski iki-PostgREST-isteği düzeninde durak INSERT'i patlarsa geriye **duraksız ilan** kalıyordu; telafi edici `DELETE` de patlayabildiği için yeterli değildi. RPC `security invoker` ve EXECUTE yalnız `service_role`da.
> **B4** — yük cinsi artık **durak bazlı**. AI çok duraklı metinden her durağın `cargo_type`'ını çıkarıyordu; sayfa onları `notlar`a gömüp ilk durağınkini genel cins yapıyordu → "İstanbul'a tekstil, Ankara'ya seramik" ilanı DB'ye "hepsi tekstil" giriyordu. Tekil formda durak başına alan var, boş bırakılan genel cinsle doluyor; genel alan yalnız tüm duraklar aynıysa AI'dan doluyor.
> **B3** — `listings.vehicle_id` (FK → `vehicles`, `on delete set null`, **GRANT'lı**). Araç ilanında kullanıcının seçtiği plaka şimdiye kadar hiçbir yere yazılmıyordu. İstemciden gelen id'ye güvenilmiyor: `user_id` + `is_active` ile doğrulanmayan id `WARN` loglanıp **sessizce düşer** (ilan reddedilmez).
> Kalan: **V6** (kota), **U1–U10** (dönüşüm), **M1/M3–M5**.

> **🔴 İLAN VERME AKIŞI — SPRINT_01 SERTLEŞTİRMESİ BU YOLA UYGULANMADI (29 Tem 2026; V1–V5, B1, B3, B4 ✅ giderildi, kalanlar geçerli):** `app/ilan-ver/actions.ts` projenin **en ayrıcalıklı yazma yolu** (service-role `listings` INSERT) ama `app/panel/actions.ts`'teki üç kazanımın hiçbiri burada yok: sunucu tarafı kolon beyaz listesi yok, sahiplik/oturum kapısı yok (`user` okunuyor ama null'da durmuyor), sınır kontrolü/kota yok. Üç bulgu tek başına sprint hak ediyor: **(1)** toplu yükleme fiilen çalışmıyor — `TopluYukle.tsx:104,174` JSON `{action,rows,userId}` yolluyor, `/api/excel-import:38` yalnızca `formData().get('file')` okuyor (üstelik şablon `'Kalkış İli'`, route `'Kalkış Şehri'` bekliyor — iki bağımsız kırık); **(2)** 31–70 moderasyon bandı ölü — `actions.ts:63` `moderation_status: 'auto_published'` sabitliyor, `audit_listing_fn` ise yalnızca `score >= reject_min` dalında bu alana dokunuyor (`auto_pub_max` hesaplanıp loglanıyor ama hiçbir kararda kullanılmıyor); **(3)** AI kotasının kapısı ile sayacı farklı şeye bakıyor — `parse-text` çağrı öncesi `countAiListingsLast24h`'e bakıyor, o da `listings.raw_text IS NOT NULL` sayıyor; formu göndermeyen kullanıcı Anthropic'i sınırsız çağırıyor, üstelik `whatsapp/route.ts:191,204` aynı sayacı kirletiyor.

> **✅ PROXY PREFIX TUZAĞI (28 Tem 2026, `SPRINT_01` M1 — ÇÖZÜLDÜ):** `proxy.ts` düz `pathname.startsWith(r)` kullanıyordu; `KORUNMALI` içindeki `'/moderator'` girdisi `/moderator-giris`'i de yakalıyordu → moderatör giriş sayfası oturumsuz erişilemez hâldeydi. Artık `korunmaliMi()` **segment sınırında** eşleştiriyor: `pathname === kok || pathname.startsWith(kok + '/')`. `ACIK_ROTALAR`'a da `/moderator-giris` eklendi. **Kural: `KORUNMALI`'ya segment eklerken düz `startsWith`'e geri dönme** — `/profil` ↔ `/profil-tamamla` aynı tuzağı taşıyor.

> **✅ EKSİK ROTALAR (28 Tem 2026, `LANDING_AUTH_ANALIZ` A1/A2 — ÇÖZÜLDÜ):**
> (1) ~~`POST /api/auth/log` yok~~ — **AÇILDI.** `app/api/auth/log/route.ts` service-role ile `auth_events` tablosuna yazıyor (event, method, reason, user_id, ip, user_agent). Fire-and-forget: hiçbir zaman auth akışını bloklamaz. Telefon/şifre **yazılmaz**. ✅ `docs/20260728_auth_events.sql` çalıştırıldı (29 Tem 2026) — tablo canlıda.
> (2) ~~`/giris/merge`~~ — **ÇÖZÜLDÜ.** `app/auth/callback/route.ts` artık `/giris?merge_user_id=…&merge_name=…&merge_email=…` yönlendiriyor; `giris/page.tsx` bu paramları lazy `useState` initializer ile okuyup mevcut `merge_onay` moduna giriyor. Yeni route açılmadı.
> **Tuzak (kalıcı):** Yeni endpoint çağrısı eklerken `.catch(()=>{})` ile sessizleştirme — en azından `console.warn` bırak; bu iki hata aylarca görünmez kaldı. `authLog()` çağrıları artık `console.warn` bırakıyor.

> **✅ TELEFON SIZINTISI (28 Tem 2026, `SPRINT_01` L1/L1b/L1c/L1d/L1f — UYGULAMA KATMANI ÇÖZÜLDÜ):**
> Dört ayrı yüzeyde aynı sızıntı vardı: `/` (RSC flight payload + anon select), `/ilan/[id]` (wa.me linki + `Aksiyonlar` prop'u), `/u/[username]` (`tel:` href), `/ilan/[id]/sahiplen` (numarayı tam olarak ekrana yazıyordu).
> **Yeni mimari:** `contact_phone` hiçbir public sorguda **seçilmez**. Numara yalnızca `GET /api/ilan/[id]/telefon` üzerinden döner (authed + profil tamam + hesap aktif + ilan yayında; `logPhoneAccess`; dk başına 20 istek; `no-store`). Sahiplenme akışı için `/api/ilan/[id]/sahiplen` var: `GET` maskeli numara, `POST` OTP gönder/doğrula — numara istemciye hiç gitmez.
> **Kural 1:** misafire kapalı hiçbir alan client component prop'una **veya** anon key sorgusuna girmemeli.
> **Kural 2 (ISR):** `app/page.tsx` `revalidate = 30` ile cache'li — çıktı tüm ziyaretçilerde ortak, **oturuma göre koşullu render imkânsız**. Hassas veriyi "misafirse gizle" ile değil, payload'dan tamamen çıkararak çöz. `/ilan/[id]` `cookies()` kullandığı için dinamik; orada koşullu render güvenli.
> **✅ DB KATMANI (28 Tem 2026, `SPRINT_01` L1e — KOD TARAFI BİTTİ):**
> Uygulamayı düzeltmek yetmiyordu: `anon`/`authenticated` rollerinin `listings.contact_phone` üzerindeki PostgREST yetkisi durduğu sürece anon key'i olan herkes `GET /rest/v1/listings?select=id,contact_phone&limit=1000` çekebiliyordu.
> **Kural (bunu unutma):** **RLS SATIR bazlıdır, KOLON bazlı değildir.** Satır zaten herkese açıksa (ilan listesi çalışsın diye) o satırın *yetkili* her kolonu da okunur. Arayüzde göstermemek koruma değildir.
> Revoke'un önündeki engel istemciden yazma yollarıydı; ikisi de kapatıldı: `app/panel/actions.ts` ve `app/moderator/actions.ts` (yeni). Numara artık yalnız service-role kullanan sunucu yollarından okunur/yazılır.
> ✅ **`docs/20260728_contact_phone_revoke.sql` çalıştırıldı** (Bayram, 29 Tem 2026 — doğrulama select'i 0 satır döndü) ve **duman testi geçti**: misafir ana sayfa/`/ilan/[id]`, moderatör listesi + telefon düzenleme çalışıyor. `contact_phone`'a dokunan her yol service-role kullanıyor → kırık yazma yolu kalmadı.
> **Tuzak:** Tablo geneline verilmiş `GRANT`, kolon bazlı `REVOKE`'u **ezer**. Düz `revoke select (contact_phone) …` no-op olur. Migration önce tablo geneli yetkiyi alıp `contact_phone` hariç tüm kolonları programatik geri veriyor.
> 🚨 **Bunun kalıcı yan etkisi:** grant'lar migration'ın çalıştığı ANDAKİ kolon listesine göre verildi. `public.listings`'e **bundan sonra eklenecek her yeni kolon `anon`/`authenticated` için yetkisiz doğar** ve `42501 permission denied for column …` ile sessizce patlar. Yeni kolon eklerken grant'ı da elle ver (bkz. §9 KURALLAR).

> **✅ İSTEMCİ UPDATE'İ = KOLON BEYAZ LİSTESİ ŞART (28 Tem 2026, `SPRINT_01` K2 + L1e):**
> Aynı sınıf hata iki yerde vardı: `profil-tamamla` `users` upsert'i ve `panel` `listings` update'i gövdeyi hiç filtrelemeden istemciden alıyordu. RLS "kendi satırın" der ama gövdeye `role: 'admin'`, `trust_level: 'verified'`, `moderation_status: 'approved'`, `is_shadow_banned: false` eklemeyi engellemez — devtools açmak kadar kolay.
> **Kural:** İstemciden gelen her `update`/`upsert` gövdesi `'use server'` action içinde **beyaz listeden** geçmeli. Sahiplik kontrolü de sunucuda olmalı — `getServiceSupabase()` RLS'i bypass ettiği için "RLS nasılsa engeller" varsayımı geçersiz.

> **✅ `useEffect` İÇİNDEKİ ASYNC = SESSİZ ARIZA (29 Tem 2026, `/ilan-ver` telefon alanı — ÇÖZÜLDÜ):**
> `useEffect(() => { init() }, [])` kalıbı bu projede birden çok yerde var. `init()` bir promise döner; **reddedilirse hiçbir yerde yakalanmaz** — error boundary tetiklenmez, konsolda kullanıcıya bir şey görünmez, ilgili `setState` sadece hiç çalışmaz. Ekranda kalan tek iz, sonsuza kadar duran bir yükleme yazısıdır.
> Somut vaka: `kullanicitelefon()` üç ayrı sonucu (oturum yok / profilde numara yok / **fırlattı**) tek bir `null`'a çöküyor, `📞 {tel || 'Yükleniyor...'}` de üçünü aynı gösteriyordu. Aynı fırlatma `ilanKaydet()` içinde olunca ise "An error occurred in the Server Components render…" çıkıyordu — **iki farklı belirti, tek kök.**
> **Kural 1:** `useEffect` içinden çağrılan async fonksiyona **daima** `.catch(...)` bağla ve bir hata durumu state'i yaz.
> **Kural 2:** Veri çeken server action'lar `null` dönmesin; `{ durum: 'var' | 'yok' | 'hata' }` gibi **ayrık birleşim** dönsün. "Yok" ile "alınamadı" kullanıcıya aynı gösterilemez.
> **Kural 3:** `process.env.X!` sadece TypeScript'i susturur. Env okuyan her helper eksik değişkenin **adını** söyleyerek patlasın (`lib/auth.ts` → `getServiceSupabase()` örnek).

---

## 0. SİSTEM CONFIG PARAMETRELERİ (system_config)

### Brand kategorisi — SQL:
```sql
INSERT INTO system_config (key, value, category, data_type, description) VALUES
  ('sirket_unvani',   'Yükegel',                                       'brand', 'string', 'Ticari ünvan — KVKK ve Kullanım Koşulları metinlerinde kullanılır'),
  ('marka_adi',       'Yükegel',                                       'brand', 'string', 'Marka adı — navbar ve genel gösterimde kullanılır'),
  ('logo_url',        '/logo.svg',                                     'brand', 'string', 'Logo dosya yolu (/public altında)'),
  ('favicon_url',     '/favicon.ico',                                  'brand', 'string', 'Favicon dosya yolu (/public altında)'),
  ('site_basligi',    'Yükegel - Türkiye''nin Nakliye İlan Platformu', 'brand', 'string', 'Tarayıcı sekmesi başlığı (SEO title)'),
  ('site_aciklamasi', 'Yük ve araç ilanları. Ücretsiz, hızlı, güvenilir.', 'brand', 'string', 'Meta description (SEO)')
ON CONFLICT (key) DO NOTHING;
```

### Kullanım:
- `lib/config.ts` → `getConfig(key, default)` / `getConfigs(keys[], defaults)`
- `layout.tsx` → `generateMetadata()` ile site başlığı + favicon
- `kvkk/page.tsx` + `kullanim-kosullari/page.tsx` → `sirket_unvani`
- Admin paneli → Sistem Ayarları > 🎨 Marka & Kimlik kategorisi

> **Not:** Navbar logo görsel URL'si şimdilik hardcode `/logo.svg`. Dinamik hale getirmek için tüm sayfalara ortak `<Navbar>` server component gerekir — ileriye bırakıldı.

## 1. STACK & ORTAM

| Katman | Teknoloji |
|---|---|
| Frontend/Backend | Next.js 15 (App Router, TypeScript) |
| DB / Auth | Supabase (gobepcswwsoswodhaufy, eu-central-1) |
| Edge Functions | Supabase Deno (`supabase/functions/parse-listing/`) |
| Deploy | Vercel |
| LLM | Anthropic Haiku (parse fallback) |
| SMS OTP | Twilio Verify |
| Style | Inline CSS — `#0d1117` bg, `#22c55e` accent, `#161b22` card |
| Font | IBM Plex Sans |

### 🚀 Deploy nasıl olur (29 Tem 2026 — DEĞİŞTİ)

**Canlıya çıkmak artık otomatik DEĞİL.** Tek kapı:

```bash
npm run deploy                     # → "deploy: elle deploy"
npm run deploy -- "telefon fixi"   # → "deploy: telefon fixi"
```

`scripts/deploy.sh` sırayla: daemon'ın `.git/index.lock`'unu bekler → `tsc --noEmit`
çalıştırır (**tip hatası varsa deploy'u DURDURUR**, Vercel kotası harcanmaz) →
mesajı `deploy:` ile başlayan bir commit atar (değişiklik yoksa `--allow-empty`) → push'lar.

**Arka planda ne dönüyor:**

| Ne | Ne zaman | Sonuç |
|---|---|---|
| `scripts/auto-deploy.sh` (launchd + fswatch) | her dosya kaydetmesinde | `auto: <tarih>` commit → **`yedek` dalına** push + değişmişse Supabase edge function deploy |
| `vercel.json` → `git.deploymentEnabled.yedek = false` | `yedek`'e push'ta | Vercel deployment'ı **hiç OLUŞTURMAZ** (kota harcanmaz) |
| `vercel.json` → `ignoreCommand` | `main`'e push'ta | commit mesajı `auto:` ile başlıyorsa build ATLANIR (2. katman) |
| `npm run deploy` | sen çalıştırınca | `main`'e push → Vercel build eder |

🚨 **Neden (1. tur):** Daemon her kaydetmede `main`'e push atıyor, Vercel de her
push'ta build ediyordu → **yarım kod canlıda**. 17:47'deki `TelefonDurumu is not
assignable` build hatası bunun kanıtı: daemon `actions.ts`'i (yeni tip) push etmiş,
onu kullanan `page.tsx`'i henüz commit'lememişti. Vercel hiç var olmamış bir ara
hali derledi. Çözüm: `ignoreCommand`.

🔴 **Neden (2. tur — `ignoreCommand` YETMEDİ, 29 Tem 19:00):** Vercel Hobby'de
**kayan 24 saatte 100 DEPLOYMENT** sınırı var ve **`ignoreCommand` ile iptal edilen
("Canceled") deployment'lar da bu sayıya DAHİL.** `ignoreCommand` build dakikası
kurtarır, **kota kurtarmaz** — deployment zaten oluşturulmuştur. Daemon 24 saatte
**266 commit** push'ladı; kota 19:00'da bitti ve Vercel **hiçbir** deployment
oluşturmamaya başladı, `deploy:` commit'i de dahil.

> **Belirtiyi tanı:** dashboard'da yeni commit'ler için **hiçbir kayıt yok** —
> "Canceled" bile değil. Hata yok, e-posta yok, `git push` başarılı. Site
> güncellenmiyor, sebebi görünmüyor. (Tanı için Deployments → Status filtresini
> **7/7** yap; "Canceled" varsayılan olarak GİZLİ ve onsuz tablo yanıltıyor.)

**Gerçek çözüm — kotayı korumanın tek yolu deployment'ın hiç oluşturulmaması:**
daemon artık `HEAD:yedek`'e push ediyor, `git.deploymentEnabled.yedek = false` de o
dalı Vercel'e tamamen kapatıyor. Yedekleme kaybolmadı: her kaydetme hâlâ GitHub'a
çıkıyor, sadece başka dala. `main`'e giden tek yol `npm run deploy`.

⚠️ **`deploymentEnabled`'da branch'i açık bırakma.** Vercel varsayılan olarak
**her** dala Preview deployment'ı üretir ve **Preview de kotadan düşer** — yedek
dalını unutursan hiçbir şey değişmez.

🚨 **Tuzak:** Yeni bir deploy yolu (GitHub Action, `vercel --prod`, ikinci branch)
eklersen bu iki katman da sessizce devre dışı kalır. Özellikle daemon'ı `main`'e
geri döndürme.

ℹ️ Edge function deploy'u hâlâ daemon'ın işi — Vercel'den bağımsız, `npm run deploy`
onu tetiklemez.

⚠️ `scripts/auto-deploy.sh`'i **düzenledikten sonra daemon'ı yeniden başlat**;
çalışan bash süreci eski kodu tutar:
`launchctl kickstart -k gui/$(id -u)/com.yukegel.autodeploy`

### 🛠 Yerel yönetim paneli (30 Tem 2026 — YENİ)

```bash
npm run panel      # → http://127.0.0.1:4711
```

`scripts/panel/server.mjs` (bağımlılıksız Node sunucusu) + `scripts/panel/index.html`.
Yukarıdaki her şeyi tarayıcıdan yapar: git durumu (dal, değişen dosyalar, son 10 commit,
`↑ahead ↓behind`), **kilidi aç**, **Yedekle** (`yedek` dalına), **Deploy** (mesaj kutusu →
`scripts/deploy.sh`), **tsc kontrol**, **pull --rebase**, edge function deploy, daemon
başlat/durdur/log. Çıktı canlı akar (chunked stream).

🚨 **Neden Next.js route DEĞİL:** panel `git push`, `rm .git/index.lock`, `launchctl`
çalıştırıyor. Uygulama ağacına konsaydı Vercel'e deploy edilen koda girerdi; `NODE_ENV`
guard'ı bugün doğru olsa bile yarın kopyalanır/kaldırılır ve **uzaktan komut çalıştırma**
açığı olur. Bu yüzden `scripts/` altında, Next build'ine hiç girmiyor.

**Panelin dört koruması** (biri kaldırılırsa panel savunmasız kalır):
`127.0.0.1`'e bağlanır (`0.0.0.0` YAPMA — kimlik doğrulaması yok, tek koruma bu) ·
`Host` başlığı `127.0.0.1`/`localhost` değilse 403 (DNS rebinding) ·
`x-panel: 1` başlığı yoksa 403 (form tabanlı CSRF) ·
iş adı ve edge function adı beyaz listeden geçer (`fn=../../etc` reddedilir).

**Deploy mantığı kopyalanmadı** — panel `scripts/deploy.sh`'i çağırıyor. `main`'e giden
tek kapı hâlâ o script; panel sadece düğme. Yedekle düğmesi `main`'e DEĞİL `yedek`'e
push eder (kota).

---

## 2. PROJE DOSYA YAPISI

```
yukegel/
├── app/
│   ├── page.tsx                        # Landing — 3 senaryo ✅
│   ├── nasil-calisir/page.tsx          # ✅
│   ├── hakkimizda/page.tsx             # ✅
│   ├── kvkk/page.tsx                   # ✅ — sirket_unvani config'den
│   ├── kullanim-kosullari/page.tsx     # ✅ — sirket_unvani config'den
│   ├── _components/
│   │   ├── Footer.tsx                  # Server component — sirket_unvani config'den
│   │   ├── GirisLink.tsx               # 🔗 Giriş/Üye Ol bağlantısı — bulunduğu sayfayı
│   │   │                               #    `?redirect=` olarak KENDİSİ ekler (usePathname).
│   │   │                               #    Çıplak `<Link href="/giris">` YAZMA (29 Tem 2026) ✅
│   │   └── HomeClient.tsx              # Client component — eski page.tsx içeriği
│   ├── layout.tsx                        # 🔍 SPRINT_01 S1 — metadataBase + OG + Twitter + canonical ✅
│   ├── opengraph-image.jpg               # 🔍 SPRINT_01 S1 — 1200×630 paylaşım kartı (Bayram'ın
│   │   + opengraph-image.alt.txt         #    tasarımı). JPEG q95 / 134 KB — WhatsApp büyük
│   │                                     #    dosyada kartı sessizce göstermiyor. `.tsx` üreteci
│   │                                     #    SİLİNDİ; aynı segmentte iki og dosyası build'i kırar ✅
│   ├── sitemap.ts                        # 🔍 SPRINT_01 S3 — statik + ilan + PROFİL (`/u/{id}`) URL'leri ✅
│   ├── giris/page.tsx
│   ├── giris/layout.tsx                  # 🔍 SPRINT_01 S2 — noindex, follow:true ✅
│   ├── moderator-giris/layout.tsx        # 🔍 SPRINT_01 S2 — noindex, nofollow ✅
│   ├── profil-tamamla/layout.tsx         # 🔍 SPRINT_01 S2 — noindex, nofollow ✅
│   ├── auth/layout.tsx                   # 🔍 SPRINT_01 S2 — SEGMENT geneli noindex+nofollow;
│   │                                     #    yeni /auth/* rotaları otomatik miras alır ✅
│   ├── auth/callback/ + reset/           # 🔒 SPRINT_01 R1 — reset 3 durumlu: kontrol/hazir/gecersiz.
│   │                                     #    Form YALNIZ gerçek PASSWORD_RECOVERY oturumunda ✅
│   ├── auth/devir/route.ts               # 🔒 SPRINT_01 A10 — emekli (merged_into) oturumu SUNUCUDA
│   │                                     #    canlı hesaba devreder. hashed_token + verifyOtp → cookie ✅
│   ├── profil-tamamla/page.tsx
│   ├── profil-tamamla/actions.ts         # 🔒 SPRINT_01 K2 — users upsert'i sunucuda, KOLON BEYAZ LİSTESİ ✅
│   ├── panel/ (page + PanelClient)       # ?sekme=ilanlarim|araclarim|profilim derin bağlantı (31 Tem 2026)
│   │                                     # ⚠️ IlanYonetim.tsx ve panel/actions.ts 3 Ağu 2026'da SİLİNDİ (#38 —
│   │                                     #    ölü çift: actions'ı yalnız IlanYonetim import ediyordu, onu hiç kimse).
│   │                                     #    Panelin canlı düzenleme yolu /api/ilan/duzelt.
│   ├── ilan/[id]/ (page + Aksiyonlar + sahiplen)
│   ├── ilan-ver/ (page + actions + TopluYukle + MetindenIlan)
│   ├── araclarim/page.tsx
│   ├── moderator/ + moderator-giris/
│   ├── moderator/actions.ts              # 🔒 SPRINT_01 L1e — ilanTelefonlariGetir (toplu, ≤300) +
│   │                                     #    ilanTelefonGuncelle. requireStaff + phone-privacy log ✅
│   ├── admin/ (page + kullanicilar + sistem-ayarlari + guvenlik + crm + radar)
│   ├── yol-rehberi/                      # 🗺️ POI Modülü ✅
│   │   ├── page.tsx                      # Server component + metadata
│   │   ├── YolRehberiClient.tsx          # Harita + filtreler + bottom sheet
│   │   ├── PoiHarita.tsx                 # React-Leaflet (dynamic import, SSR=false)
│   │   ├── PoiDetay.tsx                  # Detay bottom sheet + yorum formu
│   │   └── PoiEkleModal.tsx              # Yeni POI ekleme formu
│   ├── cikis/
│   └── u/[username]/page.tsx
│
├── api/
│   ├── admin/kullanici/ + guvenlik/
│   ├── auth/merge/ + switch-account/ + tekil-kontrol/
│   ├── auth/log/route.ts                 # 🔒 SPRINT_01 A1 — auth_events'e service-role insert.
│   │                                     #    Fire-and-forget, IP+UA yazılır, telefon/şifre YAZILMAZ ✅
│   ├── excel-import/
│   ├── ilan/[id]/telefon/route.ts        # 🔒 SPRINT_01 L1b — TEK telefon kaynağı. GET, authed+profil tam,
│   │                                     #    logPhoneAccess, 20 istek/dk (in-memory → çok instance'ta zayıf) ✅
│   ├── ilan/[id]/sahiplen/route.ts       # 🔒 SPRINT_01 L1d — GET maskeli numara, POST {adim:'gonder'|'dogrula'}
│   │                                     #    OTP sunucuda; verifyOtp SSR client ile → cookie doğru set ✅
│   │                                     # 🔒 SPRINT_01 A4b — ilan başına 60 sn SMS cooldown (429+Retry-After),
│   │                                     #    sayaç yalnız SMS GERÇEKTEN gittiyse başlar. In-memory ✅
│   ├── ilan/pasif/ + duzelt/
│   ├── llm-parse/
│   ├── moderator/kullanici-askiya/ + toplu-islem/
│   ├── parse-text/                       # ✍️ Metinden ilan: LLM (Haiku) ile JSON çıkarımı ✅
│   ├── poi/route.ts                      # GET (bbox sorgu + sıralama), POST (yeni POI) ✅
│   ├── poi/[id]/route.ts                 # GET detay + son yorumlar ✅
│   ├── poi/[id]/review/route.ts          # POST yorum + geo-fence doğrulama ✅
│   └── whatsapp-parse/                   # 🔒 requireStaff + rate limit (10/dk) ✅
│                                         #    :153 gorunmezleriSil() (4 Ağu 2026) — trNorm'un EN BAŞINDA.
│                                         #      Sıfır genişlikli karakterleri SİLER (boşluğa çevirmez).
│                                         #      parse-listing:74 ile aynı liste; ikisi birlikte değişir.
│                                         #    ✅ cleanHash() de artık siliyor (4 Ağu, #61 kapandı) — ama
│                                         #      BİLEREK chatParser::gorunmezleriSil (yalnız Cf) ile;
│                                         #      `cfKarakterleriSil` adıyla import edilir. Yerel liste
│                                         #      (Cf + U+FE0F) hash'e ASLA girmez: FE0F emojinin parçası,
│                                         #      silinse binlerce eski mesajın hash'i değişirdi.
│
├── lib/auth.ts + supabase.ts             # auth.ts: requireStaff() → API route'lar için (redirect atmaz)
├── lib/redirect.ts                       # 🔒 SPRINT_01 A7 — guvenliRedirect(): yalnız `/` ile başlayan,
│                                         #    `//` ve `\` içermeyen yollar (açık yönlendirme koruması) ✅
│                                         # 🔗 girisAdresi(yol, mod?) — `/giris?redirect=…` üretir. Giriş
│                                         #    bağlantısı kuran HER yer bunu çağırır (29 Tem 2026) ✅
├── lib/kota.ts                           # 🔒 SPRINT_01 G1/G2 — kotaDene()/kotaSifirla()/istekIp():
│                                         #    bellek içi kayan pencere sayacı. `deger` verilirse FARKLI
│                                         #    değer sayar, `sayma:true` sadece bakar. ⚠️ process-local ✅
├── lib/kimlik.ts                         # 🔒 SPRINT_01 K2b — tcknGecerli()/vknGecerli() TEK KAYNAK
│                                         #    (istemci + sunucu aynı modülü import eder) ✅
├── lib/analiz.ts                         # 📊 SPRINT_01 L2 — olayGonder(): GA olayları için tek kapı.
│                                         #    SSR-güvenli, hataları yutar. ⚠️ KİŞİSEL VERİ GÖNDERME ✅
├── lib/sifre.ts                          # 🔒 SPRINT_01 R2 — sifreKriterleri()/sifreHatasi()/SIFRE_KURAL_METNI.
│                                         #    Gösterge ile kapı AYNI kaynaktan beslenir.
│                                         #    ⚠️ Büyük harf: `\p{Lu}` + /u — `[A-Z]` Türkçe'de YANLIŞ ✅
├── lib/ilan-liste.ts                     # 📋 SPRINT_01 L4 — ILAN_LIMITI + ILAN_SELECT + ilanNormalize().
│                                         #    ÜÇ çağıran: app/page.tsx (SSR), HomeClient (istemci),
│                                         #    /api/listings/ara (filtre). Kolon listesi tek yerde ✅
│                                         #    ⚠️ contact_phone BURAYA EKLENMEZ (L1) ✅
│                                         #    ILAN_LIMITI: SSR ve istemci sorgusu AYNI
│                                         #    limiti kullanır. ⚠️ İstemci paketine girer, server-only YOK ✅
│                                         #    ⚖ durakToplami(duraklar, alanlar[]) — TÜM durakların tonaj/palet
│                                         #    toplamı. Kartlar eskiden stops[0]'ı okuyup yükü eksik gösteriyordu.
├── lib/ilan-sabitler.ts                  # 🚨 ILAN_VER_ANALIZ M2 (29 Tem 2026) — ilan alanlarının TEK KAYNAĞI.
│                                         #    ILLER (81) · ARAC_TIPLERI · UTSYAPI · ARAC_TIPI_SETI ·
│                                         #    UTSYAPI_SETI · ilKey() · ilNormalize() → resmî il adı | null
│                                         #    aracTipiNormalize() · utsyapiNormalize() (Excel serbest yazımı)
│                                         #    ⚠️ Yalnız gösterim değil, SUNUCU BEYAZ LİSTESİ de bu dosya
│                                         #    (`lib/ilan-yaz.ts`). İstemci ve sunucu ayrışamaz.
│                                         #    ⚠️ ilKey(): İ (U+0130) → düz `i` ÖNCE, sonra toLowerCase (§9)
├── lib/constants/locations.json          # 🗺️ 30 Tem 2026 — 81 il + 973 RESMÎ İLÇE. {id, plate, name, districts[]}
│                                         #    id = PLAKA KODU = `province_id`. Sıra `ILLER` ile BİREBİR.
│                                         #    🚨 Türetilmiş veri; `public.provinces` tablosunun kaynağı.
├── lib/lokasyon.ts                       # 🗺️ 30 Tem 2026 — COĞRAFİ VERİNİN TEK KAYNAĞI (bkz. COGRAFI_GECIS.md)
│                                         #    ilId(v) → 1-81 | null — SUNUCU BEYAZ LİSTE KAPISI. İstemciden
│                                         #      gelen province_id'yi DOĞRUDAN yazma, önce buradan geçir.
│                                         #      "34" / 34 / "istanbul" / "İSTANBUL" / "Istanbul" → 34
│                                         #    ilAdi(id) · ilPlaka · ilGetir · ilAra(q) (Searchable Select)
│                                         #    IL_ADLARI (plaka sırası) · IL_ADLARI_ALFABETIK (Intl.Collator'tr')
│                                         #      🗺️ 3 Ağu 2026 (#36) — TÜM il dropdown'larının tek kaynağı.
│                                         #      Dört dosyada elle kopyalanmış 81'lik diziler buna indirildi.
│                                         #      🚨 Dropdown ile `ilAdi()` AYNI kaynaktan gelmek ZORUNDA:
│                                         #      moderatör filtresi tam eşitlik karşılaştırıyor, sapma
│                                         #      hata değil SESSİZ BOŞ SONUÇ üretir.
│                                         #    ILLER_TAM_ALFABETIK (8 Ağu 2026) — aynı liste ama `Il` NESNESİ
│                                         #      (id dahil), `IL_ADLARI_ALFABETIK` yalnız ad döndürdüğü için
│                                         #      `value`'yu index'ten türeten dropdown'larda (`HomeClient`)
│                                         #      kullanılamaz — alfabetik sırada index+1 ≠ plaka kodu.
│                                         #    ilceler(ilId) · ilceAra(ilId,q) · ilceResmiMi
│                                         #    ilceHangiIllerde(ad) → Il[] (4 Ağu 2026, #51) — TERS ARAMA.
│                                         #      `ilceResmiMi` false'u İKİ ZIT ŞEYİ karıştırır: (a) meşru
│                                         #      mahalle (Merter) (b) BAŞKA ilin ilçesi (çelişki). Ayıran bu.
│                                         #      🚨 Dizi ÇOK ELEMANLI olabilir (Merkez 51 il, Gölbaşı 2) —
│                                         #      "ilçe adı → il" tek değerli DEĞİL; district_id yokluğunun sebebi.
│                                         #    ilceNormalize(ilId,v) → {ad, resmi} | null — SERBEST GİRİŞE
│                                         #      İZİN VAR (İkitelli, İSTOÇ) ama `resmi:false` İŞARETLENİR
│                                         #    ilCiftYazim(v) → {id, ad} — ÇİFT YAZIM dönemi; Dalga 5'te silinecek
│                                         #    ⚠️ ilKey()'i `ilan-sabitler`den import eder; 3. kopya yok
├── scripts/test-lokasyon.mts             # `npm run test:lokasyon` — 21 kontrol. locations.json ↔ ILLER ↔
│                                         #    plaka sözleşmesini doğrular. Sıra bozulursa DB'deki TÜM
│                                         #    province_id'ler sessizce yanlış ile işaret eder; test o yüzden var.
├── scripts/test-districts.mts            # `npm run test:districts` (4 Ağu 2026) — 19 kontrol. locations.json ↔
│                                         #    `docs/20260731_districts_tablosu.sql` INSERT bloğu, ÇİFT YÖNLÜ.
│                                         #    973/973 · 81 il · kopya yok · il_key katlaması altında çakışma yok
│                                         #    · 8 çapa (Ömerli mahalle, Gölbaşı 2 ilde, Havza=Samsun,
│                                         #      Orhaneli=Bursa, Marmaraereğlisi bitişik, 51 Merkez).
│                                         #    ⚠️ Migration DOSYASINI doğrular, CANLI TABLOYU DEĞİL — elle
│                                         #      eklenen satırı görmez. Saf Node, kimlik bilgisi istemez.
├── scripts/test-alias-detektor.mts        # `npm run test:alias` (4 Ağu 2026, #51) — 28 kontrol.
│                                         #    `alias-normalize.ts::ilceIlUyarisi` koruması.
│                                         #    🚨 ASIL İŞİ "uyarı çıkıyor mu" DEĞİL, SUSMASI GEREKEN YERDE
│                                         #      susuyor mu: 21 kontrolün 14'ü "sessiz"/"zayıf" bekliyor.
│                                         #      Gürültülü detektör okunmaz olur = fiilen sökülmüş kanca.
│                                         #    📌 DÜRÜST KAPSAM kaydı: 3 canlı hatadan yalnız 1'ini (Bigadiç)
│                                         #      kesin yakalar; Orhanlı/Selimpaşa yalnız zayıf kodla gelir.
│                                         #    🟠 Bilinen yanlış pozitif: İzmir/Pınarbaşı (Bornova mahallesi
│                                         #      ama Kastamonu+Kayseri ilçesi) — testte BİLEREK duruyor.
│                                         #    Alias TABLOSUNA değil saf fonksiyona bakar; veri düzeltmeleri
│                                         #      testi kırmaz. Saf Node, kimlik bilgisi istemez.
├── scripts/test-clean-message.mts         # `npm run test:clean` (6 Ağu 2026, #86) — 16 kontrol.
│                                         #    parse-listing `cleanMessage`'ı, yani parser'ın İLK adımı.
│                                         #    🚨 TEST FONKSİYONU ELLE KOPYALANMAZ: `index.ts`ten ÇALIŞMA
│                                         #      ANINDA sökülüp import edilir (BLACKLIST_PHRASES → parseMessage
│                                         #      arası, marker bazlı; satır numarası kullanmaz).
│                                         #      SEBEP: #63'ün ilk testi zinciri elle kopyaladığı için 17/17
│                                         #      geçmişti ve YANLIŞTI — kopyada olmayan :150 hiç çalışmadı.
│                                         #      Yanlış sebeple geçen test, olmayan testten zararlıdır.
│                                         #    🧪 MUTASYONLA DOĞRULANDI: eski regex geri konunca 5 vaka düşüyor.
│                                         #      Tekrarla: `KAYNAK_INDEX=/tmp/mut/index.ts npm run test:clean`
│                                         #    📌 Yalnız metin bozulmasını ölçer; ŞERİT ÜRETİMİNİ ölçmez
│                                         #      (findPlaces substring eşlediği için yapışık metin de tutabilir).
│                                         #    Saf Node, kimlik bilgisi istemez.
├── scripts/olc-86.mts                     # `npm run olc:86` (6 Ağu 2026, #86) — ÖLÇÜM, test değil.
│                                         #    Eski vs yeni `cleanMessage`, son 30 günün damgasız `no_lane`
│                                         #      satırlarında: kaç satır 0 şeritten ≥1 şerite geçiyor.
│                                         #    🚨 KİMLİK BİLGİSİ İSTER (`.env.local`) — bu yüzden CI'da değil,
│                                         #      Bayram elle çalıştırır. Kum havuzunun `supabase.co` erişimi YOK.
│                                         #    Veriyi KENDİSİ çeker; elle taşıma denendi ve md5 tutmadı
│                                         #      (`dogubayazit`→`dogubayazio`, 18 sayfanın ilkinde, sessiz).
│                                         #    Parser'ı da kaynaktan söker + mutantı kendi üretir.
│                                         #    🚨 SAYFALAMA ŞART: PostgREST tek istekte en fazla 1000 satır döner,
│                                         #      `.limit(5000)` bu SUNUCU tavanını KALDIRMAZ — sessizce keser.
│                                         #      İlk sürüm 1242 alias'ın 1000'iyle ölçtü → KAZANÇ 40 çıktı, 46'ymış.
│                                         #      Şimdi `.range()` + `alias.length === count` sertifikası var.
│                                         #      Aynı çukur `parse-listing/index.ts:70`'te zaten not düşülmüştü.
│                                         #    🔑 `.env.local` env okuması İLK-GEÇEN-KAZANIR (dotenv semantiği).
│                                         #      `Object.fromEntries` SON geçeni alır → satır 5'teki bozuk
│                                         #      (4 parçalı) SERVICE_ROLE_KEY seçilip `Invalid API key` veriyordu.
│                                         #    ⚠️ Çıktıdaki `KAYIP (≥1 → 0)` satırı 0 DEĞİLSE düzeltme zarar veriyor.
│                                         #    ⚠️ `ŞÜPHELİ` sayacı (#87): solu boş `->` satırı içeren kazançlar.
│                                         #      O satırlarda parser varışı DÜŞÜRÜP kökenleri birbiriyle eşliyor,
│                                         #      yani "kazanç" UYDURMA şerit olabilir. KAYIP sütunu bunu görmez.
├── scripts/test-pass2.mts                 # `npm run test:pass2` (6 Ağu 2026, #88) — 12 kontrol.
│                                         #    `parseMessage` PASS 2 ("YÜKLEMELİ blok") koruması.
│                                         #    Pass 2, `yükle*` satırını blok kökeni sayar, altındakiler varış.
│                                         #    🚨 #88-A: `isYuklemeli` yalnız "yukle" ALT DİZİSİNE bakar →
│                                         #      "yüklenmez"/"yüklenir"/"yükleme üstene…" DOLGU satırları da
│                                         #      ateşliyor, yer olmadığı için blockOrigin NULL'lanıyordu.
│                                         #    🚨 #88-B: reset koşulundaki `splitByRelation(line) !== null`,
│                                         #      BLOCK_RESET_RE'nin bilinçle dışarıda bıraktığı BOŞLUKSUZ tireyi
│                                         #      geri sokuyordu: "(KISA-UZUN) DORSE" → dash_nospace → blok reset.
│                                         #    ⚠️ TEST FONKSİYONU ELLE KOPYALANMAZ — kaynaktan sökülür (#86 dersi).
│                                         #    🧪 MUTASYONLA DOĞRULANDI: A geri alınınca 3, B geri alınınca 2 düşer.
│                                         #      `KAYNAK_INDEX=/tmp/mut/index.ts npm run test:pass2`
│                                         #    📌 ALIAS'LAR SENTETİK — canlı kapsamayı ÖLÇMEZ, onu olc:88 yapar.
│                                         #    📌 "Kemerburgaz aynı il → şerit YOK" vakası HATA DEĞİL, kayıtlı
│                                         #      gerçek davranış: iki district de NULL → isDiff false. Alias işi.
├── scripts/olc-88.mts                     # `npm run olc:88` (6 Ağu 2026, #88) — ÖLÇÜM, test değil.
│                                         #    DÖRT varyant aynı canlı satırlarda: eski · yalnizA · yalnizB · yeni.
│                                         #      Böylece "hangi düzeltme ne kazandırdı" ayrışır (olc:86 tek ikiliydi).
│                                         #    Varyantlar kaynaktan STRING DEĞİŞİMİYLE üretilir; değişim tutmazsa
│                                         #      script PATLAR — sessizce "eski = yeni" ölçüp 0 kazanç raporlamasın diye.
│                                         #    Sayfalama + env ilk-geçen-kazanır + alias sertifikası olc-86'dan aynen.
│                                         #    🚨 KİMLİK BİLGİSİ İSTER — Bayram elle çalıştırır (kum havuzu erişemez).
│                                         #    ⚠️ `KAYIP (≥1 → 0)` 0 DEĞİLSE düzeltme çalışan satırı bozuyor.
├── scripts/test-87.mts                    # `npm run test:87` (6-7 Ağu 2026, #87 · #89-A · #92) — 24 kontrol.
│                                         #    SOLU BOŞ `->` satırı ("➡️SAMSUN") + `+` fiyat satırı koruması.
│                                         #    🚨 #87-A: splitByRelation'ın ok kolu `if (left && right)` istiyordu →
│                                         #      solu boş ok NULL dönüyor, parseMessage:646'daki "sol yoksa
│                                         #      contextFrom kullan" yedeği ULAŞILAMAZ ÖLÜ KODDU.
│                                         #    🚨 #87-B: sol DOLU ama yersizse ("13.60 TIR -> ANKARA") satır
│                                         #      sessizce düşüyordu → `bestPlace(...) || contextFrom`.
│                                         #    🚨 #87-D: `+` tek başına çoklu varış DEĞİL — "duzce 1200+kdv"
│                                         #      fiyat satırı da `+` içeriyor → en az İKİ parçada yer şartı.
│                                         #    ⚠️ TEST FONKSİYONU ELLE KOPYALANMAZ — kaynaktan sökülür (#86 dersi).
│                                         #    🧪 MUTASYONLA DOĞRULANDI: A→5 düşer, B→1, D→1.
│                                         #    🚨🚨 EN ÖNEMLİ TUZAK — PASS 3 MUTANTI DA MASKELER.
│                                         #      Pass 3 yalnız `lanes.length === 0` iken koşar. Testte önce bir
│                                         #      şerit doğurmazsan düzeltmeyi geri alsan bile Pass 3 kurtarır ve
│                                         #      test YEŞİL kalır — hiçbir şey korumadan. #87-B testinin İLK HÂLİ
│                                         #      tam bu yüzden mutasyondan sağ çıktı; başına gerçek bir Pass 1
│                                         #      şeridi eklenerek düzeltildi.
│                                         #    📌 "➡️ANKARA\n➡️KONYA" → Ankara→Konya BEKLENEN davranış (Pass 3),
│                                         #      #87 öncesinden beri böyle. Uydurma yok vakası: "➡️ANKARA\nTENTELİ TIR".
│                                         #    🚨 #92-A (7 Ağu): #87-E kolunun `if (!from)` kapısı KALDIRILDI. Kapı,
│                                         #      kolu sahada neredeyse hiç çalıştırmıyordu — meşru bir başlık satırı
│                                         #      contextFrom'u dolduruyor, `from` null olmuyor, satır normal yola
│                                         #      düşüp KENDİNE ŞERİT üretiyordu ("MERSİN HEMEN YÜKLENİR" +
│                                         #      "->MERSİN-ANKARA" → Mersin→Mersin). Canlıda ölçüldü: 9 şerit → 2.
│                                         #    🚨 #92-B (7 Ağu): Pass 1'in ok/tire kolunda kendine-şerit koruması
│                                         #      HİÇ YOKTU (`+` kolu ve Pass 2 koruyordu). Kural: aynı il VE aynı
│                                         #      ilçe → şerit yok. Sadece `ayniSehir` bakmak İstanbul→İstanbul/Tuzla
│                                         #      gibi GERÇEK şeritleri öldürürdü.
│                                         #    🧪 MUTASYONLA DOĞRULANDI: 92A→1 düşer, 92B→2, ikisi birden→5.
│                                         #      #92-A'nın İLK testi de Pass 3 tuzağına düştü (yukarıdaki uyarı);
│                                         #      metne önce gerçek bir Pass 1 şeridi eklenerek kapatıldı.
├── scripts/olc-87.mts                     # `npm run olc:87` (6-7 Ağu 2026, #87 → #92) — ÖLÇÜM, test değil.
│                                         #    🚨 TABAN HAREKETLİ: her deploydan sonra `canli` varyantının tanımı
│                                         #      güncellenir. 6 Ağu taban = #87 öncesi; 7 Ağu taban = v89.
│                                         #      Varyantlar: canli · yalniz92A · yalniz92B · yeni.
│                                         #      #87-A/B/D substitusyonları dosyada DURUYOR — tekrar ölçmek
│                                         #      gerekirse TABAN tanımına eklemek yeter.
│                                         #    🚨 KENDİNE ŞERİT SÜTUNU ZORUNLU KAPIDIR (7 Ağu, #92). `yeni`
│                                         #      satırında 0 olmalı. Sebep: KAYIP=0 ÜÇ KEZ (#87-E · #87-F · #92)
│                                         #      "temiz" dedi, üçünde de canlıda bozuk şerit vardı — yanlış şerit
│                                         #      şerit SAYISINI düşürmez. `kendineMi()` il VE ilçe karşılaştırır.
│                                         #    🚨 olc-86/88'DEN YAPICA FARKLI, ÇIKTISI ONLARLA KIYASLANAMAZ.
│                                         #      Onlar "şeritsiz satır şerit kazandı mı" (0→≥1) soruyordu.
│                                         #      #87'nin hasarı BAŞARILI GÖRÜNEN `processed` satırlarda: şerit var
│                                         #      ama YANLIŞ. Bu yüzden `processed` + `no_lane` BİRLİKTE taranır ve
│                                         #      şerit KÜMELERİ karşılaştırılır → eklenen / silinen / değişen.
│                                         #    📌 Değişim sayısı bir "kazanç" rakamı DEĞİL. `KAYIP (≥1→0)` yine 0 olmalı.
│                                         #    📌 SİLİNEN şerit alarm değil (uydurma da silinir) ama her biri elle bakılmalı.
│                                         #    Varyantlar string değişimiyle üretilir; tutmazsa PATLAR (sessiz eski=yeni yok).
│                                         #    #92-B koruması İKİ push noktasında olmalı — sayı da doğrulanır.
│                                         #    Sayfalama + alias/satır sertifikası + `solBosOkVar()` imza kontrolü.
│                                         #    🚨 KİMLİK BİLGİSİ İSTER — Bayram elle çalıştırır (kum havuzu erişemez).
├── scripts/olc89-karsilastir.mts          # `npm run olc:89` (6 Ağu 2026, #89-Ö) — ÖLÇÜM, test değil.
│                                         #    🚨 olc-86/87/88'DEN FARKLI: CANLIYA VURMAZ, tamamen ÇEVRİMDIŞI.
│                                         #      Sebep: kum havuzundan supabase.co'ya ağ YOK (curl → 000;
│                                         #      registry.npmjs.org → 200, yani ağ var ama bu host kapalı).
│                                         #      Ham metin + alias `execute_sql` ile dışa aktarıldı, iki parser
│                                         #      YEREL koşuluyor. Kimlik bilgisi İSTEMEZ, herkes çalıştırabilir.
│                                         #    ÜÇ KOŞUM: ESKİ(mutant+eski alias) → #89-B(mutant+yeni alias)
│                                         #      → YENİ(index.ts+yeni alias). Ortadaki→son fark SADECE #89-A kodu;
│                                         #      deploy kapısı o sütuna bakar, #89-B'nin etkisi karışmaz.
│                                         #    Parser iki index.ts'ten de ÇALIŞMA ANINDA sökülür (#86 dersi).
│                                         #    Mutant yolu: MUTANT=/tmp/mut-89a/index.ts (öntanımlı).
│                                         #    🚨 KAYIP SINIFLANDIRMASI ÜÇ AYRI ŞEY — karıştırma:
│                                         #      YÜKSELTME  = il çifti aynı, ilçe null→dolu. Kayıp DEĞİL, düzeltme.
│                                         #      BİRLEŞME   = aynı il çiftinde şerit SAYISI düştü (iki laneKey birleşti).
│                                         #      AÇIKLANAMAYAN = il çifti tamamen kayboldu → DEPLOY'U DURDURUR.
│                                         #    ⚠️ İlk sürüm yükseltmeyi "dedup birleşmesi" diye ETİKETLİYORDU; yanlıştı.
├── scripts/olc89-ornek-a.json             # #89-Ö sabit örneği — son 36 saatten 35 gerçek çok-satırlı ilan.
│                                         #    📌 `public.olc89_ornek` tablosundan alındı; o tablo sonra DÜŞÜRÜLDÜ.
├── scripts/olc89-alias.json               # #89-Ö alias kümesi — örneğe DOKUNAN 362 aktif alias.
│                                         #    biçim: ["type", alias, normalized, priority, district, bayrak]
│                                         #    bayrak 0=değişmedi · 1=#89-B ilçesini doldurdu · 2=#89-B yeni ekledi
│                                         #    Bayrak sayesinde ESKİ alias durumu geri kurulabiliyor (2'ler atılır,
│                                         #    1'lerin district'i null'lanır) — ölçüm bu yüzden iki tabloya ihtiyaç duymaz.
│                                         # (scripts/sonda-87.mts ✅ SİLİNDİ — 7 Ağu 2026, #34. `test-87.mts` yerini almıştı.)
├── scripts/test-seo-canonical.mts         # `npm run test:seo` (7 Ağu 2026, #33) — 72 kontrol, METADATA BEKÇİSİ.
│                                         #    Hatayı değil HATANIN SINIFINI kilitler: her rota ya kendi
│                                         #    canonical'ını yazacak ya noindex olacak. Kök layout canonical
│                                         #    TAŞIMAYACAK (asıl #33 hatası buydu). canonical GÖRELİ olacak.
│                                         #    🚨 Kaynağı STATİK okur, derleme/ağ İSTEMEZ — kum havuzunda
│                                         #      `next build` `next/font` yüzünden Google Fonts'a çıkamıyor.
│                                         #    🚨 Yorumları SÖKER (`yorumsuz()`): `alternates` kelimesi bu
│                                         #      dosyalarda açıklama metninde de geçiyor (tuzağı yazıya döktük);
│                                         #      ayıklanmazsa "yorumda anlatmış" ile "kodda yazmış" ayırt edilemez
│                                         #      ve bekçi her şeyi yeşil sanardı.
│                                         #    📌 `canonical:` değeri değişken olabilir (`/ilan/[id]` şablon dizesi);
│                                         #      `null`/`undefined` KABUL EDİLMEZ (`/panel` bilerek öyle, onu
│                                         #      noindex kurtarıyor).
│                                         #    4 mutasyonla doğrulandı; `admin` noindex'i bozunca 11 kontrol düşer.
├── lib/ilan-yaz.ts                       # 🚨 ILAN_VER_ANALIZ W0/W1 (29 Tem 2026) — `listings` yazan TEK YOL.
│                                         #    `server-only`. ilanYaz(userId, girdi, kaynak) → ayrık birlik.
│                                         #    Doğrulama + beyaz liste + sınırlar (MAX_DURAK=10, MAX_ARAC_ADET=50,
│                                         #    MAX_FIYAT=1e8, MAX_TON=1e5, MAX_NOT=2000, MAX_RAW_TEXT=8000) ·
│                                         #    ilanTelefonu() (V2: telefon users.phone'dan) ·
│                                         #    V5: public.ilan_olustur() RPC ile ATOMİK ilan+durak yazma ·
│                                         #    V3: audit_score geri okunup getAuditThresholds() ile karar ·
│                                         #    B3: arac_id sahipliği (user_id + is_active) doğrulanır ·
│                                         #    B4: durak bazlı yuk_cinsi, boşsa ilan geneli · bugunISO() (+03:00)
│                                         #    V6 (7 Ağu 2026): tavan + mükerrer kapısı — `lib/ilan-limit.ts` çağrılır.
│                                         #      KANAL_POLITIKA{daimaIncele, tavanCarpani, mukerrerKontrol} ·
│                                         #      kanalTavani() · sonuç tipi `mukerrer?: {id}` ile genişledi.
│                                         #      🚨 Sıra ÖNEMLİ: kapı tarih doğrulamasından SONRA, RPC'den ÖNCE;
│                                         #        sayaç (`ilanTavanIsle`) RPC BAŞARILI olduktan sonra işlenir.
│                                         #    🚨 YENİ İLAN KANALI EKLERKEN INSERT KOPYALAMA, BUNU ÇAĞIR.
├── lib/ai-kota.ts                        # 🚨 V7 (7 Ağu 2026) — ÜCRETLİ LLM çağrısının kotası.
│                                         #    🚨 KAPI İLE SAYAÇ AYNI OLAYI ÖLÇER. Eski hâlde kapı `parse`
│                                         #      anındaydı, sayaç `kayıt` üzerindeydi (`raw_text IS NOT NULL`):
│                                         #      ayrıştırıp KAYDETMEYEN kullanıcı Anthropic'i sınırsız çağırıyordu.
│                                         #    TEK BÜTÇE İKİ KANAL: `/api/parse-text` + `/api/whatsapp` aynı
│                                         #      `ai-parse-kullanici` kovasını KASITLI paylaşır — ikisi de aynı
│                                         #      Anthropic hesabından para harcıyor; ayrı kova limiti ikiye katlardı.
│                                         #    `max(DB, bellek)` — `lib/ilan-limit.ts` ile aynı gerekçe.
│                                         #    §9: `bak()` kaydetmez; `isle()` yalnız çağrı BAŞARILI dönünce.
│                                         #      Sağlayıcı arızası kullanıcının kotasını yakmaz.
├── lib/lane-parser.ts                    # 🆕 7 Ağu 2026 — "yazarak ilan ekle" artık ÖNCE bunu dener.
│                                         #    `supabase/functions/parse-listing/index.ts`teki (Deno) deterministik
│                                         #      (alias tablosu tabanlı, LLM'siz) primitiflerin ELLE SENKRON kopyası —
│                                         #      `lib/whatsapp/telefon.ts` deseniyle aynı gerekçe (Deno kendi klasörü
│                                         #      dışını import edemez). `hizliAyristir()` Deno'nun çok-şeritli broadcast
│                                         #      state machine'i (`parseMessage`) DEĞİL — tek-ilan metni için tedbirli
│                                         #      bir sarmalayıcı: ilişkinin (ok/tire/"'den...'e") İKİ tarafı da alias
│                                         #      tablosundan çözülemezse `null` döner, çağıran Claude'a düşer.
│                                         #    `app/api/parse-text/route.ts` bunu dener; çözerse AI kotasına HİÇ
│                                         #      dokunulmaz (`source:'regex'`), çözemezse mevcut kota+Claude yolu aynen
│                                         #      çalışır (`source:'llm'`).
│                                         #    🚨 NEREDEYSE #71 TEKRARLANIYORDU: `aliases` 1269 aktif satır (>1000
│                                         #      PostgREST sayfa sınırı); `.range()` sayfalama şart, tek sorgu sessizce
│                                         #      keser. `aliaslariGetir()` bunu Deno'daki `aliaslariCek()` ile aynı yapıyor.
│                                         #    ✅ Miras kusur KAPANDI (#93, 7 Ağu 2026) — `detectAdType`'ın
│                                         #      "yuklenecek" anahtar kelimesi hem burada hem Deno'da çıkarıldı,
│                                         #      canlı v91'e deploy edildi. `npm run test:ad-type` bekçisi.
│                                         #    ✅ Yan bulgu KAPANDI (7 Ağu 2026) — `aliases`'ta frigo/frigorifik/frigolu
│                                         #      `type='vehicle'→'body'` taşındı (`docs/20260807_frigo_body_tasima.sql`,
│                                         #      id 230/231/232), öncelik 80→70 (body tavanına eşitlendi). Kod deploy'u
│                                         #      GEREKMEDİ — Deno worker'ı 60 sn TTL'li önbellekten okuyor (#73).
├── lib/ilan-limit.ts                     # 🚨 V6 (7 Ağu 2026) — ilan tavanı + 24 saatlik mükerrer tespiti.
│                                         #    ilanLimitOku() → system_config['rate_limit']['spam_threshold']
│                                         #      (max_listings_per_hour/day), hata → 20/60 fallback.
│                                         #    ilanTavanBak(userId, ayar) · ilanTavanIsle() · mukerrerBul()
│                                         #    🚨 `max(DB, bellek)` — ASLA `sum`. Bellek sayacı (`lib/kota.ts`)
│                                         #      süreç-yerel, soğuk başlangıçta sıfırlanır; DB otoriter ama
│                                         #      eşzamanlı yarışı kaçırır. Toplamak yazılmış ilanı iki kez sayardı.
│                                         #    🚨 TEK DB sorgusu, `count` DEĞİL: son 24 saatin `created_at`
│                                         #      damgaları çekilip saatlik/günlük JS'te sayılır. İki `count`
│                                         #      sorgusunun maliyeti excel'de satır başına çarpılırdı.
│                                         #    📌 §9: bakmak sayacı TÜKETMEZ (`kotaDene({sayma:true})`); sayaç
│                                         #      ancak olay GERÇEKLEŞTİKTEN sonra işlenir.
│                                         #    📌 Mükerrer anahtarı `province_id` ile kurulur — Dalga 5
│                                         #      `listings.origin_city` ve `listing_stops.city` kolonlarını DÜŞÜRDÜ.
│                                         #      `listing_stops.stop_order` 1'DEN başlar (`with ordinality`).
│                                         #    📌 PostgREST `!inner` embed KULLANILMAZ; iki düz sorgu.
│                                         #    ⚠️ excel MUAF (ölçüldü: 90 günde 133 ilanın 81'i haksız engellenirdi —
│                                         #      aynı gün İstanbul→Ankara 10 tır tek anahtara çöküyor). form: 0 hatalı.
│                                         #    ⚠️ excel tavanında `MAX_ILAN` TABANI var: yalnız çarpan olsaydı admin
│                                         #      `spam_threshold`u kısınca (5×5=25 < 50) meşru 50'lik dosya
│                                         #      ortadan bölünür ve yarım import kalırdı.
├── scripts/test-ilan-limit.mts            # `npm run test:ilan-limit` — V6, 11 kontrol. DB İSTEMEZ
│                                         #    (`getServiceSupabase()` env'siz patlar → bellek yoluna düşer).
│                                         #    3 mutasyonla doğrulandı: excel tabanı · §9 · saatlik `>=` kapısı.
├── lib/toplu-yukle-sozlesme.ts           # 🚨 ILAN_VER_ANALIZ B1 (29 Tem 2026) — toplu yükleme
│                                         #    istemci↔route SÖZLEŞMESİ. HamSatir · OnizlemeSatiri ·
│                                         #    OnaySatiri · TopluYukleIstek/Yanit · AlanDurumu ·
│                                         #    MAX_SATIR=300 · MAX_ILAN=50 · SABLON_HEADERS
│                                         #    İki taraf da BURADAN import eder; istemci `satisfies` ile mühürler.
│                                         #    ⚠️ `userId` sözleşmede YOK ve olmayacak — kimlik oturumdan.
├── lib/alias-normalize.ts                # 🚨 SPRINT_01 W5/D2 — alias yazma yolu TEK KAYNAK.
│                                         #    aliasKey() (İ→i, lower, ıçğöşü→icgosu) · trTemizle() ·
│                                         #    normalizeAliasFields() · aliasSatirlariniYukle() (sayfalı,
│                                         #    bayrak filtresi YOK) · aliasCakismaBul() → 409 ·
│                                         #    baskinYazimaHizala() (yalnız AI keşif yolu).
│                                         #    ⚠️ aliasKey() ile D3 indeks ifadesi BİREBİR aynı olmalı ✅
│                                         #    🚨 4 AĞU: :82 normalizeAliasFields DÜZ .toLowerCase() —
│                                         #    :38 aliasKey'in .replace(/İ/g,'i') adımı YOK. İ içeren
│                                         #    alias i+U+0307 yazılıyor → trNorm onu BOŞLUĞA çeviriyor
│                                         #    → sessiz ölü kayıt + uygulama/DB anahtar ayrışması (#45)
│                                         #    ✅ 4 AĞU (#51) ilceIlUyarisi(normalized, district) —
│                                         #      (il, ilçe) çelişki detektörü. İKİ SEVİYE:
│                                         #      `guclu` = ad BAŞKA ilin resmî ilçesi (kanıt)
│                                         #      `zayif` = hiçbir ilin ilçesi değil (bağlam, kanıt DEĞİL)
│                                         #      🚨 BLOK DEĞİL, UYARI — mahalle/belde yazmak meşru
│                                         #      (Merter, İkitelli, Işıkkent). Bloklarsak admin
│                                         #      doğru kaydı ekleyemez.
│                                         #      YAYGIN_ILCE_ESIGI=5: `Merkez` 51 ilde → zayıfa düşer
│                                         #      Test: `npm run test:alias`
├── lib/whatsapp/chatParser.ts            # 📱 TEK KAYNAK sohbet parser (server + client ortak) ✅
│                                         #    ✅ GORUNMEZ_CF + gorunmezleriSil() (4 Ağu, #61) — 9 `Cf`
│                                         #      karakteri, `\u` KAÇIŞIYLA yazılı. 4 Ağu'ya kadar ham
│                                         #      karakterle yazılıydı ve 200C/200D/2060 EKSİKTİ.
│                                         #      🚨 Ham karakterle ASLA yazma: bir formatter silerse
│                                         #        koruma görünmeden ölür, eksiği kimse fark etmez.
│                                         #      🚨 U+FE0F BİLEREK YOK (Mn, emojinin parçası) — çıktısı
│                                         #        raw_posts.message'a ve clean_hash'e girer.
│                                         #      satiriTemizle() = 202f/00a0 → boşluk, sonra Cf sil.
├── lib/whatsapp/__tests__/chatParser.test.ts  # 29 assertion — `npm run test:parser` ✅
├── lib/whatsapp/telefon.ts               # 📱 TEK KAYNAK telefon regex (05XXXXXXXXX) ✅
├── app/api/raw-posts/telefon-doldur/route.ts  # 📱 contact_phone geriye-doldurma (içe aktarmadan AYRI) ✅
├── supabase/functions/parse-listing/index.ts
│                                         # 🚨 :150 VEKİL TEMİZLİĞİ — cleanMessage'ın İLK satırı, #86 (6 Ağu).
│                                         #    Amaç: JSON'u bozan EŞSİZ (yalnız) UTF-16 vekillerini atmak.
│                                         #    ESKİ HÂLİ `/[\uD800-\uDFFF]/g` İDİ ve YANLIŞTI: `u` bayrağı
│                                         #      olmayan sınıf KOD BİRİMİ bazında uygulanır, GEÇERLİ çiftin
│                                         #      iki yarısı ayrı ayrı eşleşir → BMP-üstü TÜM emojiler
│                                         #      (👉 D83D+DC49 · 📍 · 🔹 · 🚛) BOŞLUK BIRAKMADAN siliniyordu.
│                                         #    İki sonucu: (a) aşağıdaki :149 kuralı ÖLÜ KODDU (v79),
│                                         #      (b) "MERSİN👉İRAN" → "MERSİNİRAN" token yapışması.
│                                         #    ➡ (U+27A1) BMP'de olduğu için etkilenmedi — tutarsızlığın
│                                         #      yıllarca fark edilmeme sebebi bu.
│                                         #    DOĞRUSU: yalnız eşsiz vekiller —
│                                         #      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g
│                                         #    Aynı hata 4 dosyadaydı (llm-parse · crm/analiz · learn-aliases).
│                                         #    Koruma: `npm run test:clean` · Ölçüm: `npm run olc:86`
│                                         # 🔀 cleanMessage() AYRAÇ SIRASI KRİTİK — ok/işaret dönüşümü
│                                         #    emoji-strip'ten (:169) ÖNCE olmak ZORUNDA, yoksa ayraç
│                                         #    boşluğa dönüp kaybolur. (Vekil temizliği ise HEPSİNDEN önce
│                                         #    çalışır — #86'nın bu kadar yıkıcı olmasının sebebi oydu.)
│                                         #    :158 ➡➜➔⟶⏩⏪▶◀⇒⇔ → "->" (koşulsuz)
│                                         #    :162 👉📍 → " -> " AMA yalnız İKİ YANI HARFSE
│                                         #    :164 =   → " -> " aynı şart ("Tlf=0544…" elensin)
│                                         #    🚨 "/" AYRAÇ DEĞİL, BİLİNÇLİ: veride baskın kullanımı
│                                         #      ilçe/il ("Kartal / İstanbul"). Ayraç yapmak gerçek
│                                         #      olmayan hat üretir. Ölçüm: YAPILACAKLAR.md #63.
│                                         #    ⚠️ EŞİ: app/api/whatsapp-parse/route.ts normalizeArrows()
│                                         # 🚨 parseMessage PASS 2 ("YÜKLEMELİ blok") — #88, 6 Ağu 2026.
│                                         #    Kural: `yükle*` satırı blok KÖKENİNİ kurar, altındaki satırlar
│                                         #    VARIŞ olur; blok bir "ilişki satırı" görünce resetlenir.
│                                         #    İki hata bu bloğu sessizce koparıyordu, ikisi de düzeltildi:
│                                         #    #88-A yersiz `yükle*` satırı (yüklenmez/yüklenir/üstene…) köken
│                                         #      NULL'luyordu → artık `if (!yeniOrigin) continue`, blok bozulmaz.
│                                         #    #88-B reset koşulu `splitByRelation(line) !== null` ile boşluksuz
│                                         #      tireyi geri sokuyordu ("(KISA-UZUN) DORSE") → artık ilişkili satır
│                                         #      ancak `findPlaces(line).length > 0` ise resetler.
│                                         #    📌 BLOCK_RESET_RE boşluksuz tireyi BİLEREK dışarıda bırakır;
│                                         #      splitByRelation ise bırakmaz — ikisini "veya"lamak tuzaktı.
│                                         #    Koruma: `npm run test:pass2` · Ölçüm: `npm run olc:88`
│                                         # 🚨 parseMessage PASS 1 — SOLU BOŞ OK (#87, 6 Ağu 2026).
│                                         #    splitByRelation'ın ok kolu `if (left && right)` istiyordu; "➡️SAMSUN"
│                                         #    gibi satır NULL dönüyordu. Sonuç: parseMessage:646'daki "ok solunda
│                                         #    şehir yoksa contextFrom kullan" YEDEĞİ HİÇ ÇALIŞMADI — ölü koddu.
│                                         #    Satırlar Pass 2 / Pass 3 / iki-şehir fallback'ine düşüp KAZARA ve
│                                         #    SIRAYA BAĞLI kurtarılıyordu; sonuç uydurma veya eksik şerit.
│                                         #    #87-A: `if (right)` — solu boş ok artık ilişki sayılır.
│                                         #    #87-B: `bestPlace(findPlaces(rel.left)) || contextFrom` — sol DOLU
│                                         #      ama yersizse de ("13.60 TIR -> ANKARA") satır düşmez.
│                                         #    #87-D: `+` kolu artık İKİ parçada tanınan yer ister; "1200+kdv"
│                                         #      fiyat satırı çoklu varış sayılmaz (99183fb8'de 2 uydurma şerit).
│                                         #    📌 #87-C (Pass 2'ye "solu boş ok resetlemesin" muafiyeti) YAZILDI,
│                                         #      ÖLÇÜLDÜ, GERİ ALINDI — çıktı bit bit aynı kaldı. Sebep: Pass 1:617
│                                         #      (`if (nonRelHits.length > 0) contextFrom = …`) kökeni zaten kurar.
│                                         #      index.ts'te `📌 #87 NOTU` yorumu var; TEKRAR DÜZELTMEYE KALKMA.
│                                         #    🏷️ index.ts'te `+` kolu yorumu kendini "#87-B" diye etiketliyor;
│                                         #      kanonik ad #87-D (test ve dokümanlarda böyle).
│                                         #    Koruma: `npm run test:87` · Ölçüm: `npm run olc:87`
├── proxy.ts
│   └── api/ilanlar/[id]/route.ts       # Public AI-readable API ✅
├── public/robots.txt                   # 🔍 SPRINT_01 S4 — 4 blok (*, GoogleBot, GPTBot, ClaudeBot),
│                                       #    disallow listeleri BİREBİR AYNI olmak zorunda ✅
└── docs/
```

---

## 3. VERİTABANI ŞEMASI (public.*)

### `pois` — POI Modülü (Yol Rehberi)
```
-- Yeni (17 Haz 2026) 2 kademeli yapı:
Ana Kategori           | Alt Kategoriler (category değeri)
Akaryakıt & Enerji     | akaryakit_istasyonu, elektrik_sarj
Park & Konaklama       | tir_parki, otel_pansiyon
Tamir & Bakım          | motor_mekanik, lastikci, elektrik_takograf, branda_dorse, yikama_yaglama, acil_yol_yardim
Yeme & İçme            | dinlenme_tesisi, esnaf_lokantasi
Operasyon Noktaları    | kantar, nakliyeciler_sitesi, gumruk_sinir, antrepo_depo
-- Eski (backward compat): motorcu, elektrikci, kaportaci, dorse_branda, frigo_ustasi,
--   lokanta, konaklama, yikama, park_dinlenme, yemek, tamirci, tesis_akaryakit, kantar_resmi
-- Migration: docs/20260617_poi_kategori_guncelleme.sql
location: geography(Point,4326) — PostGIS
tags: text[] — özellik etiketleri
badges: jsonb — tır uygunluk rozetleri
status: 'pending'|'approved'|'rejected'
avg_rating, review_count — trigger ile güncellenir
-- Google Places entegrasyonu (15 Haz 2026):
google_place_id: text UNIQUE — mükerrer kayıt engeli
google_maps_url, google_rating, google_review_count
reviews_summary: text — Claude API Türkçe özet (maks 3 cümle)
verified: bool — admin onayı (default false)
verified_at, verified_by
satellite_confirmed: bool — uydu görüntüsü teyidi
last_synced_at: timestamptz — son Places API sync
is_active: bool — kullanıcıya gösterim (default true)
```
Migration: `docs/20260615_poi_google_integration.sql`

### `poi_reviews`
```
rating (1-5), comment, quick_tags (text[])
category_ratings: jsonb — Faz 2 için boş, şimdilik NULL
is_verified_visit: bool — geo-fence 200m kontrolü
review_type: 'verified'|'guest'
UNIQUE(poi_id, user_id)
```

### `poi_visit_logs` — Geo-fence için GPS geçmişi
### `poi_stay_events` — 3 saat+ park takibi (contextual öneri)

### RPCs:
- `get_pois_in_bbox(...)` — Bounding Box + akıllı sıralama formülü
- `check_poi_visit(...)` — 200m geo-fence doğrulama
- `get_nearby_listings_for_parked_driver(city)` — Contextual yük önerisi
- `get_parked_drivers_for_notification()` — Cron: 3h+ parkta bildirimi bekleyenler

Migration: `docs/20260610_poi_module.sql`

### `listings`
```
moderation_status: 'pending'|'approved'|'rejected'|'auto_published'|'archived'|'correction_needed'
status: 'active'|'passive'|'completed'|'expired'
is_shadow_banned, audit_score, internal_audit_logs (JSONB)
user_id (nullable)
source — 🚨 listings_source_check: 'form'|'excel'|'whatsapp'|'facebook' (31 Tem 2026'da
         canlıdan okundu). `'manual'`/`'telegram'` BURADA YOK; onlar `raw_posts.source`.
         TS karşılığı `lib/ilan-yaz.ts` → `IlanKaynak`; ikisi birebir aynı kalmalı.
shadow_profile_id (nullable FK → shadow_profiles.id) — kayıtsız kullanıcı ilanları için
vehicle_id (nullable FK → vehicles.id, on delete set null) — ILAN_VER_ANALIZ B3 (29 Tem 2026)
contact_phone — 🔒 anon/authenticated için REVOKE edildi (SPRINT_01 L1e). Yalnız service-role.
origin_province_id (nullable FK → provinces.id) — 30 Tem 2026, backfill %100 (234.229 satır).
                    ✅ 6 Ağu 2026'dan beri KALKIŞ İLİNİN TEK KAYNAĞI. Dört yazma yolunun
                    dördü de ölçüldü (form/excel/whatsapp/moderatör).
origin_district_official (nullable bool) — true=resmî ilçe, false=serbest giriş (İkitelli, İSTOÇ)

🚫 origin_city — DÜŞTÜ (6 Ağu 2026, Dalga 5). Bu kolon ARTIK YOK.
   Yedeği: public.dalga5_yedek_20260806 (234.840 satır, ≥6 Eyl 2026'ya kadar saklanır).
   ⚠️ `origin_city` ADI KODDA HÂLÂ GEÇER ve bu DOĞRUDUR: `ilan_olustur` jsonb GİRDİ
      anahtarı, LLM JSON şema alanı ve bazı RPC'lerin `provinces.name as origin_city`
      ÇIKTI takma adı. Bunları "kalıntı" sanıp temizlemeye kalkma — ilan oluşturma kırılır.
```
> 🗺️ **İL ARTIK YALNIZ ID (Dalga 1→5 tamam, `docs/COGRAFI_GECIS.md`).** Çift yazım dönemi
> **bitti**; `lib/lokasyon.ts::ilCiftYazim()` çağrısı artık gerekmiyor. Okuma yollarının
> hepsi (`HomeClient` varış filtresi, radar RPC'leri) `province_id` üzerinden çalışıyor.
> 📌 Geçmiş kayıt: bu dönemde metne bakan filtreler yüzünden `origin_city='istanbul'`
> yazımlı **22.474 ilan** ana sayfa filtresinde görünmez kalmıştı — geçişin asıl sebebi buydu.
> 🚨 Yeni iki kolona GRANT **elle verildi** (migration Adım 4) — L1e sonrası her yeni kolon
> `anon`/`authenticated` için yetkisiz doğuyor.

### `districts` — 973 ilçe (4 Ağu 2026, CANLI)
```
id smallint identity PK · province_id smallint NOT NULL FK → provinces.id · name text NOT NULL
districts_il_key_uniq  UNIQUE (province_id, il_key(name))    -- aynı ilde aynı ilçe iki kez yazılamaz
districts_ad_key_idx   (il_key(name))                        -- ada göre arama
RLS açık · SELECT herkese (anon, authenticated) · yazma yok
```
> 🚨 **TÜRETİLMİŞ VERİ**, kaynağı `provinces` ile aynı: `lib/constants/locations.json`.
> Elle satır ekleme. Migration: `docs/20260731_districts_tablosu.sql` (bölüm 1-3 çalıştırıldı).
> ✅ **Ayrışma denetimi otomatik: `npm run test:districts`** (`scripts/test-districts.mts`,
> 4 Ağu). JSON ile migration dosyasını çift yönlü karşılaştırır. ⚠️ **Canlı tabloyu OKUMAZ** —
> elle eklenen satırı görmez, o yüzden elle ekleme yasağı hâlâ tek savunma.
> ⚠️ **`district_id` KOLONU YOK ve eklenmeyecek.** İlçe adı tek başına tekil değil —
> `Merkez` 51 ilde, 24 ad daha iki-üç ilde. `provinces_il_key_uniq`'in verdiği tek satır
> garantisi ilçede YOK, dolayısıyla "metinden id çöz" adımı sessizce yanlış il seçer.
> Tablo bir **doğrulama sözlüğü**: "bu il için bu ilçe var mı?".
>
> ⚡ **`public.ilce_resmi(p_province_id smallint, p_district text) → boolean`**
> `district_official`ın DB tarafındaki türeticisi. `sql stable parallel safe`,
> `search_path = public`, EXECUTE anon/authenticated/service_role'da.
> İl NULL ya da ilçe boşsa **`null`** döner — "ilçe girilmemiş" ile "girilen ilçe resmi
> değil" farklı sorular. Ankara **ve** Adıyaman `Gölbaşı` için ikisi de `true`: fonksiyon
> "hangi il?" sorusunu cevaplamıyor.
> ✅ Canlı veriye karşı çapraz doğrulandı: `district_official` dolu 62 durakta kolon ile
> fonksiyon 58 `(true,true)` + 4 `(false,false)`, çapraz satır yok.
> ✅ **`ilan_olustur` ENTEGRASYONU CANLIDA (4 Ağu, #50)** —
> `docs/20260804_ilan_olustur_v41_ilce_resmi.sql`. Rollback'li doğrudan çağrıyla
> doğrulandı: `Gebze true` · `Tuzla true` · `Merter false` · ilçesiz durak `null`. İki yerde
> `coalesce(nullif(çağıranın değeri), public.ilce_resmi(...))`; sıra kasıtlı,
> **çağıranın açık değeri kazanır**. Bugün ikinci bacağın fiilen çalıştığı TEK yol
> `parse-listing`:848 — Deno `locations.json`'a erişemediği için bu alanı hiç
> göndermiyor. WhatsApp hattı ilanların çoğunu ürettiği için no-op değil.
> 🔑 **"Dalga 5 ile aynı anda yapılmalı" gerekçesi ÖLDÜ ve karar onunla ölmedi.**
> Gerekçe "fonksiyon iki kez elden geçmesin"di; v4 3 Ağu'da Dalga 5'ten bağımsız
> çıkınca (#26) ikinci geçiş zaten kaçınılmaz oldu. Değişiklik `district_official`e
> dokunuyor, `origin_city`/`city`ye değil → **kolon drop'undan bağımsız, tek başına
> çıkar.** 📌 Ertelenmiş her iş, ertelenme SEBEBİ hâlâ geçerli mi diye yeniden okunmalı.
> ⚠️ **Tuzak — "resmi değil" ≠ "hata".** `Merter`, `Etlik`, `Işıkkent`, `Hadımköy` mahalle;
> `Eminönü` 2008'de Fatih'e katıldı. Hepsinde `false` DOĞRU cevap. Ayrıca yazım tek kaynağa
> bağlı: `Marmara Ereğlisi` `false` döner çünkü JSON'da bitişik — `Marmaraereğlisi`.
> `false` dönen bir satırı düzeltmeden önce hangi sınıfta olduğuna bak.

### `provinces` — 81 il (30 Tem 2026)
```
id smallint PK (1-81, plaka kodu) · plate char(2) · name text
```
> 🚨 **TÜRETİLMİŞ VERİ.** Kaynağı `lib/constants/locations.json`. Elle satır ekleme/düzenleme
> YAPMA — JSON'u değiştir, migration bloğunu yeniden üret, `npm run test:lokasyon` çalıştır.
> Sözleşme: `id = locations.json index + 1 = ILLER index + 1`. Biri yeniden sıralanırsa DB'deki
> TÜM `province_id`'ler sessizce yanlış ile işaret eder — hiçbir yerde patlamaz. Test bunu yakalar.
> ~~**İlçe için tablo AÇILMADI** (bilerek)~~ → **4 Ağu 2026'da AÇILDI**, aşağıdaki
> `districts` bölümüne bak. Eski gerekçe ("her okumaya JOIN ekler") hâlâ geçerli ve bu
> yüzden `district_id` kolonu YOK; açılan şey okuma yoluna değil **doğrulamaya** hizmet
> ediyor. İlçe metin olarak kalıyor.
> `public.il_key(text)` — `lib/ilan-sabitler.ts::ilKey()` ve `lib/alias-normalize.ts::aliasKey()`
> ile **birebir aynı olmak zorunda**. `İ` (U+0130) ÖNCE düz `i`ye çevrilir.
> 🚨 **YAZMA YOLU TEK** (29 Tem 2026, `ILAN_VER_ANALIZ` W0/W1). Uygulamada `listings` INSERT'i
> **kopyalanmaz**. İki katmanlı bir kural:
> - **Next tarafındaysan → `lib/ilan-yaz.ts` / `ilanYaz()`.** Kanallar: `/ilan-ver` tekil form
>   (`app/ilan-ver/actions.ts` → yalnız auth kapısı), `/api/excel-import` toplu yükleme,
>   `app/api/whatsapp/route.ts` Twilio webhook'u.
> - **`ilanYaz()` kullanılamıyorsa → doğrudan `ilan_olustur()` RPC'si.** İki yol böyle:
>   `app/moderator/actions.ts` → `moderatorIlanOlustur()` (manuel giriş; `user_id` NULL ve
>   telefon profilden değil metinden geldiği için `ilanYaz()`'ın V2 sözleşmesine uymaz) ve
>   `supabase/functions/parse-listing/index.ts` (Deno; TS modülünü import EDEMEZ).
>
> Kendi iki ayrı INSERT'ini yazan bir yol, W0/W1'de kapatılan V1/V3/V5 deliklerini yeniden
> açar — excel-import'ta, WhatsApp webhook'unda ve moderatör panelinde tam olarak bu olmuştu.
>
> 🚨 **AMA `ilan_olustur()` YALNIZ INSERT YOLUNU KAPSIYOR — UPDATE YOLU KAPSAM DIŞI.**
> `app/moderator/page.tsx::duzenleKaydet()` tarayıcıdan doğrudan UPDATE atıyor ve bu
> yüzden RPC'nin "province_id'yi metinden kendim türetirim" garantisinden YARARLANMIYOR.
> 30 Tem 2026'da bulundu: moderatör kalkış ilini düzeltince `origin_city` değişiyor,
> `origin_province_id` **eski değerde kalıyordu**. Dalga 3 okuma yollarını id'ye çevirdiği
> için bu düzeltmeler radar/nearby'ye hiç işlemeyecekti. Düzeltildi — `duzenleKaydet()`
> artık `ilCiftYazim()` + `ilceNormalize()` ile hem metni kanonikleştiriyor hem id yazıyor,
> duraklar dahil; ayrıca tanınmayan il varsa **hiçbir şey yazmadan** çıkıyor (yarım yazım yok).
> **Ders: "yazma yolu" denince UPDATE'leri de say.**
>
> 🚨 **İDEMPOTENT DEĞİL — AYNI `raw_post_id` İKİNCİ KEZ GÖNDERİLİRSE KOPYA İLAN DOĞAR**
> (7 Ağu 2026, #90). Gövdede `on conflict` **yok** (`pg_get_functiondef` üzerinde sayım = 0),
> `listings.raw_post_id` üzerindeki `idx_listings_raw_post` **UNIQUE değil**, tek kısıt
> yabancı anahtar. Yani `parse_listing_gonder(raw_post_id)` ile geriye dönük yeniden
> parse **onarım değil ÇOĞALTMADIR**. 3.745 `raw_post`'a toplu tetikleme 7 günlük
> veriyi ikiye katlar. Geriye dönük yeniden işleme isteniyorsa önce fonksiyona
> "önceki ilanları aynı transaction'da sil, yeniden üret" kipi eklenmeli.
> ⚠️ Ders: **bir yazma yolunun idempotent olduğunu varsayma, RPC'nin tanımına bak.**
> `raw_post_id` alanının var olması "bu satır o post'un tekil karşılığıdır" demek değil;
> tekilliği garanti eden şey kolonun varlığı değil ÜZERİNDEKİ KISITTIR.
>
> ⚡ **`public.ilan_olustur(p_listing jsonb, p_stops jsonb) → jsonb`** (29 Tem 2026, V5).
> İlan + duraklarını TEK transaction'da yazar, trigger'ın hesapladığı
> `id, audit_score, moderation_status, is_shadow_banned` ile döner. `security invoker`
> (bilerek — `definer` olsaydı ayrıcalık yükseltme yüzeyi olurdu), EXECUTE yalnız
> `service_role`da. Migration SIRASI: `docs/20260729_ilan_olustur_rpc.sql` →
> `docs/20260729_listings_vehicle_id.sql` (kolon + `create or replace` ile RPC'yi tazeler) →
> `docs/20260729_ilan_olustur_v2.sql` → `docs/20260730_ilan_olustur_v3.sql` (⏳ **bekliyor**).
> **v3 (30 Tem 2026, coğrafi Dalga 2)** `origin_province_id`, `stops[].province_id` ve
> `*_district_official` yazıyor. 🔑 id'yi çağırandan İSTEMİYOR: `origin_city`/`stops[].city`
> metnini `public.il_key()` ile katlayıp `provinces`'tan **kendisi çözüyor**, sonra metni de
> kanonik ada çeviriyor. Çağıran açıkça `province_id` gönderirse o kazanır. Bu sayede jsonb
> ayrışma tuzağı (aşağıdaki uyarı) `province_id` için devre dışı — çağıran unutsa bile alan
> doluyor — ve Deno'daki `parse-listing` hiç değişmeden doğru yazıyor.
> **v2 (29 Tem 2026, W1+)** dört OPSİYONEL alan ekledi — `raw_post_id`, `shadow_profile_id`,
> `is_repost`, `reviewed_at` — böylece moderatör paneli ve Edge Function da bu RPC'yi
> kullanabiliyor. Ayrıca `listing_stops.vehicle_count` artık ÖNCE durağın kendi değerine
> bakıyor, yoksa ilan geneline (`arac_adet`) düşüyor; `moderation_status`/`status`/
> `trust_level` alan gelmezse `pending`/`passive`/`social`'a coalesce ediliyor.
> 🚨 **RPC'ye kolon eklerken ÜÇ çağıranı birlikte güncelle:** fonksiyon gövdesi,
> `lib/ilan-yaz.ts`, `app/moderator/actions.ts`, `supabase/functions/parse-listing/index.ts`.
> Fonksiyon jsonb aldığı için ayrışma **derleme zamanında görünmez** — alan sessizce NULL
> yazılır. Edge Function `tsconfig.json`'da `exclude`'da olduğu için `tsc` onu HİÇ görmez.
> ⚠️ `contact_phone` (28 Tem 2026, `SPRINT_01` L1e): PostgREST kolon yetkisi `anon` ve
> `authenticated` rollerinden alındı. İstemci tarafı hiçbir `select`/`update`/`insert`
> bu kolonu içeremez → `42501 permission denied`. Okuma/yazma yolları:
> `app/api/ilan/[id]/telefon`, `app/api/ilan/[id]/sahiplen`, `app/ilan/[id]/page.tsx`,
> `app/panel/actions.ts`, `app/moderator/actions.ts`. Migration:
> `docs/20260728_contact_phone_revoke.sql` ✅ çalıştırıldı (29 Tem 2026).
> 🚨 Migration `contact_phone` hariç **o anki** kolonlara grant verdi → `listings`'e sonradan
> eklenen kolonlar `anon`/`authenticated` için yetkisiz doğar. Yeni kolon = elle grant.

### `listing_stops` — 🚨 GÜZERGÂH ŞEMASI (varışlar burada)
```
listing_id (FK → listings.id), stop_order (1..n)
district (nullable) — ⚠️ HÂLÂ SERBEST METİN, ilçe tarafında yazım tuzağı sürüyor
province_id (nullable FK → provinces.id) — ✅ 6 Ağu 2026'dan beri DURAK İLİNİN TEK KAYNAĞI
district_official (nullable bool) — true=resmî ilçe, false=serbest giriş
cargo_type, weight_ton, pallet_count, vehicle_count, notes

🚫 city — DÜŞTÜ (6 Ağu 2026, Dalga 5). Bu kolon ARTIK YOK.
   Yedeği: public.dalga5_yedek_stops_20260806 (245.086 satır, ≥6 Eyl 2026'ya kadar saklanır).
   ⚠️ `city` ADI KODDA HÂLÂ GEÇER ve DOĞRUDUR: `ilan_olustur`ın `p_stops` jsonb GİRDİ
      anahtarı (`t.s->>'city'`) ve radar RPC'lerinin `p.name as city` ÇIKTI takma adı.
```
> 🚨 **Çıkış tek, varış çok.** Kalkış `listings.origin_province_id` / `origin_district`'te tek satır
> olarak durur; **uğrama/varış noktalarının hepsi `listing_stops` satırlarıdır.** Bir güzergâhı
> tek tabloda aramak yanlış sonuç verir.
> - Yazan: `supabase/functions/parse-listing/index.ts` (`ilan_olustur` RPC'si, lane grubu → `p_stops`),
>   `app/panel/actions.ts:96-157` (önce `delete .eq('listing_id')` sonra toplu insert — yani
>   duraklar **replace** ediliyor, patch değil).
> - Okuyan: **`/api/listings/ara`** varış filtresi — `listing_stops.province_id` tamsayı eşitliği
>   (Dalga 3, 31 Tem 2026). ⚠️ Bu ~~eskiden `HomeClient.tsx:696` `d.sehir?.includes(varis)`~~ idi;
>   `includes` büyük/küçük harfe duyarlı olduğu için `ÇORLU` yazılmış bir durak "Çorlu"
>   aramasında hiç çıkmıyordu. **Artık yazım bozulması varış filtresini etkilemez** —
>   `province_id` metinden bağımsız. Durak İLÇESİ hâlâ serbest metin, o tarafta tuzak sürüyor.
> - `get_nearby_listings_by_province(p_province_id int, p_district text, p_limit int)` RPC
>   varışı `listing_stops`'un **son durağından** `DISTINCT ON` ile alıyor.
>   ⚠️ Burada 6 Ağu 2026'ya kadar **`get_nearby_listings_by_city`** yazıyordu — öyle bir
>   fonksiyon **yok** (`42883` ile öğrenildi). Ad Dalga 1'de değişmiş, harita güncellenmemiş.
>   İmza da üç parametreli; iki parametreyle çağırmak yine `42883` verir.
>
> 🚫 **`listings.destination_city` DİYE BİR KOLON YOK** (31 Tem 2026'da 42703 ile öğrenildi).
> Burada 29 Tem'den beri "ÖLÜ KOLON" yazıyordu — yanlıştı. Ölü değil, **hiç var olmamış**.
> `information_schema.columns` teyit etti. Varış verisi tamamen `listing_stops` satırlarında.
> ⚠️ Fark önemli: "ölü" onu var sayar, "yok" saymaz. Yaklaşık 10 belge bu kolonu var sayarak
> yazılmış ve **ikisi ona `UPDATE` atıyor**
> (`docs/20260728_alias_kopya_temizligi.sql`:288, `docs/20260728_alias_homonim_temizligi.sql`:261)
> — çalıştırılsalardı 42703 verirlerdi.
> ✅ **TEMİZLİK BİTTİ (3 Ağu 2026, #32).** Mit dokuz belgeden söküldü:
> `20260728_alias_kopya_temizligi.sql` (BÖLÜM 6 gerekçesi + yorumdaki UPDATE'lere `← 42703`),
> `20260728_alias_homonim_temizligi.sql`:261 ("aynısını destination_city için de çalıştır"
> satırı ÇALIŞTIRMA uyarısına ve doğru `listing_stops.city` sorgusuna çevrildi),
> `COGRAFI_GECIS.md`:222 (Dalga 5 drop maddesi üstü çizildi), `20260729_alias_runbook.md`
> (Adım 0.4 sorgusu yoruma alındı · sonuç tablosu · "sırada" satırı · Adım 8 gerekçesi ·
> Adım 8.3 tamamen düştü · Dalga 5 drop listesi ve etkileşim tablosu),
> `W5_DEVIR.md`, `SPRINT_01.md`, `YAPILACAKLAR.md` (3 yer), `PROJE_HARITASI.md`:1130-1131.
> `20260731_index_temizligi.sql`'deki `destination_city` desenleri **bilerek bırakıldı** —
> arama deseni olarak zararsız (var olmayan kolon hiçbir tanımda eşleşmez); başına
> "bu desen kolonun var olduğu anlamına gelmez" notu düşüldü.
> 🚨 Düzeltmelerde ortak kalıp: yanlış cümle silinmedi, **yanında bırakıldı**. Çünkü mitin
> kendisi kadar öğretici olan şey nasıl yayıldığı: her belge bir öncekinden alıntıladı,
> hiçbiri kolonun VARLIĞINI sormadı.
> Alias onarımı için yine `docs/20260729_alias_runbook.md` Adım 8 kullanılır (canlı
> `listing_stops.city`'yi de kapsıyor).
> 📌 **DERS:** "kodda geçmiyor" ≠ "içinde veri yok" ≠ **"kolon var"**. Bir nesne hakkında
> ölçüm planlamadan önce **varlığını** doğrula; yoksa yokluğu "boş" sanılır.
>
> ⚖️ **Aynı şehir içi taşıma meşrudur.** `origin_city = stops.city` bir bozukluk sinyali
> **değildir**. Sahte güzergâh parmak izi şudur: *katlanmış anahtar eşit, ham yazım farklı*
> (`Istanbul` → `İstanbul`). Ölçüm sorguları runbook Adım 0.1 / 0.2'de.

### `shadow_profiles` — Gölge Profil / CRM
```
phone (unique, +90 normalize), name, company_name, notes, status: 'active'|'blocked'|'converted'
converted_user_id (nullable FK → auth.users.id)
```
- Migration: `docs/20260601_shadow_profiles_crm.sql`
- Upsert RPC: `upsert_shadow_profile(p_phone text) → uuid`
- View: `shadow_profile_summary` (listing_count, last_listing_at, first_listing_at)
  🔒 **29 Tem 2026:** `security_invoker = on` + yetki yalnız `service_role`. Eskiden
  `authenticated`'a açıktı ve view sahibinin yetkisiyle çalıştığı için tablonun
  admin-only RLS'ini bypass ediyordu — her üye tüm telefonları çekebiliyordu.
  Migration: `docs/20260729_shadow_profile_summary_invoker.sql`. Tek tüketici
  `app/api/admin/crm/route.ts` (requireAdmin + service-role), etkilenmez.
- Admin UI: `/admin/crm` — tablo + detay drawer (ilan geçmişi, isim/not/şirket düzenleme, durum yönetimi)
- API: `app/api/admin/crm/route.ts` (GET + PATCH), `app/api/admin/crm/[id]/route.ts` (GET detay)

#### Sayaç kolonları ve onları yazan trigger (5 Ağu 2026, #67 — YENİDEN YAZILDI)
`listing_count` · `last_listing_at` · `first_listing_at` kolonlarını `listings` üzerindeki
`listings_sync_shadow_profile_stats` (AFTER INSERT OR DELETE OR **UPDATE OF shadow_profile_id**)
doldurur. Kolon kapsamlı olduğu için `status`/`updated_at` yazan süre-dolumu cron'u bu
trigger'ı **tetiklemez**.

🚨 **Eski gövde ilan başına ÜÇ toplama sorgusu koşuyordu** (`COUNT` + `MAX(created_at)` +
`MIN(created_at)`, hepsi ayrı altsorgu). Ölçüldü — en yoğun profil (3 556 ilan) için tek
sorgu `Execution Time: 3096.881 ms`. Plan: `Bitmap Index Scan` **25.7 ms**,
`Bitmap Heap Scan` **3 092 ms**, `Heap Blocks: exact=2977`, `Buffers: hit=1403 read=1586`.
Yani maliyet indeks değil **HEAP erişimi**: `max/min(created_at)` indekste yok, 2 977 blok
ziyaret ediliyor, 1 586'sı diskten. Maliyet profilin büyüklüğüyle orantılı — ölçümdeki
iki tepeli dağılımın (268 ms vs 5 403 ms) sebebi bu.

Yeni gövde: INSERT dalı **O(1)** (`listing_count + 1`, `greatest`/`least` ile tarihler,
heap'e hiç dokunmaz). DELETE ve profil DEĞİŞİKLİĞİ dalları `sync_shadow_profile_yeniden_say(uuid)`
ile tam yeniden sayar. UPDATE dalı `is not distinct from` ile erken çıkar.
⚠️ **TAKAS:** eski gövde her INSERT'te `COUNT(*)` attığı için kendi kendini onarıyordu,
yeni gövde artımlı — onarmıyor. Karşılığı `shadow-profile-recount` cron'u (`0 3 * * *`,
canlıda doğrulandı). Bu cron olmadan trigger'ın bu hâli kullanılmamalı.
📄 `docs/20260805_stats_trigger_o1.sql`

#### 🚨 RLS + trigger tuzağı — `SECURITY DEFINER` OLMAYAN TRIGGER SESSİZCE 0 SATIR YAZAR
`shadow_profiles` üzerinde RLS **açık** ve tek politika var: `shadow_profiles_admin_all`
(ALL, permissive, `{authenticated}`, USING/CHECK = `exists(select 1 from users where
users.id = auth.uid() and users.role = 'admin')`). `anon` için hiç politika yok,
admin olmayan `authenticated` için koşul false. `postgres` ve `service_role`'da
`rolbypassrls = true`, diğer ikisinde yok.
Sayaç trigger'ı `SECURITY DEFINER` **değildi** → RLS'e tabi bir rolle gelen INSERT'te
`UPDATE shadow_profiles ... where id = ...` **0 satır etkiliyor, hata vermiyor**.
Sürüklenen 5 profilin ve daha önce açıklanamayan **-29**'un sebebi budur.
✅ Düzeltildi (5 Ağu, migration `shadow_profile_sayac_trigger_security_definer`):
her iki fonksiyon `security definer` + `set search_path = public, pg_temp`;
`sync_shadow_profile_yeniden_say(uuid)` üzerindeki EXECUTE `public`/`anon`/`authenticated`'tan
geri alındı. Doğrulama: `prosecdef = true`, `proconfig = {search_path=public, pg_temp}`,
tam yeniden sayım sonrası `hala_sapan = 0`.
> **GENEL KURAL — yeni trigger yazarken:** RLS açık bir tabloya yazan her trigger
> fonksiyonu `SECURITY DEFINER` + pinlenmiş `search_path` olmalı. Aksi hâlde yazma
> **sessizce** düşer; `UPDATE` hata atmaz, sadece 0 satır etkiler.
> 🟠 Aynı sınıftan ikinci kayıt: `update_poi_rating` (`poi_reviews` üzerinde trigger,
> RLS'li `pois`'e yazıyor, `SECURITY DEFINER` değil). `pois`'te anon/authenticated için
> UPDATE politikası yok. **Şu an uykuda: `poi_reviews` 0 satır** (`pois` 9 178). Düzeltilmedi.

ℹ️ **Okuma tarafı sonucu:** `shadow_profiles` `anon` ve admin olmayan `authenticated` için
**tamamen görünmez**. İstemciden bu tabloya yapılan her SELECT boş döner — hata değil, boş.

### `users` — `role`, `is_active`, `user_type`, `phone_verified`, `company_name`, `ai_listing_quota_daily` (NULL = sistem default), `kvkk_onay_at`
> `kvkk_onay_at timestamptz` (28 Tem 2026, `SPRINT_01` K1) — KVKK aydınlatma metni + kullanım koşullarının onay anı. NULL = onay alınmamış (eski kayıt). `profil-tamamla` upsert'i yazıyor. ✅ Migration `docs/20260728_kvkk_onay.sql` çalıştırıldı (29 Tem 2026). Eski kullanıcılardan onay toplamak ayrı iş (panele tek seferlik modal gerekiyor, ticket açılmalı).
> ✅ `is_active` (29 Tem 2026 doğrulandı): DB default `true`, kolon nullable ama NULL satır yok.
> İstemci artık bu alanı **göndermiyor** (K2 beyaz listesinde yok) — default devreye giriyor.
> ⚠️ Kolon nullable olduğu için `.eq('is_active', true)` NULL satırları sessizce atlar.
> Opsiyonel sertleştirme: `alter table public.users alter column is_active set not null;`

### `auth_events` — Auth denetim izi (28 Tem 2026, `SPRINT_01` A1/A1b)
```
event      — giris_basarili | giris_hatali | otp_gonder | otp_hata | kayit | merge | cikis ...
method     — sifre | otp | google | magic_link
reason     — serbest metin (hata sebebi)
user_id    — nullable (başarısız girişte kullanıcı bilinmeyebilir)
ip, user_agent, created_at
```
- Insert **yalnız service-role** (`app/api/auth/log/route.ts`); select yalnız admin/moderator (RLS).
- ⛔ Telefon, e-posta, şifre **yazılmaz**.
- ✅ Migration: `docs/20260728_auth_events.sql` çalıştırıldı (29 Tem 2026) — tablo canlıda.
- 🔎 G1/G2 kotaları tetiklendiğinde `structuredLog('WARN','auth',…)` düşer; kalıcı iz için
  `login_failed` olayları bu tabloda birikir. "Şu IP'den 15 dakikada kaç hata?" sorgusu:
  `select ip_masked, count(*) from auth_events where event='login_failed'
   and created_at > now() - interval '15 min' group by 1 order by 2 desc;`

### `raw_posts`, `aliases`, `vehicles`

#### `raw_posts` — süpürücü kolonları (5 Ağu 2026, #76)
```
parse_attempts        smallint not null default 0   -- süpürücünün kaç kez tetiklediği
last_parse_attempt_at timestamptz                   -- son tetikleme anı (soğuma penceresi)
```
Yalnız `parse_listing_supur()` yazar. `parse_attempts >= 3` olan satır bir daha
denenmez — sonsuz döngü koruması. İndeks:
`raw_posts_supurucu_idx (created_at) WHERE processing_status='pending' AND processed_at IS NULL`.

#### `raw_posts.processing_status` — DÖRT değer, üçü değil
CHECK: `'pending' | 'processed' | 'rejected' | 'no_lane'`.

| değer | anlamı | `processed_at` |
|---|---|---|
| `pending` | kuyrukta / teslim edilememiş. **Terminal DEĞİL.** Repo genelinde bunu SEÇEN yer yok → burada asılı kalan satır görünmez kayıptır. | NULL |
| `processed` | parse edildi, ≥1 ilan üretti | dolu |
| `no_lane` | parse edildi, ilan üretmedi. 🚨 damga İKİ SINIFI ayırır (bkz. yukarısı) | branşa göre |
| `rejected` | **hiç işlenmedi, kapsam dışı bırakıldı** (6 Ağu 2026, #65 rafı). Moderasyon reddi değil. | NULL |

🚨 `processing_status <> 'pending'` artık "işlenmiş" DEMEK DEĞİL — `rejected` de o filtreye
giriyor. 6 Ağu öncesi yazılmış ölçüm scriptleri bu varsayımla yazıldı.

🚨 **`processed_at` her `no_lane` satırına ATILMAZ, bu KASITLI.** `durumYaz`'ın üç çağrı
yerinden ikisi (`index.ts:874` "raw_text bos", `:923` "serit bulunamadi") `damgala:false`
geçer; yalnız `:1081` ("serit var ilan yok") damgalar. Ölçüm (5 Ağu, son 12 saat):
111 `no_lane`'in 21'i damgalı, 90'ı değil. **Bu bir regresyon değil** — damgasız olanlar
`reprocess-no-lane`'in alias öğrenildikten sonra yeniden deneyeceği kümedir; damga atmak
#42'nin kova ayrımını yok ederdi. Sayıyı "damgalama bozuk" diye okumadan önce buraya bak.

### `aliases` kolonözeti
```
alias      — ham/kısaltma form (küçük harf, normalize edilmiş)
normalized — standart karşılık (Gaziantep, İstanbul...)
type       — city | vehicle | body | blacklist | district
is_active  — parse motorunun görmesi için zorunlu
priority   — öncelik puanı (90+ = yüksek)
district   — ilçe adı (city tipi için, normalize ile ilişkilendirir)
created_by_ai / is_approved / llm_confidence / source_listing_ids  (SLH kolonları)
```
🚨 **W5 (29 Tem 2026) — yazım bütünlüğü.** `normalized`/`district` uzun süre iki yazımla birikti
(`Istanbul`/`İstanbul`, `Izmir`/`İzmir`, `Mugla`/`Muğla`, `Bingol`/`Bingöl`). Yazma yolu
`lib/alias-normalize.ts` üzerinden geçiyor.

✅ **DB TARAFI ARTIK TAM (4 Ağu 2026).** `aliases_normalize_trg` **kuruldu** —
`docs/20260804_alias_normalize_trg_a.sql`, seçenek (a): alias satırında `lower()` **yok**,
`\s+` sıkıştırma ve `district=''`→NULL var. `tgenabled='O'`. Canlı test:
`'  TEST   İĞNE   ALIAS  '` → **`TEST İĞNE ALIAS` / 15 karakter** (büyük harf korundu,
U+0307 yok), `district='   '` → NULL. Aşağıdaki tarihsel blok teşhis kaydı olarak duruyor.
⚠️ Yorum satırları `pg_proc.prosrc` içinde yer alır — `position('lower(' in prosrc)`
testi yorumdaki "lower()" yüzünden **yanlış pozitif** verir; davranışı davranışla doğrula.

⚠️ **DB TARAFI YARIM (30 Tem 2026 · 🚫 4 Ağu 2026'da düzeltildi → sonra KURULDU).** Bu blok önce
"DB TARAFI KAPANDI" diyordu; **tekillik** DB'ye bağlandı ama **normalizasyon** bağlanmadı:
- 🚫 `aliases_normalize_trg` **CANLIDA DEĞİLDİ.** Burada "canlıda" yazıyordu — 4 Ağu ön
  kontrolünde `pg_trigger` `aliases` için 0 satır döndü
  (`docs/20260804_adim3_4_6_on_kontrol.sql` BÖLÜM 0). ✅ Ayrım yapıldı: `pg_proc`
  **`aliases_normalize` döndürdü** → fonksiyon var, trigger yok. BÖLÜM 1 **yarım
  çalışmış**; trigger sonradan düşürülmedi, hiç kurulmadı (kopyala-yapıştır sınırı:
  gövde :104'te biter, :106-111 yorum bloğu, DROP/CREATE TRIGGER :113/:115).
  Tasarımı: `BEFORE INSERT OR UPDATE OF alias, normalized, district`;
  `alias` lowercase+boşluk sadeleştirme, `normalized`/`district` trim, boş `district` → NULL.
  ℹ️ Yalnız bu üç kolon listelendiği için `is_active`-only UPDATE trigger'ı TETİKLEMEZDİ —
  Adım 9 toplu pasifleştirmesi zaten bu yüzden güvenliydi, trigger'ın yokluğundan değil.
  🚨 **Sonuç (o an için doğruydu):** normalizasyon tek bacaklı — `lib/alias-normalize.ts`
  ve tek çağıranı `learn-aliases` route'u. O route'tan geçmeyen yazma ham değer yazar ve
  aşağıdaki indekse **23505** ile takılır. Trigger'sız indeks güvenlik ağı değil **mayın**.
  → görev #43 **[KAPANDI 4 Ağu, 7 Ağu'da yeniden ölçülüp teyit edildi — yukarıdaki "Runbook"
  bloğuna bak].**
  🚨 **AMA DOSYADAKİ HÂLİYLE KURULMAMALI (4 Ağu ölçümü).** Trigger'ın `alias` satırındaki
  `lower()` var olmayan bir sorunu çözüyor. Hem bu dosyanın :64-66'sı hem
  `lib/alias-normalize.ts`:80-81 *"büyük harfli alias hiç tutmaz, sessizce ölü kayıt olur"*
  diyordu — **yanlış.** `parse-listing`:323/337 `trNorm(a.alias)` ile, `whatsapp-parse`:224/232
  `trNorm`/`aliasAnahtari` ile karşılaştırıyor: alias **okuma anında** katlanıyor, büyük
  harfli alias pekâlâ tutuyor. Ölçüm: trigger'ın yeniden yazacağı **~100 aktif satır**
  (Söke, Bergama, Kemalpaşa, TIR Açık, DANPERLİ…) ölü kayıt değil, bugün çalışan kayıtlar.
  ⚠️ **Kalıbın ALTINCI örneği** — iddia iki ayrı dosyada yazılıydı, hiç ölçülmemişti.
  ✅ Değerli olan kısımlar `\s+` sıkıştırma ve `district=''`→NULL; asıl koruma bunlar.
  ✅ Çakışma ölçümü 0 satır → kurulum 23505 riski taşımıyor, tek risk gereksiz yeniden yazma.
- `aliases_katlanmis_anahtar_uniq` **canlıda** — **KISMİ** UNIQUE indeks
  `(type, translate(lower(replace(alias,'İ','i')),'ıçğöşü','icgosu')) WHERE is_active = true`
  ⚠️ İndeks ifadesi `lib/alias-normalize.ts::aliasKey()` ile birebir aynı olmak zorunda.
  🚨 **`aliases` üzerinde ÜÇ unique indeks var, bu yalnız biri** (4 Ağu'da ölçüldü):
  `aliases_alias_unique UNIQUE (alias)` · `idx_aliases_type_alias UNIQUE (type, alias)` ·
  `aliases_katlanmis_anahtar_uniq … WHERE is_active`. **İlk ikisi kısmi DEĞİL**, yani
  Adım 9'da pasifleştirilen 612 satırı da görüyor; kısmi olan görmüyor. Bir alias
  onarımı yalnız kısmi indekse karşı kontrol edilirse **23505 ile patlar** — 4 Ağu
  U+0307 onarımında tam olarak bu oldu (`docs/20260804_u0307_alias_onarimi.sql` BÖLÜM 3).
  ⚠️ Kural: veri onarımından önce `select indexname, indexdef from pg_indexes
  where tablename='aliases'` çalıştır; her unique indeksi ayrı kontrol et.
  ℹ️ `aliases_alias_unique` global olduğu için `idx_aliases_type_alias` fiilen
  gereksiz; ayrıca aynı alias metni iki farklı `type`ta var olamıyor.
- **Adım 9 uygulandı** → `docs/20260730_alias_adim9_kopya_pasiflestir.sql`. **612 satır**
  `is_active=false` (silinmedi), **1270 aktif** kaldı. Ölçüm: 552 çatışan grup / 1164 satır,
  `norm_ayrisan_grup=0` ve `ilce_ayrisan_grup=0` → hiçbir grupta `normalized`/`district`
  ayrışmadığı için pasifleştirme kayıpsız. Geri alma yedeği: **`public.aliases_adim9_yedek`**
  (612 id + kazanan_id). Yedek tablosu bilerek DURUYOR.
  🔑 **Kazanan seçimi `ORDER BY id` (en küçük id).** Keyfi değil: `parse-listing/index.ts:44`
  alias'ları `.order('id',{ascending:true})` ile çekiyor, `findPlaces` `.find()` ile İLK
  eşleşmeyi alıyor (`:323`, `:337`) — yani en küçük id zaten kazanıyordu. `is_approved`/
  `priority` ile başka bir kazanan seçmek ölçülmemiş bir davranış değişikliği olurdu.
  🔑 **`corlu` pasifleşince ASCII girdi körleşmez**: karşılaştırma `trNorm()` ile katlanmış
  anahtar üzerinden (W5/D4), kalan `çorlu` satırı ASCII yazımı da yakalıyor.
- Doğrulama geçti: trigger yaz-oku-rollback ✅ · indeks 23505 üretiyor ✅ · anahtar paritesi ✅.
- ℹ️ Tablo boyutu: **1882 satır** (trigger dosyasındaki "~200 satır mertebesi" tahmini YANLIŞTI).
- ⏳ Kalan: runbook **Adım 3, 4, 6** (ilçe yazım düzeltmesi, NULL ilçe doldurma, elle kararlar).
### `system_config` — `parse.auto_publish_score_max`, `parse.reject_score_min`, `llm.ai_listing_quota_default` ve diğerleri
### `safety_rules`, `blacklist`

---

## 4. MODERATÖR PANELİ

Sekmeler: ⏳ Bekleyenler / ✅ Onaylananlar / ❌ Reddedilenler / 💤 Pasifler / 📋 Hepsi / 🔍 Çözümsüz / 🗄️ Arşiv / 🔴 Riskli

Toplu işlemler: `approve | reject | passive | archive | unarchive | shadow_ban | shadow_ban_kaldir | correction_needed`

---

## 5. GÜVENLİK & DENETİM (Audit Engine V3)

Eşikler `system_config.parse.*` anahtarlarından okunur (DB trigger + `/api/ilan/duzelt` aynı helper'ı kullanır: `lib/auditLimits.ts`).
Varsayılan: `auto_publish_score_max=31`, `reject_score_min=71`.

| Puan | INSERT | /api/ilan/duzelt |
|---|---|---|
| < auto_publish_score_max | Yayında | Otomatik approved+active |
| auto..reject arası | Mod kuyruğu | pending+passive |
| ≥ reject_score_min | shadow_ban + archived | correction_needed kalır |

Sprintler 1–5: ✅

---

## 6. WHATSAPP PARSE PIPELINE

```
ZIP/TXT → raw_posts → DB trigger → parse_listing_gonder() → parse-listing Edge Fn → listings → audit trigger
                                          ↑
                          pg_cron (dakikada bir) → parse_listing_supur()
```

### 🧹 Teslim edilemeyen tetiklemelerin süpürücüsü (5 Ağu 2026, #76 — CANLI)

**Sorun.** `on_raw_post_insert` `FOR EACH ROW` çalıştığı için 1.500 satırlık bir import
1.500 eşzamanlı `pg_net` POST'u doğurur. Bir kısmı hiç teslim edilmez; satır sonsuza kadar
`pending` kalır ve **kimse yeniden denemez**. #65 yığınının mekanizması bu.

**Üç fonksiyona bölündü — token artık TEK yerde:**

| fonksiyon | rolü |
|---|---|
| `parse_listing_gonder(uuid)` | Tek satır için edge fonksiyonu POST'lar. Token'ı **Vault'tan** okur (#70). |
| `trigger_parse_listing()` | Artık ince sarmalayıcı: `perform parse_listing_gonder(new.id)`. |
| `parse_listing_supur(int default 50)` | Teslim edilememiş satırları bulup yeniden tetikler. |

> 🔐 Dönüşüm `pg_get_functiondef()` → `replace()` → `execute` ile Postgres'in **içinde**
> yapıldı; token hiçbir log'a, migration metnine veya asistan bağlamına girmedi.
>
> Her ikisi de `SECURITY DEFINER` + `SET search_path = pg_catalog, public` (hijack koruması)
> ve `REVOKE ALL ... FROM public, anon, authenticated` — çünkü PUBLIC varsayılan olarak
> EXECUTE alır ve o hâliyle **anon kullanıcı service_role token'lı isteği tetikleyebilirdi.**

#### 🔐 #70 — token artık `pg_proc`'ta DEĞİL, Vault'ta (5 Ağu 2026)

**Önce maruziyet ölçüldü, abartılmadı.** `anon` rolünün Postgres seviyesinde `pg_proc`
SELECT yetkisi **var** (`has_table_privilege` → true) — ama PostgREST `pg_catalog`'u dışarı
açmıyor ve `public` şemasında `pg_proc`/`pg_get_functiondef` kullanan view/fonksiyon sayısı
**sıfır**. Yani token **internetten çekilebilir değildi**; görebilmek için doğrudan DB
bağlantısı (SQL editor, DBeaver, postgres şifresi) gerekiyordu.
🚨 **Sonuç: JWT rotasyonu ACİL DEĞİL. Asıl kusur sızma değil, düz metin durmasıydı.**

Çıkarma ve Vault'a yazma tek bir `DO` bloğunun içinde yapıldı (`regexp_match` →
`vault.create_secret`); JWT hiçbir migration çıktısına veya istemci bağlamına girmedi.
`parse_listing_gonder()` artık `vault.decrypted_secrets`'ten okuyor ve **sır bulunamazsa
`raise exception` ile patlıyor** — çünkü sessizce `'Bearer '` göndermek 401 üretir, satır
`pending` kalır ve bu #65'in birebir yeniden üretilmesi olurdu.

**Doğrulama (16:34 UTC), dördü de yapıldı:** ① Vault sırrı fonksiyondaki değerle aynı
(değer gösterilmeden `like` ile) · ② `prosrc like '%eyJ%'` → **0 fonksiyon** ·
③ var olmayan uuid ile çağrı → **404 "raw_post bulunamadı"** (401 gelseydi Vault okuması
bozuk demekti; veriye dokunmadan auth'u izole eden test budur) · ④ uçtan uca: lane
içermeyen gerçek bir INSERT → trigger → gonder → vault → pg_net → edge fn → `200 {"lanes":0}`
→ `no_lane`, 0 ilan.

> ⚠️ `raw_posts.source` CHECK kısıtı yalnız `'whatsapp'` ve `'facebook'` kabul ediyor —
> `'manual'` **23514** ile reddedilir. Test satırı yazacaksan bunu bil.
>
> 🔁 **Geri alma:** token Vault'ta duruyor; gerekirse eski düz metin biçim oradan okunup
> yeniden kurulabilir.
>
> ⏭ **Kalan (Bayram):** JWT rotasyonu — dashboard işi.
>
> 🔬 **5 Ağu 2026 — ŞEMA SORUSU ÖLÇÜLDÜ.** ("Yeni şemaya geçmişiz" izlenimi yarı doğru çıktı.)
>
> | Ölçüm | Sonuç |
> |---|---|
> | `get_publishable_keys` | **İkisi de var**: legacy `anon` (JWT) **ve** `sb_publishable_Eiw2…` |
> | Legacy `anon` durumu | `disabled: false` → **hâlâ etkin** |
> | Repoda `sb_publishable` / `PUBLISHABLE_KEY` referansı | **0** |
> | Repoda `NEXT_PUBLIC_SUPABASE_ANON_KEY` referansı | **14+ dosya** (`lib/supabase.ts`, `lib/auth.ts`, `proxy.ts`, `app/**`) |
> | Vault token'ının `role` iddiası | `service_role` |
> | Vault token'ının `iat` / `exp` | `1776665410` / `2092241410` |
> | Legacy `anon` key'in `iat` / `exp` | `1776665410` / `2092241410` — **BİREBİR AYNI** |
>
> **Sonuç:** yeni şema panelde *mevcut* ama projeye *uygulanmamış*. Vault'taki token bir
> **legacy** `service_role` JWT'si ve anon key'le aynı anda, aynı secret'tan basılmış
> (`iat`/`exp` özdeşliği bunun kanıtı). Dolayısıyla **bağımsız rotasyon henüz mümkün değil**;
> JWT secret'ı döndürülürse anon key de ölür ve site kırılır. Önceki uyarı geçerliliğini
> koruyor. (Uyarı: env değişkeninin *adı* `..._ANON_KEY` olsa da *değeri* panelden
> `sb_publishable_…` yapılmış olabilir — bu yalnız Vercel env'inden doğrulanabilir.)
>
> ✅ **6 AĞU 2026 05:42 UTC — AŞAMA 1 UYGULANDI VE ÖLÇÜLDÜ (Bayram).**
> Vault sırrı `sb_secret_…` ile değiştirildi. Doğrulama:
>
> | Ölçüm | Sonuç |
> |---|---|
> | Vault sırrının formatı | `sb_secret_`, uzunluk **41** (eskisi `eyJ`, 219) — `updated_at 05:42:11` |
> | Yedek sır bozulmamış mı | `parse_listing_service_role_jwt_YEDEK_20260805` = legacy JWT, 219, **sağlam** |
> | Olmayan uuid probu | **404** `raw_post bulunamadı` — 05:42'den **sonra**, yani auth geçti |
> | **Uçtan uca gerçek satır** (`aacfc60d-…`, 05:44) | trigger → gonder → vault → pg_net → edge fn → **200 `{"success":true,"lanes":0}`** → `no_lane`, 0 ilan |
>
> 🚨 **404 tek başına kanıt DEĞİLDİ** — eski legacy token'la da 404 alınırdı. Kanıt, Vault
> sırrının formatının `sb_secret_` olduğunun ayrıca ölçülmesi. Bu yüzden ikisi birlikte yazıldı.
>
> **Böylece ölçülmemiş risklerden biri kapandı: edge fonksiyonu `sb_secret_…`'i Bearer olarak
> KABUL EDİYOR.** Test satırı silinmedi, `processed` + `slh_scanned_at` işaretlendi
> (moderatör ve AI-keşif kuyruklarını kirletmesin diye).
>
> 🔬 **AŞAMA 2 ÖN ÖLÇÜMÜ (6 Ağu, üretime dokunmadan).** Vercel env'i değiştirmeden önce
> her iki anahtar da DB'nin içinden `pg_net` ile kendi REST/Auth uçlarına atıldı.
> `sb_secret_` değeri **Vault'tan okundu, hiçbir yerde gösterilmedi**.
>
> | İstek | Anahtar | Sonuç | Yorum |
> |---|---|---|---|
> | `GET /rest/v1/listings?limit=1` | `sb_publishable_` | **200** + gerçek satır | anon RLS politikası çalışıyor |
> | `GET /auth/v1/settings` | `sb_publishable_` | **200** (`google: true`) | GoTrue anahtarı kabul ediyor |
> | `GET /rest/v1/raw_posts?limit=1` | `sb_secret_` | **200** + satır | **service_role yetkisi doğrulandı**, RLS aşılıyor |
> | `GET /rest/v1/raw_posts?limit=1` | `sb_publishable_` | **200** + `[]` | RLS anon'u doğru engelliyor (kontrol grubu) |
>
> Son iki satır birlikte anlamlı: aynı uca iki anahtarla gidildi, biri satır gördü diğeri
> görmedi → yetki ayrımı gerçekten çalışıyor. Tek başına `200` yeterli olmazdı.
>
> ⚠️ **HÂLÂ ÖLÇÜLMEDİ:** bu testler sunucu tarafı HTTP çağrılarıdır. `@supabase/ssr` 0.10.2'nin
> **tarayıcıdaki** oturum/çerez akışını publishable key ile denemedim — Aşama 2 duman testinin
> asıl konusu bu. (Oturumların geçerliliği korunmalı: JWT secret'ı değişmiyor, yalnız
> `apikey` başlığı değişiyor — ama bu **beklenti, ölçüm değil**.)
>
> ✅ **6 AĞU 2026 — AŞAMA 2 UYGULANDI VE CANLIDA ÖLÇÜLDÜ.** Bayram Vercel env değerlerini
> değiştirip redeploy etti. Tarayıcıdan doğrulandı (`www.yukegel.com`):
>
> | Ölçüm | Sonuç |
> |---|---|
> | Client bundle'da anahtar taraması (15 script indirildi, içerik tarandı) | **1 script `sb_publishable_` içeriyor, legacy JWT içeren 0** |
> | `GET /rest/v1/users?id=eq.…` (tarayıcıdan) | **200** |
> | **Mevcut oturum** | **Korundu** — ana sayfa "Hoş geldiniz, Bayram DEDE" |
> | İlan akışı (anon okuma yolu) | Render ediyor — Tekirdağ/Muratlı → … satırları geldi |
> | `/ilan/[id]` (bu sayfa `SUPABASE_SERVICE_ROLE_KEY` kullanır) | Tam render — **sunucu tarafı service_role yolu da çalışıyor** |
> | Konsol hataları | Yok |
> | Pipeline (son 30 dk) | cron **30/30 succeeded**, http **5×200 + 2×404**, süpürücü kapsamında bekleyen **0** |
>
> 🚨 **Önceki "beklenti, ölçüm değil" notunu kapatıyorum:** oturumların korunacağını
> *beklediğimi* yazmıştım — canlıda **ölçüldü ve korundu**. JWT secret'ı değişmediği,
> yalnız `apikey` başlığı değiştiği için mevcut çerezler geçerli kaldı.
>
> ⏭ **Yalnız Aşama 3 kaldı** (legacy anahtarları panelden disable etmek) — **bugün değil.**
>
> ✅ **Rotasyon zaten yanlış araç. Doğru yol — kesintisiz, 4 adım:**
> 1. Panelden yeni bir **secret key** (`sb_secret_…`) üret. *(Kimlik bilgisi — Bayram.)*
> 2. Vault sırrını o değere güncelle:
>    `select vault.update_secret((select id from vault.secrets where name='parse_listing_service_role_jwt'), '<sb_secret_…>');`
>    **Değeri SQL editöründe Bayram yapıştırır**; token benim bağlamıma girmez.
> 3. **Ölçüm hazır:** olmayan bir uuid ile `select public.parse_listing_gonder(gen_random_uuid());`
>    → edge fn `404` dönerse yeni anahtar kabul ediliyor, `401` dönerse etmiyor → adım 2'yi geri al.
>    *(Edge fonksiyonunun `sb_secret_…`'i Bearer olarak kabul edip etmediği ÖLÇÜLMEDİ — iddia etmiyorum, ölçüm bu.)*
> 4. Site `sb_publishable_…`'a geçtikten sonra legacy anahtarları panelden devre dışı bırak
>    → JWT secret rotasyonuna **hiç gerek kalmaz**.

**Süpürücünün seçim ölçütü** (hepsi birlikte): `processing_status='pending'` · `processed_at IS NULL` ·
ilanı yok · `created_at` **son 12 saat** içinde ama **5 dakikadan eski** · `parse_attempts < 3` ·
`last_parse_attempt_at` 10 dakikadan eski. `for update skip locked` ile çakışan cron
koşuları aynı satırı iki kez göndermez. Cron: `parse-listing-retry-sweeper :: * * * * *`,
`select public.parse_listing_supur(50);`

> 🚨 **Hız sınırı (50/tur) tasarımın merkezinde, süsü değil.** Naif bir süpürücü 5.723
> satırı tek seferde ateşlerdi — yani kaybı yaratan patlamanın birebir aynısını.
> Pencere **6 Ağu 2026'da 2 saatten 12 saate çıkarıldı** (Bayram onayı, #65) — aşağıya bak.

> 📐 **PENCERE × HIZ = PATLAMA TAVANI (6 Ağu 2026, #65).** Uygunluk penceresi
> `pencere − 5dk`, hız 50 satır/dk → tek patlamada taşınabilir tavan:
> 2sa'te 50×115 = **~5.750** · 12sa'te 50×715 = **~34.500**.
> Gözlenen en büyük patlama 1.933/saat (2.989/gün). 2sa'te pay ~3×, 12sa'te ~18×.
> 🚨 Pencereyi büyütmek tavanı büyütür ama **ANLIK yükü büyütmez** — hız yine `p_limit`.
> Genişletme günü ölçümü: **0 satır süpürüldü**, çünkü 0-12sa yaş kovaları boştu.
>
> 🚨 **ARTIK İKİ ADIM VAR — ADIM 0 RAFA KALDIRIR, ADIM 1 SÜPÜRÜR.**
> Pencere genişledi diye eski yükler dirilmesin diye ADIM 0 eklendi: 12 saatten eski
> `pending` satırlar `processing_status='rejected'`e çekilir (tur başına en çok 500).
> Bayram kuralı: *"eski ilan dirilmesin."* Böylece pencere ileride yine genişletilse
> bile yığın erişilemez kalır ve `pending` bir daha birikmez.
>
> ⚠️ **`rejected` = "HİÇ İŞLENMEDİ, KAPSAM DIŞI BIRAKILDI"** — moderasyon reddi DEĞİL.
> Değer CHECK kısıtında zaten vardı ve `raw_posts`'ta hiç kullanılmıyordu (6 Ağu'da 0 satır).
> `processed_at` bilerek **NULL** bırakılır (satır parse edilmedi, damgalanamaz);
> `parse_attempts=0` + `last_parse_attempt_at IS NULL` hiç denenmediğinin kanıtı olarak kalır.
> 🚨 Eski ölçüm scriptlerinde `processing_status <> 'pending'` = "işlenmiş" varsayımı
> artık YANLIŞ — `rejected` de o filtreye giriyor (örn. `20260805_no_lane_format_olcumu.sql:249`).
>
> **6 Ağu uygulama ölçümü:** 5.693 satır rafa kaldırıldı (en eski 14 May, en yeni 5 Ağu 12:04).
> Hepsinde `last_parse_attempt_at IS NULL`, ilanı olan **0**, damgalı **0** → temiz küme.
> Sonrası: `pending` **0** · `rejected` 5.693 · `processed` 57.961 · `no_lane` 4.519.
> Boru hattı ileriye dönük sağlıklı: son 24sa'te 862 cron koşusu **0 hata**,
> gelen 3.009 satırın 2.388'i trigger + 30'u süpürücü.

**İlk tur ölçümü (#78, 16:19–16:20 UTC).** 30 aday satır → 30 tetikleme → **28 `processed`,
2 `no_lane`**, 119 ilan, 0 cron hatası, `parse_attempts` en fazla 1.

> ⚠️ **Mükerrer alarmı çıktı ve YANLIŞTI — kayda geçiyor.** `(raw_post_id, raw_post_segment)`
> ile gruplayınca 12 "mükerrer grup" göründü. Sebep: **`raw_post_segment` canlıda her satırda
> NULL** (süpürülen 119 ilanın 0'ı dolu) ve varış bilgisi `listings`'te değil
> `listing_stops`'ta. Örnek `96dfd5cd`: 19 ilanın hepsi Mersin (33) çıkışlı ama **19 farklı
> varış ili** — tek mesaj, çok güzergâh. Kesin kanıt: bir raw_post'un tüm ilanları
> **≤1,18 sn** içinde yazılmış (tek çağrı) ve `parse_attempts=1`. Çift gönderim iki ayrı
> zaman kümesi bırakırdı. **Ders: `listings` tek başına mükerrer testi için yetersiz;
> varışsız gruplama sahte pozitif üretir.**

**#77 — yalancı `pending` düzeltmesi (aynı gün).** İlan ÜRETMİŞ ama `pending` kalmış
**2.203 satır** (18 May – 5 Ağu) `processed` yapıldı; `processed_at` ilgili ilanın
`min(created_at)`'inden dolduruldu. **Yeniden ayrıştırma YOK** (Bayram kararı) — mükerrer
riski sıfır. Doğrulandı: kalan yalancı pending **0**, `processed_at < created_at` olan **0**.

### 🚨 Bu boru hattının darboğazı AĞ DEĞİL, CPU (5 Ağu 2026, #71)

> **CANLI SONUÇ (v75 deploy 14:56:28 UTC, ölçüm 15:06 UTC / 328 satırlık import):**
> Çağrı süresi **78–150 sn → 4,7–44 sn**. 504/546/500 sayısı **yığın → 0**.
> `pending` kalan **%93 → %4,3**. 150.000 ms gateway duvarı artık hiç görülmüyor.
>
> Sürekli yükte (15:18–15:22, ~1.500 satır daha) süreler **8,6–73,3 sn**, yine hepsi 200.
> 1.833 satırın %94,7'si `processed`, %1,6'sı `pending`, %3,7'si `no_lane`.
> ⚠️ Rahatlama sınırsız değil: 73 sn, 150 sn duvarının yarısı. Hacim ikiye katlanırsa geri gelir.
>
> **Ama süre milisaniyelere DÜŞMEDİ** — bench'te parse maliyeti 6–17 ms'ti, canlıda
> 20–70 sn kaldı. Nerede olmadığı ÖLÇÜLDÜ: aynı pencerede tüm DB sorgularının toplam
> yürütme süresi ~300 sn / ~1.000 çağrı ≈ **çağrı başına 0,3 sn**. `ilan_olustur` da
> suçlu değil — ort. 68,1 ms (#67'nin O(1) trigger'ından sonra; taban 1.400 ms'ti).
> Geriye **Deno worker havuzunda kuyruk** kalıyor. Elemeyle varıldı, doğrudan ölçülmedi.
>
> 🆕 **#73 — ÖNBELLEK YAZILDI, DEPLOY EDİLDİ (v76), AMA HİÇBİR ŞEY KAZANDIRMADI.**
> `tumAliaslar()` HER çağrıda 1.242 alias'ı 2 sayfada çekiyordu. 60 sn TTL'li modül
> önbelleği yazıldı, 15:50:54 UTC'de v76 olarak deploy edildi. **Beş ardışık import'ta
> `pg_stat_statements` deltasıyla ölçüldü:**
>
> | parti | alias SELECT | çağrı | oran | çekim döngüsü |
> |---|---|---|---|---|
> | 19 satır | +42 | +19 | 2,21 | 21 |
> | 4 satır | +10 | +4 | 2,50 | 5 |
> | 8 satır | +18 | +8 | 2,25 | 9 |
> | 33 satır | +68 | +33 | 2,06 | 34 |
> | **toplam** | **+138** | **+64** | | **68** |
>
> Önbelleksiz taban çizgisi **2,00**. 64 çağrı **68 ayrı çekim** üretti → **sıfır isolate
> yeniden kullanımı.** 🚨 **Kök sebep: bu iş yükü ardışık trafik değil, EŞZAMANLI fan-out.**
> `pg_net` N POST'u aynı anda ateşler; her istek **soğuk isolate**'e düşer, modül kapsamı
> ölür. Deno'da modül önbelleği yalnız *ardışık* isteklerde yaşar. En net vaka: 33 satır
> 1,3 sn içinde geldi ve yine 34 ayrı çekim yaptı.
> **Karar: kod kalıyor (zararsız), ama #73 ÇÖZÜLDÜ SAYILMIYOR.** Ancak isolate havuzu
> doyup runtime kuyruğa girdiğinde (#71'in 20–74 sn profili) işe yarayabilir; 300+ satırlık
> doğal bir import'ta yeniden ölçülecek, oran 2,00'de kalırsa geri alınacak.
>
> ⚠️ **#72 — ÖNCEKİ ÖNERİMİ GERİ ÇEKİYORUM.** "Timeout'u yükseltelim" demiştim; ölçüm bunu
> yanlışladı. 16:07'de `net._http_response` 33 isteğin **24'ünü** timeout kaydetti ama
> **33/33 satır işlendi** — yani kayıt **yanlış negatif** üretiyor. Sebep: `pg_net`'in
> `timeout_milliseconds` (varsayılan 5000) curl handle'ını iptal eder ama **edge fonksiyonunu
> DURDURMAZ**; fonksiyon çalışmaya devam edip durumunu `durumYaz()` ile kendisi yazar.
> 🚨 Timeout'u ~74 sn'ye çıkarmak **daha kötü**: `pg_net.batch_size = 200` eşzamanlı slot var,
> slotlar 15× uzun tutulur, 1.500 satırlık import'un ~40 sn'lik boşalması **~10 dakikaya** çıkar.
> **Doğru okuma:** izleme kaynağı `net._http_response` DEĞİL, `raw_posts.processing_status`'tur.
> Gerçek boşluk timeout değeri değil, **teslim edilemeyen tetiklemenin yeniden denenmemesiydi**
> → süpürücü (#76) ile kapatıldı.

**`parse-listing` içinde LLM çağrısı YOKTUR.** Dosyada tek `Deno.env.get` Supabase
URL/anahtarı; `fetch(`, `anthropic`, `messages.create` **sıfır eşleşme**. Log satırı
`'LLM parse tamamlandı'` diyor ama `parseMessage()` saf regex + `aliases` tablosudur.
İsim yanıltıcı — 100 saniyeyi "AI yavaş" diye açıklamaya kalkışan herkes buradan başlar
ve yanlış yere bakar.

**Ölçülen sebep.** `findPlaces` her aranan token için
`cityAliases.find(a => trNorm(a.alias) === cand)` çalıştırıyordu. `.find` eşleşmede kısa
devre yapar — ama aramaların neredeyse tamamı **ıskalar**, yani pratikte her arama 1.163
city alias'ının hepsini gezer ve her biri için `trNorm` çağırır. `trNorm` 36 regex
`.replace` yapar. Token başına 5 arama (2 bigram + 3 unigram formu) × 1.163 alias ×
36 regex ≈ **209.000 regex işlemi — tek token için**. `findVehicle`/`findBodyType` ayrıca
her çağrıda `.filter().sort()` yapıyordu.

Ölçüm (Node 22, gerçek alias kardinalitesi `city=1163 / vehicle=41 / body=28`):

| satır | karakter | eski | yeni (soğuk, indeks kurulumu dahil) |
|---|---|---|---|
| 6 | 341 | **265 ms** | 9,8 ms |
| 24 (ortalama mesaj) | 1 381 | **1 020 ms** | 6,0 ms |
| 230 (en uzun mesaj) | 13 459 | **11 302 ms** | 16,7 ms |

Maliyet satır sayısıyla **doğrusal** büyüyor (24→230 satır = 9,6× satır, 11,1× süre).
`raw_posts` gerçeği: ortalama 657 karakter / 24 satır, en büyüğü 13.121 karakter / 230 satır.

**Niye ölümcül:** bu iş ağ beklemesi değil, saf CPU — Deno worker'ında CPU **seri** akar.
`on_raw_post_insert` `FOR EACH ROW` olduğu için tek dakikada 640 satırlık bir içe aktarım
640 eşzamanlı çağrı doğurur, eşzamanlılık sınırı yoktur ve 640 × ~0,5–11 sn CPU aynı
havuzda kuyruğa girer. Canlı log: çağrılar **78.116–150.166 ms** sürüyor, 504'ler tam
150.000 ms geçit duvarında kümeleniyor, 546'lar Deno worker kaynak sınırı. **Başarılı
(200) yanıtlar da 78–148 sn** — yani darboğaz istek başına iş değil, sistem çapında
kuyruk. Duvara çarpan çağrı `durumYaz`a hiç varamaz ve satır `pending` kalır: **#65
yığınının mekanizması budur.**

**Düzeltme (#71).** `aliasIndeksi()` — alias dizisi başına **bir kez** kurulan
`Map<trNorm(alias), Alias>` (şehir) + önceden sıralanmış `[anahtar, Alias][]` (araç/üstyapı),
`WeakMap` ile dizi kimliğine bağlı. `tumAliaslar()` her çağrıda taze dizi döndürdüğü için
indeks çağrı başına bir kez kurulur (~1 ms, 1.232 `trNorm`).

> ⚠️ **Aynı desen `app/api/whatsapp-parse/route.ts:290 aliasDiziniKur()` içinde ZATEN
> doğru yazılmıştı.** Edge kopyası güncellenmemişti. Deno/Next sınırı yüzünden ortak
> modüle alınamıyor → **iki kopya elle hizalanmak zorunda**; birinde yapılan optimizasyon
> diğerine kendiliğinden geçmez. Bu dosyanın en pahalı yapısal borcu budur.

**Eşdeğerlik neye dayanıyor.** `.find` **ilk** eşleşeni döndürür; `Map` de `if (!has)` ile
**ilk gireni** tutar ve `tumAliaslar()` `ORDER BY id` okur → seçim aynı. Fark ancak aynı
`trNorm` anahtarına sahip iki city alias varsa görünürdü; canlıda **2 çakışma / 4 alias**
var (`ist anadolu` → id 26 pri 90 & id 1087 pri 65; `kahta` → id 313 & 314) ve **dördü de
aynı `normalized`+`district`'e** çözülüyor. Ek olarak 303 mesajda (3 gerçek + 300 üretilmiş)
`JSON.stringify(parseMessage(...))` karşılaştırması **0 fark**, `tsc --noEmit` temiz.

---

## 7. API ROUTES

| Route | Açıklama |
|---|---|
| `/api/moderator/toplu-islem` | Bulk ops |
| `/api/ilan/duzelt` | Kullanıcı düzeltme + re-scan |
| `/api/admin/guvenlik` | safety_rules + blacklist CRUD |
| `/api/excel-import` | Excel toplu yükleme. `POST` JSON, `action: 'preview' \| 'commit'`. Sözleşme: `lib/toplu-yukle-sozlesme.ts`. Kimlik OTURUMDAN (`userId` gövdede YOK). Kayıt `ilanYaz()` üzerinden → V1/V3 aynen geçerli. `MAX_SATIR=300`, `MAX_ILAN=50`, `maxDuration=60`. ✅ **4 Ağu 2026'da doğrulandı: kolon kayması bu koddan çıkamaz** — `TopluYukle.tsx`:62-83 `sheet_to_json({header:1})` ile konumsal okur ve tüm alanlar **aynı `row` dizisinden** gelir; route :180-234 de aynı satır nesnesini taşır. 31 Tem'deki ilçe kayması **dosya kaynaklı** (#47) |
| `/api/auth/tekil-kontrol` | telefon/tckn/vkn tekillik (service role) |
| `/api/auth/log` | 🔒 Auth denetim izi → `auth_events` (service role). Fire-and-forget, IP+UA yazar, telefon/şifre yazmaz |
| `/api/auth/otp` | 🔒 **TEK** SMS OTP gönderim yolu (G2). POST + Origin. 3 kota: numara 1/60sn, IP 5 farklı numara/saat, IP 15 toplam/saat. 429 + `Retry-After` |
| `/api/auth/giris` | 🔒 **TEK** şifreli giriş yolu (G1). POST + Origin. Kota: e-posta 5 hata/15dk, IP 20 hata/15dk. Başarıda sayaç sıfırlanır, cookie SUNUCUDA yazılır, `{ rol }` döner |
| `/api/auth/dogrulama-tekrar` | 🔒 Doğrulama e-postasını tekrar gönder (A6). POST + Origin. 3 kota: adres 1/60sn, IP 5 farklı adres/saat, IP 10 toplam/saat. ⚠️ Yanıt **daima aynı** (hesap sayımına kapalı); sayaçlar hata yolunda da işlenir |
| `/api/ilan/[id]/telefon` | 🔒 **TEK** telefon kaynağı. GET, authed + profil tam + hesap aktif + ilan yayında. `logPhoneAccess`, 20/dk, `no-store` |
| `/api/ilan/[id]/sahiplen` | 🔒 GET maskeli numara, POST `{adim:'gonder'\|'dogrula'}`. İlan başına 60 sn SMS cooldown (429 + `Retry-After`) |
| `/api/parse-text` | Tekil kullanıcı metnini Haiku ile JSON'a çevirir + per-user günlük quota kontrolü (429). ⚠️ **DB'ye YAZMAZ** — çıktı forma prefill olur; `province_id` `ilanYaz()`'da türer. Prompt'u `/api/whatsapp` ile kopyalı |
| `/api/whatsapp` | Twilio WhatsApp webhook — kayıt/kota kontrolü + LLM parse + `ilanYaz()`. ⚠️ Prompt'un ikinci kopyası burada (`parseWithLLM`); coğrafi kuralları parse-text ile senkron tut |
| `/api/admin/kullanici` | role / is_active / moderator_sources / **ai_listing_quota_daily** PATCH |
| `/api/admin/crm` | Shadow Profile listesi (GET) + güncelle (PATCH) |
| `/api/admin/crm/[id]` | Shadow Profile detay + ilan geçmişi (GET) |
| `/api/admin/radar` | Radar Intelligence: rota tarama, lead listesi, phone history (GET) |
| `/api/poi` | POI listele (GET: bbox + filtre + sıralama + is_active), yeni POI ekle (POST) |
| `/api/poi/[id]` | POI detay + son 10 yorum (GET), güncelle (PATCH: +satellite_confirmed, is_active, reviews_summary) |
| `/api/poi/[id]/review` | Yorum ekle + geo-fence doğrulama (POST) |
| `/api/admin/poi-import` | Google Places'ten il+kategori bazlı veri çek (POST), kategori listesi (GET) |
| `/api/admin/poi-import/[id]/summarize` | POI için Claude yorum özeti üret (POST) |
| `/api/listings/yakin` | Yakınımdaki Yükler: lat/lng → en yakın il (offline haversine) → o ildeki aktif ilanlar (GET) |
| `/api/listings/ara` | **Ana sayfa il filtresi (GET, Dalga 3).** `?kalkis=<plaka>&varis=<plaka>&tip=yuk\|arac`. Service role; `origin_province_id` / `listing_stops.province_id` tamsayı eşitliği. En az bir il zorunlu (yoksa 400) — filtresiz liste zaten SSR'den geliyor. Tanınmayan il → **400**, sessiz "tüm iller" değil. Yanıt rozetleri de içerir (ikinci istek yok). |

---

## 8. PROXY MANTIĞI

```
Açık rotalar: /giris, /auth/, /profil-tamamla, /nasil-calisir, /hakkimizda,
              /kvkk, /kullanim-kosullari, /api/, ...
1. Açık rota → geç
2. Giriş yok + korumalı → /giris?redirect=
3. Giriş var:
   - maybeSingle() ile users.select('user_type, role, merged_into')
   - merged_into dolu (emekli oturum) → /auth/devir?redirect=… (COOKIE SİLİNMEZ — devir onları okur)
   - role=admin|moderator → direkt geç
   - user_type yoksa:
     - aynı e-posta/telefonla KAYITLI başka hesap var mı? → varsa /giris?hesap=eslesme (self-heal merge)
     - yoksa → /profil-tamamla
```

> **KRİTİK auth tuzağı (22 Tem 2026):** Bir kişinin birden fazla auth kimliği olabilir — Google/e-posta bir `auth.users` satırı (`email` dolu, `phone` null), telefon (SMS OTP) AYRI bir satır (`phone` dolu, `email` null), FARKLI `id`'lerle. `public.users` satırı yalnızca birinde (genelde ilk kayıt olunanda) bulunur. Diğer kimlikle girildiğinde `auth.uid()` ≠ `users.id` → proxy satır bulamaz. **Eskiden** bu doğrudan `/profil-tamamla`'ya atıyor, oradan `users_email_key` / duplicate hesap doğuyordu. **Artık** proxy uzlaştırma yapıyor: satır yoksa aynı e-posta/telefonla kayıtlı canlı hesabı arar, bulursa girişe yönlendirir; `app/giris/page.tsx` açılış `useEffect`'i oturumu otomatik `merge`/`switch-account` ile canlı hesaba bağlar. Telefon eşleştirmesi 4 formatı da dener: `+905xx`, `905xx`, `05xx`, `5xx` (RLS `users` üzerinde okumaya izin verdiği için client/proxy bu aramayı yapabiliyor).

---

## 9. KURALLAR & TUZAKLAR

- 🚨 **VIEW, ALTINDAKİ RLS'İ DELİP GEÇER** (29 Tem 2026, Supabase linter "Security Definer View").
  PostgreSQL'de view **varsayılan olarak SAHİBİNİN** yetkileriyle çalışır. `shadow_profiles`
  tablosu doğru şekilde admin-only RLS ile korunuyordu, ama üstündeki
  `shadow_profile_summary` view'ına `GRANT SELECT ... TO authenticated` verilmişti →
  siteye üye olan **herkes** PostgREST'ten tüm kayıtsız nakliyeci telefonlarını
  (`phone`, `name`, `company_name`, `notes`) çekebiliyordu. KVKK ihlali.
  **Kural:** RLS'li bir tablonun üstüne view açarken İKİSİ birden zorunlu —
  `create view ... with (security_invoker = on)` **ve** `grant select ... to service_role`
  (`authenticated`'a **değil**). Düzeltme: `docs/20260729_shadow_profile_summary_invoker.sql`.
  Bu, `SPRINT_01 L1e`'nin ("RLS satır bazlıdır, kolon bazlı değildir") tamamlayıcısı:
  tabloyu kilitlemek, üstüne yetkisiz bir view koyduğun anda anlamsızlaşır.
- 🚨 **Güzergâh sorgusu yazarken `listings`'i tek başına sorgulama** (29 Tem 2026, W5).
  Kalkış `listings.origin_city`'de, varışlar `listing_stops` satırlarında. `listings`
  içinde `destination_city` diye bir kolon **YOKTUR** (31 Tem 2026, 42703) — burada
  "ölü kolon" yazıyordu, o da yanlıştı.
  Bir güzergâh sorgusu `JOIN public.listing_stops s ON s.listing_id = l.id` içermiyorsa
  yanlıştır. Bu tuzak bir kez gerçek zarar verdi: eski temizlik script'i (BÖLÜM 6) olmayan
  bir kolonu onarmaya çalışıp kullanıcıya görünen `listing_stops.city`'yi atlamıştı.
- 🚨 **`stops[0]` OKUMA — durak verisi ÇOKLU'dur** (29 Tem 2026). Yukarıdaki kuralın
  arayüz tarafındaki devamı: sorgun `listing_stops`'u doğru çekse bile **ilk satırı
  okumak veriyi sessizce kırpar**. Ana sayfa kartı `duraklar[0].ton` yazdığı için
  Mersin 8t + Adana 12t + Hatay 5t olan bir ilan listede **"⚖ 8 ton"** görünüyordu —
  yükün %68'i ekranda yok, nakliyeci aracını yanlış tonaja göre seçiyordu. Aynı
  kopyala-yapıştır hata 3 yerdeydi: `HomeClient` kartı, `/panel` kartı, `/ilan/[id]`
  meta `description`'ı (Google'a da eksik tonaj gidiyordu). Toplam **tek yerden**:
  `lib/ilan-liste.ts → durakToplami(duraklar, alanlar[])`.
  ⚠️ `weight_ton` Postgres'te `numeric` → **PostgREST bunu STRING döndürebilir**
  (`"8.50"`); düz `+` toplamaz, birleştirir. `Number()` zorunlu.
  ⚠️ Toplamı `null` ile ayır: `0` ile "veri yok" aynı çipi basmamalı.
  ✅ Durakları **tek tek** listeleyen ekranlar (`/ilan/[id]` durak kartları,
  `/u/[username]`) doğrudur — orada her satır kendi tonajını gösterir.
- ⚖️ **"Aynı şehir" bozukluk sinyali değildir** (29 Tem 2026, W5). Şehir içi taşıma meşru
  bir hizmet; `origin_city = stops.city` olan ilanların çoğu gerçektir. Sahte güzergâhın
  parmak izi **yazım farkıdır**: katlanmış anahtar eşit ama ham string farklı
  (`Istanbul` vs `İstanbul`). Veri kalitesi ölçerken bu ikisini karıştırma — biri
  düzeltilecek hasar, öteki korunacak iş.
- 🚨 **KONUM ARAMASI BÜYÜK/KÜÇÜK HARFE DUYARLI — depolanan yazım kullanıcıya yansıyor**
  (29 Tem 2026, W5 Adım 0 ölçümü). ✅ **İL tarafı Dalga 3'te kapandı** (31 Tem 2026): varış
  filtresi artık `listing_stops.province_id` tamsayı eşitliği. Aşağıdaki hikâye **İLÇE için
  aynen geçerli** — ilçe hâlâ serbest metin ve `includes`/`ILIKE` ile aranıyor.
  Eski hâli `d.sehir?.includes(varis)` idi; iki taraf da katlanmıyordu. Ölçüm, DB'de **~76 satırın
  tamamı büyük harf** yazıldığını gösterdi (`ÇORLU` 42 · `KEMALPAŞA` 17 · `ÇERKEZKÖY` 6 …).
  Bu satırlar arama sonuçlarında **hiç görünmüyor** — sessiz, kullanıcıya dönük veri hasarı.
  ⚠️ Çoğunluk oyu ile onarma: `KEMALPAŞA` (17) doğru `Kemalpaşa`'dan (11) **daha kalabalık**.
  Onarım `aliases` sözlüğünden gelmeli (runbook Adım 8), elle `CASE` listesinden değil.
  Yeni konum karşılaştırması yazarken iki tarafı da `lib/alias-normalize.ts` ile katla.
- 🚨 **`onAuthStateChange` callback'i İÇİNDE `await supabase.*` ÇAĞIRMA** (A8, 29 Tem 2026).
  Callback, Supabase'in auth kilidi (`navigator.locks`) tutulurken çalışır; içeriden yapılan
  her `supabase.from(...)` / `getSession()` aynı kilidi bekler → **deadlock**. Belirti:
  konsolda `Lock "lock:sb-...-auth-token" was not released within 5000ms`; oturum çerezi
  geçerli olmasına rağmen istemci kendini çıkış yapmış sanır (navbar "Giriş Yap" gösterir,
  ama `/admin` gibi sunucu tarafı rotalar çalışır — onlar cookie'yi sunucuda okuyor).
  Doğrusu: callback yalnız senkron state yazar, DB işi `setTimeout(() => { ... }, 0)` ile
  kilidin dışına atılır. Uygulandığı yerler: `app/_components/HomeClient.tsx`,
  `app/giris/page.tsx`.
- Abone olunduğu anda `INITIAL_SESSION` bir kez tetiklenir → ayrıca `getSession()` çağırmaya
  gerek yok (ve o çağrı da kilide takılabilir).
- 🚨 **Sunucuda oturum devrederken `action_link` DEĞİL `hashed_token` kullan** (A10, 29 Tem 2026).
  `admin.generateLink()` iki şey döner: `properties.action_link` **implicit flow**tur
  (`#access_token=…`) — token yalnız tarayıcıda işlenir, **SSR cookie'si eski oturumda kalır**;
  proxy bir sonraki istekte kullanıcıyı yine eski kimlikte görür → sonsuz döngü.
  Doğrusu: `properties.hashed_token` alınıp cookie yazan `createServerClient` üzerinden
  `supabase.auth.verifyOtp({ type: 'magiclink', token_hash })` çağrılır; oturum doğrudan
  sb- cookie'lerine yazılır. Uygulandığı yer: `app/auth/devir/route.ts`.
  (`app/api/auth/switch-account/route.ts` hâlâ `action_link` döndürüyor — istemci tarafı
  akış olduğu için orada sorun çıkarmıyor, ama sunucu tarafında ASLA o yolu kullanma.)
- Supabase implicit-flow linki oturumu `#access_token=…&refresh_token=…` olarak bırakır ve
  client bunu okuduktan sonra **URL'yi TEMİZLEMEZ** — token'lar adres çubuğunda, tarayıcı
  geçmişinde ve kullanıcının kopyaladığı her linkte kalır. `HomeClient.tsx` oturum çözüldükten
  sonra `history.replaceState` ile fragment'ı siliyor (emniyet kemeri; asıl çözüm `/auth/devir`).
- Emekli oturumu `/auth/devir`'e gönderirken **sb- cookie'lerini silme**: devir, devri
  yetkilendirmek için emekli oturumun `merged_into` zincirini okumak zorunda. Temizliği
  (kurtarılamayan hâllerde) devir route'u kendisi yapar.
- 🚨 **Ücretli veya kaba-kuvvete açık auth işlemlerini İSTEMCİDEN çağırma** (G1/G2, 29 Tem 2026).
  `signInWithOtp` (SMS = para) ve `signInWithPassword` (sözlük saldırısı) aylarca doğrudan
  tarayıcıdan, herkese açık anon key ile çağrılıyordu. İstemcideki sayaçlar (sessionStorage)
  saldırgan için yok hükmünde. İkisi de artık sunucu route'unda: `/api/auth/otp`,
  `/api/auth/giris`. Yeni bir auth çağrısı eklerken kuralı tekrarla: **tetikleyici sunucuda,
  kota sunucuda; istemcideki bekleme yalnız UX.**
- Kota kovaları paylaşılabilir olmalı: `/api/auth/otp` ile `/api/ilan/[id]/sahiplen` **aynı**
  `'otp-ip-numara'` kovasını kullanır. Ayrı kova verseydik saldırgan iki uç nokta arasında
  gidip gelerek kotayı ikiye katlardı. Yeni bir SMS tetikleyicisi eklersen aynı kovaya bağla.
- Kotalarda önce `sayma: true` ile **BAK**, işlem gerçekten başarılı/başarısız olduktan sonra
  kaydet. Aksi halde sağlayıcı hatası (Twilio down) masum kullanıcıyı kilitler. Simetrik kural:
  giriş kotası yalnız **başarısız** denemeyi sayar ve başarıda `kotaSifirla` ile temizlenir;
  kilitliyken gelen istek sayaca YAZILMAZ, yoksa saldırgan istek atmaya devam ederek kurbanı
  süresiz kilitli tutar.
- Kota anahtarı olarak e-posta kullanırken **`trim().toLowerCase()`** uygula — aksi halde
  `Ali@X.com` / `ali@x.com` ayrı kovalara düşer ve sayaç harf büyüklüğü değiştirilerek sıfırlanır.
- ⚠️ `lib/kota.ts` sayaçları **process belleğinde**. Vercel'de çok instance → gerçek limit
  ≈ (limit × instance sayısı); deploy/soğuk başlangıç sıfırlar; `x-forwarded-for` proxy
  arkasında güvenilir, doğrudan erişimde taklit edilebilir. Tek savunma katmanı olarak sayma.
  Trafik artınca `kotaDene`'nin gövdesini Vercel KV / Upstash Redis'e taşı — imza değişmez.
- Oturum SUNUCUDA açıldığında (`/api/auth/giris`, `/auth/devir`) istemciye dönüşte
  `router.push` değil **tam sayfa yüklemesi** (`window.location.assign`) yap: tarayıcıdaki
  Supabase istemcisinin bellek içi durumu bayat kalabilir, tam yükleme header/proxy/server
  component'leri aynı oturuma oturtur.
- `maybeSingle()` — callback, proxy, actions her yerde
- `is_shadow_banned = false` — page.tsx + u/[username]/page.tsx zorunlu
- Audit trigger sadece INSERT; re-scan → `/api/ilan/duzelt`
- `correction_needed` CHECK → `docs/20260505_correction_needed.sql`
- Toplu işlem + archived → service role zorunlu
- Server action → ayrı dosya + `'use server'`
- Vercel env → dashboard; `.next` cache → `rm -rf .next`
- Supabase → Redirect URLs'e production URL eklenmeli
- **Ağır/çoklu-dosya işleyen API route'ları** (`whatsapp-parse`, `learn-aliases`, `crm/[id]/analiz`) → `export const maxDuration = 60` şart; yoksa Vercel default timeout'ta düz-metin hata sayfası ("An error occurred with your deployment...") döner ve frontend'in `res.json()` çağrısı "Unexpected token" hatasıyla patlar
- **Supabase'de `pg_stat_reset_single_table_counters` ÇALIŞMAZ (`42501`) — sayaç penceresi sıfırlanamaz, FARK alınır** (31 Tem 2026). Fonksiyon superuser'a bağlı, `postgres` rolü de alamıyor. Bunun sonucu ölçüm stratejisini komple değiştiriyor: bir kod deploy'undan sonra "sayacı sıfırla, bir hafta bekle, tekrar bak" planı Supabase'de **kurulamaz** — beklemek yalnız eski birikintinin üstüne yeni veri koyar ve ikisi ayrılamaz. Doğru yöntem: `pg_stat_user_indexes` anlık görüntüsünü bir tabloya yaz (taban çizgisi), bir hafta sonra `simdi - taban` farkını al. Matematiksel olarak sıfırlamayla aynı, yıkıcı değil, yetki istemiyor. 🚨 Fark alırken `pg_stat_database.stats_reset`'i de sakla ve karşılaştır: Postgres yeniden başlarsa sayaç geri sayar, fark **negatif** çıkar ve bu "kullanılmadı" değil "taban geçersiz" demektir. Uygulaması: `docs/20260731_index_temizligi.sql` BÖLÜM 8, taban tablosu `public.idx_taban_20260731`.
- **`maxDuration` bütçesi ile route içindeki `AbortController` süresi AYRI iki şeydir — senkron tutulmazsa bütçe çöpe gider** (31 Tem 2026, `learn-aliases`). Route `maxDuration = 60` ilan ediyordu ama LLM fetch'i `setTimeout(..., 8000)` ile kesiliyordu: panelin en düşük seçeneği olan limit=10'da bile *"LLM 8 saniyede yanit vermedi"* dönüyordu ve fonksiyonun 52 saniyesi hiç kullanılmıyordu. Kural: iç timeout `maxDuration` eksi DB turları payı olacak (burada 45 sn) ve **platform sınırının altında kalacak** — yoksa Vercel'in 504'ü bizim anlamlı hatamızın önüne geçer. İkinci tuzak: **süreyi hata metnine sabit yazma.** Eski mesaj "8 saniyede" diyordu; timeout değişince yalan söylemeye başlardı, artık `LLM_TIMEOUT_MS`'ten türetiliyor. Üçüncüsü: **hata metni kullanıcının yapamayacağı şeyi önermesin** — eski metin "limit azalt" diyordu ama 10 zaten tabandı.
- **Frontend fetch + `.json()` pattern'i** → önce `res.text()` al, sonra `JSON.parse` dene (try/catch); Vercel platform hataları (413/504) JSON değil HTML/düz-metin döner
- **`write_file` tüm dosyayı ezer** — küçük değişiklikler için `str_replace` kullan
- **İnline component anti-pattern**: Parent fonksiyonu içinde tanımlanan component'leri JSX olarak çağırmak (`<EditForm />`) her render'da yeni component tipi yaratır → input focus kaybolur, cursor başa döner. Çözüm: fonksiyon çağrısı (`{EditForm({})}`) veya parent dışına taşı.
- **WhatsApp ZIP timeout — `maxDuration=60` olsa bile aşılabilir**: `whatsapp-parse` route'unda dosya sayısı az olsa bile ("grup 1/1") 504 timeout görülebiliyor — sebep dosya içeriği değil, **medyalı (fotoğraf/video dahil) WhatsApp export**'unun çok büyük olması (yüzlerce MB–GB); `request.formData()` + `file.arrayBuffer()` bu dosyayı sunucuda tam okuyordu ve bu süre 60sn'lik execution time'a dahildi. İlk müdahale (22 Tem 2026, sabah) sadece boyuta duyarlı gruplama + kullanıcıya uyarıydı — yetersiz kaldı, dosya sunucuya gitmeden aynı hata devam etti. **Asıl çözüm (22 Tem 2026, `WhatsappYukle.tsx`)**: ZIP artık sunucuya YÜKLENMEDEN ÖNCE tarayıcıda `JSZip` ile açılıyor (`zipDenMetinCikar`), sadece içindeki sohbet `.txt`'i çıkarılıp `.txt` olarak sunucuya gönderiliyor — medya (foto/video) hiç network'e binmiyor, Vercel'in 60sn'lik süresine artık sadece küçük metin okuma/parse/DB adımları giriyor. Ayıklama sırasında buton "📦 Medya ayıklanıyor..." gösteriyor (tarayıcı tarafı, süre sınırı yok). Sohbet txt'i zip içinde bulunamazsa veya zip bozuksa orijinal dosya sunucuya gönderilip eski davranışa (sessizce atlama / hata) düşülüyor. **Ek optimizasyon (22 Tem 2026, aynı gün, kullanıcı isteğiyle)**: Eski/uzun süredir aktif gruplarda medya olmasa bile tüm sohbet geçmişi (yıllarca) yine de yükleniyordu — sunucu zaten `saat_filtre` cutoff'undan eski mesajları atıyordu ama bu filtre gönderdikten SONRA uygulanıyordu. Artık `dosyaHazirla()` fonksiyonu hem zip'ten çıkan hem düz `.txt` metnini, göndermeden önce tarayıcıda `eskiIcerigiKirp()` ile kırpıyor: metin SONDAN başa doğru satır satır taranıyor (sunucudaki `parseChatTxt` ile birebir aynı `TS_ANDROID`/`TS_IOS` regex'leri kullanılarak), cutoff'tan (+6 saat güvenlik payı) eski ilk mesaj bulununca tarama duruyor ve öncesi tamamen atılıyor — böylece eski geçmişin tamamını okumaya/işlemeye hiç gerek kalmıyor, payload sadece işe yarayan son kısım kadar kalıyor.

- **WhatsApp sohbet parser'ı TEK KAYNAKTADIR: `lib/whatsapp/chatParser.ts`** (28 Tem 2026). Öncesinde aynı regex/tarih mantığı hem `api/whatsapp-parse/route.ts` hem `WhatsappYukle.tsx` içinde elle senkron tutuluyordu; ayrıştıklarında tarayıcı doğru mesajı kırpıp atıyor, sunucu farklı yorumluyordu — kayıp sessizdi. Kopya mantık YAZMA, modülü import et. Testler: `npm run test:parser`.
- **`new Date("2026-07-28T14:30")` (offset'siz) HOST saat dilimine göre yorumlanır** — tarayıcı UTC+3, Vercel UTC olduğu için aynı mesaj 3 saat farklı zamana düşüyordu; cutoff sınırındaki ilanlar bu yüzden sessizce eleniyordu. `chatParser` tüm zaman damgalarını sabit `+03:00` varsayarak çözer (`VARSAYILAN_TZ`); manuel `new Date(...)` ile tarih kurma.
- **WhatsApp export formatı telefon lokaline göre değişir** — ayraç `.`/`/`/`-`, yıl 2 veya 4 hane, saat 24h veya 12h (`ÖÖ/ÖS/AM/PM`), iOS köşeli parantezli `[...]` Android tireli, AM/PM öncesinde görünmez **U+202F dar boşluk**. Eski regex sadece `dd.mm.yyyy` + 24h + iOS/Android'in dar bir alt kümesini tanıyordu; tanımayan formatlarda dosyanın TAMAMI 0 mesajla dönüyordu (hata yok, sadece "0 mesaj"). `satiriTemizle()` görünmez Unicode'ları (bidi/zero-width/NBSP) temizler — regex'ten ÖNCE çağrılmalı.
- **Türkçe normalize ederken `İ/I` `toLowerCase()`'ten ÖNCE dönüştürülmeli**; sistem mesajı filtresi aksansız karşılaştırma yapmazsa "uçtan uca" ile "uctan uca" eşleşmez ve sistem mesajları ilan sanılır.
- **`raw_posts` chunk INSERT'te tek `23505` tüm chunk'ı düşürür** — eski kod `continue` diyordu, 100 satırın 99'u sessizce kayboluyordu. Artık chunk `23505` alırsa satır satır retry edilir; `23505` dışı hatalar `insert_failed` + `errors[]` ile response'a ve `structuredLog`'a yansır. (`upsert` + `onConflict` kullanılmadı: `raw_posts`'un unique constraint kolonları dokümante değil.)
- **PostgREST insert dönüşünün SIRASI garanti değildir** — `inserted[i]` ↔ `meta[i]` eşlemesi yapma; satırlar çakışma nedeniyle eksik dönerse eşleme kayar ve YANLIŞ kayıtlar işlenir. Doğal anahtarla (`clean_hash|contact_phone|message_date`) map'le.
- **Repost ilanının TEK üreticisi `parse-listing`'dir** (28 Tem 2026). Öncesinde route `repostListings()` ile orijinal ilanı kopyalıyordu ama `raw_posts` INSERT trigger'ı zaten `parse-listing`'i çağırıyordu → tek mesaj İKİ ilan. `repostListings` kaldırıldı; `parse-listing` listing insert'inde `is_repost: rawPost.is_repost === true` ile bayrağı taşıyor. ✅ Doğrulandı (28 Tem 2026): `on_raw_post_insert AFTER INSERT ON public.raw_posts FOR EACH ROW EXECUTE FUNCTION trigger_parse_listing()` — **WHEN koşulu yok**, her satır için çalışıyor. Yani route'un ayrıca ilan üretmemesi doğru karardı.
- **PostgREST `.in()` filtreyi URL'e gömer** — sınırsız dizi verme. Binlerce 32 karakterlik hash on binlerce karakterlik URL üretir; sorgu ya çok yavaşlar ya reddedilir. `whatsapp-parse` içindeki `parcala()` yardımcısı ile `IN_PARCA_BOYU = 150`'lik parçalara böl.
- **Supabase update/insert'lerde sınırsız `Promise.all` ATMA** — bağlantı havuzu doyar, istekler sıraya girer ve toplam süre doğrusal olmayan şekilde patlar. `sirayla(ogeler, ESZAMANLI=6, isle)` ile eşzamanlılık tavanı koy.
- **`raw_posts`'un benzersizlik kuralı `(clean_hash, message_date)`'tir — `clean_hash` TEK BAŞINA unique DEĞİL** (28 Tem 2026, `pg_indexes` ile doğrulandı). Kurallar `CONSTRAINT` değil `CREATE UNIQUE INDEX` ile tanımlı, o yüzden `pg_constraint`'te görünmezler; `pg_indexes`'e bak. Gerçek indeksler: `idx_raw_posts_hash_msgdate UNIQUE (clean_hash, message_date) WHERE clean_hash IS NOT NULL` (bağlayıcı olan) ve `raw_posts_dedup_idx UNIQUE (clean_hash, contact_phone, message_date) WHERE clean_hash IS NOT NULL AND contact_phone IS NOT NULL`. `idx_raw_posts_clean_hash` unique DEĞİL. (Eski `idx_raw_posts_hash_day (clean_hash, post_date)` 28 Tem 2026'da düşürüldü.)
- **Batch-içi tekilleştirme anahtarı DB'nin unique indeksiyle BİREBİR aynı olmalı** — bu 23505 fırtınasının asıl sebebiydi: route'un anahtarı `hash__telefon__tarih`, DB'ninki `(clean_hash, post_date)` idi. Aynı gün aynı metni farklı iki kişi paylaşınca (nakliye gruplarında rutin) uygulama ayrı satır sanıyor, DB tüm chunk'ı reddediyordu. Aynı hata kurtarma bloğunda da vardı: sadece `clean_hash`'e bakmak, başka güne ait MEŞRU repost'u da eliyordu. Çakışma testi her zaman unique indeksin ÇİFTİ üzerinden yapılmalı (bugün `(clean_hash, message_date)`).
- **Kısmi unique indeks (`WHERE ...`) `upsert`/`onConflict` ile kullanılamaz** — PostgreSQL kısmi indeksi `ON CONFLICT` hedefi olarak ancak predicate'i ima eden bir `WHERE` varsa çıkarsar, PostgREST bunu üretmez. `raw_posts`'un iki unique indeksi de kısmi olduğu için constraint-agnostik 23505 yakalaması korunmak zorunda.
- **Alias eşleşmesi SUBSTRING ile yapılmamalı** (28 Tem 2026). `gatekeeper_sync` `norm.includes(aliasNorm)` kullanıyordu: `"lojistik"` içindeki `"ist"` → İstanbul, `"getirin"` içindeki `"tir"` → TIR, `"balyası"` içindeki `"balya"` → Balıkesir. Neredeyse her mesaj 2+ şehir bulmuş sayılıyor, `isAd` kuralı (`telefon && (araç || şehir>=2)`) fiilen **"telefon var mı"**ya iniyordu — gatekeeper devre dışıydı. Düzeltme: token eşitliği + Türkçe hal eki soyma (`ekSoy`), tokenlar `[\s.>-]` sınırlarından ayrılır, 3 harften kısa alias yok sayılır. `parse-listing/findPlaces` zaten token bazlıydı; iki taraf hizalandı.
- **İlçe adları günlük Türkçe kelimelerle çakışıyor (homonim)** — `araç`→Kastamonu, `olur`→Erzurum, `pazar`→Rize, `perşembe`→Ordu, `merkez`→onlarca il. Token eşleşmesi bunları TEMİZLEMEZ, veri tarafında pasifleştirmek gerekir: `docs/20260728_alias_homonim_temizligi.sql`. Hem gatekeeper'ı hem `parse-listing`'in gerçek güzergâh çıkarımını bozar.
- 🚨 **LLM prompt'unun ÖRNEKLERİ kuraldan güçlüdür — bozuk örnek bozuk veri üretir** (29 Tem 2026, `SPRINT_01` W5/D1). `learn-aliases` prompt'unda kurallar Türkçe doğru yazımı istiyordu ama JSON **örnekleri** ASCII'ye indirgenmişti (`"Eskisehir"`, `"Istanbul"`, `"Tekirdag"`). Model kuralı değil örneği taklit etti; `aliases.normalized` aylarca iki yazımla doldu (`Istanbul` 13 satır / `İstanbul` 154 satır). **Kural:** prompt'a örnek yazarken örneğin kendisi üretmek istediğin çıktının birebir doğru hali olmalı. Ayrıca prompt'a mevcut kayıtlar bağlam olarak veriliyorsa "listede eski/bozuk kayıtlar olabilir, onları örnek alma" satırı şart — yoksa bozulma kendi kendini besler.
- 🚨 **Karşılaştırma anahtarı ile SAKLANAN değer aynı şey değildir** (29 Tem 2026, `SPRINT_01` W5/D2+D4). `Istanbul` ve `İstanbul` **aynı şehir** ama string eşitliği bunu göremez. `parse-listing/findPlaces`'teki `seen` seti ham `normalized` üzerinde çalıştığı için iki yazım İKİ AYRI ŞEHİR sayılıyordu; `sameCity` koruması devreye girmiyor ve **sahte `İstanbul→İstanbul` ilanı** kaydediliyordu (aynı sebeple şehir filtresi de ilanların bir kısmını hiç göstermiyordu). Düzeltme: her karşılaştırma/dedup anahtarı katlanmış formdan geçer (`aliasKey` / `yerKey`), **saklanan değer Türkçe kalır**. ⚠️ Katlama fonksiyonu (`lib/alias-normalize.ts::aliasKey`) ile DB indeks ifadesi (`docs/20260729_alias_normalize_trigger.sql`) BİREBİR aynı olmalı: `translate(lower(replace(alias,'İ','i')),'ıçğöşü','icgosu')`. Sıra kritik — `İ` (U+0130) **önce** düz `i`ye çevrilmeli, yoksa Postgres `lower()` onu `i` + U+0307 olarak iki karaktere açar ve JS `toLowerCase()` ile ayrışır → uygulama "çakışma yok" derken DB 23505 atar. 📏 **Ölçüldü (4 Ağu 2026):** `lower('İSTANBUL')` = `i̇stanbul`, **length 9**, `='istanbul'` **false**. Yani Postgres `lower()` ile JS `.toLowerCase()` **aynı** davranıyor; ayrışan taraf `replace`'i öne alan `aliasKey`/indeks ifadesi. 🚨 **Ve `lib/alias-normalize.ts`:82 `normalizeAliasFields` bu kurala UYMUYOR** — düz `.toLowerCase()` kullanıyor. `İ` içeren alias DB'ye `i`+U+0307 olarak yazılıyor; dahası `trNorm`'un `[^a-z0-9\s]`→`' '` kuralı U+0307'yi **boşluğa** çevirdiği için (`i kitelli` ≠ `ikitelli`) o alias hiçbir mesajla eşleşemiyor → **sessiz ölü kayıt**. Görev #45. ✅ **DÜZELTİLDİ + ONARILDI (4 Ağu):** kod :82'ye `.replace(/İ/g,'i')` eklendi (**✅ canlıda — 7 Ağu 2026'da davranışsal tanıkla doğrulandı: onarımdan sonra öğrenilen 27 yeni alias'ın U+0307'lüsü 0, tablodaki aktif U+0307 toplamı 0. Tanık kolonu `27`; onsuz "0" hiçbir şey kanıtlamazdı**); veri tarafında 34 bozuk satır bulundu — **24'ü gölge kopya** (pasifleştirildi, kapsama kaybı yok), **9'u gerçek kayıp** (`nizip` · `istoç` · `ivedik` · `kdz ereğli` · `delice` · `iskendurun` · `iscehisardan` · `ş.kochisar` · `yeni mahalle` — onarıldı, `trNorm` eşleşme testi 9/9). 🚨 İkinci hasar daha sinsiydi: bu satırlar `aliases_katlanmis_anahtar_uniq`i **baypas ediyordu** (indeks `replace(alias,'İ','i')` ile başlıyor, saklanan değerde büyük `İ` yok, U+0307 hayatta kalıyor, anahtar ayrışıyor) — 24 gölge kopya bu delikten girdi. Ayrıntı: `docs/20260804_u0307_alias_onarimi.sql`.
- 🚨 **SIFIR GENİŞLİKLİ KARAKTER = SESSİZ İL KAYBI. VE BU BİR SALDIRI, KAZA DEĞİL** (4 Ağu 2026, canlı veride bulundu). `raw_posts` içinde `S‌apanca` (U+200C, ZWNJ) ve `⁠Sarar` (U+2060) yazan mesajlar var — bir gönderici aynı ilanı tekrar tekrar atabilmek için metne görünmez karakter serpiyor, `clean_hash` her seferinde değişiyor ve **tekilleştirme delinmiş oluyor**. Yan hasar daha pahalı: `app/api/whatsapp-parse/route.ts::trNorm`'un `[^a-z0-9\s\.>-]` → `' '` kuralı bilinmeyen karakteri **boşluğa** çevirir → `s apanca`; `:180` token'lara ayırır, `t.length < 2` filtresi `s`yi atar, geriye `apanca` kalır. Hiçbir alias'la eşleşmez → ilanın ili **sessizce kaybolur**, hata da log da yok. 🔁 Mekanizma U+0307 hatasıyla **birebir aynı** (bkz. bir alt madde): görünmez karakter → boşluk → kelime bölünmesi. ✅ Düzeltme (4 Ağu): `gorunmezleriSil()` `trNorm`'un **en başına** eklendi (siler, boşluğa çevirmez). Ölçüldü: önce `["apanca"]`, sonra `["sapanca"]`; `Sapanca`/`Sarar`/`Kadıköy` etkilenmedi. ✅ **VE TEKİLLEŞTİRME DELİĞİ DE KAPANDI (4 Ağu, #61) — ama AYRI bir düzeltmeyle.** `trNorm` düzeltmesi yalnız YER EŞLEŞTİRMESİNİ onarmıştı; `cleanHash()` görünmez karakteri hash'e sokmaya devam ediyordu. 🚨 **Ders: aynı kök sebebin İKİ AYRI zararı vardı, birini düzeltince öteki düzelmiş SANILDI.** Kök sebep bulunduğunda "bu karakter başka nereye giriyor" diye ayrıca aranmalı. Düzeltme: `cleanHash` artık `chatParser::gorunmezleriSil`'i (`cfKarakterleriSil` adıyla) çağırıyor. 📏 Ölçüldü: eski hash'te `S`+ZWNJ+`apanca` ≠ `Sapanca` (delik), yenide **eşit**; U+2060 ve U+200B varyantları da eşit; emoji (`➡️ ✅`) içeren mesajın hash'i **değişmedi**. Yedek alınmadı (Bayram kararı) — `text` zaten `satiriTemizle`'den geçtiği için canlı satırların hash'i pratikte değişmiyor, bu çağrı ikinci savunma hattı. ✅ `lib/whatsapp/chatParser.ts` de düzeltildi: liste `GORUNMEZ_CF` sabitine alındı, eksik U+200C/U+200D/U+2060 eklendi, ham karakterler `\u` kaçışına çevrildi. ⚠️ Regex `\u` **kaçışıyla** yazılmalı, ham karakterle değil — editör/formatter ham görünmezleri sessizce silerse koruma da görünmeden ölür. 🚨 **U+FE0F iki listede de aynı DEĞİL, bu KASITLI.** FE0F `Cf` değil `Mn` ve `➡️ ⚠️ ✅` emojilerinin parçası. SAKLANAN metne ve hash'e dokunan yerler (`chatParser`, `cleanHash`) onu **silmez** — silse binlerce eski mesajın hash'i değişir, yeniden içe aktarımda kopya seli olur. Yalnız EŞLEŞTİRME tarafı (`whatsapp-parse`:153, `parse-listing`:74) siler; orada ne saklanan değer ne hash var. **Üç kopya artık iki farklı listeye ayrıldı; hangisinin nerede kullanıldığı kod yorumlarında yazılı.**
- 🚨 **DEDUP ANAHTARI, ATILAN İSABETİN TAŞIDIĞI BİLGİYİ DE ATAR** (6 Ağu 2026, #89-A). `findPlaces`'teki `seen` **sadece il** ile anahtarlanmış bir `Set`ti. "Ankara Gölbaşı" metninde önce `ankara` isabet ediyor (`district=null`), sonra gelen `gölbaşı` (Ankara/Gölbaşı) `seen.has('ankara')` yüzünden **`hits`e hiç girmiyordu** — yani ilçe bilgisi sıralamaya bile ulaşamadan yok oluyordu. Metinde AÇIKÇA yazan ilçe sessizce düşüyor, ne hata ne log. 🚨 **BU MADDE ÖNCEDEN YANLIŞ TEŞHİS EDİLMİŞTİ:** hem burada hem `index.ts` yorumlarında bu davranış "öncelik sıralaması sorunu" diye açıklanıyordu. Değildi. Kanıt: `Denizli(90)` / `Kale(90)` — **öncelikler EŞİTken bile** ilçe düşüyor, çünkü sorun `sort` değil ondan önceki `seen` kontrolü. Önceliklerle oynamak hiçbir şeyi çözmezdi. ✅ Düzeltme: `seen` artık `Map<string, PlaceHit>`; ikinci isabeti atmak yerine **mevcut isabetin boş ilçesini dolduruyor** (`ekleVeyaYukselt`). Kural katı — il ASLA değişmez, öncelik ASLA değişmez, yer EKLENMEZ/SİLİNMEZ, sıra bozulmaz, dolu ilçenin üstüne YAZILMAZ (ilk kazanır). 📏 **Ölçek:** 948 aktif ilçe alias'ının **912'si** (%96) kendi ilinin bare alias'ından düşük/eşit öncelikte — yani "İl İlçe" yazan neredeyse her satır etkileniyordu; varış ilçe doluluğu 7 günde %25,5. 35 gerçek ilanda ilçeli şerit **%54,7 → %81,2**, net **+6** şerit, açıklanamayan kayıp **0** (`npm run olc:89`). 📌 Yan etki İSTENEN: iki uç aynı ile ama FARKLI ilçeye çözülünce `ayniIlce` artık ayırt ediyor, sahte "kendine şerit" kayıtları düşüyor. ⚠️ Genel ders: bir dedup anahtarı, tekilleştirdiği kaydın **tüm alanlarını** kapsamıyorsa, dar anahtar geniş bilgiyi sessizce çöpe atar. Anahtar dar tutulacaksa atma değil **birleştirme** yapılmalı.
- ⚠️ **`normalized` her zaman şehir DEĞİL — otomatik yazım düzeltmesi yapma** (29 Tem 2026, W5/D2). `type='vehicle'` satırlarında `normalized` doğrudan `vehicle_type` olarak ilana yazılıyor; "tir" → "Tir" yapmak eşleşmeyi bozar. Bu yüzden ne `normalizeAliasFields` ne de DB trigger'ı `normalized`/`district` üzerinde büyük harfe çevirme / ASCII katlama yapıyor — yalnız boşluk temizliği. Yanlış yazım sessizce düzeltilmez, `aliasCakismaBul` **409 ile admine sorar** (öneri: çoğunluk yazımı — 154 satır `İstanbul` varken 13 satırlık `Istanbul` kazanmasın).
- 🚨 **`alias` kolonundaki UNIQUE kısıtı HAM string üzerinde — katlanmış kopyaları engellemez** (29 Tem 2026, W5/D3). `Gebze`/`GEBZE`/`gebze`, `Çorlu`/`çorlu`/`corlu`, `Torbali`/`torbali`/`torbalı` üç ayrı satır olarak duruyor ve hepsi tek katlanmış anahtara düşüyor. Sonucu: planlanan tam UNIQUE indeks **kurulamaz** (23505). Ayrıca temizlik script'i bu satırları silmiyor, yalnız `normalized`/`district`'i tutarlı yapıyor — yani veri temizliği tamamlansa bile önkoşul karşılanmıyor. Çözüm iki parçalı: önce fazlalıkları `is_active = false` yap (runbook Adım 9; `row_number() OVER (PARTITION BY type, katlanmış ORDER BY id) > 1` — **silme yok**, `findPlaces` zaten `.order('id')` ile küçük id'yi seçtiği için bugünkü davranış değişmez), sonra indeksi **kısmi** kur (`WHERE is_active = true`) — pasifleştirilmiş kopyalar tabloda durduğu için tam indeks onları da ihlal sayardı.
- **PostgREST tek sorguda EN FAZLA 1000 satır döndürür — ve bunu SÖYLEMEZ** (28 Tem 2026). Supabase'in `db.max-rows` ayarı. Sınırı aşan `select()` hata vermez, sessizce kesilir. `aliases` tablosu 1887 aktif satıra çıkmıştı; hem `app/api/whatsapp-parse` gatekeeper'ı hem `supabase/functions/parse-listing` şehir/araç tespitini alias'ların **%47'sini hiç görmeden** yapıyordu. Üstelik `ORDER BY` olmadığı için hangi 887 satırın düştüğü belirsizdi → aynı mesaj farklı zamanlarda farklı ayrıştırılabiliyordu. Düzeltme: `.range()` ile sayfalama + `.order('id')` (sıralama olmadan sayfalar çakışır/atlar). **Kural: bir tabloyu "hepsini çek" niyetiyle okuyan her sorgu sayfalanmalı.**
- **`raw_posts.post_date` KALDIRILDI** (28 Tem 2026). Tek tarih otoritesi `message_date`; unique indeks de onun üzerinde. Kayıt: `docs/20260728_raw_posts_post_date_sadelestirme.sql`. Not: eski 1543 satırda `post_date` mesajın günü değil İÇE AKTARMA günüydü (12–20 May 2026 penceresi) — kolon baştan güvenilmezdi.
- **Telefon geriye-doldurma içe aktarmanın PARÇASI DEĞİL** — `POST /api/raw-posts/telefon-doldur` ayrı işi yapar. Route'un içindeyken satır başına 2 UPDATE ile süre bütçesini yiyordu ve içe aktarmanın doğruluğuna hiç katkısı yoktu. Telefon regex'i tek kaynakta: `lib/whatsapp/telefon.ts` (⚠️ `supabase/functions/parse-listing/index.ts` içinde Deno tarafında ikinci bir kopya var, Deno/Next sınırı yüzünden import edilemiyor — birini değiştirirken diğerini de güncelle).
- **Vercel'de 60 sn aşılırsa fonksiyon ÖLDÜRÜLÜR ve JSON değil HTML döner** — bu yüzden ağır route'lar kendi süre bütçesini tutmalı. `whatsapp-parse`: `SURE_BUTCESI_MS = 45_000`; dolduğunda döngü kırılır ve `{ tamamlanmadi: true, islenmeyen: N }` ile **geçerli JSON** döner. Sessiz ölüm yerine kısmi başarı raporlanır.
- **Parti boyu sihirli sayıyla ayarlanmaz — istemci ikiye böler (bisection)** (28 Tem 2026). `WhatsappYukle.tsx` sıralı döngü yerine iş kuyruğu kullanır: 504/413 ya da `tamamlanmadi` gelirse parti ikiye bölünüp kuyruğun başına konur; grupta tek dosya kaldıysa `dosyayiBol()` dosyayı **mesaj başlığı sınırından** (satır ortasından değil) ikiye ayırır. `MAX_BOLUNME = 8`. Bu güvenlidir çünkü tekilleştirme hash tabanlı → yeniden gönderim idempotent, yazılmış satırlar `skipped` döner.
- **`requireAdmin()` API route'ta KULLANILMAZ** — içeride `redirect()` çağırır, bu `NEXT_REDIRECT` fırlatır ve route 500 döner. API route'larda `requireStaff()` kullan (`{ ok, user }` / `{ ok, status, error }` döner).
- **RLS SATIR bazlıdır, KOLON bazlı DEĞİLDİR** (28 Tem 2026, `SPRINT_01` L1e). İki ayrı sonucu var, ikisi de bizi ısırdı: **(1) Okuma:** satır herkese açıksa o satırın *yetkili* her kolonu da okunur — `contact_phone` aylarca `GET /rest/v1/listings?select=contact_phone` ile anon key üzerinden çekilebiliyordu; arayüzde göstermemek koruma değildi. Çözüm PostgREST kolon yetkisini revoke etmek. **(2) Yazma:** "sadece kendi satırın" politikası, gövdeye `role: 'admin'` / `trust_level: 'verified'` / `moderation_status: 'approved'` eklemeyi **engellemez**. İstemciden gelen her `update`/`upsert` `'use server'` action içinde **kolon beyaz listesinden** geçmeli. Örnekler: `app/panel/actions.ts`, `app/profil-tamamla/actions.ts`.
- **Tablo geneline verilmiş `GRANT`, kolon bazlı `REVOKE`'u EZER** (28 Tem 2026). `revoke select (contact_phone) on listings from anon;` tek başına **no-op**'tur. Doğrusu: önce tablo geneli yetkiyi al, sonra hedef kolon hariç tüm kolonları `information_schema.columns` üzerinden programatik geri ver. Örnek: `docs/20260728_contact_phone_revoke.sql`.
- 🚨 **Kolon bazlı grant, `listings`'e SONRADAN eklenen kolonları KAPSAMAZ** (29 Tem 2026, `SPRINT_01` L1e). `20260728_contact_phone_revoke.sql` tablo geneli yetkiyi alıp `contact_phone` hariç **o an var olan** kolonları tek tek geri verdi. Artık `public.listings` kolon bazlı yetkilendirilmiş bir tablodur: yeni bir kolon eklendiğinde `anon`/`authenticated` o kolon için **yetkisiz doğar** ve ilk okuma/yazmada `42501 permission denied for column …` ile patlar — üstelik hata çoğu zaman uygulama katmanında "kayıt olmadı" gibi görünür. **Kural:** `alter table public.listings add column …` yazan her migration'a hemen ardından `grant select, insert, update (yeni_kolon) on public.listings to authenticated;` (+ herkese açıksa `grant select (yeni_kolon) … to anon;`) ekle. Kontrol: `select column_name from information_schema.columns c where table_name='listings' and not exists (select 1 from information_schema.column_privileges p where p.table_name='listings' and p.column_name=c.column_name and p.grantee='authenticated');`
- **Kod ve migration'ın SIRASI önemlidir** — yetki daraltan migration'lar **deploy'dan SONRA**, yeni kolon/tablo açan migration'lar **deploy'dan ÖNCE** çalıştırılır. Ters sırada ya kod olmayan kolona yazar ya da yeni kod var olmayan yetkiyle çalışır. Migration dosyasının başına hangisi olduğunu YAZ.
- **Bellek içi rate limit tek instance varsayar** — `api/ilan/[id]/telefon` (20/dk) ve `api/ilan/[id]/sahiplen` (60 sn OTP cooldown) `Map` kullanıyor. Çok instance'a ölçeklenirse limit instance sayısı kadar gevşer. Redis'e taşıma kararı `SPRINT_01` G2 ile birlikte. Ayrıca sayaç yalnızca işlem **gerçekten** başarılıysa başlatılmalı — sağlayıcı hatası kullanıcıyı kilitlememeli.
- **Recovery oturumu ≠ normal oturum, ama Supabase ikisini de kabul eder** (28 Tem 2026, `SPRINT_01` R1). Tarayıcıda normal bir oturum açıkken `supabase.auth.updateUser({ password })` **eski şifre sorulmadan çalışır**. `/auth/reset` bu yüzden formu koşulsuz göstermemeli: `PASSWORD_RECOVERY` event'i (veya PKCE `?code=` takası) beklenmeli, işlem sonrası `signOut()` çağrılmalı.
- 🚨 **`/u/[username]` KLASÖR ADI YALAN SÖYLÜYOR — param `username` değil, kullanıcı `id`'si** (29 Tem 2026, `SPRINT_01` S3). `app/u/[username]/page.tsx` param'ı `.eq('id', userId)` ile kullanıyor, panel de linki `/u/${userId}` üretiyor. `users.username` kolonu **routing'de hiç kullanılmıyor**. Bu rotaya URL üreten her yer (sitemap, paylaş butonu, e-posta şablonu) **id** yazmak zorunda; `username` yazan toptan 404 basar. Klasörü yeniden adlandırmak isterse `[id]` olmalı.
- 🚨 **`'use client'` sayfası `metadata` EXPORT EDEMEZ** (29 Tem 2026, `SPRINT_01` S2). Next bunu **hata vermeden yok sayar** — yazdığın `robots`/`title` hiçbir zaman HTML'e girmez, fark etmen aylar sürer. Tek çözüm: aynı route segmentinde sunucu tarafı bir `layout.tsx`. Mümkünse **segment seviyesine** koy (`app/auth/layout.tsx`), sayfa başına değil; yoksa yeni eklenen kardeş rotalar sessizce dışarıda kalır.
- **OG görseli: aynı segmentte TEK dosya olabilir** (29 Tem 2026, `SPRINT_01` S1). `app/opengraph-image.{tsx,png,jpg}` bir arada bulunamaz — Next hangisini seçeceğini bilemez. Statik görsele geçerken `.tsx` üreteci **silinmek zorunda**. Alt metin ayrı dosyadan gelir: `app/opengraph-image.alt.txt`. ⚠️ **Dosya boyutu:** WhatsApp büyük görsellerde kartı sessizce göstermez; 1200×630 JPEG ~130 KB güvenli, aynı kadraj PNG olarak 650 KB'a çıkıyordu. ⚠️ Karttaki sayı/rozet (ör. "519 aktif ilan", "BETA") **donmuş** metindir; güncellenmesi elle yapılır.
- 🚨 **`metadataBase` olmadan göreli OG/canonical URL'leri ÜRETİLMEZ** (29 Tem 2026, `SPRINT_01` S1). Next build'de uyarı verip sessizce atlar. WhatsApp/LinkedIn paylaşım kartının hiç görünmemesinin en sık sebebi budur. ~~Ayrıca **canonical MİRAS ALINMAZ**~~ 🚨 **BU CÜMLE YANLIŞTI, 7 Ağu 2026'da düzeltildi (#33) — aşağıdaki maddeye bakın.**
- 🚨 **`alternates` (canonical) ÜST LAYOUT'TAN MİRAS ALINIR** (7 Ağu 2026, #33). Buraya 29 Tem'de "miras alınmaz" diye yazılmıştı; **kaynak okunarak yanlışlandı**: Next 16'nın birleştiricisi (`node_modules/next/dist/lib/metadata/resolve-metadata.js:166`) üst katmanın çözülmüş metadata'sını `structuredClone` ile klonlayıp başlangıç alıyor, sonra YALNIZCA çocuğun kendi nesnesinde bulunan anahtarları eziyor. Sonuç: kök `layout.tsx` `canonical: '/'` taşıdığı sürece kendi canonical'ını yazmayan HER sayfa kendini ana sayfa ilan ediyordu — Google için "kopya sayfa", indeksten düşme sebebi. **Kural:** kök layout canonical TAŞIMAZ (varsayılan "canonical yok" güvenlidir, Google self-canonical sayar); her rota ya kendi canonical'ını yazar ya `noindex` olur. `npm run test:seo` bunu 72 kontrolle kilitliyor. 📌 **Ders:** bir davranışı yorumdan/dokümandan öğrenmeyin — bu satırın kendisi üç ay boyunca yanlış yol gösterdi. Miras zinciri LAYOUT'lardan + yaprak sayfadan oluşur; kardeş bir `page.tsx` zincirde YER ALMAZ.
- ⚠️ **Blok yorumunun içine `robots.txt` joker kalıbı YAZMAYIN** (7 Ağu 2026, #33). `/ilan/*/sahiplen` içindeki yıldız-eğik çizgi ikilisi `/* … */` yorumunu **erken kapatır**; `tsc` beş alakasız hata verir (`TS1443`, `Unterminated template literal`) ve sebebi görünmez. Kalıbı kelimeyle anlatın.
- 🚨 **robots.txt'te isimli blok, `*` bloğunun YERİNE GEÇER — birleşmez** (29 Tem 2026, `SPRINT_01` S4). GoogleBot/GPTBot/ClaudeBot kendi adını taşıyan bir blok görünce `User-agent: *` bloğunu **tamamen yok sayar**. Bu yüzden `public/robots.txt`'teki dört bloğun disallow listesi birebir aynı olmak zorunda; yeni bir özel alan eklerken dördünü birden güncelle. (Eski halinde `*` bloğu düpedüz `Allow: /` diyordu → `/panel/`, `/admin/`, `/api/` genel taramaya açıktı.) ⚠️ robots.txt bir güvenlik sınırı değildir; asıl sınır `proxy.ts` + `requireStaff()` + RLS.
- 🚨 **Kota, KAPININ olduğu yerde sayılmalı** (29 Tem 2026, `ILAN_VER_ANALIZ` V7). `parse-text` ücretli Anthropic çağrısını istek başında kotayla kapatıyor ama sayaç (`countAiListingsLast24h`) `listings.raw_text IS NOT NULL` satırlarını sayıyor — yani **kayıt** anını. Ayrıştırıp formu göndermeyen kullanıcının sayacı hiç artmaz; ücretli endpoint sınırsız çağrılabilir. Aynı sayaç `whatsapp/route.ts:191,204` tarafından da besleniyor, yani kanallar birbirinin kotasını yiyor. **Kural:** ücretli/kaba-kuvvete açık her çağrıda kapı ile sayaç **aynı olayı** ölçer; `lib/kota.ts` ile önce `sayma: true` peek, işlem **başarılıysa** sayaç işlenir.
- 🚨 **`moderation_status`'u uygulamada sabitlemek trigger'ın kararını ezer** (29 Tem 2026, `ILAN_VER_ANALIZ` V3 — ✅ W0'da giderildi). `ilanKaydet` INSERT'te `moderation_status: 'auto_published'` yazıyordu; `audit_listing_fn` yalnızca `score >= reject_min` (71) dalında bu alana dokunuyor. Sonuç: 31–70 puanlık **orta bant fiilen yoktu** — şüpheli ilan doğrudan yayına giriyordu. **Yerleşen kalıp:** INSERT `.select('id, audit_score, moderation_status, is_shadow_banned')` ile geri okunur, sonra `getAuditThresholds()` eşikleriyle **tek bir yerde** karar verilir; `>= rejectScoreMin` veya `is_shadow_banned` ise trigger'ın kararına DOKUNULMAZ (sadece kullanıcıya dürüst mesaj), `>= autoPublishScoreMax` ise `pending`+`passive`, altındaysa yayında. `/api/ilan/duzelt` ve `ilanKaydet` bu mantığı **birebir aynı** yazar — ikisi ayrışırsa aynı skor iki farklı sonuç verir. Ek olarak, trigger sessizce `is_shadow_banned` yapabildiği için **başarı ekranı INSERT sonucunu okumadan "yayında" diyemez**.
- 🚨 **Server action `throw` etmez, ayrık birlik (discriminated union) döndürür** (29 Tem 2026, `ILAN_VER_ANALIZ` V1/V4). `throw new Error(error.message)` ham Postgres mesajını (kolon adları, kısıt adları) istemciye sızdırır ve istemci onu ayırt edemez — doğrulama hatası mı, DB çöktü mü? **Kalıp:** `type Sonuc = {ok:true, …} | {ok:false, hata:string}`. Doğrulama hataları kullanıcıya olduğu gibi gösterilir, DB hataları `structuredLog('ERROR', …)`'a yazılıp kullanıcıya jenerik mesaj döner. Dönen tip **istemciyle paylaşılan tek `type`**'tır (`import { type IlanDurumu }`), böylece ekranın gösterdiği durumlar ile sunucunun ürettiği durumlar derleme zamanında eşleşir.
- 🚨 **Kimlik doğrulanmış kullanıcının kendi verisi bile istemciden gelmez** (29 Tem 2026, `ILAN_VER_ANALIZ` V2). `contact_phone` forma yazılıp olduğu gibi kaydediliyordu; devtools ile rakibin numarasını kendi ilanına yazmak mümkündü. **Kural:** kullanıcıya ait doğrulanmış alanlar (telefon, e-posta, ünvan, `user_id`) **her zaman** oturumdan/profil satırından okunur. İstemci farklı bir değer yollarsa sessizce ezilir ama `WARN` loglanır (son 4 hane ile — tam numara loga yazılmaz). Profil alanı boşsa doğrulanmış istemci değeri kabul edilip **profile geri yazılır**, böylece dal kendini onarır ve Google ile kaydolmuş telefonsuz kullanıcı kilitlenmez.
- ✅ **İstemci↔route sözleşmesi tek bir `type`'ta tanımlanmalı** (29 Tem 2026, `ILAN_VER_ANALIZ` B1 — **çözüldü**). `TopluYukle.tsx` JSON `{action, rows, userId}` yolluyordu, `/api/excel-import` yalnızca `formData().get('file')` okuyordu; üstelik istemci şablonu `'Kalkış İli'`, route `'Kalkış Şehri'` bekliyordu. Özellik **aylarca hiç çalışmadı** ve TypeScript yakalayamadı çünkü `fetch` gövdesi `any`. **Kural:** `fetch` ile konuşan her istemci↔route çifti sözleşmesini TEK dosyada tanımlar (`lib/toplu-yukle-sozlesme.ts`), iki taraf da BURADAN import eder, istemci gövdeyi `satisfies` ile mühürler, yanıtı ayrık birlik olarak daraltır. ⚠️ Ayrıca `userId` **asla istemciden alınmaz**, oturumdan okunur — sözleşmede o alan hiç bulunmaz.
- 🚨 **Ayrıcalıklı yazma yolu ÇOĞALTILMAZ** (29 Tem 2026, `ILAN_VER_ANALIZ` W0/W1). W0'da `app/ilan-ver/actions.ts` sertleştirildi; `/api/excel-import` ise kendi `listings` INSERT'ini yazdığı için V1 (beyaz liste) ve V3 (moderasyon bandı) delikleri orada **açık kaldı** — `moderation_status: 'auto_published'` sabitleniyor, `vehicle_type` doğrulanmadan diziye konuyordu. Bir güvenlik düzeltmesi, aynı tabloya yazan öteki yolu kapsamıyorsa düzeltme değildir. **Kural:** tablo başına tek yazma modülü (`lib/ilan-yaz.ts`), yeni kanal INSERT kopyalamaz, o fonksiyonu çağırır.
- 🚨 **İki ayrı PostgREST isteği transaction DEĞİLDİR** (29 Tem 2026, `ILAN_VER_ANALIZ` V5). Ana kayıt + bağımlı satırlar iki `insert()` çağrısıyla yazılırsa ikincisi patladığında birincisi **kalıcı olur** — `listings`'te duraksız ilan, ana sayfada hiç görünmeyen ama moderatör kuyruğunda duran hayalet kayıt. Telafi edici `delete` yeterli değil: o istek de patlayabilir ve tam o anda yetim kayıt kalıcılaşır. **Kural:** birbirine bağımlı çok tablolu yazma tek `plpgsql` fonksiyonuna alınır (`public.ilan_olustur`), `security invoker` + EXECUTE yalnız `service_role`. ⚠️ `security definer` seçme — service-role zaten yetkili, `definer` yalnızca ayrıcalık yükseltme yüzeyi ekler.
- ⚠️ **`jsonb` parametreli RPC, ayrışmayı DERLEME ZAMANINDA GİZLER** (29 Tem 2026, V5/B3). `svc.rpc('ilan_olustur', { p_listing: {...} })` gövdesi TypeScript için serbest bir nesne; fonksiyon gövdesinde okunmayan bir alan hata vermez, **sessizce yok sayılır** (kolon NULL kalır). Kolon eklerken SQL fonksiyonu ile `lib/ilan-yaz.ts`'teki nesne **birlikte** güncellenmeli; duman testi kolonun gerçekten dolduğunu `select` ile doğrulamalı.
- 🚨 **`Number("5.000")` JavaScript'te **5**'tir — Excel'den gelen TÜRKÇE sayı sessizce bozulur** (29 Tem 2026, W1 denetimi). Fiyat hücresine `5.000` yazan kullanıcının ilanı **5 TL**'ye kaydoluyordu: hata yok, uyarı yok, sadece yanlış veri. `"2,5"` ise `NaN` verip tonajı büsbütün düşürüyordu. **Kural:** Excel/kullanıcı metninden gelen her sayı `sayiMetniCoz()`'den (`lib/toplu-yukle-sozlesme.ts`) geçer — virgül varsa ondalık, noktalar `1.234.567` kalıbındaysa binlik. Dönüşüm **önizlemede** uygulanmalı ki kullanıcı kaydedilecek değeri görsün.
- ⚠️ **`(x->>'alan')::int` ondalık metinde `22P02` atar ve TÜM transaction'ı geri alır** (29 Tem 2026, W1 denetimi). `sayiAralik()` ondalığa izin verdiği için Excel'den gelen `2.5` palet değeri RPC'de `::int`'e çarpıyor, ilan **ve** duraklar birlikte geri dönüyor, kullanıcı yalnızca "İlan kaydedilemedi" görüyor. **Kural:** RPC'de `::int`'e giden her alan TypeScript tarafında `tamSayiAralik()` ile yuvarlanır (`lib/ilan-yaz.ts`). Tip daralması SQL'de değil, gönderen tarafta yapılır.
- **`useSearchParams` Suspense sınırı olmayan sayfada TÜM AĞACI CSR bailout'a sokar** (29 Tem 2026, `SPRINT_01` L2). Yalnız ilk yüklemede okunacak bir query param için `useEffect` içinde `new URLSearchParams(window.location.search)` yeterli ve maliyetsiz. Ayrıca URL'den gelen değer state'e **beyaz listeden geçmeden** yazılmamalı.
- 🚨 **`/giris` ADRESİNİ ELLE YAZMA — `girisAdresi()` ÇAĞIR** (29 Tem 2026). `proxy.girisYonlendir()` yalnız `KORUNMALI` 5 rota için (`/panel`, `/ilan-ver`, `/araclarim`, `/profil`, `/moderator`) hedef ekliyordu. Geri kalan ~10 giriş bağlantısı — header, footer, "Üye Ol", `/hakkimizda`, `/nasil-calisir`, `/u/[username]` — **çıplak `/giris`** idi ve kullanıcıyı giriş sonrası ana sayfaya bırakıyordu. Bir kullanıcı ilanlarını `/u/<id>` ile paylaştığında bu, bağlantıyı komple boşa çıkarıyor: gelen kişi giriş yapıyor ve paylaşılan sayfayı bir daha bulamıyor. **Kural:** giriş bağlantısı kuran her yer `lib/redirect.ts → girisAdresi(yol, mod?)` çağırır; JSX'te `app/_components/GirisLink.tsx` kullanılır (hedefi `usePathname()` ile kendisi koyar). Elle `?redirect=` yazmak `encodeURIComponent` + `guvenliRedirect` adımlarını unutmaya davetiye — unutulunca **hata vermez, sadece ana sayfaya düşer**.
  > ⚠️ `GirisLink` bilinçli olarak `useSearchParams()` KULLANMAZ: o hook sayfayı Suspense sınırına mecbur eder ve statik render'ı bozar. Filtre parametreleri korunmaz; kullanıcı doğru **sayfaya** döner, filtresini yeniden seçer.
- 🚨 **Query param Google/e-posta doğrulama zincirinde ÖLÜR — cookie'ye de yaz** (29 Tem 2026). `signInWithOAuth` yalnız `/auth/callback`e döner, callback de hedefi **sadece `yk_redirect` cookie'sinden** okur. `/giris?redirect=…` bağlantıyla gelindiğinde (proxy'ye uğramadan) cookie'yi kimse yazmıyordu → telefon/e-posta ile girenler doğru yere giderken **Google ile girenler ana sayfaya düşüyordu**. Aynı sayfada iki farklı davranış, hiçbir hata mesajı yok. `app/giris/page.tsx` artık `?redirect=`'i mount'ta cookie'ye kopyalıyor (`redirectCookieYaz`, `guvenliRedirect` süzgecinden geçerek, `samesite=lax`).
- **Giriş duvarına yönlendirirken `?redirect=` HER ZAMAN doldurulmalı** (29 Tem 2026, `SPRINT_01` L2/L3). Düz `/giris`'e atmak kullanıcıyı giriş sonrası ana sayfaya düşürür; akan ilan listesinde baktığı ilanı bir daha bulamaz. `lib/redirect.ts`'teki `guvenliRedirect` query string'i korur, o yüzden `/ilan-ver?tip=arac` gibi hedefler de güvenle taşınabilir.
- 🚨 **Yönlendirme hedefini `guvenliRedirect`'siz kullanma — TEK bir dal bile yeter** (29 Tem 2026). `app/profil-tamamla/page.tsx` hedefi iki yerde okuyor; biri süzgeçten geçiyordu, "profil zaten tamam" dalı ise `router.push(redirect || '/panel')` ile **ham** kullanıyordu. `/profil-tamamla?redirect=https://kotu.site` açık yönlendirme demekti. Bir dosyada birden çok yönlendirme dalı varsa **hepsi** aynı süzgeçten geçmeli.
- 🚨 **"X yoksa Y'ye git" bağlantısı — Y'nin o kullanıcıyı GERİ ÇEVİRMEDİĞİNİ doğrula** (31 Tem 2026). `/ilan-ver` telefonu olmayan kullanıcıya "Profilden ekleyin → `/profil-tamamla`" diyordu; ama `profil-tamamla/page.tsx:120` `user_type` doluysa formu **hiç render etmeden** `/panel`'e geri atıyor. Üstelik `/ilan-ver` formunda **telefon input'u yok** (kart sadece `users.phone`'u gösteriyor), yani kullanıcı ne numarasını ekleyebiliyor ne ilan verebiliyordu — **tek bir hata mesajı bile çıkmadan**. Numarayı ekleyen tek ekran (panel Profilim sekmesi, SMS OTP) ise yalnız local state'le açılıyordu, dışarıdan hedeflenemiyordu. Düzeltme: `PanelClient.tsx`'e beyaz listeli `?sekme=ilanlarim|araclarim|profilim` derin bağlantısı, `/ilan-ver` bağlantısı `/panel?sekme=profilim`. Genel kural: **bir "buraya git" bağlantısının hedefi koşullu yönlendirme yapıyorsa, bağlantıyı yazan koşulun hedefteki koşulla çeliştiğini varsay ve kontrol et.** Yan not: `lib/ilan-yaz.ts::ilanTelefonu()`'nun istemciden gelen numarayı kabul edip profile geri yazan **kendi kendini onaran dalı bu kanalda ölüydü** — form ona hiç değer göndermiyor; "kod var" ≠ "kod çalışıyor".
- 🚨 **`'use server'` DOSYASINDAN TİP RE-EXPORT ETME — `tsc` bunu yakalamaz** (31 Tem 2026, canlı arıza). `app/ilan-ver/actions.ts` `export type { IlanDurumu };` ile `lib/ilan-yaz.ts`'ten gelen bir tipi yeniden dışa veriyordu. Next, `'use server'` modülünün **her export'unu** çalışma zamanı değeri (async fonksiyon) sayıyor; Turbopack üretim derlemesinde bu re-export silinmeyip değer bağlaması olarak kaldı ve modül değerlendirmesinde `ReferenceError: IlanDurumu is not defined` ile patladı. **Etkisi orantısızdı:** modül yüklenemediği için `/ilan-ver`'in TÜM server action'ları öldü, ama ekranda görünen tek iz `init().catch()`'ten gelen "⚠️ Telefon numarası alınamadı" oldu — telefonla hiç ilgisi olmayan arıza telefon arızası gibi göründü, aranan `phone-privacy` log satırı hiç yazılmadı (fonksiyon gövdesine girilmedi). **Kural dar:** yerel tanımlı tip export'u sorunsuz (`TelefonDurumu`, `ProfilGirdi`, `PanelSonuc`, `ModSonuc` aylardır canlıda); patlayan tek biçim içe aktarılan bağlamayı dışa veren `export type { X }`. Tüketici tipi kaynağından alsın. **İki ders:** (1) `tsc --noEmit` bu sınıfı YAKALAMAZ — tip silinmesi TS semantiğinde doğru, kıran şey bundler'ın `'use server'` dönüşümü; doğrulama listesine tsc'yi tek başına yazma. (2) Belirti bir `catch`'ten geliyorsa önce **catch'in ne yakaladığını** sor — hata mesajının gösterdiği yer ile olduğu yer alakasız olabilir.
- ⚠️ **GA'ya kişisel veri gönderme** (`lib/analiz.ts`). Telefon, e-posta, TCKN/VKN, tam ad → GA'ya **gitmez**. Yalnız kategorik/sayısal alanlar (`tip: 'yuk' | 'arac'` gibi). KVKK gereği: GA verisi yurt dışına çıkar.
- 🚨 **BÜYÜK HARF KONTROLÜNDE `/[A-Z]/` KULLANMA — Türkçe'de yanlış** (29 Tem 2026, `SPRINT_01` R2). "Şifre123" ve "Ölçü1234" tamamen geçerli parolalar ama `[A-Z]` bunları "büyük harf yok" diye reddeder; kullanıcı ne yaptığını anlamadan kayıt olamaz. Doğrusu `\p{Lu}` + `/u` bayrağı (Ç, Ğ, İ, Ö, Ş, Ü dahil). Aynı tuzak küçük harf (`\p{Ll}`) ve harf (`\p{L}`) kontrolleri için de geçerli. tsconfig `target: ES2017` bunu destekliyor. Şifre kuralları **tek kaynak**: `lib/sifre.ts`.
- ⚠️ **İstemci şifre doğrulaması güvenlik değil UX'tir.** Gerçek zorunluluk Supabase Dashboard → Authentication → Policies → Password Requirements'ta ayarlanır. `lib/sifre.ts` yalnız kullanıcıya ne beklendiğini gösterir. Ayrıca **mevcut kullanıcıların girişine yeni kural uygulanmaz** — eski zayıf parolalılar kilitlenmesin (`epostaGiris` bilinçli olarak kapıya bağlı değil).
- 🚨 **`pushState` TEK BAŞINA BOZUKTUR — `popstate` dinleyicisi zorunludur** (29 Tem 2026, `SPRINT_01` L5). URL'i elle değiştiren her yer geri/ileri tuşunu da dinlemeli; yoksa geri tuşu URL'i değiştirir ama React state'i eski kalır ve ekranla adres çubuğu çelişir. Ayrıca: istemci tarafı bir filtre için **`router.push` değil `history.pushState`** (`router.push` RSC payload'ı çeker, ISR sayfasını yeniden ister); varsayılan değer için parametre **silinmeli** (aynı liste için iki URL = yinelenen içerik); **geçersiz parametre `replaceState` ile temizlenmeli**, yoksa kullanıcı çalışmayan bir filtre uyguladığını sanıp o linki paylaşır.
- 🚨 **Tip/mod değiştiren butonlar, açık input'u ÖNCE blur eder** (29 Tem 2026, `SPRINT_01` K3). Sıra: mousedown → blur → click. `onBlur`'da asenkron kontrol yapan bir alan varsa, istek uçarken form temizlenir ve dönen sonuç **temizlenmiş state'in üzerine** yazar. `profil-tamamla`'da bu, "Kaydet" butonunu kalıcı pasif bırakıyor ve **uyarı metni de görünmüyordu** (ilgili blok yeni tipte gizli) — sebebi görünmeyen sessiz çıkmaz. Çözüm: epoch/abort sayacı (`tipEpoch` ref); uçuştaki istek dönüşte epoch'u doğrulamazsa sonucunu yazmaz. Spinner yine de kapatılmalı.
- 🚨 **Görünmeyen form alanı MUTLAKA temizlenmeli** (29 Tem 2026, `SPRINT_01` K3). `handleSubmit` alanı `x || undefined` ile gönderiyor ve `profil-tamamla/actions.ts` `company_name`'i **kullanıcı tipinden bağımsız** yazıyor — yani ekranda olmayan veri sessizce kaydediliyor. `ALAN_GORUNUR` haritası ile JSX koşulları **birbirinin aynası**; biri değişirse diğeri de değişmeli.
- ⚠️ **Aynı sekmeye/moda tekrar tıklamak hiçbir şeyi sıfırlamamalı** (29 Tem 2026, `SPRINT_01` F1). Koşulsuz `setMod('giris')` yüzünden `?mod=kayit` ile gelen kullanıcı, zaten aktif olan sekmeye tekrar tıklayınca sessizce giriş formuna düşüyordu. Ayrıca URL param'ı ile mod kurarken **render koşulunun tamamını** kur: kayıt formu `sekme === 'eposta' && mod === 'kayit'` istiyor; yalnız `mod`'u kurmak sessiz bir no-op'tur.
- ⚠️ **Liste sayacı, LİSTEYİ saymalı** (29 Tem 2026, `SPRINT_01` L4). `count: 'exact'` toplamı platform genelini verir (tüm sekmeler, kırpma öncesi); altındaki liste ise tek sekmenin ilk `ILAN_LIMITI` kaydı. Ekranda "519 ilan" yazıp 40 kart göstermek kullanıcıya sayfa bozuk hissi verir. Kırpma varsa **"en yeni" ön eki filtreden bağımsız** yazılmalı. Limit tek yerden: `lib/ilan-liste.ts`.
- 🚨 **İSTEMCİDE FİLTRELEME, KIRPILMIŞ PENCEREDE YALAN SÖYLER** (31 Tem 2026, Dalga 3). L4'ün yukarıdaki maddesi *sayacı* düzeltti ama filtrenin kendisi 200'lük pencerenin içinde kalmıştı. Pencere `created_at`e göre kesiliyor, **ile göre değil**: Muş'ta aktif ilan olsa bile son 200 ilan İstanbul/Ankara/Bursa'dan geliyorsa kullanıcı "Muş" seçince **boş liste** görüyordu — hata yok, uyarı yok. Genel kural: **daraltıcı bir filtre, verinin kırpıldığı yerde uygulanmalı — kırpmadan sonra değil.** Ana sayfa il filtresi artık `/api/listings/ara`'da, `province_id` tamsayı eşitliğiyle sunucuda; limit o ilin **kendi** sonucuna uygulanıyor. Araç/kasa tipi bilinçli olarak istemcide kaldı (il seçildikten sonraki daraltma + `vehicle_type` boşsa `cargo_type`'a düşen türetme SQL'e taşınırsa iki ayrı tanım olur).
- 🚨 **AYNI LLM PROMPT'U İKİ DOSYADA KOPYALI — `/api/parse-text` ve `/api/whatsapp`** (31 Tem 2026, Dalga 4). Twilio webhook'u `parseWithLLM()` ile kendi kopyasını taşıyor. Birini güncelleyip diğerini bırakmak **hiçbir yerde hata vermez**; fark yalnız veri kalitesinde (`province_id` NULL sayısı) görünür. İki dosyanın başında karşılıklı uyarı var — coğrafi kuralları **birlikte** değiştir.
- 🚨 **LLM'e "il" dedirtmek yetmez, "ilçe yazma" demek gerekir** (31 Tem 2026, Dalga 4). Prompt "Türkiye ili, doğru Türkçe yazımla" diyordu; asıl kayıp yazım hatasından DEĞİL (`ilCiftYazim` "istanbul"/"İSTANBUL"/"Istanbul" hepsini katlar), modelin **il alanına ilçe adı koymasından** geliyordu: "Çorlu'dan Gebze'ye" → `origin_city:"Çorlu"` → `ilCiftYazim` null. `/api/parse-text`'te alan boş kalır, kullanıcı formda düzeltir. **`/api/whatsapp`'ta form yok** — `ilanYaz()` "Kalkış ili tanınamadı" der ve **ilan hiç oluşmaz**; kullanıcı düzeltemez. Aynı LLM çıktısının maliyeti kanala göre değişir: **formsuz kanalda prompt kuralı daha katı yazılmalı.** Çözüm modelin zaten bildiği ilçe→il eşlemesini kullanmak ("`Çorlu` → `city:Tekirdağ`, `district:Çorlu`"); 81 satırlık plaka tablosunu prompt'a koymak DEĞİL.
- 🚨 **Auth hata dallarında Türkçe METNE göre dallanma** (29 Tem 2026, `SPRINT_01` A5). Metin değişince dal sessizce ölür. Sunucu makine okunur `kod` dönmeli (`eposta_dogrulanmamis` | `kimlik_hatali`), istemci ona baksın. Hesap sayımı endişesi yok: GoTrue password grant'ta şifre, `Email not confirmed` kontrolünden **önce** doğrulanıyor.
- 🚨 **`resend()` / `signUp()` çağrısında `emailRedirectTo` VERİLMEZSE** Supabase kendi "Site URL" ayarına düşer; kullanıcı `/auth/callback` yerine ana sayfaya çıkar, oturum takası **hiç yapılmaz** ve "linke tıkladım ama giremiyorum" der (29 Tem 2026, `SPRINT_01` A6). Değer `NEXT_PUBLIC_SITE_URL`'den gelmeli — **`request.url` kullanma**, Vercel'de proxy arkasındaki iç adres olabilir.
- ⚠️ **E-posta gönderen uç noktalar hesap sayımına (enumeration) kapalı olmalı** (29 Tem 2026, `SPRINT_01` A6). `/api/auth/dogrulama-tekrar` adres kayıtlı olsun olmasın **aynı yanıtı** döner; sebep yalnız loga yazılır. Kotalar hata yolunda da işlenir — buradaki "hata"ların çoğu "böyle adres yok / zaten doğrulanmış", yani saldırganın aradığı bilgi; saymazsak o yol bedava olur. (`otp/route.ts`'ten bilinçli ayrılık: orada hata = sağlayıcı arızası, sayaç işlenmeden 502 döner.)

---

## 10. KULLANICI AKIŞLARI

| Ekran | Rota | Durum |
|---|---|---|
| Landing (3 senaryo) | `/` | ✅ |
| Nasıl Çalışır | `/nasil-calisir` | ✅ |
| Hakkımızda | `/hakkimizda` | ✅ |
| KVKK | `/kvkk` | ✅ |
| Kullanım Koşulları | `/kullanim-kosullari` | ✅ |
| Kayıt | `/giris` → `/profil-tamamla` | ✅ |
| Giriş | `/giris` | ✅ |
| Yol Rehberi (POI) | `/yol-rehberi` | ✅ |
| Panel | `/panel` | ✅ |
| İlan detay | `/ilan/[id]` | ✅ kısmi |
| Tekil ilan formu | `/ilan-ver` | ✅ |
| Metinden ilan (LLM) | `/ilan-ver` (yöntem=metin) | ✅ |
| Toplu yükleme | `/ilan-ver` | ✅ çalışıyor (29 Tem 2026, `ILAN_VER_ANALIZ` B1 — ortak sözleşme `lib/toplu-yukle-sozlesme.ts`, kayıt `ilanYaz()` üzerinden) |
| Atanan işlerim | `/panel/is/[id]` | 🔮 Faz 2 |
| Puanlama | modal | 🔮 Faz 2 |
| Profil / Araçlarım | `/panel` tab | ✅ kısmi |

---

## 13. AI-READINESS (SEO)

| Adım | Dosya | Açıklama |
|---|---|---|
| 1 | `app/ilan/[id]/page.tsx` | `generateMetadata` — dinamik title/description/OG |
| 2 | `app/ilan/[id]/page.tsx` | JSON-LD `<script type="application/ld+json">` — Schema.org/Service |
| 3 | `app/ilan/[id]/page.tsx` | Semantik `<article>`, `<ol>` durak listesi, `data-ai-label` |
| 4 | `public/robots.txt` | 4 blok, birebir aynı disallow listeleri + Sitemap path (S4) |
| 5 | `app/api/ilanlar/[id]/route.ts` | Public JSON API (hassas veri yok, 5dk cache) |
| 6 | `app/ilan/[id]/page.tsx` | `audit_score` → metadata + `data-quality-score` + görsel rozet |
| 7 | `app/layout.tsx` | `metadataBase` + OG + Twitter card (S1). ⚠️ `alternates` **BİLEREK YOK** — bkz. #33 |
| 8 | `app/opengraph-image.jpg` (+ `.alt.txt`) | 1200×630 paylaşım kartı, statik görsel (S1) |
| 9 | `app/{giris,moderator-giris,profil-tamamla,auth}/layout.tsx` | Auth yüzeylerinde `noindex` (S2) |
| 10 | `app/page.tsx` | Ana sayfanın canonical'ı — kökten buraya taşındı (#33, 7 Ağu 2026) |
| 11 | `app/{admin,moderator,araclarim,ilan/[id]/sahiplen}/layout.tsx` + `app/panel/page.tsx` | Yönetim yüzeylerinde `noindex` (#33) |
| 12 | `app/{ilan-ver,nasil-calisir,u/[username]}/layout.tsx` | `'use client'` sayfalarına canonical taşıyıcı kardeş layout (#33) |
| 13 | `scripts/test-seo-canonical.mts` | `npm run test:seo` — 72 kontrol, metadata bekçisi (#33) |

**Sitemap**: `app/sitemap.ts` ✅ — statik sayfalar (`/yol-rehberi` dahil) + aktif/onaylı ilanlar
(5000 limit) + **yayında ilanı olan kullanıcıların profilleri** (`/u/{id}`, aynı sorgudan türetilir).

**Site adresi tek kaynak:** `NEXT_PUBLIC_SITE_URL`, fallback `https://yukegel.com`.
`app/layout.tsx` ve `app/sitemap.ts` **aynı** değişkeni + **aynı** fallback'i kullanır; ayrışırlarsa
canonical ile sitemap farklı alan adı gösterir ve Google ikisini ayrı site sanar.

🚨 **BURADA YANLIŞ BİR CÜMLE VARDI — 7 Ağu 2026'da düzeltildi (#33).** Eski metin
*"Next canonical'ı alt sayfalara miras bırakmaz"* diyordu. **TERSİ DOĞRU.** Next 16'nın
birleştiricisi okundu (`node_modules/next/dist/lib/metadata/resolve-metadata.js:166`):
üst katmanın **çözülmüş** metadata'sı `structuredClone` ile klonlanıp başlangıç alınıyor,
sonra YALNIZCA çocuğun kendi nesnesinde bulunan anahtarlar eziliyor. Yani `alternates`
vermeyen her sayfa üsttekini **aynen devralır**.

Bu yanlış cümlenin bedeli: kök `app/layout.tsx` `canonical: '/'` taşıdığı sürece
`/kvkk`, `/nasil-calisir`, `/kullanim-kosullari`, `/yol-rehberi`, `/u/{id}` hepsi
`<link rel="canonical" href="https://yukegel.com/">` yayınlıyordu — Google için
"ana sayfanın kopyası", yani indeksten düşme. Sitemap'e koymak bunu kurtarmaz.

**Kural (artık `npm run test:seo` ile kilitli):** her rota ya kendi canonical'ını
yazar ya `noindex` olur. Kök layout canonical TAŞIMAZ; kökten çekilince varsayılan
"canonical yok" olur ve Google sayfayı kendi URL'ine self-canonical sayar — yanlış
cevap yerine güvenli sessizlik.

📌 **canonical GÖRELİ yazılır.** Mutlak alan adı `metadataBase`i devre dışı bırakır;
staging/preview ortamı canlı alan adını canonical ilan edip kendi sayfalarını gömer.
(`app/hakkimizda/page.tsx` tam bunu yapıyordu, düzeltildi.)

📌 **`robots.txt` `Disallow` ≠ `noindex`.** (1) Yalnızca o kuralı okuyan crawler'ı bağlar.
(2) *Taramayı* engeller, *indekslemeyi* değil — dış bağlantı varsa Google URL'i taramadan
da indeksleyebilir. Ayrıca `Disallow: /panel/` yalnızca ALT yolları kapatıyordu,
çıplak `/panel` kapsam dışıydı.

⏭️ **Açık:** `/ilan/[id]` için dinamik OG görseli yok (kök karta düşüyor).
canonical'ı ise VAR (`SITE_URL` üzerinden kurulu) — eski "vermiyor" notu bayattı.

---

## 14. GÖREV DURUMU

### ✅ Tamamlanan
- **SPRINT_01 W5 — Alias veri bütünlüğü (kod tarafı)** (29 Temmuz 2026). Devir notu: `docs/W5_DEVIR.md`.
  - **D1 — `learn-aliases` prompt'u.** Altı bozuk JSON örneği doğru Türkçe yazıma çevrildi (`"Eskişehir"`, `"İzmit"`, `"İstanbul"`, `"İkitelli"`, `"Tekirdağ"`, `"Çorlu"`), prompt'un başına "EN ÖNEMLİ KURAL — TÜRKÇE YAZIM" bloğu eklendi ve **"mevcut alias listesindeki ASCII kayıtları örnek alma"** uyarısı yazıldı (liste bağlam olarak veriliyor, yoksa bozulma kendini besliyordu).
  - **D2 — dört yazma noktası kapatıldı.** Yeni `lib/alias-normalize.ts`: `aliasKey()` (katlama), `trTemizle()`, `normalizeAliasFields()`, `aliasSatirlariniYukle()` (sayfalı, bayrak filtresi YOK), `aliasCakismaBul()` → **409 + çoğunluk yazımı önerisi**, `baskinYazimaHizala()` (yalnız AI keşif yolu; değişenler yanıtta `hizalanan_yazimlar` olarak raporlanır). Manuel `create`, AI keşif, PATCH `approve` ve PATCH alan güncelleme yollarının dördü de normalize+kontrol ediyor. 5b kopya kontrolü ham `in('alias',…)` yerine katlanmış anahtar setiyle çalışıyor.
  - **D4 — `parse-listing/findPlaces` karşılaştırma anahtarları katlandı.** `yerKey`/`ayniSehir`/`ayniIlce`/`laneKey` eklendi; `seen` (bigram+unigram), `sameCity` koruması, Pass 2 hedef bulucu + `blockSeen`, Pass 2/3 `isDiff`, fallback ve son lane dedup — hepsi katlanmış anahtar kullanıyor, **saklanan değer ham kalıyor**. Kabul testi: yeni kod **5/5**, HEAD aynı testlerde **3/5 başarısız** (HEAD `hits=["Istanbul","İstanbul"]` ve sahte `Istanbul->İstanbul` lane'i üretiyor).
  - **D5 — `docs/20260729_alias_runbook.md`.** İki hazır temizlik script'inin (`20260728_alias_homonim_temizligi.sql` / `20260728_alias_kopya_temizligi.sql`) çalıştırma sırası hiçbir yerde yazılı değildi ve **ters sıra sessizce zarar veriyor** (kopya BÖLÜM 3, BÖLÜM 2'nin düzelttiği değerleri kaynak alıyor). 11 adım, her adımın önizleme `SELECT`'i ve geri alması var, hiçbir adım satır silmiyor.
  - **D3 — `docs/20260729_alias_normalize_trigger.sql`.** `aliases_normalize_trg` (BEFORE INSERT/UPDATE OF alias,normalized,district) + `aliases_katlanmis_anahtar_uniq` **kısmi** UNIQUE indeks. Trigger `normalizeAliasFields`'in DB ikizi — ayrışırlarsa uygulama "temiz" der, DB başka değer yazar.
  - 🚨 **Devir notunda OLMAYAN bulgu:** `alias` UNIQUE'i ham string üzerinde olduğu için `Gebze`/`GEBZE`/`gebze` ayrı satırlar; hepsi tek katlanmış anahtara düşüyor ve temizlik script'i satır silmediği için D3 indeksi tam haliyle **hiç kurulamaz**. Çözüm: runbook Adım 9 (fazlalıkları `is_active=false`) + indeksin `WHERE is_active = true` ile kısmi olması.
  - 🚨 **BAYRAM'IN DÜZELTMESİ — ölçüm ve onarım yanlış tabloyu gösteriyordu** (29 Tem 2026). Runbook'un ilk Adım 0'ı `WHERE origin_city = destination_city` sorguluyordu; iki hata: (1) **varışlar `listings`'te değil, `listing_stops` satırlarında** — `listings.destination_city` **diye bir kolon yok** (🚫 31 Tem 2026 / #28 — buraya önce "ölü kolon" yazılmıştı; sorgu `42703: column "destination_city" does not exist` verdi, `information_schema.columns` teyit etti), canlı varış filtresi `HomeClient.tsx:696` → `listing_stops.city`; (2) **şehir içi taşıma meşrudur**, aynı şehir bir bozukluk sinyali değil. Doğru parmak izi: *katlanmış anahtar eşit, ham yazım farklı*. Adım 0 (0.1 sahte aday / 0.2 meşru şehir içi tabanı / 0.3 dört kolonda yazım dağılımı / ~~0.4 ölü kolon teyidi~~ → 0.4 SORU DÜŞTÜ) ve Adım 8 yeniden yazıldı.
  - 🚨 **Bu düzeltmenin ortaya çıkardığı ASIL boşluk:** `20260728_alias_kopya_temizligi.sql` **BÖLÜM 6 yetersiz** — yalnız `listings.origin_city` + var olmayan `destination_city`'yi onarıyor; `listing_stops.city`, `listing_stops.district` ve `listings.origin_district`'e hiç dokunmuyor. Yani eski haliyle temizlik tamamlansa bile **kullanıcıya görünen bozuk varışlar bozuk kalırdı** — üstelik (#28'den sonra bilindiği üzere) o `destination_city` UPDATE'i 42703 ile patlayacağı için bölüm **hiç tamamlanamazdı**. Runbook Adım 8 artık dört kolonu birlikte onarıyor ve elle `CASE` listesi yerine `aliases` tablosunu sözlük olarak kullanıyor (`HAVING count(DISTINCT …) = 1` ile belirsiz anahtarlar elle bırakılıyor). **BÖLÜM 6'yı olduğu gibi çalıştırma.**
  - ⏳ **SQL'lerin hiçbiri çalıştırılmadı** (Bayram'ın beyanı). Doğrulama: `tsc --noEmit` temiz; lint HEAD'e göre gerilemedi (`learn-aliases` 15→13 hata, `parse-listing` 1→1, `lib/alias-normalize.ts` 0).
- **SPRINT_01 W1 — Auth akış bütünlüğü** (28 Temmuz 2026). Ayrıntı ve kabul kriterleri: `docs/SPRINT_01.md`.
  - **A1 + A1b — auth denetim izi açıldı.** `app/api/auth/log/route.ts` (yeni) service-role ile `auth_events`'e yazıyor. Endpoint aylardır **yoktu**; `authLog()` çağrıları `.catch(()=>{})` içinde olduğu için 404 sessizce yutuluyordu. Artık `console.warn` bırakılıyor. ✅ `docs/20260728_auth_events.sql` çalıştırıldı (29 Tem 2026).
  - **A3 — `?hesap=tasindi` / `?hesap=eslesme` mesajları görünür oldu.** Mesaj `onAuthStateChange`'ten bağımsız basılıyor; proxy cookie'yi sildiği için `!user` dalında da çalışması gerekiyordu.
  - **A7 — `redirect` param'ı korunuyor.** `lib/redirect.ts` (yeni) `guvenliRedirect()`: yalnız `/` ile başlayan, `//` ve `\` içermeyen yollar → açık yönlendirme kapalı.
  - **K2 — `users` upsert'i server action'a taşındı.** `app/profil-tamamla/actions.ts` (yeni) + kolon beyaz listesi. `role`, `is_active`, `phone_verified`, `merged_into`, `trust_level` istemciden yazılamıyor.
  - **R1 — `/auth/reset` yeniden yazıldı.** Backlog'da yazandan daha kötü bir bulgu çıktı: tarayıcıda **normal** bir oturum açıkken `updateUser({password})` başarıyla çalışıyordu → açık kalmış oturuma erişen kişi eski şifreyi bilmeden şifreyi değiştirebiliyordu. Form artık yalnız gerçek `PASSWORD_RECOVERY` oturumunda; başarıdan sonra `signOut()`.
  - **C1 — `/cikis` GET kapatıldı**, POST + Origin kontrolü. Link prefetch / üçüncü taraf `<img src>` ile istemsiz çıkış vektörü kapandı.
  - **A4b — OTP cooldown SUNUCUDA.** `api/ilan/[id]/sahiplen` ilan başına 60 sn (429 + `Retry-After`); istemci sayacı yalnız görsel. Sayaç SMS gerçekten gittiyse başlıyor.
  - **L1e — `contact_phone`'un son istemci yazma yolu kapandı.** `app/panel/actions.ts` ve `app/moderator/actions.ts` (yeni); `IlanYonetim.tsx`'ten anon istemci tamamen kaldırıldı, `moderator/page.tsx`'in select/update/insert'lerinden kolon çıkarıldı. ✅ `docs/20260728_contact_phone_revoke.sql` çalıştırıldı (29 Tem 2026) — duman testi geçti.
  - **Keşif (backlog'da yoktu):** panel'in istemci `listings` update'i gövdeyi hiç filtrelemiyordu — kullanıcı kendi ilanına `trust_level: 'verified'` / `moderation_status: 'approved'` / `is_shadow_banned: false` yazabiliyordu. K2 ile aynı sınıf; beyaz listeyle kapandı.
  - **Ayrıca:** panel "Araç Bulundu" toggle'ının hatası sessizce yutuluyordu (buton çalışmış görünüp sayfa yenilenince geri dönüyordu) — artık kart üstünde gösteriliyor. Moderatör telefon kaydı başarısız olursa `alert` çıkıyor.
  - **Doğrulama:** `npx tsc --noEmit` temiz; değişen/yeni dosyalarda eslint 0 problem. `next build` bu ortamda tamamlanamadı (sandbox `.next` FUSE artefaktı + Google Fonts'a çıkış yok) — Bayram'ın makinesinde/CI'da doğrulanmalı.
- **Kayıtlı kullanıcı ayrı auth kimliğiyle gelince profil-tamamla'ya düşüyordu — proxy + giriş self-heal ile çözüldü** (22 Temmuz 2026): Doğrulanan vaka — Bayram'ın 2 auth kimliği vardı: `0d7ac38c…` (email bayramdede@gmail.com, `public.users` satırı burada, `broker`) ve `4c509880…` (phone 905380855996, satırı YOK). SMS ile girince oturum `4c50…` oluyor, proxy o `id` için satır bulamıyor ve `/profil-tamamla`'ya atıyordu. Giriş formundaki merge yalnızca formdan geçildiğinde çalışıyordu; doğrudan korumalı rotaya gidince kaçıyordu.
  - `proxy.ts`: select'e `merged_into` eklendi. (a) `merged_into` dolu → sb- cookie'leri temizle + `/giris?hesap=tasindi`. (b) `user_type` yok ama aynı e-posta/telefonla (`+905xx`/`905xx`/`05xx`/`5xx` dört format) `merged_into IS NULL` canlı hesap varsa → `/profil-tamamla` yerine `/giris?hesap=eslesme`.
  - `app/giris/page.tsx`: açılış kontrolü `supabase.auth.onAuthStateChange` **INITIAL_SESSION** olayına bağlı (getUser DEĞİL). Neden: magic-link `#access_token` hash'i istemci başlatılırken TÜKETİLİR; INITIAL_SESSION bundan sonra tetiklendiği için eski/merged cookie yerine hash'ten gelen GÜNCEL oturumu görürüz — aksi halde getUser hash işlenmeden eski merged oturumu okuyup `signOut` ediyor, kullanıcı giriş ekranında takılıyordu (RACE). Mantık: sağlıklı canlı oturum (`user_type` var, `merged_into` yok) → `yonlendir()`; ölü/eksik oturum → `signOut()` + bilgi mesajı. Formla giriş (SIGNED_IN) bu bloktan ETKİLENMEZ; onları otpGonder/epostaGiris yönetir.
  - **DÖNGÜ DÜZELTMESİ (22 Tem, sonraki tur):** İlk self-heal turunda kullanılan magic-link geçişi (switch-account/merge → `window.location.href`) SONSUZ YENİLENME yaratıyordu. Magic-link implicit flow (`#access_token`) yalnız browser localStorage'ı canlı hesaba geçirir; middleware'in okuduğu SSR `sb-` cookie ESKİ (merged) oturumda kalır → proxy tekrar `/giris?hesap=tasindi`'ye atar → mount tekrar switch-account çağırıp sayfayı yeniler. Çözüm magic-link bağımlılığını kaldırmak: ölü oturumun cookie'sini proxy siler, giriş sayfası oturumu tamamen kapatır (signOut), kullanıcı temiz yeniden girer.
  - `otpDogrula` telefon merge sorgusu artık 4 formatı da deniyor (önceden yalnız `05xx`/`5xx` — kayıt E.164 `+905xx` durduğunda eşleşmeyi kaçırıyordu).
  - Doğrulama: `npx tsc --noEmit` temiz. Sandbox Supabase'e ulaşamadığı için canlı test yapılmadı; düzeltme bir sonraki girişte self-heal ile devreye girer.
- **"users_email_key" duplicate key hatası — hesap birleştirme (merge) eksikleri giderildi** (22 Temmuz 2026): SMS ile giriş yapan, ama e-postası zaten başka (eski) bir hesapta kayıtlı olan kullanıcılar `/profil-tamamla`'ya düşüyor ve kaydet'e basınca `duplicate key value violates unique constraint "users_email_key"` hatası alıyordu.
  - Kök neden: `eskiProfil` (merge hedefi) aramaları sadece **telefon** (`app/giris/page.tsx`) ya da sadece **eposta** (`app/auth/callback/route.ts`, Google akışı) bazlıydı — hiçbiri diğerine bakmıyordu. Telefonla girip eposta çakışması olan bir hesap hiçbir merge kontrolüne takılmadan doğrudan profil-tamamla'ya gidip ham upsert hatasıyla karşılaşıyordu.
  - `app/giris/page.tsx` (`otpDogrula`): `eskiProfil` sorgusu artık telefon **VEYA** (varsa) `data.user.email` ile eşleşen kaydı da arıyor.
  - `app/auth/callback/route.ts`: eposta bazlı `eskiProfil`/merge kontrolü artık `!profil?.user_type` (profil-tamamla'ya gönderme) kontrolünden **önce** çalışıyor — önceden profili tamamlanmamış kullanıcılar için bu kontrol hiç çalışmıyordu.
  - Her iki sorguda da `.eq('is_active', true)` filtresi `.is('merged_into', null)` ile değiştirildi — `is_active` eski hesaplarda hiç set edilmemiş (NULL) olabiliyordu, `merged_into IS NULL` "bu hesap başka bir yere merge edilmemiş, gerçek/canlı bir hesap" anlamına daha doğru karşılık geliyor.
  - `app/profil-tamamla/page.tsx`: submit hatası artık `users_email_key` içeriyorsa "Bu e-posta adresiyle zaten bir hesabınız var. Lütfen giriş yapın." gösteriyor (ham Postgres mesajı yerine) — yukarıdaki iki düzeltmeyi atlayan olası edge-case'ler için güvenlik ağı.
  - Doğrulama: `npx tsc --noEmit` temiz. `npx eslint` — üç dosyada da hata sayısı 20 Temmuz commit'iyle birebir aynı (`giris/page.tsx` 6 hata/2 uyarı — `Logo` inline component; `auth/callback/route.ts` 1 hata — `as any`; `profil-tamamla/page.tsx` 7 hata/2 uyarı — `MevcutUyari`/`KontrolYukleniyor`), hepsi pre-existing, yeni hata yok.
- **SMS ile giriş → yanlış profil-tamamla yönlendirmesi düzeltildi** (22 Temmuz 2026): Profili tamam olan kullanıcılar OTP girişinden sonra hâlâ `/profil-tamamla`'ya düşüyordu; kök neden 3 katmanlıydı.
  - `app/giris/page.tsx` (`otpDogrula`): `mevcutProfil?.is_active && mevcutProfil?.user_type` kontrolü `is_active` NULL olduğunda (profil-tamamla upsert'i bu alanı hiç set etmiyordu) yanlışlıkla "pasif" sayıyordu → `is_active !== false && user_type` yapıldı (sadece açıkça `false` ise pasif say).
  - `proxy.ts`: `/profil-tamamla`'ya yönlendirirken orijinal hedef path artık `?redirect=` ile taşınıyor (önce sabit `/profil-tamamla` idi, kullanıcı tamamladıktan sonra hep `/panel`'e düşüyordu).
  - `app/profil-tamamla/page.tsx`: `useSearchParams` + `Suspense` eklendi (`redirect` param okunuyor); init `useEffect` artık `user_type` zaten doluysa formu hiç göstermeden `redirect || '/panel'`'e yönlendiriyor; `user_type` boşsa mevcut `display_name`/`phone`/`company_name`/`tckn`/`vkn` DB'den önceden dolduruluyor (tam boş form yerine sadece eksik alan isteniyor). Submit upsert'i artık `is_active: true` set ediyor; başarı sonrası `redirect || '/panel'`'e gidiyor.
  - Doğrulama: `npx tsc --noEmit` temiz. `npx eslint` — `MevcutUyari`/`KontrolYukleniyor` inline component tanımlarından kaynaklanan `react-hooks/static-components` hataları (7 hata/2 uyarı) 20 Temmuz commit'inde de aynı şekilde vardı (git ile doğrulandı) — bu değişiklikle gelmedi, pre-existing.
  - **Not (22 Temmuz, sonraki tur):** Bu turda "kasıtlı dokunulmadı" denen `eskiProfil` sorgusundaki `.eq('is_active', true)` filtresi bir sonraki bug fix'te (`users_email_key` duplicate key, yukarıda) `.is('merged_into', null)` ile değiştirildi — yukarıdaki not artık geçerli değil.
- **TCKN zorunluluğu kaldırıldı** (22 Temmuz 2026): `app/profil-tamamla/page.tsx` — TCKN alanı daha önce `arac_sahibi` (nakliyeci) tipi için zorunluydu; nakliyecileri kayıt sırasında ürküttüğü gözlemlendiği için tüm kullanıcı tiplerinde opsiyonel yapıldı.
  - `kimlikGecerli()`: `arac_sahibi` özel dalı kaldırıldı — artık sadece dolu girilmişse geçerlilik/tekillik kontrolü yapılıyor.
  - UI: TCKN etiketi her zaman "(opsiyonel)", `required` attribute'u kaldırıldı, "Kimlik bilgisi profil güvenilirliğinizi artırır" ipucu artık tüm kullanıcı tiplerinde (arac_sahibi dahil) boşken gösteriliyor.
  - VKN (şirket zorunlu) ve diğer alanlar değişmedi. `npx tsc --noEmit` temiz.
  - **Not:** İleride TCKN'yi tekrar zorunlu kılmak istenirse `kimlikGecerli()`'ye `arac_sahibi` dalı geri eklenir.
- **Landing page → Driver-Mate formatı** (10 Temmuz 2026): `app/_components/HomeClient.tsx` sürücü-merkezli hub yapısına güncellendi (`app/page.tsx` değişmedi).
  - Hero (`HeroKayitsiz`): başlık/CTA'lar sürücü odaklı yeniden yazıldı — birincil buton `🚛 Sürücüyüm, Hizmetleri Gör` (`#surucu-hizmetleri` anchor), ikincil `📦 Yük Vereceğim, İlan Ver` (`/ilan-ver`).
  - Yeni `SurucuHizmetleri` bileşeni (hero altında, ana odak): kartlık grid — Yük Bul (`#ilanlar` anchor), Lastikçi, Park Yeri, Yemek Yeri (üçü `/yol-rehberi`'ye link — kategori deep-link'i yok, POI sayfası `useSearchParams` desteklemiyor), Hamal (pasif/"YAKINDA" kart — POI şemasında karşılığı yok), Yol Rehberi (tümü).
  - Yeni `YukVerenBanner` bileşeni: yük sahiplerinin ilan verebilmesi vurgusu için ayrı CTA kartı (`/ilan-ver`), hub'ın hemen altında.
  - Canlı ilan feed'i (filtre barı + `IlanKart` listesi) korundu, ikinci plana alındı — `📋 Canlı Yük & Araç İlanları` başlığıyla `id="ilanlar"` anchor'ı eklendi.
  - Auth/listing fetch mantığı değişmedi (`HeroMusteri`/`HeroNakliyeci` login sonrası bannerları aynı, hub tüm kullanıcı tiplerinde görünür).
  - **2. tur (aynı gün) — kullanıcı geri bildirimi üzerine genişletme:** ilk 6 kategori örnek kabul edilip `POI_HIYERARSI`'deki tüm ana kategorilere göre 8 karta çıkarıldı: 📦 Yük Bul (`🔥 En çok aranan` rozetli), 🔄 Lastikçi, 🅿️ Park & Konaklama, 🍲 Yeme & Mola, ⛽ Akaryakıt & Şarj, 🏭 Kantar & Operasyon, 👷 Hamal (YAKINDA), 🗺️ Tüm Yol Rehberi.
    - Kart render mantığı ayrı `SurucuHizmetKarti` bileşenine çıkarıldı: 48px dairesel renkli ikon rozeti, hover'da `translateY(-3px)` + renkli glow `boxShadow`, opsiyonel `rozet` (badge pill) alanı.
    - Başlık metni "🚛 Yolda Yalnız Değilsin" / "Yükten lastiğe, duraktan sofraya — şoförün ihtiyacı olan her şey tek dokunuşta." olarak güncellendi; grid `minmax` 150px→160px, `gap` 12→14.
    - Doğrulama (2. tur): `npx tsc --noEmit` temiz; `npx eslint` aynı 20 hata/2 uyarı temel çizgisi (hepsi öncesinden var — `any`, unescaped entity, `<a>`/`<img>`, `set-state-in-effect`), yeni hata yok.
  - **3. tur (aynı gün) — "marka ajansı" UX/UI pasosu, `HeroKayitsiz` (kayıtsız kullanıcı hero'su):** metin korundu, görsel/etkileşim katmanı baştan tasarlandı.
    - İki kolonlu grid (`.hero-grid`, 860px altı tek kolona düşüyor, sağ görsel mobilde gizleniyor) + arka planda iki bulanık glow blob (yeşil/mavi, `filter:blur(90px)`).
    - Sol kolon: eyebrow rozetinin yanına canlı `📦 {totalCount} aktif ilan` çipi eklendi (gerçek veri — `HomeClient`'tan `totalCount` prop'u geçiliyor); başlıkta ikinci satır yeşil gradient metin (`backgroundClip:text`); CTA butonları `.hero-cta-primary/secondary` class'larıyla hover'da kalkıp glow veriyor; güven rozetleri (Anında İlan, Güvenli, Ücretsiz, WhatsApp) nokta ayraçlı tek satıra alındı.
    - Sağ kolon: `#surucu-hizmetleri`'ye link veren tıklanabilir "Bugün Yolda" rota kartı — `SURUCU_HIZMETLERI.slice(0,4)` (Yük Bul, Lastikçi, Park & Konaklama, Yeme & Mola) kesikli çizgiyle bağlı dikey rota olarak gösteriliyor; kart hover'da kenarlık/glow değişiyor.
    - Doğrulama (3. tur): `npx tsc --noEmit` temiz; `npx eslint` 21 problem (19 hata/2 uyarı) — önceki turdan 1 eksik, çünkü `&apos;` kullanımı eski unescaped-entity hatasını da giderdi; yeni hata yok.
  - **4. tur (aynı gün) — `/yol-rehberi` kategori deep-link'i (önceki turlarda "yok" olarak not edilen limitasyon giderildi):**
    - `app/yol-rehberi/page.tsx`: `YolRehberiClient` artık `<Suspense fallback={<div style={{height:'100dvh',background:'#0d1117'}}/>}>` içinde render ediliyor — `useSearchParams` kullanımı Next.js'te Suspense boundary zorunlu kılıyor.
    - `app/yol-rehberi/YolRehberiClient.tsx`: `useSearchParams()` ile `?anaKategori=` / `?altKategori=` okunuyor; `aktifAnaKat`/`aktifAltKatlar` state'lerinin `useState` initializer'ında `POI_HIYERARSI`'ye karşı doğrulanıyor (geçersiz/eksik param → sessizce `'hepsi'`e düşer, hata fırlatmaz).
    - `app/_components/HomeClient.tsx`: `SURUCU_HIZMETLERI` kart href'leri güncellendi — Park & Konaklama → `?anaKategori=park_konaklama`, Yeme & Mola → `?anaKategori=yeme_icme`, Akaryakıt & Şarj → `?anaKategori=akaryakit_enerji`, Kantar & Operasyon → `?anaKategori=operasyon` (hepsi ana kategori bazlı, ilgili tüm alt kategorileri kapsıyor). Yük Bul (`#ilanlar`) ve Tüm Yol Rehberi (`/yol-rehberi`, filtresiz) değişmedi.
    - Doğrulama (4. tur): `npx tsc --noEmit` temiz; `npx eslint` yeni hata yok (mevcut `YolRehberiClient.tsx`/`page.tsx` hataları öncesinden var — `any`, `set-state-in-effect`, `<a>`, `Date.now` purity).
  - **5. tur (aynı gün) — "Lastikçi" kartı çok spesifikti, genişletildi:** `🔄 Lastikçi` (`altKategori=lastikci` tekli filtre) → `🔧 Tamir & Bakım` (`?anaKategori=tamir_bakim`, ana kategori — Lastikçi, Motor & Mekanik, Elektrik & Takograf, Branda & Dorse, Yıkama & Yağlama, Acil Yol Yardım'ın tamamını kapsıyor). İkon/renk `POI_HIYERARSI`'deki `tamir_bakim` ana kategorisiyle eşleşecek şekilde 🔧 / `#dc2626` yapıldı. Hero'daki rota kartı (`SURUCU_HIZMETLERI.slice(0,4)`) otomatik güncellendi.
  - Doğrulama: `npx tsc --noEmit` temiz; `npx eslint` mevcut dosyadaki eski `any`/`<a>` uyarıları dışında yeni hata çıkarmadı. `next build` çalıştırılmadı (sandbox'ta canlı Supabase bağlantısı riskli) — deploy öncesi Bayram'ın lokalde/Vercel preview'da görsel kontrol etmesi önerilir.
  - **Not:** `/yol-rehberi` kategori query param desteklemiyor (`YolRehberiClient.tsx`'de `useSearchParams` yok) — istenirse Lastikçi/Park/Yemek kartları için ileride `?anaKategori=`/`?altKategori=` deep-link desteği eklenebilir (Suspense boundary gerektirir).
- **Yakınımdaki Yükler** (1 Temmuz 2026): `/yol-rehberi` haritasına 3. sekme ("📦 Yükler") eklendi — stealth büyüme stratejisine uygun, sürücü zaten haritayı açmışken arka planda yük keşfi.
  - `lib/il-koordinatlari.ts`: 81 il merkez koordinatı (`app/api/admin/poi-import/route.ts` içindeki tablonun kopyası) + `enYakinIl(lat,lng)` — GPS'ten offline haversine ile en yakın ili bulur (Geocoding API çağrısı YOK, ek maliyet yok).
  - `docs/20260701_nearby_listings_rpc.sql`: `get_nearby_listings_by_city(p_city, p_district, p_limit)` RPC — **gerçek şema** (`origin_city`/`origin_district`, varış `listing_stops`'un son durağından `DISTINCT ON` ile) ile yazıldı.
    - ⏳ **Dalga 3 (30 Tem 2026) bu fonksiyonun ADINI DEĞİŞTİRİYOR:** `get_nearby_listings_by_province(p_province_id, p_district, p_limit)` — `docs/20260730_dalga3_radar_province_id.sql` BÖLÜM 4. Ad değişti çünkü `_by_city` artık yalan olurdu. İlçe karşılaştırması `ILIKE` yerine `public.il_key()` (katlanmış eşitlik); güvenli çünkü `eslesme` bir **sıralama ipucu**, filtre değil. SQL çalıştırılana kadar yeni kod `PGRST202` alır.
    - ✅ **KOVA E TEMİZLENDİ (3 Ağu 2026, #37 — `docs/20260803_get_nearby_cte_temizligi.sql`, ÇALIŞTIRILDI).** Dalga 3 dönüş ifadesini doğru çevirmişti (`dest_city` artık `pd.name`'den geliyor) ama `son_durak` CTE'sinin SELECT listesinde ölü bir `city` kalmıştı. Dalga 5 / BÖLÜM 5 `listing_stops.city`'yi düşürdüğünde fonksiyon `42703` atacak, `route.ts`:44 → `YolRehberiClient.tsx` zinciri yani **GPS'e dayalı keşif akışının tamamı sessizce ölecekti**. 🚨 Bu bulguyu `.ts`/`.tsx` taraması ASLA gösteremezdi — bağımlılık yalnızca fonksiyon GÖVDESİNDE, yani Postgres'te. Ders: "kod temizliği" envanteri ikinci bir kod tabanını (DB fonksiyonları) unutmamalı. Doğrulama: gövdede metin kolonu kalmadı · dört GRANT (`anon`/`authenticated`/`postgres`/`service_role`) `create or replace` sayesinde korundu · çağrı `0/0` döndü ve bu **kontrol sorgusuyla** doğrulandı (34'te aktif+onaylı ilan sayısı da 0). ⏳ Kalan tek adım 2.4 duman testi (deploy sonrası `/yol-rehberi` → "Yakınımdaki Yükler").
  - **Not:** `docs/20260610_poi_module.sql` içindeki eski `get_nearby_listings_for_parked_driver` fonksiyonu `listings.dest_city`/`title`/`load_type` gibi olmayan kolonları referans alıyor — çağrılırsa hata verir, kullanılmıyor.
    - 🚨 **DÜZELTME (3 Ağu 2026, #40 katalog taraması):** bu fonksiyon **canlıda hiç YOK** — `pg_proc` taramasında çıkmadı. Yani "silinmedi, duruyor" ifadesi yanlıştı: o migration canlıya **hiç uygulanmamış**. Kendi başına risk değil, ama **repo'daki SQL ile canlı şemanın ayrıştığını** kanıtlıyor. Aynı sınıftan bilinen ikinci vaka #30 (districts migration'ı yazıldı, hiç çalıştırılmadı). ⚠️ `docs/*.sql` dosyalarından hangilerinin gerçekten koştuğu **hiçbir yerde kayıtlı değil** — dosyanın varlığı uygulandığı anlamına gelmiyor. → "Repo'da var, canlıda yok" envanteri çıkarılmalı.
  - `/api/listings/yakin` (GET, `?lat=&lng=`): en yakın ili bulur, RPC'yi çağırır, ilan listesini döner.
  - UI: `YolRehberiClient.tsx` — Liste/Harita yanına "📦 Yükler" toggle, `YukListeKart` bileşeni (kalkış→varış, fiyat, araç tipi, "YAKININDA" rozeti ilçe eşleşmesinde), `/ilan/[id]`'e link.
  - **Faz 1 kapsamı:** il bazlı (gerçek km mesafesi değil). Faz 2: `listings`/`listing_stops`'a gerçek koordinat + PostGIS bbox sorgusu (bkz. altta "🔮 Faz 2").
  - Migration: `docs/20260701_nearby_listings_rpc.sql` (Supabase SQL Editor'da manuel çalıştırılmalı).
- **POI Kalite Puanlama + Toplu Onay** (19 Haziran 2026): `/admin/poi-onay` sayfasına kalite puanı ve toplu seç/onayla eklendi.
  - `lib/poi-score.ts`: 0-100 kalite puanı hesaplar (telefon +20, website +10, tam adres +15, isimde TİR/kamyon anahtarı +20, Google rating≥4&yorum≥10 +25 / rating<2.5&yorum≥20 -40, blacklist isim -50, kategori çelişkisi -50). Eşik: ≥70 yeşil, 40-69 sarı, <40 kırmızı. İ/I trLower normalize.
  - `/api/admin/poi` GET: her kayda `quality_score`, `score_level`, `score_reasons` ekler (DB'ye yazılmaz, runtime); select'e Google alanları eklendi.
  - `/api/admin/poi` PATCH (yeni): toplu durum güncelleme `{ ids[], status }`, service role, `.in()` 50'lik chunk.
  - UI: her kartta checkbox + puan rozeti (hover'da gerekçe tooltip), liste üstünde toplu bar ("Puan≥70 Seç" / Tümünü Seç / Seçilenleri Onayla / Reddet). Onay insan eliyle — puan tek başına approved yapmaz.
  - Rozet "Kalite XX" yazıyor (Google puanıyla karışmasın diye); kart sağındaki Google puanı "Google ★ X.X" olarak ayrı. Sıralamaya "Kalite Skoru" eklendi (varsayılan, azalan) — skor DB kolonu olmadığı için client-side sıralanır.
  - **Not:** Şema değişikliği YOK, migration gerekmez. Puan tamamen runtime hesaplanır.
- **POI Google Places Entegrasyonu** (15 Haziran 2026): Mevcut POI modülüne Google Places veri pipeline'ı eklendi.
  - DB: `google_place_id` (unique), `google_rating`, `google_review_count`, `reviews_summary`, `verified`, `satellite_confirmed`, `is_active`, `last_synced_at` kolonları. 11 yeni TIR-spesifik kategori.
  - API: `/api/admin/poi-import` (Places Text Search + Details, upsert, duplicate engeli), `/api/admin/poi-import/[id]/summarize` (Claude Haiku ile Türkçe özet).
  - Admin paneli (`/admin/poi-onay`): "Google'dan Veri Çek" bölümü (il dropdown, kategori multi-select), uydu onay checkbox, yorum özeti butonu, Claude özet gösterimi.
  - Frontend: 11 yeni kategori chip, etiket listesi güncellendi.
  - Migration: `docs/20260615_poi_google_integration.sql`.
  - Env: `GOOGLE_PLACES_API_KEY` zorunlu.
- **POI Modülü / Yol Rehberi** (10 Haziran 2026): Kamyon şoförleri için konum tabanlı harita modülü.
  - DB: `pois`, `poi_reviews`, `poi_visit_logs`, `poi_stay_events` tabloları. PostGIS geography index.
  - RPCs: `get_pois_in_bbox` (bounding box + akıllı sıralama), `check_poi_visit` (200m geo-fence), `get_nearby_listings_for_parked_driver`, `get_parked_drivers_for_notification`.
  - API: `/api/poi` (GET bbox sorgu, POST ekle), `/api/poi/[id]` (detay), `/api/poi/[id]/review` (yorum + geo-fence).
  - Frontend: `/yol-rehberi` — React-Leaflet harita, 6 kategori chip, Tier 2 alt filtreler, SOS butonu, bottom sheet liste, POI detay modalı, yorum formu (hızlı etiket + yıldız), yeni POI ekleme modalı.
  - Contextual cross-entegrasyon: kullanıcı 3h+ parkta kalınca şehirdeki yük ilanları önerisi (pg_cron altyapısı hazır).
  - Migration: `docs/20260610_poi_module.sql`.
- **Radar & İstihbarat Paneli** (4 Haziran 2026): Admin satış radari — iki modül.
  - **Lead Radar** (`/admin/radar`): Rota bazlı (kalkış+varış) lead arama. `get_radar_intelligence` RPC, phone normalize, frekans+NLP sınıflandırma, WA/davet/geçmiş aksiyonları. Migration: `docs/20260604_radar_intelligence_rpc.sql`.
  - **Analitik Dashboard** (`/admin/radar/analitik`): QlikView-tarzı drill-down. Şehir listesi sol panel, varış/kalkış bar chart, araç tipi dağılımı, sparkline. `get_radar_city_overview` + `get_radar_city_detail(direction)` RPC. Migration: `docs/20260604_radar_analitik_rpc.sql`.
  - API: `app/api/admin/radar/route.ts` + `app/api/admin/radar/analitik/route.ts`.
  - 🚨 **DEPODAKİ RADAR MIGRATION'LARI CANLIYI TEMSİL ETMİYOR (30 Tem 2026 keşfi).**
    `docs/` altında beş dosya bu üç fonksiyonu birbirinin üstüne yazıyor. Canlı
    `pg_get_functiondef` çıktısı gösterdi ki en az iki sürüm **elle çalıştırılmış,
    depoya yazılmamış**: `get_radar_city_detail` canlıda `ILIKE` değil `=` kullanıyor;
    `get_radar_intelligence` canlıda `dest_ids AS MATERIALIZED` CTE'li (dosyadaki
    correlated `EXISTS` sürümünden yeni). **Kural: bu fonksiyonlara dokunmadan önce
    her zaman `pg_get_functiondef` ile canlı gövdeyi al** — `docs/20260730_dalga3_kesif.sql`.
  - ⏳ **Dalga 3 imzaları değiştiriyor** (`docs/20260730_dalga3_radar_province_id.sql`,
    SQL henüz çalıştırılmadı): `get_radar_city_detail(p_province_id int, p_direction, p_days, p_counterpart_id int)`,
    `get_radar_intelligence(p_from_province_id int, p_to_province_id int, p_days)`.
    `get_radar_city_overview(int)` imzası aynı, çıktıya `province_id` eklendi ve
    **LIMIT 60 → 81** (tavan zaten 81 il; önceden 61-81. sıradaki iller listede hiç görünmüyordu).
    Eski imzalar DROP ediliyor → PostgREST overload belirsizliği olmasın diye.
    **API il ADI almaya devam ediyor**, çeviri route sınırında `ilId()` ile; `AnalitikClient.tsx`
    değişmiyor çünkü RPC hem `province_id` hem kanonik `city` döndürüyor.
- **Shadow Profile / CRM** (1 Haziran 2026): WhatsApp'tan ilan atan kayıtsız numaraların otomatik profillenmesi.
  - `shadow_profiles` tablosu: phone (unique), name, company_name, notes, status, converted_user_id. RLS: admin only.
  - `listings.shadow_profile_id` FK eklendi.
  - Upsert RPC: `upsert_shadow_profile(p_phone)` — transaction güvenli, SECURITY DEFINER.
  - Entegrasyon: `/api/whatsapp/route.ts` (kayıtsız numara → fire-and-forget upsert + kayıt linki), `parse-listing` Edge Fn (contact_phone + user_id yoksa → upsert + listing'e shadow_profile_id set).
  - Admin CRM paneli `/admin/crm`: filtreleme (telefon arama, min ilan sayısı "balina" modu), sayfalama, sağdan açılan detay drawer (ilan geçmişi, isim/not/şirket düzenleme, durum).
  - Migration: `docs/20260601_shadow_profiles_crm.sql`.
- **Link Havuzu** (21 May 2026): Mesajlardaki URL'leri otomatik arşivleyen ve admin/moderatöre "yeni ilan kaynağı" olarak sunan radar sistemi.
  - `archived_links` tablosu: `url, domain, category, status, source, raw_post_id, user_id`. Unique index `url` üzerinde (duplicate yok).
  - URL çıkarma: `extractUrlsFromText` / `extractUrlsEdge` helper — `https?://...` regex, trailing punctuation trim, domain tespiti.
  - Ön kategori: `chat.whatsapp.com` → `whatsapp_group`, `t.me` → `telegram`, `facebook.com` → `facebook_group` vb.
  - Entegrasyon noktaları: `app/api/parse-text/route.ts` (kullanıcı metni) + `supabase/functions/parse-listing/index.ts` (WhatsApp ZIP). Her ikisi fire-and-forget, ana akışı etkilemez.
  - Admin UI: `/admin/link-havuzu` — status/category filtresi, Onayla/Reddet butonları, sayfalama.
  - API: `app/api/admin/link-havuzu/route.ts` (GET + PATCH, admin+moderatör yetkili).
  - Migration: `docs/20260521_archived_links.sql`.
  - WhatsApp Bot entegrasyonu da `whatsapp_parse` source ile tabloya yazar; `app/api/whatsapp/route.ts`'ye aynı fire-and-forget bloğu eklenebilir (isteğe bağlı).
- **Smart Learning Hub (SLH)** (14 May 2026): `/admin/ogrenme-merkezi` — 3 sekmeli alias yönetim paneli.
  - Sekme 1 — Alias Kütüphanesi: CRUD (ekle/düzenle/sil), tip filtresi (`city`, `vehicle`, `blacklist`), arama. 
  - Sekme 2 — AI Keşif Alanı: `raw_posts.processing_status='no_lane'` + `listings.origin_city IS NULL` listeleme; Haiku ile toplu alias keşfi (confidence≥70 → pending + `is_active=false`).
  - Sekme 3 — Onay Bekleyen: human-in-the-loop onay/red (`is_approved=true`+`is_active=true`) + “Yeniden İşle” re-parse trigger.
  - **Önemli kolon adları:** `aliases.normalized` (canonical değil), `raw_posts.raw_text` (message_text değil), `raw_posts.slh_scanned_at` (tarama takibi).
  - `raw_posts.slh_scanned_at`: NULL = hiç taranmadı; dolu = LLM gördü, bir daha gönderilmez. Migration: `docs/20260514_slh_scan_tracking.sql`.
  - Alias ekleme/düzenleme: city tipinde İl/İlçe seçimi — İl → `district: null`, İlçe → `district` dolu.
  - Admin ana sayfa: ReprocessWidget kaldırıldı, Öğrenme Merkezi kartı eklendi.
  - Migration: `docs/20260514_slh_aliases_columns.sql` (`created_by_ai`, `is_approved`, `approved_by`, `approved_at`, `llm_confidence`, `source_listing_ids`).
  - API: `app/api/admin/learn-aliases/route.ts` (GET/POST/PATCH/DELETE).
- **Expired pending otomatik arşiv** (12 May 2026): pg_cron job — her saat başı, 24 saatten eski `pending` ilanları `archived` yapar. Migration: `docs/20260512_auto_archive_expired_pending.sql`.
- **WhatsApp Bot** (12 May 2026): `app/api/whatsapp/route.ts` — Twilio Sandbox entegrasyonu, kayıt/kota/LLM parse/listing insert akışı. +90 normalize, imza doğrulama, TwiML yanıt. `price_offer`+`vehicle_type[]` şema uyumu.
- **WhatsApp ZIP Import düzeltmeleri** (14 May 2026): (1) Varsayılan saat filtresi 12→48 saat. (2) `batchKeys` Set ile intra-batch dedup — aynı `(hash,phone,date)` kombinasyonu batch içinde çakışınca tüm insert'in 23505 ile patlaması düzeltildi. (3) Sonuç satırına `alias_count` + collapsible debug log paneli eklendi.
- **Log implementasyonu** (12 May 2026): `lib/logger.ts` oluşturuldu. `proxy.ts` SecurityLogger, `parse-listing` pre_check_failed + error, `excel-import` satır-bazlı + tamamlanma, `parse-text` quota WARN, `ilan-ver/actions.ts` ilan yaratma INFO/ERROR, `moderator/toplu-islem` tüm moderasyon aksiyonları — tümü devreye alındı.
- Auth (OTP + e-posta + Google + merge), profil-tamamla
- Moderatör paneli v3, admin paneli
- WhatsApp parse + alias, Excel yükleme, Sahiplen akışı
- Panel (İlanlarım / Araçlarım / Profilim)
- Güvenlik Sprint 1–5
- Tekil ilan formu (yük + araç)
- **Metinden İlan akışı** (8 May 2026): kullanıcı WhatsApp/serbest metni yapıştırır → `/api/parse-text` Haiku LLM ile JSON çıkarır → mevcut tekil form prefilled olarak açılır → kullanıcı düzeltir + yayınlar. `listings.raw_text` doldurulur (source: 'form' korundu, CHECK karıştırmamak için).
- **Audit eşikleri konfigüre edilebilir** (8 May 2026): `system_config.parse.auto_publish_score_max` (default 31) ve `parse.reject_score_min` (default 71). Hem DB trigger (`audit_listing_fn`) hem `/api/ilan/duzelt` `lib/auditLimits.ts` helper'ını kullanır. Reject seviyesi artık shadow_ban + `moderation_status='archived'` set ediyor ("hiç dikkate alınmasın"). Migration: `docs/20260508_audit_thresholds_and_ai_quota.sql`.
- **Per-user AI ilan limiti** (8 May 2026): `users.ai_listing_quota_daily` (NULL=default), `system_config.llm.ai_listing_quota_default` (default 5/gün). `/api/parse-text` parse öncesi son 24s'lik AI ilan sayısını (`raw_text IS NOT NULL`) kontrol eder, dolduysa 429. Admin UI: `/admin/kullanicilar` tablosunda **AI Limit / Gün** sütunu — tıklanıp düzenlenebilir, boş = default, 0 = AI kapalı.
- Landing page (3 senaryo)
- Landing performans: getSession (network'üz), paralel auth+listings, progressive rozet zenginleştirme, limit 30, cancel guard
- Nasıl Çalışır, Hakkımızda, KVKK, Kullanım Koşulları

### ⏳ Faz 1 — Kalanlar
1. **Müşteri ilan detayı** — plaka onay, araç sil/pasifleştir modalları, progress bar
2. **E-posta bildirimleri** — durum değişikliklerinde tetiklenen mailler
3. **WhatsApp Bot** — nakliyeci/müşteri WhatsApp'tan mesaj atar → bot LLM ile ayrıştırır → ilan oluşturulur → link döner (detay: §11) ✅
3. **Log implementasyonu** (detay: `docs/LOG_VE_GUVENLIK_SPECLERI.md` §4 kontrol listesi)
   - `proxy.ts` → `SecurityLogger` (yetkisiz phone erişim → WARN) ✅
   - `supabase/functions/parse-listing` → null input `pre_check_failed` logu + error log ✅
   - `/api/excel-import` → satır bazlı validasyon + tamamlanma logu ✅
   - `/api/parse-text` → quota aşımı WARN logu ✅
   - `lib/logger.ts` → `logRlsError()` yardımcısı oluşturuldu; diğer route'larda kullanılabilir ✅
   - `app/ilan/[id]` → henüz `raw_text` yok; Faz 2'de ekle ⏳
   - Vercel Analytics bot-trafik izleme → altyapı gerektiriyor, Faz 2 ⏳

### 🔧 Kısmi / Geliştirme Gereken
- Profil: doğrulama rozetleri, güven skoru
- Nakliyeci araç formu: marka/model/yıl/ruhsat belgesi
- Kayıtlı adresler (müşteri)

### 🔮 Faz 2
- **Yakınımdaki Yükler — gerçek mesafe:** `listings`/`listing_stops`'a `origin_location geography(Point,4326)` kolonu, ilan oluşturulurken (form/WhatsApp/Excel) geocoding, `get_listings_near_point(lat,lng,radius_m)` RPC (POI'deki `get_pois_in_bbox` mantığının aynısı) — haritada gerçek "500m yarıçap" gösterimi ve mesafeye göre sıralama.
- "Bu işi aldım" akışı (durum güncellemeleri, bildirim, ilan pasife)
- **Güven ve İtibar Sistemi** — çift körleme puanlama, rozet sistemi (detay: §15)
- Trust score, MERNİS/GİB, canlı konum
- Doğal dil arama, ödeme sistemi, push bildirim
- **WhatsApp'tan İlan Gönder CTA** — Hero bölümüne WhatsApp ikonlu buton ("💬 İlanını WhatsApp'tan Gönder"), GA event + deep link entegrasyonu

---

## 11. WHATSAPP BOT (Faz 1)

### Kullanıcı Akışı
```
Kullanıcı WhatsApp'tan yazar:
  "Selam, yarın Konya'dan İstanbul'a 20 ton buğdayım var, tır lazım."
    ↓
[1] KAYIT KONTROLÜ
    SELECT * FROM users WHERE phone = '+90...' LIMIT 1
    ↓
    ✗ Kayıt yok → Bot cevap yazar:
        "Bu numara ile kayıtlı hesap bulunamadı.
         Kayıt olmak için: yukegel.app/giris"
        → AKIŞ DURUR (LLM çağrılmaz)
    ✓ Kayıt var → devam
    ↓
[2] AI KOTA KONTROLÜ (LLM'den önce)
    Son 24s içinde bu user'ın WhatsApp'tan oluşturduğu ilan sayısı
    >= ai_listing_quota_daily → Bot cevap yazar:
        "Günlük AI ilan limitine ulaştınız.
         Yeni ilanı yukegel.app/ilan-ver adresinden oluşturabilirsiniz."
        → AKIŞ DURUR (LLM çağrılmaz)
    < limit → devam
    ↓
[3] LLM PARSE (Haiku)
    Metni ayrıştırır:
    { nereden: "Konya", nereye: "İstanbul", yuk: "Buğday",
      agirlik: 20, birim: "ton", arac_tipi: "Tır" }
    ↓
[4] listing + listing_stops tablolarına INSERT (source: 'whatsapp')
    ↓
Bot WhatsApp'tan cevap yazar:
  "İlanın yayına alındı! ✅ Link: yukegel.app/ilan/123"
```

### Teknik Gereksinimler
| Bileşen | Açıklama | Durum |
|---|---|---|
| Webhook endpoint | `app/api/whatsapp/route.ts` — Twilio POST alır, TwiML ile yanıtlar | ✅ |
| WhatsApp Business API | **Twilio** Sandbox — webhook kaydı yapıldı | ✅ |
| Mesaj yönlendirme | Numaraya göre kullanıcı eşleme (`users.phone`, +90 normalize) | ✅ |
| Parse | Mevcut `parse-listing` Edge Fn veya `/api/parse-text` kullanılır (regex + LLM) | ✅ |
| Kayıtsız kullanıcı | Kayıt yok → LLM çağrılmadan kayıt linki döner, ilan açılmaz | ✅ |
| Quota | LLM'den önce `ai_listing_quota_daily` kontrolü — `source='whatsapp'` dahil | ✅ |
| Landing hero | WhatsApp botunu ön plana çıkaran mesaj/CTA ("Sadece yaz, ilanın yayında") | 🔮 Yapılacak |

### Landing Entegrasyonu
- Hero bölümünde WhatsApp ikonlu belirgin CTA: **"WhatsApp'tan yaz, saniyeler içinde yayında"**
- Nasıl Çalışır sayfasına WhatsApp adımı eklenmeli
- Mobilde direkt WhatsApp deep link: `https://wa.me/90XXXXXXXXXX?text=...`

### Öncelik Sırası
1. WhatsApp Business API hesabı + webhook kaydı
2. `/api/whatsapp-parse` endpoint (mevcut parse altyapısını çağırır)
3. Kullanıcı eşleme + onboarding yanıtı
4. Landing hero güncellemesi

---

---

## 15. GÜVEN VE İTİBAR SİSTEMİ (Airbnb Çift Körleme Modeli)

### Genel Bakış
Platform güvenilirliğini artırmak için çift kör (double-blind) puanlama sistemi. İki taraf da yorum yazmadan yorumlar yayınlanmaz; sadece biri yazarsa 7 gün sonra otomatik yayınlanır.

### İş Akışı
```
1. Nakliyeci → "İşi Aldım" butonu → Yük sahibi onayı → transaction kaydı oluşur
2. Taşıma tamamlandıktan 24 saat sonra her iki tarafa değerlendirme bildirimi
3. Her iki taraf yorum yazarsa → anında is_published = true
4. Sadece biri yazarsa → 7 günlük cron job otomatik yayınlar
5. Hiçbiri yazmazsa → yorum kaydı açık kalır, 7 gün sonra kapanır
```

### Veritabanı Gereksinimleri
```sql
-- transactions tablosu ("Bu işi aldım" akışı için)
CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES listings(id),
  carrier_id uuid REFERENCES users(id),   -- nakliyeci
  owner_id uuid REFERENCES users(id),     -- yük sahibi
  status text DEFAULT 'pending',          -- pending|active|completed|cancelled
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- reviews tablosu
CREATE TABLE reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES transactions(id),
  listing_id uuid REFERENCES listings(id),
  reviewer_id uuid REFERENCES users(id),
  target_id uuid REFERENCES users(id),
  rating smallint CHECK (rating BETWEEN 1 AND 5),
  comment text,
  is_published boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  published_at timestamptz
);
```
RLS: Kullanıcı yalnızca kendi yazdığı yorumları ve `is_published = true` olanları görebilir.

### Çift Körleme Mantığı (Edge Function / DB Webhook)
- Her iki taraf `reviews` tablosuna yazdığında → her iki kaydı da `is_published = true` yap
- pg_cron (günlük): `created_at < now() - interval '7 days'` olan tek taraflı kayıtları yayınla

### Rozet Sistemi
| Rozet | Kriter | Kime |
|---|---|---|
| ⚡ Hızlı Ödemeci | Faz 2 ödeme modülüyle tanımlanacak | Yük sahibi |
| 🛡️ Güvenilir Nakliyeci | Son 10 işte ortalama puan ≥ 4.5 | Nakliyeci |
| ⏰ Dakik Şoför | Zamanında teslimat oranı ≥ %90 | Nakliyeci |

Rozetler DB function ile hesaplanır, `users.badges jsonb` kolonunda saklanır.

### UI/UX Gereksinimleri
- **İlan Kartları:** Yük sahibinin ⭐ puanı + toplam tamamladığı iş sayısı kart üzerinde
- **Profil Sayfası:** Alınan yorumlar kronolojik liste + kazanılan rozetler bölümü
- **Değerlendirme Formu:** 5 yıldız + metin alanı (opsiyonel), "Puanla ve Bitir" butonu
- **Çift körleme durumu:** "Karşı taraf henüz değerlendirme yazmadı, X gün sonra yayınlanacak"

### Görevler
- [ ] `transactions` tablosu + RLS politikaları
- [ ] `reviews` tablosu + RLS politikaları
- [ ] `users.badges jsonb` kolonu
- [ ] "İşi Aldım" butonu → yük sahibi onay/red akışı (transaction INSERT)
- [ ] Çift körleme mantığı: DB Webhook veya Edge Function
- [ ] pg_cron job: 7 günlük tek taraflı yorum otomatik yayınlama
- [ ] Taşıma bittikten 24s sonra değerlendirme bildirimi tetikleyicisi
- [ ] Rozet hesaplama DB function
- [ ] İlan kartına puan + iş sayısı bileşeni
- [ ] Profil sayfasına Yorumlar + Rozetler bölümü
- [ ] Değerlendirme formu UI (nakliyeci tarafı + müşteri tarafı)

### Öncelik Sırası
1. DB şeması (`transactions` + `reviews` + `users.badges`)
2. "İşi Aldım / Onayla" transaction akışı UI
3. Değerlendirme formu UI'ları
4. Çift körleme Edge Function + pg_cron
5. Bildirim tetikleyicileri (24s sonra)
6. Profil sayfası güncelleme + rozet sistemi

---

## 12. BİLİNEN BUGLAR

| # | Bug | Durum |
|---|---|---|
| 1 | WhatsApp iOS format | ✅ |
| 2 | users!fk join production | ✅ |
| 3 | Browser client toplu işlem RLS | ✅ |
| 4 | E-posta kayıt profil-tamamla | ✅ |
| 5 | Admin/Gmail /ilan-ver erişim | ✅ |
| 6 | Moderatör düzenleme: ilçe/input her tuşta focus kaybı (inline component) | ✅ 8 May 2026 |
| 7 | `refresh_token_not_found` — geçersiz token döngüsü | ✅ 12 May 2026 — middleware.ts eklendi, getCurrentUser hata yakalıyor |
| 8 | Toplu işlem `.in()` URL limiti — 50'lik batch ile düzeltildi | ✅ 12 May 2026 |
| 9 | WhatsApp ZIP import: cutoff 12h→48h varsayılan + intra-batch 23505 | ✅ 14 May 2026 |
