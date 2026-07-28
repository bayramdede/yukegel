import { parseChatTxt, zamanDamgasiCoz, mesajBasligiCoz, eskiIcerigiKirp, grupAdiTuret } from '../chatParser';

let gecti = 0, kaldi = 0;
function esit(ad: string, a: unknown, b: unknown) {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  if (ok) { gecti++; console.log(`  ok  ${ad}`); }
  else { kaldi++; console.log(`  FAIL ${ad}\n       beklenen: ${JSON.stringify(b)}\n       gelen:    ${JSON.stringify(a)}`); }
}

console.log('\n--- Zaman damgasi formatlari ---');
const c = (s: string) => { const r = zamanDamgasiCoz(s); return r ? r.tarih.toISOString() + '|' + r.yerelTarih : null; };
esit('TR 24s nokta',        c('14.05.2026 09:15:30'), '2026-05-14T06:15:30.000Z|2026-05-14');
esit('TR 24s saniyesiz',    c('14.05.2026 09:15'),    '2026-05-14T06:15:00.000Z|2026-05-14');
esit('TR 12s OS (PM)',      c('14.05.2026 9:15 ÖS'),  '2026-05-14T18:15:00.000Z|2026-05-14');
esit('TR 12s OO (AM)',      c('14.05.2026 9:15 ÖÖ'),  '2026-05-14T06:15:00.000Z|2026-05-14');
esit('TR 12s 12 OO -> 00',  c('14.05.2026 12:05 ÖÖ'), '2026-05-13T21:05:00.000Z|2026-05-14');
esit('EN-US M/G/YY + PM',   c('5/14/26 9:15:30 PM'),  '2026-05-14T18:15:30.000Z|2026-05-14');
esit('EN-GB G/A/YYYY',      c('14/05/2026 09:15'),    '2026-05-14T06:15:00.000Z|2026-05-14');
esit('Tire ayrac',          c('14-05-2026 09:15'),    '2026-05-14T06:15:00.000Z|2026-05-14');
esit('Gun>12 belirsizlik',  c('25/03/2026 09:15'),    '2026-03-25T06:15:00.000Z|2026-03-25');
esit('Gecersiz ay',         c('14.19.2026 09:15'),    null);
esit('Cop girdi',           c('abc'),                 null);

console.log('\n--- Saat dilimi: makine TZ etkilemiyor ---');
const oncekiTZ = process.env.TZ;
const ref = c('14.05.2026 09:15');
process.env.TZ = 'America/New_York';
esit('TZ degisse de ayni', c('14.05.2026 09:15'), ref);
process.env.TZ = oncekiTZ;

console.log('\n--- Mesaj basligi tanima ---');
const b = (s: string) => { const r = mesajBasligiCoz(s); return r ? `${r.hamZaman}|${r.sender}|${r.metin}` : null; };
esit('iOS koseli',    b('[14.05.2026, 09:15:30] Ali Veli: Konya Istanbul tir'), '14.05.2026 09:15:30|Ali Veli|Konya Istanbul tir');
esit('iOS OS',        b('[14.05.2026, 9:15:30 ÖS] Ali: mesaj'),                 '14.05.2026 9:15:30 ÖS|Ali|mesaj');
esit('iOS dar bosluk',b('[5/14/26, 9:15:30 AM] Ali: mesaj'),               '5/14/26 9:15:30 AM|Ali|mesaj');
esit('Android tire',  b('14.05.2026, 09:15 - Ali: mesaj'),                      '14.05.2026 09:15|Ali|mesaj');
esit('Android slash', b('14/05/2026, 09:15 - Ali: mesaj'),                      '14/05/2026 09:15|Ali|mesaj');
esit('Devam satiri',  b('  ikinci satir devam'),                                null);
esit('Saat iceren metin', b('yarin 14:00 de yukleme var'),                      null);

console.log('\n--- parseChatTxt ---');
const sohbet = [
  '[14.05.2026, 09:15:30] Ali: Konya dan Istanbul a 20 ton bugday',
  'tir lazim 0532 111 22 33',
  '[14.05.2026, 09:16:00] Veli: Mesajlar ve aramalar uctan uca sifrelidir',
  '[14.05.2026, 09:17:00] Ayse: ok',
  '[14.05.2026, 09:18:00] Can: Ankara Izmir bos tir var 0533 222 33 44',
].join('\n');
const r1 = parseChatTxt(sohbet);
esit('mesaj sayisi (sistem+kisa elendi)', r1.mesajlar.length, 2);
esit('cok satirli birlesti', r1.mesajlar[0].message.includes('tir lazim'), true);
esit('cozulemeyen yok', r1.cozulemeyenZaman, 0);
esit('yerel tarih', r1.mesajlar[0].yerelTarih, '2026-05-14');

console.log('\n--- ESKI parser bunlari kaciriyordu ---');
const eskiFormatlar = [
  '[14.05.2026, 9:15:30 ÖS] Ali: Konya dan Istanbul a yuk var 0532 111 22 33',
  '14/05/2026, 09:15 - Veli: Ankara Izmir bos tir 0533 222 33 44',
  '[5/14/26, 9:15:30 AM] Can: Bursa Adana frigo lazim 0534 333 44 55',
].join('\n');
esit('3 format da parse edildi', parseChatTxt(eskiFormatlar).mesajlar.length, 3);
const ESKI_ANDROID = /^\[(\d{1,2}\.\d{1,2}\.\d{4}[,\s]\d{1,2}:\d{1,2}(?::\d{1,2})?)\]\s(.+?):\s(.*)$/;
const ESKI_IOS = /^(\d{1,2}\.\d{1,2}\.\d{4}[,\s]\d{1,2}:\d{1,2})\s?-\s(.+?):\s(.*)$/;
const eskiSayi = eskiFormatlar.split('\n').filter(l => ESKI_ANDROID.test(l) || ESKI_IOS.test(l)).length;
esit('eski parser kacirdi (regresyon kaniti)', eskiSayi, 0);

console.log('\n--- eskiIcerigiKirp ---');
const p = (d: Date) => `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}, ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:00`;
const simdi = new Date();
const eski = new Date(simdi.getTime() - 200 * 3600_000);
const yeni = new Date(simdi.getTime() - 1 * 3600_000);
const karisik = [
  `[${p(eski)}] Ali: cok eski mesaj atilmali`,
  `[${p(yeni)}] Veli: yeni mesaj kalmali`,
].join('\n');
const kirpik = eskiIcerigiKirp(karisik, 48);
esit('eski atildi', kirpik.includes('cok eski'), false);
esit('yeni kaldi', kirpik.includes('yeni mesaj'), true);

console.log('\n--- grupAdiTuret ---');
esit('zip uzantisi', grupAdiTuret('WhatsApp Chat - Nakliye TR.zip'), 'Nakliye TR');
esit('buyuk harf uzanti', grupAdiTuret('Sohbet.ZIP'), 'Sohbet');

console.log(`\n=== ${gecti} gecti, ${kaldi} kaldi ===`);
process.exit(kaldi > 0 ? 1 : 0);
