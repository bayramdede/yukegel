import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, getServiceSupabase } from '../../../../lib/auth';
import { getAuditThresholds } from '../../../../lib/auditLimits';
import { getConfigs } from '../../../../lib/config';
import { metniDenetle } from '../../../../lib/metin-denetim';
import { MAX_NOT, MAX_FIYAT, sayiAralik, bugunISO } from '../../../../lib/ilan-yaz';
import { ARAC_TIPI_SETI, UTSYAPI_SETI } from '../../../../lib/ilan-sabitler';

/**
 * 8 Ağu 2026 — bu rota ARTIK yalnız "moderatör düzeltme istedi" akışı değil,
 * kullanıcının KENDİ ilanını düzenleme yolu ("İlanlarım'da düzeltme şansı olsun").
 *
 * ⚠️ DÜZENLENEBİLİR DURUMLAR bilinçli olarak dar:
 *   ✅ correction_needed — moderatör düzeltme istedi (eski tek dal)
 *   ✅ pending           — inceleme sırasında düzeltmek meşru
 *   ✅ approved / auto_published — yayındaki ilanı düzeltmek en sık ihtiyaç
 *   ❌ rejected          — moderatör REDDETTİ; düzenleyip tekrar sokmak
 *                          moderasyon kararını istemciden delmek olur
 *   ❌ archived          — süresi geçmiş, düzenlenmez
 *   ❌ completed_at dolu — iş tamamlanmış, geçmiş kayıt
 */
const DUZENLENEBILIR_MODERASYON = new Set([
  'correction_needed', 'pending', 'approved', 'auto_published',
]);

/** Beyaz liste dışını sessizce atar. Alan dizisi ise en fazla bu kadar eleman. */
function tipListesi(v: unknown, beyazListe: ReadonlySet<string>, max = 12): string[] | undefined {
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) return [];
  const temiz: string[] = [];
  for (const t of v) {
    if (typeof t === 'string' && beyazListe.has(t) && !temiz.includes(t)) temiz.push(t);
    if (temiz.length >= max) break;
  }
  return temiz;
}

