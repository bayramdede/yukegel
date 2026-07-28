# WhatsApp Import — Kod & Süreç Analizi

> Tarih: 28 Temmuz 2026
> Kapsam: `app/moderator/WhatsappYukle.tsx`, `app/api/whatsapp-parse/route.ts`,
> `supabase/functions/parse-listing/index.ts`, `app/api/admin/reprocess-no-lane/route.ts`
> Not: DB trigger'ının (`raw_posts` INSERT → `parse-listing`) SQL'i `docs/` altında bulunamadı;
> aşağıdaki bazı bulgular (özellikle B2, C4) trigger davranışının doğrulanmasını gerektiriyor.

---

## 1. Mevcut Akış

```
[Tarayıcı]  ZIP seç
   → JSZip ile aç, sadece sohbet .txt'ini çıkar (medya network'e binmez)
   → eskiIcerigiKirp(): cutoff+6sa öncesini kırp
   → 5 dosya / 15MB'lık chunk'lara böl
   → her chunk için POST /api/whatsapp-parse
        ↓
[Vercel]  parseChatTxt() → mesajlara böl
   → timestamp parse + cutoff filtresi
   → gatekeeper_sync(): blacklist / telefon / şehir / araç → score
   → SHA-256 clean_hash (paralel)
   → 3 batch sorgu: exact-dup, spam sayımı, repost adayları
   → 100'lük chunk'larla raw_posts INSERT
   → repost ise eski listing'leri kopyala
        ↓
[DB trigger] → parse-listing Edge Fn
   → cleanMessage() → 4 pass'lı lane çıkarımı (regex + alias)
   → listings + listing_stops INSERT
   → shadow_profile upsert, archived_links upsert
   → processing_status = processed | no_lane
        ↓
[audit trigger] → skor → auto_publish / pending / archived
```

Genel değerlendirme: pipeline mimarisi doğru kurgulanmış. Tarayıcıda ön-ayıklama + kırpma
zekice bir çözüm ve timeout sorununu kökünden çözmüş. Batch sorgu optimizasyonu (N+1 yerine
3 sorgu) da iyi. Aşağıdaki bulgular bu yapıyı değiştirmeyi değil, üstündeki boşlukları
kapatmayı hedefliyor.

---

## 2. Kritik Bulgular

### A1 — `/api/whatsapp-parse` tamamen yetkisiz (GÜVENLİK)

`proxy.ts` satır 10'da `/api/` açık rota olarak tanımlı ve route dosyasında hiçbir
`requireAdmin` / `requireModerator` / `getServerSupabase` kontrolü yok. Route doğrudan
`SUPABASE_SERVICE_ROLE_KEY` ile client oluşturuyor.

Sonuç: internetteki herkes bu endpoint'e uydurma bir "sohbet metni" POST'layarak
`raw_posts`'a satır yazdırabilir; trigger bunları `listings`'e çevirir; audit skoru
düşük olanlar `auto_published` olur. RLS de bypass edilmiş durumda.

`app/api/excel-import/route.ts` aynı açığa sahip.

Çözüm — `toplu-islem` route'undaki pattern'i uygula:

```ts
const ssr = await getServerSupabase();
const { data: { user } } = await ssr.auth.getUser();
if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
const { data: profil } = await ssr.from('users').select('role').eq('id', user.id).maybeSingle();
if (!['admin', 'moderator'].includes(profil?.role)) {
  return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 });
}
```

Ek olarak IP/kullanıcı bazlı basit bir rate limit (örn. 10 istek/dk) konmalı.

### A2 — Saat dilimi hatası: client ve server aynı mesajı 3 saat farklı görüyor

Hem `route.ts:206` hem `WhatsappYukle.tsx:38`:

```ts
new Date(`${isoDate}T${timePart}`)   // "2026-07-28T14:30" → YEREL saat
```

Zaman dilimi eki olmayan bu format **çalıştığı makinenin yerel saatiyle** yorumlanır.
Tarayıcı Türkiye'de (UTC+3), Vercel sunucusu UTC. Aynı mesaj iki tarafta 3 saat farklı
konumlanıyor. Sonuçları:

