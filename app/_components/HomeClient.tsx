'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '../../lib/supabase';
import { olayGonder } from '../../lib/analiz';
import { ILAN_LIMITI, ILAN_SELECT, ilanNormalize, uyeYeniMi, durakToplami } from '../../lib/ilan-liste';
// 🚨 DALGA 3 — burada eskiden 81 ilin ELLE YAZILMIŞ DÖRDÜNCÜ KOPYASI vardı.
// `lib/ilan-sabitler.ts::ILLER` ile birebir aynıydı ama hiçbir test onu
// korumuyordu: biri güncellenip diğeri unutulsa ana sayfa filtresi sessizce
// eksik il gösterecekti. Artık tek kaynak, `npm run test:lokasyon` kapsamında.
//
// 8 Ağu 2026 — dropdown DEĞERİ hâlâ `province_id` ama artık `index+1`'den DEĞİL,
// `il.id`'den DOĞRUDAN okunuyor. Eskiden "index+1 = plaka kodu" sözleşmesi
// listenin PLAKA SIRASINDA kalmasını zorunlu kılıyordu — Türkçe alfabetik göstermek
// isteseydik `i+1` yanlış id üretirdi (alfabetik sırada index+1 ≠ plaka kodu).
// `ILLER_TAM_ALFABETIK` id'yi kaydın içinde taşıdığı için bu bağımlılık artık yok.
import { ILLER_TAM_ALFABETIK as ILLER } from '../../lib/lokasyon';
import GirisLink from './GirisLink';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

const supabase = createClient();

// ilan-ver/page.tsx ile aynı listeler — statik, değişmez
const ARAC_TIPLERI_FILTRE = ['TIR', 'Kırkayak', 'Kamyon', 'Kamyonet', 'Panelvan'];
const KASA_TIPLERI_FILTRE = ['Tenteli', 'Açık Kasa', 'Kapalı Kasa', 'Frigorifik', 'Damperli', 'Lowbed', 'Liftli', 'Silo'];

const KAYNAK_ETIKET: Record<string, { label: string; bg: string; color: string }> = {
  form:     { label: 'Yükegel',     bg: '#0d2b1a', color: '#22c55e' },
  whatsapp: { label: '📱 WhatsApp', bg: '#0d2b0d', color: '#4ade80' },
  facebook: { label: '👥 Facebook', bg: '#1e3a5f', color: '#60a5fa' },
};


/**
 * SPRINT_01 L5 — "Yük / Araç" sekmesi artık URL'de yaşıyor (`/?tip=arac`).
 *
 * ESKİ HALİNİN SORUNU: sekme sadece `useState`'teydi. Sonuçları:
 *   • Araç sekmesindeki bir şoför linki WhatsApp'a yapıştırınca karşı taraf
 *     YÜK sekmesini görüyordu — "bende öyle bir şey yok" muhabbeti.
 *   • Bir ilana girip GERİ tuşuna basınca yük sekmesine düşülüyordu; kullanıcı
 *     baktığı listeyi kaybediyordu.
 *   • Sayfa yenilenince (mobilde çok sık) seçim uçuyordu.
 *
 * ⚠️ NEDEN `useSearchParams` DEĞİL: bu bileşen ISR'li bir server component'in
 *    (app/page.tsx, revalidate=30) çocuğu. `useSearchParams` Suspense sınırı
 *    olmadan kullanılınca Next TÜM ağacı client-side render'a düşürür ve ISR
 *    faydası gider. `window.location.search` mount'ta okunur — SSR HTML'i her
 *    zaman varsayılan sekmeyle üretilir, hydration uyuşmazlığı olmaz.
 *
 * ⚠️ NEDEN `pushState` + `popstate` BİRLİKTE: yalnız pushState yazarsak geri
 *    tuşu URL'i değiştirir ama React state'i olduğu yerde kalır — adres çubuğu
 *    ile ekran birbirini tutmaz. Dinleyici bu ikisini eşler.
 *
 * Varsayılan sekmede param SİLİNİR (`/`), böylece aynı liste için iki ayrı
 * URL oluşmaz (arama motoru için tekrar eden içerik).
 */
const ILAN_TIPLERI = ['yuk', 'arac'] as const;
type IlanTipi = (typeof ILAN_TIPLERI)[number];
const VARSAYILAN_TIP: IlanTipi = 'yuk';

function urldenTip(): IlanTipi {
  if (typeof window === 'undefined') return VARSAYILAN_TIP;
  const t = new URLSearchParams(window.location.search).get('tip');
  // Bilinmeyen değer (elle yazılmış `?tip=abc`) sessizce varsayılana düşer.
  return (ILAN_TIPLERI as readonly string[]).includes(t ?? '') ? (t as IlanTipi) : VARSAYILAN_TIP;
}

function Chip({ label, bg = '#1f2937', color = '#94a3b8' }: { label: string; bg?: string; color?: string }) {
  return (
    <span style={{ background: bg, color, fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 4 }}>
      {label}
    </span>
  );
}

