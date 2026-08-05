-- ============================================================================
-- #64 / #42 — RPC HATASI ALAN SATIRLARIN AKIBETİ
-- 5 Ağustos 2026
-- ============================================================================
-- KAYNAK: edge function log dökümü (200 kayıt, 176 benzersiz raw_post_id).
-- ⚠️ 200 sayısı log gezgininin limiti gibi duruyor — bu bir TABAN, toplam değil.
--
-- BULGU: `İlan oluşturulamadı (ilan_olustur)` kayıtlarının TAMAMI altyapı hatası:
--   PGRST003  108  bağlantı havuzu zaman aşımı
--   57014      79  statement timeout
--   (yok)      11  upstream timeout / connection termination
--   55P03       2  lock timeout
--   22023 / 22P02 / 23505  →  SIFIR. Yani veri veya format hatası YOK.
--
-- 👉 BU DOSYA TEK ŞEYİ ÖLÇER: bu 176 satır şimdi hangi durumda?
--    `no_lane`   = ilanın TAMAMI kayboldu (created=0)
--    `processed` = bazı grupları geçti, bazıları düştü → SESSİZ KISMİ KAYIP.
--                  Bu ikincisi daha tehlikeli: ilan var ama durakları eksik.
-- ============================================================================

-- ⚠️ `pg_temp` Supabase editöründe ifadeler arasında YAŞAMIYOR (her statement
-- ayrı oturum). Bu yüzden gerçek şema; sonda düşürülüyor.
drop schema if exists hata42 cascade;
create schema hata42;
create table hata42.hatali_id(id uuid primary key);
insert into hata42.hatali_id values
  ('0055fde5-a2bd-45e5-8ccc-e1e8ee9ff305'),
  ('006cc568-cc97-475b-8a52-a212ad585325'),
  ('018b5776-2da1-4bfb-a8d9-f8406137f4f9'),
  ('042783fe-b710-47d3-9a5f-4eec71f83fd8'),
  ('05cd18c9-e103-4feb-8f3d-f182959959bc'),
  ('0716f14c-e680-431e-b3a1-672e0deca223'),
  ('07a14e28-acad-43b6-9343-bb90a08e7462'),
  ('08bbe074-a984-4404-901f-cc001260b351'),
  ('0bf6587c-6aab-4ceb-b937-b6d050411123'),
  ('0c295d3f-1817-4016-a7cb-bc89db6f1d2a'),
  ('0da68d6e-f410-4d9a-bd3d-dd093051b2c5'),
  ('0dee12cf-c476-4baa-8ce5-885d4f755380'),
  ('0e8030ea-15b2-4353-8d6b-ebe86a3c36ec'),
  ('0fa6f538-072b-4fa6-8a50-81ebef5787b9'),
  ('1005cc4c-845c-40ce-9f19-d4eae0bf2063'),
  ('13506d56-b4c6-4980-9a69-718334225cd2'),
  ('13e118ba-e5d1-4cab-bb1e-79e3a747ce6a'),
  ('15623213-c57b-4046-bf93-49b2e8cbe632'),
  ('15d44bdf-b5a0-47c6-8988-7afb4bbb704f'),
  ('194aae96-434b-4ea6-8c6a-2b5fba663484'),
  ('19fe8761-71ab-432d-8aad-f95f4c512fb3'),
  ('1a4bfde8-a992-40fa-b9dc-d1956f748e4e'),
  ('1aa5fa2b-7755-4c86-8086-12d98e9cd685'),
  ('1bf49620-1d2d-488c-b88e-261d8c1c39d3'),
  ('20069683-e999-4ba6-a750-df4b0e351e8f'),
  ('246de5a8-ac3f-485e-889c-f0c9c51da161'),
  ('24e21c41-40b1-4407-80d7-618e0904fed0'),
  ('24ecc47d-aeb4-43b2-856c-ca849dc0b5f0'),
  ('2714063f-bce9-4a19-9382-c32201d1bd15'),
  ('2722a5bd-50c6-402c-ba26-e42e84b8c6e6'),
  ('2ba31973-4ab7-4ec9-9fe0-05e68b4aec25'),
  ('34a8f09c-abd0-48c5-8c7c-5c5e69a46f4e'),
  ('34d3944a-6828-4757-aae3-0279a6f03a05'),
  ('34d790ef-85fa-4e41-8d63-48c522de349d'),
  ('35860b86-2a71-4cd0-9f51-df6a1b1ee3d7'),
  ('361ee2ba-ff47-44e9-90e8-92ad848c51e6'),
  ('3742fc91-8210-440a-9fce-3f454d522f7b'),
  ('3999f5b8-bc90-4235-90f5-f357a02204ea'),
  ('3c69baf8-3ea3-44c0-8680-ea96e2e599e5'),
  ('3cb1fc6b-ca6a-452e-aae6-8107a13b286a'),
  ('3cc51503-483f-4ff1-873b-9b650200662c'),
  ('41767670-f3ad-4a0d-a369-bc7df6d31e25'),
  ('43f3d025-be23-498b-86a1-c84156c627f3'),
  ('442aaf9b-a473-4bb7-ba82-f7092b06072b'),
  ('446f27b8-37d2-41e3-aa48-da0f5de3c3da'),
  ('458a44f3-f197-4ec8-8f81-ac9f6313a958'),
  ('46c5b0ae-53d8-4540-b14a-3829869d59d9'),
  ('47c47ace-29e3-46cc-bf37-08a061c1944f'),
  ('49b92148-66e5-44c4-90ba-6bb6cb64e070'),
  ('4a5a2a17-5cb8-4fc5-958f-d22c12212bb5'),
  ('4bad4902-a885-4ed7-abc0-6932bdb20dfe'),
  ('4c6f502b-5df6-4533-8c6c-8effd2a1c9f1'),
  ('4cc7a1b4-2c26-4e30-bc1b-5a4e08f2bb35'),
  ('4efdcd51-e7a1-4feb-a7cc-eb9999e811a6'),
  ('51446f6d-39bf-4f37-80af-b2e66271f123'),
  ('5338ed39-511b-42c0-bd75-7e0ef73d0f4e'),
  ('57018bee-16c1-4ee6-b2f9-e0cee57fb480'),
  ('590a38aa-55ac-4460-a47e-a4ecd86860f6'),
  ('5a63792f-3203-41be-a564-ab9b808b6271'),
  ('5f9c9da6-c175-4bab-94e2-d8e5f477b7ab'),
  ('60e7b46a-a14b-41f6-ad9a-3f1e09adef27'),
  ('61861edc-e7ff-487f-9edb-8e4f1f658922'),
  ('62b438c4-5d9c-4538-9d98-f75b7e0206cd'),
  ('62ff0b9a-437d-4729-8960-f7f82428a73b'),
  ('63710aa5-24a8-4b3e-8a42-d672cc0b08cb'),
  ('63ba4e34-7144-4051-badf-843b7f706569'),
  ('661e4fa1-5385-4c7a-b085-0a44270bde87'),
  ('66fc7eac-0584-4024-810b-06df9ddaf287'),
  ('68239532-4566-4ac6-9506-0ffd3e807622'),
  ('6a193578-9cfb-4a66-822f-516e7cd1313d'),
  ('6a1bb8f1-af5b-46b6-8d59-8334ca18f933'),
  ('6a21444f-8574-41ca-9887-edc2b0ea159b'),
  ('6ee27a3f-9746-43ad-bb37-881b245fef94'),
  ('6efef8ea-684b-4c98-bbcf-6ca0b505ae39'),
  ('6f430966-5a97-443c-a166-749eacef3cad'),
  ('721e6318-f840-4682-a72c-12a21c22dfc4'),
  ('7345719a-6b30-4281-97bd-6e34b9b6c6c9'),
  ('73746926-55d4-4cdf-8486-5bcf47d36f60'),
  ('743424be-0470-454b-b7cc-d6119dcc5f28'),
  ('756da104-d463-4cc3-830f-61d977575f05'),
  ('75ec204c-2e64-4a6f-88fe-2009a7d1d527'),
  ('76fe8156-6530-4d33-aee0-e0135a33d673'),
  ('77e5bfca-29ae-40e4-b1a2-fdf690ca0686'),
  ('780ba307-d6f7-4c81-8900-80b54e8489f2'),
  ('78d5a1a1-0b6d-4e42-805f-5b799e3fe3e8'),
  ('7bd6f83f-8b22-4148-bd5d-fa91a970e5a1'),
  ('7bdea656-0414-4063-89f4-c231c18c7418'),
  ('7ca6ac8f-54f1-4b67-be14-182926ab44ad'),
  ('7f4589c4-c49e-4577-8341-824e9e2007cd'),
  ('84478b4e-6d34-4121-96a5-bd5a21cf09ef'),
  ('8487b0ae-54f2-4394-a483-90a369c93308'),
  ('86585c32-34da-4346-b341-b8fe57b68857'),
  ('86e80bf2-ffeb-4c18-b695-daa26226b33c'),
  ('88a750cb-19d7-4fe5-88b6-b0510a2bb3f1'),
  ('8c1f67a6-dc43-4053-962a-f7fb7a0d0351'),
  ('8d4dd839-18f5-4b6c-b09f-557b6987d0b4'),
  ('902f5c70-a8f9-46fc-a788-3cf5fbc412f8'),
  ('9185003f-c79f-4b77-aa18-201894bae94c'),
  ('9413a96a-7579-4985-a81a-522807928f9e'),
  ('959fbb05-5fd0-426c-8c3a-e6690100a41b'),
  ('95d74716-b480-4933-93ae-96ee51392f9c'),
  ('96b711b0-158b-4e8d-92d3-7f32094c3c65'),
  ('988c88f0-9edb-4fc2-a9fb-f0a5370762ef'),
  ('992a4628-6626-4bb9-9cd5-8373c6ba262e'),
  ('9ad33f48-67a1-43f3-8d3b-b942f90238e9'),
  ('9b0de6af-e61a-4a3c-b1ee-1655bb4f423d'),
  ('9c3a9839-630d-488b-9659-d78c2ea4a5e4'),
  ('9f2a56b7-b2d8-4b77-ad80-06322c6a4e51'),
  ('a2d582c8-8fc3-4597-8f13-5c0451225487'),
  ('a446642f-a8a5-478a-8b9b-f2879d04a715'),
  ('a63f5740-8b60-426e-a408-6234d2135835'),
  ('a7ec502f-59dd-4c6b-b36a-b9d814386872'),
  ('a8365818-13ce-428b-91e7-1e918e7ac501'),
  ('a98043e1-48f3-42f3-aeb7-cc2415061ce6'),
  ('a9c61370-1a56-45a8-a268-5b41270ca406'),
  ('a9fe2198-7479-482b-832d-6924b652015a'),
  ('ab8d2355-2d2a-42b6-849e-f155c9552161'),
  ('ae184749-125d-4163-a1ca-2cacbe36b758'),
  ('ae8d6b4d-f01e-4762-b489-dc2bef57c4cf'),
  ('b1469453-f731-4bc9-bf28-9e83dc4f1274'),
  ('b7e13c56-bead-4ad8-bacb-13affca8386a'),
  ('ba4d0a79-63b1-48b8-b239-4ba582e13866'),
  ('ba5666e8-a20b-4e44-b34b-e5b64c9bbe38'),
  ('ba585690-585a-49af-8532-6613d31154f5'),
  ('bea2b26b-6ef2-4adc-b358-2b42f04b2ac8'),
  ('c149fb12-54f0-4724-855b-5ac6e96e67fa'),
  ('c27a0f1a-e51f-4ad0-b178-97d86fce1419'),
  ('c36d8af5-a79a-4668-a07b-dd3eafc0368c'),
  ('c4ba4d6f-0350-42c4-8904-e762b3982175'),
  ('c57e423e-97c5-4bf3-9f4f-ea1605c618d5'),
  ('c8af21bb-ae48-45f6-9db5-653e01ad8fa6'),
  ('c94d9917-30bf-4b9d-bea7-3e65eb38aa08'),
  ('ca387126-f654-4410-963e-150ee24e450b'),
  ('cb5bba5d-a493-4977-8d93-96211ef370f5'),
  ('cccc7d33-1245-4328-b792-2c1e0ed63cb6'),
  ('cd2be170-3be8-4e2b-ba42-96ee5e17c4a9'),
  ('cddb5ef4-4b94-44b1-a661-d4c697d89acb'),
  ('cf46e792-22c3-454b-8cb6-ab4ccf69e874'),
  ('d183df65-6b27-4a23-9b75-3f77d9113202'),
  ('d23267d4-c4b7-410b-8d4f-d05164552d0d'),
  ('d3018c1e-50a3-491d-89b3-4425abe5f37e'),
  ('d404d50a-eb5b-43b2-968d-9b334f636343'),
  ('d45d5b28-7dc8-4ba5-8311-d196eceda8ef'),
  ('d5d14951-ceb3-4399-9d3e-147da634227d'),
  ('d74d588c-3c2d-457b-bf69-c395052a48e7'),
  ('d7ca9dd2-e086-4328-9f69-1cf9d38f92e3'),
  ('d829c2bf-1a61-44f4-9e35-f9d93ec1f5d3'),
  ('d896cefb-d4f3-4f55-ba9c-b90151e2cb9e'),
  ('d8d430c5-758d-40fd-a12d-b55d495af5da'),
  ('d924f6b4-8059-4faf-bb07-aa3496f60509'),
  ('d983ee44-bd19-488e-b104-449ac8ed98ed'),
  ('d9e0bcae-2c48-4704-b883-6d015924b541'),
  ('da7a0699-a68a-4541-bf8a-b87a64a32d68'),
  ('dbafa2ae-65f6-493f-85f8-9aba3f6f74a0'),
  ('de1f1fd7-0b03-4a1a-adeb-2de5e76aeca8'),
  ('de338050-f9c9-490e-aeb8-7846dbd61f07'),
  ('df276676-6567-415a-9eea-cb73bdea441e'),
  ('e4adfcb6-d5c8-47c1-a94e-7e555d167b9f'),
  ('e4d1f5ba-223e-4a01-85e4-b7b0d92ec5cc'),
  ('e65b3588-7525-462a-b1b8-63f700b80cf9'),
  ('e75d420c-89a5-4499-a407-844794795f4f'),
  ('e7721807-d20d-459d-9e07-6d8c936b15b0'),
  ('e867be34-8703-4ffa-b01e-86529a72febe'),
  ('edc46397-f4f5-4cfa-b7cf-28739411cf4c'),
  ('efe8de44-a461-4617-91f7-4c55b9e859cb'),
  ('f171504b-de7a-4c04-99a9-1d5e8aa23128'),
  ('f36bc0e6-a972-4577-be64-0a09654121ce'),
  ('f37f37fd-66f2-46c5-a02a-2a8a03f1a040'),
  ('f4d568e6-498d-4167-bb04-b7fc6cd14fe0'),
  ('f6f0ebc6-3c4c-4e54-8fab-a1b2ee370c20'),
  ('f821e4a5-a7b0-4a1c-ab4d-ca2a816324e1'),
  ('f9c117ba-a21d-4c70-a362-2b0961b90366'),
  ('fa796da7-1440-4dcf-9e28-e4c683c3a641'),
  ('fec9e52e-bc95-4738-bbf6-a60236e8e3bf'),
  ('ff375b75-a57f-4540-9dc5-92945845ddd6'),
  ('ff99c9da-3fe6-4899-96c1-0ea5e60af2e7');


