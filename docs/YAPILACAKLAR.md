# Yükegel — Yapılacaklar Listesi

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
> 🚨 **ASIL BULGU — ADIM 10 YARIM UYGULANMIŞ (#43).**
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
> altı örnekte de `true`. `tsc --noEmit` temiz. **Deploy bekliyor.**
> 📄 Veri onarımı: `docs/20260804_u0307_alias_onarimi.sql` (yedek → 24 pasifleştir
> → 10 onar → homoglif → 5 doğrulama sorgusu + geri alma). **Çalıştırılmadı.**
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
> 🚨 **#41 — `processed_at` KOLONUNU HİÇBİR ŞEY YAZMIYORMUŞ. ⏳ KOD HAZIR, DEPLOY BEKLİYOR.**
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
> ⚠️ Bu hüküm **yalnız şema tarafı**. Uygulama tarafında **#24**
> (`learn-aliases`:437) hâlâ metin kolonuna yazıyor — çevrilmeden drop edilirse
> `42703`. Sıra değişmedi: #21 (7 Ağu) → #24 → drop.
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
> ⏳ **`docs/20260731_districts_tablosu.sql` YAZILDI (31 Tem 2026) — ÇALIŞTIRILMADI.**
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
- [x] **A11 — "AI Keşfi Başlat" her seferinde timeout** ✅ kod tarafı tamam (31 Tem 2026) — **deploy bekliyor**
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