- `cutoff` karşılaştırması sunucuda 3 saat kayıyor — sınırdaki ilanlar sessizce eleniyor.
- `message_timestamp` DB'ye 3 saat ileri yazılıyor; radar/CRM'deki tüm zaman analizleri kayık.
- `eskiIcerigiKirp`'teki 6 saatlik güvenlik payı bu hatayı **maskeliyor**; pay düşürülürse
  veri kaybı başlar.

Çözüm: WhatsApp export'unun saat dilimini açıkça belirt ve iki tarafta aynı fonksiyonu kullan.

```ts
const TZ_OFFSET = '+03:00'; // system_config'e taşınabilir
const d = new Date(`${isoDate}T${timePart.padStart(5,'0')}:00${TZ_OFFSET}`);
```

### A3 — 12 saatlik format ve `/` ayraçlı tarihler hiç parse edilmiyor

`patternAndroid` / `patternIOS` yalnızca `dd.mm.yyyy` + 24 saat bekliyor:

```
[14.05.2026, 09:15:30] Ali: ...       ✅
[14.05.2026, 9:15:30 ÖS] Ali: ...     ❌  ("ÖS" kapanış ]'ünden önce → hiç eşleşmez
14/05/2026, 09:15 - Ali: ...          ❌  (/ ayraç desteklenmiyor)
[5/14/26, 9:15:30 AM] Ali: ...        ❌  (İngilizce iOS export'u)
```

Bu formatlardan biri gelirse dosyanın **tamamı** sessizce boşa gider — UI "0 mesaj tarandı"
der, sebep görünmez. Kullanıcının telefon dili/bölgesi WhatsApp export formatını belirlediği
için sahada karşılaşılması çok olası. `docs/PROJE_HARITASI.md` §16'daki "WhatsApp iOS format"
bug kaydı da bu ailenin bir üyesi.

Çözüm: ayraç (`.` `/` `-`), 2/4 haneli yıl, AM/PM/ÖÖ/ÖS varyantlarını kapsayan tek bir
`parseWhatsappTimestamp()` yaz, hem client hem server aynı modülden import etsin.

### A4 — Batch insert hatası tüm chunk'ı sessizce düşürüyor

`route.ts:361-365`:

```ts
const { data: inserted, error } = await supabase.from('raw_posts').insert(chunk).select('id');
if (error) {
  if (error.code !== '23505') console.error('batch insert hatası:', error.message);
  continue;    // ← 100 satırın tamamı kayboldu
}
```

100 satırlık chunk'ta **tek bir** unique violation olursa geriye kalan 99 geçerli kayıt da
yazılmıyor ve response'ta hiçbir iz kalmıyor; kullanıcı sadece düşük bir `saved_to_db` görüyor.

Çözüm:

```ts
const { data: inserted, error } = await supabase
  .from('raw_posts')
  .upsert(chunk, { onConflict: 'clean_hash,message_date', ignoreDuplicates: true })
  .select('id, clean_hash, message_date');
```

`ignoreDuplicates` sayesinde çakışan satır atlanır, kalanlar yazılır. Ayrıca response'a
`failed_chunks: number` ve `errors: string[]` alanları eklenmeli.

### A5 — Repost eşleştirmesi dizi indeksine güveniyor

`route.ts:369-378` `inserted[idx]` ↔ `meta[idx]` eşlemesi yapıyor. PostgREST insert sırasını
pratikte koruyor ama bu garanti değil; A4'teki `ignoreDuplicates` düzeltmesi uygulanınca
dönen dizi kısalacağı için **kesinlikle kayacak** ve yanlış ilanlar repost olarak kopyalanacak.

Çözüm: `.select('id, clean_hash, message_date')` ile dön, `clean_hash|message_date` anahtarıyla
map'le.

---

## 3. Veri Kalitesi Bulguları

### B1 — Sabit hat numaraları hiç yakalanmıyor

`extractPhones` yalnızca `0 5xx xxx xx xx` yakalıyor. Nakliye ilanlarında ofis numarası
(`0212...`, `0332...`) çok yaygın. `gatekeeper_sync`'te `isAd = phones.length > 0 && ...`
olduğu için sabit hatlı ilanların **tamamı** gate'ten geçemiyor — score bile hesaplanmıyor.