function HeroKayitsiz({ totalCount = 0 }: { totalCount?: number }) {
  const rotaDuraklari = SURUCU_HIZMETLERI.slice(0, 4);
  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid #1a3a2a', background: 'linear-gradient(180deg, #0d1f0f 0%, #0d1117 100%)' }}>
      <div style={{ position: 'absolute', top: -90, left: -80, width: 320, height: 320, borderRadius: '50%', background: '#22c55e', opacity: 0.12, filter: 'blur(90px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -110, right: -60, width: 280, height: 280, borderRadius: '50%', background: '#3b82f6', opacity: 0.1, filter: 'blur(90px)', pointerEvents: 'none' }} />

      <style>{`
        .hero-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:44px;align-items:center;}
        @media (max-width:860px){.hero-grid{grid-template-columns:1fr;}.hero-visual{display:none;}}
        .hero-cta-primary{transition:transform .15s ease, box-shadow .15s ease;}
        .hero-cta-primary:hover{transform:translateY(-2px);box-shadow:0 12px 26px -10px rgba(34,197,94,.55);}
        .hero-cta-secondary{transition:transform .15s ease, border-color .15s ease, background .15s ease;}
        .hero-cta-secondary:hover{transform:translateY(-2px);border-color:#22c55e;background:#12211a;}
        .hero-route-stop{transition:transform .15s ease;}
        .hero-route-stop:hover{transform:translateX(4px);}
        .hero-visual-card{transition:border-color .2s ease, box-shadow .2s ease;}
        .hero-visual-card:hover{border-color:#2f6b40;box-shadow:0 24px 60px -20px rgba(34,197,94,.25);}
      `}</style>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '52px 16px 44px', position: 'relative' }}>
        <div className="hero-grid">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#0d2b1a', border: '1px solid #166534', borderRadius: 20, padding: '4px 12px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                <span style={{ color: '#22c55e', fontSize: '0.75rem', fontWeight: 700 }}>Türkiye&apos;nin şoför dostu yük platformu</span>
              </div>
              {totalCount > 0 && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#161b22', border: '1px solid #30363d', borderRadius: 20, padding: '4px 12px' }}>
                  <span style={{ color: '#e2e8f0', fontSize: '0.75rem', fontWeight: 700 }}>📦 {totalCount.toLocaleString('tr-TR')} aktif ilan</span>
                </div>
              )}
            </div>

            <h1 style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 'clamp(1.8rem, 4.2vw, 2.75rem)', lineHeight: 1.15, margin: '0 0 14px', letterSpacing: '-0.03em' }}>
              Şoförün yol arkadaşı.<br />
              <span style={{ background: 'linear-gradient(90deg, #22c55e, #4ade80)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Teker boşa dönmesin.</span>
            </h1>
            <p style={{ color: '#8b949e', fontSize: '1.05rem', margin: '0 0 30px', lineHeight: 1.65, maxWidth: 520 }}>
              Yük bul, lastikçiyi, park yerini, yemek molasını keşfet — hepsi tek yerde.<br />
              Yükün mü var? Saniyeler içinde ilan ver.
            </p>

            {/* SPRINT_01 L2 — CTA'lar persona'ya göre AYRI hedefe gidiyor.
                Eskiden "Yük Vereceğim" düz `/ilan-ver`'e gidiyordu ve form varsayılan
                olarak "yük"te açıldığı için tesadüfen doğru çalışıyordu; ama niyet
                URL'e YAZILMADIĞI için GA'da hangi persona'nın dönüştüğü ölçülemiyordu.
                `?tip=` artık hem ön-seçim hem ölçüm anahtarı (bkz. app/ilan-ver/page.tsx). */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 32 }}>
              <a href="#surucu-hizmetleri" className="hero-cta-primary" style={{ background: '#22c55e', color: '#000', fontWeight: 800, fontSize: '0.95rem', padding: '13px 26px', borderRadius: 10, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                🚛 Sürücüyüm, Hizmetleri Gör
              </a>
              <a href="/ilan-ver?tip=yuk" className="hero-cta-secondary" style={{ background: '#161b22', color: '#e2e8f0', fontWeight: 700, fontSize: '0.95rem', padding: '13px 26px', borderRadius: 10, textDecoration: 'none', border: '1px solid #30363d', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                📦 Yük Vereceğim, İlan Ver
              </a>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              {[{ ikon: '⚡', text: 'Anında İlan' }, { ikon: '🔒', text: 'Güvenli Platform' }, { ikon: '🆓', text: 'Ücretsiz' }, { ikon: '📱', text: 'WhatsApp Entegrasyonu' }].flatMap((item, i, arr) => {
                const els = [
                  <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '0.9rem' }}>{item.ikon}</span>
                    <span style={{ color: '#6b7280', fontSize: '0.8rem', fontWeight: 600 }}>{item.text}</span>
                  </div>,
                ];
                if (i < arr.length - 1) els.push(<span key={item.text + '-dot'} style={{ width: 3, height: 3, borderRadius: '50%', background: '#30363d', flexShrink: 0 }} />);
                return els;
              })}
            </div>
          </div>

          <a href="#surucu-hizmetleri" className="hero-visual" style={{ textDecoration: 'none', display: 'block' }}>
            <div className="hero-visual-card" style={{ background: 'linear-gradient(160deg, #12251a 0%, #161b22 60%)', border: '1px solid #234a30', borderRadius: 20, padding: '26px 24px', boxShadow: '0 20px 50px -20px rgba(0,0,0,0.6)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <span style={{ color: '#8b949e', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Bugün Yolda</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#0d2b1a', border: '1px solid #166534', borderRadius: 20, padding: '3px 9px' }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                  <span style={{ color: '#4ade80', fontSize: '0.66rem', fontWeight: 700 }}>Canlı</span>
                </span>
              </div>

              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 19, top: 8, bottom: 8, width: 2, background: 'repeating-linear-gradient(180deg, #30363d 0 6px, transparent 6px 12px)' }} />
                {rotaDuraklari.map(d => (
                  <div key={d.baslik} className="hero-route-stop" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14, padding: '9px 0' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: d.bg, border: `1.5px solid ${d.renk}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0, zIndex: 1 }}>{d.ikon}</div>
                    <div>
                      <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.88rem' }}>{d.baslik}</div>
                      <div style={{ color: '#6b7280', fontSize: '0.74rem' }}>{d.aciklama}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #21262d', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>🗺️ 81 il boyunca</span>
                <span style={{ color: '#22c55e', fontSize: '0.75rem', fontWeight: 700 }}>Tümünü Gör →</span>
              </div>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}

function HeroMusteri({ ad }: { ad: string }) {
  return (
    <div style={{ background: '#0d1117', borderBottom: '1px solid #30363d' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: '#8b949e', fontSize: '0.8rem', marginBottom: 2 }}>Hoş geldiniz,</div>
            <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '1.15rem' }}>{ad} 👋</div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {/* SPRINT_01 L2 — bu blok yük veren kullanıcıya gösteriliyor, tip belli. */}
            <a href="/ilan-ver?tip=yuk" style={{ background: '#22c55e', color: '#000', fontWeight: 800, fontSize: '0.85rem', padding: '9px 18px', borderRadius: 7, textDecoration: 'none' }}>+ Yeni İlan Oluştur</a>
            <a href="/panel" style={{ background: '#161b22', color: '#e2e8f0', fontWeight: 600, fontSize: '0.85rem', padding: '9px 18px', borderRadius: 7, textDecoration: 'none', border: '1px solid #30363d' }}>📋 İlanlarım</a>
            <a href="/panel?tab=profil" style={{ background: '#161b22', color: '#8b949e', fontWeight: 600, fontSize: '0.85rem', padding: '9px 18px', borderRadius: 7, textDecoration: 'none', border: '1px solid #30363d' }}>👤 Profil</a>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroNakliyeci({ ad }: { ad: string }) {
  return (
    <div style={{ background: '#0d1117', borderBottom: '1px solid #30363d' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: '#8b949e', fontSize: '0.8rem', marginBottom: 2 }}>Hoş geldiniz,</div>
            <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '1.15rem' }}>{ad} 👋</div>
            <div style={{ color: '#6b7280', fontSize: '0.78rem', marginTop: 3 }}>Bölgenizdeki yeni işleri keşfedin.</div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href="/ilan-ver?tip=arac" style={{ background: '#1e3a5f', color: '#60a5fa', fontWeight: 800, fontSize: '0.85rem', padding: '9px 18px', borderRadius: 7, textDecoration: 'none', border: '1px solid #1e3a5f' }}>🚛 Aracım Boşta</a>
            <a href="/panel" style={{ background: '#161b22', color: '#e2e8f0', fontWeight: 600, fontSize: '0.85rem', padding: '9px 18px', borderRadius: 7, textDecoration: 'none', border: '1px solid #30363d' }}>📋 Panelim</a>
          </div>
        </div>
      </div>
    </div>
  );
}

const SURUCU_HIZMETLERI: { ikon: string; baslik: string; aciklama: string; href: string | null; renk: string; bg: string; rozet?: string }[] = [
  { ikon: '📦', baslik: 'Yük Bul', aciklama: 'Güncel ilanlar seni bekliyor', href: '#ilanlar', renk: '#22c55e', bg: '#0d2b1a', rozet: '🔥 En çok aranan' },
  { ikon: '🔧', baslik: 'Tamir & Bakım', aciklama: 'Lastikçi, motor, elektrik, yol yardımı', href: '/yol-rehberi?anaKategori=tamir_bakim', renk: '#dc2626', bg: '#2b1414' },
  { ikon: '🅿️', baslik: 'Park & Konaklama', aciklama: 'Güvenli TIR parkı, otel, pansiyon', href: '/yol-rehberi?anaKategori=park_konaklama', renk: '#60a5fa', bg: '#14202b' },
  { ikon: '🍲', baslik: 'Yeme & Mola', aciklama: 'Karnını doyur, biraz nefeslen', href: '/yol-rehberi?anaKategori=yeme_icme', renk: '#fb923c', bg: '#2b1f14' },
  { ikon: '⛽', baslik: 'Akaryakıt & Şarj', aciklama: 'En yakın istasyon & şarj noktası', href: '/yol-rehberi?anaKategori=akaryakit_enerji', renk: '#f59e0b', bg: '#2b2210' },
  { ikon: '🏭', baslik: 'Kantar & Operasyon', aciklama: 'Kantar, gümrük, depo, garaj', href: '/yol-rehberi?anaKategori=operasyon', renk: '#a78bfa', bg: '#201a2e' },
  { ikon: '👷', baslik: 'Hamal', aciklama: 'Çok yakında burada 👀', href: null, renk: '#94a3b8', bg: '#161b22' },
  { ikon: '🗺️', baslik: 'Tüm Yol Rehberi', aciklama: 'Haritada her şeyi keşfet', href: '/yol-rehberi', renk: '#34d399', bg: '#0d2b23' },
];

function SurucuHizmetKarti({ h }: { h: typeof SURUCU_HIZMETLERI[number] }) {
  if (!h.href) {
    return (
      <div style={{ position: 'relative', background: '#12151a', border: '1px dashed #30363d', borderRadius: 14, padding: '20px 16px', opacity: 0.7 }}>
        <span style={{ position: 'absolute', top: 12, right: 12, background: '#1e1b2e', color: '#a78bfa', fontSize: '0.62rem', fontWeight: 700, padding: '2px 7px', borderRadius: 20 }}>YAKINDA</span>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: h.bg, border: `1.5px solid ${h.renk}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', marginBottom: 12 }}>{h.ikon}</div>
        <div style={{ color: '#8b949e', fontWeight: 700, fontSize: '0.94rem', marginBottom: 3 }}>{h.baslik}</div>
        <div style={{ color: '#6b7280', fontSize: '0.78rem' }}>{h.aciklama}</div>
      </div>
    );
  }
  return (
    <a href={h.href}
      style={{ position: 'relative', display: 'block', background: '#161b22', border: '1px solid #30363d', borderRadius: 14, padding: '20px 16px', textDecoration: 'none', transition: 'transform .15s, border-color .15s, box-shadow .15s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = h.renk; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 8px 20px -8px ${h.renk}66`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#30363d'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
      {h.rozet && (
        <span style={{ position: 'absolute', top: 12, right: 12, background: '#0d2b1a', color: '#4ade80', fontSize: '0.6rem', fontWeight: 700, padding: '2px 7px', borderRadius: 20, whiteSpace: 'nowrap' }}>{h.rozet}</span>
      )}
      <div style={{ width: 48, height: 48, borderRadius: '50%', background: h.bg, border: `1.5px solid ${h.renk}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', marginBottom: 12 }}>{h.ikon}</div>
      <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.94rem', marginBottom: 3 }}>{h.baslik}</div>
      <div style={{ color: '#6b7280', fontSize: '0.78rem' }}>{h.aciklama}</div>
    </a>
  );
}

function SurucuHizmetleri() {
  return (
    <div id="surucu-hizmetleri" style={{ background: '#0d1117', borderBottom: '1px solid #30363d' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 16px 32px' }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '1.3rem', margin: '0 0 4px' }}>🚛 Yolda Yalnız Değilsin</h2>
          <p style={{ color: '#8b949e', fontSize: '0.85rem', margin: 0 }}>Yükten lastiğe, duraktan sofraya — şoförün ihtiyacı olan her şey tek dokunuşta.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
          {SURUCU_HIZMETLERI.map(h => <SurucuHizmetKarti key={h.baslik} h={h} />)}
        </div>
      </div>
    </div>
  );
}

function YukVerenBanner() {
  return (
    <div style={{ background: '#0d1117', borderBottom: '1px solid #30363d' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 16px 28px' }}>
        <div style={{ background: 'linear-gradient(90deg, #0d1f2e 0%, #161b22 100%)', border: '1px solid #1e3a5f', borderRadius: 12, padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '1.05rem', marginBottom: 4 }}>📦 Yükünüz mü var?</div>
            <div style={{ color: '#8b949e', fontSize: '0.85rem' }}>İlanınızı saniyeler içinde yayınlayın, binlerce nakliyeciye ulaşın. Ücretsiz.</div>
          </div>
          {/* SPRINT_01 L2 — başlık "Yükünüz mü var?" olduğu için persona net: yük. */}
          <a href="/ilan-ver?tip=yuk" style={{ background: '#22c55e', color: '#000', fontWeight: 800, fontSize: '0.9rem', padding: '11px 22px', borderRadius: 8, textDecoration: 'none', whiteSpace: 'nowrap' }}>
            İlan Ver →
          </a>
        </div>
      </div>
    </div>
  );
}

function UyeBanner() {
  return (
    <div style={{ background: '#161b22', border: '1px solid #1e3a5f', borderRadius: 8, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ color: '#8b949e', fontSize: '0.82rem' }}>
        🔐 <strong style={{ color: '#e2e8f0' }}>Telefon numaralarını görmek</strong> ve ilan sahiplerine ulaşmak için üye olun. Ücretsiz.
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {/* 29 Tem 2026 — hedefli giriş; bkz. app/_components/GirisLink.tsx */}
        <GirisLink style={{ background: '#1e3a5f', color: '#60a5fa', borderRadius: 6, padding: '7px 14px', fontSize: '0.82rem', fontWeight: 600, textDecoration: 'none' }}>Giriş Yap</GirisLink>
        <GirisLink mod="kayit" style={{ background: '#22c55e', color: '#000', borderRadius: 6, padding: '7px 14px', fontSize: '0.82rem', fontWeight: 700, textDecoration: 'none' }}>Üye Ol →</GirisLink>
      </div>
    </div>
  );
}

function IlanKart({ ilan, kullanici }: { ilan: any; kullanici: any }) {
  const kaynak = KAYNAK_ETIKET[ilan.kaynak] || KAYNAK_ETIKET.form;
  const isYuk = ilan.tip === 'yuk';
  // TÜM durakların toplamı — eskiden `duraklar[0]` idi, bkz. `durakToplami`.
  const toplamTon = durakToplami(ilan.duraklar, ['ton', 'weight_ton']);
  const toplamPalet = durakToplami(ilan.duraklar, ['palet', 'pallet_count']);
  const cokDurak = Array.isArray(ilan.duraklar) && ilan.duraklar.length > 1;
  const [telAliniyor, setTelAliniyor] = useState(false);
  const [telHata, setTelHata] = useState('');

  // SPRINT_01 L1 — numara artık ilan objesinde gelmiyor; tıklama anında authed
  // endpoint'ten çekilip doğrudan tel: ile aranıyor. Numara state'te tutulmaz.
  async function araTikla(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (telAliniyor) return;
    setTelAliniyor(true);
    setTelHata('');
    try {
      const res = await fetch(`/api/ilan/${ilan.id}/telefon`);
      const veri = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) { window.location.assign(`/giris?redirect=/ilan/${ilan.id}`); return; }
        if (veri?.redirect) { window.location.assign(veri.redirect); return; }
        setTelHata(veri?.error || 'Numara alınamadı');
        return;
      }
      window.location.assign(`tel:${veri.telefon}`);
    } catch {
      setTelHata('Bağlantı hatası');
    } finally {
      setTelAliniyor(false);
    }
  }

  return (
    <a href={`/ilan/${ilan.id}`}
      style={{ display: 'block', background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '14px 16px', cursor: 'pointer', textDecoration: 'none' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#22c55e')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#30363d')}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ background: isYuk ? '#7f1d1d' : '#14532d', color: isYuk ? '#fca5a5' : '#86efac', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
              {isYuk ? '🔴 YÜK' : '🟢 ARAÇ'}
            </span>
            <span style={{ background: kaynak.bg, color: kaynak.color, fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: 4 }}>{kaynak.label}</span>
            {ilan.dogrulanmamis && <span style={{ background: '#1a1f2e', color: '#94a3b8', fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: 4 }}>🔗 Dış Kaynak İlanı</span>}
            {/* Sürekli Yük (20 Ağu 2026) — `lib/ilan-liste.ts::ilanNormalize` alanı. */}
            {ilan.surekliYuk && <span style={{ background: '#14532d', color: '#4ade80', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>🔁 Sürekli Yük</span>}
            {/* 🚨 10 Ağu 2026 — "✅ Tel Doğrulandı" ROZETİ KALDIRILDI. SAKIN GERİ EKLEME.
                `users.phone_verified` İSTEMCİDEN yazılabiliyor (PanelClient OTP akışı
                PostgREST'e doğrudan yazıyor), yani kullanıcı rozeti kendine verebiliyordu.
                Ayrıntı: `app/ilan/[id]/page.tsx` içindeki uzun not. */}
            {ilan.yeniUye && !ilan.dogrulanmamis && <span style={{ background: '#1e1b4b', color: '#a5b4fc', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>🆕 Yeni Üye</span>}
            {ilan.fiyat && <span style={{ background: '#0d2b1a', color: '#22c55e', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>✓ Fiyat Belli</span>}
          </div>
          {/* Rota: Kalkış → Durak1 → Durak2 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ color: '#22c55e', fontWeight: 800, fontSize: '0.95rem' }}>
              {ilan.kalkis}{ilan.kalkis_ilce ? ` / ${ilan.kalkis_ilce}` : ''}
            </span>
            {ilan.duraklar.map((d: any, i: number) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ color: '#4b5563', fontWeight: 700, fontSize: '0.9rem' }}>→</span>
                <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.95rem' }}>
                  {d.sehir}{d.ilce ? ` / ${d.ilce}` : ''}
                </span>
                {d.arac_adet > 1 && <span style={{ color: '#60a5fa', fontSize: '0.78rem' }}>({d.arac_adet} araç)</span>}
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {ilan.aracTipleri.map((t: string) => <Chip key={'a-' + t} label={'🚛 ' + t} bg='#1a2535' color='#60a5fa' />)}
            {ilan.ustyapilari.map((u: string) => <Chip key={'u-' + u} label={u} />)}
            {/* TÜM durakların toplamı — bkz. `durakToplami` başlığındaki not.
                Tek duraklı ilanda çıktı eskisiyle birebir aynı. */}
            {toplamTon !== null && (
              <Chip
                label={'⚖ ' + toplamTon.toLocaleString('tr-TR') + ' ton' + (cokDurak ? ` (${ilan.duraklar.length} durak)` : '')}
                bg='#1a2a1a' color='#86efac' />
            )}
            {toplamPalet !== null && (
              <Chip
                label={'📦 ' + toplamPalet.toLocaleString('tr-TR') + ' palet'}
                bg='#1a2a1a' color='#86efac' />
            )}
            {ilan.tarih && <Chip label={'📅 ' + new Date(ilan.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) + (ilan.tarihEsnek ? ' ±' : '')} />}
            <span style={{ color: '#4b5563', fontSize: '0.72rem', marginLeft: 'auto', alignSelf: 'center' }}>{ilan.sure}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {ilan.fiyat && <div style={{ color: '#22c55e', fontWeight: 800, fontSize: '1.05rem', marginBottom: 8 }}>₺{Number(ilan.fiyat).toLocaleString('tr-TR')}</div>}
          {kullanici ? (
            <>
              <button onClick={araTikla} disabled={telAliniyor}
                style={{ display: 'block', background: '#1a3a1a', color: '#4ade80', border: '1px solid #166634', borderRadius: 6, padding: '6px 12px', fontSize: '0.8rem', fontWeight: 700, cursor: telAliniyor ? 'wait' : 'pointer', opacity: telAliniyor ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                {telAliniyor ? '⏳ …' : '📞 Ara'}
              </button>
              {telHata && <div style={{ color: '#f87171', fontSize: '0.68rem', marginTop: 4, maxWidth: 140 }}>{telHata}</div>}
            </>
          ) : (
            /* SPRINT_01 L3 — misafir "Ara"ya bastığında NEREYE döneceği artık belli.
               Eskiden düz `/giris`'e atılıyordu: kullanıcı giriş yapıyor, ANA SAYFAYA
               düşüyor ve baktığı ilanı listede yeniden bulmak zorunda kalıyordu —
               ilanlar sürekli aktığı için çoğu zaman bulamıyordu da.
               Artık aynı ilana dönüyor (401 dalıyla — yukarıdaki `araTikla` — birebir aynı hedef).

               Not: ARAMA SONUÇLARI misafire zaten açık; filtreleme istemci tarafında
               yüklenmiş liste üzerinde çalışıyor. Duvar yalnızca NUMARADA, ve bu
               bilinçli (L1: numara hiçbir misafir yüzeyine gönderilmez). */
            <button
              title="Numarayı görmek için giriş yapın"
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                olayGonder('telefon_giris_duvari', { tip: ilan.tip });
                window.location.href = `/giris?redirect=${encodeURIComponent(`/ilan/${ilan.id}`)}`;
              }}
              style={{ display: 'block', background: '#1a2a3a', color: '#60a5fa', border: '1px solid #1e3a5f', borderRadius: 6, padding: '6px 12px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              🔐 Ara
            </button>
          )}
        </div>
      </div>
    </a>
  );
}

function IlanSkeleton() {
  return (
    <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '14px 16px' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <div className="sk" style={{ width: 60, height: 20, background: '#0d1117', borderRadius: 4 }} />
        <div className="sk" style={{ width: 76, height: 20, background: '#0d1117', borderRadius: 4 }} />
      </div>
      <div className="sk" style={{ width: '42%', height: 22, background: '#0d1117', borderRadius: 4, marginBottom: 8 }} />
      <div className="sk" style={{ width: '34%', height: 22, background: '#0d1117', borderRadius: 4, marginBottom: 10 }} />
      <div style={{ display: 'flex', gap: 6 }}>
        <div className="sk" style={{ width: 90, height: 18, background: '#0d1117', borderRadius: 4 }} />
        <div className="sk" style={{ width: 68, height: 18, background: '#0d1117', borderRadius: 4 }} />
      </div>
    </div>
  );
}

function HataEkrani({ tip, onRetry }: { tip: 'timeout' | 'error'; onRetry: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '80px 0', color: '#4b5563' }}>
      <div style={{ fontSize: '2rem', marginBottom: 8 }}>{tip === 'timeout' ? '⏱️' : '⚠️'}</div>
      <div style={{ fontWeight: 600, color: '#8b949e', marginBottom: 4 }}>
        {tip === 'timeout' ? 'Bağlantı zaman aşımına uğradı' : 'İlanlar yüklenirken bir hata oluştu'}
      </div>
      <div style={{ fontSize: '0.85rem', marginBottom: 20 }}>
        {tip === 'timeout' ? 'İnternet bağlantınızı kontrol edin ve tekrar deneyin.' : 'Sunucu ile bağlantı kurulamadı. Lütfen tekrar deneyin.'}
      </div>
      <button
        onClick={onRetry}
        style={{ background: '#22c55e', color: '#000', border: 'none', borderRadius: 7, padding: '10px 24px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>
        🔄 Tekrar Dene
      </button>
    </div>
  );
}

export default function HomeClient({ initialIlanlar = [], totalCount = 0 }: { initialIlanlar?: any[]; totalCount?: number }) {
  const [ilanlar, setIlanlar] = useState<any[]>(initialIlanlar);
  const [yukleniyor, setYukleniyor] = useState(initialIlanlar.length === 0);
  const [hata, setHata] = useState<'timeout' | 'error' | null>(null);
  // SPRINT_01 L5 — SSR'da her zaman varsayılanla başla; URL mount'ta okunur (bkz. urldenTip notu).
  const [tip, setTip] = useState<IlanTipi>(VARSAYILAN_TIP);
  const [kalkis, setKalkis] = useState('');
  const [varis, setVaris] = useState('');
  const [aracTipi, setAracTipi] = useState('');
  const [kasaTipi, setKasaTipi] = useState('');
  const [kullanici, setKullanici] = useState<{ display_name: string | null; email: string | null; user_type: string | null } | null>(null);
  const [authHazir, setAuthHazir] = useState(false);
  const [yenilemeKey, setYenilemeKey] = useState(0);

  /**
   * SPRINT_01 L5 — sekmeyi URL ile eşle.
   *
   * Mount'ta bir kez okur (paylaşılan link / yenileme / dışarıdan gelen ziyaretçi),
   * sonra `popstate`i dinler (geri–ileri tuşları).
   *
   * `setTip`in effect içinde çağrılması bilinçli: SSR HTML'i varsayılan sekmeyle
   * üretilmek ZORUNDA (bkz. urldenTip notu), dolayısıyla URL yalnız hydration
   * sonrası uygulanabilir. Lazy initializer kullanmak hydration uyuşmazlığı olurdu.
   */
  useEffect(() => {
    const urldeki = urldenTip();
    // Kural bilinçli olarak susturuldu: alternatifi (lazy initializer) SSR/CSR
    // hydration uyuşmazlığı üretiyor ki o daha kötü bir hata sınıfı.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (urldeki !== VARSAYILAN_TIP) setTip(urldeki);

    /* Çöp/gereksiz parametreyi URL'den at: `?tip=abc` sessizce varsayılana düşüyor
       ama adres çubuğunda kalıyordu — kullanıcı geçerli bir filtre uyguladığını
       sanıyor, o linki paylaşıyor ve karşı taraf da aynı yanılgıyı yaşıyordu.
       `?tip=yuk` de atılır: varsayılan için parametresiz biçim tek kanonik URL.
       `replaceState` — bu bir kullanıcı eylemi değil, sadece normalizasyon;
       geçmişe kayıt bırakırsa geri tuşu aynı sayfaya döner gibi görünür. */
    const ham = new URLSearchParams(window.location.search).get('tip');
    if (ham !== null && urldeki === VARSAYILAN_TIP) {
      const url = new URL(window.location.href);
      url.searchParams.delete('tip');
      window.history.replaceState(null, '', url);
    }

    const geriIleri = () => setTip(urldenTip());
    window.addEventListener('popstate', geriIleri);
    return () => window.removeEventListener('popstate', geriIleri);
  }, []);

  /**
   * Sekme değişimi = yeni bir geçmiş kaydı. `pushState` kullanıyoruz ki geri tuşu
   * önceki sekmeye dönsün. `replaceState` olsaydı geri tuşu kullanıcıyı doğrudan
   * siteden atardı ve sekme geçmişi hiç oluşmazdı.
   *
   * Not: `router.push` DEĞİL — o sunucudan RSC payload'ı çeker ve ISR sayfasını
   * yeniden ister. Sekme tamamen istemci tarafı bir filtre; ağ turu gereksiz.
   */
  function tipDegistir(yeni: IlanTipi) {
    if (yeni === tip) return;
    setTip(yeni);
    const url = new URL(window.location.href);
    if (yeni === VARSAYILAN_TIP) url.searchParams.delete('tip');
    else url.searchParams.set('tip', yeni);
    window.history.pushState(null, '', url);
  }

  async function profilCek(userId: string) {
    // 🚨 8 Ağu 2026 — `email` select'ten ÇIKARILDI: 7 Ağu güvenlik düzeltmesinden
    // sonra `authenticated`'in bu kolonda SELECT yetkisi yok (bkz. docs/20260807_
    // guvenlik_kayit_giris.sql), sorgu tek bir kolon yüzünden TAMAMEN patlıyordu
    // (`display_name`/`user_type` da boş kalıyordu — Postgres izin hatasında
    // kısmi sonuç döndürmez). Zaten gereksizdi: çağıran taraf `session.user.email`i
    // (Supabase Auth oturumu, DB'ye hiç gitmeden) fallback olarak kullanıyor.
    const { data: profil } = await supabase
      .from('users')
      .select('display_name, user_type')
      .eq('id', userId)
      .maybeSingle();
    return profil;
  }

  // Auth — bir kez çalışır
  //
  // ⚠️ TUZAK (A8): `onAuthStateChange` callback'i, Supabase'in auth kilidi TUTULURKEN
  // çalıştırılır. Callback'in içinde `await supabase.from(...)` veya `getSession()`
  // çağırmak deadlock yaratır: konsolda
  //   "Lock lock:sb-...-auth-token was not released within 5000ms"
  // görünür, oturum hiç çözülmez ve giriş yapmış kullanıcıya navbar "Giriş Yap" gösterir.
  // Bu yüzden DB işi setTimeout(0) ile kilidin DIŞINA atılıyor.
  //
  // Ayrıca ayrı bir `getSession()` çağrısına gerek yok: abone olunduğu anda
  // INITIAL_SESSION olayı zaten mevcut oturumla (veya null ile) bir kez tetiklenir.
  useEffect(() => {
    let cancelled = false;

    // SPRINT_01 A10 — implicit-flow artığını adres çubuğundan sil.
    // Magic-link `action_link`'i oturumu `#access_token=…&refresh_token=…` olarak bırakır.
    // Supabase client bunu okur ama URL'yi TEMİZLEMEZ: token'lar adres çubuğunda, tarayıcı
    // geçmişinde, ekran görüntülerinde ve kullanıcının kopyaladığı her linkte kalır.
    // (Asıl çözüm `/auth/devir` — token hiç tarayıcıya gelmiyor. Bu sadece emniyet kemeri:
    //  eski linkler ve `/api/auth/switch-account` hâlâ bu formatta dönebiliyor.)
    function urlTemizle() {
      const h = window.location.hash;
      if (h.includes('access_token=') || h.includes('refresh_token=')) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }

    async function oturumUygula(session: Session | null) {
      if (cancelled) return;
      // Oturum çözüldükten SONRA temizle — daha önce silersek client token'ı hiç göremez.
      urlTemizle();
      if (!session?.user) {
        setKullanici(null);
        setAuthHazir(true);
        return;
      }
      // Navbar'ı HEMEN doğru duruma getir: profil sorgusu gecikse/başarısız olsa bile
      // kullanıcı "Giriş Yap" görmesin.
      setKullanici({ display_name: null, email: session.user.email ?? null, user_type: null });
      try {
        const profil = await profilCek(session.user.id);
        if (cancelled) return;
        // `email` artık `profil`de yok (yukarıdaki nota bak) — oturumdaki değer korunur.
        if (profil) setKullanici({ ...profil, email: session.user.email ?? null });
      } catch { /* profil okunamadı — oturum yine de geçerli */ }
      // `authHazir` hero'ları açar; user_type belli olmadan açarsak nakliyeciye
      // bir an müşteri hero'su görünür. Bu yüzden profil çözüldükten SONRA.
      if (!cancelled) setAuthHazir(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        // Kilidin dışına çık — burada `await supabase.*` YAPMA.
        setTimeout(() => { void oturumUygula(session); }, 0);
      }
    );

    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * 🚨 DALGA 3 — İL FİLTRESİ ARTIK SUNUCUDA (31 Tem 2026).
   *
   * ESKİ DAVRANIŞ: sayfa en yeni 200 ilanı BİR KEZ çekiyor, il filtresi bu
   * 200'lük pencerenin İÇİNDE `origin_city.includes(kalkis)` ile çalışıyordu.
   * Pencere `created_at`e göre kesiliyor, ile göre değil — yani Muş'ta aktif
   * ilan olsa bile son 200 ilan İstanbul/Ankara/Bursa'dan geliyorsa kullanıcı
   * "Muş" seçtiğinde BOŞ LİSTE görüyordu. Hata yok, uyarı yok.
   *
   * YENİ DAVRANIŞ: il seçilir seçilmez `/api/listings/ara` çağrılıyor; filtre
   * `origin_province_id` / `listing_stops.province_id` TAMSAYI eşitliğiyle
   * sunucuda çalışıyor ve limit o ilin kendi sonucuna uygulanıyor.
   *
   * ⚠️ ANAHTAR BOŞSA filtresiz yol. `tip` anahtara YALNIZ filtre açıkken
   *    giriyor: sekme değişimi filtre yokken ağ isteği tetiklememeli (200'lük
   *    liste zaten iki sekmeyi de içeriyor), filtre açıkken ise tetiklemeli —
   *    aksi halde limit iki sekme arasında paylaşılıp yine kırpardı.
   * ⚠️ Araç/kasa tipi anahtarda YOK: sunucu onları filtrelemiyor (bkz. route
   *    dosyasındaki not), istemcide daraltılıyorlar.
   */
  const ilFiltreAnahtari = (kalkis || varis) ? `${kalkis}|${varis}|${tip}` : '';

  // İlanlar — SSR verisi varsa ilk yükte atla; yenilemeKey ile retry desteği
  useEffect(() => {
    // ⚠️ Filtre TEMİZLENDİĞİNDE de buraya düşülür ve `yenilemeKey` hâlâ 0'dır.
    //    Eskiden burada düz `return` vardı; o hâliyle `ilanlar` FİLTRELENMİŞ
    //    listede donup kalırdı — "Temizle"ye basınca hiçbir şey değişmezdi.
    //    O yüzden erken çıkış listeyi SSR verisine geri koyarak çıkıyor.
    if (ilFiltreAnahtari === '' && yenilemeKey === 0 && initialIlanlar.length > 0) {
      setIlanlar(initialIlanlar);
      setYukleniyor(false);
      setHata(null);
      return;
    }

    let cancelled = false;
    setYukleniyor(true);
    setHata(null);

    // Her iki yol da `{ data, error }` şekline indirgeniyor ki zaman aşımı
    // sarmalayıcısı tek olsun. 8 sn'de yanıt gelmezse `error.message === 'timeout'`.
    type SorguSonuc = { data: any; error: { message: string } | null };
    const zamanAsimi = (p: PromiseLike<any>): Promise<SorguSonuc> => Promise.race([
      p as Promise<SorguSonuc>,
      new Promise<SorguSonuc>(resolve =>
        setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), 8000)
      ),
    ]);

    (async () => {
      try {
        // ── A) İL FİLTRELİ YOL — sunucu tarafı ────────────────────────────────
        if (ilFiltreAnahtari !== '') {
          const qs = new URLSearchParams({ tip });
          if (kalkis) qs.set('kalkis', kalkis);
          if (varis) qs.set('varis', varis);

          const res = await zamanAsimi(
            fetch(`/api/listings/ara?${qs}`).then(async r => ({
              data: r.ok ? await r.json() : null,
              error: r.ok ? null : new Error(String(r.status)),
            }))
          );
          if (cancelled) return;
          if (res.error || !res.data) {
            setHata(res.error?.message === 'timeout' ? 'timeout' : 'error');
            setYukleniyor(false);
            return;
          }
          // Rozetler yanıtın içinde geldi — ikinci istek yok.
          setIlanlar((res.data as any).data ?? []);
          setYukleniyor(false);
          return;
        }

        // ── B) FİLTRESİZ YOL — anon key, tek joined sorgu ─────────────────────
        // listing_stops'un anon SELECT politikası varsa duraklar da gelir;
        // yoksa SSR initialIlanlar verisi kullanılır, retry boş döner.
        const sorgu = supabase
          .from('listings')
          // ⚠️ SPRINT_01 L1 — `contact_phone` ÇEKİLMEZ; kural `ILAN_SELECT`'in
          // tanımında yazılı. Bu sorgu anon key ile çalışıyor: seçilen her kolon
          // giriş yapmamış ziyaretçiye açık demektir.
          .select(ILAN_SELECT)
          .in('moderation_status', ['approved', 'auto_published'])
          .eq('is_shadow_banned', false)
          .eq('status', 'active')
          // 20 Ağu 2026 — Sürekli Yük bloğu SSR (`app/page.tsx`) ile aynı sırayı korusun.
          .order('is_recurring', { ascending: false })
          .order('created_at', { ascending: false })
          // SPRINT_01 L4 — eskiden burada elle yazılmış `30` vardı; SSR ise 200 çekiyordu.
          // "Tekrar dene"ye basan kullanıcının listesi sessizce 170 ilan eksiliyordu.
          .limit(ILAN_LIMITI);

        const { data, error: sorguHata } = await zamanAsimi(sorgu as any);

        if (cancelled) return;

        if (sorguHata) {
          setHata(sorguHata.message === 'timeout' ? 'timeout' : 'error');
          setYukleniyor(false);
          return;
        }

        if (!data || (data as any[]).length === 0) {
          setIlanlar([]);
          setYukleniyor(false);
          return;
        }

        const baseList = (data as any[]).map((ilan: any) => ilanNormalize(ilan));
        setIlanlar(baseList);
        setYukleniyor(false);

        // Rozet zenginleştirme
        const userIds = [...new Set(baseList.map(i => i.user_id).filter(Boolean))];
        if (userIds.length > 0) {
          const { data: ks } = await supabase.from('users').select('id, created_at').in('id', userIds);
          if (cancelled) return;
          const kullaniciMap: Record<string, { created_at: string }> = {};
          for (const k of (ks || []) as any[]) kullaniciMap[k.id] = k;
          setIlanlar(prev => prev.map(ilan => {
            const kb = ilan.user_id ? kullaniciMap[ilan.user_id] : null;
            return { ...ilan, yeniUye: kb ? uyeYeniMi(kb.created_at) : false };
          }));
        }
      } catch (err) {
        console.error('Listings fetch hatası:', err);
        if (!cancelled) { setHata('error'); setYukleniyor(false); }
      }
    })();

    return () => { cancelled = true; };
  }, [yenilemeKey, ilFiltreAnahtari]); // eslint-disable-line react-hooks/exhaustive-deps

  const filterAktif = !!(kalkis || varis || aracTipi || kasaTipi);

  /**
   * ⚠️ İL KARŞILAŞTIRMASI ARTIK TAMSAYI — `includes` DEĞİL.
   *    `kalkis`/`varis` state'i il ADI değil PLAKA KODU (string) taşıyor;
   *    `kalkis_il_id` / `duraklar[].il_id` ise `ilanNormalize`'dan geliyor.
   *    Metin karşılaştırması yazım bozulduğunda sessizce eşleşmiyordu ve
   *    Dalga 5'te `origin_city` düşünce büsbütün kırılacaktı.
   *
   * ⚠️ İl filtresi sunucuda ZATEN uygulandı; buradaki tekrar bilinçli. Sunucu
   *    yolu ile istemci görünümü arasında bir sapma olursa kullanıcı yanlış il
   *    değil, boş liste görür — sessiz yanlış sonuçtan iyidir.
   */
  const filtered = ilanlar.filter((i: any) => {
    if (i.tip !== tip) return false;
    if (kalkis && i.kalkis_il_id !== Number(kalkis)) return false;
    if (varis && !i.duraklar.some((d: any) => d.il_id === Number(varis))) return false;
    if (aracTipi && !i.aracTipleri.some((a: string) => a === aracTipi)) return false;
    if (kasaTipi && !i.ustyapilari.some((u: string) => u === kasaTipi)) return false;
    return true;
  });

  /**
   * SPRINT_01 L4 — sayaç artık EKRANDAKİNİ sayıyor.
   *
   * ESKİ HALİ: filtre yokken `totalCount` yazılıyordu. `totalCount` platformdaki
   * TÜM aktif ilanların sayısı — her iki sekme dahil, kırpma öncesi. Altındaki
   * liste ise yalnızca seçili sekmenin ilk `ILAN_LIMITI` ilanı. Yani ekranda
   * "519 aktif ilan" yazarken 40 kart görünüyordu; kullanıcı ya sayfayı bozuk
   * sanıyor ya da geri kalanı nasıl göreceğini arıyordu (sayfalama yok).
   *
   * Liste kırpıldıysa "en yeni" ön eki bunu dürüstçe söyler. Platform toplamı
   * hâlâ hero rozetinde duruyor — orası pazarlama bağlamı, liste iddiası değil.
   *
   * ⚠️ KIRPMA ÖLÇÜSÜ `ilanlar.length`, `filtered.length` DEĞİL. `ilanlar` sorgudan
   *    dönen HAM liste; `ILAN_LIMITI`ne dayandıysa sunucu kesmiş demektir. Kırpma
   *    her iki sekmeyi birlikte etkiler: 200'lük pencere tipe göre değil,
   *    `created_at`e göre kesiliyor — yani araç sekmesinde 3 kart görünse bile
   *    pencerenin DIŞINDA kalmış araç ilanları olabilir. Bu yüzden "en yeni"
   *    ön eki sekmeden bağımsız uygulanır; per-tip saymak yanlış güven verirdi.
   *
   * ⚠️ FİLTRE VARKEN DE "en yeni" DEMELİ. Filtre bu 200'lük pencerenin İÇİNDE
   *    çalışıyor; sunucuya gitmiyor. Kırpılmış veride "12 yük ilanı" demek,
   *    aramanın tüm platformu taradığı izlenimi verir — L4'ün kapatmak istediği
   *    yanlış beyanın ta kendisi.
   */
  const listeKirpildi = ilanlar.length >= ILAN_LIMITI;
  const tipAdi = tip === 'yuk' ? 'yük' : 'araç';
  const sayacMetni =
    `${listeKirpildi ? 'en yeni ' : ''}${filtered.length.toLocaleString('tr-TR')} ${tipAdi} ilanı`;


  // 🚨 8 Ağu 2026 — `--yk-nav-h` ARTIK ÖLÇÜLÜYOR, elle yazılmıyor.
  //
  // NEDEN: filtre barı navbar'ın altına `position:sticky` ile yapışıyor ve
  // offset'i navbar yüksekliğini BİLMEK zorunda. Bunu media query başına sabit
  // sayı olarak yazdım ve tarayıcıda ölçünce İKİ kez kaydığını gördüm:
  //   · 320px'de aksiyon grubu kendi satırına düşüp nav 151px oluyordu (95 değil)
  //   · 768px'de 43 karakterlik bir şirket adı navı 113px'e çıkarıyordu (57 değil)
  // Yani sayı, içeriğin genişliğine bağlı — sabit yazıldığı her yerde yalan
  // olmaya adaydı. ResizeObserver ile gerçek yükseklik yazılınca bu hata sınıfı
  // (içerik değişince offset'in sessizce bozulması) tamamen kapanıyor.
  // CSS'teki sabit değerler FALLBACK olarak duruyor: JS çalışana kadarki ilk
  // boyamada doğru yeri veriyorlar.
  const navRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = navRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const uygula = () => {
      document.documentElement.style.setProperty(
        '--yk-nav-h', `${Math.round(el.getBoundingClientRect().height)}px`);
    };
    uygula();
    const ro = new ResizeObserver(uygula);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const ad = kullanici?.display_name || kullanici?.email?.split('@')[0] || 'Kullanıcı';
  const isNakliyeci = kullanici?.user_type === 'arac_sahibi';
  const isMusteri = kullanici && !isNakliyeci;

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <style>{`@keyframes skshimmer{0%,100%{opacity:.5}50%{opacity:.85}}.sk{animation:skshimmer 1.5s ease-in-out infinite}`}</style>

      {/* NAVBAR — misafir linkler hemen göster, auth resolve olunca kişiselleşir
       *
       * 🚨 8 Ağu 2026 (mobil taşma) — ESKİ HÂLİ NEDEN KIRILIYORDU: tek satır
       * `height:56` + `justify-content:space-between`, ne `flex-wrap` ne de
       * küçülme/kısalma kuralı vardı. Sol grup (logo + BETA + 2 link) ile sağ
       * grubun (👤 ad + "+ İlan Ver" + Çıkış) doğal genişlikleri toplamı ~450px;
       * 360px'lik bir ekranda sığmayınca öğeler container'ın SAĞINA taşıyor ve
       * sayfa yatay kaydırma kazanıyordu.
       *
       * ÇÖZÜM: mobilde iki satır. 1. satır logo + aksiyonlar (birincil CTA hep
       * görünür), 2. satır ikincil linkler (tam genişlik, gerekirse yatay
       * kaydırılır — GİZLENMİYOR, erişilebilir kalıyor).
       *
       * ⚠️ `--yk-nav-h` TEK KAYNAK: aşağıdaki filtre barı `position:sticky` ile
       * navbar'ın ALTINA yapışıyor ve eskiden `top:56` SABİT YAZILMIŞTI. Navbar
       * mobilde iki satıra çıkınca o sabit sayı yalan olur (filtre barı navbar'ın
       * altına girer). İkisi artık aynı değişkenden besleniyor; nav satır
       * yükseklikleri de bu yüzden `min-height` değil SABİT.
       */}
      <style>{`
        /* Değerler navbar'ın GERÇEK yüksekliği (1px border dahil) — tarayıcıda
           ölçüldü: masaüstü 56+1=57, mobil 56+38+1=95. column-gap bilerek ayrı
           yazıldı: kısa yol olan gap, satırlar ARASINA da 8px koyup (row-gap)
           yüksekliği 103'e çıkarıyor ve bu değişkeni yalan hale getiriyordu. */
        :root{--yk-nav-h:57px;}
        .yk-nav-bar{max-width:1280px;margin:0 auto;padding:0 16px;display:flex;align-items:center;column-gap:16px;row-gap:0;flex-wrap:wrap;}
        .yk-nav-logo{display:flex;align-items:center;gap:8px;text-decoration:none;flex:0 0 auto;height:56px;}
        .yk-nav-linkler{display:flex;gap:4px;flex:0 0 auto;align-items:center;height:56px;}
        .yk-nav-aksiyon{display:flex;align-items:center;gap:12px;flex:0 0 auto;margin-left:auto;height:56px;min-width:0;}
        /* Uzun görünen ad sağdaki butonları dışarı itmesin: kısalan tek öğe bu. */
        .yk-nav-ad{color:#e2e8f0;font-size:.85rem;text-decoration:none;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px;flex:0 1 auto;}
        .yk-nav-linkler>a{white-space:nowrap;}

        @media (max-width:760px){
          :root{--yk-nav-h:95px;}          /* 56 (1. satır) + 38 (2. satır) + 1 border */
          .yk-nav-bar{padding:0 12px;column-gap:8px;row-gap:0;}
          .yk-nav-aksiyon{gap:8px;}
          .yk-nav-ad{max-width:104px;}
          /* İkincil linkler 2. satıra: tam genişlik + gerekirse yatay kaydırma */
          .yk-nav-linkler{order:3;flex:1 0 100%;height:38px;margin:0 -12px;padding:0 12px;
            border-top:1px solid #21262d;overflow-x:auto;-webkit-overflow-scrolling:touch;
            scrollbar-width:none;}
          .yk-nav-linkler::-webkit-scrollbar{display:none;}
        }
        /* En dar ekranlar: BETA rozeti ve ad METNİ düşer — 👤 ikonu link olarak
           kalır, yani profile erişim kaybolmuyor. CTA da "+ İlan"a kısalır;
           bunlar olmadan 320px'de aksiyon grubu ÜÇÜNCÜ bir satıra düşüyordu
           (tarayıcıda ölçüldü: nav 151px). */
        @media (max-width:420px){
          .yk-nav-beta{display:none;}
          .yk-nav-ad-metin{display:none;}
          .yk-nav-logo-yazi{font-size:1.05rem;}
          .yk-nav-cta-uzun{display:none;}
          .yk-nav-cta{padding:6px 12px !important;}
        }
      `}</style>
      <nav ref={navRef} style={{ background: '#161b22', borderBottom: '1px solid #30363d', position: 'sticky', top: 0, zIndex: 50 }}>
        <div className="yk-nav-bar">
          <a href="/" className="yk-nav-logo">
            <img src="/logo.svg" alt="Yükegel" style={{ width: 28, height: 28, flexShrink: 0 }} />
            <span className="yk-nav-logo-yazi" style={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.03em', whiteSpace: 'nowrap' }}>
              <span style={{ color: '#22c55e' }}>YÜKE</span><span style={{ color: '#e2e8f0' }}>GEL</span>
            </span>
            <span className="yk-nav-beta" style={{ background: '#1e3a5f', color: '#60a5fa', fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>BETA</span>
          </a>
          <div className="yk-nav-linkler">
            <a href="/nasil-calisir" style={{ color: '#8b949e', fontSize: '0.82rem', textDecoration: 'none', padding: '4px 8px', borderRadius: 5 }}>Nasıl Çalışır?</a>
            <a href="/hakkimizda" style={{ color: '#8b949e', fontSize: '0.82rem', textDecoration: 'none', padding: '4px 8px', borderRadius: 5 }}>Hakkımızda</a>
          </div>
          {kullanici ? (
            <div className="yk-nav-aksiyon">
              <a href="/panel?tab=profil" className="yk-nav-ad">👤 <span className="yk-nav-ad-metin">{ad}</span></a>
              <a href="/ilan-ver" className="yk-nav-cta" style={{ background: '#22c55e', color: '#000', fontWeight: 700, fontSize: '0.85rem', padding: '6px 16px', borderRadius: 6, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>+ İlan<span className="yk-nav-cta-uzun"> Ver</span></a>
              {/* SPRINT_01 C1 — çıkış yan etkili bir işlem: link değil, POST formu.
                  GET olsaydı dış sitedeki <img src="/cikis"> kullanıcıyı çıkış yaptırırdı. */}
              <form method="post" action="/cikis" style={{ margin: 0, flexShrink: 0 }}>
                <button type="submit" style={{ background: 'none', border: '1px solid #30363d', color: '#8b949e', borderRadius: 6, padding: '5px 12px', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>Çıkış</button>
              </form>
            </div>
          ) : (
            <div className="yk-nav-aksiyon">
              {/* 29 Tem 2026 — hedefli giriş; bkz. app/_components/GirisLink.tsx */}
              <GirisLink style={{ color: '#8b949e', fontSize: '0.85rem', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>Giriş Yap</GirisLink>
              <GirisLink mod="kayit" style={{ background: '#22c55e', color: '#000', fontWeight: 700, fontSize: '0.85rem', padding: '6px 16px', borderRadius: 6, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>Üye Ol</GirisLink>
            </div>
          )}
        </div>
      </nav>

      {/* HERO — misafir hero hemen görünür, auth resolve olunca kişiselleşir */}
      {!kullanici && <HeroKayitsiz totalCount={totalCount} />}
      {authHazir && isMusteri && <HeroMusteri ad={ad} />}
      {authHazir && isNakliyeci && <HeroNakliyeci ad={ad} />}

      {/* SÜRÜCÜ HİZMETLERİ HUB — ana odak: yük, lastikçi, park, yemek, hamal, yol rehberi */}
      <SurucuHizmetleri />

      {/* YÜK VEREN CTA — yük sahipleri için ilan verme çağrısı */}
      <YukVerenBanner />

      {/* İLAN BÖLÜMÜ BAŞLIĞI — ikinci plan, canlı ilan feed'ine giriş */}
      <div id="ilanlar" style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 16px 0' }}>
        <h2 style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '1.05rem', margin: 0 }}>📋 Canlı Yük & Araç İlanları</h2>
      </div>

      {/* FİLTRE BARI
        * ⚠️ `top` ARTIK SABİT DEĞİL: navbar mobilde iki satıra çıkıyor, `top:56`
        * orada yalan olurdu (filtre barı navbar'ın altına kayardı). Değer
        * navbar'ın tanımladığı `--yk-nav-h` değişkeninden geliyor. */}
      <div style={{ background: '#161b22', borderBottom: '1px solid #30363d', position: 'sticky', top: 'var(--yk-nav-h)', zIndex: 40, marginTop: 12 }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '10px 16px', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <div style={{ background: '#0d1117', borderRadius: 6, padding: 2, border: '1px solid #30363d', display: 'flex' }}>
            {/* SPRINT_01 L5 — `setTip` DEĞİL `tipDegistir`: URL de güncellenmeli. */}
            {(['arac', 'yuk'] as const).map(t => (
              <button key={t} onClick={() => tipDegistir(t)}
                style={{ padding: '5px 12px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, background: tip === t ? '#22c55e' : 'transparent', color: tip === t ? '#000' : '#8b949e' }}>
                {t === 'yuk' ? '🔴 Yük' : '🟢 Araç'}
              </button>
            ))}
          </div>
          <select value={kalkis} onChange={e => setKalkis(e.target.value)}
            style={{ background: '#0d1117', color: '#e2e8f0', border: '1px solid #30363d', borderRadius: 6, padding: '5px 10px', fontSize: '0.82rem', cursor: 'pointer' }}>
            <option value=''>📍 Kalkış İli</option>
            {/* value = plaka kodu (il.id). Filtreye il adı GİTMİYOR. */}
            {ILLER.map(il => <option key={il.id} value={String(il.id)}>{il.name}</option>)}
          </select>
          <select value={varis} onChange={e => setVaris(e.target.value)}
            style={{ background: '#0d1117', color: '#e2e8f0', border: '1px solid #30363d', borderRadius: 6, padding: '5px 10px', fontSize: '0.82rem', cursor: 'pointer' }}>
            <option value=''>🏁 Varış İli</option>
            {ILLER.map(il => <option key={il.id} value={String(il.id)}>{il.name}</option>)}
          </select>
          <select value={aracTipi} onChange={e => setAracTipi(e.target.value)}
            style={{ background: '#0d1117', color: '#e2e8f0', border: '1px solid #30363d', borderRadius: 6, padding: '5px 10px', fontSize: '0.82rem', cursor: 'pointer' }}>
            <option value=''>🚛 Araç Tipi</option>
            {ARAC_TIPLERI_FILTRE.map(a => <option key={a}>{a}</option>)}
          </select>
          <select value={kasaTipi} onChange={e => setKasaTipi(e.target.value)}
            style={{ background: '#0d1117', color: '#e2e8f0', border: '1px solid #30363d', borderRadius: 6, padding: '5px 10px', fontSize: '0.82rem', cursor: 'pointer' }}>
            <option value=''>📦 Kasa Tipi</option>
            {KASA_TIPLERI_FILTRE.map(k => <option key={k}>{k}</option>)}
          </select>
          {filterAktif && (
            <button onClick={() => { setKalkis(''); setVaris(''); setAracTipi(''); setKasaTipi(''); }}
              style={{ color: '#22c55e', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
              ✕ Temizle
            </button>
          )}
          <span style={{ color: '#8b949e', fontSize: '0.78rem', marginLeft: 'auto' }}>
            {yukleniyor ? 'Yükleniyor...' : hata ? '–' : sayacMetni}
          </span>
        </div>
      </div>

      {/* İLAN LİSTESİ */}
      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '16px' }}>
        {yukleniyor ? (
          <div style={{ display: 'grid', gap: 12 }}>
            {Array.from({ length: 6 }).map((_, i) => <IlanSkeleton key={i} />)}
          </div>
        ) : hata ? (
          <HataEkrani tip={hata} onRetry={() => setYenilemeKey(k => k + 1)} />
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {!kullanici && filtered.length > 0 ? (
              <>
                <IlanKart ilan={filtered[0]} kullanici={kullanici} />
                <UyeBanner />
                {filtered.slice(1).map((ilan: any) => <IlanKart key={ilan.id} ilan={ilan} kullanici={kullanici} />)}
              </>
            ) : (
              filtered.map((ilan: any) => <IlanKart key={ilan.id} ilan={ilan} kullanici={kullanici} />)
            )}
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '80px 0', color: '#4b5563' }}>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>🔍</div>
                <div style={{ fontWeight: 600 }}>
                  {filterAktif ? 'Filtrelerle eşleşen ilan bulunamadı' : `Henüz aktif ${tip === 'yuk' ? 'yük' : 'araç'} ilanı bulunmuyor`}
                </div>
                <div style={{ fontSize: '0.85rem', marginTop: 4 }}>
                  {filterAktif ? 'Filtreleri değiştirmeyi deneyin' : 'İlk ilanı sen ekle!'}
                </div>
                {filterAktif && (
                  <button onClick={() => { setKalkis(''); setVaris(''); }}
                    style={{ marginTop: 16, color: '#22c55e', background: 'none', border: '1px solid #22c55e', borderRadius: 6, padding: '7px 16px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
                    Filtreleri Temizle
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
