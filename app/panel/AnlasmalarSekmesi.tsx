'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '../../lib/supabase';
import { ilAdi } from '../../lib/lokasyon';
import { C, inp, lbl, btn } from './panelStil';

const supabase = createClient();

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

// 11 Ağu 2026 — mühürlenmiş (matched/in_transit) bir kaydı iptal ederken
// ZORUNLU tür seçimi. Sunucudaki (`app/api/deals/[id]/route.ts`) `cancel_type`
// dallanmasının BİREBİR aynası: 'anlasma' → ilan tekrar `active`e döner,
// 'is' → `listings` `passive` kalır (bkz. route'taki uzun açıklama).
const IPTAL_TURLERI: { deger: 'anlasma' | 'is'; baslik: string; aciklama: string; nedenler: string[] }[] = [
  {
    deger: 'anlasma', baslik: '🤝 Anlaşma İptali',
    aciklama: 'İş hâlâ geçerli — ilan tekrar yayına döner, başka bir nakliyeci talep edebilir.',
    nedenler: ['Araç gelmedi / zamanında gelmedi', 'Karşı taraf yanıt vermiyor', 'Şartlarda anlaşamadık', 'Diğer'],
  },
  {
    deger: 'is', baslik: '📦 İş İptali',
    aciklama: 'Yükün/işin kendisi ortadan kalktı — ilan yayından kalkar.',
    nedenler: ['Yük artık taşınmayacak', 'İş başka şekilde çözüldü', 'Diğer'],
  },
];

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

function telefonFmt(digits: string): string {
  const onlu = digits.length > 10 ? digits.slice(-10) : digits.replace(/^0/, '');
  if (onlu.length === 10) return `0${onlu.slice(0, 3)} ${onlu.slice(3, 6)} ${onlu.slice(6, 8)} ${onlu.slice(8, 10)}`;
  return digits;
}

function DurumBadge({ durum }: { durum: string }) {
  const r = DURUM_RENK[durum] || DURUM_RENK.hepsi;
  return <span style={{ background: r.bg, color: r.color, fontSize: '0.72rem', fontWeight: 700, padding: '3px 8px', borderRadius: 4 }}>{DURUM_LABEL[durum] || durum}</span>;
}