Çözüm: `0(2\d{2}|3\d{2}|4\d{2})` alan kodlarını da yakalayan ikinci bir regex; `contact_phone`
alanına `is_mobile` bilgisi eklenebilir.

### B2 — Repost akışında çift ilan riski

`repostListings()` yeni `raw_post` için eski listing'leri kopyalıyor. Ancak aynı `raw_post`
INSERT'i DB trigger'ını da tetikliyor ve `parse-listing` aynı metinden **yeniden** listing
üretiyor. Trigger'da `is_repost = false` koşulu yoksa her repost iki ilan doğuruyor.

Doğrulanması gereken: trigger'ın `WHEN` koşulu. Yoksa ya trigger'a `WHEN (NEW.is_repost IS NOT TRUE)`
eklenmeli ya da `repostListings` kaldırılıp iş tamamen `parse-listing`'e bırakılmalı
(ikincisi daha temiz — tek kod yolu).

Ayrıca kopyalanan ilanlar `moderation_status: 'pending'` ile açılıyor, yani her repost
moderatör kuyruğunu şişiriyor. Orijinalin durumu `approved` ise korunmalı.

### B3 — Spam sayacı yükleme içindeki tekrarları görmüyor

`phoneCountMap` sadece DB'deki son 1 saati sayıyor. Tek dosyada aynı numaradan 50 farklı
mesaj varsa 50'si de geçiyor.

Çözüm: döngü içinde sayacı artır —

```ts
if (c.phone) {
  const n = phoneCountMap.get(c.phone) || 0;
  if (n >= spamEsik) { spamEngel++; continue; }
  phoneCountMap.set(c.phone, n + 1);
}
```

### B4 — `parse-listing` idempotent değil

Fonksiyon başında `processing_status` kontrolü yok. Trigger + `reprocess-no-lane` aynı
`raw_post_id` için iki kez çalışırsa ikinci sefer de listing üretiyor.

Çözüm: `if (rawPost.processing_status === 'processed') return { skipped: true }` veya
`listings` üzerinde `unique(raw_post_id, notes)` benzeri bir kısıt.

### B5 — Hata durumunda kayıtlar `pending`'de asılı kalıyor

`parse-listing` catch bloğu 500 dönüyor ama `processing_status`'u güncellemiyor. Edge Fn
timeout / geçici DB hatası alan kayıtlar sonsuza kadar `pending` kalıyor; hiçbir yeniden
deneme mekanizması yok (`reprocess-no-lane` yalnızca `no_lane` olanları listeliyor).

Çözüm: `raw_posts`'a `retry_count int default 0` + `last_error text` kolonları; catch'te
`processing_status = 'error'` set et; `reprocess-no-lane`'i `('no_lane','error','pending')`
+ `retry_count < 3` olacak şekilde genişlet; saatlik pg_cron ile otomatik yeniden dene.

### B6 — Alias eşleştirmesinde kelime sınırı yok

`findVehicle` / `findBodyType` / `gatekeeper_sync` hepsi `norm.includes(alias)` kullanıyor:
"tır" → "tırmık", "kamyon" → "kamyonet" içinde eşleşir. Priority sıralaması riski azaltıyor
ama garanti vermiyor.

Çözüm: `new RegExp(`\\b${escapeRegex(aliasNorm)}\\b`)` veya token dizisi üzerinde eşleştirme.
Alias sayısı yüksekse önceden derlenmiş bir regex/trie cache'i performansı da iyileştirir.

### B7 — `cargo_type` hiçbir zaman doldurulmuyor

`listing_stops.cargo_type: null` sabit yazılıyor. Yük cinsi (buğday, palet, frigo yük vb.)
ne regex ne LLM ile çıkarılıyor — ilanların en ayırt edici alanı boş kalıyor. `aliases`
tablosuna `type='cargo'` eklenip `findCargo()` yazılabilir.

### B8 — `detectAdType` 6 anahtar kelimeye dayanıyor

Bu liste dışındaki her mesaj `'yuk'` sayılıyor. Araç ilanlarının önemli kısmı yük ilanı olarak
kaydediliyor olabilir. `aliases` tablosuna taşınıp SLH ile öğrenilebilir hale getirilmeli.