export async function POST(req: NextRequest) {
  try {
    // ── Auth: kullanıcı oturumu
    const ssrClient = await getServerSupabase();
    const { data: { user } } = await ssrClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Giriş gerekli' }, { status: 401 });

    const govde = await req.json();
    const { id, notes, vehicle_type, body_type,
            price_offer, price_negotiable, available_date, date_flexible,
            is_recurring, recurring_until } = govde;
    if (!id) return NextResponse.json({ error: 'İlan ID gerekli' }, { status: 400 });

    const svc = getServiceSupabase();

    // ── İlanı çek ve sahiplik kontrolü
    const { data: ilan, error: ilanErr } = await svc
      .from('listings')
      // 20 Ağu 2026 — `raw_text` artık raw_post_id'li satırlarda `listings`e
      // yazılmıyor; `metniDenetle()` aşağıda (güvenlik taraması) ham metni
      // GÖRMEZDEN gelmesin diye `raw_posts` embed'i eklendi.
      .select('id, user_id, moderation_status, status, completed_at, is_shadow_banned, notes, raw_text, raw_post_id, raw_posts:raw_post_id ( raw_text ), vehicle_type, body_type, price_offer, price_negotiable, available_date, date_flexible, is_recurring, recurring_until')
      .eq('id', id)
      .single();

    if (ilanErr || !ilan) return NextResponse.json({ error: 'İlan bulunamadı' }, { status: 404 });
    if (ilan.user_id !== user.id) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 });
    if (ilan.completed_at) {
      return NextResponse.json({ error: 'Tamamlanmış ilan düzenlenemez.' }, { status: 400 });
    }
    if (!DUZENLENEBILIR_MODERASYON.has(ilan.moderation_status)) {
      return NextResponse.json({
        error: ilan.moderation_status === 'rejected'
          ? 'Reddedilen ilan düzenlenemez. Yeni ilan oluşturabilirsiniz.'
          : 'Bu ilan düzenlenemez.',
      }, { status: 400 });
    }

    // ── Alan doğrulama ────────────────────────────────────────────────────
    // 🚨 `vehicle_type`/`body_type` eskiden DOĞRULANMADAN geçiyordu
    //    (`vehicle_type ?? ilan.vehicle_type`) — istemci bu dizilere herhangi bir
    //    metni, herhangi bir uzunlukta yazabiliyordu. `lib/ilan-yaz.ts` yazma
    //    yolunda bu setlerle beyaz listeliyor; burada atlanmıştı.
    const yeniVehicle = tipListesi(vehicle_type, ARAC_TIPI_SETI);
    const yeniBody    = tipListesi(body_type, UTSYAPI_SETI);

    const yeniFiyat = price_offer === undefined
      ? undefined
      : (price_offer === null || price_offer === '' ? null : sayiAralik(price_offer, 0, MAX_FIYAT));
    if (price_offer !== undefined && price_offer !== null && price_offer !== '' && yeniFiyat === null) {
      return NextResponse.json({ error: 'Geçersiz fiyat.' }, { status: 400 });
    }

    let yeniTarih: string | undefined;
    if (available_date !== undefined) {
      if (typeof available_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(available_date)) {
        return NextResponse.json({ error: 'Geçerli bir tarih seçin.' }, { status: 400 });
      }
      // ⚠️ "Geçmiş tarih" kontrolü YALNIZ tarih DEĞİŞTİYSE. Eski bir ilanın
      //    tarihi çoktan geçmiş olabilir; kullanıcı sadece notunu düzeltmek
      //    isterken aynı tarihi geri gönderdiğinde onu kilitlemek yanlış olurdu.
      if (available_date !== ilan.available_date && available_date < bugunISO()) {
        return NextResponse.json({ error: 'Geçmiş bir tarih seçilemez.' }, { status: 400 });
      }
      yeniTarih = available_date;
    }

    // ── Sürekli Yük (20 Ağu 2026) — İlanlarım düzenleme formundan aç/kapa +
    // bitiş tarihi değiştirme. `duzeltAc()` mevcut değerleri dolduruyor,
    // `is_recurring`/`recurring_until` GÖNDERİLMEZSE (undefined) mevcut
    // değer korunur — diğer tüm alanlarla aynı "yalnız gönderilen alan
    // yazılır" sözleşmesi.
    let yeniIsRecurring: boolean | undefined;
    let yeniRecurringUntil: string | null | undefined;
    let yeniRecurringConfirmedAt: string | undefined;
    if (is_recurring !== undefined) {
      yeniIsRecurring = Boolean(is_recurring);
      if (!yeniIsRecurring) {
        // Durdurma — her zaman serbest.
        yeniRecurringUntil = null;
      } else {
        const hedefTarih = typeof recurring_until === 'string' ? recurring_until : null;
        if (!hedefTarih || !/^\d{4}-\d{2}-\d{2}$/.test(hedefTarih)) {
          return NextResponse.json({ error: 'Sürekli Yük için bitiş tarihi seçin.' }, { status: 400 });
        }
        const bugun = bugunISO();
        const referansTarih = yeniTarih ?? ilan.available_date ?? bugun;
        if (hedefTarih <= referansTarih) {
          return NextResponse.json({ error: 'Sürekli Yük bitiş tarihi, yükleme tarihinden sonra olmalı.' }, { status: 400 });
        }
        const cfg = await getConfigs(
          ['recurring_max_days', 'max_recurring_per_user'],
          { recurring_max_days: '365', max_recurring_per_user: '3' },
        );
        const maxGun = parseInt(cfg.recurring_max_days, 10) || 365;
        const tavanTarih = new Date(Date.now() + 3 * 60 * 60 * 1000 + maxGun * 86400_000).toISOString().split('T')[0];
        if (hedefTarih > tavanTarih) {
          return NextResponse.json({ error: `Sürekli Yük bitiş tarihi en fazla ${maxGun} gün ileri olabilir.` }, { status: 400 });
        }
        // Tavan sayımı: yalnız bu ilan ZATEN sürekli değilken sayılır — bu
        // ilanın kendisi zaten sayılıyorsa (tarihini değiştiriyor) tekrar
        // saymak onu kendi kotasına takar.
        if (!ilan.is_recurring) {
          const maxAktif = parseInt(cfg.max_recurring_per_user, 10) || 3;
          const { count: aktifSayisi } = await svc
            .from('listings')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('is_recurring', true);
          if ((aktifSayisi ?? 0) >= maxAktif) {
            return NextResponse.json({ error: `En fazla ${maxAktif} aktif Sürekli Yük ilanınız olabilir.` }, { status: 400 });
          }
        }
        yeniRecurringUntil = hedefTarih;
        // Kullanıcı bilinçli olarak işaretleyip tarih seçti — bu bir onay
        // sayılır, "7 günde bir onay" sayacı burada da sıfırlanır.
        yeniRecurringConfirmedAt = new Date().toISOString();
      }
    }

    // ── Metni tara — 🚨 10 Ağu 2026: BU BLOK `lib/metin-denetim.ts`E TAŞINDI.
    // Buradaki gömülü kopya `safety_rules` desenlerini `new RegExp(pattern)` ile
    // derliyordu; desenler POSTGRES sözdizimiyle `(?i)` satır içi bayrak taşıdığı
    // için JavaScript'te "Invalid group" atıyor ve `catch {}` SESSİZCE atlıyordu.
    // Sonuç: 10 kuralın 8'i (silah/uyuşturucu, göçmen, ağır küfür, 5607
    // kaçakçılık, kapora/IBAN, belgesiz nakliye, kaba dil, sosyal medya) bu
    // yolda HİÇ ÇALIŞMIYORDU — yani kullanıcı ilanını DÜZENLEYEREK denetimi
    // atlatabiliyordu. Ayrıntı ve kapsam: `lib/metin-denetim.ts` başı.
    const yeniNotes = (notes ?? ilan.notes ?? '').trim();
    // ⚠️ Ayrım ŞART: `applies_to='user_text'` kuralları (whatsapp) yalnız
    //    kullanıcının yazdığı nota uygulanır, ilanın kazındığı ham mesaja DEĞİL.
    // `ilan.raw_text` boşsa (raw_post_id'li satır) embed edilen
    // `raw_posts.raw_text`e düş — bkz. yukarıdaki select notu.
    const kaynakMetin = ilan.raw_text ?? (ilan as any).raw_posts?.raw_text ?? null;
    const denetim = await metniDenetle(
      { kullanici: yeniNotes, kaynakMetin }, 'user_correction');
    const score = denetim.skor;
    const firedRules = denetim.atesLenen;

    // ── Eşikleri DB'den oku (admin'in /admin/sistem-ayarlari'ndan değiştirebildiği değerler)
    const { autoPublishScoreMax, rejectScoreMin } = await getAuditThresholds();

    // ── Sonuca göre güncelle
    let yeniModerasyon: string;
    let yeniStatus: string;
    let yeniShadow: boolean;
    let mesaj: string;

    // Zaten moderasyondan geçmiş (yayına girmiş) bir ilan mı?
    // ⚠️ Bu ayrım `status` için ŞART: kullanıcı ilanını BİLEREK "Pasif Yap"
    //    demiş olabilir. Temiz bir düzenlemede körlemesine `active` yazmak onun
    //    kararını sessizce geri alır — ilan istemediği hâlde yayına döner.
    //    correction_needed/pending'de ise `passive` moderasyonun koyduğu bir
    //    durumdur; orada `active`e çıkmak DOĞRU.
    const oncedenYayinda = ilan.moderation_status === 'approved'
                        || ilan.moderation_status === 'auto_published';

    if (score < autoPublishScoreMax) {
      // Temiz → otomatik yayına al
      yeniModerasyon = 'approved';
      yeniStatus     = oncedenYayinda ? ilan.status : 'active';
      yeniShadow     = false;
      mesaj = oncedenYayinda
        ? 'İlanınız güncellendi.'
        : 'İlanınız güncellendi ve yayına alındı.';
    } else if (score < rejectScoreMin) {
      // Orta risk → moderatör kuyruğuna geri gönder
      yeniModerasyon = 'pending';
      yeniStatus     = 'passive';
      yeniShadow     = false;
      // 🟡 SARI BAYRAK (Bayram'ın 10 Ağu kararı): ihlal YALNIZ iletişim
      // kategorisindeyse ilan KAPATILMIYOR ve kullanıcıya ne olduğu AÇIKÇA
      // söyleniyor. Genel "incelemeye gönderildi" mesajı kullanıcıya neyi
      // düzeltmesi gerektiğini anlatmıyordu.
      mesaj = denetim.yalnizIletisim
        ? 'İlanınızdaki iletişim bilgileri güvenlik nedeniyle moderatör onayına düşmüştür. İlanınız silinmedi; onaylandığında yayına alınacak.'
        : 'İlanınız güncellendi ve moderatör incelemesine gönderildi.';
    } else {
      // Hâlâ yüksek risk → düzeltme gerekiyor
      yeniModerasyon = 'correction_needed';
      yeniStatus     = 'passive';
      yeniShadow     = true;
      mesaj = 'İlanınızda hâlâ kurallara aykırı ifadeler bulunuyor. Lütfen tekrar düzenleyin.';
    }

    // Yalnız GÖNDERİLEN alanlar yazılır — `undefined` olanlar mevcut değerini korur.
    const yama: Record<string, unknown> = {
      notes:             yeniNotes || null,
      moderation_status: yeniModerasyon,
      status:            yeniStatus,
      is_shadow_banned:  yeniShadow,
      audit_score:       score,
      internal_audit_logs: {
        score,
        fired_rules: firedRules,
        scanned_at: new Date().toISOString(),
        source: 'user_correction',
      },
      reviewed_at: yeniModerasyon === 'approved' ? new Date().toISOString() : null,
    };
    if (yeniVehicle !== undefined)       yama.vehicle_type     = yeniVehicle;
    if (yeniBody !== undefined)          yama.body_type        = yeniBody;
    if (yeniFiyat !== undefined)         yama.price_offer      = yeniFiyat;
    if (price_negotiable !== undefined)  yama.price_negotiable = Boolean(price_negotiable);
    if (yeniTarih !== undefined)         yama.available_date   = yeniTarih;
    if (date_flexible !== undefined)     yama.date_flexible    = Boolean(date_flexible);
    if (yeniIsRecurring !== undefined) {
      yama.is_recurring = yeniIsRecurring;
      yama.recurring_until = yeniRecurringUntil ?? null;
      if (yeniRecurringConfirmedAt) yama.recurring_confirmed_at = yeniRecurringConfirmedAt;
    }

    const { error: updateErr } = await svc.from('listings').update(yama).eq('id', id);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    return NextResponse.json({
      success: true,
      score,
      moderation_status: yeniModerasyon,
      status: yeniStatus,
      is_shadow_banned: yeniShadow,
      fired_rules: firedRules,
      mesaj,
      // İstemci yerel state'i bununla tazeler — böylece ekranda görünen değer
      // DB'ye YAZILAN değerdir (beyaz listeden düşen bir kasa tipi vb. ekranda
      // kalıp kullanıcıyı yanıltmaz).
      alanlar: yama,
    });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
