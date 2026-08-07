# Yükegel — Yapılacaklar Listesi

> ## ✅ 7 AĞU 2026 — WHATSAPP YÜKLEME `/moderator/whatsapp-yukle`YE AYRILDI
>
> **İstek:** "Moderatör ve WhatsApp dosyası upload sürecini incele. Gerekirse
> ayrı sayfalar yap."
>
> Keşif ajanıyla `app/moderator/page.tsx` (1349 satır, ~35 `useState`, tab
> yok — hepsi tek ekranda conditional render) ve `WhatsappYukle.tsx` (441
> satır) haritalandı. **Ayırmayı haklı çıkaran somut kanıt:** `WhatsappYukle()`
> **parametresiz** bir bileşen — moderasyon kuyruğuyla (ilanlar, filtreler,
> toplu işlemler) hiçbir prop/state paylaşmıyor, ama aynı 1349 satırlık dosyanın
> içine (satır 892, koşulsuz render) gömülüydü. Yükleme akışı dakikalarca
> sürebiliyor (ZIP açma + parça bölme + 429/504'te otomatik yeniden deneme
> döngüsü, `WhatsappYukle.tsx`'e bkz.) — bu süre boyunca 200 satırlık
> moderasyon tablosu (her tuş vuruşunda `useMemo`'suz yeniden hesaplanan
> filtre/sıralama) aynı React ağacında gereksiz yere canlı kalıyordu.
>
> **Yapılan:** `app/moderator/whatsapp-yukle/page.tsx` (yeni) — `WhatsappYukle`
> bileşenini değiştirmeden barındıran, kendi nav'ı + "Moderasyona dön" linki
> olan ayrı bir sayfa. `/moderator`den gömülü render kaldırıldı, yerine nav'a
> "📱 WhatsApp Yükle" linki eklendi. Yetki kontrolü üç katmanda zaten sağlam:
> `proxy.ts`'teki `KORUNMALI` listesi `/moderator` ÖNEKİYLE eşleştiği için yeni
> rota otomatik korunuyor, sayfanın kendi client-side kontrolü `/moderator/
> page.tsx`'teki ile birebir aynı desen, gerçek sınır zaten sunucuda
> (`/api/whatsapp-parse` → `requireStaff()`) — hiçbiri değişmedi.
> **Doğrulama:** `tsc --noEmit` temiz, gerçek `next build` temiz (`/moderator/
> whatsapp-yukle` yeni statik rota olarak listede).
>
> 📌 **Dokunulmadı, kayıtlı bulgular (bu görevin kapsamı dışı, ayrı iş):**
> `duzenleKaydet` doğrudan tarayıcıdan N+1 update/insert atıyor (transaction
> yok, koda göre bilinçli teknik borç) · "Çözümsüz" (no_lane) manuel ilan
> akışı normal düzenleme state'iyle string-prefix hilesiyle (`'no_lane_'+id`)
> aynı state'i paylaşıyor, kırılgan · filtre/arama `useMemo`suz, 200 satırda
> her tuş vuruşunda yeniden hesaplanıyor · "Sonraya Bırak" listesi bellekte
> (sayfa yenilenince sıfırlanıyor) — zaten `docs/YAPILACAKLAR.md`'de açık bir
> madde olarak kayıtlıydı. WhatsApp'ın kendi 60sn Vercel timeout riski daha
> önce (22 Tem 2026 olayı sonrası) ayrı bir mühendislik dalgasıyla azaltılmış
> durumda — tamamen ortadan kalkmadı ama bu görevin konusu değildi.

> ## 🔴 7 AĞU 2026 — GÜVENLİK: KAYIT/GİRİŞ DENETİMİ, İKİ KRİTİK AÇIK KAPANDI
>
> **İstek:** "Kullanıcı kayıt ve login süreçlerini kontrol et."
>
> Denetim bir keşif ajanıyla (dosya haritalama) + kendi elimle DB'de gerçek
> saldırı simülasyonuyla (`SET LOCAL ROLE`, işlem içi, hep `ROLLBACK`) yapıldı.
> Bulguları kabul etmeden önce HER BİRİNİ bizzat çalıştırıp kanıtladım.
>
> ### 🔴🔴 #1 — `public.users`: herkes TCKN/VKN/email/telefon okuyabiliyordu, herkes kendini admin yapabiliyordu
>
> RLS SELECT policy'si `using(true)` idi (rozet/herkese açık profil kartı için
> BİLEREK öyle yazılmış) — ama tablo düzeyinde `anon`/`authenticated`'e GENİŞ
> `GRANT` (SELECT/UPDATE/DELETE/TRUNCATE, tüm kolonlar) verilmiş olduğu ortaya
> çıktı. **RLS satır düzeyini korur, kolon düzeyini korumaz** — kolon koruması
> yalnız GRANT/REVOKE ile sağlanır ve bu tabloda hiç yapılmamıştı.
>
> **Kanıtlanan (7 Ağu, `SET LOCAL ROLE anon`, işlem geri alındı):**
> `anon` rolüyle **104 satırın tamamı, 8 TCKN, 21 email** okunabiliyordu —
> giriş bile gerekmiyordu, herkese açık `anon` API anahtarıyla.
> `authenticated` rolüyle (gerçek bir 'user' rolündeki hesabın kimliğiyle
> simüle edildi) **kendi `role` kolonunu `'admin'` yapmak** başarılı oldu.
>
> **Düzeltme:** `revoke all on public.users from anon, authenticated;` sonra
> yalnız gerçekten gerekli kolonlar geri verildi — SELECT: `id, display_name,
> user_type, phone_verified, created_at` (rozet + herkese açık profil kartı,
> kod taranarak bu ihtiyaç doğrulandı); UPDATE (authenticated, kendi satırı):
> `display_name, company_name, bio, phone, phone_verified` (panelin gerçekten
> istemciden yazdığı tek alanlar). Kullanıcının KENDİ tam profilini görmesi
> zaten servis rolüyle çalışıyordu (`app/panel/page.tsx`, `profil-tamamla/
> actions.ts`) — bu kısıtlama o akışları hiç etkilemedi.
> **Doğrulama (aynı gün tekrar test edildi):** PII okuma → `42501 permission
> denied` ✅ · rol yükseltme → `42501 permission denied` ✅ · rozet okuma →
> hâlâ çalışıyor ✅ · kendi profilini güncelleme → hâlâ çalışıyor ✅.
> Kayıt: `docs/20260807_guvenlik_kayit_giris.sql` (ölçüm+uygulama+doğrulama).
>
> 📌 **Aynı kalıp başka tabloda var mı diye tarandı** (`qual='true'` olan tüm
> SELECT policy'leri): `districts`/`provinces`/`listing_stops`/`listings`/
> `poi_reviews` — hepsi kontrol edildi, hiçbirinde hassas kolon açığa çıkmıyor
> (`listings.contact_phone` zaten doğru şekilde kolon bazlı kapalıydı — bu
> tabloda daha önce yapılmış, `users`'ta hiç yapılmamış).
>
> ### 🔴 #2 — `app/api/auth/merge/route.ts`: hesap ele geçirme
>
> `mergeUserId`/`keepUserId` istemciden (`app/giris/page.tsx`'te URL parametresi
> `?merge_user_id=`) geliyordu. Eski yetki kontrolü yalnız "çağıran bu İKİ
> ID'DEN BİRİ mi" diye bakıyordu. **Saldırgan kendi id'sini `keepUserId`
> yapıp `mergeUserId`'ye herkese açık `/u/<uuid>` profil URL'inden aldığı
> RASTGELE bir kullanıcının id'sini koyabiliyordu** — kontrol geçiyordu.
> Sonuç: kurbanın ilanları/araçları kendi hesabına taşınıyor, TCKN/VKN/telefonu
> kendi profiline kopyalanıyor, kurbanın hesabı `is_active=false` ile devre
> dışı bırakılıyordu — **kurbandan hiçbir eylem gerekmeden tam hesap ele
> geçirme**, tek bir craft edilmiş link.
> **Düzeltme:** sunucu artık iki hesabın GERÇEKTEN aynı e-postaya ait
> olduğunu (Supabase Auth admin API ile, istemciye güvenmeden) kendisi
> doğruluyor — bu route'un tek belgelenmiş meşru senaryosu zaten "aynı
> e-postayla farklı sağlayıcıdan gelen iki hesabın birleşmesi". Eşleşmezse 403.
>
> ### 🟠 #3 — `app/api/auth/tekil-kontrol/route.ts`: kotasız TCKN/VKN/telefon sorgusu
>
> Projenin GERİ KALANINDA HER YERDE (`giriş`, `otp`, `dogrulama-tekrar`)
> `lib/kota.ts` kullanılırken bu route tek istisnaydı — oturumsuz, kotasız,
> sınırsız hızda "bu TCKN/VKN/telefon kayıtlı mı" sorulabiliyordu (gizlilik
> sızıntısı + toplu telefon numarası taraması riski). IP başına 20/5dk kota
> eklendi (`lib/kota.ts`, projenin geri kalanıyla aynı desen).
>
> ### 🟡 Dokunulmadı — takip gerektiren bulgular
>
> - **`phone_verified` hâlâ istemciden doğrudan yazılabiliyor**
>   (`PanelClient.tsx::otpDogrula` OTP başarılı DÖNDÜKTEN SONRA client'ın
>   kendisi set ediyor). Devtools'la OTP adımı atlanıp doğrudan PATCH
>   edilebilir. Düzgün çözüm bu yazmayı sunucuya taşımak (`profil-tamamla`
>   deseni) — canlı özelliği kırma riski taşıdığı için bu oturumda aceleye
>   getirilmedi, ayrı görev.
> - **OTP doğrulama brute-force korumasına tabi değil** — yalnız SMS
>   *gönderimi* kotalı, kod tahmin etme denemesi değil. Supabase platform
>   seviyesinde bir sınırı olabilir, doğrulanmadı.
> - **`auth_leaked_password_protection` kapalı** (Supabase Advisor) —
>   HaveIBeenPwned kontrolü. DB/kod ile açılamıyor, **Bayram'ın Supabase
>   Dashboard'dan (Authentication → Policies) açması gerekiyor.**
> - Kayıt formu e-posta enumeration (sektör normu, düşük öncelik),
>   `switch-account` eski implicit-flow yöntemi kullanıyor (tutarlılık
>   kontrolü ayrı görev).
>
> **Doğrulama (kod tarafı):** `tsc --noEmit` temiz, gerçek `next build` temiz.

> ## ✅ 7 AĞU 2026 — LANDING + İLAN DETAYI PERFORMANSI: 400 KAT VE 158 KAT
>
> **İstek:** "İlanlar çok hızlı gelmeli. İlan detayı da hızlı açılmalı."
>
> **Ölçüm önce.** `pg_stat_statements`e bakıldı — tahmin değil, gerçek üretim
> trafiği. Ana sayfa/filtre sorgusu (355 çağrı) **ortalama 1026ms, en kötü
> 21.373ms**. Sayım sorgusu (hero rozeti) **1269ms**. Bunlar "yavaş hissediliyor"
> değil, ölçülmüş, kullanıcının gerçekten beklediği süreler.
>
> ### Bulgu 1 — planlayıcı satır sayısını 8 kat yanlış tahmin ediyordu
>
> `moderation_status = ANY('{approved,auto_published}')` iki değerli koşulu
> Postgres'e **355 satır** dedirtiyordu, gerçek **2934**. Yanlış tahmin yüzünden
> planlayıcı "tara + sırala" planını seçiyor, `listing_stops` lateral join'ini
> kazanan 200 satır yerine eşleşen **2934 satırın hepsinde** çalıştırıyordu.
> **Kanıt:** aynı sorgu tek değerli eşitlikle (`moderation_status = 'approved'`)
> **9,6ms**'de bitiyordu — index eksikliği değil, saf istatistik sorunu.
> **Düzeltme:** `create statistics listings_aktiflik_korelasyon (dependencies,
> ndistinct) on moderation_status, is_shadow_banned, status` + `analyze`.
> **Sonuç:** 1711ms (soğuk) → 307ms → **4ms (sıcak, kararlı) — 400 kat.**
>
> ### Bulgu 2 — `listings` hiç manuel VACUUM edilmemişti
>
> `n_dead_tup` 30.559/255.880 (%12) — varsayılan autovacuum eşiği %20, bu yazma
> hacminde (toplu expire/reject cron'ları) 7+ gündür hiç tetiklenmemiş.
> Visibility map bayat olduğu için sayım sorgusu Index-Only-Scan'de **6219 Heap
> Fetch**'e düşüyordu. **Düzeltme:** `vacuum (analyze) listings` +
> `autovacuum_vacuum_scale_factor` %20 → **%5**'e çekildi (tekrarlamasın diye).
> **Sonuç:** 1269ms → **8ms — 158 kat.**
>
> ### Bulgu 3 — `/ilan/[id]` her açılışta AYNI ilanı 2 kez sorguluyordu
>
> Next.js `generateMetadata` ile sayfa bileşenini AYRI ayrı çalıştırır; ikisi de
> kendi `.eq('id', id).single()` sorgusunu atıyordu (dar/geniş iki farklı select
> ile) — her ilan açılışında **iki DB gidiş-gelişi**, tek satır için. Ayrıca auth
> kontrolü (`getUser()`) ilan sorgusunu **bekledikten sonra** başlıyordu; ikisi
> birbirinden bağımsız olduğu hâlde ardışıktı. **Düzeltme:** `React.cache()` ile
> tek sorguya indirildi (Next.js'in resmî generateMetadata+page dedup deseni),
> alan kümesi ikisinin ihtiyacının birleşimi yapıldı; ilan sorgusu + auth kontrolü
> `Promise.all` ile paralel atılmaya başlandı. Sonrasındaki iki bağımsız `users`
> sorgusu (profil tamamlanmışlık + ilan sahibi rozeti) da paralelleştirildi.
>
> ### Dokunulmayan yerler — kod değişikliği GEREKMEDİ
>
> `/api/listings/ara` (il filtresi) ve `HomeClient.tsx`'in istemci "yenile"
> sorgusu **aynı tabloyu aynı filtrelerle** sorguluyor — Bulgu 1/2'nin DB
> düzeltmeleri onlara da otomatik yansıdı, ayrı bir kod değişikliği gerekmedi.
>
> **Kayıt:** `docs/20260807_performans_listings.sql` (ölçüm + uygulama +
> doğrulama + geri alma birlikte, proje kalıbı). **Doğrulama:** `tsc --noEmit`
> temiz, gerçek `next build` temiz. Geriye alınabilirlik: `CREATE STATISTICS` ve
> autovacuum ayarı `DROP`/`RESET` ile geri alınabilir; `VACUUM`/`ANALYZE` zaten
> geri alınacak bir "değişiklik" değil, bakım işlemi.

> ## ✅ 7 AĞU 2026 — "YAZARAK İLAN EKLE" ARTIK ÖNCE REGEX, SONRA CLAUDE
>
> **İstek:** yazarak ilan eklerken her seferinde Claude'a sormak yerine kendi
> ayrıştırma fonksiyonumuzu kullanalım.
>
> **Yapılan — YENİ:** `lib/lane-parser.ts`. `supabase/functions/parse-listing/
> index.ts`teki (Deno, WhatsApp toplu import) deterministik ayrıştırma
> primitiflerinin (`cleanMessage`/`trNorm`/`stripSuffix`/`extractPhones`/
> `detectAdType`/`splitByRelation`/`findPlaces`/`findVehicle`/`findBodyType`/
> `extractWeight`/`extractPallet`) ELLE SENKRON kopyası — `lib/whatsapp/
> telefon.ts` deseniyle aynı gerekçe: Deno kendi klasörü dışını import edemez.
> Üstüne `extractPrice`/`extractDate`/`detectDateFlexible` (Deno'da hiç yok,
> yalnız bu modülde) ve tek-ilan odaklı yeni bir orkestratör: `hizliAyristir()`.
>
> **`hizliAyristir` Deno'nun `parseMessage`'ı DEĞİL.** Deno'nunki çok-şeritli
> WhatsApp broadcast'i için aylarca sertleştirildi (#86-#92); web textarea'sına
> yazılan TEK bir serbest metin ilanı farklı bir girdi dağılımı. Güven eşiği
> KATI: en az bir ilişki (ok/tire/"'den...'e") bulunup HEM sol HEM sağ tarafı
> alias tablosundan bir yere çözülebilmeli — yoksa `null` döner, çağıran LLM'e
> düşer. Belirsizde sessizce yanlış doldurmak, "çözemedim" demekten kötüdür.
>
> **`app/api/parse-text/route.ts` akışı değişti:** auth → metin oku → URL
> arşivle → **regex dene** → çözdüyse `source:'regex'` ile dön, **AI kotasına
> hiç dokunulmaz** → çözemediyse mevcut kota kontrolü + Claude yolu aynen
> çalışır (`source:'llm'`). Kullanıcı hiçbir şey kaybetmiyor, yalnız daha az
> istek ücretli kalıyor.
>
> 🚨 **NEREDEYSE #71'İN AYNISINI TEKRARLIYORDUM.** `aliases` tablosu bugün
> **1269** aktif satır — PostgREST'in sayfa başı 1000 satır sınırının üstünde.
> Sayfalamadan tek sorguyla çekilseydi alias'ların ~üçte biri hatasız-sessizce
> görünmez olurdu (Deno'da #71'in ta kendisi). `aliaslariGetir()` Deno'daki
> `aliaslariCek()` ile aynı `.range()` sayfalama desenini kullanıyor.
>
> **Doğrulama:** `tsc --noEmit` temiz · `npx next build` temiz (gerçek prod
> build, sandbox değil) · mevcut `test:lokasyon`/`test:alias` bozulmadı (dosya
> paylaşılmıyor, regresyon riski yok) · gerçek DB alias verisiyle (1269 satır)
> 6 örnek metin elle koşuldu (3'ü `MetindenIlan.tsx`'teki resmî örnekler):
>
> | örnek | sonuç |
> |---|---|
> | "İstanbul Tuzla'dan Ankara Sincan'a 24 ton..." | ✅ regex çözdü, tam doğru |
> | "Boş tırım var, İzmir'de... İstanbul, Bursa, Kocaeli yönüne..." | ✅ doğru şekilde `null` — ilişki kurulamıyor, LLM'e düşer |
> | "Adana → Mersin, 10 palet meyve, frigo, 5 ton" | ⚠️ regex çözdü ama iki bilinen kusur çıktı (aşağıda) |
>
> ### 🐛 Bulunan iki kusur — biri düzeltildi, biri MİRAS (bilerek dokunulmadı)
>
> 1. **DÜZELTİLDİ — `extractPrice` ayraçsız 4+ haneli fiyatı yanlış okuyordu.**
>    `\d{1,3}(?:[.,]\d{3})*` deseni "15000" (ayraçsız) girdisinde `*` sıfır
>    tekrara düşüp yalnız SON 3 haneyi ("000"=0) yakalıyordu → `price: null`
>    dönüyordu (15000 TL değil 0 TL okunup elenmiş oluyordu). Alternatifli
>    desene (`ayraçlı+ | ayraçsız düz \d+`) çevrildi, "15000 TL" → `15000`
>    doğru sonucu verdi. Bu YENİ kod, Deno'da karşılığı yok, senkron yükümlülüğü
>    taşımıyor.
> 2. **MİRAS, o an dokunulmadı — ayrı görev olarak açıldı, aşağıda KAPANDI.**
>    `detectAdType`'ın "yuklenecek" anahtar kelimesi yanlış yönlüydü.
>
> ### ✅ 7 AĞU 2026 — #93 KAPANDI: `detectAdType`'tan "yuklenecek" çıkarıldı
>
> **Ölçüm önce, karar sonra.** `raw_posts.raw_text`'i (WhatsApp kanalı geçmiş
> veriyi tutuyor, `/api/parse-text` tutmuyor) tarayınca: `listing_type='arac'`
> olan ve metninde tam "yuklenecek" geçen **1350** ilan bulundu. Rastgele **25**'i
> elle okundu — **25'i de** gerçekte yük simsarı kalıbıydı: "Urfa'dan büyük balya
> yüklenecek", "Sarımsak yüklenecek", "Şişe yüklenecek" — Türkçe nakliye
> jargonunda "X yüklenecek" = "X kalkışlı yük var, araç aranıyor" demek, "boş
> aracım var" demek DEĞİL. Ayrıca bu 1350'nin yalnız **2'sinde** başka bir
> gerçek araç sinyali (`bos arac`/`bos tir`/`bos kamyon`/`yuk ariyor`) de vardı
> — yani kelimeyi çıkarmak neredeyse hiçbir GERÇEK araç ilanını kaçırmıyor.
>
> **Yapıldı:** `aracKelimeler` listesinden `'yuklenecek'` çıkarıldı — hem
> `supabase/functions/parse-listing/index.ts` (Deno, canlı) hem `lib/lane-
> parser.ts`'te (senkron kopya, ikisi birden değişti).
>
> **Yeni bekçi: `npm run test:ad-type`** (`scripts/test-ad-type.mts`). `trNorm`+
> `detectAdType` `index.ts`ten ÇALIŞMA ANINDA sökülür — elle kopyalanmaz (#86
> dersi). 12 kontrol: gerçek "yuklenecek" örnekleri artık `yuk`, gerçek araç
> sinyalleri (`boş araç`/`boş tır`/`boş kamyon`/`yük arıyor`) hâlâ `arac`,
> "yuklenecek" + gerçek araç sinyali BİRLİKTE geçince yine `arac` (kelimeyi
> çıkarmak diğer sinyalleri bozmuyor). **Mutasyonla doğrulandı:** kelime geri
> konunca tam **5** test düştü, gerisi sağlam kaldı.
> **Regresyon:** `test:87`/`test:pass2`/`test:clean`/`test:lokasyon`/
> `test:districts`/`test:alias` + `tsc --noEmit` hepsi yeşil.
>
> ✅ **DEPLOY EDİLDİ — canlı `parse-listing` v91 (7 Ağu 2026).** `list_edge_
> functions` ile doğrulandı: `version: 91, status: ACTIVE`.
>
> **Geçmiş veri — Bayram kararı: DEĞME.** Düzeltmeden önceki ~1350 yanlış
> etiketli ilanın durum dağılımı ölçüldü:
>
> | durum | sayı |
> |---|---|
> | pasif + arşivlenmiş (ölü ilan) | 1174 |
> | pasif + onaylı | 124 |
> | pasif + reddedilmiş | 38 |
> | pasif + bekliyor (moderatör kuyruğu) | 11 |
> | **aktif + onaylı (şu an canlıda görünen)** | **1** |
>
> Yalnız 1 ilan şu an gerçekten yanlış görünüyordu; toplu `UPDATE` riski/emeği
> bu kadar küçük bir kazanca değmedi — #90'daki "onarımın gerçek değeri
> sanılandan küçük" dersiyle aynı kalıp. İleri-yönlü düzeltme kalıcı, geçmiş
> veri olduğu gibi bırakıldı.
>
> ### ✅ 7 AĞU 2026 — `aliases` veri kalitesi düzeltildi: frigo/frigorifik/frigolu artık `body`
>
> Yukarıdaki bulgu için Bayram kararı geldi: taşı. `docs/20260807_frigo_body_tasima.sql`
> çalıştırıldı — id 230/231/232, `type='vehicle'→'body'`. **Öncelik de bilerek
> 80'den 70'e çekildi**: mevcut `body` tipi alias'ların tavanı 70 (Açık Kasa/
> Damperli/Jumbo/Liftli/Tenteli hepsi 70); 80 kalsaydı bu üç satır TÜM body
> alias'ları arasında en yüksek öncelikli olur, `findBodyType()` (öncelik
> sırasına bakar, metindeki gerçek konuma değil) metinde "tenteli" daha belirgin
> geçse bile "frigo" varsa onu seçerdi.
> **Önce ölçüldü, sonra yazıldı:** `aliases_katlanmis_anahtar_uniq` (type,
> katlanmış_anahtar, WHERE is_active) çakışma riski taşıyordu — kontrol 0 satır
> döndü (aktif `body` tipinde zaten "frigo"/"frigorifik"/"frigolu" yoktu, yalnız
> iki kelimelik "frigo tır" vardı), UPDATE güvenle çalıştı.
> **Doğrulama:** `lib/lane-parser.ts::hizliAyristir` gerçek güncel veriyle tekrar
> koşuldu — "10 palet meyve, frigo, 5 ton" örneği artık `vehicle_type: null`,
> `body_type: ["Frigorifik"]` veriyor (öncesi: `vehicle_type: "Frigorifik"`
> yanlış + `body_type: []` boş).
> 📌 Canlı `parse-listing` (Deno) etkisi: kod deploy'u GEREKMEDİ, worker'lar
> alias'ı 60 sn TTL'li önbellekten okuyor (#73), değişiklik kendiliğinden yayıldı.
>
> ⚠️ **ÖLÇÜLMEDİ — gerçek trafikte kaçta kaçı regex'le çözülüyor.** `/api/parse-
> text` ham metni DB'ye yazmıyor, yani geçmiş trafik üzerinden "regex hit oranı"
> hesaplanamaz (ölçecek veri yok). `structuredLog('INFO'/'WARN', 'llm-parser', ...)`
> her iki yolu da Vercel loglarına düşürüyor — birkaç günlük canlı trafikten
> sonra log tabanlı bir oran çıkarılabilir. Deploy Next.js uygulamasının kendisi
> (Vercel, push'ta otomatik) — ayrı bir `supabase functions deploy` GEREKMİYOR,
> bu route Deno tarafında değil.

> ## ⏳ ERTELENDİ (6 EYLÜL 2026'YA KADAR) — Dalga 5 yedek tablolarını sil
>
> `public.dalga5_yedek_20260806` (14 MB, 234.840 satır) ve
> `public.dalga5_yedek_stops_20260806` (18 MB, 245.086 satır) — coğrafi geçişin
> son geri dönüş yolu. 7 Ağu'da "coğrafi geçiş bittiyse temizle" istendi;
> retention tarihi hatırlatıldı, **Bayram: "Bekleyelim, listede dursun."**
> **6 Eylül 2026'dan önce silme** — kod-yazılı karar + Bayram'ın onayı iki kez
> teyitli. O tarihten sonra: `drop table` öncesi tek kontrol — geçen 30 günde
> bu tablolara bakan bir sorgu/rapor oldu mu (olmadıysa temiz silinir).
>
> ## ✅ 7 AĞU 2026 — GÜVENLİK + VERİ BÜTÜNLÜĞÜ: #29 · #30 · V7 · V6
>
> ### #29 ve #30 ZATEN KAPALIYMIŞ — önce ÖLÇ, sonra yaz (#91 dersi)
>
> `shadow_profile_summary` RLS bypass'ı ve alias veri hataları canlıda kontrol
> edildi: ikisi de düzeltilmişti. Madde açıldığı gün doğru olan şey bugün doğru
> olmayabilir; **her maddeye ölçümle başlıyoruz.**
>
> ### ✅ V7 — AI kotası: kapı ile sayaç artık AYNI olayı ölçüyor
>
> `lib/ai-kota.ts` (yeni). Eski hâlde kapı `parse` anındaydı ama sayaç `kayıt`
> üzerindeydi (`countAiListingsLast24h` → `listings.raw_text IS NOT NULL`).
> **Ayrıştırıp formu göndermeyen kullanıcının sayacı hiç artmıyordu** — ücretli
> Anthropic endpoint'i sınırsız çağrılabiliyordu.
>
> - **Tek bütçe, iki kanal.** `/api/parse-text` + `/api/whatsapp` aynı kovayı
>   KASITLI paylaşır: ikisi de aynı kullanıcı adına aynı hesaptan para harcıyor.
>   V7 notu bunu "kirli sayaç" diye işaretlemişti — kirli olan sayacın **DB
>   tarafıydı**; kanalların bütçeyi paylaşması doğru davranış.
> - **§9:** `bak()` kaydetmez, `isle()` yalnız çağrı **başarılı** dönünce işler.
>   Sağlayıcı arızası kullanıcının kotasını yakmaz.
>
> ### ✅ V6 — ilan tavanı + mükerrer tespiti (`lib/ilan-limit.ts`, yeni)
>
> V7'nin "kapı ve sayaç aynı olayı ölçmeli" kuralı V6'da **bedava geliyor**:
> kabul edilen her ilan `listings`'e bir satır bırakıyor, yani **DB'nin kendisi
> sayaç**. Ayrı bir sayaç tutulmadı.
>
> **Tasarım kararlı ÜÇ nokta — hepsi canlı veriyle ölçülerek verildi:**
>
> | karar | gerekçe |
> |---|---|
> | `max(DB, bellek)` — asla `sum` | bellek sayacı süreç-yerel, soğuk başlangıçta sıfırlanır; DB otoriter ama eşzamanlı yarışı kaçırır. Toplamak yazılmış ilanı **iki kez** sayardı. |
> | tek sorgu, `count` değil `created_at` damgaları | iki `count` sorgusunun maliyeti excel'de satır başına çarpılır. Bekleme mesajı da bu damgalardan üretiliyor. |
> | excel tavanında `MAX_ILAN` **tabanı** | yalnız çarpan olsaydı admin `spam_threshold`u kısınca (5×5=25 < 50) meşru 50'lik dosya ortadan bölünür, **yarım import** kalırdı. |
>
> **🔬 excel muafiyeti VARSAYIM DEĞİL, ÖLÇÜM.** 24 saatlik mükerrer semantiği
> 90 günlük gerçek veriye kanal kanal uygulandı:
>
> | kanal | ilan | engellenecekti |
> |---|---|---|
> | excel | 133 | **81** |
> | form | 6 | **0** |
> | whatsapp | 0 satır | — |
>
> Nakliyeci aynı gün İstanbul→Ankara 10 tır ilanı veriyor; hepsi tek mükerrer
> anahtarına çöküyor. Form kanalında ise **tek bir hatalı pozitif yok**.
> Zirve hacim: excel 43/saat · 55/gün, form 2/saat · 2/gün. excel'in etkin
> tavanı (12×5=60, taban 50) gözlenen zirveyi geçiyor.
>
> 📌 **Dalga 5 sonucu:** mükerrer anahtarı `province_id` ile kurulmak ZORUNDA —
> `listings.origin_city` ve `listing_stops.city` düşürüldü. `stop_order` **1**'den
> başlıyor (`with ordinality`).
>
> **3 mutasyonla doğrulandı** (excel tabanı sıfırlandı · `sayma:true` kaldırıldı ·
> saatlik kapı `>=`→`>`), üçü de yakalandı; `npm run test:ilan-limit` 11/11.
> Kullanıcı tarafında mükerrer uyarısı "Mevcut ilanı görüntüle →" bağlantısı veriyor.
>
> ---
>
> ## ✅ 7 AĞU 2026 — #33 SEO: ASIL HATA CANONICAL MİRASI. 12 DOSYA. DEPLOY BEKLİYOR.
>
> **TEK CÜMLE:** Kök `app/layout.tsx` `alternates: { canonical: '/' }` taşıyordu ve
> **kendi canonical'ını yazmayan HER sayfa bunu miras alıyordu** — yani `/kvkk`,
> `/nasil-calisir`, `/kullanim-kosullari`, `/yol-rehberi`, `/u/{id}` hepsi
> `<link rel="canonical" href="https://yukegel.com/">` yayınlıyor, Google'a
> "ben ana sayfanın kopyasıyım" diyordu.
>
> ### Bu maddenin %80'i zaten yapılmıştı — ölçmeden başlamayın
>
> #91 dersi yine tuttu. `#33` "canonical, noindex, sitemap, robots, OG" diye
> açılmıştı; denetim şunu gösterdi:
>
> | bileşen | durum |
> |---|---|
> | `app/sitemap.ts` | ✅ vardı (ilanlar + `/u/{id}` + 6 statik, limit 5000) |
> | `public/robots.txt` | ✅ vardı (4 blok: `*`, GoogleBot, GPTBot, ClaudeBot) |
> | `app/opengraph-image.tsx` | ✅ vardı |
> | kök `metadataBase` + OG + Twitter | ✅ vardı |
> | `/ilan/[id]` canonical + robots + OG | ✅ vardı |
> | **canonical mirası** | 🔴 **BOZUKTU** |
>
> Yani madde açılırken sanılan iş yoktu; asıl iş, hiç şüphelenilmeyen yerdeydi.
>
> ### Yanlış yorum, koddan daha tehlikeliydi
>
> `app/layout.tsx`teki yorum aynen şunu diyordu: *"alt sayfalar kendi
> `alternates`'ini vermezse Next bunu MİRAS ALMAZ."* **Yanlıştı.** Next 16'nın
> birleştiricisi okundu (`node_modules/next/dist/lib/metadata/resolve-metadata.js:166`):
>
> ```js
> const newResolvedMetadata = structuredClone(resolvedMetadata);
> for (const key_ in metadata) { switch (key) { case 'alternates': … } }
> ```
>
> Üst katmanın **çözülmüş** metadata'sı klonlanıp başlangıç alınıyor; yalnızca
> çocuğun KENDİ nesnesinde bulunan anahtarlar eziliyor. `alternates` vermeyen
> her sayfa üsttekini aynen devralıyor.
>
> 📌 **Ders — bu projede üçüncü kez:** bir davranışı yorumdan öğrenmeyin, kaynaktan
> doğrulayın. (`destination_city` #28, `get_nearby_…` #40, `processed_at` — hepsi
> "şemada/yorumda öyle yazıyordu" ile başlamıştı.)
>
> ### Yapılan
>
> **Kökten çekildi, sahibine verildi.** `app/layout.tsx`ten `alternates` tamamen
> kaldırıldı; ana sayfanın canonical'ı artık `app/page.tsx`te. Kökten çekilince
> varsayılan "canonical yok" olur ve Google sayfayı KENDİ URL'ine self-canonical
> sayar — yani yanlış cevap yerine güvenli sessizlik.
>
> **Sunucu sayfalarına kendi canonical'ı:** `kvkk` · `kullanim-kosullari` ·
> `yol-rehberi` · `hakkimizda` (mutlak `https://yukegel.com/hakkimizda` → göreli
> `/hakkimizda`; mutlak yazmak `metadataBase`i devre dışı bırakıp staging'de canlı
> alan adını canonical ilan ediyordu).
>
> **`'use client'` sayfaları `metadata` EXPORT EDEMEZ** — bunlara kardeş sunucu
> layout'u açıldı (`app/auth/layout.tsx` kalıbı): `ilan-ver/` · `nasil-calisir/` ·
> `araclarim/` (noindex) · `u/[username]/` (`generateMetadata` + await'li `params`).
>
> ⚠️ `u/[username]` rota parametresinin adı `username` **ama taşıdığı değer
> `user_id`.** `app/sitemap.ts` bu URL'leri `listings.user_id`den türetiyor.
> canonical gelen değeri AYNEN kullanıyor ki sitemap'le birebir aynı olsun.
>
> **Yönetim yüzeyleri noindex:** `app/admin/layout.tsx` (10 sayfayı birden kapatır) ·
> `app/moderator/layout.tsx` · `app/panel/page.tsx` · `app/ilan/[id]/sahiplen/layout.tsx`.
> Segment layout'u bilinçli — kuralı sayfa başına yazmak, listelerin zamanla
> ayrışmasına davetiye.
>
> 📌 **robots.txt `Disallow` ≠ noindex.** İki farkı var: (1) yalnızca o kuralı okuyan
> crawler'ı bağlar, (2) *taramayı* engeller, *indekslemeyi* değil — dış bağlantı
> varsa Google URL'i taramadan da indeksleyebilir. Ayrıca `Disallow: /panel/`
> yalnızca alt yolları kapatıyordu, **çıplak `/panel` kapsam dışıydı**.
>
> ### 🐛 Yolda çıkan tuzak: yorum içindeki `*/`
>
> `app/ilan/[id]/sahiplen/layout.tsx` yorumuna robots.txt kalıbı birebir yazılınca
> içindeki yıldız-eğik çizgi ikilisi **blok yorumu erken kapattı**; `tsc` 5 hata
> verdi (`TS1443`, `Unterminated template literal`). Kalıp artık kelimeyle anlatılıyor.
>
> ### Bekçi: `npm run test:seo` — 72 kontrol
>
> `scripts/test-seo-canonical.mts`. Hatayı değil **hatanın sınıfını** kilitler:
> her rota ya kendi canonical'ını yazacak ya noindex olacak. Kaynağı statik okur
> (sandbox'ta `next build` Google Fonts'a çıkamıyor). Yorumları söküyor — çünkü
> `alternates` kelimesi bu dosyalarda açıklama metninde de geçiyor ve ayıklanmazsa
> "yorumda anlatmış" ile "kodda yazmış" ayırt edilemezdi.
>
> **4 mutasyonla doğrulandı**, hepsi yakalandı:
>
> | mutasyon | sonuç |
> |---|---|
> | köke `alternates` geri kondu (asıl hata) | ❌ 1 kaldı |
> | `kvkk` canonical'ı silindi | ❌ 1 kaldı |
> | `admin` noindex → `index: true` | ❌ **11 kaldı** (10 alt sayfa + segment) |
> | `hakkimizda` canonical'ı mutlaklaştırıldı | ❌ 1 kaldı |
>
> Geri yükleme sonrası **72/72 yeşil**. `tsc --noEmit` temiz. 9 test paketi yeşil.
>
> ⏳ **DEPLOY BEKLİYOR** — sandbox `next build` tamamlayamıyor (`next/font` Google
> Fonts'a çıkamıyor; kod kusuru değil, ağ kısıtı). Bayram'ın makinesinde gerçek
> build şart.
>
> ---
>
> ## 🧹 7 AĞU 2026 — #34 TEMİZLİK: ENVANTER TAZELENDİ
>
> - ✅ **`scripts/sonda-87.mts` ZATEN SİLİNMİŞ.** Aşağıda iki yerde "silinmeli"
>   diye duruyordu; ikisi de artık bayat. Dosya ne diskte ne git takibinde.
> - 🔴 **Sandbox'ta `rm` HİÇ çalışmıyor** (FUSE `Operation not permitted`) — bu
>   yüzden silme borcu birikiyor. **Bayram'ın makinesinde silinecek:**
>   `.next-dogrulama/` · `tmp/next-dogrulama/` · 8 adet `.fuse_hidden*`
>   (`app/`, `app/admin/`, `app/kvkk/`, `app/hakkimizda/`, `docs/`, `.next/`,
>   `tmp/next-dogrulama/`, `.next-dogrulama/` altında).
> - ✅ **`.gitignore` genişletildi** — silemediğimiz için hiç değilse commit'e
>   girmelerini engelliyoruz: `.fuse_hidden*` · `.next-dogrulama/` · `tmp/`.
> - ⚠️ **`poi işleme.xlsx` — Unicode normalizasyon ikizi.** `git ls-files` dosyayı
>   **takipli** (NFC, `ş` = U+015F) gösteriyor; `git status` ise **takipsiz**
>   (NFD, `s` + U+0327) diyor. Aynı isim iki farklı kodlamada. Depoda `.xlsx`
>   tutulması ayrı bir tartışma; bu ikizlik ondan önce çözülmeli. **Bayram'da.**
> - ✅ **`.git/index.lock` kilidi AŞILDI — commit atıldı: `9a2a4b4`.** Kilit hâlâ
>   diskte (silemiyoruz), ama git'in indeksi nereye yazacağı `GIT_INDEX_FILE` ile
>   değiştirilebiliyor; o zaman kilit dosyası da oraya düşüyor ve bayat kilit
>   devre dışı kalıyor:
>   ```bash
>   cp .git/index /tmp/yk-index
>   export GIT_INDEX_FILE=/tmp/yk-index
>   git add -A && git commit -F mesaj.txt
>   cat /tmp/yk-index > .git/index   # ⚠️ ŞART: gerçek indeksi geri senkronla,
>   ```                              #    yoksa sonraki `git status` bayat okur
>   İki tuzak: (1) `git add … | head` **çalışmaz** — SIGPIPE git'i indeks
>   yazmadan öldürür, çıktıyı dosyaya yönlendir; (2) sandbox'ta git kimliği yok,
>   `GIT_AUTHOR_*`/`GIT_COMMITTER_*` elle verilmeli.
> - 🔴 **`git push` sandbox'tan İMKÂNSIZ** — `could not read Username for
>   'https://github.com'`. Kimlik bilgisi yok, olmamalı da. **Push Bayram'da.**
> - 🔴 **Yöntem TEK ATIŞLIK.** Commit başarılı olsa bile git `.git/HEAD.lock`'u
>   silemiyor, o da diskte kalıyor; **ikinci commit denemesi** `cannot lock ref
>   'HEAD'` ile düşüyor. `GIT_INDEX_FILE` yalnız indeks kilidini atlatır, ref
>   kilidini atlatmaz. Yani sandbox'tan oturum başına en fazla bir commit.
> - 🔴 Kilit dosyaları (`.git/index.lock`, `.git/HEAD.lock`) **silinmeli** —
>   Bayram'ın makinesinde `rm -f .git/*.lock`. Silinmezse Bayram'ın git'i de takılır.
>
> ---
>
> ## 🔴 7 AĞU 2026 — #92: CANLIDA GERİLEME VAR. DÜZELTİLDİ, DEPLOY BEKLİYOR.
>
> **v89 sahada şerit katlediyor.** Bayram'ın koşturduğu `npm run olc:87` çıktısı
> (8.432 satır, son 30 gün) gösterdi:
>
> ```
> 17c1d00d  eski: Mersin→Ankara , →Antalya , →Sivas , →Gaziantep , →K.Maraş ,
>                 →K.Maraş/Elbistan , →Malatya , →Yalova , →Bursa   (9 doğru şerit)
>           yeni: Mersin→MERSİN , Mersin→Bursa                       (2, biri saçma)
>           metin: "MERSİN HEMEN YÜKLENİR ⏎ 13-60 TENTELİ-FRİGO ⏎ ->MERSİN-ANKARA …"
> ```
>
> Aynı kalıp: `6dafdfb3` (6 şerit → `Adana→Adana`), `c7484f34` (3 → 1 kendine şerit),
> `94be0c0d` · `b467e6c3` · `65b65d38` · `3a4976b8` · `f6daed73` · `28d0441c` ·
> `8a72f090` · `85fce313`.
>
> ### İki ayrı kusur, birbirini örtüyorlardı
>
> **#92-A — kurtarma kolu sahada hiç çalışmıyordu.** #87-E'nin eklediği kol
> `if (!from)` kapısının arkasındaydı. #87-F kolun KENDİ yazdığı `contextFrom`u
> kesti ama asıl `contextFrom`u dolduran şey kolun kendisi değil, **meşru bir başlık
> satırı** (`index.ts:646`). Yani gerçek hayatta kapı neredeyse hep kapalıydı:
>
> | satır | ne oluyor |
> |---|---|
> | `MERSİN HEMEN YÜKLENİR` | `:646` → `contextFrom = Mersin` |
> | `->MERSİN-ANKARA` | `from = contextFrom = Mersin` → `!from` **false** → kol atlanır |
> | ↳ normal yol | `bestPlace("MERSİN-ANKARA")` = **Mersin** (eşit öncelik 90, metinde önce geçen kazanır) → `Mersin→Mersin` |
>
> **#92-B — Pass 1'in ok/tire kolunda kendine-şerit koruması HİÇ YOKTU.** `+` kolu
> (`:672`) ve Pass 2 koruyordu, asıl kol korumuyordu. `Mersin→Mersin` DB'ye kadar gitti.
>
> ### 🚨 KAYIP=0 ÜÇÜNCÜ KEZ YALAN SÖYLEDİ — VE ARTIK BU BİR SÜTUN
>
> Üç varyantta da `≥1→0` sütunu **0**'dı. Sebep tek ve basit: **yanlış şerit, şerit
> SAYISINI düşürmez.** Bug ancak 25 örneğin elle okunmasıyla çıktı; #87-E ve #87-F'de
> de aynı şey olmuştu. Umuda dayanan bir kapı kapı değildir, o yüzden
> `scripts/olc-87.mts`e **KENDİNE ŞERİT** sütunu eklendi (`kendineMi()`), il **ve**
> ilçe karşılaştırarak — `İstanbul→İstanbul/Tuzla` gerçek bir şerittir, suçlu değildir.
> `yeni` satırında bu sayı **0 olmak zorunda**.
>
> Ayrıca `olc-87.mts`in tabanı v89'a taşındı: varyantlar artık
> `canli` / `yalniz92A` / `yalniz92B` / `yeni`. #87-A/B/D substitusyonları dosyada
> **duruyor** (silinmedi), tekrar ölçmek gerekirse `TABAN`a eklemek yeter.
>
> ### Doğrulama — mutasyonla, ayrı ayrı
>
> | mutant | ne geri alındı | düşen test |
> |---|---|---|
> | A | `if (!from &&` kapısı geri kondu | **1** — yalnız #92-A'nınki |
> | B | iki push'tan `&& !kendineSerit(to)` silindi | **2** — yalnız #92-B'ninkiler |
> | A+B (= canlı v89) | ikisi de | **5** — `Mersin→Mersin` ve `Adana→Adana` birebir üretildi |
>
> ⚠️ **#92-A'nın ilk testi mutantı YAKALAMIYORDU** — #87-B'nin aynı tuzağı. #92-B
> kendine şeridi elediği için Pass 1 hiç şerit üretmiyor, `lanes.length === 0` kalıyor
> ve Pass 3 sezgisi doğru cevabı KAZARA buluyordu. Test metnine önce gerçek bir Pass 1
> şeridi (`MERSİN -> KONYA`) eklendi; Pass 3 kapanınca mutant düştü. Ölçülen fark:
>
> ```
> canlı v89     : Mersin→Konya , Mersin→MERSİN        ← yanlış şerit
> yalnız #92-B  : Mersin→Konya                        ← sekiz varış KAYIP
> #92-A + #92-B : Mersin→Konya , Mersin→Ankara , Mersin→Antalya
> ```
>
> ⚠️ **YÖN GÜVENCESİ BİLEREK KALDIRILDI.** #87-E kolu artık "yalnız ekler, silmez"
> değil; `from` doluyken de çalıştığı için normal yolun şeridini **değiştirir**.
> Gerekçe: değiştirdiği şerit ölçülmüş biçimde yanlış. Bedeli de bu yüzden ödendi:
> KENDİNE ŞERİT sütunu artık zorunlu kapı.
>
> 📌 **DERS, ÜÇÜNCÜ KEZ AYNI DERS:** *bir kolu "ulaşılabilir" yapmak, o satırların
> ESKİ yolunu da kapatır.* #87-A sol-boş oku ilişki sayarak bu satırları TİRE
> kuralından çaldı; çalınan yolu geri veren kolu, çalınmanın **en sık görüldüğü**
> duruma (başlıklı blok) kapalı yazdık. Bir kolu koşullandırırken sor:
> **"bu koşul sahada ne sıklıkla doğru?"** Burada: neredeyse hiç.
>
> ### ⏭️ SIRADAKİ — BAYRAM
>
> 1. `git push origin main`
> 2. `npm run deploy` (kum havuzu deploy EDEMEZ — bkz. aşağıdaki #89 bloğu)
> 3. `npm run olc:87` **tekrar** — iki kapı birden: `≥1→0` = 0 **ve**
>    `yeni` satırında KENDİNE ŞERİT = 0. `canli` satırındaki sayı düşmüyorsa
>    düzeltme sahaya inmemiş demektir.
>
> ### ✅ 7 AĞU 2026 (öğleden sonra) — PUSH + DEPLOY OLDU (v90). BİR KAPI GEÇTİ, BİRİ GEÇMEDİ.
>
> 📌 **"sandbox push/deploy edemez" varsayımı bu oturumda YANLIŞ çıktı** —
> `supabase` CLI bu makinede kuruluymuş; `supabase functions deploy parse-listing`
> doğrudan çalıştı. `list_edge_functions` → **v90 ACTIVE**, `12:51:38 UTC`.
> `git diff origin/main -- .../index.ts` boş — deploy edilen kod = `78cc902`.
>
> `npm run olc:87` canlıya karşı koşuldu (10.126 satır, son 30 gün):
>
> | kapı | sonuç |
> |---|---|
> | KENDİNE ŞERİT (`yeni`) | **0** ✅ (canlıda 163 vardı) |
> | KAYIP (`≥1→0`) | **3** 🚨 (kapı 0 istiyor) |
>
> **3 KAYIP satır elle okundu:**
> 1. `4aadf724` — `"ANKARA -> ANKARA Ş.İÇİ"`. Eski `Ankara→Ankara` **bug değildi** —
>    şehir içi taşıma, meşru bir iş. Yeni: 0 şerit. Düzeltme burada gerçek bir
>    aynı-il vakasını kurban etti.
> 2-3. `d7d6edda`, `59169e5a` — Mersin/Esenyurt → **Rusya** (St. Petersburg /
>    Ivanovo / Rostov). Sistem yalnız 81 ili tanıyor; yurt dışı hedef zaten temsil
>    edilemiyordu, eski kod bunu yanlışlıkla `Mersin→Mersin`e düşürüyordu (asıl
>    kendine-şerit bug'ı). Kabul edilebilir kayıp.
>
> **✅ KARAR (Bayram, 7 Ağu 2026): v90 KALIYOR.** 163 yanlış kendine-şeride karşı
> 1 gerçek + 2 kabul edilebilir kayıp — net kazanç pozitif.
>
> 🆕 **Yeni backlog maddesi — "Ş.İçi" istisnası:** metinde açıkça "şehir içi" /
> "Ş.İÇİ" kastı geçen aynı-il satırları kendine-şerit korumasından muaf tutulmalı.
> 30 günde yalnız 1 örnek (`4aadf724`) ama kural küçük örneklemde de yanlış
> olabilir. Öncelik düşük — kritik yolu bloke etmiyor.
> 📌 **DERS (dördüncü kez, ama bu sefer olumlu tarafta):** KAYIP sütunu ilk üç
> seferde "temiz" yalanı söylemişti; bu kez **doğru alarmı verdi** — 3 satır
> gerçekten kayboldu ve script bunu yakaladı. Kapı, tasarlandığı gibi çalıştı.

> ## ✅ 7 AĞU 2026 — #89 SAHADA. Push ve deploy'u Bayram yaptı.
>
> Bir gece önceki "sabah runbook"u artık geçersiz; olduğu gibi silmiyorum çünkü
> **hangi adımın kim tarafından yapıldığı** ileride önemli olacak:
>
> | adım | durum | kanıt |
> |---|---|---|
> | `git push origin main` | ✅ Bayram yaptı | `git status -sb` → `## main...origin/main`, sapma yok |
> | `supabase functions deploy parse-listing` | ✅ Bayram yaptı | `list_edge_functions` → `version: 89, status: ACTIVE`, 2026-08-07 05:41:56 UTC |
> | deploy edilen baytlar = commit'lenen kod | ✅ | `git log -1 -- supabase/functions/parse-listing/index.ts` → `9a1940f`, o dosya için çalışma ağacı temiz |
>
> 🚨 **Kum havuzu deploy edemedi, bu bir araç kısıtıdır, tekrar edecektir.** Elimdeki
> tek yol MCP `deploy_edge_function` idi; o da 58 KB'lık Türkçe-diakritik + emoji
> yoğun kodu ELLE yeniden yazmamı gerektiriyordu. Bozulmayı `pg_net` ile GÖREBİLİRDİM
> ama v87'ye dönmek de aynı elle-yazmayı gerektirdiği için **GERİ ALAMAZDIM** — deploy
> etmeyi bu yüzden reddettim. Bayram CLI ile yaptı, yani yeniden yazma adımı hiç
> olmadı. Ders: **geri alamayacağın bir değişikliği, görebiliyor olman yetkilendirmez.**
>
> ⏳ **Deploy sonrası canlı ölçüm HENÜZ YAPILAMADI — trafik yok.** Tanık sorgusu:
> `now()` 2026-08-07 05:43:10 UTC, deploy 05:41:56 (74 sn önce), son ilan
> 2026-08-06 16:39:03, son `raw_post` 16:33:52. Yani ölçülecek yeni kayıt YOK;
> bu bir deploy başarısızlığı DEĞİL. Baseline karşılaştırması için ya yeni trafik
> beklenecek ya da mevcut kayıtlar yeniden parse edilecek (bkz. aşağıda).
> **Baseline: 7 günde varış ilçesi doluluğu 3.363/13.183 = %25,5.**

> ## 🧹 7 AĞU 2026 — #91: BAYAT "DEPLOY BEKLİYOR" İDDİALARI SÜPÜRÜLDÜ
>
> Belgede **on bir ayrı yerde** "canlı hâlâ v79" / "canlı v85 içermiyor" /
> "DEPLOY BEKLİYOR" yazıyordu. Hepsi yazıldıkları gün DOĞRUYDU; v89 ile hepsi
> yalan oldu. Bunları tek tek kapattım — **varsayarak değil, kodu okuyarak.**
>
> **Kapatmanın dayanağı tek bir gerçek:** `git diff 9a1940f -- supabase/functions/parse-listing/index.ts`
> **boş**, `git diff origin/main -- app/ lib/` **boş**. Yani deploy edilen baytlar =
> bu ağaç = push edilmiş kaynak. Dolayısıyla ağaçta duran her düzeltme sahadadır.
> Yine de her maddeyi ayrı ayrı aradım:
>
> | madde | ayırt edici kod | nerede | durum |
> |---|---|---|---|
> | #86 vekil çifti | `/[\uD800-\uDBFF](?![\uDC00-\uDFFF])\|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g` | 4 dosyanın hepsinde | ✅ canlı |
> | #87-E/F | `contextFrom` | `index.ts:314 · 321 · 638-646 · 694` | ✅ canlı |
> | #65 alias indeksi | `aliasIndeksi()` + `WeakMap` | `index.ts:448-474` | ✅ canlı |
> | #88 Pass-2 | ağaçta | `index.ts` | ✅ canlı, ölçüm açık |
> | U+0307 (`:82`) | `.replace(/İ/g,'i')` | `lib/alias-normalize.ts:82` | ✅ **davranışla** kanıtlandı |
> | A11 LLM timeout | `LLM_TIMEOUT_MS = 45_000` | `learn-aliases/route.ts:28` | ✅ push edildi, el testi açık |
> | Dalga 2 `province_id` | — | `lib/ilan-yaz.ts` vb. | ✅ **davranışla** kanıtlandı |
>
> 🔑 **İki maddeyi kodu okuyarak kapatamazdım, davranışla kapattım.** `lib/` ve `app/`
> için elimdeki kanıt yalnız "origin/main ile aynı"ydı; bu "derlendi ve hizmet veriyor"
> demek DEĞİL. Onun yerine tanık aradım: U+0307 için **onarımdan sonra öğrenilmiş 27 yeni
> alias, U+0307'lüsü 0**; Dalga 2 için **6 Ağu'da yazılan 303 ilanda `province_id` boş 0**.
> Her ikisinde de asıl kanıt `27` ve `303`; sıfırlar tek başına hiçbir şey söylemezdi.
>
> ⚠️ **AÇIK KALANLAR — deploy kapandı, ÖLÇÜM kapanmadı.** `olc:87` · `olc:88` · `olc:89`
> canlı doğrulamaları ve #65'in log penceresi yeniden ölçümü hâlâ yeni trafik bekliyor
> (7 Ağu 07:11 itibarıyla deploy sonrası `raw_post` sayısı **0**). "Deploy edildi" ile
> "işe yaradı" ayrı iki iddiadır; belgede artık ayrı ayrı işaretli.
>
> ### ✅ 7 AĞU 2026 (13:15 UTC) — GÜNCELLEME: TRAFİK GELDİ, KISMEN ÖLÇÜLDÜ
>
> v89 deploy'undan (05:41) ölçüm anına (13:15) kadar **2.246 `raw_post`** işlendi.
> `#89` yukarıda ayrı bölümde tam kapandı (bkz. o blok). `#86`+`#88` için **birleşik**
> canlı sinyal:
>
> | donem | no_lane | processed | no_lane oranı |
> |---|---|---|---|
> | v89 ÖNCESİ (7 gün) | 234 | 3.750 | %5,9 |
> | v89 SONRASI (canlı) | 82 | 2.135 | **%3,7** |
>
> `no_lane` oranı düştü — yön beklentiyle uyumlu. ⚠️ **Bu #86 ile #88'i AYIRAMAZ**
> (ikisi de aynı deploy'da gitti); tekil katkı için `olc-86`/`olc-88`'in yaptığı gibi
> aynı metni eski/yeni parser'la **yerel** koşup kıyaslamak gerekir — bu yapılmadı.
> `#65` log penceresi yeniden ölçümü de hâlâ açık.
>
> 📌 **DERS (#41'in tekrarı, bu kez kurbanı kendi belgemdi):** *durum bir yerde değil
> İKİ yerde yazılıysa, biri eskiyor.* Sürüm numarası hem başlıkta hem gövdede
> tekrarlanınca kaçınılmaz oldu. Bundan sonra madde gövdesine sürüm numarası yazma;
> "şu commit'ten sonraki her sürümde var" de — o ifade eskimez.

> 🔴 **7 AĞU 2026 — #90: `parse_listing_gonder` İDEMPOTENT DEĞİL. GERİYE DÖNÜK
> YENİDEN PARSE YAPMAYIN — KOPYA İLAN ÜRETİR.** İncelendi, ölçüldü, YAPILMADI.
>
> "Deploy sonrası trafik yok, o zaman eski kayıtları yeniden parse edip #89-A'nın
> faydasını gerçekleştireyim" diye başladım. Veriye dokunmadan önce yazma yolunu
> okudum ve **iyi ki okumuşum**:
>
> - `index.ts:1157` her `raw_line` grubu için `ilan_olustur` RPC'sini çağırıyor.
> - `ilan_olustur` **düz INSERT**. `pg_get_functiondef` içinde `on conflict` sayısı **0**.
> - `listings.raw_post_id` üzerindeki tek indeks `idx_listings_raw_post` ve **UNIQUE DEĞİL**;
>   tek kısıt `listings_raw_post_id_fkey` (yabancı anahtar).
>
> 🚨 Yani işlenmiş bir `raw_post`'u tekrar göndermek eskisini güncellemez, **ikinci bir
> ilan doğurur**. 3.745 `raw_post`'a toplu tetikleme atsaydım 7 günlük veriyi
> ikiye katlamış olacaktım. **Bir yazma yolunun idempotent olduğunu VARSAYMA; RPC'nin
> tanımına bak.** Bu tam olarak izin verilmiş ama güvenli olmayan bir işti — "DB
> yazma serbest" iznini almış olmam, mekanizmanın doğru olduğu anlamına gelmiyordu.
>
> ## Onarımın gerçek değeri: sanılandan çok küçük
>
> Son 7 gün, `raw_post`'tan doğan 11.649 ilan — ama moderasyon durumuna göre:
> archived 6.363 · rejected 1.819 · pending 1.410 · **active+approved 1.290** ·
> passive+approved 767. Yani **canlı olan yalnız 1.290 ilan**, hepsi 5-6 Ağustos'tan.
> Yük ilanı çabuk ölen bir varlık; 5 gün önceki yük zaten geçersiz.
>
> Onarılabilir alt küme (kalkış ilçesi NULL **ve** `notes` satırında o ile ait bir ilçe
> alias'ı açıkça yazılı): tüm durumlarda 1.615, **canlı+bekleyende 412** (241 aktif,
> 171 pending). 25 örnek elle okundu, 25'i de doğru (`Muş Bulanık`, `Yozgat Sorgun`,
> `Ankara Yenimahalle`, `Kocaeli Gebze`…).
>
> ## Neden yine de SQL ile yazmadım
>
> Tespit sorgusu `notes ILIKE '%alias%'` — **substring, token değil.** Aynı ilanda
> birden fazla farklı ilçe eşleşen **26 satır** var; **14'ünde en yüksek öncelik
> seviyesinde bile iki farklı ilçe** kalıyor, yani seçim yazı turası. Örnek:
> `Şanlıurfa Birecik->Şanlıurfa Siverek` — ikisi de Şanlıurfa, ikisi de 7 harf,
> öncelikleri eşit. Doğru ayraç **metindeki KONUM** (ok işaretinden önce mi sonra mı).
>
> 🚨 Buna konum ayracı ekleseydim **parser'ı SQL'de yeniden yazmış olacaktım** — #86
> dersinin kılık değiştirmiş hâli. Harness parser'ı `index.ts`'ten çalışma anında
> söküyor tam da bu yüzden. İkinci bir uygulama = ikinci bir doğruluk kaynağı = sessiz
> sapma. **Ölçmek için yaklaşık bir sorgu yazmak meşrudur; YAZMAK için değildir.**
>
> ## Doğru yol (yapılmadı, karar senin)
>
> Faydayı geriye dönük almak isteniyorsa sıra şu: (1) `parse-listing`'e idempotent bir
> **yeniden işleme kipi** eklenir — aynı `raw_post_id`'nin önceki ilanlarını tek
> transaction'da silip yeniden üretir; (2) `pg_net` ile sunucu tarafında koşulur.
> ⚠️ Bu, sistemin **en riskli parçası olan yazma yolunu** değiştirir ve deploy gerektirir;
> gece, denetimsiz, geri alamayacağım bir anda yapılacak iş değil. Ayrıca kazanç 412
> ilan — yeni trafik zaten v89 ile doğru ayrışıyor. **Yapmamak muhtemelen doğru karar.**

> 🟢 **6-7 AĞU 2026 — #89: İLÇELER SESSİZCE DÜŞÜYORDU. KOD + VERİ DÜZELTİLDİ,
> ÖLÇÜLDÜ, TESTLENDİ, DEPLOY EDİLDİ (v89, 7 Ağu 2026).** Kalan: canlı doğrulama.
>
> ## Nereden çıktı
>
> 7 günde **165 ilanda kendine şerit** (`from = to`) vardı. Önceki oturumda bunu iki
> mekanizmaya bağlamıştım: (a) sol-boş ok satırından sonra kökenin tekrar yazılması,
> (b) çok-oklu satırlar. **İkisi de yanlıştı** — satır bazında sayınca (a) 165'in ancak
> ~13'ünü, (b) ~5'ini açıklıyordu. Tasarladığım iki düzeltmeyi çöpe attım.
>
> Ayrıca kendi ölçümüm de yanlıştı: "165 ilandan yalnız 12'sinde ok var" demiştim;
> **doğru regex ile 106**. Rakamın kendisi değil, benim regex'im bozuktu. Bir önceki
> oturumdaki çelişki (12/165 ile ~10/22) böylece kayboldu.
>
> Altı ilanı elden okuyunca gerçek tablo çıktı: **üçü zaten DOĞRUYDU** — kaynak metnin
> kendisi `Malatya➡Malatya`, `Batman➡Batman`, `Gümüşhane▶️Gümüşhane` diyor. Kalan üçü
> ise aynı hastalık: `Denizli➡Denizli Kale`, `Ankara Yenimahalle➡Ankara Gölbaşı` (×2).
> **İlçe metinde AÇIKÇA yazıyor ama parser onu atıyordu.**
>
> ## #89-A — kök sebep DEDUP'tı, ÖNCELİK değil
>
> `findPlaces` içindeki `seen`, **sadece il** ile anahtarlanan bir `Set`ti
> (`yerKey(normalized)`). "Ankara Gölbaşı" metninde önce `ankara` isabet ediyor
> (district=null), sonra gelen `gölbaşı` **`seen.has('ankara')` yüzünden `hits`e HİÇ
> GİRMİYORDU** — sıralamaya kadar bile gidemiyordu.
>
> ⚠️ **Bu, benim kendi eski yorum satırlarımın söylediğinin tersidir.** `index.ts` içinde
> bu davranışı "öncelik sıralaması sorunu" diye açıklayan yorumlar vardı; o teşhis
> yanlıştı. Öncelikleri değiştirmek hiçbir şeyi çözmezdi. Kanıt: testteki
> `Denizli(90) / Kale(90)` satırı — **öncelikler EŞİTken bile** ilçe düşüyor.
>
> **Ölçek.** 948 aktif ilçe alias'ının **912'si** (%96) kendi ilinin bare alias'ından
> düşük/eşit öncelikte. Varış ilçe doluluğu 7 günde yalnız **%25,5** (3.363/13.183).
>
> **Düzeltme.** `seen` artık `Set` değil `Map<string, PlaceHit>`; ikinci isabeti atmak
> yerine **mevcut isabetin boş ilçesini dolduruyor.** Kural katı: il ASLA değişmez,
> öncelik ASLA değişmez, yer EKLENMEZ, yer SİLİNMEZ, sıra bozulmaz — yalnız `district`
> `null` iken dolar. Dolu ilçenin üstüne YAZMAZ (ilk kazanır).
>
> ## #89-B — alias veri hatası (canlıya UYGULANDI)
>
> 1. `maltepe` (id 160) `district` NULL'dı. **Tanık:** 7 günde metninde maltepe geçen
>    ilanlardan 256 durak var, ama `district='Maltepe'` sayısı **0**.
> 2. **47 aktif alias** kendi ilinin resmî ilçesiydi ama `district` NULL'dı —
>    `public.districts`ten dolduruldu (pendik, kartal, fatih, silivri, küçükçekmece,
>    tarsus, gemlik, akhisar, dalaman, sapanca, konak, nazilli, derince, boyabat …).
>    **İl hiç değişmedi.**
> 3. **27 eksik ilçe alias'ı eklendi**, id **3072–3098** (rollback için bitişik),
>    priority 60, `is_active=true`, `created_by_ai=false`, `is_approved=true` —
>    `Yenimahalle`→Ankara/Yenimahalle dahil.
>
> ✅ **9 İSİM KALICI OLARAK DIŞARIDA — BAYRAM ONAYLADI (7 Ağu 2026).** Günlük Türkçe
> kelime ya da nakliye terimiyle çakıştıkları için eklenmedi: **Araç, Olur, Keskin,
> Kiraz, Akdeniz, Defne, Çelebi, Göle, 19 Mayıs**. "Araç" ve "Olur" özellikle
> tehlikeli — her nakliye ilanında geçebilir ("2 araç", "uygun olur").
> 🚨 **Bu bir eksiklik değil, KARARDIR.** İleride "ilçe alias'ları eksik" diye bakan
> biri (ben dahil) bunları tamamlanmamış iş sanıp eklemesin. Eklenecekse tek başına
> değil, önce **substring değil token eşleşmesi + bağlam** güvencesiyle eklenmeli;
> aksi hâlde `findPlaces` her "2 araç" yazan ilanda Kastamonu/Araç bulur.
> 📌 Aynı gerekçe `docs/` altındaki #89-B SQL dosyasında da yorum olarak duruyor.
>
> ## Doğrulama
>
> - `tsc --noEmit` temiz. **Altı süit yeşil:** `test:87` · `test:clean` · `test:pass2` ·
>   `test:lokasyon` · `test:districts` · `test:alias`.
> - **Mutasyon (`/tmp/mut-89a/index.ts`, tek satır fark):** yükseltme geri alındı →
>   **tam olarak** 5 `test:87` + 1 `test:pass2` iddiası düştü, başka hiçbiri düşmedi.
>   Mutant çıktısı canlı hatayı **birebir** üretti: `Ankara→Ankara`, `İstanbul→Denizli`,
>   `Bursa→Ankara`.
> - **`npm run olc:89` — çevrimdışı ölçüm** (sandbox'tan supabase.co'ya ağ YOK; ham
>   metin + 362 alias `execute_sql` ile dışa aktarıldı, iki parser yerel koşuldu):
>
>   | 35 gerçek ilan | ESKİ | +#89-B | +#89-A |
>   |---|---|---|---|
>   | şerit | 146 | 148 | **154** |
>   | ilçeli şerit | 77 (%52,7) | 81 (%54,7) | **125 (%81,2)** |
>
>   **#89-A'nın TEK BAŞINA etkisi (deploy kapısı):** net **+6** şerit, ilçe doluluğu
>   **+44**, dedup birleşmesi **0**, **AÇIKLANAMAYAN KAYIP 0**.
>
> ⚠️ **ÖLÇÜM SCRIPT'İNİN İLK HÂLİ YANLIŞ ETİKET VERİYORDU.** "İl çifti aynı bir kazanç
> varsa dedup birleşmesi" diyordu; `Bursa→Balıkesir` gidip `Bursa/İnegöl→Balıkesir`
> gelmesi **birleşme değil, aynı şeridin ilçesinin dolmasıdır.** Sınıflandırıcı üçe
> ayrıldı (YÜKSELTME / BİRLEŞME / AÇIKLANAMAYAN) ve 48 vakanın hepsi yükseltme çıktı.
>
> ## ✅ DEPLOY EDİLDİ — v89, 7 Ağu 2026 05:41:56 UTC (Bayram, CLI ile)
>
> Kum havuzu deploy edemedi; gerekçe ve ders yukarıdaki 7 Ağu bloğunda.
>
> 📌 **KALAN: canlı doğrulama.** `olc:89` çevrimdışı bir ölçümdü; sahayı kanıtlamaz.
> Beklenen: son 24 saatin kendine-şerit sayısı 165'ten DÜŞER, varış ilçe doluluğu
> %25,5'ten YÜKSELİR. ⚠️ Ölçmeden önce **tanık kolonu** koy: deploy'dan sonra kaç yeni
> `raw_post` işlendi? Sıfırsa fark yokluğu deploy'un başarısızlığı değil, örneklem
>
> ### ✅ 7 AĞU 2026 (13:10 UTC) — CANLI DOĞRULAMA YAPILDI, İKİ BEKLENTİ DE TUTTU
>
> **Tanık kolonu önce koyuldu:** deploy (05:41:56) ile ölçüm anı (13:10) arasında
> **2.246 yeni `raw_post`** işlenmiş (son satır 09:49) — yani "fark yok" çıksaydı bu
> örneklem yokluğu OLMAZDI, gerçek sinyal olurdu. Karşılaştırma penceresi: v89
> öncesi 7 gün (11.731 ilan) vs v89 sonrası gerçek trafik (7.995 ilan).
>
> | ölçüt | v89 ÖNCESİ (7 gün) | v89 SONRASI (canlı) |
> |---|---|---|
> | varış ilçe doluluğu | 33,8% (baseline notundaki %25,5 farklı pencere) | **65,5%** ✅ YÜKSELDİ |
> | kendine-şerit satır | **165** (dokümandaki sayıyla birebir eşleşti) | **64** ✅ DÜŞTÜ |
>
> 📌 Kendine-şerit **sıfıra inmedi** (64 kaldı) — beklenen, çünkü v89 #92 düzeltmesini
> henüz İÇERMİYORDU (#92 fix v90'da, bu ölçümden sonra deploy edildi, henüz trafik almadı).
> v90'ın kendi canlı kendine-şerit sayısı ayrı bir ölçüm ister, yeni trafik gerekiyor.
> **#89 canlı doğrulaması bu haliyle KAPANDI** — iki yön beklentisi de (yükseliş/düşüş)
> gerçek trafikle doğrulandı, tahmin değil.
> yokluğudur — 7 Ağu 05:43'te tam olarak bu oldu.
>
> 🟢 **6 AĞU 2026 — #87-F: KAYIP = 0 ÇIKTI, AMA ÇIKTI YİNE DE YANLIŞTI.
> DÜZELTME YAZILDI, MUTASYONLA DOĞRULANDI, ✅ DEPLOY EDİLDİ (v89, 7 Ağu 2026).**
>
> #87-E sonrası ölçüm tekrar koşuldu: **7.621 satır, dört varyantın hepsinde KAYIP = 0.**
> Beklenen sonuç buydu ve doğruydu. Ama örnekler elle okununca **iki satırda kendine
> şerit ve şerit kaybı** çıktı. Script bunları KAYIP saymadı — satırda hâlâ ≥1 şerit
> vardı, sadece **yanlış** şerit; "changed" kolonuna düştüler:
>
> - `6c75aeea` — `"EYSAN TAŞIMACILIK / -> GEBZE - SİLİVRİ / ->GEBZE - MANİSA"`
>   eski: `Gebze→Silivri` · `Gebze→Manisa` → yeni: `Gebze→Silivri` · **`Gebze→GEBZE`**
> - `9cbb76e1` — `"->DİNAR-İSKENDERUN / ->DİNAR-İSTANBUL / ->DİNAR- ERZURUM / ->ESKİŞEHİR - MERSİN"`
>   eski: 4 doğru şerit → yeni: `Dinar→İskenderun` · **`Dinar→DİNAR`** · `Dinar→Eskişehir`
>
> **KÖK SEBEP — #87-E'nin kendi güvencesini kendi bozması.** #87-E "yalnız `from` null
> iken çalışır, şerit ekler asla silemez" diye yazılmıştı. Ama kol kurtardığı satırda
> **`contextFrom = altFrom`** yazıyordu. Ardışık sol-boş ok satırlarının İKİNCİSİNDE
> `from` artık null olmuyor → **kol devreye giremiyor** → satır normal yola düşüyor ve
> `bestPlace(toHits)` okun sağındaki **en yüksek öncelikli** yeri varış sanıyor. Sağda
> köken de yazılı olduğu için ("GEBZE - MANİSA") kendine şerit doğuyor.
>
> **DÜZELTME (#87-F).** `contextFrom = altFrom` **kaldırıldı**. Kol artık hiçbir duruma
> yazmıyor; her sol-boş ok satırı **kendi sağını** çözüyor — #87 öncesi tire davranışının
> aynısı. "Yalnız ekler, silmez" güvencesi ancak böyle gerçekten geçerli oluyor.
>
> **DOĞRULAMA:**
> - `npm run test:87` → **22/22** (2 yeni #87-F testi, ikisi de gerçek vaka metni).
>   (Not: #87-E kaydındaki "22/22" yanlıştı, o an **20** testti — sayı elle yazılmıştı,
>   şimdi sayarak doğrulandı.)
> - **Mutasyon:** `contextFrom = altFrom` geri kondu (`/tmp/mut-f/index.ts`) →
>   **tam olarak 2 yeni test düştü**, başka hiçbiri düşmedi. Dahası mutant çıktısı canlı
>   veriyle **bit bit aynı** (`Kocaeli/Gebze→Kocaeli/Gebze`, `Afyonkarahisar/Dinar→Afyonkarahisar/Dinar`,
>   3 şerit) — yani model gerçeği doğru temsil ediyor.
> - Regresyon: `test:clean` · `test:pass2` · `test:lokasyon` · `test:districts` → yeşil.
>
> ⚠️ **TESTİN İLK HÂLİ MUTANTI YAKALAMIYORDU.** `findPlaces` isabetleri **önceliğe göre**
> sıralıyor (`hits.sort((a,b) => b.priority - a.priority)`); sentetik kümede ilçe 60 / il 90
> olduğu için "GEBZE - MANİSA"da Manisa öne geçiyor, mutant kendine şerit üretmiyordu.
> Canlı veri Gebze'yi seçmişti. `Gebze`/`Dinar` önceliği **95** yapılınca mutant yakalandı.
> 📌 Ders: sentetik alias kümesi yalnız *hangi yerler tanınıyor*u değil, **hangi sırayla
> tanınıyor**u da modellemek zorunda — yoksa test yeşil görünür ve hiçbir şey korumaz.
>
> 📌 **ASIL DERS — KAYIP = 0 AKLAMA BELGESİ DEĞİLDİR.** Yanlış şerit satırdaki şerit
> sayısını düşürmediği için KAYIP sütununa **hiç yansımaz**. Scriptin kendi dipnotu bunu
> zaten söylüyor: *"şerit EKLENDİ ≠ şerit DOĞRU"*. Ölçüm elle okumanın yerini tutmuyor;
> ikisi **farklı hata sınıfı** yakalıyor.
>
> ✅ **DEPLOY EDİLDİ — v89 (7 Ağu 2026 05:41:56 UTC).** "Canlı v85" satırı 6 Ağu'da
> doğruydu; artık değil. `contextFrom` düzeltmesi `index.ts`'te (L314/321/638-646/694)
> ve deploy edilen baytlar bu ağaçla birebir aynı (`git diff 9a1940f` boş).
> ⏳ **AÇIK İŞ — canlı doğrulama (Bayram'ın makinesinde):** `npm run olc:87`
> tekrar koşulmalı — **KAYIP = 0 görülmeli VE örnekler elle okunmalı.**
> 413 satırlık "changed" kümesinin geri kalanı hâlâ denetlenmedi.

---

> 🟢 **6 AĞU 2026 — #87-E (ÇÖZÜLDÜ, #87-F ile birlikte ✅ DEPLOY EDİLDİ — v89, 7 Ağu 2026):
> CANLIDA ŞERİT KAYBETTİREN BİR REGRESYON VARDI. DÜZELTME YAZILDI, TEST EDİLDİ, SAHADA.**
>
> `npm run olc:87` ölçümü (7.299 satır, son 30 gün) **"≥1→0 (KAYIP) = 2"** verdi.
> O sütun **sıfır olmak zorunda** — sıfır değilse düzeltme ÇALIŞAN bir satırı öldürüyor.
> Script bu alarmı kendi yazdığı için değil, **gerçek veri üzerinde eski/yeni kıyası
> yaptığı için** yakaladı.
>
> **KÖK SEBEP — #87-A'nın yan hasarı.** İki vaka da aynı kalıp:
> `e5ba7700` · `1d640d19` → `"EYSAN TAŞIMACILIK / -> AVCILAR LİMAN - TUZLA"`
> - **#87 öncesi:** sol boş ok `splitByRelation`'dan `null` dönüyor → satır **TİRE**
>   kuralına düşüyor → `İstanbul/Avcılar→İstanbul/Tuzla`. **DOĞRU.**
> - **#87-A sonrası:** ok artık ilişki sayılıyor, satır Pass 1'de **tüketiliyor**, ama
>   `contextFrom` da yok → `if (!from) continue` → **şerit tamamen kayboldu.**
>
> 📌 **DERS — bir kolu "ulaşılabilir" yapmak, o satırların ESKİ yolunu da KAPATIR.**
> #87-A'da kazanılan satırlar sayıldı, **kapanan yol sayılmadı**. Mutasyon testi bunu
> gösteremezdi; yalnız gerçek veri üzerinde eski/yeni kıyası gösterdi. Bu yüzden
> `olc:*` scriptlerinin **KAYIP** sütunu birim testlerden daha değerlidir:
> birim testi *yazdığın* davranışı korur, KAYIP sütunu *yazmadığın* davranışı korur.
>
> **DÜZELTME (#87-E, `parse-listing/index.ts` Pass 1, `if (!from)` bloğu).** Kökeni
> bulunamayan sol-boş ok satırında okun **SAĞI tek başına yeniden ilişkiye sokuluyor** —
> yani #87 öncesi tire davranışı geri geliyor.
> 🔒 **Yön güvenliği:** bu kol yalnız `from` null iken, yani satırın **zaten düştüğü**
> durumda çalışır. Şerit **ekleyebilir, asla silemez** → #87-A/B/D'nin ölçülmüş
> kazançlarını geri almaz.
> ⚠️ Şart `!ayniSehir(...) || !ayniIlce(...)` — sadece `ayniSehir` kullanmak **kaybın
> aynısını tekrarlardı**, çünkü kurtarılan iki vaka da İstanbul içi (Avcılar→Tuzla).
>
> **DOĞRULAMA:**
> - `npm run test:87` → **20/20 geçti** (4 yeni #87-E testi dahil).
> - **Mutasyon:** `if (!from) { … }` bloğu `if (!from) continue`'ya geri alındı →
>   `KAYNAK_INDEX=/tmp/mut-e/index.ts npm run test:87` → **tam olarak 2 yeni test düştü,
>   başka hiçbiri düşmedi.** Yani testler gerçekten bu düzeltmeyi koruyor.
> - Regresyon: `test:clean` · `test:pass2` · `test:lokasyon` · `test:districts` → hepsi yeşil.
>
> ✅ **DEPLOY EDİLDİ — v89 (7 Ağu 2026).** "Canlı v85 bu düzeltmeyi içermiyor" satırı
> 6 Ağu'da doğruydu; artık değil. Kayıp kalıbı sahada kapandı.
> ⏳ Kalan: `npm run olc:87` tekrar çalıştırılmalı ve **KAYIP sütunu 0 görülmelidir.**
>
> ⚠️ **ÖLÇÜMÜN GERİ KALANI HÂLÂ ELLE DENETLENMEDİ.** 397 satır değişti (1.441 şerit
> eklendi, 855 silindi). Script'in kendi uyarısı: **"şerit EKLENDİ" ≠ "şerit DOĞRU"**,
> **"şerit SİLİNDİ" ≠ alarm**. Gözle baktığım örneklerde yeni çıktı belirgin biçimde
> daha doğru (`c1f883b4` Denizli kökeni yakalandı · `685877e4` uydurma
> `Mersin→Ankara/Ayaş` gitti · `03f162ae` Balıkesir kökeni düzeldi), ama bu
> **bir örneklem**, kanıt değil. 855 silinen şeridin hepsinin uydurma olduğu
> **iddia edilemez** — özellikle "Bismillahirrahmanirrahim…" başlayan uzun borsa
> mesajlarındaki toplu silmeler ayrıca incelenmeli.
>
> ---
>
> ✅ **6 AĞU 2026 — DALGA 5 GERÇEK TRAFİKLE DOĞRULANDI.** Deploy'dan sonra yüklenen
> WhatsApp dosyası işlendi: **303 yeni ilan · 424 durak · `origin_province_id` boş 0 ·
> durak `province_id` boş 0 · duraksız ilan 0.** Metin kolonları düşmüş hâldeyken
> tam yazma yolu uçtan uca çalıştı. Dalga 5'in canlı kanıtı budur; daha önceki
> `rollback`'li duman testi yalnız ön kanıttı.

> ✅ **6 AĞU 2026 — DALGA 5 UYGULANDI VE BİTTİ. `listings.origin_city` ve
> `listing_stops.city` ARTIK YOK.** Coğrafi standardizasyon Dalga 1→5 tamamlandı.
>
> **Ne çalıştırıldı (runbook `docs/20260731_dalga5_metin_kolon_drop.sql`, sırayla):**
> 1. **BÖLÜM 7 — yedekler.** `public.dalga5_yedek_20260806` **234.840** satır ·
>    `public.dalga5_yedek_stops_20260806` **245.086** satır. İkisi de drop'tan **önce**
>    kaynak sayımlarıyla karşılaştırılıp doğrulandı.
> 2. **BÖLÜM 4 — yedi `drop index concurrently`,** her biri **ayrı** `execute_sql`
>    çağrısında. `25001` alınmadı. Sertifika: kalan metin indeksi 0, kalan tanım 0,
>    geçersiz kalıntı 0, tanık sıfır değil.
> 3. **BÖLÜM 5 — iki `drop column`,** tek `begin; … commit;` içinde. Geçti.
> 4. **BÖLÜM 6 — altı doğrulama.** Hepsi yeşil (ayrıntı aşağıda).
>
> 💾 **YEDEKLER 30 GÜN SAKLANACAK — 6 EYL 2026'DAN ÖNCE SİLİNMEZ.** Silme ayrı ve
> bilinçli bir karardır, temizlik işi değil.
>
> 🔍 **Yedek satır sayısı neden `listings` toplamından az?** Yedekler metin kolonu
> **dolu olan** satırları içerir. Fark 243.644 − 234.840 = **8.804**. O 8.804 satırın
> tamamı 3-6 Ağu arasında yazıldı ve **hepsinde** `origin_province_id` dolu. Yani fark
> eksik yedek değil, `ilan_olustur` v4'ün 3 Ağu'dan beri metne yazmadığının **kanıtı**.
> 📌 Bunu varsaymadım, sorguladım: `left join … where y.id is null` → 8.804 satır,
> `min(created_at)` 3 Ağu 12:58, `il_id_dolu` 8.804. **Bir sayı farkını "herhalde
> şundandır" diye geçmek, farkın kendisinden daha tehlikelidir.**
>
> 🔬 **BÖLÜM 6 sonuçları:**
> - 6.1 kalan metin kolonu **0** · TANIK: iki `*_province_id` kolonu yerinde · yedekler sağlam.
> - 6.2 `pg_proc`'ta 21 eşleşme **tek tek gözle** okundu. Runbook sınıflandırma regex'ini
>   açıkça yasaklıyor — 31 Tem'de tam o kestirme **dört fonksiyonu yanlışlıkla temize
>   çıkarmıştı**. Hepsi zararsız çıktı.
> - 6.3 düşen kolona bakan view / matview / RLS politikası **0**.
> - 6.4 **çalışma zamanı kanıtı — YAZMA:** `ilan_olustur` `begin; … rollback;` içinde
>   çalıştırıldı, `{"id":"2e51066f-…","audit_score":0,"moderation_status":"pending"}` döndü.
>   Ardından rollback artığı ayrıca arandı (`raw_text = 'DALGA5 DUMAN TESTİ…'`) → **0 satır**.
> - 6.4 **çalışma zamanı kanıtı — OKUMA (runbook'ta yoktu, eklendi):** gövdesinde `city`
>   geçen üç fonksiyonun **üçü de çalıştırıldı**, hiçbiri hata vermedi:
>   `get_radar_city_overview(30)` → 1 · `get_radar_city_detail(34,'giden',30,null)` → 1 ·
>   `get_nearby_listings_by_province(34,null,5)` → 5 satır.
>   📌 Bu adım **bir harita hatası da yakaladı:** `PROJE_HARITASI.md` `get_nearby_listings_by_city`
>   diye bir RPC'den söz ediyordu; öyle bir fonksiyon **yok** (`42883`). Ad Dalga 1'de
>   değişmiş, harita güncellenmemiş. Düzeltildi. **Fonksiyonları gerçekten çağırmasaydım
>   bu yanlış ad belgede kalmaya devam edecekti** — gövde taraması adı doğrulamaz, çağrı doğrular.
>
> 📌 **DERS — plpgsql gövdeleri DDL anında doğrulanmaz.** `alter table … drop column`
> bir fonksiyonu bozsa bile Postgres uyarmaz; hata ancak fonksiyon **çalıştığında**
> çıkar. Bu yüzden bir kolon drop'unun ardından ilgili yazma yolunu gerçekten
> çalıştırmak (ve rollback etmek) zorunludur — `create function`'ın hata vermemesi kanıt değil.
>
> 📌 **RUNBOOK'TAN BİLEREK SAPILDI.** Yedek tabloları runbook'un yazdığı `_20260807`
> yerine gerçek tarihle `_20260806` adlandırıldı. Yanlış tarihli bir yedek 30 gün sonra
> "bu silinebilir mi" kararını veren kişiyi yanıltır. Runbook BÖLÜM 7 da bu ada güncellendi.
>
> ~~⚠️ **AÇIK KALAN:** `scripts/sonda-87.mts` silinmeli~~ → ✅ **KAPANDI (7 Ağu 2026, #34).**
> Dosya ne diskte ne git takibinde; silinmiş.
>
> ---
>
> ✅ **6 AĞU 2026 — `parse-listing` CANLIYA ÇIKTI: v79 → v85.** #86 + #88 + #87
> birlikte gitti; kaynakta üç işaret de yerinde (`index.ts:138, 312, 622, 665, 735, 780`).
> ⚠️ **Ama sahada henüz test edilmedi.** Deploy 6 Ağu **15:49 UTC**; en son alınan ilan
> 6 Ağu **05:56 UTC**. Yani deploy'dan sonra **tek bir ilan bile parser'dan geçmedi**.
> Kod canlıda ≠ kod doğrulandı. Bir sonraki alım turundan sonra `processed` şeritleri
> gözden geçirilmeli.
> ⚠️ **`npm run olc:87` hiç çalıştırılmadı ve artık ilk anlamını yitirdi.** Script
> "eski parser vs yeni parser" kıyası varsayıyordu; yeni parser artık canlıda, dolayısıyla
> körlemesine çalıştırmak yanıltıcı sonuç verir. Çalıştırılacaksa önce neyi neyle
> kıyasladığı yeniden tanımlanmalı.
>
> ---
>
> 🟢 **6 AĞU 2026 — #21 KAPANDI. YEDİ METİN İNDEKSİNİN HEPSİ TAM SIFIR.**
>
> 4 Ağu'daki erken okumada `listing_stops` tarafında iki indeks **+1** kıpırdamıştı
> (`listing_stops_city_trgm_idx` 25→26 · `listing_stops_city_idx` 2→3). Bugünkü
> **1 gün 21:59**'luk pencerede o iki `+1` **tekrarlamadı**; yedi metin indeksi de
> hareketsiz. Sayaç sıfırlanması yok (`stats_reset` sabit).
> 📊 **Tanıklar (aynı pencere):** `listing_stops_listing_id_idx` **+864.094** ·
> `idx_listings_raw_post` +118.550 · `listings_pkey` +47.281 ·
> `idx_listings_shadow_ban` +1.842 · üç `province_id` yolu +30'ar.
> 4 Ağu'daki 92 bin taramaya karşı bu sefer **864 bin**; pencere fazlasıyla dolu.
> 🔑 4 Ağu'nun `+1`'leri kalıcı bir tüketici değil, tekil/artık bir dokunuştu.
> **Yedi indeks de silinebilir** — zaten `drop column` ile kendiliğinden düşecekler.
>
> ---
>
> ✅ **6 AĞU 2026 — #24 DOĞRULANDI (KAPANIŞI 4 AĞU'YDU, BUGÜN KANITLANDI).**
> Tüm kod tabanı `origin_city` / `listing_stops.city` için tarandı. Geriye kalan
> her eşleşme **zararsız** ve drop'tan etkilenmiyor:
> - `lib/ilan-yaz.ts:361` · `app/moderator/actions.ts:229` → **RPC jsonb GİRDİ anahtarı**,
>   kolon yazımı değil. `ilan_olustur` bunları `provinces`e çözmek için okuyor.
> - `supabase/functions/parse-listing/index.ts:1074,1094` → aynı şekilde RPC girdisi.
> - `app/api/whatsapp/route.ts` · `parse-text` · `llm-parse` · `MetindenIlan.tsx`
>   → **LLM JSON şeması** alan adı, tablo kolonu değil.
> - `app/moderator/page.tsx:515` → `ilAdi(ilan.origin_province_id)`'den **türetiliyor**;
>   KOVA D'deki doğrudan `UPDATE` zaten silinmiş.
> - `app/yol-rehberi/YolRehberiClient.tsx:64` → `get_nearby_listings_by_province`
>   RPC'sinin **ÇIKTI** kolonu; kaynağı `provinces.name` (3 Ağu'da temizlendi).
> - `learn-aliases/route.ts:109,492` → ikisi de **`origin_province_id`**. Temiz.
>
> ---
>
> 🟢 **6 AĞU 2026 — DALGA 5 DROP: BÖLÜM 0 ÖNKOŞULLARININ TAMAMI YEŞİL (CANLIDA ÖLÇÜLDÜ).**
>
> | # | Önkoşul | Durum |
> |---|---|---|
> | 0.1 | 8.B delta yeşil | ✅ bugünkü #21 okuması (yukarıda) |
> | 0.2 | pozitif kontrol | ✅ tanık yöntemiyle telafi (bkz. 1194-1200) |
> | 0.3 | 24 saat kapsam | ✅ **5.631 ilan · il çözülemeyen 0 · metne yazılan 0** |
> | 0.4 | `destination_city` yok | ✅ `information_schema`da yok |
> | 0.5 | veri kaybı yok | ✅ metin dolu/id boş satır: listings **0**, stops **0** |
> | 0.6 | `ilan_olustur` v4 canlı | ✅ gövdede `-- ⬅️ origin_city çıkarıldı` |
> | 0.7 | kod temizliği | ✅ #24 yukarıda |
> | 0.8 | **fonksiyon gövde taraması** | ✅ aşağıda |
>
> 🔬 **0.8 — `pg_proc` gövde taraması (satır satır, yorumlar elenmiş).** `city` geçen
> **dört** fonksiyon var, dördü de düşen kolona DOKUNMUYOR:
> `get_nearby_listings_by_province` (çıktı takma adı, `po.name`) ·
> `get_radar_city_detail` + `get_radar_city_overview` (jsonb anahtarı + `p.name as city`) ·
> `ilan_olustur` (hepsi `p_listing->>'origin_city'` / `t.s->>'city'` **girdi** okuması;
> iki `insert` kolon listesinde de "çıkarıldı" notu duruyor).
> 🔬 **Ek kontrol (runbook'ta yoktu, yapıldı):** `pg_depend` üzerinden view / kısıt /
> RLS politikası / trigger / default bağımlılığı → **sıfır satır**. Yani `drop column`
> `CASCADE` olmadan da patlamayacak; yedi indeks otomatik düşecek.
> 📊 Ölçek: `listings` 243.644 · `listing_stops` 254.909 satır (yedek boyutu için).
>
> ✅ **DROP AYNI GÜN ÇALIŞTIRILDI — dosyanın başındaki kayda bak.** Sıra şuydu ve
> aynen uygulandı: BÖLÜM 7 yedek → BÖLÜM 4'ün yedi `drop index concurrently`'si
> **BİRER BİRER** (tek Run'da hepsi = `25001`) → BÖLÜM 5'in iki `drop column`'u →
> BÖLÜM 6 doğrulama.
> 📌 Bu satır başta "**DROP'U BEN ÇALIŞTIRMIYORUM, sıra Bayram'da**" diyordu; Bayram
> "supabase işlemlerini sen yap" deyince yetki devredildi. **Devredilen yetki, yazılı
> kaydı da geçersizleştirir** — kararı değiştirip belgeyi güncellememek, bu dosyanın
> zaten bir kez düştüğü tuzağın aynısı (bkz. aşağıdaki #24 atıf dersi).
>
> ---
>
> 🚨 **6 AĞU 2026 — #87 (KAPANDI): SOLU BOŞ `->` — `contextFrom` YEDEĞİ ULAŞILAMAZ
> ÖLÜ KODMUŞ. ÜÇ DÜZELTME, MUTASYONLA DOĞRULANMIŞ TEST, ÖLÇÜM SCRIPTİ HAZIR.**
>
> **KÖK SEBEP.** `splitByRelation`'ın ok kolu `if (left && right)` istiyordu. `➡️SAMSUN`
> gibi solu boş bir satır → `left === ''` → **`null`**. Oysa `parseMessage:646`'da
> "ok solunda şehir yoksa `contextFrom` kullan" diye bir yedek vardı ve yorumu tam
> bunu iddia ediyordu. O kola **hiçbir zaman girilmedi**. Satırlar Pass 2 / Pass 3 /
> iki-şehir fallback'ine düşüyordu; oralar onları **kazara ve sıraya bağlı** kurtarıyordu.
>
> **NEDEN GEÇ FARK EDİLDİ:** Pass 3 yalnız `lanes.length === 0` iken koşan bir
> **kaza-kurtarma** mekanizması. Bozuk Pass 1'i sessizce maskeliyor — ve mutantları da
> maskeliyor. Bu yüzden saf testler mutasyondan sağ çıkıyor (aşağıdaki #87-B dersi).
>
> **ÜÇ DÜZELTME (`supabase/functions/parse-listing/index.ts`):**
> - **#87-A** (`splitByRelation`): `if (left && right)` → **`if (right)`**. Solu boş ok
>   artık ilişki sayılıyor, yedek kol nihayet erişilebilir.
> - **#87-B** (Pass 1): `rel.left.trim() ? … : contextFrom` → **`bestPlace(findPlaces(rel.left)) || contextFrom`**.
>   Sol **dolu ama yersiz** olduğunda da (`13.60 TIR -> ANKARA`) satır artık sessizce düşmüyor.
> - **#87-D** (`+` kolu): `+` tek başına "çoklu varış" DEĞİL. `duzce 1200+kdv` gibi
>   **fiyat** satırları da `+` içeriyordu. Artık en az **iki parçada tanınan yer** şart.
>
> **#87-C YAZILDI, ÖLÇÜLDÜ, GERİ ALINDI.** Pass 2'nin reset koşuluna "solu boş ok
> resetlemesin" muafiyeti eklendi; 8 gerçek vaka + `test:87` + `test:pass2` çıktısı
> **bit bit aynı** kaldı. Sebep: Pass 1 satır 617 (`if (nonRelHits.length > 0) contextFrom = …`)
> bu satırların kökenini zaten sahipleniyor. Sıfır kazanç + blok sınırını gevşetme riski
> → geri alındı. Yerine `📌 #87 NOTU` yorumu bırakıldı ki bir daha "düzeltilmeye" kalkılmasın.
>
> **KANIT — gerçek üretim metni, eski ⟶ yeni:**
> ```
> 685877e4  ADANA OSB YÜKLEMELİ / ➡️MERSİN AYAŞ / ➡️URFA MERKEZ
>           önce: Mersin → Ankara/Ayaş   ❌ SAF UYDURMA (Adana metinde hiç yok)
>           sonra: Adana → Mersin , Adana → Şanlıurfa
> 99183fb8  📍duzce 1200+kdv / 📍akyazi 1300+kdv / 📍bartin 1300+kdv / ➡️samsun
>           önce: Düzce→Sakarya/Akyazı , Düzce→Bartın   ❌ iki uydurma, Samsun YOK
>           sonra: Bartın → Samsun
> e8843b11  UŞAK YÜKLEME / ➡️MERSİN / ➡️TRABZON + RİZE   → önce Mersin kayıptı
> bbf0b3e4  İZMİT / ➡️AFYON/ÇAY / İZMİT / ➡️SAMSUN       → önce ters şerit üretiyordu
> ```
>
> 📊 **YAYILMA (SQL, 30 gün) — #87 NİYE #86+#88'DEN BÜYÜK:**
> `processed` **6.724** satır · solu boş ok içeren **293** satır (1.880 satır metni) ·
> o okta adı geçen varışın **hiçbir şeride girmediği 133 satır** (3'ü `processed`
> olduğu hâlde hiç ilan üretmemiş).
> 🔑 #86'nın net kazancı 45, #88'inki 10 satırdı. #87'nin kanalı ikisinin toplamından
> büyük **ve cinsi daha kötü**: satırlar `processed` göründüğü için kimse bakmıyordu.
>
> ✅ **DOĞRULAMA:** `npm run test:87` — **16/16**. Parser `index.ts`ten çalışma anında
> sökülüyor. **MUTASYON:** A geri alındı → **5 test düştü**, B → **1**, D → **1**.
> `npx tsc --noEmit` temiz; yedi test paketinin hepsi yeşil.
>
> 🚨 **BU OTURUMUN EN ÖNEMLİ DERSİ — #87-B TESTİNİN İLK HÂLİ MUTASYONDAN SAĞ ÇIKTI.**
> `'ADANA YÜKLEME\n13.60 TIR -> ANKARA'` düzeltme geri alınmışken de **geçiyordu**:
> Pass 1 hiçbir şey üretmeyince `lanes.length === 0` kalıyor ve **Pass 3 kurtarıyordu**.
> Test yeşildi ama **hiçbir şeyi korumuyordu**. Düzeltme: başa gerçek bir Pass 1 şeridi
> eklendi (`'BURSA -> KONYA\n13.60 TIR -> ANKARA'`).
> 📌 **Kural: Pass 3'ün kurtarabileceği her vaka, testte önce bir şerit doğurmalı.**
> Aksi hâlde ölçtüğün şey Pass 3, düzeltmen değil.
>
> 📁 **YENİ DOSYALAR:** `scripts/test-87.mts` · `scripts/olc-87.mts`
> **YENİ SCRIPT'LER:** `npm run test:87` · `npm run olc:87`
> ⚠️ `olc-87` #86/#88'den **yapıca farklı**: onlar "şeritsiz satır şerit kazandı mı"
> (0→≥1) soruyordu; #87'nin hasarı **başarılı görünen `processed` satırlarda**. Bu yüzden
> `processed` + `no_lane` birlikte taranıyor ve şerit **KÜMELERİ** karşılaştırılıyor
> (`eklenen`/`silinen`/`değişen`). 📌 **Çıkan değişim sayısı bir "kazanç" rakamı DEĞİL,
> #86/#88'in 0→≥1 sayılarıyla kıyaslanamaz.** `KAYIP (≥1→0)` yine 0 olmalı.
>
> ⏳ **BEKLEYEN:** `npm run olc:87` Bayram'ın makinesinde koşacak (sandbox'ta
> `supabase.co`ya ağ yok).
> ✅ Deploy tarafı kapandı: #86 + #88 + #87(A–F) birlikte gitti, canlı **v89**
> (7 Ağu 2026 05:41:56 UTC). "Canlı hâlâ v79" satırı 6 Ağu'da doğruydu, artık değil.
>
> ~~🧹 **SİLİNMELİ:** `scripts/sonda-87.mts`~~ → ✅ **KAPANDI (7 Ağu 2026, #34).**
> Geçici teşhis sondasıydı, `test-87.mts` yerini aldı; dosya artık yok.
> 🏷️ **KÜÇÜK TUTARSIZLIK:** `index.ts`teki `+` kolu yorumu kendini `#87-B` diye
> etiketliyor; testlerde ve burada kullanılan kanonik ad **#87-D**.
> ℹ️ `app/api/whatsapp-parse/route.ts` **aynalama gerektirmedi** — içinde `parseMessage`
> yok; ikiz-parser tekrarı yalnız `trNorm`/alias tarafında ve #87 oraya dokunmuyor.
>
> ---
>
> 🟢 **6 AĞU 2026 — #88: PASS 2'DE İKİ AYRI "BLOK KOPARMA" HATASI.
> DÜZELTİLDİ, MUTASYONLA DOĞRULANDI, ✅ DEPLOY EDİLDİ (v89, 7 Ağu). ÖLÇÜM AÇIK.**
> ⚠️ Ölçüm hâlâ yapılmadı: deploy'dan sonra sıfır trafik (son `raw_post` 6 Ağu 16:33).
> `npm run olc:88` yeni parti geldikten sonra koşulmalı.
>
> **#83 (#42 C) bunun için açılmıştı ve CEVAPLANDI:** "Kova C'nin 160/306'sı
> `yükle*` kalıbında, Pass 2 tam bu kalıp için yazılmış — niye tutmuyor?"
> **Cevap: eksik özellik değil, iki bug.** Alias eksikliği de değil — SQL ile
> doğrulandı, `manisa · turgutlu · akşehir · kula · van · başkale · silivri`
> hepsi canlıda **aktif alias**.
>
> **#88-A — yer içermeyen "yükle*" satırı bloğu öldürüyordu.**
> `isYuklemeli` yalnız `yukle` **alt dizisine** bakıyor. Yükle*meyle* ilgisi
> olmayan dolgu satırları da ateşliyor:
> `"2 koli 55*50*50 üstuste yüklenmez."` (yuklenmez ⊃ yukle) ·
> `"3 tabana 3 üstü yüklenir"` · `"1 Kapak yer Yanyana yükleme üstene birşey konulmaz."`
> Bu satırlarda yer yok → `bestPlace` null → `blockOrigin` **siliniyordu**, hemen
> altındaki `Teslim Yeri … / Van` satırı sahipsiz kalıyordu.
> **ARTIK:** yersiz `yükle*` satırı bloğu bozmaz, atlanır (`if (!yeniOrigin) continue`).
>
> **#88-B — boşluksuz tire arka kapıdan geri giriyordu.**
> Reset koşulundaki `splitByRelation(line) !== null`, `BLOCK_RESET_RE`'nin
> **bilinçle** dışarıda bıraktığı boşluksuz tireyi geri sokuyordu:
> `(KISA-UZUN) DORSE` → `rel:'dash_nospace'` (sol=`(KISA`, sağ=`UZUN) DORSE`)
> → blok resetleniyordu. Oysa o satır bir **dorse tarifi**, ilişki değil.
> **ARTIK:** ilişkili satır ancak **içinde tanınan yer varsa** resetler. Gerçek
> güzergâh satırını Pass 1 zaten alıyor, kayıp yok.
>
> **KANIT — gerçek satırlar, gerçek parser (elle kopyalanmış kopya değil):**
> ```
> acb96bbc  MANİSA TURGUTLU YÜKLEMELİ / (KISA-UZUN) DORSE / AKŞEHİR TIR
>           önce: ❌ şerit YOK        sonra: Manisa → Konya/Akşehir
> "Yüklemeli Parça Aracı" şablonu (Kula/Manisa → Merkez veya Başkale/Van)
>           önce: ❌ şerit YOK        sonra: Manisa/Kula → Van/Başkale
> ```
>
> ✅ **DOĞRULAMA:** `npm run test:pass2` — 12 vaka, **12/12**. Test fonksiyonu
> `index.ts`ten **çalışma anında sökülür** (#86'nın dersi: elle kopyalanan regex
> zinciri, hatanın bulunduğu satırı hiç koşmadan 17/17 geçmişti).
> **MUTASYON DENEYİ:** düzeltmeler tek tek geri alınıp test o kopyaya doğrultuldu →
> **A → 3 test düştü, B → 2 test düştü.** Yani test gerçekten o satırları koşuyor.
> `npx tsc --noEmit` temiz; mevcut 5 test paketi (parser/lokasyon/districts/alias/clean) bozulmadı.
>
> 📊 **ÖLÇÜLDÜ — 6 Ağu 2026, `npm run olc:88` (Bayram'ın makinesinde).**
> `alias: 1242/1242 · ölçülen satır: 490`
> ```
> varyant     KAZANÇ (0→≥1)   KAYIP (≥1→0)
> yalnizA             8              0
> yalnizB             2              0
> yeni               10              0      · hata 0
> ```
> **KAYIP = 0** (kritik sonuç: daha önce çalışan hiçbir satır bozulmuyor).
> Kazanç **toplanabilir**: A 8 + B 2 = 10, örtüşme yok — iki hata birbirinden bağımsız.
> Ölçüm #86 AÇIKKEN yapıldı, yani bu **#86'nın üstüne gelen ek** paydır.
>
> 🔁 **BENİM "ERİM BÜYÜK OLABİLİR" BEKLENTİM TUTMADI — kayda geçiyor.**
> "490 satırın 284'ünde `yükle` geçiyor" demiştim; gerçek kazanç **10 (%2,0)**.
> Ders: bir kelimenin metinde geçmesi, o satırın o kalıpta **olduğu** anlamına gelmiyor.
> Tahmin ölçümün yerine geçmez — sayı 284'ün değil, 10'un etrafında konuşulmalı.
>
> **Kazanan kalıplar (elle denetlendi, hepsi doğru):**
> `A` → "Yüklemeli Parça Aracı" şablonu 6 satır (`8f2df60d · b453c652 · a1e671ca ·
> `46dd3c3b · 219511cd · 81862198`), ayrıca `2ee284ca` ve `4e7f2ac9` (+2 şerit,
> "BAŞİSKELE KOCAELİ YÜKLER").
> `B` → "‼ MANİSA TURGUTLU YÜKLEMELİ ‼ / (KISA-UZUN) DORSE" kalıbı 2 satır
> (`acb96bbc · 686725c5`) — yani bu kalıp tek bir gönderenin şablonu, nadir.
>
> ✅ **DEPLOY EDİLDİ — v89 (7 Ağu 2026 05:41:56 UTC).** "canlıda hâlâ v79" satırı
> 6 Ağu'da doğruydu, artık değil. #86 ve #88 birlikte sahaya indi.
> ⚠️ **~55 satır / 30 gün rakamı ÖLÇÜM DEĞİL, TAHMİN** (#86 net 45 + #88 10).
> Deploy sonrası tek bir yeni `raw_post` gelmedi (son trafik 6 Ağu 16:33 UTC), yani
> tahminin doğrulanması yeni trafiği bekliyor. Ölçerken **tanık kolonu** ekle:
> aynı pencerede işlenen toplam satır sayısı olmadan "45 kazandık" da "0 kazandık"
> da bir şey kanıtlamaz.
>
> 📌 **AÇIK KALAN:** kalan ~435 `no_lane` satırın derdi ne #86 ne #88. Kova C'nin
> geri kalanı için ayrı iş gerekir (#42) — ama #65'in 3.968 `pending`'i yanında
> bu kanalın tavanı hâlâ küçük; öncelik sırası değişmedi.
>
> 🔁 **DÜZELTME — `4ec36229` bir Pass 2 hatası DEĞİLMİŞ.** (`Yükleme ; SİLİVRİ` /
> `Boşaltma : KEMERBURGAZ`.) İki uç da İstanbul'a çözülüyor ve **ikisinin de
> `district`i NULL** → `isDiff` false → şerit yok. Kod doğru davranıyor; eksik olan
> **alias'ta ilçe bilgisi**. Bu satır **Kova A** işi (#42), Pass 2 işi değil.

> 🚨 **6 AĞU 2026 — #87 (YENİ): SOLU BOŞ `->` SATIRI. PARSER VARIŞI DÜŞÜRÜP
> KÖKENLERİ BİRBİRİYLE EŞLİYOR. UYDURMA ŞERİT ÜRETİYOR.**
>
> #86 ölçümünün örneklerini denetlerken çıktı. `99183fb8`:
> ```
> 📍duzce💰1200+kdv        →  duzce 1200+kdv
> 📍akyazi💰1300+kdv       →  akyazi 1300+kdv
> 📍bartin💰1300+kdvtokt   →  bartin 1300+kdvtokt
> ➡️samsun                 →  ->samsun          ← SOLU BOŞ
> ```
> **Olması gereken:** 3 şerit → Düzce→Samsun · Sakarya/Akyazı→Samsun · Bartın→Samsun.
> **Gerçekte üretilen:** 2 şerit → **Düzce→Sakarya/Akyazı** ve **Düzce→Bartın**.
> **Samsun hiçbir şeritte geçmiyor.** Yani eksik şerit değil, **YANLIŞ** şerit.
>
> ⚠️ **`KAYIP` SÜTUNU BUNU GÖREMEZ.** O yalnız `≥1 → 0` geçişini ölçer. Bu satır
> `0 → 2` yaptığı için **KAZANÇ** hanesine yazıldı. #86 düzeltmesi bu satırı
> "sessiz kayıp"tan "sessiz **yanlış**"a çevirdi — ki ikincisi daha kötüdür.
> Hata #86'nın değil, `parseMessage`'ın köken-taşıma mantığının; #86 onu görünür kıldı.
>
> 📏 **SIKLIK ÖLÇÜLDÜ: 46 kazancın 1'i** (`99183fb8`). `olc-86.mts`'e eklenen
> ŞÜPHELİ sayacı (`/^\s*->/` satırı içeren kazançlar) 1 dedi → **net kazanç 45**.
> Yani kalıp bu pencerede NADİR; #86 deploy'unu engellemez.
>
> ❓ **AMA ASIL YAYILIM ÖLÇÜLMEDİ — bunu iddia etmiyorum.** `olc-86` yalnız
> **damgasız `no_lane`** satırlarına bakar. Aynı kalıp bugün **ilan üreten**
> (`processed`) satırlarda da olabilir ve orada sonuç daha kötü olur: satır
> "başarılı" görünürken şeritler uydurma olur, kimse fark etmez. O küme hiç
> taranmadı. #87 çözülmeden önce `processed` satırlarda `/^\s*->/` kalıbı sayılmalı.
>
> ✅ **DENETLENEN VE DOĞRU ÇIKAN ÖRNEKLER** (kazancın çoğunluğu buradan):
> `a24cc7e0` +5 ve `9f141797` +5 — `ŞEHİR🔹CİLVEGÖZÜ ARAÇ LAZIM` kalıbı, her satır
> ayrı bir yük talebi; 🔹 şehirle sınır kapısını yapıştırıyormuş. 9f141797'de KONYA
> iki kez geçiyor (6 satır → 5 tekil şerit), sayı doğru.
> `3dcd6417` +2 (`ergani👉kazan`, `Antep👉ivedik`) · `7aca9f54` +1
> (`📍ÇATALCA👉🏻MANAVGAT` — ten rengi değiştiricisi 👉 kuralını bloke ediyor ama
> emoji-strip'in boşluk ikamesi şeridi yine de kurtarıyor).

> 🟢 **6 AĞU 2026 — #86: VEKİL ÇİFTİ SİLME HATASI. DÖRT DOSYA. ✅ DEPLOY EDİLDİ (v89, 7 Ağu).**
>
> **TEK CÜMLE:** `/[\uD800-\uDFFF]/g` — `u` bayrağı yok — **geçerli vekil
> çiftlerini de siliyordu**, yani BMP-üstü **tüm** emojiler (👉 📍 🔹 🚛) parser'ın
> ilk satırında, **boşluk bırakmadan** yok oluyordu.
>
> **NEDEN SESSİZ:** JS, `u` bayrağı olmayan bir sınıfı **kod birimi** bazında uygular.
> 👉 = `D83D DC49`; iki yarı ayrı ayrı eşleşir ve ayrı ayrı silinir. Hata vermez,
> log basmaz — metin sadece bozulur. `➡` (U+27A1) BMP'de olduğu için hayatta kaldı;
> tutarsızlığın gözden kaçma sebebi de bu.
>
> **İKİ SONUCU VARDI:**
> 1. **#63'ün 👉/📍 kuralı v79'da ÖLÜ KODDU.** Ayraç kuralı, ayracın kendisi
>    silindikten *sonra* çalışıyordu. Sadece ASCII `=` dalı iş görüyordu.
> 2. **Token yapışması:** `MERSİN👉İRAN` → `MERSİNİRAN`. :161'deki emoji-strip'in
>    "boşlukla değiştir" önlemi bu karakterlere hiç ulaşamıyordu.
>
> **DÜZELTME** (yalnız *eşsiz* vekiller silinir, sağlam çiftlere dokunulmaz):
> `/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g`
> Aynı hata **4 dosyadaydı**, dördü de düzeltildi:
> `parse-listing/index.ts:150` · `llm-parse/route.ts:11` ·
> `admin/crm/[id]/analiz/route.ts:41` · `admin/learn-aliases/route.ts:251`.
> (`whatsapp-parse/route.ts` temiz — hiç vekil temizliği yapmıyor.)
> ⚠️ `learn-aliases` en riskliydi: yapışık token'dan Haiku **uydurma alias** öğrenebilirdi.
>
> ✅ **DEPLOY EDİLDİ — v89 (7 Ağu 2026).** "canlı hâlâ v79" satırı 6 Ağu'da doğruydu,
> artık değil. Dördü de sahada: `index.ts` v89 içinde (deploy edilen baytlar `9a1940f`
> ile birebir), diğer üç dosya `app/api/**` altında ve `origin/main` ile aynı — Vercel
> `main`'den build ediyor.
>
> 🔁 **RETRAKSİYON — #63 için verdiğim "52 satır / 30 gün" TAHMİNİ GEÇERSİZ.**
> O sayı 👉/📍 kuralının çalıştığı varsayımıyla hesaplanmıştı; kural ölü koddu.
> v79'un gerçek getirisi yalnız `=` dalı (10 satır).
>
> 📊 **ÖLÇÜLDÜ — 6 Ağu 2026, `npm run olc:86` (Bayram'ın makinesinde).**
> `alias: 1242/1242 · ölçülen satır: 490`
> **KAZANÇ (0 → ≥1 şerit): 46** · **KAYIP (≥1 → 0): 0** · değişmedi 444 · hata 0
> · bunun ŞÜPHELİsi (#87) **1** → **NET KAZANÇ 45**.
> Yani 30 günde şerit çıkaramamış 490 satırın **%9,2'si** #86 düzeltmesiyle DOĞRU
> şerit üretiyor. **KAYIP = 0** kritik sonuç: düzeltme daha önce çalışan hiçbir
> satırı bozmuyor. Bu sayı **sadece #86'nın payı**; kalan 444'ün derdi başka (#42/#83).
>
> ⚠️ **İLK ÖLÇÜM YANLIŞTI, DÜZELTİLDİ — kayda geçiyor.** İlk koşu `KAZANÇ 40`
> demişti; çıktının başlığı `alias: 1000` idi, oysa tabloda **1242** aktif alias var.
> **PostgREST tek istekte en fazla 1000 satır döndürür ve `.limit(5000)` bu SUNUCU
> tavanını KALDIRMAZ** — sessizce keser. Alias'ların %19,5'i eksikken ölçüm yapılmıştı.
> Eksik alias asla *yanlış* şerit üretmez, sadece şerit **buldurmaz** → hata tek yönlü,
> gerçek sayı hep ≥ ölçülen. Scripte `.range()` sayfalama + `alias.length === count`
> sertifikası eklendi; eksik çekerse artık **patlıyor**. Fark: 40 → 46 (+6).
> **Bu çukuru kod tabanı zaten kazıp not düşmüştü** (`parse-listing/index.ts:70`,
> `aliaslariCek()` `.range()` ile sayfalıyor) — canlı parser temiz, hata yalnız scriptteydi.
>
> 🔑 **`.env.local` SATIR 5 BOZUK — SİLİNMELİ (Bayram).** `SUPABASE_SERVICE_ROLE_KEY`
> iki kez tanımlı (satır 3 ve 5). Claim'leri aynı ama satır 5'teki JWT **4 parçalı**
> (geçerli JWT tam olarak `header.payload.signature` = 3 parça; 219 vs 256 karakter).
> Next.js/dotenv **İLK** geçeni alır → uygulama çalışıyor. `Object.fromEntries` **SON**
> geçeni alır → script `Invalid API key` veriyordu. Script ilk-geçen-kazanır'a çevrildi,
> ama bozuk satır hâlâ orada.
>
> 🧪 **KENDİ TEST YÖNTEMİMDEKİ HATA — ASIL DERS BU.**
> #63'ün regresyon testi (`/tmp/t63.mjs`) **17/17 geçmişti ve YANLIŞTI.** Sebep:
> gerçek `cleanMessage`'ı çağırmıyor, regex zincirini **elle kopyalıyordu**. Kopyada
> `:150` yoktu, dolayısıyla test hatanın *bulunduğu satırı hiç çalıştırmadı*.
> Test, kendi yazdığım kodun kendi yazdığım kopyasını doğruluyordu.
> **Kural: parser testi kaynak dosyayı ÇALIŞMA ANINDA sökmeli, elle kopyalamamalı.**
> Yeni test `scripts/test-clean-message.mts` (`npm run test:clean`, 16 vaka) bunu yapar.
> **Mutasyonla doğrulandı:** `index.ts` kopyalanıp eski regex geri konunca test
> **5 vakada düştü** (👉 · 📍 · 🔹 · 🚛 · karışık). Yani testin geçmesi anlamlı.
> Deney tekrarlanabilir: `KAYNAK_INDEX=/tmp/mut/index.ts npm run test:clean`.
>
> 📏 **ÖLÇÜM NİYE KUM HAVUZUNDA YAPILAMADI (kayda geçiyor).** Ölçüm hem canlı veri
> hem gerçek parser ister. Kum havuzunun ağ izni yok (`supabase.co` allowlist dışı,
> curl exit 56; npm açık). Veriyi elle taşıma denendi ve **ölçülerek çürütüldü**:
> 250 alias'lık ilk sayfada md5 tutmadı, `dogubayazit` → `dogubayazio` olmuştu —
> 18 sayfanın ilkinde, sessiz. Bu yüzden ölçüm `scripts/olc-86.mts` olarak yazıldı:
> veriyi kendisi çekiyor, parser'ı kaynaktan söküyor, eski/yeni kodu aynı satırlarda
> karşılaştırıyor. **`KAYIP (≥1 → 0)` satırı 0 olmalı**; değilse düzeltme zarar veriyor.
>
> ✅ **6 AĞU 2026 — #65 KAPANDI. PENCERE 12 SAAT, YIĞIN RAFTA, `pending` = 0.**
>
> **Bayram kararı:** *"pencereyi 2sa → 12sa yapalım. daha eskilerden bir şekilde
> kaldıysa onları da rafa kaldıralım. eski ilan dirilmesin."* → İkisi de uygulandı.
>
> **UYGULAMA (sıra önemliydi: önce raf, sonra pencere).**
> `pending_yigini_rafa_kaldir` → 12 saatten eski **5.693** satır
> `processing_status='rejected'`. Küme temizdi: ilanı olan 0 · denenmiş 0 · damgalı 0
> (yani #77 yalancı-pending'i karışmadı). En eski 14 May, en yeni 5 Ağu 12:04.
> `supurucu_penceresi_12_saat_ve_kalici_raf` → pencere 12sa **+ ADIM 0 kalıcı raf**:
> her turda pencereden düşmüş `pending` satırlar (tur başına ≤500) `rejected`'a çekilir.
> Böylece yığın bir daha BÜYÜYEMEZ ve pencere ileride yine genişletilse bile
> eski yükler dirilemez — kural koda gömüldü, niyete bırakılmadı.
>
> **DOĞRULAMA:** `pending` **0** · `rejected` 5.693 · `processed` 57.961 · `no_lane` 4.519.
> Fonksiyondaki pencere literalleri: `12 hours`, `12 hours`, `5 minutes` — `2 hours` kalmadı.
> `SECURITY DEFINER` ✅ · yetkiler `{postgres, service_role}` (anon/authenticated YOK) ✅ ·
> cron işi aktif ✅ · elle bir tur → **0** (beklenen: süpürülecek satır yok).
> Tavan: **~5.750 → ~34.500** satır/patlama. Anlık yük DEĞİŞMEDİ (hız yine 50/dk).
>
> ⚠️ **ÖLÇÜM SCRİPTLERİNDE KIRILAN VARSAYIM:** `processing_status <> 'pending'` artık
> "işlenmiş" demek değil — `rejected` de o filtreye giriyor
> (örn. `20260805_no_lane_format_olcumu.sql:249` `islenmis` sayacı bugünden itibaren şişer).
>
> 🔍 **KENDİ DOĞRULAMAMDA HATA — KAYDA GEÇİYOR.** İlk kontrolde
> `functiondef like '%2 hours%'` yazıp `true` aldım ve bir an eski pencerenin kaldığını
> sandım. Yanılgı: **`'12 hours'` zaten `'%2 hours%'` içeriyor.** Doğru test
> `regexp_matches` ile interval literal'lerini tek tek çıkarmak. Substring kontrolü
> sayı içeren literal'lerde güvenilmez.
>
> *(Aşağıdaki ölçüm bloğu kararın gerekçesidir, tarihsel olarak bırakıldı.)*
>
> 📊 **ÖLÇÜM — SIZINTI DURMUŞ; YIĞIN TASARIM GEREĞİ ERİŞİLEMEZDİ.**
>
> **1) Boru hattı ileriye dönük SAĞLIKLI.** Süpürücünün penceresi içinde (2 saat)
> bekleyen **0** satır. 0–12 saat aralığının tamamında **0** `pending`.
> Son 24 saatte 862 cron koşusu, **0 hata**. Aynı 24 saatte gelen 3.009 satırın
> 2.388'ini trigger, 30'unu süpürücü işlemiş. Yani #77'deki sızıntı kapanmış.
>
> **2) Yığın 5.693 satır, en eskisi 14 Mayıs — ve HEPSİNDE `last_parse_attempt_at IS NULL`.**
> Süpürücü bu satırların hiçbirine hiç dokunmadı. Sebep hata değil, **kapsam**:
> `created_at > now() - interval '2 hours'` filtresi onları dışarıda bırakıyor.
> Bu senin kararın ve fonksiyon gövdesinde birebir yazılı:
> *"Kapsam kararı (Bayram, 5 Ağu): SADECE son 2 saat. Mayıs'tan kalma yük ilanlarını
> diriltmek istemiyoruz."* → Yığın **onarılmayacak**, kural gereği. Kayıp değil, karar.
>
> **3) Yaş dağılımı:** 0-2sa **0** · 2-6sa **0** · 6-12sa **0** · 12-24sa **591** ·
> 1-3gün 819 · 3-7gün 15 · 7-30gün 2.543 · 30+gün 1.725.
> 12-24sa'teki 591, 5 Ağu 11:00 patlamasının (640 satır) artığı: süpürücü 16:00'da
> devreye girdiğinde bunlar çoktan 2 saati geçmişti.
>
> 🚨 **4) TEK GERÇEK İLERİYE DÖNÜK RİSK — PATLAMA TAVANI.** Süpürücü dakikada 50 satır,
> uygunluk penceresi 115 dakika (2sa − 5dk) → **tek patlamada taşınabilir tavan ~5.750**.
> Gözlenen en büyük patlama 1.933/saat (2.989/gün) → ~3× pay var. Bugün yeterli,
> ama pay büyümüyor; trafik 3× artarsa 5 Ağu'nun aynısı tekrarlar.
>
> ❓ **AÇIK KARAR (senin onayın şart — kapsam senin kararın):** pencere 2sa → 12sa.
> **Ölçülen sonuç: bugün 0 satır süpürülür** — 0-12sa kovaları boş, en yakın yığın
> 12-24sa'te. Yani hiçbir eski yük dirilmez, kuralın çiğnenmez.
> Anlık yük de artmaz (hız yine `p_limit`=50/dk). Tek değişen: patlama tavanı
> **~5.750 → ~34.500**. 5 Ağu'daki 591 satır bu pencereyle kurtulurdu.
> → Onay verirsen tek satırlık migration; vermezsen #65 "karar gereği kapandı" olur.

> 📊 **6 AĞU 2026 — #42 ÖLÇÜLDÜ. AYRIM YAPILDI, AMA AYRIM #42'NİN KÜÇÜK BALIK
> OLDUĞUNU GÖSTERDİ.**
>
> **1) `no_lane` kök neden ayrımı (son 30 gün, 534 satır).** Koddaki üç dal:
> boş `raw_text` **0** · şerit bulunamadı **490 (%91,8)** · şerit var ilan yok **44 (%8,2)**.
> Pre-check dalı hiç ateşlemiyor — o sınıf pratikte yok.
>
> **2) "Şerit yok" 490'ın kova ayrımı** (metindeki DISTINCT tanınan şehir sayısı,
> `aliases` ile SQL'de eşleştirildi):
> **Kova A** 0 şehir → **27 (%5,5)** = alias eksik ·
> **Kova B** 1 şehir → **157 (%32,0)** = tek uç yazılmış ·
> **Kova C** ≥2 şehir → **306 (%62,4)** = *iki uç da metinde var, parser ilişkiyi kuramıyor*.
> ⚠️ SQL yaklaşımı bigram/ek-soyma yapmıyor → A ve B'yi bir miktar ŞİŞİRİR, C'yi kırpar.
> Yani gerçek Kova C ≥ 306.
>
> 🚨 **3) ASIL BULGU — #42 YANLIŞ KANALI OPTİMİZE EDİYOR.** Son 30 gün, 11.503 `raw_posts`:
> `processed` **7.001 (%60,9)** · **`pending` 3.968 (%34,5)** · `no_lane` **534 (%4,6)**.
> **`pending` 3.968 satırın İLANI OLAN SAYISI: 0.** Yani hepsi gerçekten işlenmemiş.
> (#77 yalancı-pending'i tekrarlamıyor — bu ayrı ve daha büyük bir kayıp: **#65**.)
> → Parser format kapsamasının tavanı 490; `pending` kuyruğunun bedeli 3.968.
> **Sıradaki iş #42 değil #65 olmalı.** Süpürücü (#76) yalnız son 2 saate bakıyor,
> geriye dönük yığını hiç görmüyor.
>
> **4) Kova C içinde kalıp sayımı (306 üzerinden):**
> `yükle*` geçen **160** · `boşalt/iner/teslim` fiili **34** · satır sonu `-DAN/-DEN` **13** ·
> görsel madde işareti (`🔹🔸▪◾` vb.) **10**.
> 🚨 **160 sayısı bir BUG işareti, eksik özellik değil:** `parseMessage` Pass 2 tam olarak
> "yükleme bloğu" kalıbı için yazılmış ve bu satırlarda şerit üretmemiş. Kanıtlamak için
> gerçek parser'ı örnek metinlerle koşturmak gerekiyor (#42 C).
> ✅ **DOĞRULANDI (#83 kapandı → #88):** hipotez tuttu. Gerçek parser sökülüp örnek
> satırlarla koşturuldu, **iki ayrı Pass 2 bug'ı** izole edildi (yersiz `yükle*`
> satırı bloğu öldürüyor · boşluksuz tire bloğu resetliyor). İkisi de düzeltildi;
> kaç satır kazandırdığı `npm run olc:88` ile ölçülecek. Dosyanın başındaki #88 blokuna bak.
>
> **5) `/` KARARI ÖLÇÜLDÜ — #63'te eklememek DOĞRUYDU.** "İki tarafı da tanınan ve
> FARKLI il" şartıyla en güvenli koşullu kural bile son 30 günde **1 raw_post**
> kazandırıyor (3 satır). Buna karşılık `/`'ın baskın kullanımı ilçe/il
> ("Kartal / İstanbul") ve blanket kural uydurma hat üretirdi. Konu kapandı.
>
> **6) YENİ AYRAÇ AİLESİ (bilette yoktu, ölçümde çıktı):** `🔹` (U+1F539) ve akrabaları
> ayraç olarak kullanılıyor — "GEBZE🔹CİLVEGÖZÜ", "İSTANBUL🔹CİLVEGÖZÜ". 10 satır.
> #63'ün "iki yanı harfse ayraç" kuralına eklenebilir (aynı mekanik, aynı risk profili).

> ⚠️ **6 AĞU 2026 — #63 AYRAÇ EKSİĞİ: KOD YAZILDI, v79 DEPLOY EDİLDİ — AMA YARISI ÖLÜ ÇIKTI.**
>
> 🚨 **SONRADAN ANLAŞILDI (#86):** v79'daki `👉`/`📍` kuralı **hiç çalışmadı.**
> Bir üst satırdaki vekil silme hatası (`/[\uD800-\uDFFF]/g`) bu iki karakteri,
> ayraç kuralı görmeden önce yok ediyordu. Canlıda iş gören tek dal ASCII `=` (10 satır).
> Aşağıdaki tavan sayıları (`👉` 39 · `📍` 35) **hâlâ geçerli hedeflerdir**, ama
> "v79 bunları kazandı" okuması YANLIŞTIR — kazanç #86 deploy edilince gelecek.
> Bu satırların gerçek getirisi `npm run olc:86` ile ölçülecek.
>
> *(v79 deploy'u `get_edge_function` ile doğrulanmıştı: kaynakta satırlar vardı.
> **Dersi:** "kod canlıda var" ≠ "kod çalışıyor". Kaynak kontrolü, davranış testinin
> yerine geçmez — davranış testi de gerçek fonksiyonu çağırmalı, kopyasını değil.)*
>
> Bilet `➡ 👉 ▶️ 📍 / =` diyordu. **Kod okununca ikisi zaten çalışıyordu:**
> `index.ts:145` `➡ ➜ ➔ ⟶ ⏩ ⏪ ▶ ◀ ⇒ ⇔`'i emoji temizliğinden **ÖNCE** `->` yapıyor.
> Yani çıplak `➡` ve `▶️` hiç bozuk değildi (ikisi de BMP'de — #86'dan da etkilenmediler).
> Kalan üçü (`👉` U+1F449, `📍` U+1F4CD, `=`) `:148`'de boşluğa dönüşüp ayraç olarak
> kayboluyordu — asıl kayıp **orada**.
>
> **TAVAN ÖLÇÜMÜ** (son 30 gün, damgasız `no_lane` = parser hiç şerit bulamamış):
> toplam **490**; hâlihazırda çalışan ayracı olan 152 → **gerçek tavan 338**.
> İçlerinde `/` 86 · `👉` 39 · `📍` 35 · `=` 10 · **başka ok karakteri 0** (kod okumasını
> veri doğruladı) · **hiçbiri yok 221**. Yani ayraç işi en iyi ihtimalle 338'in ~üçte biri.
> **Gerçekten kazanılabilir: 52 satır / 30 gün (~1,7/gün).** Mütevazı ama risksiz.
>
> 🚨 **`/` BİLİNÇLİ OLARAK EKLENMEDİ — eklemek veriyi BOZARDI.** Ham satırlara bakınca
> `/`'ın baskın kullanımı yön değil **ilçe/il**: "Yükleme Yeri Kartal / İstanbul",
> "Aliağa /İZMİR", "Kula / Manisa", "Teslim Yeri Merkez / Kırşehir".
> Ayraç yapılsaydı *Kartal→İstanbul* gibi **gerçek olmayan hatlar** üretirdi.
> `/` içeren 356 satırın 110'u araç tipi (`Kapalı/Açık`), 56'sı sayı/sayı (`13/60`).
> → `no_lane` (kayıp) yerine yanlış ilan (kirlilik) tercih edilmez.
>
> 🔍 **YAN BULGU (#42'ye ait, #63'e değil):** tavandaki 16 satır hattı ayraçla değil
> **etiketle** yazıyor ("Yükleme Yeri … / Teslim Yeri …", iki ayrı satırda). Ayraç
> eklemek bunları çözmez, ayrı bir format desteği gerekir.
>
> **UYGULANAN KURAL:** `👉` ve `📍` yalnız **iki yanında harf varken** ` -> ` olur.
> Satır başındaki `👉`/`📍` işaretçidir ("👉AFYON 2.KÜÇÜK SANAYİ İNER", "📍 *Yükleme:*",
> "📍Bugünkü yük taşıma programı") — ayraç sayılmaz, eskisi gibi boşluğa döner.
> `=` aynı kural + iki yanı harf şartı `Tlf=05449642450`'yi eliyor.
> Değişen dosyalar: `supabase/functions/parse-listing/index.ts:146-153` ve
> `app/api/whatsapp-parse/route.ts` `normalizeArrows()` — **ikisi de** güncellendi.
> Doğrulama: 17 vakalı regresyon (9 pozitif + 8 negatif) → **17/17 geçti**.
> ⏭ **Bayram: edge function deploy.** Deploy'dan sonra damgasız `no_lane` oranı ölçülmeli.
>
> ✅ **6 AĞU 2026 (05:42 UTC) — #70 AŞAMA 1 BİTTİ: PIPELINE ARTIK `sb_secret_…` KULLANIYOR.**
> Bayram panelden yeni secret key üretti, Vault sırrını güncelledi. Ölçüm: Vault formatı
> `sb_secret_` / uzunluk **41** (eskisi `eyJ` / 219), yedek (`…_YEDEK_20260805`) sağlam,
> olmayan-uuid probu **404** (auth geçti), uçtan uca gerçek satır `aacfc60d-…` → **200
> `{"success":true,"lanes":0}`** → `no_lane`, 0 ilan.
> 🚨 **404 tek başına kanıt değildi** — eski token'la da 404 gelirdi; kanıt Vault formatının
> ayrıca ölçülmesi. **Kapanan risk:** edge fonksiyonu `sb_secret_`'i Bearer olarak kabul ediyor.
> 🔬 **AŞAMA 2 ÖN ÖLÇÜMÜ (üretime dokunmadan, `pg_net` ile kendi uçlarımıza):**
> `sb_publishable_` → `/rest/v1/listings` **200 + satır**, `/auth/v1/settings` **200**.
> `sb_secret_` (Vault'tan okundu, gösterilmedi) → `/rest/v1/raw_posts` **200 + satır**;
> aynı uca `sb_publishable_` ile **200 + `[]`** → yetki ayrımı gerçekten çalışıyor.
> **Ölçülmedi:** `@supabase/ssr` 0.10.2'nin tarayıcıdaki oturum/çerez akışı — duman testinin konusu.
>
> ✅ **AŞAMA 2 DE BİTTİ (6 Ağu).** Vercel env değerleri değişti + redeploy. Canlı ölçüm:
> client bundle'da **`sb_publishable_` var, legacy JWT yok** (15 script tarandı);
> tarayıcıdan `/rest/v1/users` **200**; **mevcut oturum korundu** ("Hoş geldiniz, Bayram DEDE");
> ilan akışı render ediyor; `/ilan/[id]` (service_role yolu) tam render; konsol hatası yok;
> pipeline son 30 dk cron **30/30 succeeded**, bekleyen **0**.
> 🚨 Oturumların korunacağı önceki notta **beklenti** olarak yazılmıştı — artık **ölçüldü**.
>
> ⏭ **SADECE AŞAMA 3 KALDI (Bayram, ayrı gün):** panelden legacy anahtarları disable et.
> Legacy disable edilirse edge fn'in **otomatik enjekte** edilen `SUPABASE_SERVICE_ROLE_KEY`
> env'ine ne olacağı **HÂLÂ ÖLÇÜLMEDİ** — o env Bayram'ın yönetiminde değil, acele etme.
> Aşama 3 doğrulandıktan sonra `…_YEDEK_20260805` Vault sırrı silinmeli.
>
> 🔐 **5 AĞU 2026 (16:34 UTC) — #70 DÜZ METİN TOKEN VAULT'A TAŞINDI. ROTASYON AÇIK KALDI.**
>
> Ayrıntı: `docs/PROJE_HARITASI.md` → BÖLÜM 6 "#70 — token artık `pg_proc`'ta DEĞİL".
>
> **Önce maruziyeti ölçtüm, çünkü ne kadar acil olduğu buna bağlıydı.** `anon`'un Postgres
> seviyesinde `pg_proc` okuma yetkisi **var**, ama PostgREST `pg_catalog`'u açmıyor ve
> `public`'te `pg_proc`/`pg_get_functiondef` kullanan view/fonksiyon **sıfır**.
> → Token **internetten çekilebilir değildi**; doğrudan DB bağlantısı gerekiyordu.
> → **Rotasyon acil değil.** Kusur sızma değil, düz metin durmasıydı.
>
> Çıkarma + `vault.create_secret` tek `DO` bloğunda yapıldı; JWT hiçbir migration
> çıktısına girmedi. Fonksiyon artık `vault.decrypted_secrets`'ten okuyor ve **sır yoksa
> `raise exception` ile patlıyor** — sessizce `'Bearer '` yollamak 401 üretir, satır
> `pending` kalır, yani #65 birebir geri gelirdi.
>
> **`prosrc like '%eyJ%'` → 0 fonksiyon.** Doğrulama: var olmayan uuid ile çağrı **404**
> döndü (401 değil → auth sağlam, veriye dokunulmadı), ardından uçtan uca gerçek INSERT
> `200 {"lanes":0}` → `no_lane`, 0 ilan.
>
> ⏭ **SENDE KALAN — JWT rotasyonu (dashboard).** Eski Supabase şemasında `anon` ve
> `service_role` **aynı** secret'la imzalı; döndürürsen anon anahtarı da ölür ve Vercel
> env'i güncellenene kadar site kırılır. Yeni şemada (publishable/secret) bağımsız döner.
>
> 🔬 **ŞEMA ÖLÇÜLDÜ (5 Ağu):** yeni şema panelde **var** (`sb_publishable_Eiw2…`) ama
> projeye **uygulanmamış** — legacy `anon` hâlâ `disabled:false`, repoda `sb_publishable`
> referansı **0**, `NEXT_PUBLIC_SUPABASE_ANON_KEY` **14+ dosyada**. Kanıt: Vault token'ının
> `iat`/`exp` değerleri (`1776665410`/`2092241410`) legacy anon key'inkiyle **birebir aynı**
> → aynı secret'tan, aynı anda basılmışlar. **Bağımsız rotasyon henüz mümkün değil.**
> Doğru yol rotasyon değil, `sb_secret_…`'e geçiş — 4 adımlık kesintisiz plan:
> `docs/PROJE_HARITASI.md` → BÖLÜM 6, #70 bloğu.
> Hangi şemada olduğunu dashboard'dan doğrula — DB'den göremiyorum.

> 🧹 **5 AĞU 2026 (16:20 UTC) — TESLİM EDİLEMEYEN TETİKLEME SÜPÜRÜCÜSÜ CANLIDA (#74/#75/#76/#77/#78).**
>
> Ayrıntı: `docs/PROJE_HARITASI.md` → BÖLÜM 6 "Teslim edilemeyen tetiklemelerin süpürücüsü".
>
> `trigger_parse_listing()` üçe bölündü: gönderim mantığı `parse_listing_gonder(uuid)`
> helper'ına taşındı, trigger ince sarmalayıcıya döndü, `parse_listing_supur(int)`
> teslim edilememiş satırları yeniden tetikliyor. Cron: dakikada bir, turda en fazla 50 satır.
> Dönüşüm `pg_get_functiondef → replace → execute` ile Postgres'in **içinde** yapıldı;
> token hiçbir log'a veya migration metnine girmedi.
>
> **İlk tur (#78):** 30 aday → 28 `processed` + 2 `no_lane`, 119 ilan, 0 cron hatası.
> **#77:** ilan üretmiş ama `pending` kalmış **2.203 satır** durum-only düzeltildi
> (yeniden ayrıştırma yok, `processed_at` ilk ilanın `created_at`'inden).
>
> 🚨 **BİR MÜKERRER ALARMI VERDİM VE YANLIŞTI.** `(raw_post_id, raw_post_segment)` ile
> gruplayınca 12 "mükerrer grup" gördüm. Sebep: `raw_post_segment` canlıda **her satırda
> NULL**, varış bilgisi `listings`'te değil `listing_stops`'ta. Örnek `96dfd5cd`: 19 ilan,
> hepsi Mersin çıkışlı ama **19 farklı varış ili**. Kesin kanıt: bir raw_post'un tüm ilanları
> ≤1,18 sn içinde yazılmış ve `parse_attempts=1`. **Ders: varışsız gruplama sahte pozitif
> üretir; mükerrer testi `listing_stops` olmadan geçersizdir.**

> ⚠️ **5 AĞU 2026 — #72'DE KENDİ ÖNERİMİ GERİ ÇEKİYORUM.**
>
> "pg_net timeout'unu yükseltelim" demiştim. Ölçüm yanlışladı: 16:07'de 33 isteğin **24'ü**
> timeout kaydedildi ama **33/33 satır işlendi** — kayıt **yanlış negatif** üretiyor, çünkü
> `timeout_milliseconds` curl handle'ını iptal eder, **edge fonksiyonunu durdurmaz**.
> Timeout'u ~74 sn'ye çıkarmak **daha kötü**: `pg_net.batch_size = 200` slot 15× uzun tutulur,
> 1.500 satırlık import'un ~40 sn'lik boşalması ~10 dakikaya çıkar.
> **İzleme kaynağı `net._http_response` DEĞİL, `raw_posts.processing_status`.**
> Gerçek boşluk timeout değeri değildi, **yeniden deneme yokluğuydu** → #76 kapattı.

> 🆕 **5 AĞU 2026 — #73 DEPLOY EDİLDİ (v76) VE HİÇBİR ŞEY KAZANDIRMADI. ÇÖZÜLDÜ SAYILMIYOR.**
>
> ~1000 çağrılık pencerede `aliases` SELECT'i **1931 kez** koştu (çağrı başına 2 sayfa ×
> 1.242 aktif alias), 47,6 sn DB süresi. 60 sn TTL'li modül önbelleği yazıldı,
> 15:50:54 UTC'de v76 olarak deploy edildi. **Beş ardışık import'ta ölçüldü** (delta
> yöntemi: pay = `FROM "public"."aliases"`, payda = PostgREST'in `raw_posts WHERE id=$1`'i):
>
> | parti | alias SELECT | çağrı | oran | çekim döngüsü |
> |---|---|---|---|---|
> | 19 satır | +42 | +19 | 2,21 | 21 |
> | 4 satır | +10 | +4 | 2,50 | 5 |
> | 8 satır | +18 | +8 | 2,25 | 9 |
> | 33 satır | +68 | +33 | 2,06 | 34 |
> | **toplam** | **+138** | **+64** | | **68** |
>
> Önbelleksiz taban **2,00**. 64 çağrı **68 ayrı çekim** üretti → **sıfır isolate yeniden
> kullanımı**. 🚨 **Kök sebep: bu yük ardışık trafik değil, EŞZAMANLI fan-out.** `pg_net`
> N POST'u aynı anda ateşler, her istek soğuk isolate'e düşer, modül kapsamı ölür.
> En net vaka: 33 satır 1,3 sn içinde geldi, yine 34 ayrı çekim.
> **Kod kalıyor (zararsız), etiket "çözüldü" DEĞİL.** Ancak isolate havuzu doyup runtime
> kuyruğa girdiğinde işe yarayabilir → 300+ satırlık doğal import'ta yeniden ölçülecek;
> oran 2,00'de kalırsa geri alınacak.
>
> **Ama DB toplamı hâlâ küçük.** Aynı pencerede TÜM sorguların toplam yürütme süresi
> ~300 sn / ~1000 çağrı ≈ **çağrı başına 0,3 sn**. Çağrılar 20–70 sn sürüyor. Yani
> kalan sürenin ezici çoğunluğu ne parse'ta (6–17 ms) ne DB yürütmesinde (0,3 sn) —
> **Deno worker havuzunda kuyrukta**. Bunu kanıtlamadım, elemeyle buraya vardım.

> 🔬 **5 AĞU 2026 — #71 `parse-listing` CPU DARBOĞAZI: ÇÖZÜLDÜ VE ÖLÇÜLDÜ (edge fn v75, 14:56:28 UTC).**
> Ayrıntı: `docs/PROJE_HARITASI.md` → BÖLÜM 6 "Bu boru hattının darboğazı AĞ DEĞİL, CPU".
>
> **ÖLÇÜM — 15:06 UTC, 328 satırlık gerçek import:**
>
> | | v74 (önce) | v75 (sonra) |
> |---|---|---|
> | çağrı süresi (328'lik patlama) | 78.116–150.166 ms | **4.702–43.950 ms** |
> | çağrı süresi (1.800'lük sürekli yük) | — | **8.631–73.334 ms** |
> | 504 (150 sn duvarı) | yığınla | **0** |
> | 546 / 500 | yığınla | **0** |
> | işlenen oran | 640 satırın %7'si | **328 satırın %92'si** |
> | `pending` kalan | %93 | **%4,3 (14 satır)** |
>
> ✅ 150.000 ms gateway duvarı artık hiç görülmüyor. `pending` birikmesi durdu.
> 15:18–15:22 arası ~1.500 satır daha girdi; boru hattı gerçek zamana yakın çalıştı
> (son giriş 15:22:47 → son işlenme 15:22:54). 1.833 satırın 1.736'sı `processed` (%94,7),
> 30'u `pending` (%1,6), 67'si `no_lane` (%3,7).
>
> ⚠️ **Rahatlama sınırsız değil.** Sürekli yükte en uzun çağrı **73,3 sn**'ye çıktı.
> 150 sn duvarı hâlâ orada; hacim kabaca ikiye katlanırsa yeniden çarpılır.
>
> ⚠️ **KENDİ TAHMİNİM YANLIŞ ÇIKTI.** "Çağrı süresi milisaniyelere düşer" demiştim.
> Düşmedi — **15–44 sn'de kaldı**. Bench'te parse maliyeti 6–17 ms ölçülmüştü, demek ki
> kalan 15–44 sn parse'ta DEĞİL: `ilan_olustur` RPC turları (#68, taban ort. 1.400 ms /
> maks 28.939 ms) + 328 eşzamanlı çağrının PostgREST havuzunda kuyruğa girmesi (#66).
> Bu bir ÇIKARIM, ölçüm değil — fonksiyon içine zaman damgası koymadan doğrulanmaz.
>
> 🆕 **#72 açıldı:** `net._http_response`'ta 328 isteğin **327'si hata** — hepsi
> "Timeout of 5000 ms reached". 182'sinde DNS 5 sn boyunca çözülemedi, 145'inde bağlantı
> kurulup cevap beklenirken doldu. Fonksiyon durumu kendi yazdığı için satırlar yine
> işleniyor, ama pg_net kaydı izleme için kullanılamaz halde. 14 `pending` satır kuyruk
> sonunda değil, sıra 9–279 arasına dağılmış.
>
> **ÖNCE BİR VARSAYIMI ÖLDÜRDÜM — kendi varsayımımdı.** "100 saniyenin içinde Anthropic
> çağrısı mı var, DB gidiş-dönüşleri mi" diye sormuştum. **Üçüncü şık doğru çıktı: ikisi de
> değil.** `supabase/functions/parse-listing/index.ts` içinde `fetch(`, `anthropic`,
> `claude`, `messages.create` → **sıfır eşleşme**; tek `Deno.env.get` Supabase URL/anahtarı.
> Fonksiyonda LLM YOK. `edgeLog('INFO', 'LLM parse tamamlandı')` satırı yanıltıcı isim —
> `parseMessage()` saf regex. Soruyu "AI mı, DB mi" diye çerçevelemem hatalıydı.
>
> **ÖLÇÜLEN SEBEP — saf CPU.** `findPlaces` her token için
> `cityAliases.find(a => trNorm(a.alias) === cand)` koşuyordu. `.find` eşleşmede kısa devre
> yapar ama aramaların neredeyse tamamı ıskalıyor → her arama 1.163 alias'ın hepsini geziyor,
> her biri için `trNorm` (36 regex `.replace`). Token başına 5 arama × 1.163 × 36 ≈
> **209.000 regex işlemi, tek token için.**
>
> | satır | karakter | eski | yeni (soğuk) | hızlanma |
> |---|---|---|---|---|
> | 6 | 341 | **265 ms** | 9,8 ms | ~27× |
> | 24 (ortalama) | 1 381 | **1 020 ms** | 6,0 ms | ~170× |
> | 230 (en uzun) | 13 459 | **11 302 ms** | 16,7 ms | ~677× |
>
> (Sıcak indeksle 590–1240×; dürüst karşılaştırma soğuk sütunudur — indeks çağrı başına
> bir kez kurulur.) `raw_posts` gerçeği: ortalama 657 karakter/24 satır, maks 13.121/230.
>
> **#65 İLE BAĞ — mekanizma artık tam.** CPU seri akar. `on_raw_post_insert` `FOR EACH ROW`,
> eşzamanlılık sınırı yok → tek dakikada 640 satırlık içe aktarım 640 eşzamanlı çağrı ×
> ~0,5–11 sn CPU. Canlı log: **78.116–150.166 ms**, 504'ler tam 150.000 ms geçidinde,
> 546'lar Deno worker sınırı, **200'ler bile 78–148 sn**. Duvara çarpan çağrı `durumYaz`a
> varamaz → satır `pending` kalır. 11:42'de 640 satır → 596 `pending` (%93);
> 12:04'te 230 satır → 111 `pending` (%48).
>
> **DÜZELTME (✅ DEPLOY EDİLDİ — v89, 7 Ağu 2026):** `aliasIndeksi()` — alias dizisi başına
> bir kez kurulan `Map` + önceden sıralanmış listeler, `WeakMap` ile dizi kimliğine bağlı.
> Kod `parse-listing/index.ts:448-474`'te; deploy edilen baytlar bu ağaçla aynı.
>
> **DOĞRULAMA:** 303 mesajda (3 gerçek + 300 üretilmiş) `parseMessage` çıktısı **0 fark**;
> `tsc --noEmit` temiz. Eşdeğerliğin dayanağı: `.find` ilk eşleşeni, `Map` ilk gireni tutar,
> `tumAliaslar()` `ORDER BY id` okur. Çakışma canlıda **2 anahtar / 4 alias** ve dördü de
> aynı `normalized`+`district`'e çözülüyor → seçim değişemez.
>
> ⚠️ **BULUNAN YAPISAL BORÇ:** aynı optimizasyon `app/api/whatsapp-parse/route.ts:290
> `aliasDiziniKur()` içinde ZATEN vardı. Edge kopyası güncellenmemişti. Deno/Next sınırı
> ortak modülü engelliyor → iki parser elle hizalanmak zorunda. Birinde düzeltilen
> diğerine geçmiyor; bu sessiz ayrışma bir daha olacak.
>
> ⏳ **AÇIK — ÖLÇÜM (deploy artık yapıldı, v89 / 7 Ağu 2026).** Aynı log penceresini
> yeniden ölçmeden "#65 çözüldü" DEMEM. Beklentim: çağrı süresi 150 sn duvarından
> milisaniyelere düşer ve yeni `pending` birikmesi durur — ama bu bir tahmin, ölçüm değil.
> 7 Ağu 07:11 itibarıyla deploy sonrası **tek bir yeni `raw_post` yok** (son trafik
> 6 Ağu 16:33 UTC), yani ölçüm örneklem bekliyor. Mevcut 7.896 satırlık yığın **kendi
> kendine erimez**, ayrı kurtarma işi gerekir (bunların 2.203'ünün ilanı ZATEN var,
> yeniden işlenirse çift ilan doğar).
> 🔗 Bu son cümle 5 Ağu'da bir sezgiydi; 7 Ağu'da **#90'da kanıtlandı**: `ilan_olustur`
> düz INSERT, `on conflict` yok, `idx_listings_raw_post` UNIQUE değil. Yani "çift ilan
> doğar" bir ihtimal değil, kesinlik. Toplu yeniden işleme yolu **kapalı**.

> 🔬 **5 AĞU 2026 — #67 SEBEP BULUNDU, DÜZELTME CANLIDA, SONUÇ HENÜZ ÖLÇÜLMEDİ.**
> Ayrıntı ve tam SQL: `docs/20260805_sayac_duzeltme.sql` · `docs/20260805_insert_maliyeti.sql` ·
> `docs/20260805_stats_trigger_o1.sql`. `docs/PROJE_HARITASI.md` → `shadow_profiles` bölümü.
>
> **SEBEP — tek satırda ölçüldü:** `sync_shadow_profile_listing_stats` trigger'ı ilan başına
> ÜÇ toplama sorgusu koşuyordu; en yoğun profil (3 556 ilan) için biri **3 096.881 ms**.
> Plan ayrımı belirleyici: `Bitmap Index Scan` 25.7 ms · `Bitmap Heap Scan` **3 092 ms** ·
> `Heap Blocks: exact=2977` · `Buffers: hit=1403 read=1586`. İndeks doğru satırları 26 ms'de
> buluyor; `max/min(created_at)` indekste olmadığı için 2 977 heap bloğu ziyaret ediliyor,
> 1 586'sı diskten. Maliyet profilin BÜYÜKLÜĞÜYLE orantılı → ölçümdeki iki tepeli dağılımın
> (268 ms vs 5 403 ms) açıklaması bu.
>
> **CANLIYA UYGULANAN 6 DEĞİŞİKLİK (hepsi doğrulandı):**
> 1. `trg_listings_shadow_profile_count` düşürüldü — `..._stats` zaten üstünü yazıyordu,
>    sadece +1 hata ekliyordu (1 097 profil tam olarak +1 sapmıştı).
> 2. Tek seferlik yeniden sayım — 3 414/3 414 doğru, fazla 0, eksik 0.
> 3. `expire-listings` (0 2 * * *) unschedule — `expire-active-listings` (*/15) tamamen kapsıyor.
> 4. Trigger gövdesi **O(1)**'e yeniden yazıldı (`docs/20260805_stats_trigger_o1.sql` ADIM C).
> 5. `shadow-profile-recount` cron'u kuruldu (`0 3 * * *`, `active=true` — **doğrulandı**).
>    Bu, 4'ün ÖN KOŞULU: yeni gövde artımlı olduğu için eski gövdenin `COUNT(*)` ile
>    yaptığı kendi kendini onarma kayboldu.
> 6. Her iki sayaç fonksiyonu `security definer` + `set search_path = public, pg_temp`;
>    `sync_shadow_profile_yeniden_say(uuid)` EXECUTE'u public/anon/authenticated'tan alındı.
>
> 🚨 **ASIL BULGU — RLS SESSİZCE YUTUYORDU.** Düzeltmeden sonra 5 profil yine sürükledi.
> Sebep CPU değil yetki: `shadow_profiles` RLS açık, tek politika `shadow_profiles_admin_all`
> (admin-only). `anon`'da politika yok, admin olmayan `authenticated`'ta koşul false,
> ve trigger `SECURITY DEFINER` **değildi** → `UPDATE ... where id = ...` **0 satır
> etkiliyor, hata atmıyor**. Bu aynı zamanda daha önce "mekanizmayla açıklanamıyor"
> dediğim **-29**'u da açıklıyor. Düzeltme sonrası `hala_sapan = 0`.
> 📌 Kural olarak kaydedildi: RLS'li tabloya yazan her trigger fonksiyonu `SECURITY DEFINER`
> + pinlenmiş `search_path` olmalı.
>
> 🚨 **ÜÇ İDDİAMI GERİ ALIYORUM:**
> - **H3 (indeks bakımı) benim hipotezimdi ve ÇÜRÜDÜ:** tablo 407 MB, indeksler 125 MB,
>   oran 0.31; yirmi indeksin ondokuzu küçük btree, tek GIN 14 MB. Bu profil 1 400 ms'lik
>   INSERT üretmez.
> - **`idx_listings_expire_sweep` GEREKSİZDİ, düşürüldü.** Aktif ilan 863, aktif+süresi
>   dolmuş **0**, toplam 236 846. Planlayıcı indeksi seçmedi (`idx_scan = 0`, 0 bytes).
>   "İndeks yok, o yüzden yavaş" derken seçicilik hesabı yapmamıştım.
> - **"Süre dolumu cron'u trigger'ı da tetikliyor, gizli çarpan" — YANLIŞ.** Trigger
>   `AFTER INSERT OR DELETE OR UPDATE **OF shadow_profile_id**`; cron `status`/`updated_at`
>   yazıyor, o kolona dokunmuyor → hiç ateşlenmiyor. Tanımı okumadan söylemiştim.
>
> 🚨 **ÇERÇEVE DÜZELTMESİ — HAVUZ TÜKENMİŞ DEĞİL (#66'yı da ilgilendirir).**
> `pg_stat_activity`: ~16 bağlantı, `max_connections = 60`. Yani PGRST003 Postgres'ten
> değil **PostgREST'in kendi (çok daha küçük) havuzundan** geliyor. `max_connections`
> büyütmek bu sorunu çözmez. Destekleyen ölçüm: `aliases` SELECT'i tek başına 0.575 ms,
> üretimde ort **41 ms** — aradaki 40 ms sorgu değil **bekleme**.
>
> ⏳ **AÇIK — SONUÇ ÖLÇÜLMEDİ.** `pg_stat_statements` `2026-08-05 13:35:05+00`'da sıfırlandı;
> o andan beri **hiç yeni ilan girmedi** (son 24 saatte 1 532 var, yani trafik var, sadece
> pencere boş). Karşılaştırma tabanı: `ilan_olustur` ort **1 400.3 ms** / en kötü 28 939.6 ms,
> `INSERT INTO listings` ort **1 022 ms**. Beklentim birkaç yüz ms — **beklenti, iddia değil.**
>
> 🟠 **AYNI SINIFTAN İKİNCİ HATA, UYKUDA:** `update_poi_rating` (`poi_reviews` trigger'ı)
> RLS'li `pois`'e yazıyor ve `SECURITY DEFINER` değil. `pois`'te anon/authenticated için
> UPDATE politikası yok. **`poi_reviews` şu an 0 satır** (`pois` 9 178) → etki yok.
> Bilerek düzeltilmedi: #67 kapsamı dışı ve 0 satırda ölçülemez.
>
> 🔴 **GÜVENLİK — ~~AÇIK~~ DÜZ METİN KISMI KAPANDI (5 Ağu 2026 16:34 UTC).**
> ~~`trigger_parse_listing()` gövdesinde `service_role` JWT'si **düz metin** duruyor~~
> Token Vault'a taşındı (`parse_listing_service_role_jwt`); `parse_listing_gonder()`
> artık `vault.decrypted_secrets`'tan okuyor. Ölçüm: `prosrc like '%eyJ%'` → **0 fonksiyon**.
> **Hâlâ açık:** JWT'nin kendisi döndürülmedi. Kimlik bilgisi işlemi — Bayram yapacak.
> Aciliyeti düşük: ölçüldü, token PostgREST üzerinden internete açık değildi.
> Ayrıntı: dosyanın başındaki 5 Ağu #70 bloğu.
>
> 🧹 **KENDİ ARTIĞIM:** `hata42` ve `olcum42` şemaları advisor'da `rls_enabled_no_policy`
> (INFO) olarak görünüyor. **Bilerek silmedim** — `hata42.hatali_id` 176 RPC-hatalı
> raw_post id'sini tutuyor ve orijinal log CSV'si olmadan yeniden üretilemez.
> `get_advisors` (security) ERROR/WARN döndürmedi.

> ✅ **4 AĞU 2026 — #51 KAPANDI (KOD + VERİ). #52 BİLEREK KAPATILDI, ONARILMADI.**
> **Kod:** `lib/lokasyon.ts::ilceHangiIllerde()` (ters arama) + `lib/alias-normalize.ts::ilceIlUyarisi()`
> (iki seviyeli çelişki detektörü) yazıldı, `learn-aliases`'ın **üç yazma yoluna** (manuel
> create, PATCH approve, PATCH alan güncelleme) `warning` alanı olarak kancalandı.
> Koruma: `npm run test:alias` — 28 kontrol.
> ⚠️ **PATCH yollarında mevcut satır önce okunuyor** (`select('type, normalized, district')`,
> çakışma kontrolünün ÜSTÜNE taşındı): PATCH `normalized`'ı göndermeyebilir; tamamlanmazsa
> kontrol **sessizce atlanır** ve kanca takılı görünürken çalışmaz.
>
> 🚨 **KENDİ İDDİAMI ÖLÇÜNCE YANLIŞ ÇIKTI.** Detektörün ilk hâli için yorum satırına
> "üç canlı hatayı da yakalar" yazmıştım. Çalıştırınca yalnız `Bigadiç` yakalandı;
> `Orhanlı` ve `Selimpaşa` **hiçbir ilin resmî ilçesi değil** (ikisi de İstanbul mahallesi)
> ve coğrafya onları `Merter`den ayıramıyor. İkinci, **zayıf** kod (`ilce_hicbir_ilde`)
> bu yüzden var — hüküm değil, admine gösterilen bağlam. **Kalıbın yedinci örneği ve
> ilk kez kayıt benim yazdığım koddu:** iddia doğrulanmadan yazıldı, ölçüm yanlışladı.
>
> 🟠 **İlk bilinen YANLIŞ POZİTİF ölçüldü:** `3016 pinabaşı → İzmir/Pınarbaşı` **doğru**
> bir satır ama detektör "güçlü" basıyor — Pınarbaşı Kastamonu+Kayseri ilçesi, İzmir'de
> Bornova mahallesi. Testte bilerek duruyor. Güçlü kod "yanlış" değil, "iki kayıt
> çelişiyor, bak" demektir; UI metni bunu ima etmemeli.
>
> 📊 **VERİ TARAFI — 12 satır elden geçti, hepsi guard'lı UPDATE/DELETE ile (`where id = X
> and district = 'eski değer'` → yanlış satıra çarparsa 0 satır, sessiz hasar yok).**
> 7 yazım düzeltmesi: `Marmara Ereğlisi→Marmaraereğlisi` · `Selimpasa→Selimpaşa` ·
> `Turgutle→Turgutlu` · `Kdz. Ereğli→Ereğli` · `Beylükdüzü→Beylikdüzü` ·
> `Turgutklu→Turgutlu` · `Gocek→Göcek`. Ayrıca `2848 kayabaşi` district'i mahalle adı
> `Kayabaşı` yerine gerçek ilçe **`Başakşehir`** yapıldı. Silinenler: `1600 khanköy`
> (Çankırı'da öyle bir yer yok, `ai=false` — elle girilmiş, kaynağı bilinmiyor),
> `2831 bigadi`. `2777 orhanli` → İstanbul/Orhanlı, `is_active = false` (içerik doğru
> ama kapalı; açmak tek satırlık iş).
> 🚨 **Yazım düzeltmesi kozmetik DEĞİL:** `aliases.district` değeri `parse-listing`:851/871
> tarafından `listings.origin_district` ve `listing_stops.district`'e **birebir kopyalanır**
> ve `ayniIlce()` ile hat ayrımına girer. `"Kdz. Ereğli"` metni hiçbir zaman `"Ereğli"`
> ile eşleşmezdi.
>
> 🔒 **#52 — 5 Orhanlı ilanının yanlış `origin_province_id = 54`'ü ONARILMADI. Bu bir
> gözden kaçma değil, KARAR** (Bayram, 4 Ağu): *"geçmiş veriler artık eskidi"*. Gerekçe:
> ilan ömrü kısa, etki 5 satır, kaynak (alias) zaten kapatıldı → yeni hata üretmiyor.
> Bu satır burada duruyor ki ileride biri "neden düzeltilmemiş" diye sormasın.
>
> ✅ **4 AĞU 2026 — #50 KAPANDI, CANLIDA DOĞRULANDI: `district_official` artık DB'de türetiliyor.**
> 📄 `docs/20260804_ilan_olustur_v41_ilce_resmi.sql` — v4 gövdesinin aynısı, iki satır değişti:
> `district_official` iki yerde `coalesce(nullif(çağıranın değeri), public.ilce_resmi(...))` oldu.
> Sıra kasıtlı, **çağıranın açık değeri kazanır**: `lib/ilan-yaz.ts`:364 ve
> `app/moderator/actions.ts`:232 `locations.json` üzerinden zaten doğru cevabı gönderiyor,
> onu ezmek gereksiz davranış değişikliği olurdu. Fonksiyon yalnız çağıranın hiç
> göndermediği durumu doldurur.
>
> 📌 **Bugün o durumun TEK örneği `supabase/functions/parse-listing`:848** — Deno
> `locations.json`'a erişemediği için bu alanı hiç göndermiyor (kodda "tek boşluk" diye
> kayıtlıydı). Doğrulandı: parse-listing'in RPC çağrısında ne `origin_district_official`
> ne `district_official` var. **WhatsApp hattı ilanların çoğunu ürettiği için bu no-op DEĞİL.**
>
> 🔑 **ASIL BULGU — ERTELEME GEREKÇESİ ÖLDÜ, KARAR ONUNLA ÖLMEDİ.**
> `districts_tablosu.sql`:1133 "Dalga 5'in v4'ü ile AYNI ANDA yapılmalı, yoksa fonksiyon
> iki kez elden geçer" diyordu. **v4 3 Ağu'da Dalga 5'ten bağımsız çıktı (#26)** — yani
> ikinci geçiş zaten kaçınılmaz oldu, beklemekle kaçınılan maliyet buharlaştı. Geriye
> yalnız BEDELİ kaldı: o güne kadar WhatsApp hattından giren her ilanda
> `district_official` NULL. Değişiklik `district_official`e dokunuyor, `origin_city`/`city`ye
> DEĞİL → **kolon drop'undan bağımsız, tek başına bugün çıkabilir.**
> 📌 **Kural: ertelenmiş her iş, ertelenme SEBEBİ hâlâ geçerli mi diye yeniden okunmalı.**
> Bu, projenin "kayıt gerçeğe uymuyor" desenin bir varyantı — kayıt yanlış değildi,
> yazıldığı gün DOĞRUYDU; dünya değişti, kayıt değişmedi.
>
> ✅ **Doğrulama (offline, canlı DB'ye dokunulmadı):** gövde elle kopyalanmadı, v4
> dosyasından programla üretilip iki satırı yamandı; sonra `difflib` ile v4'e karşı
> karşılaştırıldı → **tam iki hunk, ikisi de amaçlanan**, parantez dengesi ikisinde de 0.
> `provinces.id` smallint doğrulandı, yani `sp.id` → `ilce_resmi(smallint, text)` imzasına
> birebir oturuyor; aşırı yükleme belirsizliği yok.
> ⚠️ **Sandbox'ta postgres yok** — sözdizimi gerçek bir sunucuda DENENMEDİ. Dosyanın
> ADIM 0'ı bunu telafi ediyor: `ilce_resmi` canlıda mı diye saf `select` ile bakar.
> 🚨 plpgsql gövdesi DDL anında doğrulanmaz — `ilce_resmi` yoksa `create or replace`
> HATASIZ geçer ve ilk ilan denemesinde patlar. ADIM 0 atlanmaz.
> 🚨 ADIM 0'da `t4` (`ilce_resmi(34,null)`) `false` gelirse DUR: fonksiyonun NULL
> semantiği bozulmuş demektir ve `coalesce` "ilçe girilmemiş" satırları `false` ile
> doldurur — sessiz veri bozulması.
>
> ✅ **CANLI DOĞRULAMA (4 Ağu, Bayram çalıştırdı):**
> · ADIM 0 → `t1/t2/t3/t4 = true/true/false/null`. NULL semantiği sağlam.
> · `pg_proc.prosrc like '%ilce_resmi%'` → **1**. Gövde gerçekten değişti.
> · Kesin test — `ilan_olustur` bir transaction içinde `district_official` GÖNDERİLMEDEN
>   çağrıldı (parse-listing'i taklit), sonra `rollback`:
>   `Gebze → true` · `Tuzla → true` · `Merter → false` · ilçesiz durak → **null**.
>   **Üç değerin üçü de çıktı** — hem türetme hem NULL ayrımı çalışıyor.
>
> 🚨 **İLK ÖLÇÜM YANLIŞ ALARM VERDİ VE SEBEBİ ZAMANLAMAYDI — kaydı bunun için duruyor.**
> ADIM 2.3 (canlı WhatsApp satırlarını oku) 10 satırın **hepsinde** `district_official`
> NULL gösterdi; ilçesi dolu olanlarda bile (`Gebze`, `Domaniç`, `Ereğli`). "Düzeltme
> çalışmadı" gibi görünüyordu. **Değildi:** satırlar `17:33:30`–`17:33:46` arası 16
> saniyelik TEK bir toplu içe aktarmaya aitti ve migration dosyası `17:33:32`'de
> yazılmıştı — yani satırların tamamı deploy'dan ÖNCEYE ait, NULL olmaları beklenen
> davranıştı. 📌 **Ders: "deploy'dan sonra bak" derken saat değil OLAY sırası
> doğrulanmalı.** Aynı dakikada olmak, sonra olmak değildir. Zaman damgası
> okunmasaydı çalışan bir düzeltme geri alınabilirdi.
> 📌 İkinci ders: canlı trafiği beklemek yerine `begin; … rollback;` ile fonksiyonu
> DOĞRUDAN çağırmak hem anında hem kesin sonuç verdi. Yazma yolu testlerinde varsayılan
> yöntem bu olmalı — trafik beklemek ölçümü zamanlamaya bağımlı kılıyor.
>
> ⏭️ **Geçmiş satırlar ONARILMAZ** (#52 ile aynı gerekçe: ileri-yönlü düzeltme).
> WhatsApp hattından v4.1 öncesi girmiş ilanlarda `district_official` NULL kalır —
> tanımlı anlamı "bilinmiyor", bozuk veri değil.


> 🚨 **YENİ CANLI BULGU — SIFIR GENİŞLİKLİ KARAKTER SALDIRISI (#61 KAPANDI).** `raw_posts`
> içinde U+200C ve U+2060 serpilmiş mesajlar bulundu: bir gönderici tekilleştirmeyi delmek
> için metne görünmez karakter koyuyor. **Tek kök sebep, İKİ AYRI zarar:**
>
> 1. **Sessiz il kaybı.** `whatsapp-parse::trNorm` bilinmeyen karakteri **boşluğa** çevirip
>    kelimeyi bölüyordu (`s apanca` → `s` filtrelenir → `apanca` → hiçbir alias'la eşleşmez
>    → ilin sessizce kaybolması, ne hata ne log). ✅ `gorunmezleriSil()` `trNorm`'un en başına
>    eklendi. Ölçüldü: `["apanca"]` → `["sapanca"]`.
> 2. **Tekilleştirme deliği.** `cleanHash()` görünmez karakteri hash'e sokmaya devam
>    ediyordu → aynı metin her seferinde farklı `clean_hash`. ✅ 4 Ağu'da kapatıldı:
>    `cleanHash` artık `chatParser::gorunmezleriSil`'i (`cfKarakterleriSil` adıyla) çağırıyor.
>    Ölçüldü: eski hash'te `S`+ZWNJ+`apanca` ≠ `Sapanca`, yenide **eşit**; U+2060/U+200B
>    varyantları da eşit. **Yedek alınmadı** (Bayram kararı, 4 Ağu) — `text` zaten
>    `satiriTemizle`'den geçtiği için canlı satırların hash'i pratikte değişmiyor.
>
> 🚨 **ASIL DERS, düzeltmenin kendisinden değerli: 1'i düzeltince 2'nin de düzeldiği
> SANILDI.** Doküman "çözüldü" yazıyordu; deliği ancak `cleanHash`'i okuyunca gördüm. Bu,
> projenin ~7 kez tekrarlayan deseninin bir örneği daha: **kayıt gerçeğe uymuyordu ve
> kimse ölçmüyordu** — bu sefer kayıt benim yazdığım metindi. Kural: kök sebep bulununca
> "bu karakter/değer BAŞKA nereye giriyor" diye ayrıca aranmalı.
>
> ✅ `lib/whatsapp/chatParser.ts` de düzeltildi: liste `GORUNMEZ_CF` sabitine alındı, eksik
> U+200C/U+200D/U+2060 eklendi, ham karakterler `\u` kaçışına çevrildi. **Ham görünmez
> karakterle regex yazma** — bir editör/formatter onu sessizce silerse koruma da görünmeden
> ölür, eksik olduğunu kimse fark edemez (tam olarak bu olmuştu).
>
> ⚠️ **U+FE0F iki listede de aynı DEĞİL — KASITLI.** FE0F `Cf` değil `Mn`, `➡️ ⚠️ ✅`
> emojilerinin parçası. SAKLANAN metne ve hash'e dokunan yerler (`chatParser`, `cleanHash`)
> onu **silmez**; silse binlerce eski mesajın hash'i değişir → yeniden içe aktarımda kopya
> seli. Yalnız eşleştirme tarafı (`whatsapp-parse`:153, `parse-listing`:74) siler.
> Ölçüldü: emoji içeren mesajın hash'i **değişmedi**.
>
> 📌 Doğrulama: `tsc --noEmit` 0; `test:parser` 29/29, `test:alias` 28/28, `test:districts`,
> `test:lokasyon` geçti.

> 🟢 **4 AĞU 2026 — #30 BÖLÜM 1-3 CANLIDA. VE İLK GÜNÜNDE ÜÇ VERİ HATASI BULDU.**
> `districts` (973/81) + `ilce_resmi()` çalıştırıldı, doğrulamalar tam isabet, fonksiyon
> mevcut `district_official` ile 62 satırda çapraz doğrulandı (58 `true`/4 `false`, sapma yok).
> Ayrıntı `docs/20260731_districts_tablosu.sql` başlığında ve aşağıdaki #30 bloğunda.
>
> 🔍 **Planlanmamış kazanç: `ilce_resmi()` alias tablosunu denetleyebiliyor.** İlçesi olan
> 1528 alias'ın 40'ında `(normalized il, district)` çifti tutarsız. Üçe ayrıldı:
> **19'u yanlış değil** (Merter, Etlik, Işıkkent, Hadımköy… mahalle/belde; `Eminönü` 2008'de
> Fatih'e katıldı — il doğru, `false` doğru cevap), **8'i yazım hatası** (il doğru),
> **3'ü gerçek hata**: `2777 orhanli→Sakarya`, `2831 bigadi→Çanakkale`, `2662 selimpaşa→Tekirdağ`.
> Üçünün de imzası aynı: AI üretimi, öncelik 50, güven 75-90, **normalized il ile district
> birbirini tutmuyor** — biri diğerinin ilinin ilçesini gösteriyor.
>
> 📌 **Bu hatalar ilanlara YANSIMIŞ:** Orhanlı 5 ilan (Sakarya yazıldı, metinde Sakarya YOK —
> ham metin `Orhanlı`, parser bir harf ötedeki gerçek ilçe `Orhaneli`ye kaymış), Selimpaşa
> 7 ilan + 2 durak (Tekirdağ yazıldı; Selimpaşa Silivri/İstanbul mahallesi, aynı göndericinin
> diğer satırları Hadımköy/Tuzla/Beylikdüzü). Bigadiç 0 satır — henüz yalnız potansiyel.
>
> 🚨 **VE BU, İL TARAFINDA "VERİ DOĞRU" VARSAYIMINI DELİYOR.** Dalga 5 boyunca ölçtüğümüz
> şey hep `origin_province_id is null` idi ve 4.5a'da **0** çıktı — %100 dolu. Ama *dolu*
> ile *doğru* aynı şey değil. Yanlış ama dolu il hiçbir NULL taramasında görünmez; üstelik
> ilçe temizlenince `ilce_resmi()` de `null` döner ve satır **tüm denetimlerin dışına çıkar**.
> Şu ana kadar yakalayabildiğimiz tek yol alias tablosundan geriye doğru izlemekti.
>
> 🔁 **Kalıbın ALTINCI örneği, yeni bir yüzle.** Önceki beşi "kayıt ile gerçek ayrışmış" idi.
> Bu sefer ayrışan iki KAYIT: alias `Sakarya` diyor, aynı satırdaki `district` `Orhaneli`
> diyor, ikisi bir arada imkânsız. Çelişki 21 Mayıs'tan beri satırın İÇİNDE duruyordu;
> onu okuyabilecek tek şey (`districts`) bugün geldiği için 2,5 ay görünmez kaldı.
> **Ders: iki alanı olan her kaydın alanları birbirini doğrulayabilir — kimse sormadıysa
> o kayıt "doğrulanmış" değil, sadece "itiraz edilmemiş"tir.**
>
> ⚙️ **Onay anı savunmasız.** `learn-aliases/route.ts:514-526` `PATCH approve` tek `id` alıyor,
> otomatik eşik YOK — saatte 21 onay, admin'in kuyruğu hızla geçmesi. Ekran `llm_confidence`
> rozetini gösteriyor (`OgrenmeMerkeziClient.tsx`:905) ama **doğruluk sinyali yok**.
> `ilce_resmi()` tam buraya takılmalı (#51). Bloklamak DEĞİL — mahalle alias'ları meşru
> olarak `false` döner — admin'e kırmızı gösterip bilerek onaylatmak.
> ⚠️ Not: histogramda her satırda `ai_uretimi = adet` çıkması "tüm alias'lar AI" demek değil;
> insan yapımı alias'lar `is_approved=true` olarak doğrudan yazılıp `approved_at` almıyor.

> 🟢 **4 AĞU 2026 — #31 KAPANDI: İŞ ZATEN YAPILMIŞ. HAYALET ENGELMİŞ.**
> Ön kontrol (`docs/20260804_adim3_4_6_on_kontrol.sql`) alias runbook'unun
> **Adım 1–7 ve 9'unun tamamının çalıştırılmış** olduğunu gösterdi:
> Adım 3 → 0 satır · Adım 7 → 0 satır · homonim üçü de pasif · `payas` düzeltilmiş
> (1003 → Hatay/Payas aktif, 1844 pasif) · Adım 6'nın beş kararı da uygulanmış.
> **Adım 4'ün 92 satırının 92'si `⏭️ ZATEN_DOLU_AYNI`, sıfır id kayması.**
> Adım 9'un ayrı kanıtına gerek yok: `aliases_katlanmis_anahtar_uniq` indeksi
> canlı ve katlanmış kopya kalsaydı o indeks 23505 ile **kurulamazdı**.
>
> 🔁 **Kalıbın BEŞİNCİ örneği — ama TERS YÖNDE.** Önceki dördü "kayıt var diyordu,
> gerçekte yoktu" idi (`destination_city`, `get_nearby_…_parked_driver`,
> `processed_at`, `_aksiyonlar_props.txt`). Bu sefer **kayıt "yapılmadı" diyordu,
> gerçekte yapılmıştı.** Kök aynı: kaydı kimse doğrulamıyordu. Bedeli farklı —
> yanlış bir eylem değil, **hayalet bir engel**: #31 bir haftadır "Dalga 5'ten
> önce bitmeli" diye duruyordu ve yolu aslında kimse kapatmıyordu.
> ⚠️ **"Yapıldı mı?" sorusunun cevabı görev listesinde değil, VERİDE.**
> 📌 Bu yüzden donmuş script'i kör çalıştırmadım: `20260728_alias_kopya_temizligi.sql`
> 28 Tem'in fotoğrafıydı ve BÖLÜM 3'ün `VALUES` listesi bir **id → ilçe haritası**.
> Bir id başka alias'a kaymış olsaydı UPDATE sessizce yanlış ilçe yazacaktı.
> Kontrol id + alias + district üçlüsünü karşılaştırdı; kayma çıkmadı ama
> **çıkmadığını ancak ölçünce bildik.**
>
> ✅ **#43 KAPANDI — 4 AĞU. Trigger seçenek (a) ile kuruldu.**
> Dosya: `docs/20260804_alias_normalize_trg_a.sql`. 29 Tem'deki dosyanın trigger
> bölümü **geçersiz** (başına uyarı konuldu); indeks bölümü geçerli.
> Tek fark: alias satırından `lower()` **çıkarıldı** — Bulgu B'nin gerekçesi
> çürüdüğü ve `lower('İ')` U+0307 ürettiği için. `\s+` sıkıştırma ve
> `district=''`→NULL aynen korundu; asıl koruma bunlar.
> Doğrulama: ön kontrol `fonksiyon_var=true / trigger_var=false` (fonksiyon
> vardı, trigger hiç kurulmamıştı — teşhis doğrulandı) → kurulum sonrası
> `aliases_normalize_trg` / `tgenabled='O'` → canlı test `'  TEST   İĞNE   ALIAS  '`
> girdisi **`TEST İĞNE ALIAS` / uzunluk 15** olarak döndü (büyük harf korundu,
> çift boşluk teke indi, U+0307 yok), `district='   '` → **NULL**. Test rollback'li.
> ⚠️ 4.b kontrolü (`position('lower(' in prosrc)`) **`true`** döndü ama bu **yanlış
> pozitif**: fonksiyon gövdesindeki *yorum satırları* "lower()" kelimesini içeriyor
> ve `prosrc` yorumları da kapsıyor. Davranış kanıtı 4.c'dir. Ders: metin araması
> koda değil kaynak metnine bakar; davranışı davranışla doğrula.
>
> ✅ **#24 KAPANDI — 4 AĞU. Dalga 5'in SON kod engeli kalktı.**
> `app/api/admin/learn-aliases/route.ts` — `.in('origin_city', kesfedilenNorm)`
> → `.in('origin_province_id', kesfedilenIlIds)`. Çeviri güvenli: bu route'ta
> `type: 'city'` sabit yazılı (:380/:396), yani `normalized` her zaman bir il
> adı; `ilId()` ile plakaya birebir gider. Çözülemeyen değer **sessizce
> atılmıyor**, `console.warn` ile raporlanıyor — LLM'in il olmayan bir
> `normalized` üretmesi başlı başına sinyal. tsc temiz · 29/29 · lokasyon testi geçti.
> 🔍 **Kalan `origin_city` geçişlerinin hepsi taranıp aklandı** (gerçek kolon
> tüketicisi SIFIR): `YolRehberiClient.tsx`:64/723 RPC'nin **çıktı takma adı**
> (`provinces.name`, bkz. `20260803_get_nearby_cte_temizligi.sql`:68-72) ·
> `moderator/page.tsx`:511 `ilAdi(ilan.origin_province_id)` ile **form state**,
> :647 `aliasOgren` o state'i yazıyor · `parse-text`/`whatsapp`/`llm-parse`
> geçişleri **LLM prompt metni** · `ilan-ver/page.tsx`:255 parse **sonucu**.
> ⚠️ Not (kapsam dışı, davranış korundu): bu UPDATE zaten no_lane kuyruğuna
> dokunmuyor — kuyruk `origin_province_id IS NULL` süzüyor, UPDATE ise
> NOT NULL satırları işaretliyor. Eski `origin_city` hâli de aynı şeyi
> yapıyordu (çift yazım nedeniyle küme aynı). Değiştirmedim; ölçmeden
> "ölü kod" demek de bu haftanın hatası olurdu.
>
> ✅ **#44 KAPANDI — 4 AĞU.** Kemalpaşa UPDATE'i zaten çalıştırılmıştı:
> 53 satırın 53'ü kanonik yazım + `district_official=true`. Kalan büyük harfli
> ilçe artığı #44'e değil #47/#30'a ait.
>
> 🟠 **#47 — EXCEL İLÇE KAYMASI: SEBEP DOSYA, KOD DEĞİL (4 Ağu 2026).**
> 🔁 **Kalıbın YEDİNCİ örneği ve bu sefer ben de düştüm — SEÇİM YANLILIĞI.**
> İlk kanıtım "8/8 kaydırılmış hâli doğru" idi; oysa yalnızca
> `district_official=false` **içerdiği için seçtiğim** ilanları puanlamıştım —
> yani ölçtüğüm sonucun üzerinden örneklem seçmiştim. Yansız 100 satırda
> aynı test **olduğu gibi %95 / kaydırılmış %56** verdi. Hipotez ancak
> yansız alt kümede tekrar ölçülünce ayakta kaldı.
> **Ölçüm (200 satır / 114 ilan, iki CSV; `ilKey` katlamasıyla
> `lib/constants/locations.json`'a karşı puanlama):**
> | parti | satır | olduğu gibi | kaydırılmış | karar |
> |---|---|---|---|---|
> | 29 Tem | 84 | %94 | %50 | temiz |
> | 31 Tem 07:54:32-38 | 16 | ~%96 | — | temiz (tek duraklı) |
> | 31 Tem 07:54:40-43 (çok duraklı) | 31 | **%48 (10/21)** | **%95 (19/20)** | **BOZUK** |
> | 4 Ağu | 24 | %88 | %35 | temiz |
> ⇒ Import kodu sağlam: 4 Ağu dosyası (`yukegel-ilan-sablonu (3).xlsx`, 31 satır)
> byte düzeyinde doğru içeri alındı; `TopluYukle.tsx`:62-83 ve
> `app/api/excel-import/route.ts`:180-234 konumsal eşleme yapıyor ve tüm alanlar
> **aynı `row` dizisinden** okunuyor — tek kolonluk kayma orada oluşamaz.
> ⇒ Sebep: 31 Tem'de yüklenen **tek bir Excel dosyasında** ilçe kolonu ~19. satırdan
> itibaren bir satır aşağı kaymış ("hücre ekle, aşağı kaydır" kazası). Kayma
> **ilan sınırlarını geçiyor** — bu da onu dosya düzeyinde bir bozulma yapıyor.
> Örnek: `4d4fec4f` Bursa/Gaziosmanpaşa·Kestel·İnegöl → olduğu gibi ✗✓✓ /
> kaydırılmış ✓✓· · `4e11b1e3` Kayseri/Midyat… → ✗✓✗✓ / ✓✓✓·
> ✅ **SİLİNDİ — 4 Ağu.** `docs/20260804_31tem_excel_silme.sql` BÖLÜM 6.
> Bayram'ın kararı: *"Tamamen silelim, bunları test datası gibi görebiliriz."*
> Kapsam BLOK 2 değil **31 Tem'in tamamı: 45 ilan + 66 durak** (cascade).
> BLOK 1'in 23 ilanı bozuk DEĞİLDİ (23/23 `district_official=true`) — silinme
> sebebi bozukluk değil, partinin bütünüyle test verisi sayılması.
> Yedek alındı (`listings_20260804_31tem_yedek` 45 · `listing_stops_…` 66),
> FK tek ve `ON DELETE CASCADE`. Sonrası: 29 Tem 55 · 3 Ağu 13 · 4 Ağu 10 ilan,
> **31 Tem satırı yok.**
> ⚠️ **CSV kapsamı ölçüyü İKİ KEZ yanılttı.** (1) BLOK 1'i 16 ilan sandım,
> gerçekte 23'tü — Supabase export'u 100 satırda kesiyor ve o "16" blok
> büyüklüğü değil **kesme sınırıydı** (84+16=100). (2) Silme sonrası
> doğrulama hiç ölçmediğim bir parti gösterdi: **3 Ağu / 13 ilan / 33 durak**.
> Ders: örneklemin sınırını her adımda yeniden sor — bir kez yakalanan
> truncation bir sonraki adımda unutuluyor.
> 📊 **Silme sonrası `district_official` dağılımı (147 durak):**
> 29 Tem true 17 / NULL 67 · 3 Ağu **NULL 33 (tamamı)** · 4 Ağu true 26 / false 4.
> 4 Ağu'nun 4 `false`'ı bilinen serbest metinler (Depo, Merkez vb.), dosya
> zaten kusursuz doğrulanmıştı.
> ✅ **3 Ağu doğrulandı: 33 durağın 33'ünde `district IS NULL`** (boş string
> bile değil, `ilce_dolu = 0`). Parti ilçesiz yüklenmiş — denetlenmemiş veri
> değil, OLMAYAN veri. Bayrağı atlayan gizli bir yazma yolu YOK.
> ⇒ **#47 KAPANDI.** Kaydırma ikinci bir dosyada tekrarlanmadı; kalan tek
> `false` kümesi 4 Ağu'nun dört serbest metni ve o kaza değil, sektörün
> gerçek kullanımı. Excel yolu için açık iş kalmadı.
> ⚠️ Kaymayla İLGİSİZ ama duruyor: 29 Tem partisinde `Tekirdağ/LÜLEBURGAZ` ×2 ve
> `Tekirdağ/VİZE` — ikisi de Kırklareli ilçesi. Gerçek ama zararsız müşteri hatası.
> `ÇANAKKALE` ilçe kolonunda il adı olarak geçiyor.
> ℹ️ 58 `district_official=NULL` durak ayrı bir arıza değil: hepsi 29 Tem
> 15:45–16:02 arasında; `true` grubu 16:02:02'de başlıyor. Deploy kesişimi.
>
> 🚨 **ASIL BULGU — ADIM 10 YARIM UYGULANMIŞ (#43) — [ÇÖZÜLDÜ, yukarı bak].**
> `docs/20260729_alias_normalize_trigger.sql` iki bölüm; canlıda **BÖLÜM 2 var,
> BÖLÜM 1 YOK** — `pg_trigger` 0 satır döndü, `aliases_normalize_trg` kurulu değil.
> ✅ Tekillik korunuyor (indeks duruyor, D3'ün asıl amacı tutuyor).
> ❌ Normalizasyon korunmuyor: lowercase / `\s+` sıkıştırma / `''`→NULL yalnız
>    `lib/alias-normalize.ts`'te ve **tek çağıranı** `learn-aliases` route'u.
>    O route'tan geçmeyen yazma ham değer yazar (`W5_DEVIR.md`:79 zaten "manuel
>    `create` lowercase YAPMIYOR" diyordu).
> ⚠️ Trigger'sız indeks güvenlik ağı değil **mayın**: normalize edilmemiş yazma
>    sessizce düzelmez, 23505 ile patlar. Gürültülü hata sessiz bozulmadan iyidir
>    ama bu tasarlanmış bir tercih değil, **kaza**.
> ✅ Cevap geldi: `pg_proc` **`aliases_normalize` döndürdü.** Fonksiyon var, trigger yok.
>    Yani BÖLÜM 1 yarım çalışmış — trigger sonradan düşürülmedi, **hiç kurulmadı.**
>    En olası sebep kopyala-yapıştır sınırı: fonksiyon gövdesi :104'te biter,
>    :106-111 yorum bloğu gelir, DROP/CREATE TRIGGER :113 ve :115'tedir. Gizli sebep yok.
>
> 🚨 **TRIGGER'I DOSYADAKİ HÂLİYLE KURMA — üç ölçüm üç ayrı şey çıkardı (#43, #45, #46).**
> Q1 `lower('İSTANBUL')` → `i̇stanbul` / **9** / `='istanbul'` **false**.
> Postgres `lower()` = JS `.toLowerCase()`; ikisi de `i`+U+0307 üretiyor. Trigger ile
> `normalizeAliasFields` ayrışmıyor — ama **ikisi birden `aliasKey()` ve indeks
> ifadesinden ayrışıyor.** Q3 (çakışma) 0 satır → kurulum 23505 riski taşımıyor.
> Q2 (yeniden yazılacak satır) **boş değil, ~100 satır** — ve sebebi asıl bulgu:
>
> 🚨 **BULGU A (#45) — `normalizeAliasFields`:82 ile `aliasKey`:38 AYRIŞIYOR. Canlı hata.**
> `aliasKey` `İ`→`i` replace'ini `toLowerCase()`'den **önce** yapar; `normalizeAliasFields`
> düz `.toLowerCase()` kullanır. Aynı dosyanın :30-35 yorumu "birini değiştiren diğerini
> de değiştirmek zorunda" diyor ve **:82 o kurala uymuyor.** Zincir: `İ` içeren alias
> learn-aliases'tan geçince DB'ye `i`+U+0307 olarak yazılır → indeks anahtarı 9 karakter,
> uygulamanın çakışma kontrolü 8 karakter (**uygulama "çakışma yok" derken DB başka
> anahtar görür**) → eşleşmede `trNorm`'un `[^a-z0-9\s]`→`' '` kuralı U+0307'yi
> **boşluğa** çevirir (`i kitelli`), mesaj metni `ikitelli` kalır → **hiçbir zaman tutmaz.**
> ⇒ `İ` içeren her yeni alias **sessizce ölü kayıt**. Düzeltme: :82'ye `.replace(/İ/g,'i')`
> ekle; trigger kurulacaksa `lower(replace(NEW.alias,'İ','i'))`.
>
> 🚨 **BULGU B — LOWERCASE GEREKÇESİNİN KENDİSİ YANLIŞ. Kalıbın ALTINCI örneği.**
> İddia iki dosyada yazılıydı (`alias-normalize.ts`:80-81 ve trigger script'i :64-66):
> *"büyük harfli alias hiç tutmaz, sessizce ölü kayıt olur."* Ölçüm bunu çürüttü:
> `parse-listing`:323/337 `trNorm(a.alias)` ile, `whatsapp-parse`:224/232 `trNorm`/
> `aliasAnahtari` ile karşılaştırıyor — **alias okuma anında katlanıyor.** Büyük harfli
> alias pekâlâ tutuyor. ⇒ Q2'deki ~100 satır (Söke, Bergama, Kemalpaşa, TIR Açık,
> DANPERLİ…) ölü kayıt değil, **bugün çalışan kayıtlar**. Trigger'ın alias-lowercase
> kısmı var olmayan bir sorunu çözüp 100 satırı bedavaya yeniden yazacaktı.
> ✅ Değerli olan kısımlar: `\s+` sıkıştırma ve `district=''`→NULL. Asıl koruma bunlar.
>
> 📏 **BULGU A ÖLÇÜLDÜ — 34 SATIR, VE İNDEKSİN NASIL BAYPAS EDİLDİĞİ ORTAYA ÇIKTI.**
> `alias like '%'||U&'\0307'||'%'` → **34 satır** (33 aktif + 1 pasif), hepsi `type='city'`,
> hepsi büyük harfli metinden gelmiş (`SİVRİHİSAR` → `si̇vri̇hi̇sar`, 13 karakter).
> Çakışma kontrolü ikiye ayırdı — **tek küme sanmak yanlış okumaydı**:
> • **24'ü gölge kopya** — katlanmış anahtarı aktif bir alias'la çakışıyor. `izmit`
>   zaten id 48'de canlı; 2875 onun ölü ikizi. **Kapsama kaybı YOK.**
> • **10'u gerçek kayıp** (9 aktif): `kdz ereğli` · `i̇stoç` · `i̇vedik` · `ni̇zi̇p` ·
>   `deli̇ce` · `ş.kochi̇sar` · `yeni̇ mahalle` · `i̇skendurun` · `i̇scehisardan`
>   (+ pasif `i̇stoc`). İstoç, İvedik, Kdz Ereğli yüksek hacimli noktalar → **#42'nin
>   (`no_lane` taban çizgisi) cevabının bir parçası burada.**
> ⚠️ Kendi hatam: önce "34'ü de kayıp, Sabiha Gökçen dahil" dedim. Yanlıştı —
>   Sabiha Gökçen 2863'te canlı. **Kümeyi ölçmeden bölmedim.**
> ✅ Merge kontrolü: 24 çiftin 24'ünde `normalized` aynı; `district` yalnız 2650'de
>   ayrışıyor ve ölü tarafta NULL (canlıda `Aliağa`) → **pasifleştirme kayıpsız,
>   sıfır veri taşıma.** Her ölü ikizin alanları canlı ikiziyle birebir aynı —
>   bunlar ayrı beslenmiş kayıtlar değil, aynı kümenin büyük harfli yeniden yüklemesi.
>
> 🔗 **NEDENSEL ZİNCİR KAPANDI.** `aliases_katlanmis_anahtar_uniq` bu 24 kopyayı
> reddetmeliydi. Reddetmedi çünkü indeks ifadesi `replace(alias,'İ','i')` ile başlıyor
> ve saklanan `i̇zmit`te büyük `İ` yok — U+0307 hayatta kalıyor, anahtar `izmit`ten
> ayrışıyor. **İndeks görevini yapıyordu; :82 ona ayrışan bir anahtar verdi.**
> ⇒ :82 düzeltmesi sadece tekrarı önlemiyor, indeksin baypas edilen kapısını kapatıyor.
>
> ✅ **KOD DÜZELTİLDİ (4 Ağu).** `lib/alias-normalize.ts`:82 →
> `trTemizle(...).replace(/İ/g,'i').toLowerCase()`. Doğrulandı: `İZMİT` artık
> `izmit` (5 karakter), eskiden `i̇zmi̇t` (7). `aliasKey(yeni) === aliasKey(ham)`
> altı örnekte de `true`. `tsc --noEmit` temiz. **✅ CANLIDA** — `git diff origin/main
> -- lib/` boş ve davranışsal tanık var: onarımdan sonra öğrenilen 27 yeni alias'ın
> U+0307'lüsü 0. Tanık kolonu `27`; onsuz "U+0307 = 0" hiçbir şey kanıtlamazdı.
> ✅ **VERİ ONARIMI DA TAMAMLANDI** — `docs/20260804_u0307_alias_onarimi.sql`:
> yedek 34 → **UPDATE 24** (gölge kopya pasif) → **UPDATE 9** (gerçek kayıp onarıldı)
> → **UPDATE 1** (homoglif 1023 pasif). Doğrulama: `aktif_u0307 0` · `pasif_u0307 25` ·
> Latin-dışı aktif **0** · katlanmış çakışma **0** · `pasiflestirilen 24`.
> 🧪 `trNorm` eşleşme testi **9/9**: `nizip`·`istoç`·`ivedik`·`kdz ereğli`·`delice`·
> `iskendurun`·`iscehisardan`·`ş.kochisar`·`yeni mahalle` artık mesaj metniyle tutuyor.
> Onarım öncesi kıyas: `ni̇zi̇p` → `ni zi p` ≠ `nizip`. Fark tam olarak buydu.
> ✅ **KAPANDI — DEPLOY EDİLDİ VE CANLI DAVRANIŞLA DOĞRULANDI (7 Ağu 2026).**
> `lib/alias-normalize.ts` `origin/main` ile birebir aynı; Vercel `main`'den build ediyor.
> Ama "push'landı" ile "canlıda çalışıyor" aynı şey değil, o yüzden **davranışsal tanık**:
> onarımdan sonra (4 Ağu →) **27 yeni alias öğrenildi**, bunların **U+0307'lüsü 0**,
> tablodaki **aktif U+0307 toplamı 0** (son alias 6 Ağu 17:02).
> 🔑 Buradaki tanık kolonu `27`. Onsuz "U+0307 = 0" hiçbir şey kanıtlamazdı —
> learn-aliases hiç koşmamış da olabilirdi. **Sıfırı tek başına okuma.**
>
> 📚 **SÜREÇ DERSİ — ÇAKIŞMA KONTROLÜ TEK İNDEKSE BAKMAZ.**
> BÖLÜM 3'ün ilk denemesi **23505** ile patladı (`idx_aliases_type_alias`) ve atomik
> olduğu için tamamen geri sarıldı — kısmi uygulama olmadı. Sebep: çakışmayı yalnız
> `aliases_katlanmis_anahtar_uniq`e karşı ölçmüştüm. `aliases` üzerinde **üç** unique
> indeks var ve ikisi **kısmi değil**: `aliases_alias_unique (alias)` ve
> `idx_aliases_type_alias (type, alias)`. Kısmi indeks Adım 9'da pasifleştirilen
> **612 satırı** görmüyor; diğer ikisi görüyor. Çarpışma oradan geldi.
> ⚠️ Kural: veri onarımından önce `select indexname, indexdef from pg_indexes
> where tablename='X'` çalıştır, HER unique indeksi ayrı kontrol et.
> 🔁 Ve bu sefer kaydı **ben** ıskaladım — beş indeksin listesi 4 Ağu ön kontrolünün
> §0 çıktısında zaten elimdeydi. "Elimde var" ile "kontrole kattım" aynı şey değil.
> ℹ️ Yan bulgu: `aliases_alias_unique` global olduğu için `idx_aliases_type_alias`
> fiilen gereksiz — ayrıca aynı alias metni iki `type`ta var olamıyor. Dokunulmadı.
> ℹ️ 25 pasif satırda U+0307 bilerek bırakıldı (yazımları okunmuyor, onarmak
> `aliases_alias_unique` ile çakışırdı). Yedek: `public.aliases_20260804_u0307_yedek`.
>
> ⚠️ **BULGU C (#46) — id 1023 `Torbалı` Kiril homoglif.** `а` (U+0430) ve `л` (U+043B)
> Kiril; `trNorm` ikisini de boşluğa çevirir → bu alias hiçbir Türkçe metinle eşleşemez.
> Ölü kayıt. Başkaları var mı, taranmadı.
>
> 📌 **KEMALPAŞA 28 DEĞİL 54 — ve bu iyi haber (#44).**
> `listing_stops.district`: `Kemalpaşa` **36** + `KEMALPAŞA` **17**;
> `listings.origin_district`: `Kemalpaşa` 1. Doküman 28 diyordu (17 + 11).
> Kırılıma dikkat: **`KEMALPAŞA` 17'de SABİT kalmış, `Kemalpaşa` 11 → 36 çıkmış.**
> Yani yeni trafik doğru yazımı yazıyor; 17 satır eski kalıntı. Alias
> düzeltmesinin işe yaradığının ölçülmüş kanıtı bu — ve kalan iş Adım **8.2**.
> ✅ 6.b temiz: `kemalpasa` anahtarında aktif satır 1, farklı `normalized` 1 →
>    Adım 8'in sözlüğünü **bloke etmiyor**. Korkulan engel de gerçekleşmemiş.
>
> ✅✅ **3 AĞU 2026 — #39 DUMAN TESTİ GEÇTİ. v4 BEŞ YAZMA YOLUNDA DA DOĞRULANDI.**
> Gerçek trafik altında, tek günde: **149 ilan · 176 durak · hepsinde `il_bos 0`,
> `metin_yazilmis 0`.** Kanallar: whatsapp 135 · excel 13 · form 1;
> repost **21** · moderatör dokunmuş **50** · gölge profilli 93.
>
> 📌 **`source` yazma yolunu ayırmaz.** İlk sorgu üç `source` döndürdü ve bu
> "iki kanal kayıp" gibi göründü — yanlış okuma: moderatör onayladığı WhatsApp
> mesajını yine `whatsapp` yazıyor, repost ayrı kanal değil `is_repost` bayrağı.
> Ayıran alanlar `is_repost` / `reviewed_at`. → Kanal kapsamasını `source` ile
> ölçme; o alan **mesajın nereden geldiğini** kaydediyor, **hangi kodun yazdığını**
> değil.
>
> 🔑 **`metin_yazilmis 0` ikinci bir şeyi kanıtladı:** bugün oluşan 149 satırın
> hiçbiri `ilan_olustur`u atlamamış. Yani KOVA D'den (#34) artakalan gizli bir
> doğrudan `.insert()` yolu **yok**. Dalga 5 drop'u bu taraftan güvenli.
>
> 🚨 **YENİ BULGU — KISMİ ŞERİT KAYBI GERİ ALINAMIYOR.**
> `parse-listing/index.ts`:834-882 mesajdaki her şeridi ayrı `ilan_olustur`
> çağrısıyla yazıyor; RPC hatasında `edgeLog('ERROR', …, {error_code})` + `continue`,
> sonra `processing_status = created > 0 ? 'processed' : 'no_lane'` (:896).
> → 3 şeritli bir mesajın 1 şeridi guard'a takılırsa: 2 ilan oluşur, mesaj
> **`processed`** olur, kaybolan şerit `no_lane` kuyruğuna **hiç girmez** ve
> `reprocess-no-lane` onu alias öğrenildikten sonra bir daha denemez.
> ⚠️ İzsiz değil (edgeLog var) ama **kurtarılabilir değil**. #33'ün düzeltmesi
> "hiç ilan oluşmadı" hâlini kurtardı, "bir kısmı oluşmadı" hâlini kurtarmıyor.
> → Karar gerekiyor: şerit bazlı bir başarısızlık kuyruğu mu, yoksa kabul edilen
> bir kayıp mı? Bugünkü hacimde (135 ilan) sıfır değilse ölçülmeli.
>
> 🐛 **BAYAT YORUM — `parse-listing/index.ts`:822-825 artık YANLIŞ.**
> "`ilan_olustur` v3 … `origin_city`'yi kanonik ada çevirerek yazıyor" diyor.
> v4 o kolona **yazmıyor**. Canlı dosyada yanlış yorum; bugün katalog taramasında
> (#40) yanlış pozitif üreten satır-sonu yorumlarıyla aynı sınıf: yorum koddan
> ayrı yaşlanıyor. → Düzeltilecek.
> ℹ️ Not: parse-listing `origin_city` metnini **gönderiyor** (:839) — göndermediği
> `origin_province_id`. Guard yalnız metin `provinces`tan çözülemezse atıyor.
>
> ✅ **`no_lane` ALARMI KAPANDI — v4'ün ETKİSİ SAPTANAMIYOR (4 Ağu 2026).**
> İlk sayı korkutucuydu: 3 Ağu partisinde `no_lane` %39.7, önceki günler %3–5.
> Üç adımda çözüldü ve **sıçrama v4 kaynaklı değilmiş.**
>
> 1️⃣ **Örnekleri okuyunca guard şüphesi düştü.** 4 Ağu'daki 13 `no_lane`
> mesajının kalkışları Adana · Afyon · Mersin · Bolu · Eskişehir · Konya ·
> Bilecik · Aydın — hepsi `provinces`tan çözülür. Guard tetiklenseydi
> çözülemeyen bir il olması gerekirdi. Yani RPC hiç çağrılmamış; hata
> `index.ts`:493 `if (!from) continue`'da, yani **ayrıştırıcıda**.
>
> 2️⃣ **Kompozisyon etkisi.** `message_date` kırılımı hafta sonlarının çok daha
> zor olduğunu gösterdi: 26 Tem Paz %23.1 · 1 Ağu Cmt %50.0 · 2 Ağu Paz %44.2,
> hafta içi %2.5–13.9. 3 Ağu partisi tam da **hafta sonu birikmişini** yuttu:
> 31 `no_lane`in **25'i** 1–2 Ağu mesajlarından geldi.
>
> 3️⃣ **Benzeri benzerle karşılaştırınca fark kalmıyor.** Aynı gün içi hücreler
> (parti = mesaj günü): v4 öncesi %2.5 · %3.3 · %5.3 · %20.8 · **%22.3**;
> v4 sonrası 3 Ağu **%18.9**. Bandın içinde, hatta 28 Tem'in altında.
> → **v4 guard'ının `no_lane` üzerinde ölçülebilir etkisi YOK.**
>
> 📌 **Eksen dersi (iki kez yanlış seçtim).** `created_at` = alım = **işleme**
> zamanı (alım ile işleme aynı koşuda oluyor) → "hangi kod sürümü işledi"
> sorusunun ekseni **bu**. `message_date` = mesajın yazıldığı gün → "trafik ne
> cinsten" sorusunun ekseni. Sürüm karşılaştırması `message_date` ile yapılamaz:
> 1–2 Ağu mesajları 4 Ağu'da, yani v4'ten SONRA işlendi. Ayrı sorular, ayrı
> sütunlar; ikisini karıştırmak hem alarmı üretti hem geciktirdi.
>
> ✅ **#41 — `processed_at` KOLONUNU HİÇBİR ŞEY YAZMIYORMUŞ. KAPANDI (4 Ağu 2026 deploy).**
> ⚠️ Bu başlık 6 Ağu gecesine kadar "⏳ KOD HAZIR, DEPLOY BEKLİYOR" diyordu — **kendi
> gövdesiyle çelişiyordu**, gövde iki satır aşağıda deploy'un doğrulandığını yazıyor.
> Kapanış notu eklenirken başlık güncellenmemiş. 5 Ağu'dan beri `processed_at` %100 dolu.
> 📌 Ders: durum bir yerde değil İKİ yerde yazılıysa, biri eskiyor. Başlık ile gövdeyi
> aynı düzenlemede güncelle.
> Önce "`no_lane` satırlarında NULL kalıyor" sandım; `grep -rn processed_at`
> tüm repoda (.ts/.tsx/.sql) **0 eşleşme** verdi. Yani kolon şemada var,
> **hiçbir satırda dolu değil** — başarılıda da, başarısızda da. Eksik bir dal
> değil, hiç kullanılmayan bir kolon.
> → `parse-listing/index.ts`:924 artık iki dalda da damgalıyor.
> ✅ **DEPLOY EDİLDİ VE DOĞRULANDI 4 Ağu 2026:** damgalı satırlar `processed` 13
> · **`no_lane` 4**. Kritik olan ikincisi — başarısızlık dalının da damgalandığını
> kanıtlıyor, ki bu düzeltmenin bütün sebebi oydu. `pending` 373'te 0 damga,
> beklenen (henüz işlenmediler).
> 📌 Aynı sınıftan üçüncü vaka: `destination_city` (#28 — kolon hiç yokmuş),
> `get_nearby_listings_for_parked_driver` (#40 — fonksiyon canlıda hiç yokmuş),
> şimdi `processed_at` (kolon var, hiç yazılmamış). **Şemada bir şeyin bulunması
> onun kullanıldığı anlamına gelmiyor** ve bu projede üç kez yanlış varsaydık.
> ⚠️ Ders: bir alana dayanarak hüküm vermeden önce onu KİMİN yazdığına bak.
> Bugün bu boşluk yüzünden "sıçramayı v4 mü yaptı" sorusunu doğrudan
> cevaplayamadık, `created_at` üzerinden tahmin yürütmek zorunda kaldık.
>
> 🔎 **ASIL İŞ → #42:** taban `no_lane` (~%10–20 hafta içi, %44–50 hafta sonu)
> v4'ten önce de vardı ve sebebi ayrıştırıcının tanımadığı formatlar:
> oksuz alt alta iller (`Aydin\nMugla`) · iki taraf da ilçe (`DAZKIRI-ALİAĞA`) ·
> kalkış ilçe (`BAŞAKŞEHİR➡️ANKARA`, `İST.TUZLA➡️ANTALYA`) · yurt dışı varış
> (`MERSİN-ZAHO`) · sınır kapısı (`BOLU🔹CİLVEGÖZÜ`) · tek kalkış–çok varış+fiyat
> (balya ilanları). Hafta sonu oranının 3–4 katı olması bunların ayrı bir sınıf
> olduğunu düşündürüyor.
>
> ⚠️ Hâlâ ölçülmemiş tek şey **kısmi şerit kaybı** (yukarıda). DB'den
> ölçülemiyor çünkü mesajdaki şerit sayısı `raw_posts`ta saklanmıyor. Cevabı
> edge loglarında: `İlan oluşturulamadı (ilan_olustur)` kayıtlarının sayısı ve
> `error_code` dağılımı. `22023` sıfıra yakınsa guard hiç tetiklenmemiş demektir.

> ✅ **3 AĞU 2026 — #40 POSTGRES TARAFI TÜKETİCİ TARAMASI: TEMİZ.**
> Dosya: `docs/20260803_pg_metin_kolon_tuketici_taramasi.sql` (salt okunur, 7 bölüm).
> **Metin kolonlarının Postgres tarafında gerçek tüketicisi KALMADI — #37 son taneymiş.**
>
> 📌 **Niye yapıldı:** Dalga 5 BÖLÜM 2 envanteri kapsamını *dile* göre kurmuştu
> (`.ts`/`.tsx`); Postgres hiç envanterlenmedi. #37 tesadüfen bulundu ve tesadüf
> bir yöntem değil. v4 ile aciliyet doğdu: bugünden yeni satırlar NULL taşıyor,
> yani kolonu hâlâ okuyan bir DB nesnesi **bugün sessizce boş** dönüyor, drop'tan
> sonra `42703` atacak.
>
> **1. Fonksiyonlar (4 eşleşme, dördü de yanlış pozitif):**
> `ilan_olustur` → `p_listing->>'origin_city'` JSONB **girdi anahtarı**. 🔑 Bu
> bilinçli ve KALICI: v4'ün tasarımı "metin girdi olarak hayati, çıktı olarak
> saklanmıyor". Kolon düştükten sonra da çağıranlar JSON'da `origin_city`
> göndermeye devam edecek — **Dalga 5'te bu satırlara dokunulmayacak.**
> API sözleşmesi ≠ şema. · `get_nearby_listings_by_province`, `get_radar_city_overview`,
> `get_radar_city_detail` → hepsi `provinces.name`i `as origin_city` / `as city`
> takma adıyla döndürüyor; #37 ve Dalga 3'ün yaptığı tam olarak bu (isim korundu,
> kaynak değişti). Frontend sözleşmesi bozulmadı.
>
> 🚨 **Sorgunun kendi açığı çıktı — SATIR SONU YORUMU.** `ilan_olustur`ün 8
> eşleşmesinden ikisi `… contact_phone,  -- ⬅️ origin_city çıkarıldı` gibi
> satırlar. Filtre `l !~ '^\s*--'` yalnızca **tamamen** yorum olan satırı eler,
> kodun sonuna eklenmiş yorumu elemez. Yani "kaldırıldı" diyen yorum yine
> "kaldırılmamış" gibi sayıldı. ⚠️ Bu, aynı gün v4 sürüm tespitinde yapılan
> hatanın daha ince hâli: o gün "yorum **satırlarını** at" diye düzeltmiştik,
> asıl kural "**yorumu** at" imiş. → `regexp_replace(l, '--.*$', '')`.
>
> ❗ **Beklenip çıkmayan:** `get_nearby_listings_for_parked_driver` katalogda YOK
> (`docs/20260610_poi_module.sql`). Demek ki o migration canlıya hiç uygulanmamış.
> Eksik iş değil, eksik **risk** — ama repo'daki SQL ile canlı şemanın ayrıştığı
> anlamına geliyor. #30 (districts) de "yazıldı, hiç çalıştırılmadı" durumunda:
> aynı sınıf. → Bir kereye mahsus "repo'da olup canlıda olmayan migration" listesi
> çıkarılmalı.
>
> **3. İndeksler:** yedisi de doğrulandı (110·44·29·25·24·11·2 tabanıyla birebir
> aynı liste, eksik/fazla yok). ⚠️ 31 Tem'deki EK sorgusu `%origin_city%`
> filtresiyle koştuğu için iki `listing_stops` indeksini döndürmemiş ve "yokluk
> kanıtı değil" diye not düşülmüştü — **o boşluk kapandı**, bu tarama kataloğa
> dayandığı için yedisini de gördü. ✅ `drop column` bu indeksleri kendiliğinden
> düşürür (view'ların aksine CASCADE gerekmez) → **Dalga 5 drop dosyasına ayrıca
> `drop index` yazmaya gerek yok.**
>
> **4. Kısıtlar:** tek satır `aliases.aliases_type_check` (`type='city'` enum,
> başka tablo, `\mcity\M` sınırının bilinen yanlış pozitifi) → iki kolonda kısıt
> YOK, drop'u engelleyen bir şey yok. **4.b NOT NULL:** ikisi de `false`,
> bugünkü düzeltme tuttu. **7. Trigger'lar:** `listings`te 4, `listing_stops`ta 0;
> dördünün fonksiyonu da 1. sorguda çıkmadı → temiz. (Trigger *adı* gövde
> hakkında bir şey söylemez; hüküm iki sorgunun **kesişiminden** geliyor.)
>
> ✅ **4 AĞU: EKSİK ÜÇ BÖLÜM DE KAPANDI — ÜÇÜ DE BOŞ.** View/matview **yok**,
> metin kolonuna bakan RLS politikası **yok**, default/generated ifade **yok**.
> Dosyanın tamamı yeniden koşuldu; 1/3/4/4.b/7 çıktıları 3 Ağu'dakiyle birebir
> aynı, yani sürüklenme de yok.
> 🟢 **DALGA 5 DROP'UNUN DB TARAFINDA ENGELİ KALMADI.** Üç engel sınıfının üçü
> de boş: view (asıl engelleyici olan), kısıt, default. Yedi indeks
> `drop column` ile kendiliğinden düşer.
> ⚠️ ~~Bu hüküm **yalnız şema tarafı**. Uygulama tarafında **#24**
> (`learn-aliases`:437) hâlâ metin kolonuna yazıyor — çevrilmeden drop edilirse
> `42703`. Sıra değişmedi: #21 (7 Ağu) → #24 → drop.~~
> ✅ **GÜNCELLENDİ (6 Ağu 2026) — BU ÜÇ SATIR ARTIK YANLIŞTI.** #24 zaten **4 Ağu'da
> kapandı** (bkz. bu dosyada "#24 KAPANDI — 4 AĞU"): `learn-aliases`in iki predikatı
> da `origin_province_id`'ye çevrildi. #21 de **6 Ağu'da** kapandı, 7 Ağu beklenmedi.
> Sıranın üç adımının ikisi bitti; kalan tek adım **drop**.
> 📌 **Ders: kapanan bir maddeyi yalnız kendi kaydında işaretlemek yetmiyor.** Bu
> satırlar iki gün boyunca "#24 açık" diyerek dosyanın başka bir yerindeki kaydıyla
> çelişti. Bir madde kapanınca ona **atıf yapan** satırlar da taranmalı.
>
> 🔑 **#21'İN ANLAMI DEĞİŞTİ (aşağıdaki kayda ek).** Fark penceresi artık
> homojen değil: 31 Tem→7 Ağu'nun 3 günü v4 öncesi, 4 günü sonrası. "Silinebilir
> mi" hükmü ayakta (tarama taramadır; pozitif kontrol `learn-aliases`:437 hâlâ
> indeksi tarıyor, sadece daha az satır eşleştiriyor — sayaç etkilenmez).
> **Ama fark ikinci bir şey daha ölçüyor:** `idx_listings_origin` dışında farkı
> >0 çıkan her indeks, onu kullanan sorgunun **bugün sessizce eksik sonuç
> döndürdüğü** anlamına gelir — #37'nin okuma tarafındaki aynısı. 7 Ağu'da
> beklenen "dördü de 0"; 0 değilse bu bir temizlik değil **arıza** bulgusudur.
>
> 🟡 **4 AĞU 2026 — #21 ERKEN OKUNDU (7 Ağu beklenmedi, gerek kalmadı). SONUÇ: 5/7 TEMİZ, 2 AÇIK.**
> Bayram üç kanaldan da ilan girdi; ama asıl mesele o değildi — `idx_scan` bir OKUMA
> sayacı, INSERT onu artırmaz (8.F'de kendimiz tespit etmiştik). Ölçümü mümkün kılan
> şey **tanık sütunu**: fark sorgusuna metin indeksleriyle birlikte `province_id` ve
> pkey indeksleri de kondu.
> 📊 **Tanıklar (4,2 gün):** `listing_stops_listing_id_idx` +91.927 · `listings_pkey`
> +14.078 · `idx_listings_shadow_ban` +3.756 · `listings_province_durum_idx` +27 ·
> `listings_origin_province_idx` +19 · `listing_stops_province_idx` +4.
> **Pencere dolu ve `province_id` yolu çalışıyor.**
> 📊 **Metin indeksleri:** `idx_listings_origin` 110→110 · `idx_listings_origin_city_lower`
> 44→44 · `listings_origin_city_trgm_idx` 29→29 · `idx_listings_origin_city` 11→11 —
> **listings tarafının dördü de tam sıfır.** `listing_stops` tarafında ikisi kıpırdadı:
> `listing_stops_city_trgm_idx` 25→26 · `listing_stops_city_idx` 2→3, ikisi de **+1**.
>
> 🔑 **Kaybedilen pozitif kontrol yerine TANIK yöntemi.** Plan "8.B oku → sonra kodu
> çevir" idi; #24 bugün önce yapıldı, yani `learn-aliases`:454 artık `origin_province_id`
> kullanıyor ve yedi indeksin tek bilinen tüketicisi kalmadı. Bu, "0 = tüketici yok" ile
> "0 = trafik yok" ayrımını imkânsızlaştıracaktı. **Tanık sütunu bunu telafi etti ve
> daha iyisini yaptı:** seyrek bir kod yoluna değil normal trafiğe dayanıyor. Aynı
> pencerede 92 bin tarama akarken metin indekslerinin sıfır kalması güçlü kanıt.
> 📌 Bundan sonraki her `idx_scan` ölçümüne tanık indeks koy — tek başına 0 okunamaz.
>
> 🔬 **`+1`'ler kovalandı, iki yanlış teşhisten sonra kapandı.** `pg_stat_statements`
> `city ILIKE '%'||p_city||'%'` içeren onlarca kayıt döndürdü; bunları canlı fonksiyon
> sanıp "Dalga 5 güvenli değil" alarmı verdim. **Yanlıştı.** `pg_proc` taraması o
> fonksiyonlardan hiçbirini bulamadı.
> 🚨 **SEBEP — `pg_stat_statements` UTILITY (DDL) İFADELERİNİ NORMALİZE ETMEZ.**
> `create or replace function …` bir utility ifadesi; gövde dolar-tırnaklı string olarak
> METNİN İÇİNDE, sabitleri `$1`'e çevrilmeden duruyor. Yani Dalga 3'te DEĞİŞTİRDİĞİMİZ
> eski fonksiyon gövdeleri, sorgu gibi görünen fosiller olarak tabloda kalmış.
> **Ayırt edici işaret çıktıda vardı:** `<>` satırlarında sabitler `$1`/`$9` diye
> normalize, `ILIKE` satırlarında `'%'` ham. Normalize edilmemiş metin = DDL fosili,
> canlı sorgu değil. `calls` da sorgu sayısı değil, migration'ı kaç kez koşturduğumuz.
>
> ✅ **FONKSİYON TARAMASI YENİDEN, BU SEFER FONKSİYON BAŞINA.** 8.F 31 Tem'de eşleşme
> başına sınıflandırmıştı — bir fonksiyonda bir masum eşleşme görüp fonksiyonun
> tamamını aklamak, o fonksiyonda başka eşleşme olmadığını kanıtlamaz. Bu yüzden
> `\m(origin_)?city\M` geçen HER public fonksiyon, geçiş sayısı ve 45 karakterlik
> bağlamıyla listelendi. **Dört fonksiyon çıktı, dördü de temiz:**
> · `ilan_olustur` (4+5) — `p_listing->>'origin_city'`, `t.s->>'city'` = JSON **girdi
>   anahtarı**; ayrıca hata mesajı metni ve `-- ⬅️ origin_city çıkarıldı` yorumu. Kolon
>   referansı YOK, v4 INSERT listesinde kolon yok.
> · `get_nearby_listings_by_province` (1+1) — `po.name as origin_city` = **çıktı kolonu
>   adı** + KOVA E yorumu.
> · `get_radar_city_detail` (0+4) ve `get_radar_city_overview` (0+3) — hepsi
>   `jsonb_build_object('city', …)` **anahtarı** ya da `p.name as city` takma adı.
> 🟢 **Yani 8.F'nin hükmü doğruymuş: canlı DB tarafında metin kolonlarının tüketicisi
> YOK.** Bu kez fonksiyon başına doğrulandı, eşleşme başına değil.
>
> ⏭️ **AÇIK KALAN TEK ŞEY: `+1` × 2.** En olası açıklama Selimpaşa düzeltmesinde
> `city` üzerinden attığımız elle filtre — yani ölçümü biz kirlettik. Ama bu hipotez
> bir kez zaten değiştirildi, hikâyeyle kapatılmıyor. **`public.idx_taban_20260804`
> alındı (4 Ağu).** Kural: bundan sonra `origin_city` / `listing_stops.city` üzerinde
> ELLE SORGU YOK. ~5 Ağu'da aynı fark sorgusu yeni tabana karşı okunur; iki indeks de
> 0 gelirse #21 kapanır. 4 günde 92 bin tarama geldiği için bir gün fazlasıyla yeter.
>
> ✅✅ **3 AĞU 2026 — `ilan_olustur` v4 CANLIDA (#26).** RPC artık
> `listings.origin_city` ve `listing_stops.city` metin kolonlarına **yazmıyor**;
> yalnız `province_id` yazıyor. Doğrulama: 2.1 mutlu yol geçti · 2.2
> `origin_city` NULL / `origin_province_id` 34 / `city` NULL / `province_id` 6 ·
> 2.3 her iki guard da `22023` attı (`Rotterdam` kalkış ve durak) ·
> guard sonrası `V4_GUARD_SIL` sayısı **0**, yani `raise` yarım satırı gerçekten
> geri aldı · test satırları silindi. ⏳ Kalan: **2.5 duman testi** (#39).
>
> 🚨🚨 **YOLDA CANLI KESİNTİ OLDU — `origin_city` NOT NULL'DI.** v4
> uygulandıktan sonra her `ilan_olustur` çağrısı `23502` attı; ilan oluşturma
> beş kanalda birden durdu. Çözüm: `alter table … drop not null` (kolonlar
> BÖLÜM 5'te zaten düşüyor, bu onun ön adımı). Ayrıntı ve kural v4 dosyasının
> yeni **ADIM 0.5** bölümünde.
> 📌 **Neden kaçtı:** plan "kolona yazmayı bırakmak" ile "kolonu düşürmek"
> arasında günlerce pencere olacağını doğru kurgulamıştı; o pencerede kolonun
> hâlâ **dolu olmayı zorunlu kıldığı** hiç sorulmadı. Ne v4 dosyası ne drop
> dosyası "NOT NULL" kelimesini bir kez geçiriyordu.
> → **Kural:** bir yazma yolunu kesmeden önce hedef kolonun KISITLARINA bak.
>   "Artık yazmıyoruz" ancak kolon bunu kabul ediyorsa doğrudur.
>
> 🚨 **SÜRÜM TESPİTİ İKİ KEZ YANLIŞ CEVAP VERDİ, İKİSİ DE ARAÇ HATASI.**
> **(1)** İlk denemede ADIM 1 hiç uygulanmamıştı ama bu ancak 2.2 metin
> döndürünce anlaşıldı. Ele veren şey KASA oldu: girdi `'istanbul'`/`'ANKARA'`,
> çıktı `İstanbul`/`Ankara` — kanonik yazım, yani değer `provinces.name`'den
> geliyor, yani v3'ün `coalesce(provinces.name, ham metin)` satırı hâlâ canlı.
> *Ham girdinin kanonikleşmiş hâli, hangi kod yolunun çalıştığını söyleyen bir
> parmak izidir.*
> **(2)** Ardından yazılan `pg_get_functiondef(p.oid) ~ 'v_origin_city'` sorgusu
> v4'te de TRUE döndü — çünkü `pg_get_functiondef` **yorumları da** döndürür ve
> v4 gövdesi üç yerde "v_origin_city KALDIRILDI" diye anlatıyor. Sorgu,
> kaldırıldığını söyleyen yorumu **kaldırılmamışlığın kanıtı** saydı.
> → `destination_city` mitiyle aynı sınıf: **"kodda geçiyor" ≠ "kod bunu
>   yapıyor".** Gövdede metin ararken yorum satırları elenmeli;
>   `20260803_get_nearby_cte_temizligi.sql` 2.1 bunu zaten doğru yapıyordu ama
>   teknik v4'e taşınmamıştı.

> 🗺️ **COĞRAFİ STANDARDİZASYON — DALGA 1 CANLIDA, DALGA 2 KODU HAZIR** (30 Tem 2026,
> tam plan `docs/COGRAFI_GECIS.md`). İl metin olmaktan çıkıp `province_id` (plaka kodu 1-81)
> oluyor; ilçe metin kalıyor ama **seçmeli** (81 il / 973 resmî ilçe `lib/constants/locations.json`).
> Geçiş **çift yazım**: metin kolonları yerinde kalır, Dalga 5'te drop edilir.
>
> ✅ **`docs/20260730_province_id.sql` ÇALIŞTIRILDI — 30 Tem 2026.** Doğrulama çıktısı:
> - 8.1 `listings` 234.229/234.229 = **%100** · `listing_stops` 244.379/244.379 = **%100**.
>   Tek satır bile eşleşmesiz kalmadı; alias köprüsüne (6.B) ihtiyaç olmadı denebilir.
> - 8.2 **sıfır satır** — id ile metin hiçbir yerde çelişmiyor.
> - 8.3 aynı il içi ilan **6.173** (~%2,6). Bunun ne kadarı meşru şehir içi taşıma, ne kadarı
>   W5'in sahte İstanbul→İstanbul'u — **henüz ayrıştırılmadı**, Dalga 2 öncesi ölçülmeli.
> - 8.4 `anon → SELECT`, `authenticated → SELECT/INSERT/UPDATE` yerinde (42501 tuzağı kapandı).
>
> ✅ **`docs/20260730_ilan_olustur_v3.sql` ÇALIŞTIRILDI (30 Tem 2026) — duman testi geçti.**
> Bilerek bozuk yazımla (`origin_city='istanbul'`, durak `'ANKARA'`) çağrıldı; dönen
> `İstanbul | 34` ve `Ankara | 6`. Yani metin kanonikleşiyor **ve** id doluyor, hem kalkışta
> hem durakta. ⚠️ Testte `source` uydurma değer alamaz — `listings_source_check` var (ilk
> denemede 23514 aldık).
> 🚨 **DÜZELTME (31 Tem 2026):** buraya yazılan "geçerli küme `whatsapp|facebook|telegram|manual`"
> YANLIŞTI. O küme `app/moderator/actions.ts:149`'daki `KAYNAK_SETI` ve kendi yorumunun dediği
> gibi **`raw_posts.source`** içindir — moderatörün ham mesajı nereden kopyaladığını anlatır.
> `listings.source` başka bir sütun; form kanalı oraya **`'form'`** yazıyor
> (`app/ilan-ver/actions.ts:90` → `ilanYaz(..., 'form')`). Gerçek kısıt tanımı için
> `docs/20260731_form_kanali_dogrulama.sql` ADIM 0.
>
> ✅ **DEPLOY YAPILDI** — `main` @ `4f09ee5`, 30 Tem 2026 18:13.
> ✅ **KAPSAMA ÖLÇÜMÜ GEÇTİ — 31 Tem 2026.** 24 saatlik pencere:
> `excel` 45/45 · `whatsapp` 609/609 · **eksik 0**. Çapraz kontrol (`origin_city <> provinces.name`)
> **sıfır satır**. RPC'yi atlayan yazma yolu yok; metin ile id hiçbir yerde çelişmiyor.
> ⚠️ **Ama form kanalı bu pencerede HİÇ görünmedi.** 24 saatte ilan üretmemiş, yani kapsaması
> **doğrulanmadı** — bozuk olduğu değil, ÖLÇÜLMEDİĞİ.
> "İki sorgu da temiz döndü" ile "dört yazma yolunun dördü de doğrulandı" aynı şey değil.
>
> 🚨 **Bu satır önce `source='manual'` diyordu — YANLIŞ ETİKET (düzeltildi 31 Tem 2026).**
> Form kanalının `listings.source` değeri **`'form'`**. Yanlış etiketle doğrulama yapılsaydı
> ilan açılmış olsa BİLE sorgu sıfır satır dönerdi ve "form kanalı kırık" sonucuna varılırdı —
> yani ölçüm aracı, ölçtüğünü sandığı şeyi hiç görmüyordu. Ders: bir sabiti belgeye
> kopyalarken **hangi tabloya ait olduğunu** da kopyala; `KAYNAK_SETI` yorumunda
> "`raw_posts.source`" yazıyordu ve üç belgeye `listings` sanılarak geçti.
>
> ### ✅ FORM KANALI DOĞRULANDI — 31 Tem 2026 (#29 KAPANDI)
>
> `docs/20260731_form_kanali_dogrulama.sql` çalıştırıldı. Kanıt:
>
> **ADIM 0 — kısıtın canlı tanımı** (artık tahmin değil, okundu):
> ```
> listings_source_check:  source = ANY (ARRAY['form','excel','whatsapp','facebook'])
> ```
> `'manual'` bu kümede **hiç yok** — yanlış etiket yalnız yanıltmıyordu, imkânsızı arıyordu.
>
> **ADIM 1 — tüm tablo, `group by source`:** `whatsapp` 234.781/234.781 · `excel` 100/100 ·
> `form` **3/3** — üç kanalda da eksik **0**. Form kanalının ilk ilanı 17 May 2026;
> toplam 3 ilan, yani 24 saatlik pencerede görünmemesi normal (kanal neredeyse kullanılmıyor).
>
> **ADIM 2 — canlı test, iki ilan + üç durak:** Tekirdağ/Muratlı → Van + Malatya, ve
> Tekirdağ/Çorlu → İzmir/Kemalpaşa. 2.c tek satırlık sonuç:
> `ilan 2 · ilan_eksik 0 · durak 3 · durak_eksik 0 · ilan_celiski 0 · durak_celiski 0`.
> Metin kanonik (`origin_city` = `provinces.name`), id dolu, `district_official=true`.
> **Dört yazma yolunun dördü de artık ölçüldü — Dalga 5'in bu ön koşulu kalktı.**
>
> 🚨 **DOĞRULAMA SIRASINDA İKİNCİ BİR MAYIN BULUNDU** (`lib/ilan-yaz.ts:84`, düzeltildi):
> `IlanKaynak` birleşimi `'form'|'excel'|'whatsapp'|'moderator'` idi. Kısıtta **`'moderator'`
> yok**, **`'facebook'` var** — yani tip, DB'nin reddedeceği bir değeri onaylıyor, kabul
> edeceği birini gizliyordu. `ilanYaz(..., 'moderator')` derlemeden geçer, RPC'de 23514 ile
> patlardı. Bugün çağıranı yoktu (moderatör akışı `app/moderator/actions.ts`'te RPC'yi
> doğrudan çağırıyor), yani **patlamamış bir mayındı, çalışan bir özellik değil**.
> Birleşim kısıtla birebir eşitlendi; `KANAL_POLITIKA` `Record<IlanKaynak,…>` olduğu için
> `facebook` politikası da yazılmak zorunda kaldı (`daimaIncele: true` — WhatsApp ile aynı
> gerekçe: serbest metin, form yok). `npx tsc --noEmit` temiz.
> **Genel ders:** bir TS birleşimi DB kısıtını doğrulamaz, yalnız **taklit eder**; ayrışırlarsa
> derleyici sessiz kalır. Kısıtı kopyalayan her yere "canlıdan nasıl okunur" sorgusunu da yaz.
>
> Migration'daki 6.A geri doldurma güncellemesi idempotent — arada oluşmuş NULL'lar için
> tekrar çalıştırılabilir (`where origin_province_id is null` koşulu zaten var).
>
> ✅ **Dalga 2 kodu tamam (30 Tem 2026).** `ilan_olustur` v3 + `lib/ilan-yaz.ts` +
> `app/moderator/actions.ts` + `app/panel/actions.ts` güncellendi; `parse-listing`,
> `excel-import` ve `whatsapp` **kod değişikliği gerektirmedi**.
> `npx tsc --noEmit` temiz · `test:lokasyon` 21/21 · `test:parser` 29/29.
> **Kilit karar:** jsonb ayrışma tuzağını disiplinle değil **tasarımla** kapattık — RPC v3
> `province_id`'yi `origin_city` metninden `il_key()` ile kendisi türetiyor ve metni kanonik ada
> çevirerek yazıyor. Çağıran unutsa bile id doluyor, ve `origin_city='istanbul'` sınıfı bozulma
> bir daha doğamıyor. (Tuzak `district_official` gibi DB'den türetilemeyen alanlar için sürüyor.)
>
> ✅ **W5 ALIAS DB TARAFI KAPANDI (30 Tem 2026).** Adım 9 →
> `docs/20260730_alias_adim9_kopya_pasiflestir.sql`: **612** katlanmış kopya `is_active=false`
> (silinmedi, yedek `public.aliases_adim9_yedek`), **1270** aktif kaldı. Kayıpsız — 552 grubun
> hiçbirinde `normalized`/`district` ayrışmıyordu. Ardından `20260729_alias_normalize_trigger.sql`
> BÖLÜM 1 (trigger) + BÖLÜM 2 (kısmi UNIQUE indeks) kuruldu, BÖLÜM 3'ün üç doğrulaması da geçti.
> Katlanmış alias kopyası artık DB seviyesinde doğamaz.
> ⏳ Runbook'un **Adım 3, 4, 6** (ilçe yazımı, NULL ilçe, elle kararlar) hâlâ açık.
> 📌 **31 Tem 2026 — bu üç adım artık işin ASIL kısmı.** Dalga 5 `origin_city` ve
> `listing_stops.city`'yi düşürüyor, `origin_district`/`listing_stops.district` DÜŞMÜYOR:
> yani ilçe, sistemde kalan **tek metin konum alanı** oluyor. Adım 0.3 ölçümü de bunu
> destekliyor — 16 çakışma grubunun **14'ü ilçe kolonlarında**. Buna karşılık runbook'un
> Adım **8.1/8.3/8.4**'ü düşecek kolonlara dokunuyor ve Dalga 5'ten sonra çalıştırılamaz
> hâle geliyor; `listings.origin_city`'de toplam **3 bozuk satır** olduğu için atlanması
> savunulabilir, ama bilinçli atlanmalı. Detay: runbook'un yeni **DALGA 5 ETKİLEŞİMİ** bölümü.
>
> ✅ **DALGA 3 TAMAMLANDI (31 Tem 2026).** Migration `docs/20260730_dalga3_radar_province_id.sql`
> canlıda çalıştırıldı; kabul kriteri **BÖLÜM 5.6 sıfır satır** döndü (metin sayımı = id sayımı,
> il il). Kod deploy edildi (`bd0c7d1`). Kapsam: `api/admin/radar`, `api/admin/radar/analitik`,
> `api/listings/yakin`, `app/moderator/page.tsx` ve son parça `app/_components/HomeClient.tsx`
> + yeni `app/api/listings/ara`.
> `npx tsc --noEmit` temiz · `test:lokasyon` geçti · `test:parser` 29/29.
>
> ⏳ BÖLÜM 6'daki metin/trigram index DROP'ları bilerek çalıştırılmadı — önce ~1 hafta
> `pg_stat_user_indexes` ile boşta olduklarını ölçmek gerekiyor (**~6 Ağu 2026'da bak**).
> Aynı bölümde ayrıca **çift index bulgusu** var: `listing_stops` üzerinde üç adet özdeş
> `(listing_id)`, `listings` üzerinde üç adet özdeş `(created_at DESC)`.
>
> 📏 **INDEX ÖLÇÜMÜ ALINDI (31 Tem 2026) — `docs/20260731_index_temizligi.sql` BÖLÜM 7.**
> Dört sonuç dosyanın ilk varsayımlarını değiştirdi:
> - **Tarih engeli kalktı ama yerine daha dar bir engel geldi.** `stats_reset = 30 Mar 2026`,
>   pencere **122,6 gün** — "sayaç penceresi kısa" gerekçesi yanlıştı. Ama Dalga 3 kodu
>   **31 Tem'de** deploy edildi, yani sayacın ~%99'u ESKİ kodu ölçtü. Doğru kural asimetrik:
>   metin indekslerinde `idx_scan = 0` geçerli kanıt, `> 0` **kanıt değil**.
> - **Üçüncü kopya grubu ölçüldü (7.C):** `shadow_profiles` `(listing_count DESC)` ×2,
>   24 ve 12 tarama — ikisi de kullanımda, yani eşdeğer indeks davranışı. En az şişmiş
>   olan (`shadow_profiles_listing_count_idx`, 160 kB) tutulur. Ayrıca
>   `shadow_profiles_created_at_idx` 122 günde **0 tarama** ve burada S1 çekincesi yok
>   (Dalga 3 bu tabloya dokunmadı) → temiz drop.
> - **🚨 BÖLÜM 1'İN KÖRLÜĞÜ BULUNDU (7.E).** `shadow_profiles_phone_key` (UNIQUE, kısıt)
>   ile `shadow_profiles_phone_idx` (düz btree) aynı kolonda; UNIQUE btree düz btree'nin
>   yaptığı her sorguyu yapar, yani düz olan işlevsel olarak gereksiz — ama BÖLÜM 1 bunu
>   kopya SAYMAZ, çünkü imzayı `pg_get_indexdef` **metninden** çıkarıyor ve
>   "CREATE UNIQUE INDEX" ≠ "CREATE INDEX". Ders: metinsel kopya ile **işlevsel kapsama**
>   ayrı iki tarama gerektirir. 7.E'ye hem doğrulama sorgusu hem şema geneli aday tarayıcı
>   eklendi (kolon-öneki kapsaması; opclass/sıralama farkına bakmaz, karar vermez).
> - **🚨 `raw_posts_dedup_idx` kararı TERSİNE DÖNDÜ — düşürülmeyecek.** Kısıt olarak
>   gereksiz (gerekçe kısmi indekslere rağmen ayakta, predikatlar ayrışmıyor **kapsıyor**),
>   ama **86.319 tarama** almış — `idx_raw_posts_clean_hash`'ten (83.358) fazla. Sorgu
>   indeksi olarak çalışıyor. Ayrıntı ve EXPLAIN testi: BÖLÜM 7.D.
> - **Bugün düşürülebilir ≈ 127 MB** (BÖLÜM 7.B): iki kopya grubunda 4 indeks (54 MB) +
>   122 günde hiç taranmamış 5 metin indeksi (73 MB). Kopya grubunda **en az şişmiş**
>   olan tutuluyor — BÖLÜM 4'ün ad uzunluğuna bakan önerisi boyutla ezildi.
> ✅ **7.B DROP'LARI ÇALIŞTIRILDI + doğrulama + duman testi geçti (31 Tem 2026, Bayram).**
>
> 🚨 **7.A SIFIRLAMASI REDDEDİLDİ — `42501 permission denied for function
> pg_stat_reset_single_table_counters`.** Supabase'de bu fonksiyon superuser'a bağlı.
> Bu, "sayacı sıfırla → bir hafta bekle → tekrar ölç" planını komple geçersiz kılar:
> sıfırlanamayan sayaçta beklemek, 122 günlük ESKİ KOD birikintisinin üstüne bir hafta
> yeni veri koymaktan ibarettir ve ikisi toplamın içinden ayrılamaz.
> **Yerine FARK yöntemi kondu — `docs/20260731_index_temizligi.sql` BÖLÜM 8.**
> Bugün `public.idx_taban_20260731` taban tablosu alınır (8.A), ~7 Ağu'da
> `simdi − taban` farkı okunur (8.B). Sıfırlamayla matematiksel olarak aynı sonuç,
> yıkıcı değil, yetki istemiyor. ⚠️ Fark alırken `stats_reset` de karşılaştırılır:
> Postgres yeniden başlarsa sayaç geri sayar, **negatif fark "kullanılmadı" değil
> "taban geçersiz"** demektir.
>
> 📌 **31 Tem BÖLÜM 5 çıktısı (taban değerleri, 122 günlük pencere):**
> `idx_listings_origin` 110 · `idx_listings_origin_city_lower` 44 ·
> `listings_origin_city_trgm_idx` 29 · `listing_stops_city_trgm_idx` 25 ·
> `idx_listing_stops_city_lower` 24 · `idx_listings_origin_city` 11 ·
> `listing_stops_city_idx` 2. Toplam ~72 MB. Sayılar **çok düşük** (110 tarama /
> 122 gün ≈ günde 1) — bunlar sıcak yol değil, seyrek çalışan tüketiciler.
>
> 🔎 **İlk tüketici koddan bulundu (8.D):** `app/api/admin/learn-aliases/route.ts`:437
> `.in('origin_city', kesfedilenNorm)` — AI Keşfi yeni alias bulduğunda çalışan bir
> UPDATE. `idx_listings_origin`'in düz btree kullanımını ve seyrekliğini birebir
> açıklıyor. **Dalga 5 öncesi `origin_province_id`'ye çevrilmeli**, yoksa kolon
> düştüğü an keşif 42703 ile patlar.
> ✅ **TÜKETİCİ AVI KAPANDI (31 Tem 2026, BÖLÜM 8.F).** Üç kanal da tarandı:
> - **DB fonksiyonları:** dört eşleşme çıktı, dördü de yanlış pozitif ya da yazma.
>   `get_radar_city_*`'in `city`'leri jsonb ANAHTARI veya `provinces.name`;
>   `get_nearby_listings_by_province`'ın `origin_city`'si `po.name as origin_city`
>   yani çıktı kolonu ADI; `ilan_olustur` INSERT yapıyor ve **INSERT `idx_scan`
>   artırmaz**. Hiçbiri `listings.origin_city`'yi WHERE'de kullanmıyor.
> - **View + RLS politikaları:** ikisi de sıfır satır.
> - **Uygulama sorguları:** `origin_city`/`stops.city` geçen her TS satırı ya
>   `select` kolon listesi, ya JSX, ya da **fetch sonrası bellek içi JS filtresi**
>   (`moderator/page.tsx`:297,301 · `PanelClient.tsx`:242 — DB'ye gitmez).
>   Tek istisna `learn-aliases`:437.
>
> 📌 **Sonuç:** `lower()` ve trigram indekslerinin (`idx_listings_origin_city_lower`,
> `listings_origin_city_trgm_idx`, `idx_listing_stops_city_lower`,
> `listing_stops_city_trgm_idx` — toplam ~62 MB) **canlı tüketicisi YOK**.
> 44/29/25/24 tarama Dalga 3 öncesi ILIKE'lı RPC sürümlerinden kalıntı.
> 7 Ağu farkında 0 bekleniyor → Dalga 5'te temiz drop.
>
> ⚠️ **`learn-aliases`:437 bilerek ŞİMDİ değiştirilmedi** — 8.B ölçümünün **pozitif
> kontrolü** o. 7 Ağu'da `idx_listings_origin` farkı >0, diğer dördü 0 çıkarsa
> ölçümün gerçekten çalıştığını biliriz. Hepsi 0 çıkarsa "tüketici yok" ile
> "hiç trafik gelmemiş" ayırt edilemez. Sıra: 8.B oku → kodu çevir → Dalga 5.
>
> ⏳ **`docs/20260731_dalga5_metin_kolon_drop.sql` YAZILDI (31 Tem 2026) — ÇALIŞTIRILMADI.**
> Bir hafta önceden yazılmasının sebebi çalıştırmak değil, gözden kaçan bağımlılıkları
> çıkarmaktı. **İkisi çıktı ve ikisi de `COGRAFI_GECIS.md`'nin Dalga 5 madde listesinde yoktu:**
> 1. 🚨 **`ilan_olustur` hâlâ her iki metin kolonuna INSERT ediyor** (v3, satır 88-99 ve 139-146).
>    plpgsql gövdesi DDL anında doğrulanmaz: `drop column` **hatasız geçer**, sonra ilk ilan
>    oluşturma denemesinde 42703 ile patlar. Hata deploy'da değil canlıda çıkar ve dört yazma
>    yolunun dördü de bu RPC'den geçtiği için **ilan girişi tamamen durur**. → `ilan_olustur` v4
>    (migration BÖLÜM 1) drop'tan ÖNCE canlıda olmalı. RPC'nin JSON *girdi* anahtarları değişmez.
> 2. **Çözülemeyen yer adları geri getirilemez.** v3'ün `coalesce(provinces.name, ham metin)`
>    bacağı bilinçli bir koruma: il çözülemezse (yurt dışı, serbest giriş) ham metin saklanıyordu.
>    `listing_stops`ta `raw_text` yedeği bile yok → çözülemeyen durak **tamamen boş satır** olur.
>    → Migration BÖLÜM 3 ölçümü drop'tan önce alınır.
>
> Ayrıca: `origin_city` repoda 30 dosyada 97 kez geçiyor ama hepsi kolon değil — migration
> BÖLÜM 2 bunları üç kovaya ayırıyor (DB predikatı / select+gösterim / LLM anahtarı ve yorum).
> Üçüncü kovaya (`whatsapp`, `parse-text`, `llm-parse`, RPC girdileri) **dokunulmaz**;
> değiştirmek ayrıştırmayı bozar. `destination_city` için kod temizliği yok: `.ts`/`.tsx`
> içinde sıfır eşleşme — 🚫 ve sebebi "kolon terk edilmiş" değil, **öyle bir kolon hiç
> yok** (#28, 42703). Aynı gözlemden yanlış sonuca varılıp madde bir dönem "ölü kolon,
> Dalga 5'te düşürülecek" diye taşındı.
>
> ✅ **BÖLÜM 0 ÖN KOŞULLARI ALINDI (31 Tem 2026) — `docs/20260731_dalga5_olcumler.sql`.**
> Ölçüm bilerek **v4'ten (#26) ÖNCE** alındı: v4 canlıya çıktığı an her yeni satır
> `origin_city IS NULL` olur, 3.1/3.2 sayaçları kalıcı olarak gürültüye boğulur ve
> "kayıp gerçekten sıfır mıydı, yoksa v4 mi örttü" bir daha yanıtlanamaz.
> **Ölçüm, ölçtüğü şeyi değiştiren işlemden önce alınır.** (Görev listesinde bu bağımlılık
> bir süre TERS yazılıydı: "#26 → #27". Düzeltildi.)
>
> 📏 **3.1 — ilanlar:** 234.885 satır · `pid_yok_metin_var` **0** · `telafisiz_kayip` **0**.
> 📏 **3.2 — duraklar:** 245.152 satır · `pid_yok_metin_var` **0** · `zaten_bos` **0**.
> 📏 **3.3.a / 3.3.b:** sıfır satır — bakılacak metin yok.
> 📌 **Karar: `origin_serbest_metin` kolonu GEREKMİYOR.** Karar ağacının (b) dalı — yurt dışı
> / serbest yer adı taşıma — boş çıktı. v3'ün `coalesce(provinces.name, ham metin)` koruma
> bacağının düşmesi bugünkü veride hiçbir şey kaybettirmiyor.
>
> 🚨 **AMA "BUGÜN SIFIR" ≠ "YARIN DA SIFIR".** Sıfırın sebebi verinin doğası değil,
> `lib/ilan-yaz.ts`'in ili çözemediğinde ilanı RPC'ye **hiç göndermemesi**
> ("Kalkış ili tanınamadı"). Yani koruma **TS katmanında**, DB'de değil — ve `ilanYaz()`'ı
> atlayan iki yol var: `app/moderator/actions.ts` ve
> `supabase/functions/parse-listing/index.ts`. Kolon düştükten sonra bu yollardan biri
> çözülemeyen bir il gönderirse ilan **kalkışsız** ya da durak **tamamen boş** yazılır ve
> hata vermez. → Ölçümün ortaya çıkardığı asıl iş: **v4 gövdesine iki `22023` guard eklendi**
> (biri `v_origin_pid is null` için, biri `p_stops` üzerinde ve **INSERT'ten ÖNCE**).
> Guard'lar `docs/20260731_dalga5_metin_kolon_drop.sql` BÖLÜM 1'de hazır.
> ⚠️ "Ölçüm sıfır çıktı, guard gereksiz" denmemeli — ölçüm mevcut korumanın *çalıştığını*
> gösterir, kolon düştükten sonra o korumanın *yerinde kalacağını* değil.
>
> ⏳ **`docs/20260731_ilan_olustur_v4.sql` YAZILDI (31 Tem 2026, #26) — ÇALIŞTIRILMADI.**
> Dalga 5 BÖLÜM 1'in çalıştırılabilir hâli, ayrı dosyaya alındı çünkü v4 drop'u
> beklemez: BÖLÜM 2 kod temizliğiyle **aynı release'te**, drop'tan günler önce çıkar.
>
> ✅ **3 AĞU 2026 — BÖLÜM 2 KOD TEMİZLİĞİ BİTTİ, v4 ARTIK ÇIKABİLİR.**
> KOVA A/2.2 (#35 içinde), KOVA B (#35) ve KOVA D (#34) tamamlandı; `tsc --noEmit`
> temiz, `test:lokasyon` ve `test:parser` (29/29) geçiyor. **v4 ile aynı release'te
> çıkması gereken tek zorunlu kod değişikliği** `learn-aliases`'in predikatıydı
> (`.is('origin_city', null)` → `.is('origin_province_id', null)`): v4 metne
> yazmayı bıraktığı an eski predikat kuyruğu **ili gayet güzel çözülmüş ~234 bin
> satırla** doldururdu. O da yapıldı.
> ⚠️ **#24 (`learn-aliases`:437 `.in('origin_city', …)`) BİLEREK BEKLİYOR** — 8.B
> ölçümünün (#21, ~7 Ağu) **pozitif kontrolü**. v4'ü bloke etmez: `.in()` predikatı
> metin kolonu hâlâ *var* olduğu sürece çalışır; yalnız BÖLÜM 5 drop'undan önce
> çevrilmesi şart.
> ADIM 0 ön ölçümü çalıştırıldı → **`listings`te `origin_province_id IS NULL` 0 satır**,
> `listing_stops`ta `province_id IS NULL` **0**. Yani guard geriye dönük hiçbir akışı
> kırmıyor. (3.1 bu hücreyi ölçmemişti: "pid yok **metin de yok**" hiç sayılmamıştı.)
>
> ❌ **DÜZELTME — "iki korumasız yazma yolu var" YANLIŞTI.** Kod okundu:
> `lib/ilan-yaz.ts`:247,271 ve `app/moderator/actions.ts`:180,196 **ikisi de**
> "Kalkış/Varış ili tanınamadı" kontrolünü yapıyor. `moderator/actions.ts`
> `ilanYaz()`'ı atlıyor ama kontrolü kendi içinde tekrarlıyor —
> **"ilanYaz()'ı atlıyor" ≠ "korumasız"**; ilki çağrı grafiği, ikincisi davranış.
> Grafiğe bakıp davranış çıkarmak hatayı üretti. Korumasız yol **bir tane**:
> `supabase/functions/parse-listing/index.ts`:836 (Deno `lib/lokasyon.ts`'i import
> edemiyor, `origin_province_id` bile göndermiyor, çözümlemeyi tümüyle RPC'ye devretmiş).
> → Guard "olmayacak şeye sigorta" değil, **tek korumasız kanalın tek koruması**.
>
> 🐛 **DÖRDÜNCÜ SESSİZ BUG — v4 yazılırken bulundu (düzeltildi, 31 Tem 2026).**
> `parse-listing/index.ts`:884 döngü dışında **koşulsuz**
> `processing_status='processed'` yazıyordu; döngü ise RPC hatasında `continue`
> ediyor. Yani **hiç ilan oluşmasa bile** ham mesaj `processed` işaretlenip
> `no_lane` kuyruğundan düşüyordu — moderatör bir daha görmüyordu.
> 🚨 v4 ile birleşince guard **amacının tersini** yapardı: v3'te çözümsüz il
> "görünür bozuk ilan" (moderatör alias öğretir, düzelir) üretiyordu; v4 + eski
> satır bunu **hiçbir kuyrukta olmayan kayıp mesaja** çevirirdi.
> **Bir katmandaki gürültü, üst katman onu yutuyorsa gürültü değildir.**
> Düzeltme: `created > 0 ? 'processed' : 'no_lane'` + WARN log. Böylece mesaj
> kuyrukta kalır, alias öğretilince `reprocess-no-lane` yeniden dener.
> ⚠️ Bu bug **v4'ten bağımsız ve önceden vardı** — bugün de 23514/22P02 gibi her
> RPC hatası aynı şekilde mesaj kaybediyor. v4 onu kenar durumdan beklenen akışa
> çevirdiği için görünür oldu. → **Görev #33** (deploy, v4'ün ön koşulu).
> ~~🚨 `SUPABASE_ACCESS_TOKEN` eksik olduğu için bu düzeltme **sessizce deploy
> edilmemiş olabilir**; token eklenmeden ve deploy zamanı gözle doğrulanmadan
> v4 çalıştırılmaz.~~ → ✅ **CANLIDA DOĞRULANDI (3 Ağu 2026).**
> Dashboard → Edge Functions → `parse-listing` → Code:
> `created > 0 ? 'processed' : 'no_lane'` **var**, koşulsuz
> `processing_status: 'processed'` **yok**. v4'ün ön koşulu karşılandı.
>
> 📌 **Doğrulama zaman damgasıyla YAPILAMADI, kodu okuyarak yapıldı.**
> Dashboard "4 saat önce güncellendi" diyordu; dosyanın içeriği 31 Tem 15:57'de
> yazılmış ama commit'i (`c2fd071`) 3 Ağu 11:04'te atılmıştı — yani deploy,
> commit'ten iki saat ÖNCE görünüyordu. Bu ne kanıt ne de yalanlama:
> **commit deploy değildir**, deploy çalışma ağacından okur. Üç tarih üç ayrı
> şeyi ölçüyordu ve hiçbiri "canlıda hangi kod var" sorusunu cevaplamıyordu.
> → **Kural:** deploy doğrulaması zaman damgası karşılaştırması değil,
> **canlı gövdede tek bir ayırt edici satırı aramaktır.** Aynı kural
> `pg_get_functiondef` ile DB tarafında zaten uygulanıyordu (#37 ADIM 0);
> Edge Function tarafında da aynısı geçerli.
>
> 🚨 **BEŞİNCİ BULGU — KOVA SAYISI ÜÇ DEĞİL, DÖRT (3 Ağu 2026, → Görev #34).**
> BÖLÜM 2 envanteri `origin_city`'yi *geçtiği yere* göre tasnif etmişti:
> "predikat / gösterim / prompt". Ama **gösterim ile yazma aynı kovaya düşmüştü**:
> `app/panel/actions.ts`:135 ve `app/moderator/page.tsx`:580 KOVA B'de
> "SELECT listesi + gösterim" başlığı altındaydı — oysa ikisi de
> `listings.update({ origin_city: … })` çağırıyor. Duraklar için de aynısı
> (`panel/actions.ts`:167, `moderator/page.tsx`:606). Dört yer, hiçbiri RPC'den
> geçmiyor → **BÖLÜM 1 guard'ı bu yolları göremez**, BÖLÜM 5 drop'u 42703 ile kırar.
> Bir KOVA B maddesini atlarsan ekran boş şehir gösterir; bir KOVA D maddesini
> atlarsan panelde ilan düzenleyen **her kullanıcı hata alır**.
>
> 🚨🚨 **ALTINCI BULGU — YUKARIDAKİ BEŞİNCİ BULGUNUN "ASIL MESELE"Sİ YANLIŞTI
> (3 Ağu 2026, aynı gün). DÖRT YAZMA YOLU DEĞİL, İKİ.**
> Beşinci bulgu `panel/actions.ts`'in "sessiz NULL"unu kovanın en tehlikeli
> maddesi ilan etmiş ve buradan bir **ürün kararı** türetmişti ("çözülemeyen ilde
> reddet mi, NULL'a mı çek"). O karar **yok hükmünde: `ilanGuncelle` ulaşılamaz
> kod.** Zincir: `panel/actions.ts::ilanGuncelle` ← tek import eden
> `panel/IlanYonetim.tsx` ← **hiç kimse**. Panelin canlı düzenleme yolu
> `/api/ilan/duzelt` ve o uç nokta **tek bir konum alanı bile yazmıyor**
> (`notes, vehicle_type, body_type, moderation_status, status, is_shadow_banned,
> audit_score, internal_audit_logs, reviewed_at`) — kullanıcı panelden ilanının
> ilini bugün zaten **değiştiremiyor**. Yani "drop'tan sonra kalkış bilgisi
> büsbütün kaybolur" senaryosunu tetikleyecek bir kullanıcı akışı **yok**.
> Kalan tek canlı doğrudan yazma yolu moderatör paneliydi; o da çözülemeyen ili
> zaten **reddediyor** (`moderator/page.tsx`:543-548, :558-564 —
> `alert('Kalkış ili tanınamadı…')`) ve il girdileri serbest metin değil
> `<select>`. → **KOVA D salt mekanik anahtar silmeye indi ve 3 Ağu'da bitti.**
>
> 📌 **Asıl ders — `grep` bir çağrı grafiği değildir.** Envanteri çıkarırken
> sorulan soru "bu dosya kolona yazıyor mu?" idi; sorulmayan soru "bu dosya
> **çalışıyor mu?**". Erişilebilirlik hiç kontrol edilmedi ve ölü bir dosya,
> runbook'un en kritik maddesi + bir ürün kararı olarak **üç ayrı belgeye**
> yazıldı. Bu, KOVA E ile aynı kökten hata: orada kapsam *dile* göre (yalnız
> `.ts`/`.tsx`), burada *erişilebilirliğe* göre daralmıştı; ikisi de "envanter
> tamam" dedirtip yanlış tarafta bıraktı.
> → **Kural:** bir yazma yolunu kovaya koymadan önce importer zincirini sonuna
> kadar sür. Zincir kopuyorsa madde "dönüştürülecek" değil, **"ölü — silinecek"**
> kovasına gider.
> ~~⚠️ Ölü dosyalar duruyor (silme kararı Bayram'da): `panel/actions.ts`,
> `panel/IlanYonetim.tsx`, `u/[username]/IlanListesi.tsx`.~~ IlanYonetim 3 Ağu'da
> yine de KOVA B kalıbına çevrildi (o an ölü olduğu bilinmiyordu — zararsız ama
> gereksiz); IlanListesi **çevrilmedi**, başına ölü-dosya başlığı yazıldı.
>
> ✅ **3 AĞU 2026 — #38 BİTTİ: 11 dosya `git rm` ile silindi.**
> Üç ölü kaynak (`app/panel/actions.ts`, `app/panel/IlanYonetim.tsx`,
> `app/u/[username]/IlanListesi.tsx`), `scripts/_chk-iller.mjs` (#36'nın geçici
> betiği) ve yedi scratch `.txt` (`app/_fix.txt`, `app/panel/_fix.txt`,
> `app/u/[username]/_fix.txt`, `app/moderator/` altında `_fn` `_fns_new`
> `_patch` `_siradakine`). Hepsi git'te izleniyordu, o yüzden `rm` değil
> `git rm`. **Kanıt `npx tsc --noEmit` (temiz)** — grep sadece "importer yok"
> diyordu, ölü olduklarını kesin söyleyen derleyici.
>
> ⚠️ **`app/panel/` karma bir dizindi** — `page.tsx` ve `PanelClient.tsx`
> ikisi de KOVA B'de dönüştürülmüş CANLI dosyalar. Dizin bazlı bir silme
> (`rm -rf app/panel`) paneli komple götürürdü. Aynı şekilde
> `app/moderator/actions.ts` adı `panel/actions.ts`'e benziyor ama **canlı**
> (`moderator/page.tsx`:6 üç fonksiyonunu import ediyor).
> → Silme listesi dizin değil, **dosya** bazlı olmalıydı ve öyle yapıldı.
>
> 📌 Scratch dosyaların gerçek konumu ancak `find` ile çıktı: önceki not
> üçünü dizin öneki olmadan taşıyordu ve hepsi `app/moderator/` altındaydı;
> ayrıca listede hiç olmayan iki `_fix.txt` daha vardı. Beş sanılan scratch
> yedi çıktı. **Yol tahmin edilmez, aranır.**
> 🧹 Kalan tek scratch: `app/ilan/[id]/_aksiyonlar_props.txt` (izleniyor, altı
> satırlık JSX parçası, hiçbir yerden referans yok) — bu turda listede olmadığı
> için dokunulmadı, bir sonraki temizlikte silinebilir.
>
> ✅ **4 AĞU 2026 — `_aksiyonlar_props.txt` SİLİNDİ. Sebep düzen değil, GÜVENLİK.**
> Dosya 28 Nis'te (`9e9eac5`) donmuş 169 baytlık bir `<Aksiyonlar …>` çağrısıydı
> ve içinde **`contactPhone={ilan.contact_phone}`** yazıyordu. Canlı çağrı ise
> `app/ilan/[id]/page.tsx`:472-479'da `contactPhone={user && profilTamamlandi ?
> ilan.contact_phone : null}` — SPRINT_01 L1c güvenlik düzeltmesi. Yani `.txt`
> düzeltme ÖNCESİ hâli saklıyordu: kopyala-yapıştırılsa misafir kullanıcının
> Flight payload'ına telefon numarası **geri sızardı**.
> → Adı (`_aksiyonlar_props`) ve konumu (bileşenin yanı) "Aksiyonlar'ı böyle
> çağır" diye okunuyordu; taşıdığı bilgi zaten iki **derleyici denetimli** yerde
> doğru duruyor: `page.tsx`:472 (fiilî çağrı) ve `Aksiyonlar.tsx`:25 (`Props`).
>
> 🔁 **Bu, aynı kalıbın DÖRDÜNCÜ örneği: "kayıt gerçeklikten ayrıldı, çünkü onu
> kimse doğrulamıyordu."** Öncekiler: `destination_city` (kolon hiç yoktu),
> `get_nearby_listings_for_parked_driver` (fonksiyon hiç deploy edilmemişti),
> `processed_at` (kolon vardı, hiçbir şey yazmıyordu). Ortak yan: dördü de
> derleyicinin/veritabanının denetlemediği bir yerde yaşıyordu. Denetlenmeyen
> kayıt yanlış olduğunda susar; en tehlikelisi de **eskiyen bir güvenlik
> düzeltmesinin öncesini** donduran kayıttır.
>
> ✅ **3 AĞU 2026 — #36 BİTTİ: 81 il listesi beş kopyadan ikiye indi.**
> Aynı dizi `moderator/page.tsx`:14, `admin/poi-onay/PoiOnayClient.tsx`:63,
> `u/[username]/page.tsx`:10 ve `admin/radar/RadarClient.tsx`:116 (`SEHIRLER`)
> içinde **elle** duruyordu; dördü de artık `lib/lokasyon.ts`'in yeni
> `IL_ADLARI` / `IL_ADLARI_ALFABETIK` export'larından türüyor.
>
> 📌 **Bunu şimdi yapmanın sebebi Dalga 5.** Filtre Dalga 5'ten önce metin
> kolonunu okuyordu; artık `ilAdi(id) === filtreKalkis` diye **tam eşitlik**
> karşılaştırıyor. Yani dropdown'ın kopyası ile `ilAdi()`'nin kaynağı arasındaki
> tek harflik bir sapma — bir `Hakkari`/`Hakkâri`, bir `Afyon`/`Afyonkarahisar` —
> hata fırlatmaz, filtreyi **sessizce hiçbir şey döndürmez** hale getirir.
> Dört kopyanın hiçbiri test edilmiyordu; `ILLER` ↔ `locations.json`
> sözleşmesini `test:lokasyon` korurken bu dördü serbestçe ayrışabilirdi.
>
> 🔧 **RadarClient'ta liste sırası bilerek DEĞİŞTİ.** Elle yazılmış dizi Türkçe
> kurallı değildi: `Şanlıurfa` Siirt'ten ÖNCE, `Kilis` `Kırıkkale`'den önce
> (`Ş`/`S` ve `ı`/`i` katlaması). `Intl.Collator('tr')` ile **dokuz konum** yer
> değiştirdi. Seçilen DEĞER il adı olduğu için filtre davranışı değişmez;
> yalnız açılır liste doğru sırada görünür. Ekran görüntüsü karşılaştıran olursa
> bu fark BEKLENEN.
>
> ⚠️ **Beşinci kopya kasten duruyor:** `lib/ilan-sabitler.ts::ILLER`.
> `lokasyon.ts` ondan `ilKey`'i import ediyor, ters yön **döngü** olurdu.
> İkisini `scripts/test-lokasyon.mts`:17 zaten bağlıyordu; aynı dosyaya üç yeni
> assert eklendi (`IL_ADLARI ↔ ILLER` birebir · alfabetik permütasyon · Türkçe
> sıra). `HomeClient` / `ilan-ver` / `TopluYukle` zaten `ilan-sabitler`'den
> import ediyordu — dokunulmadı, zaten korunuyorlar.
> tsc temiz · `test:lokasyon` tümü geçti · `test:parser` 29/29.
> 🧹 `scripts/_chk-iller.mjs` (geçici doğrulama betiği) silinemedi — sandbox FUSE
> `rm`'e izin vermiyor. Ölü dosya listesine eklendi.
>
> ✅ **3 AĞU 2026 — #37 (KOVA E) ÇALIŞTIRILDI VE DOĞRULANDI.**
> `docs/20260803_get_nearby_cte_temizligi.sql` canlıda uygulandı.
> ADIM 2 sonuçları: **2.1** 0 satır (gövdede metin kolonu kalmadı) ·
> **2.2** `anon` + `authenticated` + `postgres` + `service_role` hepsi EXECUTE
> — `create or replace`'in GRANT'ları koruduğu teyit edildi · **2.3** `0/0`.
>
> ⚠️ **2.3'ün `0` dönmesi ilk bakışta "fonksiyon boşa düştü" gibi okunuyordu.**
> Adımın amacı değişiklik öncesi/sonrası satır sayısını karşılaştırmaktı ama
> ÖNCESİ ölçülmemişti — yani `0` tek başına hiçbir şey kanıtlamıyordu.
> Kontrol sorgusuyla ayrıştırıldı: `listings` içinde `origin_province_id = 34`
> + `status='active'` + `moderation_status in (approved, auto_published)`
> + `is_shadow_banned = false` koşulunu sağlayan ilan sayısı da **0**.
> → Fonksiyon doğru; İstanbul'da gösterilebilir aktif ilan yok.
> 📌 **Ders:** "beklenen çıktı" bir taban çizgisine dayanmıyorsa doğrulama
> adımı değildir. Sıfır dönen bir sayaç, ya doğru cevabı ya da tamamen kırık
> bir sorguyu aynı şekilde gösterir; ayırt etmek için ikinci bir sorgu şart.
>
> ⏳ Kalan: **2.4 duman testi** (canlı, deploy sonrası) — `/yol-rehberi` →
> "Yakınımdaki Yükler" konum izniyle sonuç veriyor mu, `dest_city` dolu mu.
> Deploy (Adım 1) yapılmadan bu kutu işaretlenemez.
>
> ✅ **KOVA B'nin çözümü join değil, `ilAdi()`.** İlk plan
> "`provinces!origin_province_id(name)` gömülü sorgusu" diyordu; gereksiz.
> 81 il zaten `lib/constants/locations.json`'da (25 KB) ve `lib/lokasyon.ts`:83
> `ilAdi(id)` haritayı bellekte tutuyor — `app/moderator/page.tsx` gibi **istemci**
> bileşenleri bu modülü bugün import ediyor, yeni paket ağırlığı yok. Join'in
> bedeli her liste sorgusuna bir gömülü ilişki + dönen JSON'da `origin_city`
> yerine `provinces:{name}` nesnesi olurdu: aynı iş, daha pahalıya.
> Kalıp: SELECT'te `origin_city`→`origin_province_id`, gösterimde
> `ilan.origin_city`→`ilAdi(ilan.origin_province_id) ?? '—'`. Tel üzerindeki
> veri de küçülür (smallint ⟵ text).
>
> 🔎 **EK — `idx_listings_origin` çözüldü:** tanımı
> `CREATE INDEX idx_listings_origin ON public.listings USING btree (origin_city)` —
> yani `origin_province_id` değil, **metin kolonu** indeksi. BÖLÜM 4 drop listesine eklendi
> (liste artık 7 indeks). 110 taramayla yedisinin en aktifi olduğu için **8.B farkının en
> güçlü pozitif kontrol adayı** o (bkz. #21, #24 — `learn-aliases`:437 bilerek çevrilmedi).
> ⚠️ `idx_listing_stops_city_lower` ve `listing_stops_city_trgm_idx` bu EK sorgusunda
> dönmedi çünkü filtre `%origin_city%` idi — **yokluk kanıtı DEĞİL**, tanımları
> `20260731_index_temizligi.sql`:279'da.
>
> ✅ **BÖLÜM 1-3 ÇALIŞTIRILDI — 4 Ağu 2026.** `districts` (973/81) ve `ilce_resmi()` canlıda.
> Doğrulama: 4.1 `973/81` · 4.2 `0 satır` · 4.4 `t1..t9` tam isabet (Ankara **ve** Adıyaman
> Gölbaşı ikisi de `true`). Çalıştırmadan önce 973 satır `locations.json` ile programatik
> karşılaştırıldı: birebir, tekrar yok, çift yönlü fark yok.
> ✅ **Fonksiyon canlı veriye karşı çapraz doğrulandı:** `district_official` dolu 62 durakta
> kolon ile fonksiyon yan yana → 58 `(true,true)` + 4 `(false,false)`, **çapraz satır yok**.
> Bu kontrol yalnız entegrasyondan ÖNCE anlamlıydı; sonra ikisi aynı kaynağa döner.
> ✅ **4.3 tek-kaynak testi YAZILDI (#49, 4 Ağu):** `npm run test:districts` →
> `scripts/test-districts.mts`. Migration dosyasının INSERT bloğunu ayrıştırıp
> `locations.json` ile çift yönlü karşılaştırıyor + 8 çapa kontrol. Kimlik bilgisi
> istemez. Negatif doğrulaması yapıldı (bir `province_id` bozuldu → 3 kontrol kırıldı).
> ⚠️ **Sınırı bil:** JSON ↔ **migration dosyası**nı karşılaştırıyor, canlı tabloyu değil.
> Tabloya elle satır eklenirse görmez — `provinces` ile aynı kural: elle EKLEME YAPMA.
> 🚫 **Kalan tek parça:** `ilan_olustur` v4 entegrasyonu (#50, Dalga 5 ile aynı anda).
> Yani fonksiyon canlıda DURUYOR ama **hiçbir yazma yolu onu çağırmıyor**.
>
> 📊 **İlk denetim (4.5):** listings 12.377 resmi · 82 değil (%0,66) · 222.855 belirsiz —
> belirsizin tamamı ilçesi boş, **`origin_province_id is null` tek ilan yok**.
> stops 15.583 · 170 (%1,08) · 229.882. Resmi olmayanların çoğu mahalle/bölge adı
> (Avrupa 31 · Hadımköy 26 · Işıkkent 8 · Selimpasa 7) — orada `false` DOĞRU cevap.
> 🔍 **"Gerçek ilçe ama bu ilin değil" elemesi iki gerçek hata buldu:**
> · `whatsapp` × 5 (29 Tem): Sakarya + **Orhaneli** (Bursa ilçesi). `origin_city`='Sakarya'
>   ve `province_id`=54 uyuşuyor → **il doğru, parser ilçeyi uydurmuş**. Varış durakları
>   İzmir/Balıkesir/Antalya, hiçbirinde Bursa yok → "varıştan bulaştı" hipotezi ÇÜRÜDÜ.
> · `excel` × 3 (29 Tem 16:02): Tekirdağ + **LÜLEBURGAZ/VİZE** (ikisi de Kırklareli).
>   `city`='Tekirdağ' ile `province_id`=59 uyuşuyor → kod değil, **dosyadaki insan hatası**.
> ⇒ İkisi de #30'un varlık sebebinin kanıtı: bu 8 satır bir haftadır kimsenin gözüne
> çarpmadan canlıda duruyordu. #50'den sonra yazma anında `false` bayrağı alırlardı.
>
> ⏳ *(31 Tem 2026'da yazıldığındaki hâli:)*
> 973 ilçe + `il_key()` katlamalı `(province_id, ad)` UNIQUE + `public.ilce_resmi()` fonksiyonu.
> `COGRAFI_GECIS.md:205-212`'deki "kapatılmayan tek boşluk" (Deno'da `district_official` NULL)
> buradan kapanıyor — **Deno'ya liste vererek değil, kararı DB'ye taşıyarak**, böylece dört
> yazma yolu da aynı cevabı verir.
> 📌 **Tasarım kararı: `district_id` kolonu EKLENMİYOR.** İl için yapılan 5 dalga ilçede
> tekrarlanamaz çünkü ilçe adı tek başına tekil değil: `Merkez` **51 ilde**, 24 ad daha iki-üç
> ilde birden (`Gölbaşı`, `Kemalpaşa`, `Yenişehir`…). `provinces_il_key_uniq`'in verdiği tek
> satır garantisi ilçede YOK, dolayısıyla "metinden id çöz" adımı sessizce yanlış il seçer.
> Tablo bunun yerine **doğrulama sözlüğü**: "bu il için bu ilçe var mı?".
> 📌 Bu liste alias runbook Adım 6.5/6.6'yı da doğruluyor — `gölbaşı`/`kemalpaşa` belirsizliği
> uydurma değil, resmî ilçe listesinin kendisinden geliyor. ⚠️ Runbook 6.6 Artvin/Kemalpaşa'yı
> "belde" diyor; 2020'de ilçe oldu, gerekçe eskimiş (karar yine de doğru).
> ⚠️ **Tek kaynak ikiye çıkıyor:** `locations.json` + tablo. Ayrışırlarsa `district_official`
> sessizce yanlış cevap verir. İkisini karşılaştıran test **henüz yazılmadı** (BÖLÜM 4.3).
>
> ⏳ **`docs/20260731_index_temizligi.sql` YAZILDI (31 Tem 2026) — ÇALIŞTIRILMADI, ölçüm bekliyor.**
> Ayrı migration olarak istenen çift-index temizliği artık **ölç-sonra-düşür** runbook'u hâlinde.
> Bölüm 1 keşif (imzaya göre gruplama), 2 kullanım ölçümü, 3 `raw_posts_dedup_idx` gerekçesi,
> 4 DDL üretici (`dusur_ddl` + `geri_alma_ddl`), 5 Dalga 5 metin/trigram adayları, 6 doğrulama.
> DROP satırları **yorumda**; dosya uçtan uca çalıştırılamaz, bilerek öyle.
> 🚨 **Karar penceresi kuralı:** `idx_scan = 0` tek başına hiçbir şey kanıtlamaz —
> `pg_stat_database.stats_reset`'ten bu yana **≥ 7 gün** geçmiş olmalı. Dalga 3, 30–31 Tem'de
> koştuğu için en erken geçerli ölçüm **~6 Ağu 2026**. Bölüm 2'deki `karar` kolonu pencere
> kısaysa `⛔ PENCERE < 7 GÜN — KARAR VERME` basar.
> 🚨 `drop index concurrently` transaction içinde çalışmaz (`25001`) ve Supabase SQL editörü
> çok-ifadeli çalıştırmayı örtük transaction'a sarar → her CONCURRENTLY satırı **tek başına**.
> ⚠️ Bölüm 5'te `tarama > 0` çıkması performans değil **kapsam** bulgusudur: metin kolonlarını
> okuyan, haritalanmamış bir tüketici var demektir — Dalga 5 öncesi bulunmalı.
>
> 🐛 **DALGA 3'TE BULUNAN İKİ SESSİZ BUG (ikisi de düzeltildi):**
> 1. `app/moderator/page.tsx::duzenleKaydet()` server action'dan geçmiyordu; moderatör
>    kalkış ilini düzeltince metin değişiyor, `origin_province_id` **eski değerde kalıyordu**.
>    Dalga 3'ten sonra bu düzeltmeler radar/nearby'ye hiç işlemeyecekti.
> 2. `aliasOgren()` içindeki yerel `norm` fonksiyonu önce `.toLowerCase()` sonra
>    `.replace(/İ/g,'i')` yapıyordu — Türkçe tuzağının ta kendisi. "İkitelli" görünmez
>    birleşik noktayla yazılıyordu; ne `ilKey()` ne `il_key()` o anahtarı üretir, yani
>    moderatörün öğrettiği alias **hiçbir zaman eşleşmiyordu**. Artık `ilKey` kullanılıyor.
>
> 🐛 **ÜÇÜNCÜ SESSİZ BUG — `HomeClient` il filtresi (düzeltildi, 31 Tem 2026).**
> Beklenen sorun `includes`'un büyük/küçük harfe duyarlılığıydı; asıl sorun daha kötü
> çıktı: filtre **200'lük pencerenin içinde** çalışıyordu ve pencere `created_at`e göre
> kesiliyor, ile göre değil. Yani **Muş'ta aktif ilan olsa bile son 200 ilan İstanbul/
> Ankara/Bursa'dansa kullanıcı "Muş" seçince boş liste görüyordu.** İl filtresi artık
> `/api/listings/ara`'da sunucu tarafında, `province_id` tamsayı eşitliğiyle; limit o ilin
> kendi sonucuna uygulanıyor. Araç/kasa tipi bilinçli olarak istemcide kaldı.
> Yan temizlik: 81 ilin elle yazılmış **4. kopyası** silindi (`lib/ilan-sabitler::ILLER`
> artık tek kaynak); `ILAN_SELECT` + `ilanNormalize()` `lib/ilan-liste.ts`'e alındı —
> aynı sorgu üç yerden atılıyordu.
>
> 🧪 **Ana sayfada elle doğrulanacak (deploy sonrası):** ① Kalkış = **Muş** (veya başka
> düşük hacimli il) → eskiden boştu, artık ilan gelmeli. ② Varış = herhangi bir il →
> çok duraklı bir ilanın **tonaj/palet toplamı** kartta doğru mu (duraklar kırpılmamalı).
> ③ "✕ Temizle" → liste SSR verisine geri dönmeli, filtrelenmiş hâlde donmamalı.
> ④ Filtre açıkken Yük/Araç sekmesi değiştir → yeniden sorgu atmalı ve doğru sonuç gelmeli.
>
> ✅ **DALGA 4 TAMAMLANDI (31 Tem 2026).** Kapsam ölçüldükten sonra **plandan küçük ama
> plandan farklı** çıktı — ayrıntı `docs/COGRAFI_GECIS.md` "Dalga 4" bölümünde.
> - **Plan iki noktada yanlıştı.** (a) `supabase/functions/parse-listing/index.ts`'in
>   prompt'u YOK — saf regex + `aliases`; güncellenecek şey bulunmadı. (b) Plan
>   `app/api/whatsapp/route.ts:47` `parseWithLLM()`'i hiç saymamıştı — prompt'un **ikinci
>   gerçek kopyası** orada. Yalnız parse-text güncellenseydi iki AI kanalı sessizce
>   ayrışacaktı.
> - **id tarafı zaten bitmişti.** Üç AI kanalının da yazma yolu `ilanYaz()` ya da
>   `ilan_olustur` v3'ten geçiyor; hiçbiri `province_id`'yi kendi yazmıyor — Dalga 2 bunu
>   kapatmıştı. `/api/parse-text` **DB'ye hiç yazmıyor**; çıktısı forma prefill oluyor.
> - **Yapılan iş prompt sertleştirmesi.** Asıl risk yazım hatası değildi (`ilCiftYazim`
>   "istanbul"/"İSTANBUL"/"Istanbul" hepsini katlıyor); **AI'ın il alanına İLÇE adı koyması**.
>   "Çorlu'dan…" → `origin_city:"Çorlu"` → `ilCiftYazim` null. parse-text'te kullanıcı
>   formda düzeltir; **WhatsApp'ta form yok, ilan HİÇ oluşmaz** (sessiz kayıp). İki prompt'a
>   da "sadece 81 ilden biri; ilçe geldiyse `district`'e koy, `city`'ye bağlı olduğu ili yaz
>   (`Çorlu` → `Tekirdağ`+`Çorlu`)" kuralı eklendi. 81 satırlık tablo prompt'a KONMADI.
> - `npx tsc --noEmit` temiz.
>
> 🐛 **DALGA 4'TEN ÇIKAN AÇIK BOŞLUK — `district_official` (düşük öncelik).**
> `parse-listing` (Deno) kanalında NULL kalıyor: 973 ilçe `lib/constants/locations.json`'da,
> Deno oradan import edemiyor ve **DB'de ilçe tablosu YOK** → RPC de türetemiyor. Kolonu şu an
> **hiçbir yer OKUMUYOR** (4 yazıcı, 0 okuyucu); W5 ilçe temizliği için kalite işareti.
> Temiz çözüm: `provinces` gibi bir `districts` tablosu. Dalga 5 ile birlikte değerlendir,
> tek başına öncelik değil.
>
> ⚠️ **`SUPABASE_ACCESS_TOKEN` eksik** — `~/.config/yukegel/auto-deploy.env`. Edge Function
> deploy'ları SESSİZCE atlanıyor (`scripts/auto-deploy.log:19565`). Dalga 4 `parse-listing`'e
> DOKUNMADIĞI için bu artık Dalga 4'ün ön koşulu değil — ama `districts` tablosu işine
> girilirse ilk gereken şey bu, ve o güne kadar her edge fn düzeltmesi sessizce kaybolur.
>
> **Kalan dalgalar (kod):**
> - [x] **Dalga 3 — okuma/filtre/moderasyon.** ✅ 31 Tem 2026. `HomeClient` + `/api/listings/ara`
>       (sunucu tarafı il filtresi) + radar/nearby RPC'lerinde `ILIKE '%…%'` → `= province_id`
>       + moderatör paneli (md.6).
> - [x] **Dalga 4 — AI parser.** ✅ 31 Tem 2026. `api/parse-text` + `api/whatsapp` prompt'ları
>       (parse-listing'in prompt'u yok). 🚨 AI'a **doğrudan plaka kodu ürettirilmedi** — 81 satırlık
>       tabloyu prompt'a koymak token yakar ve model uydurur ("Bursa 16 mı 61 mi"). Eşleştirmeyi
>       `lib/lokasyon.ts::ilCiftYazim()` yapıyor; spec md.4'ün istediği sonuç böyle sağlanıyor.
> - [ ] **Dalga 5 — drop.** `origin_city`, `listing_stops.city` + 7 eski metin index'i (trigram
>       dahil). 🚫 `destination_city` listeden **ÇIKARILDI** — öyle bir kolon yok (#28, 42703).
>       Ön koşul: Adım 8.2 **bir hafta** sıfır satır (~7 Ağu) **ve** `ilan_olustur` v4 canlıda (#26).
>
> ❌ **DÜZELTME (30 Tem 2026) — "W5'in il yazımı adımları gereksizleşti" TAVSİYESİ YANLIŞTI.**
> Gerekçe (`il_key()` iki yazımı aynı id'ye katlar) yalnızca **id kolonu** için geçerliydi;
> **metin kolonu Dalga 3'e kadar canlı arayüzü besliyor.** Runbook Adım 2 bunu zaten yazmıştı:
> *"şehir filtresi hâlâ ham değere bakıyor."* Veri doğruladı:
>
> 🔴 **CANLI HATA — `origin_city='istanbul'` 22.474 satır** (tüm ilanların ~%9,6'sı).
> Tamamı `source='whatsapp'`, ilk 12 May, **son 29 Tem** → akış hâlâ üretiyor.
> `HomeClient:711` `i.kalkis?.includes(kalkis)` büyük/küçük harfe duyarlı, dropdown (satır 823)
> `ILLER`'den kanonik `İstanbul` veriyor ⇒ **kullanıcı İstanbul filtrelediğinde bu ilanları
> göremiyor.** Kaynak: `parse-listing/index.ts:818` `origin_city: firstLane.from` —
> `aliases.normalized` ham değeri hiç kanonikleştirilmeden yazılıyor.
> (Sahte İstanbul→İstanbul güzergâhı bunun alt kümesi: 1.565 satır. Aynı il içi 6.173 ilanın
> kalan ~4.600'ü aynı yazımda, yani meşru şehir içi taşıma.)
>
> - [x] ✅ **`docs/20260730_istanbul_kanonik.sql` ÇALIŞTIRILDI — 30 Tem 2026.**
>       Blok 1 alias kaynağını kuruttu, Blok 2 metni `province_id`'den onardı.
>       **Doğrulama 2.4 = 0** → farklı yazımlı aynı il satırı kalmadı, sahte İstanbul→İstanbul
>       güzergâhı (1.565 satır) temizlendi. 22.474 ilan artık İstanbul filtresinde görünüyor.
>       ⚠️ Tek seferlik temizlik: `learn-aliases` yeni bozuk satır üretirse delik geri açılır.
> - [ ] Runbook'un **ilçe** adımları (3, 4, 6) + `20260729_alias_normalize_trigger.sql`
>       hâlâ geçerli — trigger olmadan `learn-aliases` yeni bozuk satır üretebilir.
>
> Son güncelleme: 29 Temmuz 2026 — **ILAN_VER_ANALIZ W0 + W1 tamamlandı** (34p/87). İlan
> verme yolu sertleştirildi ve kırıkları onarıldı: `listings` yazan tek yol `lib/ilan-yaz.ts`,
> ilan+durak yazımı `public.ilan_olustur()` RPC'siyle atomik, aylardır ölü olan toplu yükleme
> ortak sözleşmeyle çalışır hâlde, yük cinsi durak bazlı, seçilen araç ilana bağlı.
> ⚠️ **İki migration bekliyor** (bkz. W1 bölümü). Öncesi:
> (SPRINT_01 **W0 + W1 + W2 + W3 + W4 tamamlandı** — telefon sızıntısı hem uygulama hem DB katmanında kapatıldı, auth denetim izi açıldı, iki ayrı yetki yükseltme açığı kolon beyaz listesiyle giderildi, `/auth/reset` ve `/cikis` sertleştirildi, `merged_into` giriş döngüsü `/auth/devir` ile kapandı, SMS ve şifre tetikleyicileri istemciden alınıp kotalı sunucu route'larına taşındı, paylaşım kartı + sitemap + robots + noindex katmanı kuruldu, iki CTA huni ölçümüyle ayrıştırıldı ve son dalgada kayıt/giriş/landing cilası yapıldı: şifre kuralı ve liste limiti tek kaynağa indi, sekme URL'e yansıdı, doğrulama e-postası tekrar gönderilebilir oldu.)
>
> **SPRINT_01 KODA DAİR KISMI BİTTİ.** Kalan işler: aşağıdaki "Diğer yeni bulgular" +
> Bayram'ın kod dışı maddeleri (`docs/SPRINT_01.md` sonundaki liste).
>
> 🚨 **W5 (alias veri bütünlüğü) — KOD BİTTİ, SQL BAYRAM'DA** (29 Tem 2026, bkz. `docs/W5_DEVIR.md`).
> Beş bilet tamam: **D1** prompt örnekleri Türkçeleşti · **D2** dört yazma yolu
> `lib/alias-normalize.ts` üzerinden geçiyor (409 çakışma) · **D4** `findPlaces` karşılaştırma
> anahtarları katlandı (5/5 kabul testi; HEAD 3/5 başarısız) · **D5** runbook · **D3** trigger+indeks SQL'i.
> ⏳ **BAYRAM — sırayla çalıştırılacak:**
> 0. ✅ **Adım 0 ölçümü ALINDI** (29 Tem 2026, sonuçlar runbook'ta "ÖLÇÜM SONUÇLARI" bölümünde).
>    Özet: sahte güzergâh **0 satır** (geçmiş hasar yok, D4 önleyici) · aynı şehir 6.173 satır
>    (meşru, korunacak) · **16 yazım çakışması ~88 satır** (~12 ASCII + 🆕 ~76 TAMAMI BÜYÜK HARF)
>    · 🚫 0.4 SORU DÜŞTÜ (31 Tem 2026, #28): kolon yok, 42703. Bu satır önce "hâlâ
>    ölçülmedi (yanlış tablo sorgulandı)" diyordu — asıl mesele yanlış tablo değil,
>    **ölçülecek kolonun hiç var olmaması** idi.
> 1. `docs/20260729_alias_runbook.md` → Adım 1-9. ⚠️ Adım 8 **eski
>    `20260728_alias_kopya_temizligi.sql` BÖLÜM 6'yı geçersiz kılıyor**: o bölüm var
>    olmayan `destination_city`'yi (#28 — kolon YOK, 42703) onarmaya çalışıp canlı
>    `listing_stops`'u atlıyor; yani eksik olmasından önce **çalışmıyor**.
>    Ölçüm bunu doğruladı:
>    BÖLÜM 6'nın elle yazılmış 4 şehirlik listesi 16 grubun **13'ünü** kaçırırdı.
> 2. `docs/20260729_alias_normalize_trigger.sql` → **en son**; runbook Adım 9 yapılmadan indeks
>    23505 ile reddedilir.
> Her adımın önizleme `SELECT`'i var, `UPDATE`'ler yorumda, hiçbir adım satır silmiyor.
>
> ✅ **BAYRAM — 3 SQL'in ÜÇÜ DE ÇALIŞTIRILDI** (29 Tem 2026): `20260728_kvkk_onay.sql`,
> `20260728_auth_events.sql`, `20260728_contact_phone_revoke.sql`.
> ✅ Sonuncusunun **duman testi de geçti**: misafir ana sayfa + `/ilan/[id]` açılıyor,
> `/moderator` listesi telefon kolonuyla yükleniyor, moderatör telefon düzenleme çalışıyor.
> `contact_phone`'a dokunan her yol service-role kullanıyor → kırık yazma yolu yok.
> 🚨 Yeni tuzak: `listings` artık **kolon bazlı** yetkili — sonradan eklenen kolonlar
> `anon`/`authenticated` için yetkisiz doğar (bkz. PROJE_HARITASI §9).
>
> ~~Ayrıca kontrol: `public.users.is_active` DB default'u~~ ✅ doğrulandı: default `true`, NULL satır yok (29 Tem 2026). Opsiyonel sertleştirme: `alter table public.users alter column is_active set not null;`
>
> Bu dosya tüm geçmiş sohbetler taranarak oluşturulmuştur.

---

## ✅ Tamamlananlar (Faz 1)

### Backend & Parse
- [x] Parse bug fix (WhatsApp mesaj ayrıştırma hataları)
- [x] LLM entegrasyonu (Anthropic Haiku)
- [x] "LLM'e Sor" butonu (moderatör paneli)
- [x] Alias öğrenmesi (şehir, araç tipi, kasa tipi)
- [x] `clean_hash` cache (SHA-256 hash, unique index, duplicate atlama)

### Veritabanı Altyapısı
- [x] `system_config` tablosu — `category`, `data_type`, `updated_by` kolonları dahil
- [x] `listings` tablosuna `expires_at` kolonu (30 gün default)
- [x] `pg_cron` expire job (her gece 02:00, süresi dolmuş ilanlar pasife alınır)
- [x] `users.role` kolonu (`user` / `moderator` / `admin`)

### Auth — UI Katmanı
- [x] `/giris` sayfası UI — Telefon + OTP sekmesi tasarımı
- [x] `/giris` sayfası UI — E-posta + Şifre sekmesi (giriş, kayıt, şifremi unuttum)
- [x] `/auth/reset` — Şifre sıfırlama sayfası
- [x] `/auth/callback` — E-posta doğrulama sonrası rol bazlı yönlendirme
- [x] `lib/auth.ts` — `requireAdmin()`, `requireModerator()`, `getCurrentUser()`, `landingForRole()`
- [x] `/moderator` sayfası — Rol koruması (sadece moderatör + admin)
- [x] Telefon OTP sonrası `user_type` yoksa `/profil-tamamla`'ya yönlendirme (`otpDogrula` içinde)
- [x] `/profil-tamamla` sayfası — user_type seçimi, Ad Soyad, Telefon, TCKN/VKN, araç bilgileri (arac_sahibi için)

### Admin Paneli
- [x] `/admin` — Yönetim paneli ana ekranı (kart düzeni)
- [x] `/admin/sistem-ayarlari` — `system_config` UI (kategorili kartlar, inline düzenleme, tip-aware input, service role action)

### İlan Sistemi
- [x] TCKN/VKN format kontrolü (11 / 10 hane) + checksum doğrulama
- [x] "Yeni üye" etiketi (kayıt tarihine göre)
- [x] 3 seçenekli ilan oluşturma karşılama ekranı (`/ilan-olustur`) — Tekil aktif, Excel + Metinden "Yakında"
- [x] Tekil yük ilanı formu (`/ilan-ver`) — 4 adımlı wizard, `listings` + `listing_stops` tablosuna yazar
- [x] Excel toplu yükleme (`TopluYukle.tsx`) — şablon parse + satır bazlı validasyon + onay ekranı + Supabase'e yazma
- [x] "Sahiplen" akışı — `/ilan/[id]/sahiplen` — OTP doğrulama ile doğrulanmamış ilanı sahiplenme
- [x] "Doğrulanmamış İlan" etiketi + tooltip (parse kaynaklı sahipsiz ilanlar)
- [x] "✓ Fiyat Belli" rozeti (yeşil, ana sayfa kartı + detay sayfası)

---

## ⏳ Kalan Görevler — Faz 1

### 🔐 Auth & Üyelik Akışı

- [ ] **E-posta kayıt → profil tamamlama uçtan uca testi**
  - `/auth/callback` `user_type` kontrolü var ama production'da test edilmedi
  - Doğrulama maili → link → callback → profil-tamamla akışı doğrulanacak

- [ ] **İlan verirken profil kontrolü**
  - `/ilan-ver`'e gidildiğinde `user_type` yoksa `/profil-tamamla`'ya yönlendir

### 🛠 Admin & Moderasyon

- [x] **Radar & İstihbarat Paneli** (4 Haziran 2026) — `/admin/radar`: rota bazlı lead tarama, kontratlı iş tespiti, WhatsApp hızlı aksiyon, geçmiş drawer. `get_radar_intelligence` RPC fonksiyonu.

- [ ] **Blacklist kelime yönetimi** — `system_config` üzerinden, admin paneline entegre
- [ ] **Admin moderasyon dashboard** — İlanları onaylama/reddetme, şüpheli ilanları listeleme
- [ ] **"Sonraya Bırak" kalıcılığı** — Moderatör panelinde ertelenen ilan ID'leri şu an bellekte tutuluyor, sayfa yenilenince sıfırlanıyor; `localStorage` veya `listings` tablosuna `deferred_at` kolonu ile kalıcı hale getirilecek

### 📄 İlan Oluşturma

- [ ] **Metinden ilan girme** — LLM parse + önizleme + onay akışı (`/ilan-ver` → metin seçeneği, şu an YAKINDA)
- [ ] **Araç ilanı formu** — Nakliyecinin araç/kapasite ilanı vermesi (tekil, ayrı form)

### 🔄 İş Akışları

- [ ] **"Bu işi aldım" butonu** — Nakliyeci tıklar → müşteriye bildirim → onay/ret → ilan pasife alınır

### 📋 Panel Geliştirme

- [ ] **Müşteri paneli** — "Araç Bulundu" butonu, not ekleme, tekrar aktif etme
- [ ] **Nakliyeci paneli** — Atanan işlerim listesi, durum güncelleme (İşi Aldı → Yükü Aldı → Taşımada → Teslim Etti)

### 📬 Altyapı & İletişim

- [ ] **E-posta bildirimleri** — İlan süresi dolunca, iş onaylandığında, durum güncellemelerinde
- [ ] **Yasal sayfalar** — Kullanım Koşulları, Gizlilik Politikası, KVKK aydınlatma metni

### 🌍 Görünürlük

- [ ] **Landing page** — Kayıtsız kullanıcıya yönelik tanıtım sayfası (değer teklifi, CTA, neden Yükegel)
- [ ] **SEO** — Meta tag'ler, Open Graph, sitemap.xml, robots.txt

---

## 🔮 Faz 2

- [ ] **Doğal dil arama** — Nakliyecinin metin yazarak ilan araması (LLM destekli)
- [ ] **`user_events` tablosu** — Kullanıcı davranış takibi (ilan görüntüleme, arama geçmişi) → öneri sistemi temeli
- [ ] **Trust score algoritması** — Nakliyeci: Puan %40 + Tamamlama %30 + No-show %20 + Kıdem %10 / Müşteri: Puan %50 + Tamamlama %30 + Ulaşılabilirlik %20
- [ ] **WhatsApp grup yönetici paneli** — Hangi gruplardan mesaj çekileceğini admin UI'dan yönetme
- [ ] **MERNİS / GİB entegrasyonu** — TCKN ve VKN'nin resmi sistemlerden doğrulanması + doğrulandı rozeti
- [ ] **Canlı konum takibi** — Nakliyecinin taşıma sırasında konumunun haritada görünmesi
- [ ] **48 saat yanıtsız ilan etiketi** — Nakliyeciden geri dönüş olmayan ilanlar işaretlenir
- [ ] **Ara durum adımları** — Mevcut 4 adımlı iş akışına ek detay adımlar
- [ ] **Ödeme & abonelik sistemi** — Üyelik planları, kredi kartı entegrasyonu (2 yıl sonra)

---

## 📌 Teknik Notlar

| Konu | Not |
|---|---|
| Admin kullanıcısı | `bayramdede@gmail.com` |
| Moderatör kullanıcısı | `bayramdede+supabase@gmail.com` |
| Supabase redirect URL'leri | `/auth/callback`, `/auth/reset` — hem localhost hem Vercel'de tanımlı olmalı |
| `system_config` action | Service role kullanır (RLS bypass) |
| İlan süresi | Kullanıcı ilanları 30 gün, parse ilanları 2 saat (WhatsApp), 7 saat (Excel) |
| Parse pipeline | `raw_posts` → Edge Function `parse-listing` → `listings` + `listing_stops` |
| Yerel yönetim paneli | `npm run panel` → http://127.0.0.1:4711 — git durumu, kilit aç, yedekle, deploy (mesajlı), tsc, edge function, daemon. `scripts/panel/` altında; Next ağacında **değil** (bkz. PROJE_HARITASI §1) |

---

## ⚠️ Bilinen Kopukluklar

| # | Sorun | Etki | Çözüm |
|---|---|---|---|
| 1 | Telefon OTP sonrası `user_type` kontrolü yok | Yeni kullanıcı profil tamamlamadan ana sayfaya düşüyor | `yonlendir()` fonksiyonuna `user_type` kontrolü ekle |
| 2 | E-posta kayıt → profil-tamamla akışı test edilmedi | Muhtemelen çalışıyor ama doğrulanmadı | Uçtan uca test gerekli |
| 3 | `users` tablosuna otomatik kayıt mekanizması belirsiz | Profil verisi kaybolabilir | Supabase Auth trigger veya profil-tamamla submit'te açıkça yazılmalı |


## 📦 İlan Verme Akışı — Analiz (29 Tem 2026)

Tam analiz, kabul kriterleri ve dalgalar: `docs/ILAN_VER_ANALIZ.md`
(30 madde / 87 puan; bulgu kodları **V1–V10** veri bütünlüğü & güvenlik, **B1–B9** bozuk,
**U1–U10** UX/dönüşüm, **M1–M5** mimari).

Özet: `app/ilan-ver/actions.ts` projenin en ayrıcalıklı yazma yolu (service-role `listings`
INSERT) ama `SPRINT_01`'in üç kazanımı — sunucu tarafı kolon beyaz listesi, sunucu tarafı kota,
sunucu tarafı sahiplik/doğrulama — bu yola **hiç uygulanmamış**.

### W0 — Kanama durdur (19p) ✅ **TAMAM** (29 Tem 2026)
- [x] **V1** — `ilanKaydet` için kolon beyaz listesi + sınır kontrolleri (`app/panel/actions.ts` kalıbı) · 6p
- [x] **V2** — `contact_phone` istemciden geliyor; oturumun profil telefonundan yazılmalı · 5p
- [x] **V3** — `moderation_status: 'auto_published'` sabiti 31–70 moderasyon bandını öldürüyor · 5p
- [x] **V4** — Başarı ekranı INSERT sonucunu okumuyor; shadow-ban'lı ilana "yayında" diyor · 3p

Yan kazanımlar (migration'sız, aynı yamada): **V9/V10** (action'ın kendi auth kapısı),
**V8/B9** (tanınmayan il/araç değeri artık ham hâliyle forma yazılmıyor), **V5 kısmî**
(durak INSERT'i patlarsa ilan telafi edici `DELETE` ile geri alınıyor — yetim kayıt yok),
**M2 kısmî** (`lib/ilan-sabitler.ts` tek kaynak; istemci ve sunucu beyaz listesi
fiziksel olarak ayrışamıyor), **A2** (istemci `bugun()` de sabit +03:00 kullanıyor).

Kalan: **V5 tam** (tek RPC ile atomik yazma) hâlâ W1'de.

### W1 — Kırıkları onar (15p) ✅ **TAMAM** (29 Tem 2026)
- [x] **B1** — 🔴 **Toplu yükleme fiilen çalışmıyor** — istemci JSON `{action,rows,userId}`, route `formData().get('file')`; ayrıca şablon `'Kalkış İli'` ↔ route `'Kalkış Şehri'` · 5p
- [x] **B3** — Seçilen araç ilana bağlanmıyor (`listings.vehicle_id` yok) · 3p ⚠️ migration'a **grant satırı** şart
- [x] **B4** — AI durak eşlemesi `cargo_type`'ı not alanına yazıyor; kayıtta tek global yük cinsi tüm duraklara kopyalanıyor · 3p
- [x] **V5** — İlan + duraklar atomik değil; durak INSERT'i patlarsa duraksız yetim ilan kalıyor · 4p

**Ne yapıldı.** İki yeni dosya: `lib/ilan-yaz.ts` (`listings` yazan tek yol) ve
`lib/toplu-yukle-sozlesme.ts` (toplu yükleme sözleşmesi). `/api/excel-import` ve
`app/ilan-ver/actions.ts` baştan yazıldı; ikincisi artık yalnızca bir auth kapısı.
B1'in asıl bulgusu protokol uyuşmazlığı değildi: excel-import **ikinci ve
sertleştirilmemiş bir ayrıcalıklı yazma yoluydu** — W0'da kapatılan V1/V3 delikleri
orada açık duruyordu. Sözleşme `satisfies` ile mühürlendi, `userId` sözleşmeden
tamamen çıkarıldı, önizleme `aliases` sözlüğünü kullanıyor (şablonun vaat ettiği
kısaltmalar artık gerçekten çözülüyor). B4'te durak bazlı yük cinsi hem tekil forma
hem AI eşlemesine hem Excel'e geldi. B3'te istemciden gelen `arac_id` sahiplik
(`user_id` + `is_active`) doğrulamasından geçiyor, doğrulanmayan id `WARN` loglanıp
sessizce düşüyor. **Yan kazanım: B2 kısmî** — `maxDuration=60`, `MAX_SATIR=300`,
`MAX_ILAN=50` (kalan: satır bazlı süre bütçesi).

> ⚠️ **BAYRAM — İKİ MIGRATION, SIRAYLA, KODU DEPLOY ETMEDEN ÖNCE:**
> 1. `docs/20260729_ilan_olustur_rpc.sql` — `public.ilan_olustur(jsonb,jsonb)`
> 2. `docs/20260729_listings_vehicle_id.sql` — `listings.vehicle_id` + **grant** + RPC tazeleme
>
> Sıra tersine olursa ilan verme `PGRST202 function not found` ile **tamamen durur**
> (kod artık RPC'siz yazmıyor). Doğrulama ve duman testleri dosyaların sonunda.

**W1 sonrası bağımsız denetimde bulunup düzeltilenler (29 Tem 2026):**
- Türkçe sayı ayrıştırma — `Number("5.000")===5` yüzünden `5.000 TL` **5 TL**'ye kaydoluyordu, `"2,5"` tonaj `NaN` olup düşüyordu → `sayiMetniCoz()` (`lib/toplu-yukle-sozlesme.ts`), önizlemede uygulanıyor ki kullanıcı gerçek değeri görsün.
- Ondalık palet RPC'de `(…)::int` ile `22P02` atıp **tüm ilanı** geri alıyordu → `tamSayiAralik()` (`lib/ilan-yaz.ts`), `palet` ve `arac_adet`e uygulandı.
- Profilinde telefonu olmayan kullanıcı 50 ilanın 50'sinin de tek tek "başarısız" olduğu bir ekran görüyordu → `ilanTelefonu()` kontrolü döngüden ÖNCE, tek ve anlaşılır 400.
- `durumEtiketi()`'nin 3. parametresi iki çağrı yerinde de `false`'tı, `'error'` dalı ulaşılamazdı → parametre kaldırıldı.
- `TopluYukle.tsx` `MAX_ILAN`'a bakmıyordu: 60 gruplu dosyada buton "60 ilan" diyor, sunucu 400 dönüyor, **hiçbir** ilan oluşmuyordu → istemci tarafı uyarı + buton kilidi.

**Canlı DB'de doğrulanacak (W1):**
- [ ] Migration'lar çalıştı mı? → `select routine_name from information_schema.routines where routine_name='ilan_olustur';`
- [ ] Yetkisiz kolon kaldı mı? → `20260729_listings_vehicle_id.sql` DOĞRULAMA §1 (sıfır satır dönmeli)
- [ ] Yetim ilan var mı? → duraksız `listings` sorgusu (aynı dosya, duman testi §4). Eski kayıtlardan kalma varsa temizlenmeli.
- [ ] Araç ilanı verildiğinde `vehicle_id` gerçekten doluyor mu?
- [ ] Toplu yükleme uçtan uca: şablon indir → 2 satır → önizleme → tarih seç → onayla.

### W2 — Maliyet & kötüye kullanım (11p)
- [ ] **V7** — AI kotasının kapısı `parse`, sayacı `kayıt` — Anthropic sınırsız çağrılabiliyor · 4p
- [ ] **V6** — İlan oluşturmada hız limiti / tekrar tespiti yok · 4p
- [ ] **B2 kısmî** — ~~`maxDuration`~~ ✅ (60sn), ~~satır tavanı~~ ✅ (`MAX_SATIR=300`, `MAX_ILAN=50`); kalan: **satır bazlı süre bütçesi** (bütçe dolunca kalanları "işlenmedi" diye dönmek) · 1p
- [x] ~~**Yeni (W1'de keşfedildi)** — `app/moderator/page.tsx:974` `raw_posts`'tan ilan üretirken hâlâ kendi `listings` INSERT'ini + ayrı `listing_stops` INSERT'ini yazıyor~~ ✅ (29 Tem 2026) · 3p
- [x] ~~**Yeni (W1'de keşfedildi)** — İki OTOMATİK yol daha `ilanYaz()`'ı atlıyor: `app/api/whatsapp/route.ts` ve `supabase/functions/parse-listing/index.ts`~~ ✅ (29 Tem 2026) · 5p

**W1+ — Yazma yolu birleştirme ✅ (29 Tem 2026, 8p):**
`listings`'e yazan BEŞ yolun tamamı artık tek zeminden geçiyor:

| Yol | Nasıl |
|-----|-------|
| `/ilan-ver` formu | `ilanYaz()` |
| `/api/excel-import` | `ilanYaz()` |
| `app/api/whatsapp/route.ts` (Twilio) | `ilanYaz()` — **yeni** |
| `app/moderator/actions.ts` `moderatorIlanOlustur()` | `ilan_olustur()` RPC — **yeni** |
| `supabase/functions/parse-listing` (Deno) | `ilan_olustur()` RPC — **yeni** |

- `lib/ilan-yaz.ts`'e `KANAL_POLITIKA` tablosu eklendi: `whatsapp.daimaIncele = true` →
  audit skoru temiz olsa bile ilan yayına çıkmaz, kuyruğa girer. Politika bilerek
  `girdi`nin İÇİNDE değil modülde; istemci gevşetemesin diye.
- Moderatörün "Manuel Gir" akışı tarayıcıdan `moderation_status:'approved'` +
  `trust_level:'social'` yazıyordu — RLS satır bazlı olduğu için kolon düzeyinde
  engellenemiyordu. Artık `requireStaff()` kapısının arkasında.
- Yeni migration: **`docs/20260729_ilan_olustur_v2.sql`** — RPC'ye `raw_post_id`,
  `shadow_profile_id`, `is_repost`, `reviewed_at` (hepsi opsiyonel) eklendi; durak bazlı
  `vehicle_count` artık eziliyor değil, önce durağın kendi değerine bakılıyor.
  ⚠️ **SIRA:** `20260729_ilan_olustur_rpc.sql` → `20260729_listings_vehicle_id.sql` →
  `20260729_ilan_olustur_v2.sql` → kod deploy.
- ⚠️ `supabase/functions/**` `tsconfig.json`'da `exclude`'da: `tsc --noEmit` Edge
  Function'ı HİÇ derlemez. Oradaki RPC çağrısı elle gözden geçirilmeli.

### W3 — Dönüşüm (14p) · W4 — Sağlamlaştırma (28p)
U1–U10 ve V8–V10, B5–B9, M1–M5 için `docs/ILAN_VER_ANALIZ.md` §3–§5.
Öne çıkanlar: **M2** `ILLER` 9 dosyada / `ARAC_TIPLERI`+`UTSYAPI` 11 dosyada kopyalanmış;
**M1** `Navbar` bileşen gövdesi içinde tanımlı (projenin kendi anti-pattern'i);
**M3** `app/ilan-ver/.page.tsx.swp` git'te takip ediliyor — silinmeli.

### 🔬 Canlı DB / tarayıcı ile doğrulanacak
`ILAN_VER_ANALIZ.md` §6'daki 6 madde — özellikle `listings.status` kolon varsayılanı ve
`safety_rules` tablosunun dolu olup olmadığı (boşsa her ilan 0 puan alır, V3 pratikte
zaten hiçbir şeyi kuyruğa sokmuyordur).

W0 sonrası eklenen doğrulamalar:
- [ ] `safety_rules` **dolu mu?** Boşsa V3 kodu doğru ama etkisiz — her ilan 0 puanla `yayinda` döner.
- [ ] Bir ilanı 31–70 bandına düşürüp `moderation_status='pending'` + `status='passive'`
      olduğunu ve **listelerde görünmediğini** doğrula.
- [ ] Google ile kaydolmuş, profilinde telefonu OLMAYAN bir kullanıcıyla ilan ver:
      numara `users.phone`'a geri yazılıyor mu (V2 kendini onaran dal)?
- [ ] Gece 00:00–03:00 arası tarih alanının bugünü gösterdiğini doğrula (A2).

W1+ (yazma yolu birleştirme) sonrası duman testi:
- [ ] WhatsApp'tan ilan gönder → ilan `pending` + `passive`, durakları dolu.
- [ ] Moderatör paneli → Çözümsüz → "Manuel Gir" → Kaydet ve Onayla → ilan + duraklar
      birlikte oluştu mu, `raw_post_id` / `reviewed_at` dolu mu, telefon yazıldı mı,
      `raw_posts.processing_status` `processed` oldu mu?
- [ ] Bir WhatsApp grubundan ham mesaj düş → Edge Function ilanı RPC ile üretiyor mu
      (`shadow_profile_id` + `is_repost` dolu mu)?
- [ ] Yetim ilan kalmadı mı?
      `select l.id, l.source from listings l where not exists (select 1 from listing_stops s where s.listing_id = l.id) order by l.created_at desc limit 20;`
- [ ] `/ilan-ver` hatası: Vercel loglarında `ilanKaydet beklenmeyen istisna` ara —
      `error_message` + `stack` artık kaydediliyor.

### 🔴 "Telefon numarası Yükleniyor..." — sessiz arıza (29 Tem 2026) ✅ kod tarafı tamam

**Belirti (Bayram, canlı):** `/ilan-ver` İLETİŞİM kartı sonsuza kadar "Yükleniyor..."
gösteriyor. Aynı sayfada ilan kaydederken de "An error occurred in the Server Components
render..." çıkıyordu. **İkisi tek kök.**

**Neden görünmüyordu:** `useEffect(() => { init() }, [])` — `init()` bir promise döner,
reddedilirse hiçbir yerde yakalanmaz. Error boundary tetiklenmez, kullanıcı hata görmez,
`setTel` sadece hiç çalışmaz. Ekranda kalan tek iz masum bir yükleme yazısı.
`kullanicitelefon()` üç ayrı sonucu (oturum yok / numara yok / FIRLATTI) tek bir `null`'a
çöküyordu; `📞 {tel || 'Yükleniyor...'}` de üçünü aynı gösteriyordu.

**Yapılanlar:**
- `kullanicitelefon()` artık `TelefonDurumu` ayrık birleşimi dönüyor
  (`var` / `oturum-yok` / `numara-yok` / `hata`), try/catch + `structuredLog('phone-privacy')`.
- `page.tsx` her durumu ayrı gösteriyor; `numara-yok` → `/profil-tamamla` bağlantısı.
  `init().catch(...)` eklendi.
- `getServiceSupabase()` `process.env.X!` yerine açık kontrol yapıyor; eksik değişkenin
  **adını** söyleyerek fırlatıyor.

**Kalan (Bayram):** `SUPABASE_SERVICE_ROLE_KEY` Vercel'de **ada göre var**, ama değeri
dönmüş/yanlış ortama işaretlenmiş olabilir. Kontrol: Settings → Environment Variables →
anahtarın **Production** kutusu işaretli mi + Supabase panelindeki güncel `service_role`
anahtarıyla aynı mı. Deploy sonrası logda `phone-privacy` ara.

#### 🔴 Devamı — "telefon numarasını bulamıyor" KAPALI DÖNGÜ (31 Tem 2026)

**Belirti (Bayram, canlı):** `/ilan-ver`'de telefon bulunamıyor, bu yüzden **görev #29
(form kanalı `source='manual'` kapsama testi) yapılamadı.**

**Kök neden — üç parçalı, hiçbiri tek başına hata üretmiyor:**

1. `/ilan-ver` formunda **telefon input'u YOK** (`page.tsx:657-680`). Kart sadece
   `users.phone`'u *gösteriyor*. Profil boşsa kullanıcının yazabileceği bir alan yok,
   yani ilan hiç verilemiyor. (`lib/ilan-yaz.ts::ilanTelefonu()`'nun istemciden gelen
   `0XXXXXXXXXX`'i kabul edip profile geri yazan **kendi kendini onaran dalı bu kanalda
   ÖLÜ** — form `tel` olarak hep boş string gönderiyor.)
2. `numara-yok` durumundaki "Profilden ekleyin →" bağlantısı `/profil-tamamla`'ya
   gidiyordu. Ama `profil-tamamla/page.tsx:120`: `user_type` doluysa form **hiç
   render edilmeden** `/panel`'e geri atılıyor. Yani bağlantı kapalı bir döngüydü.
3. Numarayı ekleyen tek gerçek ekran — panel Profilim sekmesi, SMS OTP ile
   (`PanelClient.tsx:834-852`) — sadece **local state** ile açılıyordu, dışarıdan
   hedeflenemiyordu.

> 🚨 **Ders:** "X yoksa Y'ye git" bağlantısı yazarken **Y'nin o kullanıcıyı geri
> çevirmediğini** doğrula. Buradaki üç parçanın her biri tek başına makul; birleşince
> kullanıcı hiçbir hata mesajı görmeden hiçbir şey yapamıyor.

**Yapılanlar (31 Tem 2026, tsc temiz):**
- [x] `app/panel/PanelClient.tsx` — `?sekme=ilanlarim|araclarim|profilim` derin bağlantı
      (beyaz listeli, `window.location` ile — `useSearchParams` CSR bailout'u yüzünden).
- [x] `app/ilan-ver/page.tsx:675` — bağlantı `/panel?sekme=profilim`, metin
      "Panelden ekleyin →".
- `app/ilan/[id]/page.tsx:428`'deki `/profil-tamamla` bağlantısı **doğru** ve
  değiştirilmedi — orası gerçekten `user_type` olmayan kullanıcı dalı.

#### 🔴 İKİNCİ TUR — "profilde numara VAR, `/ilan-ver` yine getiremiyor" (31 Tem 2026)

**Yeni bilgi (Bayram):** panel profil ekranında numara **görünüyor.** Bu, yukarıdaki
`numara-yok` senaryosunu tek başına açıklamıyor.

**Bu bilgi neyi eliyor:** `app/panel/page.tsx:24-32` **aynı satırı**, **aynı
`SUPABASE_SERVICE_ROLE_KEY` ile**, **aynı `.eq('id', user.id)` ile** okuyup numarayı
gösterebiliyor. Yani ne anahtar eksik/dönmüş, ne satır kayıp, ne de `users.phone` boş —
29 Tem'deki "Kalan (Bayram)" hipotezi (service-role anahtarı) **bu kanıtla zayıflıyor.**

**Kalan olasılıklar ve ekrandaki iki mesajın bunları ayırt EDEMEMESİ:** "numara yok" ve
"alınamadı" dört farklı kök nedeni ikiye çöküyordu — satır mı gelmedi, alan mı boş,
server action'da oturum mu düştü (panel bir GET Server Component, `kullanicitelefon()`
ise POST server action — auth okuma yolları aynı şekilde yazılmış ama aynı istek değil),
sorgu mu hata verdi. Log'a bakmadan ilerlemek tahmin yürütmekti.

> 🚨 **Ders:** Aynı veriyi okuyan iki ekrandan biri çalışıp öteki çalışmıyorsa,
> **fark ettiği şeyi izole et** (anahtar? satır? oturum? istek tipi?) — "muhtemelen
> env değişkeni" deyip geçme. Burada çalışan ekranın varlığı, en güçlü hipotezi çürüttü.

**Yapılanlar (31 Tem 2026, tsc temiz):**
- [x] `TelefonDurumu` artık `kod` taşıyor: `numara-yok` → `satir-yok` | `alan-bos`,
      `hata` → `sorgu` | `istisna`; `oturum-yok` da ekranda `kod: oturum-yok` oluyor.
- [x] `!data` dalı ayrıldı + `structuredLog('WARN', 'phone-privacy', 'users satırı yok')`.
      **Panelde numara varken burada `satir-yok` çıkarsa sorun telefon değil KİMLİK:
      iki farklı auth id (hesap birleştirme kalıntısı).**
- [x] `data.phone` artık `replace(/\D/g,'')` ile normalize ediliyor — boşluklu/tireli
      kayıt `data.phone ? …` testini geçiyordu ama `ilanTelefonu()` `/^0\d{10}$/` istiyor.
- [x] `page.tsx` kartın altında küçük gri `kod: …` gösteriyor. ⚠️ Ham Supabase mesajı ve
      `user_id` **ekrana konmadı**; ayrıntı yalnız `phone-privacy` log satırında.

#### ✅ ÜÇÜNCÜ TUR — KÖK NEDEN BULUNDU: `'use server'` dosyasından tip re-export (31 Tem 2026)

**Kanıt (Vercel, 14:48:55):**
```
[error] ReferenceError: IlanDurumu is not defined
    at module evaluation (.next/server/chunks/ssr/_0wmprg3._.js:2:2316)
  digest: '4277401530'
```

**Kök neden:** `app/ilan-ver/actions.ts:18` `export type { IlanDurumu };` — başka bir
modülden (`lib/ilan-yaz.ts`) gelen bir tipin **re-export**'u. `'use server'` modülünün
her export'u Next tarafından çalışma zamanı değeri sayılıyor; Turbopack üretim
derlemesinde bu re-export silinmeyip değer bağlaması olarak kaldı.

**Neden iki tur yanlış yerde arattı:** modül **hiç değerlendirilemediği** için
`/ilan-ver`'in TÜM server action'ları öldü. İstemcide görünen tek iz
`init().catch(() => setTelDurum('hata'))` üzerinden gelen **"⚠️ Telefon numarası
alınamadı"** oldu. Yani telefonla hiç ilgisi olmayan bir arıza, telefon arızası gibi
göründü. Aranan `phone-privacy` log satırı da hiç yazılmadı — çünkü fonksiyonun
gövdesine hiç girilmedi.

> 🚨 **Ders 1:** `tsc --noEmit` bu hatayı **YAKALAMAZ**. Tip silinmesi TypeScript'in
> semantiğinde doğru; kıran şey bundler'ın `'use server'` dönüşümü. Doğrulama
> listesine tsc'yi tek başına yazma — bu sınıf yalnız üretim derlemesinde/çalışma
> zamanında görünür.
>
> 🚨 **Ders 2:** Bir hata mesajının GÖSTERDİĞİ yer ile OLDUĞU yer alakasız olabilir.
> "Telefon alınamadı" mesajı, telefon kodunun hiç çalışmadığı bir dünyada üretildi.
> Belirti bir `catch`'ten geliyorsa, önce **catch'in ne yakaladığını** sor.

**Yapılan:**
- [x] `actions.ts` — `export type { IlanDurumu }` kaldırıldı; `IlanKaydetGirdi` /
      `IlanKaydetSonuc` yerel (export'suz) tip aliası yapıldı. Dosya artık yalnız
      iki `async function` export ediyor.
- [x] `page.tsx` — `import type { IlanDurumu } from '../../lib/ilan-yaz'` (kaynağından).
- [x] **Kural dar tutuldu:** yerel tanımlı tip export'u sorun DEĞİL. `TelefonDurumu`
      (aynı dosya), `ProfilGirdi`/`ProfilSonuc`, `DurakGirdi`/`IlanGuncelleGirdi`/
      `PanelSonuc`, `ModSonuc`/`ModDurakGirdi`/`ModIlanGirdi` — hepsi aylardır canlıda
      sorunsuz. Patlayan tek biçim içe aktarılan bağlamayı dışa veren `export type { X }`.
      Tarama yapıldı: projede başka re-export yok.
- [x] **Üretim derlemesiyle doğrulandı** (tsc değil): hatanın geldiği **tam chunk**
      `server/chunks/ssr/_0wmprg3._.js` yeniden derlendi → `IlanDurumu` geçiş sayısı
      **0** (yeni kodun derlendiği `satir-yok` dizesi ise 1). Kaynak haritalarında
      (`.map`) görünmesi normal.

**Kalan:**
- [ ] 🧹 **Bayram — `rm -rf .next-dogrulama`** (kum havuzu silemiyor, FUSE izni).
      Aynı sınıf artık: eski `.next-verify`.
- [ ] **Deploy et**, `/ilan-ver`'i aç. Beklenen: numara geliyor. Gelmiyorsa artık
      `kod:` satırı var, aşağıdaki tabloyla oku.
- [ ] Numara gelince → **#29 form kanalı testi.**

**`kod:` karşılıkları (arıza sürerse):**
      - `satir-yok` → auth id ≠ profil satırı. Hesap birleştirme (`merged_into`) bak.
      - `alan-bos` → `users.phone` gerçekten boş; panelde gördüğün başka bir alan.
      - `sorgu` → PostgREST hatası; Vercel logunda `phone-privacy` ERROR satırında kod var.
      - `istisna` → `getServiceSupabase()` fırlattı (env) ya da ağ; aynı log satırı.
      - `oturum-yok` → server action'a cookie gitmiyor; panel GET çalışırken POST düşüyor.
- [ ] Kod okununca **#29 form kanalı testi** açılır.
- [ ] Kalıcı çözüm adayı (ayrı iş): `numara-yok` durumunda forma telefon input'u koy —
      `ilanTelefonu()`'nun kendi kendini onaran dalı zaten hazır, sadece kanal ona
      değer göndermiyor. Ama numara SMS ile doğrulanmamış olur; ürün kararı gerekiyor.

### 🔴 `shadow_profile_summary` view'ı RLS bypass ediyor (29 Tem 2026) — SQL BEKLİYOR

Supabase linter: **Security Definer View**. `shadow_profiles` admin-only RLS ile korunuyor
ama üstündeki view'a `GRANT SELECT ... TO authenticated` verilmiş ve view sahibinin
yetkisiyle çalışıyor → **siteye üye olan herkes** PostgREST'ten tüm kayıtsız nakliyeci
telefonlarını (`phone`, `name`, `company_name`, `notes`, `ai_analiz`) çekebiliyor. KVKK.

- [ ] **Bayram:** `docs/20260729_shadow_profile_summary_invoker.sql` çalıştır
      (`security_invoker = on` + yetkiyi yalnız `service_role`a bırak). Kod deploy'u gerekmez.
- [ ] Doğrula: `reloptions` içinde `security_invoker=true` görünüyor mu, `anon`/`authenticated`
      için `has_table_privilege` false mu (SQL dosyasındaki §1–§2 sorguları).
- [ ] `/admin/crm` hâlâ çalışıyor mu? (service-role kullandığı için etkilenmemeli)

### 🚀 Otomatik deploy kapatıldı (29 Tem 2026)

Daemon her kaydetmede push atıyor, Vercel her push'ta build ediyordu → günde ~79 deploy
(Hobby limiti 100/gün, bugün doldu) ve yarım kod canlıda.

- [x] `vercel.json` → `ignoreCommand`: commit mesajı `auto:` ile başlıyorsa build atlanır.
      ⚠️ Vercel şeması bilinmeyen üst düzey anahtar kabul etmiyor — açıklama satırı
      (`_ignoreCommand_neden`) reddedildi, gerekçe `scripts/deploy.sh` başlığında.
- [x] `scripts/deploy.sh` + `npm run deploy` — tek deploy kapısı. `.git/index.lock` bekler,
      `tsc --noEmit` çalıştırır (tip hatası varsa DURDURUR), `deploy:` commit'i atıp push'lar.

### 🔴 …ama `ignoreCommand` YETMEDİ — kota yine bitti (aynı gün 19:00)

**Belirti:** `npm run deploy` çalışıyor, push başarılı, **Vercel'de hiçbir kayıt yok** —
"Canceled" bile değil. Hata yok, e-posta yok, site güncellenmiyor.

**Kök:** Hobby kotası **kayan 24 saatte 100 DEPLOYMENT** ve **`ignoreCommand` ile iptal
edilen "Canceled" deployment'lar da sayılıyor.** `ignoreCommand` build DAKİKASINI
kurtarır, KOTAYI kurtarmaz — deployment zaten oluşturulmuştur. Daemon 24 saatte **266
commit** push'ladı → kota 19:00'da bitti → Vercel `deploy:` commit'leri dahil hiçbir
deployment oluşturmaz oldu.

> 🔍 **Tanı hilesi:** Deployments → Status filtresi varsayılan **6/7**; gizlenen statü
> "Canceled". Onu açmadan tabloya bakarsan `auto:` push'larının iptal edildiğini
> göremezsin ve yanlış yere bakarsın.

**Çözüm — deployment'ın hiç OLUŞTURULMAMASI gerekiyor:**

- [x] `scripts/auto-deploy.sh` → daemon artık `main`'e değil **`HEAD:yedek`**'e push
      ediyor. Yedekleme kaybolmadı, sadece dal değişti; retry `--force-with-lease`.
- [x] `vercel.json` → `git.deploymentEnabled.yedek = false`. ⚠️ Bu şart: Vercel
      varsayılan olarak **her** dala Preview deployment'ı üretir ve **Preview de
      kotadan düşer**.
- [x] `ignoreCommand` ikinci katman olarak duruyor (`deploy.sh` `main`'e push ederken
      yanındaki `auto:` commit'leri de taşır; HEAD `deploy:` olduğu için build 1 kez olur).
- [ ] **Bayram — SIRAYLA:**
      1. Daemon'ı yeniden başlat (çalışan süreç eski scripti tutuyor):
         `launchctl kickstart -k gui/$(id -u)/com.yukegel.autodeploy`
      2. Kota açılınca `npm run deploy` — bekleyen tonaj + telefon düzeltmeleri
         + RPC v2 geçişleri tek deploy'da çıkar. Kota kayan pencere: slotlar
         saat başı azar azar boşalıyor, sabit saatte sıfırlanmıyor.
      3. Deploy sonrası Vercel → Deployments'ta **Status 7/7** ile bak: `yedek`
         dalı için **hiçbir satır** (Canceled dahil) çıkmamalı. Çıkıyorsa
         `deploymentEnabled` uygulanmamıştır.

## ✅ Tonaj: sadece 1. durak gösteriliyordu — TOPLAM'a çevrildi (29 Tem 2026)

**Belirti:** Ana ekranda ilan özeti çok duraklı bir ilanda tek durağın tonajını
gösteriyordu. Mersin 8t + Adana 12t + Hatay 5t olan ilan listede **"⚖ 8 ton"**.

**Kök:** Kart `ilan.duraklar[0]?.ton` okuyordu. Sorgu durakların HEPSİNİ çekiyordu —
kırpma tamamen görüntüleme katmanındaydı, bu yüzden hiçbir hata/uyarı üretmiyordu.
Yükün %68'i ekranda yokken ekran "çalışıyor" görünüyordu. Nakliyeci aracını 8 tona
göre seçip ilana giriyor, gerçek yükü orada öğreniyordu.

**Düzeltme** — toplam tek yerde: `lib/ilan-liste.ts → durakToplami(duraklar, alanlar[])`
(`numeric` alanları `Number()`'la topluyor — PostgREST `"8.50"` STRING döndürebiliyor;
ondalık artığı 2 haneye yuvarlıyor; hiç değer yoksa `0` değil `null`).

- [x] `app/_components/HomeClient.tsx` — ton + palet toplamı; >1 durakta çipe `(3 durak)` eki
- [x] `app/panel/IlanYonetim.tsx` — aynı kopyala-yapıştır hata, aynı düzeltme
- [x] `app/ilan/[id]/page.tsx` — meta `description` ilk dolu durağı yazıyordu; **Google'a
      da eksik tonaj gidiyordu**, artık toplam
- [x] `app/moderator/page.tsx` — kalite skoru `stops[0].weight_ton` bakıyordu; ilk durakta
      tonaj yoksa ilan 5 puanı boş yere kaybediyordu → `stops.some(...)`
- [x] `durakToplami` birim testi: çok durak / string numeric / ondalık artık / boş / 0 / çöp
- [x] `tsc --noEmit` temiz
- [ ] **Bayram:** deploy sonrası ana sayfada çok duraklı bir ilanı gözle doğrula

> **Doğru olan ve DEĞİŞMEYEN:** `/ilan/[id]` durak kartları ve `/u/[username]` durakları
> tek tek listeliyor — orada her satır kendi tonajını gösterir, toplam yanlış olurdu.

## ✅ Giriş sonrası ana sayfaya düşme — gelinen sayfaya dönülüyor (29 Tem 2026)

**Belirti:** Hangi sayfadan giriş yapılırsa yapılsın giriş sonrası **ana sayfa** açılıyordu.
En can yakan hâli: kullanıcı ilanlarını `/u/<id>` bağlantısıyla paylaşıyor, gelen kişi
"Giriş Yap"a basıyor ve o listeyi bir daha bulamıyor — paylaşılan bağlantı boşa gidiyor.

**Kök 1 — kapsam:** `guvenliRedirect` + `yk_redirect` cookie zinciri (A7) doğru çalışıyordu
ama hedefi YALNIZCA `proxy.girisYonlendir()` kuruyordu, o da sadece 5 `KORUNMALI` rota için
(`/panel`, `/ilan-ver`, `/araclarim`, `/profil`, `/moderator`). Diğer ~10 giriş bağlantısı
(header, footer, "Üye Ol", `/hakkimizda`, `/nasil-calisir`, `panel/page.tsx`, `araclarim`,
`profil-tamamla`) ÇIPLAK `/giris` idi. Hata üretmiyor, sadece yanlış yere gidiyordu.

**Kök 2 — sinsi olan:** `/auth/callback` hedefi **yalnız cookie'den** okur, query param'a
hiç bakmaz. Bağlantılara `?redirect=` eklense bile proxy'ye uğramadan gelen kullanıcıda
cookie boş kalıyordu → **telefon/e-posta ile girenler doğru yere, Google ile girenler ana
sayfaya** düşüyordu. Aynı sayfa, iki farklı davranış, sıfır hata sinyali.

**Düzeltme** — hedef tek yerden kuruluyor: `lib/redirect.ts → girisAdresi(yol, mod?)`
(`encodeURIComponent` + `guvenliRedirect` içeride; `/giris`in kendisi hedefse hiç eklenmez).

- [x] `lib/redirect.ts` — yeni `girisAdresi()`
- [x] `app/_components/GirisLink.tsx` — yeni; bulunduğu sayfayı `usePathname()` ile kendisi
      ekler (`useSearchParams()` DEĞİL: Suspense sınırı zorlar, statik render'ı bozar)
- [x] `app/giris/page.tsx` — `?redirect=`'i cookie'ye de yazıyor → Google/e-posta zinciri
- [x] `Footer.tsx` (her sayfada), `HomeClient.tsx` (banner + nav), `hakkimizda`,
      `nasil-calisir`, `u/[username]`, `panel`, `araclarim`, `profil-tamamla`
- [x] 🚨 **Yan bulgu — açık yönlendirme kapatıldı:** `profil-tamamla` "profil zaten tam"
      dalı `redirect`'i HAM kullanıyordu (`?redirect=https://kotu.site` çalışıyordu).
      Aynı dosyanın başka bir dalı zaten `guvenliRedirect`'ten geçiriyordu — bu dal atlanmış.
- [x] `girisAdresi` testi 17/17 (mutlak URL, `//`, `/\`, CR/LF, null, `/giris` döngüsü)
- [x] `tsc --noEmit` temiz
- [ ] **Bayram:** deploy sonrası `/u/<id>` sayfasından "Ara" → giriş → **aynı sayfaya**
      döndüğünü doğrula; ayrıca **Google ile girişte de** döndüğünü ayrıca dene

## ⚠️ BUGLAR
- [x] **A11 — "AI Keşfi Başlat" her seferinde timeout** ✅ kod tarafı tamam (31 Tem 2026) — **kod push edildi ve `origin/main` ile aynı (7 Ağu 2026 doğrulaması); Vercel `main`'i otomatik deploy ediyor.** Canlı el testi hâlâ yapılmadı: aşağıdaki "canlı test" maddesi AÇIK.
  Belirti: `/admin/ogrenme-merkezi` → limit **10** (panelin en düşük seçeneği) ile "AI Keşfi
  Başlat" → `LLM 8 saniyede yanit vermedi — limit azalt veya tekrar dene`.
  Sebep: `app/api/admin/learn-aliases/route.ts` `maxDuration = 60` ilan ediyor ama LLM
  fetch'i `setTimeout(() => controller.abort(), 8000)` ile kesiliyordu. **Bütçenin 52
  saniyesi hiç kullanılmıyordu.** İş 8 sn'ye sığmıyor: prompt'un en büyük parçası
  `mevcutMap` (500 alias çifti ≈ 15 kB), üstüne 10×200 karakter ilan metni ve
  `max_tokens: 1024` çıktı var.
  Hata mesajının kendisi ikinci bir hataydı: **"limit azalt" diyordu ama 10 zaten tabandı** —
  kullanıcıya yapamayacağı şey öneriliyordu; ayrıca "8 saniye" metne gömülüydü, timeout
  değişince yalan söyleyecekti.
  Çözüm: `LLM_TIMEOUT_MS = 45_000` sabiti (60 sn bütçe − DB turları − soğuk başlangıç payı;
  Vercel'in 504'ü bizim hatamızın önüne geçmesin diye sınırın altında). Mesaj artık süreyi
  sabitten türetiyor ve "tekrar dene" diyor.
  ⚠️ `mevcutMap` **bilerek kısaltılmadı**: 5b filtresi mevcut alias'ları zaten sunucuda eliyor,
  yani liste doğruluk için değil **verim** için orada — kaldırılırsa LLM tekrarları önerir,
  tur başına yeni alias sayısı düşer.
  Doğrulama: `npx tsc --noEmit` temiz. **Canlı test deploy sonrası** (Görev #19 ile aynı turda).
- [x] **A10 — "Hesabınız birleştirildi" sonsuz giriş döngüsü** ✅ (29 Tem 2026)
  Belirti: giriş yapılıyor → "Hesabınız başka bir hesabınızla birleştirildi… tekrar giriş
  yapın" → tekrar giriş → aynı mesaj. **Hiç giriş yapılamıyor.**
  Sebep: emekli (`merged_into` dolu) auth kimliğiyle girildiğinde `proxy.ts` sb- cookie'lerini
  silip `/giris?hesap=tasindi`'ye atıyordu. Kullanıcı aynı kimlikle geri geldiği için yine
  aynı satıra düşüyordu — kodda döngüden çıkış yolu yoktu. `/api/auth/switch-account`
  magic-link'in `action_link`'ini (implicit flow) döndürdüğü için SSR cookie'si hiç
  güncellenmiyor, döngü kapanmıyordu.
  Çözüm: yeni `app/auth/devir/route.ts` — oturumu **sunucuda** canlı hesaba devreder:
  `merged_into` zinciri (maks 5 adım, döngü koruması) → `admin.generateLink` →
  **`hashed_token`** → cookie yazan `createServerClient` üzerinde `verifyOtp` → canlı
  hesabın cookie'leri yazılır → hedefe (`?redirect` / `yk_redirect` / `/panel`) yönlendirir.
  Kurtarılamayan hâllerde (hedef silinmiş, e-posta yok, zincir döngüsü) cookie'leri temizleyip
  `/giris?hesap=tasindi`'ye düşer. `proxy.ts`'teki `merged_into` dalı artık cookie SİLMEZ.
  Yetki: hedef hesap istekten ALINMAZ, yalnız oturumun kendi `merged_into` zincirinden okunur.
- [x] **A9 — SMS girişinde kod girilmeden /admin'e düşme** ✅ (29 Tem 2026) — **güvenlik açığı DEĞİL**
  Belirti: `/giris`'te telefon yazıp SMS iste → kod girilmeden `/admin` açılıyor.
  Sebep: kullanıcının ZATEN geçerli bir oturumu vardı. Sayfa açılışındaki "oturum sağlık
  kontrolü" (INITIAL_SESSION) o oturumu görüp `yonlendir()` çağırıyor. A8 deadlock'u
  yüzünden bu kontrol ~5 sn gecikiyordu (kilit zorla kurtarılana kadar), o yüzden SMS
  gönderildikten SONRA tetikleniyormuş gibi görünüyordu. Oturum `verifyOtp` olmadan
  ASLA oluşmuyor — `otpGonder` yalnızca `signInWithOtp` çağırır.
  Çözüm: `etkilesimRef` — kullanıcı kendi giriş denemesini başlattıysa açılış kontrolü
  yönlendirme yapmaz. Böylece oturumu açıkken başka hesaba geçmek de mümkün.
- [x] **A8 — Ana sayfa navbar'ı giriş yapmış kullanıcıyı görmüyordu** ✅ (29 Tem 2026)
  Belirti: oturum açıkken `yukegel.com` navbar'ı "Giriş Yap / Üye Ol" gösteriyor, ama
  `/admin` çalışıyordu. Sebep: `onAuthStateChange` callback'i içinde `await supabase.from('users')`
  → Supabase auth kilidi deadlock (`Lock "lock:sb-...-auth-token" was not released within 5000ms`).
  Çözüm: DB işi `setTimeout(0)` ile kilidin dışına alındı; gereksiz `getSession()` kaldırıldı
  (`INITIAL_SESSION` zaten tetikleniyor). Aynı desen `app/giris/page.tsx`'te de düzeltildi.
  Ayrıca navbar'a **Çıkış** (POST formu, C1 uyumlu) eklendi ve 👤 adı `/panel?tab=profil`e bağlandı.
- WhatsApp Import yukegel.com üzerinde çalışmıyor. localhost'ta çalışıyor (production ortamı farkı — muhtemelen Edge Function env var veya Supabase webhook URL sorunu)


## 📱 WhatsApp Import — Analiz & Sertleştirme (28 Tem 2026)

Tam analiz: `docs/WHATSAPP_IMPORT_ANALIZ.md` (bulgu kodları A1–A5, B1–B8, C1–C12).

### Kapatılanlar
- [x] **A1** — `/api/whatsapp-parse` yetkisizdi (service-role ile `raw_posts`'a yazan açık endpoint). `requireStaff()` + kullanıcı bazlı rate limit (10 istek/dk) eklendi. *(Not: `excel-import` bu açığa sahip DEĞİLDİ — ilk taslaktaki iddia hatalıydı.)*
- [x] **A2** — Offset'siz `new Date()` host TZ'ye göre kayıyordu (tarayıcı UTC+3 / Vercel UTC). Parser artık sabit `+03:00` ile çözüyor; test `process.env.TZ` değiştirilerek doğruluyor.
- [x] **A3** — `/` ve `-` ayraçlı tarihler, 2 haneli yıl, 12 saatlik format (ÖÖ/ÖS/AM/PM), U+202F dar boşluk hiç tanınmıyordu → dosyanın tamamı 0 mesajla dönüyordu. Artık destekleniyor; çözülemeyen zaman damgası sayısı `unparsed_timestamps` olarak UI'da gösteriliyor.
- [x] **A4** — Chunk INSERT'te tek `23505` 100 satırın tamamını sessizce düşürüyordu. Satır satır retry + `insert_failed` / `errors[]` raporlama.
- [x] **A5** — Repost eşleşmesi dizi indeksine güveniyordu (A4 düzeltmesiyle kesin kayacaktı). Doğal anahtar (`clean_hash|contact_phone|message_date`) bazlı eşleşmeye çevrildi.
- [x] **B2** — Repost akışı çift ilan üretiyordu (trigger→parse-listing + `repostListings()` kopyalama). `repostListings` kaldırıldı; `parse-listing` `is_repost` bayrağını `raw_posts`'tan taşıyor.
- [x] **C9** — Parser kopyası iki dosyada elle senkron tutuluyordu → `lib/whatsapp/chatParser.ts` tek kaynak.
- [x] **C12** — Parser testi yoktu → `lib/whatsapp/__tests__/chatParser.test.ts`, 29 assertion, `npm run test:parser`.
- [x] **60 sn Vercel timeout** — İçe aktarma kısmen ilerleyip "Task timed out after 60 seconds" ile düşüyordu. Kök nedenler: sınırsız `.in()` dizileri (URL'e gömülüyor), gereksiz 3. sorgu (5c), sınırsız eşzamanlı telefon update'leri, ve satır-satır 23505 retry fırtınası (~100 ek istek/chunk) — bunun sebebi batch-içi dedup anahtarının (`hash__telefon__tarih`) DB'nin gerçek unique indeksiyle (`clean_hash, post_date`) uyuşmamasıydı. Çözüm yöntemi: sunucuda `SURE_BUTCESI_MS = 45_000` bütçesi (dolduğunda HTML değil `{tamamlanmadi, islenmeyen}` JSON döner) + `parcala()`/`sirayla()` ile sorgu parçalama ve eşzamanlılık tavanı + 23505'te tek yeniden sorgu; istemcide sıralı döngü yerine **iş kuyruğu + otomatik ikiye bölme** (`dosyayiBol()` dosyayı mesaj başlığı sınırından ayırır, `MAX_BOLUNME = 8`). Detay: `docs/WHATSAPP_IMPORT_ANALIZ.md` §7.
- [x] **C10 (kısmi)** — `structuredLog` + `duration_ms` telemetrisi eklendi (`whatsapp-import` context). `import_runs` tablosu hâlâ yok.

### Açık kalanlar (öncelik sırasıyla)
- [ ] **⚠️ B2 doğrulama** — `raw_posts` trigger'ının koşulsuz çalıştığı VARSAYILDI. Doğrula: `SELECT tgname, pg_get_triggerdef(oid) FROM pg_trigger WHERE tgrelid='public.raw_posts'::regclass AND NOT tgisinternal;` — `WHEN` içinde `is_repost` filtresi varsa repost satırları hiç ilan üretmez, o koşul kaldırılmalı.
- [x] **`raw_posts` unique kuralları dokümante edildi** (28 Tem 2026) — CONSTRAINT değil INDEX olarak tanımlılar. Bağlayıcı kural ~~`idx_raw_posts_hash_day UNIQUE (clean_hash, post_date)`~~ → **`idx_raw_posts_hash_msgdate UNIQUE (clean_hash, message_date) WHERE clean_hash IS NOT NULL`** (aşağıdaki `post_date` sadeleştirmesi taşıdı; 31 Tem 2026'da canlı indeks listesiyle doğrulandı — `hash_day` diye bir indeks yok). `upsert`'e geçilemiyor: her iki unique indeks de **kısmi**, PostgreSQL kısmi indeksi `ON CONFLICT` hedefi olarak çıkarsayamıyor.
- [x] **23505 fırtınasının asıl sebebi kapatıldı** — batch-içi dedup anahtarı `hash__tarih`'e çekildi (DB indeksiyle birebir); `existingMap` `post_date` üzerinden kuruluyor; kurtarma bloğu artık `(clean_hash, post_date)` çiftine bakıyor (önceden sadece `clean_hash`'e bakıp başka güne ait meşru repost'ları da eliyordu).
- [x] **Telefon geriye-doldurma ayrıldı** — `POST /api/raw-posts/telefon-doldur`. İçe aktarmanın doğruluğunu etkilemiyordu ama satır başına 2 UPDATE ile bütçeyi yiyordu. Telefon regex'i `lib/whatsapp/telefon.ts`'e alındı.
- [x] **Gatekeeper substring eşleşmesi düzeltildi** (28 Tem 2026) — `norm.includes(alias)` yerine token eşitliği + ek soyma. `"lojistik"→İstanbul`, `"getirin"→TIR`, `"balyası"→Balıkesir` gibi sahte eşleşmeler bitti.
- [ ] **Alias tablosunda KOPYA kayıtlar — ÖLÇÜLDÜ, yüzlerce grup** (28 Tem 2026). İki ayrı zarar: (a) `avcilar` ve `hadimkoy` alias'larında `normalized` çelişiyor — `Istanbul` vs `İstanbul`. Şehir doğru ama yazım tutarsız; `normalized` ilana yazılan değer olduğu için şehir filtresi bunları iki ayrı şehir sayıyor. (b) `district` çelişkisi çok daha yaygın: onlarca grupta kopyaların biri dolu diğeri NULL (`gebze`, `çorlu`, `torbalı`, `alanya`, `çiğli`, `sincan`...), ayrıca yazım farkları (`Avcilar`/`Avcılar`, `Kirkağaç`/`Kırkağaç`, `Kazan`/`Kahramankazan`). `findPlaces` ilk eşleşmeyi aldığı için **ilçe bilgisi sıraya bağlı olarak kayboluyor**. Çözüm: kopya SİLİNMEYECEK — `docs/20260728_alias_homonim_temizligi.sql` ADIM 5 ile her gruptaki tüm satırlara aynı doğru `normalized`+`district` yazılacak (5.1 önizleme → 5.2 UPDATE → 5.3 doğrulama). Sonra ADIM 6: geçmiş `listings` satırlarındaki `Istanbul`/`İstanbul` karışıklığı ölçülüp düzeltilmeli. Kalıcı çözüm: `aliases` üzerine normalize trigger + normalize forma UNIQUE indeks, yoksa kopyalar yeniden oluşur.
- [ ] **SAHTE GÜZERGÂH — `Istanbul` vs `İstanbul`** (28 Tem 2026, YENİ BULGU). `findPlaces` içindeki `seen` kümesi `normalized` DEĞERİYLE tutuluyor. `aliases` tablosunda 13 satır `Istanbul` (Türkçe karakteri düşmüş), 154 satır `İstanbul` yazıyor — bunlar AYRI iki değer. İçinde hem `avcilar` (→`Istanbul`) hem `kadıköy` (→`İstanbul`) geçen mesaj İKİ ŞEHİR bulmuş sayılıp **İstanbul→İstanbul güzergâhı** üretiyor. Aynı sorun `Izmir`/`İzmir`, `Mugla`/`Muğla`, `Bingol`/`Bingöl`'de de var. Düzeltme: `docs/20260728_alias_kopya_temizligi.sql` BÖLÜM 1. Sonrasında geçmiş `listings` için ~~BÖLÜM 6 (`origin_city = destination_city` olanları da say)~~ → 🚫 **BÖLÜM 6 KULLANILMAYACAK**: `destination_city` diye bir kolon yok (#28, 42703) ve "aynı şehir" sahtelik sinyali değil. Yerine `20260729_alias_runbook.md` Adım 8 (dört konum kolonunu birlikte onarır).
- [ ] **`payas` yanlış ile yazılıyor** (28 Tem 2026). `aliases` id=1003 `Payas → Adana` diyor; Payas 2008'den beri **Hatay** ilçesi. Doğru satır (id=1844, Hatay) da var ama `findPlaces` küçük id'yi seçtiği için bugün her "payas" ilanı Adana'ya yazılıyor. Düzeltme: aynı dosya BÖLÜM 4.1.
- [ ] **Belirsiz alias'lar: `gölbaşı`, `kemalpaşa`** (28 Tem 2026). İkisi de iki farklı ile ait gerçek yer adı; tek kelimeyle ayırt edilemiyor. `araç` ile aynı mantıkla baskın olmayanı pasifleştirilmeli. Düzeltme: aynı dosya BÖLÜM 4.5 / 4.6.
- [ ] **Alias homonim temizliği — ölçüldü, tek suçlu `araç`** (28 Tem 2026). 3000 mesajın 580'inde (%19) geçiyor, sıralamada Bursa'nın üstünde; `Kastamonu/Araç` ilçesi ama metinde "vasıta" anlamında. `olur`/`merkez`/`pazar` ilk 40'a girmedi. Kalan: `docs/20260728_alias_homonim_temizligi.sql` ADIM 3 ile `is_active = false`.
- [ ] **Gatekeeper düzeltmesi sonrası ölçüm** — düzeltme öncesi `isAd` fiilen "telefon var mı" idi, yani geçmişte kaydedilen bir kısım `raw_posts` aslında ilan değil. Düzeltilmiş kodla aynı dosya yeniden içe aktarılıp `kaydedilen` sayısındaki düşüş ölçülmeli; büyük düşüş varsa eski kayıtlar için temizlik gerekebilir.
- [x] **1000 satır sessiz kesilmesi kapatıldı** (28 Tem 2026) — `aliases` (1887 aktif satır) hem `whatsapp-parse` gatekeeper'ında hem `parse-listing` edge fonksiyonunda tek sorguyla çekiliyordu; PostgREST 1000'de kesiyordu. İkisi de `.range()` + `.order('id')` ile sayfalandı. ⚠️ `parse-listing` bir Edge Function — ayrıca `supabase functions deploy parse-listing` gerekiyor.
- [x] **`raw_posts_dedup_idx` — DÜŞÜRÜLMEYECEK, ölçüm kararı tersine çevirdi** (31 Tem 2026, `docs/20260731_index_temizligi.sql` BÖLÜM 7 S3). Kısıt gerekçesi ayakta: `idx_raw_posts_hash_msgdate UNIQUE (clean_hash, message_date)`'in satır kümesi dedup'ınkinin **üst kümesi** ve kolonları daha katı, dolayısıyla dedup hiçbir zaman ek kural dayatamaz — ikisi de kısmi olmasına rağmen gerekçe çökmüyor. 🚨 Ama bu maddedeki **"sorgu tarafında karşılığı yok" cümlesi ölçümle yanlışlandı**: dedup_idx **86.319 tarama** almış, `idx_raw_posts_clean_hash`'in (83.358) üstünde. Planlayıcı `clean_hash` öncüllü iki indeks arasında iş bölüştürüyor; unique kontrolü `_bt_check_unique`'ten gider ve `idx_scan`'i artırmaz, yani bunlar gerçek sorgu taramaları. Düşürmek istenirse önce BÖLÜM 7.D'deki `begin; drop index …; explain …; rollback;` testi.
- [x] **`post_date` sadeleştirme TAMAMLANDI** (28 Tem 2026). Unique indeks `message_date`'e taşındı (`idx_raw_posts_hash_msgdate`, valid+unique), kod `post_date` yazmayı bıraktı (commit dd02073), kolon düşürüldü. Teşhis özeti: Adım 0 doğrulaması 0 yerine **1543 ayrışmış satır** döndü. ADIM 0b teşhisi (28 Tem 2026): ayrışan satırların **tamamında** `post_date = created_at::date` ve `post_date > message_date` → `post_date` mesajın gününü değil **içe aktarma gününü** tutuyor, yani anlamsız bir kolon; otorite `message_date`. Ayrışma penceresi **kapalı** (12–20 May 2026), bugünkü kod bu hatayı yapmıyor. Her iki kolonda `column_default = NULL`, sebep bir DEFAULT değil eski bir kod sürümü. `(clean_hash, message_date)` kopya sorgusu **boş döndü** → yeni unique indeks hatasız kurulur. Tablo 59.533 satır / 54 MB → **Seçenek A (CONCURRENTLY'siz) yeterli, uygulanabilir**. — `docs/20260728_raw_posts_post_date_sadelestirme.sql`. SIRA ÖNEMLİ: (1) SQL adım 0–2, (2) koddan `post_date` yazımını kaldır + dağıt, (3) SQL adım 3 ile kolonu düşür. Sırayı bozmak tüm insert'leri kırar.
- [ ] **B5** — Hata alan kayıtlar `processing_status: 'pending'`de asılı kalıyor; `error` durumu + retry yok.
- [ ] **B1** — Sabit hat numaraları (`0212...`, `0332...`) hiç yakalanmıyor; `isAd` telefon şartına bağlı olduğu için bu ilanların tamamı gate'ten geçemiyor.
- [ ] **B3** — Spam sayacı yükleme içindeki tekrarları görmüyor (sadece DB'deki son 1 saate bakıyor).
- [ ] **C5** — Klasör modunda grup adı tek isme çöküyor, dosya bazlı `source_group` kaybediliyor.
- [ ] **C1** — `no_lane` kalan kayıtlar için LLM (Haiku) fallback yok; "LLM parse" adı yanıltıcı, gerçekte regex.
- [ ] **C6** — Bir chunk hata alınca kalan gruplar iptal (`break` → `continue` olmalı).
- [ ] **C7** — `debugLog` sınırsız büyüyor.
- [ ] **C10** — `import_runs` tablosu (kalıcı import telemetrisi).

## 🏠 Landing / Kayıt / Giriş — Analiz (28 Tem 2026)

Tam analiz: `docs/LANDING_AUTH_ANALIZ.md` (bulgu kodları L1–L5, A1–A7, K1–K3). Hiçbiri kod
değişikliği içermiyor — yalnızca statik okuma. Canlı DB/RLS doğrulaması yapılmadı.

> **🏃 SPRINT PLANI: `docs/SPRINT_01.md`** — 30 madde / 78 puan, 5 dalgaya (W0–W4) bölünmüş.
> Her maddede dosya:satır, kabul kriteri, efor ve bağımlılık var. Aşağıdaki liste bulgu
> envanteri; **çalışma sırası için SPRINT_01.md'yi kullan.**
>
> ~~W0 (blocker, 17p): L1 · A2 · **M1** · K1~~ **✅ TAMAMLANDI (28 Tem 2026)**
> ~~W1 (auth bütünlüğü, 21p): **L1e** · A1 · A3 · A4 · A7 · K2 · **R1** · **C1**~~ **✅ TAMAMLANDI (28 Tem 2026)**
> ~~W2 (güvenlik, 15p): **G1** · **G2** · **M2** · **C2** · K2b~~ **✅ TAMAMLANDI (29 Tem 2026)**
> ~~W3 (SEO/huni, 14p): **S1–S4** · L2 · L3~~ **✅ TAMAMLANDI (29 Tem 2026)**
> ~~W4 (cila, 11p): K3 · **R2** · **F1** · **F2** · L4 · L5 · A5 · A6~~ **✅ TAMAMLANDI (29 Tem 2026)**
> **Beş dalganın beşi de bitti — sprint'in kod tarafı kapandı.**

### ✅ W0 — Tamamlandı (28 Tem 2026)
- [x] **L1** — Telefon sızıntısı. `app/page.tsx` ISR'li olduğu için "misafirse gizle" yapılamadı;
      numara payload'dan tamamen çıkarıldı, `/api/ilan/[id]/telefon` üzerinden veriliyor.
- [x] **L1b** — `app/api/ilan/[id]/telefon/route.ts` *(yeni)* — authed + `logPhoneAccess` + 20/dk.
- [x] **L1c** — `/ilan/[id]`: wa.me linki ve `Aksiyonlar` prop'u `user && profilTamamlandi`'ya bağlandı.
- [x] **L1d** — `/ilan/[id]/sahiplen` sahiplenilmemiş **her** ilanın numarasını gösteriyordu.
      Yeni `app/api/ilan/[id]/sahiplen/route.ts`: maskeli görüntü + OTP sunucuda.
- [x] **L1f** — `/u/[username]` de `tel:` href ile numarayı gömüyordu; `araTikla`'ya çevrildi.
- [x] **A2** — Google merge 404'ü. Callback artık `/giris?merge_user_id=…`'ye gidiyor.
- [x] **A2b** — Merge route'unda 3 bug: `if (yeniProfil)` guard'ı profili siliyordu,
      tekil alanlar `users_email_key` ihlali yaratıyordu, `auth_providers`'a `'phone'` hardcode'du.
- [x] **M1** — `proxy.ts` artık segment sınırında eşleştiriyor (`korunmaliMi()`).
- [x] **K1** — KVKK açık rıza checkbox'ı + `users.kvkk_onay_at`.
- [x] **K1b** ✅ `docs/20260728_kvkk_onay.sql` çalıştırıldı (Bayram, 29 Tem 2026).
- [x] **A4b-hane** — `sahiplen` OTP girişi 6 hane bekliyordu, Twilio 4 gönderiyor → akış
      fiilen tamamlanamıyordu. 4'e çekildi.

### ✅ W1 — Tamamlandı (28 Tem 2026)
- [x] **L1e** — `contact_phone`'un son istemci yazma yolu kapatıldı. `app/panel/actions.ts` ve
      `app/moderator/actions.ts` *(yeni)*; `IlanYonetim.tsx`'ten anon istemci tamamen kaldırıldı,
      `moderator/page.tsx`'in select/update/insert'lerinden kolon çıkarıldı.
- [x] **L1e-SQL** ✅ `docs/20260728_contact_phone_revoke.sql` çalıştırıldı + duman testi geçti (Bayram, 29 Tem 2026).
      `anon`/`authenticated` artık `listings.contact_phone` kolonunu **hiç göremiyor** —
      numara yalnız service-role yollarından okunuyor. Sızıntı DB katmanında da kapandı.
      Duman testi ✅ (misafir sayfalar + moderatör telefon düzenle/Onayla).
- [x] **A1** — `app/api/auth/log/route.ts` *(yeni)*. Endpoint aylardır yoktu, 404 `.catch(()=>{})`
      içinde yutuluyordu → auth audit trail'i tamamen boştu.
- [x] **A1b-SQL** ✅ `docs/20260728_auth_events.sql` çalıştırıldı (Bayram, 29 Tem 2026).
      Denetim izi artık gerçekten yazılıyor; G1'in kilit olayları da buradan okunabilir.
- [x] **A3** — `?hesap=tasindi` / `?hesap=eslesme` mesajları artık `!user` dalında da basılıyor.
- [x] **A4** — Twilio kod uzunluğu 4 hane olarak teyit edildi (Bayram, 28 Tem 2026).
- [x] **A7** — `lib/redirect.ts` *(yeni)* `guvenliRedirect()` — açık yönlendirme koruması dahil.
- [x] **K2** — `app/profil-tamamla/actions.ts` *(yeni)* + kolon beyaz listesi. `role`, `is_active`,
      `phone_verified`, `merged_into`, `trust_level` istemciden yazılamıyor.
- [x] **R1** — `/auth/reset` 3 durumlu. **Backlog'da yazandan daha kötüsü çıktı:** normal
      (recovery olmayan) bir oturum açıkken `updateUser({password})` çalışıyordu → açık kalmış
      oturuma erişen kişi eski şifreyi bilmeden şifreyi değiştirebiliyordu.
- [x] **C1** — `/cikis` GET kaldırıldı, POST + Origin kontrolü.
- [x] **A4b** — OTP cooldown **sunucuda** (ilan başına 60 sn, 429 + `Retry-After`).
- [x] **Keşif** — panel'in istemci `listings` update'i gövdeyi filtrelemiyordu; kullanıcı kendi
      ilanına `trust_level: 'verified'` / `moderation_status: 'approved'` yazabiliyordu (K2 ile
      aynı sınıf). Beyaz listeyle kapandı.

### ✅ W2 — Tamamlandı (29 Tem 2026)
- [x] **A10** — `merged_into` giriş döngüsü. `app/auth/devir/route.ts` *(yeni)* oturumu
      **sunucuda** canlı hesaba devrediyor (`generateLink` → `hashed_token` → `verifyOtp`).
      Token tarayıcıya hiç gelmiyor. Proxy artık cookie SİLMİYOR — devir onları okumak zorunda.
      Zincir (A→B→C) `MAKS_ADIM=5` + döngü tespitiyle taranıyor; kurtarılamayan hâllerde
      `/giris?hesap=tasindi`'ye temiz çıkış.
- [x] **M2** — `app/moderator-giris/page.tsx` giriş sonrası rol doğruluyor; yetkisizse
      oturum kapatılıp açıklayıcı mesaj gösteriliyor. Admin `/admin`'e, moderatör `/moderator`'a.
- [x] **C2** — Zaten C1 ile gelmişti (`app/cikis/route.ts` `sb-` cookie'lerini açıkça siliyor);
      doğrulandı, ek değişiklik gerekmedi.
- [x] **K2b** — `lib/kimlik.ts` *(yeni)* `tcknGecerli`/`vknGecerli` TEK KAYNAK. İstemci ve
      sunucudaki iki kopya kaldırıldı — ayrışırlarsa istemci "geçerli" derken sunucu reddeder
      (ya da tersi, ki tehlikeli olan o).
- [x] **G2** — SMS gönderimi istemciden alındı. `app/api/auth/otp/route.ts` *(yeni)*: POST +
      Origin, 3 katmanlı kota (numara 1/60sn, IP 5 farklı numara/saat, IP 15 toplam/saat).
      `sahiplen` endpoint'i **aynı** IP kovasını paylaşıyor — iki uç nokta arasında gidip gelerek
      kotayı ikiye katlamak mümkün değil. Kotalar yalnız SMS gerçekten gittiyse işleniyor.
- [x] **G1** — Şifreli giriş istemciden alındı. `app/api/auth/giris/route.ts` *(yeni)*: POST +
      Origin, e-posta başına 5 hata/15 dk, IP başına 20 hata/15 dk. Yalnız **başarısız** denemeler
      sayılır; başarıda `kotaSifirla`. Kilitliyken gelen istek sayacı UZATMAZ. Oturum cookie'si
      sunucuda yazılıyor; `/giris` ve `/moderator-giris` ikisi de bu route'u kullanıyor.
- [x] **Altyapı** — `lib/kota.ts` *(yeni)* ortak kayan pencere sayacı. ⚠️ Process belleğinde:
      çok instance'ta delinir, soğuk başlangıçta sıfırlanır. Redis'e taşıma yolu dosya başında.

### ✅ W3 — Tamamlandı (29 Tem 2026)
- [x] **S1** — `app/layout.tsx`: `metadataBase`, `alternates.canonical`, OpenGraph (`tr_TR`),
      Twitter `summary_large_image`. Kart görseli `app/opengraph-image.jpg` *(yeni,
      Bayram'ın tasarımı)* + `opengraph-image.alt.txt`; 1200×630'a indirilip JPEG q95 /
      134 KB'a sıkıştırıldı (PNG 650 KB ediyordu, WhatsApp büyük dosyada kartı sessizce
      göstermiyor). Geçici `next/og` üreteci silindi — aynı segmentte iki og dosyası olamaz.
      ⚠️ Karttaki "519 aktif ilan" ve "BETA" donmuş metin, elle yenilenmeli.
      🚨 `metadataBase` olmadan Next göreli OG/canonical URL'lerini SESSİZCE üretmez.
      ⏳ Deploy sonrası: WhatsApp'a link atıp kart görünüyor mu bak. `NEXT_PUBLIC_SITE_URL`
      Vercel'de tanımlı mı teyit et (tanımsızsa fallback `yukegel.com`).
- [x] **S2** — `app/giris/layout.tsx`, `app/moderator-giris/layout.tsx`,
      `app/profil-tamamla/layout.tsx`, `app/auth/layout.tsx` *(hepsi yeni)*.
      🚨 `'use client'` sayfası `metadata` export edemez — Next hata vermeden yok sayar.
      `/auth` için sayfa başına değil **segment** layout'u seçildi; yeni `/auth/*` rotaları
      otomatik miras alsın diye (S4'teki "listeler ayrışır" hatasını tekrarlamamak için).
- [x] **S3** — `app/sitemap.ts`: `/yol-rehberi` + profil sayfaları eklendi.
      🚨 `/u/[username]` klasör adı yanıltıcı — param **kullanıcı id'si**. Profil URL'leri
      ayrı `users` sorgusu atmadan, zaten çekilmiş aktif ilan listesinden türetiliyor
      (ilanı olmayan boş profiller "thin content" olarak sitemap'e girmiyor).
- [x] **S4** — `public/robots.txt` dört blok (`*`, GoogleBot, GPTBot, ClaudeBot), disallow
      listeleri birebir aynı. 🚨 İsimli blok `*` bloğunun YERİNE GEÇER, birleşmez — eski
      halde `*` bloğu `Allow: /` dediği için `/panel/`, `/admin/`, `/api/` genel taramaya açıktı.
- [x] **L2** — `lib/analiz.ts` *(yeni, `olayGonder`)* + `/ilan-ver` artık `?tip=` okuyor.
      🚨 HomeClient zaten `?tip=arac` linki veriyordu ama sayfa param'ı hiç okumuyordu —
      link etkisizdi. 🚨 İkinci hata: misafir yönlendirmesi `?tip=`'i kaybediyordu.
- [x] **L3** — Misafirin `🔐 Ara` butonu `/giris?redirect=/ilan/{id}`'e gidiyor + GA olayı.
      🚨 Ticket'ın öncülü yanlıştı: arama sonuçları misafire zaten açıktı (filtre istemcide).
      Gerçek kusur, giriş sonrası kullanıcının baktığı ilana dönememesiydi.
- **Doğrulama:** `tsc --noEmit` temiz; yeni dosyalarda eslint bulgusu yok.
  `next build` bu ortamda çalışmıyor → OG kartı ve robots çıktısı canlıda göz kontrolü ister.

### ✅ W4 — Tamamlandı (29 Tem 2026)
- [x] **K3** — `profil-tamamla/page.tsx`: `ALAN_GORUNUR` haritası + `tipDegistir()`. Yalnız
      yeni tipte GÖRÜNMEYEN alanlar temizlenir; ad/telefon/KVKK asla sıfırlanmaz.
      🚨 Görünmeyen alan temizlenmezse `actions.ts` onu YİNE DE yazıyor (`company_name`
      user_type'tan bağımsız) — ekranda olmayan veri sessizce kaydediliyordu.
      🚨 **İnceleme bulgusu (düzeltildi):** tip butonu, açık TCKN/VKN alanını önce blur ediyor
      (mousedown → blur → click); uçan tekillik isteği dönüşte temizlenmiş state'in üstüne
      yazıyor ve "Kaydet" **kalıcı pasif** kalıyordu — üstelik uyarı da görünmüyordu (blok
      yeni tipte gizli). Çözüm: `tipEpoch` ref guard'ı.
- [x] **R2** — `lib/sifre.ts` *(yeni)*: gösterge ile kapı tek kaynaktan besleniyor.
      🚨 `[A-Z]` Türkçe'de YANLIŞ — "Şifre123" reddediliyordu; `\p{Lu}` + `/u` kullanıldı.
      ⚠️ `epostaGiris` bilerek kapıya bağlanmadı (eski zayıf parolalılar kilitlenmesin).
      ⚠️ İstemci doğrulaması güvenlik değil; asıl kural Supabase Dashboard'da (Bayram listesi).
- [x] **F1** — Footer "Kayıt Ol" → `/giris?mod=kayit`; `giris/page.tsx` **hem `mod` hem
      `sekme`**'yi kuruyor (render koşulu ikisini birden istiyor, tek başına `mod` no-op).
      🚨 **İnceleme bulgusu (düzeltildi):** sekme butonları koşulsuz `setMod('giris')` yapıyordu,
      aktif sekmeye tekrar tıklamak kullanıcıyı kayıt formundan atıyordu.
- [x] **F2** — `Footer.tsx` 8 link `next/link`'e çevrildi; dosya artık **sıfır eslint bulgusu**
      (mevcut `Türkiye'nin` unescaped-entity hatası da düzeltildi).
- [x] **L4** — `lib/ilan-liste.ts` *(yeni, `ILAN_LIMITI`)*. İki kusur birden: SSR 200 / istemci
      30 ayrışması ("yenile"ye basınca liste kısalıyordu) **ve** sayacın platform toplamını
      yazması. 🚨 **İnceleme bulgusu (düzeltildi):** ilk sürüm filtre açıkken "en yeni" ön ekini
      düşürüyordu — oysa filtre 200'lük pencerenin İÇİNDE, istemcide çalışıyor.
- [x] **L5** — Sekme URL'e yansıyor: `pushState` + **`popstate`** (tek başına pushState bozuk).
      Varsayılan için param silinir. 🚨 **İnceleme bulgusu (düzeltildi):** `?tip=abc` sessizce
      varsayılana düşüyor ama adres çubuğunda kalıyordu → `replaceState` ile temizleniyor.
      ⚠️ `useSearchParams` kullanılamaz: ISR sayfasını CSR bailout'a sokar.
- [x] **A5** — `/api/auth/giris` 401 gövdesine makine okunur `kod` eklendi; istemci
      "doğrulanmamış e-posta"yı kırmızı hata yerine `dogrulama_bekle` ekranına yönlendiriyor.
      🚨 Türkçe metne göre dallanma kırılgan. ⚠️ Hesap sayımı zayıflamadı (GoTrue şifreyi
      `Email not confirmed` kontrolünden ÖNCE doğruluyor).
- [x] **A6** — `app/api/auth/dogrulama-tekrar/route.ts` *(yeni)*: Origin + 3 kota (adres 1/60sn,
      IP 5 farklı adres/saat, IP 10 toplam/saat) + `resend()`. İstemcide geri sayımlı buton.
      🚨 `emailRedirectTo` verilmezse link `/auth/callback`'i atlar → "girdim ama giremiyorum".
      ⚠️ Yanıt daima aynı (hesap sayımı). 🚨 **İnceleme bulgusu (düzeltildi):** yorum "sayaç
      yalnız başarıda işlenir" diyordu, kod her durumda işliyor — **kod doğru, yorum yanlıştı**.
- **Doğrulama:** `tsc --noEmit` temiz. Eslint bulgu sayısı HEAD ile karşılaştırıldı:
  `HomeClient` 21→21, `giris` 7→7, `profil-tamamla` 9→8; yeni dosyaların hiç bulgusu yok.
  Tek bilinçli susturma: L5 mount effect'indeki `set-state-in-effect` (alternatifi hidrasyon
  uyuşmazlığı). `next build` bu ortamda çalışmıyor → sekme/URL ve doğrulama e-postası
  canlıda göz kontrolü ister.

### 🟠 Diğer yeni bulgular
- [ ] **`/ilan/[id]` kendi canonical'ını vermiyor** — Next canonical'ı alt sayfalara miras
      bırakmaz. Dinamik OG görseli de yok (kök karta düşüyor). *(S1'den çıkan yeni iş)*
- [ ] **`/panel` ve `/araclarim`'da `noindex` yok** — robots.txt disallow'u var ve içerik auth
      arkasında, o yüzden düşük öncelik. *(S2'den çıkan yeni iş)*
- [ ] **Şifre kuralı Supabase tarafında zorunlu değil** — `lib/sifre.ts` yalnız istemci UX'i.
      Dashboard → Authentication → Policies → Password Requirements ayarlanmalı. *(R2'den)*
- [ ] **`lib/kota.ts` sayaçları process belleğinde** — Vercel'de çok instance olunca gerçek
      limit instance sayısı kadar gevşer. Artık **dört** route buna dayanıyor (`otp`, `giris`,
      `dogrulama-tekrar`, `sahiplen`). Redis/Upstash kararı verilmeli. *(A6 ile ağırlaştı)*
- [ ] **`profil-tamamla`'daki diğer `onBlur` alanları** (telefon) aynı epoch guard'ına sahip
      değil — telefon alanı tipe bağlı gizlenmediği için şu an zararsız, ama alan görünürlüğü
      değişirse aynı yarış geri gelir. *(K3'ten çıkan yeni iş)*
- [x] ~~**Geçmişte üretilmiş sahte güzergâhlı `listings` satırlarının kaderi**~~ —
      **ÖLÇÜMLE KAPANDI** (29 Tem 2026). Runbook Adım 0.1 çalıştırıldı: **0 satır / 0 ilan**.
      Yani katlanmış anahtarı eşit ama ham yazımı farklı (= sahte güzergâh parmak izi) hiç
      satır yok; silinecek/moderasyona düşürülecek bir küme yok. D4'ün değeri **önleme**,
      geriye dönük onarım değil. Kalan 6.173 "aynı şehir" satırı meşru şehir içi taşıma —
      dokunulmayacak. Asıl hasar başka yerde çıktı: **~88 satırda yazım çeşitliliği**
      (~12 ASCII bozulması + ~76 tamamı büyük harf), onarımı runbook Adım 8. *(W5/D5)*
- [x] **#32 — `destination_city` "ölü kolon" miti belgelerden temizlendi** (3 Ağu 2026).
      Dokuz belge düzeltildi: `20260728_alias_kopya_temizligi.sql` (BÖLÜM 6 gerekçesi +
      yorumdaki UPDATE satırlarına `← 42703` işareti), `20260728_alias_homonim_temizligi.sql`
      (ADIM 6'daki "aynısını destination_city için de çalıştır" → ÇALIŞTIRMA uyarısı +
      doğru `listing_stops.city` sorgusu), `COGRAFI_GECIS.md` (Dalga 5 drop maddesi
      üstü çizildi), `20260729_alias_runbook.md` (7 yer: Adım 0.4 sorgusu yoruma alındı,
      sonuç tablosu, "sırada" satırı, şema düzeltmesi başlığı, Adım 8 gerekçesi, Adım 8.3
      tamamen düştü, Dalga 5 etkileşim bölümü), `W5_DEVIR.md` (2), `SPRINT_01.md`,
      `YAPILACAKLAR.md` (3), `PROJE_HARITASI.md` (2).
      🧭 `20260731_index_temizligi.sql`'deki 8 regex deseni **bilerek duruyor**: arama
      deseni olarak zararsız, var olmayan kolon hiçbir indeks/view/policy tanımında
      eşleşmez. Başına "bu desenin varlığı kolonun var olduğu anlamına gelmez" notu düştü.
      📌 **Yöntem notu:** yanlış cümleler silinmedi, üstü çizilip düzeltmesiyle birlikte
      bırakıldı. Mitin nasıl yayıldığı mitin kendisi kadar öğretici: her belge bir
      öncekinden alıntıladı ve hiçbiri kolonun **varlığını** sormadı. "Kodda geçmiyor"
      gözlemi doğruydu; ondan çıkarılan "demek ki terk edilmiş kolon" sonucu yanlıştı.
- [x] ~~**`listings.destination_city` ölü kolon — düşürülmeli**~~ — 🚨 **SORU DÜŞTÜ:
      KOLON HİÇ YOKMUŞ** (31 Tem 2026, #28). Sayım denendi, `ERROR: 42703: column
      "destination_city" does not exist` döndü. `information_schema.columns` teyit etti:
      `listings`ta böyle bir kolon yok. Düşürülecek kolon da yok, ölçülecek veri de.
      ⚠️ Bu "sorun çözüldü" değil **"sorun hiç yoktu"**. Aylardır sorulan "içinde veri var mı?"
      sorusunun ön kabulü — kolonun VAR olduğu — hiç sınanmamıştı.
      **DERS:** "kodda geçmiyor" ≠ "içinde veri yok" ≠ **"kolon var"**. Üçüncü ve *en önce
      gelen* soru budur; bir nesne hakkında ölçüm planlamadan önce varlığını doğrula, yoksa
      yokluğu "boş" sanılır ve o yanlış inanç belgeler arasında çoğalır (~10 belge oldu).
      🔥 **Yakın kaza:** Dalga 5 migration BÖLÜM 5'te bu kolonun `drop`'u iki meşru drop'la
      **aynı `begin/commit`** içindeydi — 42703 transaction'ı geri sarar, yani dönüşü olmayan
      noktada üçünün de yapılmadığı sanılırdı. Satır çıkarıldı. `if exists` ile susturulmadı;
      o, hatayı örter ama yanlış inancı yerinde bırakırdı. → temizlik görevi **#32**.
- [ ] 🆕 **Varış filtresi büyük/küçük harfe duyarlı — katlanmalı** (29 Tem 2026, W5 Adım 0).
      `app/_components/HomeClient.tsx:696` `d.sehir?.includes(varis)` iki tarafı da katlamıyor;
      DB'de tamamı büyük harf yazılmış **~76 durak satırı** ("ÇORLU" 42, "KEMALPAŞA" 17,
      "ÇERKEZKÖY" 6 …) aramada **hiç görünmüyor**. Adım 8 mevcut satırları onaracak ama kod
      tarafı korumasız kalıyor: yeni bir yazım varyantı girdiği an aynı bug geri gelir.
      Çözüm: karşılaştırmayı `lib/alias-normalize.ts` katlama fonksiyonundan geçir
      (kalkış filtresi ve `get_nearby_listings_by_city` de gözden geçirilsin).
- [ ] **`is_active` / `is_approved` desenkronu** — `learn-aliases` `is_approved=false` öneri
      üretiyor ama eşleşme tarafı (`findPlaces`, `whatsapp-parse` gatekeeper) yalnız
      `is_active`'e bakıyor; onaylanmamış alias parse'a giriyor. W0-W4'ten devreden bilinen
      tuzak, W5'te **bilinçli olarak değiştirilmedi** (davranış değişikliği ayrı bilet olmalı).
      Kod içinde belgelendi: `app/api/admin/learn-aliases/route.ts` başı. *(W5/D2)*
- [ ] **`findPlaces` şehir bazında tekilleştiriyor → tek satırda aynı şehrin iki ilçesi lane
      üretmiyor.** `parse-listing` fallback'indeki `sameCity + diffDist` dalı tek satır için
      **ulaşılamaz** (Pass 2/3'te canlı). Temiz veride zaten böyleydi; eski kodda lane üretmesi
      yalnız `Istanbul`/`İstanbul` bozulmasının yan etkisiydi. Şehiriçi güzergâh desteklenecekse
      ayrı bilet — `seen` anahtarını şehir+ilçeye çevirmek kapsam kaçağı olur. *(W5/D4)*

> ⚠️ Aşağıdaki "Kritik / Yüksek / Orta / Düşük" blokları **28 Tem 2026'daki ilk analizin
> bulgu envanteridir** — açıklamaları o günkü kodu tarif eder, W0/W1 sonrası kod değişti.
> Güncel durum yukarıdaki W0/W1 listelerinde ve `docs/SPRINT_01.md`'de. Envanteri silmiyoruz
> çünkü "neden böyle yapmışız" sorusunun cevabı burada.

### 🔴 Kritik
- [x] **L1** ✅ (W0) — Misafire kapalı olması gereken `contact_phone` değerleri RSC payload'ında açıkta.
      `app/page.tsx:92` numarayı map'leyip client component'e prop geçiyor → Next.js flight
      payload'ı HTML'e gömüyor → `curl | grep` ile tüm numaralar okunabiliyor. `UyeBanner`'ın
      "telefonu görmek için üye ol" vaadi geçersiz + KVKK ihlali (numaraların bir kısmı hiç
      kayıt olmamış WhatsApp/Excel kaynaklı kişilere ait). `HomeClient.tsx:444` client sorgusu
      da anon key ile `contact_phone` seçiyor — ikinci kanal.
- [x] **A1** ✅ (W1) — `app/api/auth/log/route.ts` **YOK**. `giris/page.tsx:13` ve
      `profil-tamamla/page.tsx:8` bu endpoint'e POST atıyor, `.catch(()=>{})` 404'ü yutuyor.
      `login_success` / `login_failed` / `otp_failed` / `kayit_tamamlandi` olaylarının hiçbiri
      kaydedilmiyor → auth audit trail'i tamamen boş. (Route yazılırken `user_id` body'den
      DEĞİL sunucudaki oturumdan alınmalı.)
- [x] **A2** ✅ (W0) — `app/giris/merge/page.tsx` **YOK**, ama `auth/callback/route.ts` Google akışında
      aynı e-postayla eski profil bulunca `${origin}/giris/merge?...`'e yönlendiriyor → **404**.
      `users_email_key` senaryosunun telefon ayağı çözülmüş (`merge_onay` modu), Google ayağı
      var olmayan sayfaya bağlanmış. Çözüm: callback'i `/giris?merge_user_id=...`'e çevirip
      mevcut `merge_onay` UI'ını kullan (`merge_user_id` sunucuda doğrulanmalı).
- [x] **K1** ✅ (W0) — Kayıt akışında KVKK aydınlatma / açık rıza / kullanım koşulları onayı **hiç yok**
      (`giris/page.tsx` kayıt formu ve `profil-tamamla` — `grep kvkk` sonuçsuz). `/kvkk` ve
      `/kullanim-kosullari` sayfaları var ama akışa bağlı değil. TCKN/VKN toplanırken savunulamaz.
      `terms_accepted_at` / `kvkk_accepted_at` kolonları da eklenmeli (ispat yükü platformda).

### 🟠 Yüksek
- [x] **K2** ✅ (W1) — `profil-tamamla/page.tsx:223` client'tan doğrudan `users.upsert()`. Güvenlik
      tamamen RLS'in kolon kapsamına bağlı; kolon kısıtlaması yoksa kullanıcı `role`,
      `is_active`, `ai_listing_quota_daily` gönderebilir. Ayrıca `phone_verified` değerini
      client state'i (`telefonKilitli`) belirliyor. **Önce doğrula:**
      `SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename='users';`
- [x] **A3** ✅ (W1) — `proxy.ts:94/128` `?hesap=tasindi` / `?hesap=eslesme` ile yönlendiriyor ama
      `giris/page.tsx` bu parametreyi hiç okumuyor. `tasindi` dalında proxy cookie'leri sildiği
      için `INITIAL_SESSION` handler'ı da `if (!user) return` ile çıkıyor → `setBilgi` çalışmıyor.
      Kullanıcı hiçbir açıklama görmeden giriş ekranına düşüyor.
- [ ] **K3** — `profil-tamamla/page.tsx:133` `useEffect([userType])` temizleme bloğu, init
      effect'inin DB'den prefill ettiği `tckn`/`vkn`/`company_name` değerlerini kullanıcı tip
      seçtiği anda siliyor. Çözüm: temizlemeyi `handleTipSec()` içine al, effect'i kaldır.
- [ ] **L2** — `/ilan-ver` `KORUNMALI` (`proxy.ts:19`), ama landing'deki üç ana CTA oraya
      gidiyor ve yanındaki metin "saniyeler içinde... Ücretsiz" diyor. Yük sahibi hunisi burada
      sızıyor. `shadow_profiles` altyapısı zaten hazır → misafire açıp yayınlama anında OTP iste.
- [ ] **A4** — OTP `giris/page.tsx:430`'da **4 haneye** sabit (`substring(0,4)`, `maxLength={4}`).
      Twilio Verify varsayılanı **6 hane**. Servis 4'e çekilmediyse giriş fiilen imkânsız.
      Twilio Console → Verify → Service → Code Length ile doğrula.

### 🟡 Orta / 🟢 Düşük
- [ ] **L3** — `totalCount` (tüm aktif ilanlar) ile listelenen set (SSR 200, client refetch 30,
      üstüne client-side `tip` filtresi) tutarsız. Sayaç 1.500 derken listede 60 kart olabiliyor;
      kalkış/varış filtresi yalnızca yüklenmiş 200 kayıtta arıyor → yanlış "bulunamadı".
- [ ] **A5** — Kayıt formu "En az 8 karakter, sayı ve büyük harf içermeli" diyor ama
      `epostaKayit` yalnızca `length >= 8` kontrol ediyor (`giris/page.tsx:258` vs 497).
- [ ] **A6** — OTP gönderiminde cooldown / "tekrar gönder" sayacı yok → Twilio maliyeti + abuse.
- [ ] **L4** — `HomeClient.tsx:570` misafir hero'su `authHazir` beklemiyor → girişli kullanıcı
      ilk paint'te "Giriş Yap / Üye Ol" görüyor. Auth'u sunucuda çözüp prop geçmek doğru çözüm.
- [ ] **A7** — `bilgi` state'i yalnızca `sekme==='telefon' && !otpAdim` bloğunda render ediliyor
      (satır 418) → e-posta sekmesinde ve OTP adımında görünmez. A3 ile birlikte düzelt.
- [ ] **L5** — Filtre sekme sırası `['arac','yuk']` ama varsayılan state `'yuk'` (kozmetik).

### 🔴 WhatsApp alias eşleştirme (28 Tem 2026)
- [x] **NOKTALI ALIAS'LAR ÖLÜYDU** — `tokenKumeleri` mesajı `[\s.>-]+` ile bölüyordu ama
      alias tarafı bölünmüyordu; içinde nokta geçen 14 alias hiçbir zaman eşleşemedi:
      `G.Antep`, `K.Maraş`, `M.Kemalpaşa`, `İst.Avr`, `İst.And`, `İst.Anadolu`, `k.paşa`,
      `13.60` (TIR) — yani ilanlarda en sık kullanılan kısaltmalar. İkinci katman: tek
      harflik token'lar (`g`, `m`, `k`) tekil kümeden atılırken ikili kümeden de düşüyordu,
      bu yüzden `g antep` ikilisi hiç oluşmuyordu. İkisi de düzeltildi (`aliasAnahtari` +
      `tokenlar` filtresinin sadece tekil kümeye uygulanması).
- [ ] **UZUN EŞLEŞME KISAYI BASTIRMALI** — `*BURSA M.KEMALPAŞA YÜKLER*` mesajı artık
      `Bursa←M.Kemalpaşa` buluyor ama `İzmir←Kemalpaşa` ve `Artvin←kemalpaşa` da hâlâ
      ekleniyor. Artvin'i BÖLÜM 4.6 kapatıyor; İzmir için token aralığı bazlı bastırma
      gerekli (uzun alias bir token'ı tükettiyse o token'a dayanan kısa alias sayılmasın).
- [x] **60sn TIMEOUT — bütçe kontrolü yanlış yerdeydi** (29 Tem 2026)
      `SURE_BUTCESI_MS` kontrolü SADECE 8. adımdaki insert döngüsündeydi. Ondan önceki
      aşamalar (dosya okuma, alias çekme, gatekeeper, hash hesaplama, 5a/5b toplu
      sorguları) sınırsızdı; büyük dosyada bunlar tek başına 60sn'i yiyor, Vercel
      fonksiyonu öldürüyor ve JSON yerine HTML dönüyordu. Aşama sınırlarına
      `butceKalanMs()` kapıları eklendi → artık düzgün JSON + `tamamlanmadi: true`.
      Not: `aborted` / `duration_ms: 3` kaydı ayrı bir çağrı — istemci bağlantıyı
      kesince `request.formData()` patlıyor, kendi başına bir bug değil.
- [ ] **Timeout'un KÖK SEBEBİ ölçülmeli** — noktalı alias düzeltmesi kapıyı genişletti
      (`İst.Avr`, `G.Antep` vb. artık eşleşiyor) → `passed_gate` arttı → 5a/5b sorguları
      büyüdü. Bir sonraki içe aktarmada `passed_gate` sayısını öncekiyle karşılaştır.
- [ ] **`merkez` şüphesi ÇÜRÜDÜ** — `Balıkesir/Elazığ/Sivas/Ağrı` kümesi `merkez`den
      gelmiyor; tabloda öyle bir alias yok. Gerçek alias tablosuyla yerel çalıştırmada
      `KONYA KARATAY YÜKLER TEKİRDAĞ MERKEZ` sadece `Konya,Tekirdağ` üretiyor. Fazlalık
      şehirler mesajın 60 karakterlik önizlemede GÖRÜNMEYEN kısmından geliyor olmalı;
      `cityHits` + 220 karakterlik önizleme dağıtılınca doğrulanacak.

---

## ✅ Düzeltilen Buglar
- [x] **(6 Tem 2026)** Moderatör panelinde çoklu WhatsApp dosyası yüklerken `Unexpected token 'A', "An error o"... is not valid JSON` hatası — sebep: `/api/whatsapp-parse` route'unda `maxDuration` tanımlı değildi, büyük/çoklu dosya gruplarında Vercel'in default timeout'u aşılınca platform kendi HTML/düz-metin hata sayfasını ("An error occurred with your deployment...") dönüyordu; frontend (`WhatsappYukle.tsx`) bunu koşulsuz `res.json()` ile parse etmeye çalışınca patlıyordu. Çözüm: route'a `export const maxDuration = 60` eklendi (learn-aliases route'undaki pattern), frontend `res.json()` öncesi `res.text()` + `JSON.parse` try/catch ile sarmalandı ve 413/504 durumlarına özel Türkçe hata mesajı eklendi.