---

## 4. Mimari & Süreç Bulguları

### C1 — "LLM parse" adı yanıltıcı; gerçekte LLM yok

`parse-listing/index.ts` içinde hiçbir Anthropic çağrısı yok — tamamen regex + alias.
`edgeLog('INFO', 'LLM parse tamamlandı', ...)` ve `PROJE_HARITASI.md` §11'deki "regex + LLM"
ifadesi gerçeği yansıtmıyor. Bu, `no_lane` oranının neden yüksek olduğunun da açıklaması.

Öneri: kademeli fallback kur —
1. Regex/alias (mevcut, ücretsiz, hızlı)
2. Lane bulunamazsa ve `quality_score ≥ 50` ise Haiku'ya gönder (`/api/parse-text`'teki
   prompt tekrar kullanılabilir)
3. Günlük LLM bütçesi `system_config`'e (`llm.whatsapp_daily_budget`) bağlansın

Bu, `no_lane` kuyruğunu doğrudan gelire çevirir. Log mesajı da düzeltilmeli.

### C2 — Edge Function'da N+1 insert

Her listing ve her stop ayrı `await`. 10 lane'li bir mesajda ~20 sıralı round-trip.
Tek `insert([...])` ile listing'leri toplu yaz, dönen id'lerle stop'ları tek seferde yaz.
`repostListings` için de aynısı geçerli.

### C3 — `archived_links` fire-and-forget Edge'de güvenilir değil

`.then(()=>{}).catch(()=>{})` — Deno Deploy response döndükten sonra pending promise'i
iptal edebilir. `EdgeRuntime.waitUntil(promise)` kullanılmalı, yoksa link havuzu sessizce
veri kaybediyor.

### C4 — Trigger'ın 100'lük batch INSERT ile etkileşimi

`raw_posts`'a 100 satır tek transaction'da yazılıyor. Trigger `pg_net` ile asenkron çağrı
yapıyorsa sorun yok; senkron `http` extension kullanıyorsa 100 edge çağrısı transaction
içinde sıraya girer ve statement timeout'a kadar kilit tutar. Trigger tanımı doğrulanmalı.

### C5 — Grup adı klasör modunda tek isme çöküyor

Frontend her chunk'ta `grupAdi || 'Bilinmiyor'` gönderiyor, dolayısıyla sunucudaki
`files[0].name`'den türetme fallback'i **hiç çalışmıyor**. 20 farklı WhatsApp grubunu klasör
modunda yüklerken hepsi tek `source_group` altında toplanıyor — CRM, radar ve moderatör
kaynak filtresi için değerli bir sinyal kayboluyor.

Çözüm: `group_name` gönderimini opsiyonel yap; boşsa sunucu her dosyanın kendi adından
türetsin ve `source_group`'u dosya bazında yazsın (`fileContents` zaten dosya adını taşıyor,
`Candidate`'e `sourceGroup` alanı eklemek yeterli).

### C6 — Bir chunk hata alınca kalan tüm gruplar iptal

`WhatsappYukle.tsx:164,169,181` — `break`. 10 gruptan 3.'si 504 alırsa 4-10 hiç denenmiyor.
`continue` + `basarisizGruplar[]` toplayıp sonuçta gösterilmeli; ayrıca 504/5xx için
1 kez otomatik retry (küçük backoff) makul.

### C7 — Debug log sınırsız büyüyor

Her mesaj için `debugLog.push(...)`. 50 bin mesajlı bir export'ta response birkaç MB'a
çıkıyor, üstelik frontend yalnızca ilk 60'ı gösteriyor. Sunucuda son 500 satır + sayaç
özeti (`{skip_cutoff: 12040, skip_gate: 3200, ...}`) dönmek yeterli.

### C8 — Hazırlık aşaması tek thread, ilerleme göstergesi yok

`for (const f of dosyalar) await dosyaHazirla(f)` — sıralı. JSZip main thread'de çalıştığı
için 20 dosyalık klasörde arayüz donuyor ve buton sadece "📦 Medya ayıklanıyor..." diyor.