-- ============================================================================
-- BÖLÜM 11 — Akıbet dağılımı
-- ============================================================================
select 'BÖLÜM 11 — RPC hatası alanların akıbeti' as bolum,
       r.processing_status,
       count(*) as satir
from public.raw_posts r
join hata42.hatali_id h on h.id = r.id
group by 2 order by 3 desc;


-- ============================================================================
-- BÖLÜM 11b — 👉 SESSİZ KISMİ KAYIP: `processed` damgalı ama ilanı hiç yok,
-- ya da log'daki stop_count'tan az durağı var.
-- ============================================================================
select 'BÖLÜM 11b — processed ama ilansız/eksik' as bolum,
       r.id,
       r.processing_status,
       count(distinct l.id)  as ilan_sayisi,
       count(s.id)           as durak_sayisi,
       replace(left(r.raw_text, 120), chr(10), ' ⏎ ') as metin
from public.raw_posts r
join hata42.hatali_id h on h.id = r.id
left join public.listings l      on l.raw_post_id = r.id
left join public.listing_stops s on s.listing_id  = l.id
group by 1,2,3,6
having count(distinct l.id) = 0
order by 2
limit 50;


-- ============================================================================
-- BÖLÜM 11c — Bu 176 satır, 30 günlük penceredeki damgalı `no_lane`ların
-- ne kadarını açıklıyor? (10c'de damgalı no_lane = 23 idi)
-- ============================================================================
select 'BÖLÜM 11c — kapsama' as bolum,
       count(*) filter (where r.processing_status = 'no_lane')            as no_lane_toplam,
       count(*) filter (where r.processing_status = 'no_lane'
                          and h.id is not null)                           as no_lane_rpc_hatali,
       count(*) filter (where r.processing_status = 'no_lane'
                          and h.id is null)                               as no_lane_aciklanmayan
from public.raw_posts r
left join hata42.hatali_id h on h.id = r.id
where r.processed_at is not null;


-- ============================================================================
-- BÖLÜM 11d — Havuz tükenmesi ne zaman oluyor? Log'daki patlamalar:
--   4 Ağu 05:xx (66), 4 Ağu 16-17:xx (89), 5 Ağu 09:xx (41)
-- Aynı saatlerde kaç raw_post işlendi? Eşzamanlılık mı, yavaş sorgu mu?
-- ============================================================================
select 'BÖLÜM 11d — saatlik işlenme yoğunluğu' as bolum,
       date_trunc('hour', processed_at)                        as saat,
       count(*)                                                as islenen,
       count(*) filter (where processing_status = 'no_lane')   as no_lane,
       count(*) filter (where processing_status = 'error')     as hata
from public.raw_posts
where processed_at is not null
group by 2 order by 2;


-- ============================================================================
-- BÖLÜM 12 — 🚨 ÖNCEKİ ÖLÇÜMÜMÜN İPTALİ. BURASI ÖNCE OKUNMALI.
--
-- index.ts:773-776 —
--     if (result.lanes.length === 0) {
--       await supabase.from('raw_posts')
--         .update({ processing_status: 'no_lane' }).eq('id', raw_post_id)
--       return ...
--     }
-- Bu erken dönüş `processed_at` YAZMIYOR. Kolonun tek yazıcısı :927-933 ve o
-- satırlara hiç ulaşılmıyor.
--
-- SONUÇ: "şerit hiç bulunamadı" satırlarının `processed_at`'i TANIM GEREĞİ NULL.
-- Ben temiz kesimi `processed_at is not null` diye kurdum. Yani #42'nin sınıfını
-- ÖLÇÜMDEN KENDİ ELİMLE ÇIKARDIM. BÖLÜM 10d'nin "23 satırın hepsi kova C,
-- kova_a=0" sonucu veriden değil filtremden geliyordu. Ve 447 "fosil" sayısı da
-- yanlış: içinde gerçek fosiller ile CANLI sıfır-şerit satırları karışık duruyor.
--
-- #42'nin premisi ÇÜRÜMEDİ — HİÇ SINANMADI. Aşağıdaki ayrım onu sınar:
--   #41 deploy'undan (ilk damga: 2026-08-04 06:03:16.991+00) SONRA gelen bir
--   satır bugünkü kodla işlendi. Damgası yoksa :774'ten dönmüştür → şerit yok.
-- ============================================================================
select 'BÖLÜM 12 — canlı no_lane''in gerçek ikiye ayrımı' as bolum,
       count(*)                                            as canli_no_lane,
       count(*) filter (where processed_at is null)        as serit_bulunamadi_774,
       count(*) filter (where processed_at is not null)    as serit_var_ilan_yok_930
from public.raw_posts
where processing_status = 'no_lane'
  and created_at >= timestamptz '2026-08-04 06:03:16.991+00';


-- ============================================================================
-- BÖLÜM 12b — :774'ten dönenlerin metni. #42'nin GERÇEK iş listesi bu.
-- ============================================================================
select 'BÖLÜM 12b — şerit bulunamayanlar' as bolum,
       created_at,
       replace(left(raw_text, 240), chr(10), ' ⏎ ') as metin
from public.raw_posts
where processing_status = 'no_lane'
  and processed_at is null
  and created_at >= timestamptz '2026-08-04 06:03:16.991+00'
order by created_at desc
limit 40;


-- ============================================================================
-- BÖLÜM 12c — 👉 KOVA SAYIMI, DOĞRU KESİMDE. `olcum42` şeması ayaktaysa çalışır;
-- değilse önce `20260805_no_lane_format_olcumu.sql`'i tekrar koştur.
-- BÖLÜM 4'ün 12/140/318'i bunun yerine geçer.
-- ============================================================================
select 'BÖLÜM 12c — canlı kesimde kovalar' as bolum,
       case when r.processed_at is null then ':774 şerit yok'
            else ':930 ilan yok' end                       as yol,
       count(*)                                            as satir,
       count(*) filter (where o.yer = 0)                   as kova_a,
       count(*) filter (where o.yer = 1)                   as kova_b,
       count(*) filter (where o.yer >= 2)                  as kova_c
from olcum42.olcum o
join public.raw_posts r on r.id = o.id
where o.kume = 'hedef'
  and r.created_at >= timestamptz '2026-08-04 06:03:16.991+00'
group by 2;


-- ============================================================================
-- BÖLÜM 11e — temizlik
-- ============================================================================
drop schema if exists hata42 cascade;