// 11 Ağu 2026 — "işi onaylarken/verirken karşı tarafın profiline bakabilelim"
// isteği: karşı tarafın adı artık `/u/[id]` profiline linkli, yanında da
// yayınlanmış yorumlardan türeyen bir rozet var. Rozet İCAT bir skor DEĞİL —
// `/u/[username]`teki `DegerlendirmelerKarti` ile AYNI ham veriden (ortalama +
// sayı), yalnız karar anına (bu karta) taşınmış hâli. Veri yoksa rozet hiç
// basılmıyor — "0 değerlendirme" göstermek yanlış bir sinyal olurdu.
function ProfilRozeti({ ortalama, sayi }: { ortalama: number; sayi: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#2d1a00', color: '#f59e0b', fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px', borderRadius: 10, whiteSpace: 'nowrap' as const }}>
      ⭐ {ortalama.toFixed(1)} <span style={{ opacity: 0.7, fontWeight: 500 }}>({sayi})</span>
    </span>
  );
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
  const [digerMetin, setDigerMetin] = useState('');
  const [cancelType, setCancelType] = useState<'anlasma' | 'is' | ''>('');
  const [yorumAcikId, setYorumAcikId] = useState<string | null>(null);
  const [durumFiltre, setDurumFiltre] = useState<DurumFiltre>('hepsi');
  const [rozetler, setRozetler] = useState<Record<string, { ortalama: number; sayi: number }>>({});

  // Karşı tarafların profil rozetleri — tek toplu sorguda. RLS zaten yalnız
  // yayınlanmış+gizlenmemiş satırları döndürür (`reviews_yayinlanan_herkese`),
  // istemci ekstra filtre YAZMIYOR — `/u/[username]`teki desenin aynısı.
  useEffect(() => {
    const idler = new Set<string>();
    anlasmalar.forEach(d => {
      const karsiId = d.shipper_id === userId ? d.carrier_id : d.shipper_id;
      if (karsiId) idler.add(karsiId);
    });
    // Boşsa (kart yok) hiç sorgu atma — eski `rozetler` zaten hiçbir kartta
    // GÖRÜNMÜYOR (üstteki liste boşsa kart render edilmiyor), sıfırlamaya
    // gerek yok; senkron `setState` de effect linter'ını gereksiz tetiklemesin.
    if (idler.size === 0) return;
    supabase.from('reviews').select('reviewee_id, rating').in('reviewee_id', Array.from(idler))
      .then((res: any) => {
        const gruplar: Record<string, number[]> = {};
        (res.data || []).forEach((r: any) => { (gruplar[r.reviewee_id] ||= []).push(r.rating); });
        const sonuc: Record<string, { ortalama: number; sayi: number }> = {};
        Object.entries(gruplar).forEach(([id, puanlar]) => {
          sonuc[id] = { ortalama: puanlar.reduce((a, b) => a + b, 0) / puanlar.length, sayi: puanlar.length };
        });
        setRozetler(sonuc);
      });
  }, [anlasmalar, userId]);

  function guncelle(id: string, patch: any) {
    setAnlasmalar(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d));
  }

  function hataGoster(id: string, msg: string) {
    setHatalar(prev => ({ ...prev, [id]: msg }));
    setTimeout(() => setHatalar(prev => { const n = { ...prev }; delete n[id]; return n; }), 6000);
  }

  function onayTemizle() {
    setOnayBekleyen(null); setOnayNeden(''); setDigerMetin(''); setCancelType('');
  }

  async function aksiyon(id: string, action: string, cancel_reason?: string, cancel_type?: 'anlasma' | 'is') {
    setYukleniyor(id + '_' + action);
    try {
      const res = await fetch(`/api/deals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...(cancel_reason ? { cancel_reason } : {}), ...(cancel_type ? { cancel_type } : {}) }),
      });
      const d = await res.json();
      if (res.ok) {
        // Sunucu yanıtı artık `cancelled_at`/`cancel_type`/`cancel_reason`'ı
        // KENDİSİ döndürüyor (route güncellendi) — burada tekrar ETMİYORUZ,
        // tek doğruluk kaynağı sunucu yanıtı.
        guncelle(id, d.deal);
      } else {
        hataGoster(id, d.error || 'İşlem yapılamadı.');
      }
    } catch (e: any) {
      hataGoster(id, e.message || 'Bir hata oluştu.');
    }
    setYukleniyor(null);
    onayTemizle();
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
              onayTemizle={onayTemizle}
              onayNeden={onayNeden}
              setOnayNeden={setOnayNeden}
              digerMetin={digerMetin}
              setDigerMetin={setDigerMetin}
              cancelType={cancelType}
              setCancelType={setCancelType}
              yorumAcik={yorumAcikId === deal.id}
              setYorumAcik={(acik: boolean) => setYorumAcikId(acik ? deal.id : null)}
              mevcutYorum={yorumlarim.find(r => r.deal_id === deal.id) || null}
              onYorumGonderildi={yorumEkle}
              rozetler={rozetler}
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
  onayBekleyen, setOnayBekleyen, onayTemizle, onayNeden, setOnayNeden,
  digerMetin, setDigerMetin, cancelType, setCancelType,
  yorumAcik, setYorumAcik, mevcutYorum, onYorumGonderildi, rozetler,
}: {
  deal: any; userId: string; yukleniyor: string | null; hata?: string;
  onAksiyon: (id: string, action: string, cancel_reason?: string, cancel_type?: 'anlasma' | 'is') => void;
  onayBekleyen: { id: string; action: 'reddet' | 'iptal' } | null;
  setOnayBekleyen: (v: { id: string; action: 'reddet' | 'iptal' } | null) => void;
  onayTemizle: () => void;
  onayNeden: string; setOnayNeden: (v: string) => void;
  digerMetin: string; setDigerMetin: (v: string) => void;
  cancelType: 'anlasma' | 'is' | ''; setCancelType: (v: 'anlasma' | 'is' | '') => void;
  yorumAcik: boolean; setYorumAcik: (v: boolean) => void;
  mevcutYorum: any; onYorumGonderildi: (r: any) => void;
  rozetler: Record<string, { ortalama: number; sayi: number }>;
}) {
  const isShipper = deal.shipper_id === userId;
  const isCarrier = deal.carrier_id === userId;
  const karsiTarafId: string | null = isShipper ? deal.carrier_id : deal.shipper_id;
  const karsiTaraf = isShipper ? deal.carrier?.display_name : deal.shipper?.display_name;
  const karsiRozet = karsiTarafId ? rozetler[karsiTarafId] : undefined;
  // Telefon: server tarafından yalnız eşleşmiş deal'lerde ve onay verilmişse gönderilir
  const karsiTelefonHam: string | null = isShipper ? deal.carrier_phone : deal.shipper_phone;
  const karsiTelefon = karsiTelefonHam?.replace(/\D/g, '') || null;

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
          <div style={{ color: C.dim, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span>{isShipper ? '📦 Siz ilan sahibisiniz' : '🚛 Siz nakliyecisiniz'}</span>
            {/* 11 Ağu 2026 — "işi onaylarken/verirken karşı tarafın profiline
                bakabilelim" isteği: isim artık `/u/[id]` profiline linkli +
                yanında yayınlanmış yorumlardan türeyen rozet (varsa). Karar
                anında (onayla/tamamla/iptal butonlarının hemen üstünde)
                göründüğü için ayrıca aramaya gerek kalmıyor. */}
            {karsiTaraf && karsiTarafId && (
              <>
                <span>· Karşı taraf:</span>
                <a href={`/u/${karsiTarafId}`} target="_blank" rel="noopener noreferrer"
                  style={{ color: C.blue, fontWeight: 600, textDecoration: 'none' }}>
                  {karsiTaraf} ↗
                </a>
                {karsiRozet && <ProfilRozeti ortalama={karsiRozet.ortalama} sayi={karsiRozet.sayi} />}
                {karsiTelefon && (
                  <a href={`tel:${karsiTelefon.startsWith('90') ? `+${karsiTelefon}` : `+90${karsiTelefon.replace(/^0/, '')}`}`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#0d2b1a', border: '1px solid #166534', color: '#4ade80', fontSize: '0.7rem', fontWeight: 700, padding: '2px 10px', borderRadius: 10, textDecoration: 'none', whiteSpace: 'nowrap' as const }}>
                    📞 {telefonFmt(karsiTelefon)}
                  </a>
                )}
                {isShipper && !karsiTelefon && !deal.carrier_phone_consent && ['matched', 'in_transit', 'completed'].includes(deal.status) && (
                  <span style={{ color: C.dim, fontSize: '0.68rem' }}>· Bu nakliyeci telefon numarasını paylaşmadı</span>
                )}
              </>
            )}
            {ilan?.id && <> · <a href={`/ilan/${ilan.id}`} style={{ color: C.dim }}>İlanı gör</a></>}
            {isCarrier && !deal.carrier_phone_consent && ['matched', 'in_transit'].includes(deal.status) && (
              <span style={{ color: C.dim, fontSize: '0.68rem' }}>· Telefon numaranızı talep sırasında paylaşmadınız</span>
            )}
          </div>
        </div>
        <div style={{ color: C.dim, fontSize: '0.72rem', textAlign: 'right' as const }}>
          Talep: {tarihFmt(deal.created_at)}
        </div>
      </div>

      {/* Anlaşma Şartları — 11 Ağu 2026, talep ekranına eklenen fiyat + not.
          Taraflar "neye onay verdiğini" görsün diye durumdan BAĞIMSIZ, tek
          kutuda: rakam, not, vade. Onaylama/reddetme kararı bu kutuya bakarak
          verilir — sunucu doğrulaması `agreed_price`'ı zaten zorunlu kılıyor,
          eski kayıtlarda (migration öncesi) yalnız yoksa satır basılmaz. */}
      {(deal.agreed_price !== null && deal.agreed_price !== undefined
        || deal.note
        || (deal.payment_terms_days !== null && deal.payment_terms_days !== undefined)) && (
        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ color: C.dim, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>
            Anlaşma Şartları
          </div>
          {(deal.agreed_price !== null && deal.agreed_price !== undefined) && (
            <div style={{ color: C.green, fontWeight: 700, fontSize: '0.95rem' }}>
              ₺{Number(deal.agreed_price).toLocaleString('tr-TR')}
            </div>
          )}
          {(deal.payment_terms_days !== null && deal.payment_terms_days !== undefined) && (
            <div style={{ color: C.muted, fontSize: '0.78rem' }}>
              💳 Ödeme vadesi: {deal.payment_terms_days} gün
              {deal.payment_maturity_date && <> · Vade tarihi: {tarihFmt(deal.payment_maturity_date)}</>}
            </div>
          )}
          {deal.note && (
            <div style={{ color: C.muted, fontSize: '0.78rem', whiteSpace: 'pre-wrap' as const }}>
              📝 {deal.note}
            </div>
          )}
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

      {/* ── iptal / reddet onay kutusu ──
          11 Ağu 2026 — ZATEN MÜHÜRLENMİŞ (matched/in_transit) bir kaydı iptal
          ederken tür seçimi ZORUNLU (bkz. route'taki bug notu: bu seçim
          olmadan ilan sonsuza kadar yayından düşük kalıyordu). 'reddet' ve
          'requested' durumunda iptal (henüz listings hiç dokunulmadı) için
          eski basit serbest-metin akış AYNEN kalıyor. */}
      {confirmAcik && (() => {
        const turSecimiGerekli = onayBekleyen!.action === 'iptal' && ['matched', 'in_transit'].includes(deal.status);
        // 🚨 11 Ağu 2026 — Bayram: "teklif veren sadece anlaşmayı iptal edebilir,
        // yükü iptal edemez." Sunucudaki (`app/api/deals/[id]/route.ts`)
        // `cancel_type==='is' && !isShipper` reddinin BİREBİR aynası — burada
        // göstermek yetki VERMEZ, yalnız nakliyeciye seçemeyeceği bir seçeneği
        // hiç göstermemek için.
        const izinliIptalTurleri = isShipper ? IPTAL_TURLERI : IPTAL_TURLERI.filter(t => t.deger === 'anlasma');
        const nihaiNeden = onayNeden === 'Diğer' ? digerMetin.trim() : onayNeden;
        const gonderilebilir = !turSecimiGerekli || (cancelType && nihaiNeden);
        return (
          <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ color: C.text, fontSize: '0.82rem', fontWeight: 600 }}>
              {onayBekleyen!.action === 'reddet' ? 'Bu talebi reddetmek istediğinize emin misiniz?'
                : turSecimiGerekli ? 'Bu anlaşmayı neden iptal ediyorsunuz?'
                : 'Talebi geri çekmek istediğinize emin misiniz?'}
            </div>

            {turSecimiGerekli ? (
              <>
                {!isShipper && (
                  <div style={{ color: C.dim, fontSize: '0.72rem' }}>
                    Yükün kendisini yalnız ilan sahibi iptal edebilir — siz yalnız anlaşmayı iptal edebilirsiniz.
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {izinliIptalTurleri.map(t => (
                    <label key={t.deger} onClick={() => { setCancelType(t.deger); setOnayNeden(''); setDigerMetin(''); }}
                      style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', padding: 10, borderRadius: 6, border: `1px solid ${cancelType === t.deger ? C.blue : C.border}`, background: cancelType === t.deger ? C.blueBg : 'transparent' }}>
                      <input type="radio" checked={cancelType === t.deger} onChange={() => { setCancelType(t.deger); setOnayNeden(''); setDigerMetin(''); }} style={{ marginTop: 3 }} />
                      <div>
                        <div style={{ color: C.text, fontWeight: 700, fontSize: '0.85rem' }}>{t.baslik}</div>
                        <div style={{ color: C.dim, fontSize: '0.75rem', marginTop: 2 }}>{t.aciklama}</div>
                      </div>
                    </label>
                  ))}
                </div>
                {cancelType && (
                  <select value={onayNeden} onChange={e => setOnayNeden(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                    <option value="">Neden seçin...</option>
                    {izinliIptalTurleri.find(t => t.deger === cancelType)!.nedenler.map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                )}
                {onayNeden === 'Diğer' && (
                  <textarea value={digerMetin} onChange={e => setDigerMetin(e.target.value)} rows={2}
                    placeholder="Detay yazın..." style={{ ...inp, resize: 'vertical' as const }} />
                )}
              </>
            ) : (
              <textarea value={onayNeden} onChange={e => setOnayNeden(e.target.value)} rows={2}
                placeholder="Neden (opsiyonel)" style={{ ...inp, resize: 'vertical' as const }} />
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => onAksiyon(deal.id, onayBekleyen!.action, nihaiNeden.trim() || undefined, turSecimiGerekli ? (cancelType as 'anlasma' | 'is') : undefined)}
                disabled={!!yukleniyor || !gonderilebilir}
                style={{ ...btn('danger'), opacity: gonderilebilir ? 1 : 0.5, cursor: gonderilebilir ? 'pointer' : 'not-allowed' }}>
                {yukleniyor ? '...' : 'Evet, Onayla'}
              </button>
              <button onClick={onayTemizle} style={btn('ghost')}>Vazgeç</button>
            </div>
          </div>
        );
      })()}

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
          {deal.cancel_type === 'anlasma' && <div style={{ marginTop: 2, color: C.blue }}>🤝 Anlaşma iptali — ilan tekrar yayına döndü.</div>}
          {deal.cancel_type === 'is' && <div style={{ marginTop: 2 }}>📦 İş iptali — ilan yayından kalktı.</div>}
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
