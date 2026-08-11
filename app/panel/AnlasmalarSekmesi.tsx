'use client';
import React, { useState } from 'react';
import { ilAdi } from '../../lib/lokasyon';
import { C, inp, lbl, btn } from './panelStil';

/**
 * ANLAŞMALARIM SEKMESİ — Güvenli Etkileşim Faz 2 (10 Ağu 2026)
 *
 * `POST /api/deals` (talep), `PATCH /api/deals/[id]` (durum geçişleri) ve
 * `POST /api/reviews` (çift kör değerlendirme) 22/22 test geçerek hazır
 * bekliyordu — bu dosya onların İLK ekranı. Buton görünürlüğü sunucudaki
 * "🚨 YETKİ TABLOSU"nun (`app/api/deals/[id]/route.ts`) BİREBİR aynası:
 *   onayla / reddet : YALNIZ shipper
 *   yola_cikti      : YALNIZ carrier
 *   tamamla         : İKİ TARAF (biri beyan eder, diğeri onaylar)
 *   iptal           : İKİ TARAF (tamamlanmadan önce)
 * Burada göstermek yetki VERMEZ — sunucu her istekte yeniden doğruluyor;
 * amaç yalnız kullanıcıya boşa buton göstermemek (bkz. PanelClient'taki
 * `duzenlenebilir` yorumuyla aynı desen).
 *
 * "Bu İşi Al" (talep OLUŞTURMA) burada YOK — o `/ilan/[id]` sayfasında
 * (`Aksiyonlar.tsx`), çünkü talep başka birinin ilanına açılır; panel yalnız
 * KENDİ ilanlarını listeler.
 */

interface Props {
  anlasmalar: any[];
  yorumlarim: any[];
  userId: string;
}

type DurumFiltre = 'hepsi' | 'requested' | 'matched' | 'in_transit' | 'completed' | 'cancelled';

const DURUM_LABEL: Record<string, string> = {
  hepsi: 'Tümü',
  requested: '⏳ Talep Bekliyor',
  matched: '🤝 Mühürlendi',
  in_transit: '🚚 Yolda',
  completed: '✅ Tamamlandı',
  cancelled: '✖ İptal',
};

const DURUM_RENK: Record<string, { bg: string; color: string }> = {
  hepsi: { bg: C.surface, color: C.muted },
  requested: { bg: '#2d1a00', color: C.amber },
  matched: { bg: C.blueBg, color: C.blue },
  in_transit: { bg: C.blueBg, color: C.blue },
  completed: { bg: C.greenBg, color: '#86efac' },
  cancelled: { bg: '#2d0a0a', color: C.red },
};

const DURUM_SIRASI: DurumFiltre[] = ['hepsi', 'requested', 'matched', 'in_transit', 'completed', 'cancelled'];

// Sunucudaki `ALT_KRITERLER` beyaz listesinin BİREBİR aynası — anahtarlar
// uyuşmazsa `api/reviews` o kriteri sessizce atar (bkz. `altKriterleriAyikla`).
const ALT_KRITERLER: Record<'shipper' | 'carrier', { key: string; label: string }[]> = {
  shipper: [
    { key: 'zamanindalik', label: 'Zamanında Teslimat' },
    { key: 'mal_guvenligi', label: 'Mal Güvenliği' },
    { key: 'iletisim', label: 'İletişim' },
  ],
  carrier: [
    { key: 'odeme_guvenligi', label: 'Ödeme Güvenilirliği' },
    { key: 'tesis_kalitesi', label: 'Tesis Kalitesi' },
    { key: 'bilgi_dogrulugu', label: 'Bilgi Doğruluğu' },
  ],
};

function tarihFmt(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function DurumBadge({ durum }: { durum: string }) {
  const r = DURUM_RENK[durum] || DURUM_RENK.hepsi;
  return <span style={{ background: r.bg, color: r.color, fontSize: '0.72rem', fontWeight: 700, padding: '3px 8px', borderRadius: 4 }}>{DURUM_LABEL[durum] || durum}</span>;
}

function Yildizlar({ value, onChange, size = '1.5rem' }: { value: number; onChange: (n: number) => void; size?: string }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange(n)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: size, padding: 0, lineHeight: 1, color: n <= value ? '#f59e0b' : C.border }}>
          ★
        </button>
      ))}
    </div>
  );
}