Çözüm: `hazirlaniyor` yerine `{ current, total }` state'i; ideal olarak JSZip'i bir Web
Worker'a taşı.

### C9 — Kod tekrarı: aynı parser iki yerde elle senkronize tutuluyor

`TS_ANDROID` / `TS_IOS` regex'leri, timestamp çözme ve dosya adı temizleme mantığı hem
`WhatsappYukle.tsx` hem `route.ts` içinde ayrı ayrı yazılmış (dosya adı temizleme birinde
`replace(string)`, diğerinde `replace(regex)` — `.ZIP` uzantısında davranış farklı).
İkisi ayrışırsa A2/A3 gibi hatalar sessizce doğar.

Çözüm: `lib/whatsapp/chatParser.ts` altında ortak modül — `parseWhatsappTimestamp`,
`TS_PATTERNS`, `parseChatTxt`, `temizleDosyaAdi`. Her iki taraf da buradan import etsin.

### C10 — Structured logging ve import telemetrisi yok

`lib/logger.ts` mevcut ve `excel-import`, `parse-text`, `toplu-islem` bunu kullanıyor;
`whatsapp-parse` kullanmıyor (`console.error` + catch'te log yok). Ayrıca hangi grubun ne
zaman kaç ilan getirdiği hiçbir yerde saklanmıyor.

Çözüm: `import_runs` tablosu — `id, source_group, user_id, file_count, total_messages,
saved, skipped, spam_blocked, reposted, duration_ms, error, created_at`. Bu tablo hem
moderatöre "hangi grup verimli" görünürlüğü verir hem de A3 gibi sessiz format hatalarını
(0 mesaj + 0 kayıt) anında görünür kılar.

### C11 — Otomasyon yok

Süreç tamamen manuel: moderatör ZIP indirip yüklüyor. Rekabet avantajı tazelikte olduğu için
orta vadede WhatsApp Business API / `whatsapp-web.js` tabanlı bir dinleyici ile grupların
canlı akışa bağlanması değerlendirilmeli (KVKK ve grup kuralları açısından ayrı bir
değerlendirme gerektirir).

### C12 — Test yok

`parseChatTxt` ve `parseMessage` bu sistemin kalbi ve tamamen regex tabanlı — yani sessizce
bozulmaya en açık kısım. En az 20 gerçek mesaj örneğinden (farklı tarih formatları, çoklu
varış, blok yapısı, fancy font, emoji ayraç) oluşan bir fixture seti + `vitest` snapshot
testi, ileriki her değişikliği güvenli hale getirir.

---

## 5. Öncelik Sırası

| # | Bulgu | Etki | Efor |
|---|---|---|---|
| 1 | A1 — Endpoint yetkisiz (whatsapp-parse + excel-import) | Kritik güvenlik | ~30 dk |
| 2 | A4 — Chunk insert sessiz veri kaybı | Veri kaybı | ~30 dk |
| 3 | A3 — Desteklenmeyen tarih formatları | Sessiz tam kayıp | ~2 sa |
| 4 | A2 — Saat dilimi kayması | Yanlış veri + kayıp | ~1 sa |
| 5 | B2 — Repost çift ilan | Veri kirliliği | doğrulama + ~1 sa |
| 6 | A5 — Repost indeks eşleşmesi | A4 sonrası kritik | ~30 dk |
| 7 | B5 — Zombi `pending` + retry yok | Sessiz kayıp | ~2 sa |
| 8 | B1 — Sabit hat numaraları | Kaçırılan ilan | ~30 dk |
| 9 | B3 — Intra-batch spam sayacı | Kalite | ~15 dk |
| 10 | C5 — Grup adı kaybı | Analitik kaybı | ~1 sa |
| 11 | C1 — LLM fallback (no_lane kurtarma) | Yüksek getiri | ~4 sa |
| 12 | C9 — Ortak parser modülü | Bakım | ~2 sa |
| 13 | C10 — `import_runs` telemetrisi | Görünürlük | ~2 sa |
| 14 | C12 — Parser testleri | Güvenlik ağı | ~3 sa |

İlk 6 madde tek bir sprint'te kapatılabilir ve sistemin en büyük risklerini ortadan kaldırır.