export default function AnlasmalarSekmesi({ anlasmalar: ilk, yorumlarim: ilkYorumlar, userId }: Props) {
  const [anlasmalar, setAnlasmalar] = useState(ilk);
  const [yorumlarim, setYorumlarim] = useState(ilkYorumlar);
  const [yukleniyor, setYukleniyor] = useState<string | null>(null);
  const [hatalar, setHatalar] = useState<Record<string, string>>({});
  const [onayBekleyen, setOnayBekleyen] = useState<{ id: string; action: 'reddet' | 'iptal' } | null>(null);
  const [onayNeden, setOnayNeden] = useState('');
  const [yorumAcikId, setYorumAcikId] = useState<string | null>(null);
  const [durumFiltre, setDurumFiltre] = useState<DurumFiltre>('hepsi');

  function guncelle(id: string, patch: any) {
    setAnlasmalar(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d));
  }

  function hataGoster(id: string, msg: string) {
    setHatalar(prev => ({ ...prev, [id]: msg }));
    setTimeout(() => setHatalar(prev => { const n = { ...prev }; delete n[id]; return n; }), 6000);
  }

  async function aksiyon(id: string, action: string, cancel_reason?: string) {
    setYukleniyor(id + '_' + action);
    try {
      const res = await fetch(`/api/deals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...(cancel_reason ? { cancel_reason } : {}) }),
      });
      const d = await res.json();
      if (res.ok) {
        // Sunucu yanıtı `cancelled_at`/`cancel_reason` DÖNMÜYOR (route'un
        // seçtiği kolonlarda yok) — gösterim için burada tamamlıyoruz.
        const ekstra = (action === 'reddet' || action === 'iptal')
          ? { cancel_reason: cancel_reason || null, cancelled_by: userId, cancelled_at: new Date().toISOString() }
          : {};
        guncelle(id, { ...d.deal, ...ekstra });
      } else {
        hataGoster(id, d.error || 'İşlem yapılamadı.');
      }
    } catch (e: any) {
      hataGoster(id, e.message || 'Bir hata oluştu.');
    }
    setYukleniyor(null);
    setOnayBekleyen(null);
    setOnayNeden('');
  }

  function yorumEkle(review: any) {
    setYorumlarim(prev => [...prev, review]);
    setYorumAcikId(null);
  }

  const sayilar: Record<DurumFiltre, number> = {
    hepsi: anlasmalar.length,
    requested: anlasmalar.filter(d => d.status === 'requested').length,
    matched: anlasmalar.filter(d => d.status === 'matched').length,
    in_transit: anlasmalar.filter(d => d.status === 'in_transit').length,
    completed: anlasmalar.filter(d => d.status === 'completed').length,
    cancelled: anlasmalar.filter(d => d.status === 'cancelled').length,
  };

  const filtreli = durumFiltre === 'hepsi' ? anlasmalar : anlasmalar.filter(d => d.status === durumFiltre);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {DURUM_SIRASI.filter(s => s === 'hepsi' || sayilar[s] > 0).map(s => (
          <button key={s} onClick={() => setDurumFiltre(s)}
            style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${durumFiltre === s ? DURUM_RENK[s].color : C.border}`, background: durumFiltre === s ? DURUM_RENK[s].bg : 'none', color: durumFiltre === s ? DURUM_RENK[s].color : C.muted, fontSize: '0.78rem', fontWeight: durumFiltre === s ? 700 : 400, cursor: 'pointer' }}>
            {DURUM_LABEL[s]} <span style={{ opacity: 0.65 }}>{sayilar[s]}</span>
          </button>
        ))}
      </div>

      {filtreli.length === 0 ? (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 40, textAlign: 'center', color: C.dim }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>🤝</div>
          <div>{anlasmalar.length === 0 ? 'Henüz bir anlaşmanız yok.' : 'Bu filtrede kayıt yok.'}</div>
          {anlasmalar.length === 0 && (
            <div style={{ color: C.dim, fontSize: '0.8rem', marginTop: 6 }}>
              Bir ilana &ldquo;Bu İşi Al&rdquo; ile talep gönderdiğinizde veya kendi ilanınıza talep geldiğinde burada görünür.
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtreli.map(deal => (
            <AnlasmaKarti
              key={deal.id}
              deal={deal}
              userId={userId}
              yukleniyor={yukleniyor}
              hata={hatalar[deal.id]}
              onAksiyon={aksiyon}
              onayBekleyen={onayBekleyen}
              setOnayBekleyen={setOnayBekleyen}
              onayNeden={onayNeden}
              setOnayNeden={setOnayNeden}
              yorumAcik={yorumAcikId === deal.id}
              setYorumAcik={(acik: boolean) => setYorumAcikId(acik ? deal.id : null)}
              mevcutYorum={yorumlarim.find(r => r.deal_id === deal.id) || null}
              onYorumGonderildi={yorumEkle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TEK ANLAŞMA KARTI
// ═══════════════════════════════════════════════════════════════════
function AnlasmaKarti({
  deal, userId, yukleniyor, hata, onAksiyon,
  onayBekleyen, setOnayBekleyen, onayNeden, setOnayNeden,
  yorumAcik, setYorumAcik, mevcutYorum, onYorumGonderildi,
}: {
  deal: any; userId: string; yukleniyor: string | null; hata?: string;
  onAksiyon: (id: string, action: string, cancel_reason?: string) => void;
  onayBekleyen: { id: string; action: 'reddet' | 'iptal' } | null;
  setOnayBekleyen: (v: { id: string; action: 'reddet' | 'iptal' } | null) => void;
  onayNeden: string; setOnayNeden: (v: string) => void;
  yorumAcik: boolean; setYorumAcik: (v: boolean) => void;
  mevcutYorum: any; onYorumGonderildi: (r: any) => void;
}) {
  const isShipper = deal.shipper_id === userId;
  const isCarrier = deal.carrier_id === userId;
  const karsiTaraf = isShipper ? deal.carrier?.display_name : deal.shipper?.display_name;

  const ilan = deal.listing;
  const kalkis = ilan ? (ilAdi(ilan.origin_province_id) ?? '') : '';
  const stops = [...(ilan?.listing_stops || [])].sort((a: any, b: any) => a.stop_order - b.stop_order);
  const sonDurak = stops[stops.length - 1];
  const varis = sonDurak ? (ilAdi(sonDurak.province_id) ?? '') : '';
  const baslik = kalkis || varis ? `${kalkis}${varis ? ` → ${varis}` : ''}` : 'İlan';

  const isYukluyor = (action: string) => yukleniyor === deal.id + '_' + action;

  const benDeclared = deal.completed_declared_by === userId;
  const digerDeclared = !!deal.completed_declared_by && deal.completed_declared_by !== userId;

  const confirmAcik = onayBekleyen?.id === deal.id;

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ color: C.text, fontWeight: 700 }}>{baslik}</span>
            <DurumBadge durum={deal.status} />
          </div>
          <div style={{ color: C.dim, fontSize: '0.75rem' }}>
            {isShipper ? '📦 Siz ilan sahibisiniz' : '🚛 Siz nakliyecisiniz'}
            {karsiTaraf ? ` · Karşı taraf: ${karsiTaraf}` : ''}
            {ilan?.id && <> · <a href={`/ilan/${ilan.id}`} style={{ color: C.dim }}>İlanı gör</a></>}
          </div>
        </div>
        <div style={{ color: C.dim, fontSize: '0.72rem', textAlign: 'right' as const }}>
          Talep: {tarihFmt(deal.created_at)}
        </div>
      </div>

      {(deal.payment_terms_days !== null && deal.payment_terms_days !== undefined) && (
        <div style={{ color: C.muted, fontSize: '0.78rem' }}>
          💳 Ödeme vadesi: {deal.payment_terms_days} gün
          {deal.payment_maturity_date && <> · Vade tarihi: {tarihFmt(deal.payment_maturity_date)}</>}
        </div>
      )}

      {hata && (
        <div style={{ color: C.red, fontSize: '0.8rem', background: '#2d0a0a', border: '1px solid #7f1d1d', borderRadius: 6, padding: '6px 10px' }}>
          ⚠️ {hata}
        </div>
      )}

      {/* ── requested ── */}
      {deal.status === 'requested' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {isShipper && (
            <>
              <button onClick={() => onAksiyon(deal.id, 'onayla')} disabled={!!yukleniyor}
                style={btn('primary')}>
                {isYukluyor('onayla') ? '...' : '✅ Onayla'}
              </button>
              <button onClick={() => setOnayBekleyen({ id: deal.id, action: 'reddet' })} disabled={!!yukleniyor}
                style={btn('danger')}>
                ✖ Reddet
              </button>
            </>
          )}
          {isCarrier && (
            <>
              <span style={{ color: C.dim, fontSize: '0.8rem' }}>İlan sahibinin onayı bekleniyor.</span>
              <button onClick={() => setOnayBekleyen({ id: deal.id, action: 'iptal' })} disabled={!!yukleniyor}
                style={btn('ghost')}>
                Talebi Geri Çek
              </button>
            </>
          )}
        </div>
      )}

      {/* ── matched / in_transit ── */}
      {(deal.status === 'matched' || deal.status === 'in_transit') && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {deal.status === 'matched' && isCarrier && (
            <button onClick={() => onAksiyon(deal.id, 'yola_cikti')} disabled={!!yukleniyor} style={btn('secondary')}>
              {isYukluyor('yola_cikti') ? '...' : '🚚 Yola Çıktı'}
            </button>
          )}
          {!deal.completed_declared_by && (
            <button onClick={() => onAksiyon(deal.id, 'tamamla')} disabled={!!yukleniyor}
              style={{ ...btn('secondary'), border: `1px solid ${C.greenBg}`, color: C.green }}>
              {isYukluyor('tamamla') ? '...' : '✅ İşi Tamamla'}
            </button>
          )}
          {benDeclared && (
            <span style={{ color: C.amber, fontSize: '0.8rem' }}>
              Tamamlandı beyanınız alındı — karşı tarafın onayı bekleniyor.
            </span>
          )}
          {digerDeclared && (
            <button onClick={() => onAksiyon(deal.id, 'tamamla')} disabled={!!yukleniyor} style={btn('primary')}>
              {isYukluyor('tamamla') ? '...' : '✅ Onayla ve Tamamla'}
            </button>
          )}
          <button onClick={() => setOnayBekleyen({ id: deal.id, action: 'iptal' })} disabled={!!yukleniyor}
            style={{ ...btn('ghost'), color: C.red }}>
            İptal Et
          </button>
        </div>
      )}

      {/* ── iptal / reddet onay kutusu ── */}
      {confirmAcik && (
        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ color: C.text, fontSize: '0.82rem', fontWeight: 600 }}>
            {onayBekleyen?.action === 'reddet' ? 'Bu talebi reddetmek istediğinize emin misiniz?' : 'Anlaşmayı iptal etmek istediğinize emin misiniz?'}
          </div>
          <textarea value={onayNeden} onChange={e => setOnayNeden(e.target.value)} rows={2}
            placeholder="Neden (opsiyonel)" style={{ ...inp, resize: 'vertical' as const }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => onAksiyon(deal.id, onayBekleyen!.action, onayNeden.trim() || undefined)} disabled={!!yukleniyor}
              style={btn('danger')}>
              {yukleniyor ? '...' : 'Evet, Onayla'}
            </button>
            <button onClick={() => { setOnayBekleyen(null); setOnayNeden(''); }} style={btn('ghost')}>Vazgeç</button>
          </div>
        </div>
      )}

      {/* ── completed: değerlendirme ── */}
      {deal.status === 'completed' && (
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, marginTop: 4 }}>
          <div style={{ color: C.dim, fontSize: '0.75rem', marginBottom: 8 }}>
            Tamamlandı: {tarihFmt(deal.completed_at)}
            {deal.review_deadline && <> · Değerlendirme son tarihi: {tarihFmt(deal.review_deadline)}</>}
          </div>
          {mevcutYorum ? (
            <div style={{ color: C.green, fontSize: '0.82rem' }}>
              ✓ Değerlendirmeniz gönderildi ({mevcutYorum.rating}/5)
              {mevcutYorum.published_at
                ? ' — yayınlandı.'
                : ' — karşı taraf yazdığında (veya 14 gün sonunda) yayınlanacak.'}
            </div>
          ) : yorumAcik ? (
            <YorumFormu deal={deal} rol={isShipper ? 'shipper' : 'carrier'} onGonderildi={onYorumGonderildi} onVazgec={() => setYorumAcik(false)} />
          ) : (
            <button onClick={() => setYorumAcik(true)} style={btn('amber')}>⭐ Değerlendirme Yaz</button>
          )}
        </div>
      )}

      {/* ── cancelled ── */}
      {deal.status === 'cancelled' && (
        <div style={{ color: C.dim, fontSize: '0.8rem' }}>
          {tarihFmt(deal.cancelled_at)} tarihinde iptal edildi.
          {deal.cancel_reason && <div style={{ marginTop: 2 }}>Neden: {deal.cancel_reason}</div>}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DEĞERLENDİRME FORMU — rol bazlı alt kriterler (PRD md.3)
// ═══════════════════════════════════════════════════════════════════
function YorumFormu({ deal, rol, onGonderildi, onVazgec }: {
  deal: any; rol: 'shipper' | 'carrier'; onGonderildi: (r: any) => void; onVazgec: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [subRatings, setSubRatings] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [sonuc, setSonuc] = useState<{ ok: boolean; mesaj: string } | null>(null);

  async function gonder() {
    if (rating < 1) { setSonuc({ ok: false, mesaj: 'Lütfen genel bir puan seçin.' }); return; }
    setGonderiliyor(true); setSonuc(null);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deal_id: deal.id,
          rating,
          sub_ratings: subRatings,
          ...(comment.trim() ? { comment: comment.trim() } : {}),
        }),
      });
      const d = await res.json();
      if (res.ok) {
        setSonuc({ ok: true, mesaj: d.mesaj });
        onGonderildi({
          id: d.review_id, deal_id: deal.id, rating,
          comment: comment.trim() || null,
          published_at: d.yayinlandi ? new Date().toISOString() : null,
        });
      } else {
        setSonuc({ ok: false, mesaj: d.error || 'Değerlendirme kaydedilemedi.' });
      }
    } catch (e: any) {
      setSonuc({ ok: false, mesaj: e.message || 'Bir hata oluştu.' });
    }
    setGonderiliyor(false);
  }

  if (sonuc?.ok) {
    return <div style={{ color: C.green, fontSize: '0.85rem', fontWeight: 600 }}>✅ {sonuc.mesaj}</div>;
  }

  return (
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label style={lbl}>Genel Puan *</label>
        <Yildizlar value={rating} onChange={setRating} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ALT_KRITERLER[rol].map(k => (
          <div key={k.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ color: C.muted, fontSize: '0.82rem' }}>{k.label}</span>
            <Yildizlar value={subRatings[k.key] || 0} size="1.1rem"
              onChange={n => setSubRatings(prev => ({ ...prev, [k.key]: n }))} />
          </div>
        ))}
      </div>

      <div>
        <label style={lbl}>Yorum (opsiyonel)</label>
        <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} maxLength={2000}
          placeholder="Deneyiminizi paylaşın..." style={{ ...inp, resize: 'vertical' as const }} />
      </div>

      {sonuc && !sonuc.ok && (
        <div style={{ color: C.red, fontSize: '0.8rem' }}>⚠️ {sonuc.mesaj}</div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={gonder} disabled={gonderiliyor} style={btn('primary')}>
          {gonderiliyor ? 'Gönderiliyor...' : 'Değerlendirmeyi Gönder'}
        </button>
        <button onClick={onVazgec} style={btn('ghost')}>Vazgeç</button>
      </div>

      <div style={{ color: C.dim, fontSize: '0.7rem' }}>
        Değerlendirmeniz, karşı taraf da yazdığında (veya 14 gün sonunda) karşılıklı olarak yayınlanır.
      </div>
    </div>
  );
}
