'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ilanTelefonlariGetir, ilanTelefonGuncelle, ilanAuditGetir, moderatorIlanOlustur,
  mukerrerExcelListe, mukerrerExcelOnayla, mukerrerExcelReddet, type MukerrerStagingKaydi,
  mukerrerGrupListe, mukerrerIlanArsivle, type MukerrerIlanGrubu } from './actions';
// ⚠️ `ILLER` = `IL_ADLARI_ALFABETIK`. Buradaki il filtresi Dalga 5'ten sonra
//    `ilAdi(id) === filtreKalkis` diye TAM EŞİTLİK karşılaştırıyor; `ilAdi()`
//    `locations.json`'dan okuyor. Dropdown eskiden AYRI bir elle yazılmış
//    kopyadan besleniyordu — tek harflik sapma filtreyi sessizce boşa
//    düşürürdü. Aynı kaynaktan türetmek o hata sınıfını imkânsız kılıyor.
// 8 Ağu 2026 — plaka sırası (`IL_ADLARI`) yerine Türkçe alfabetik. KARŞILAŞTIRILAN
//    değer yine il ADI (sıra değişse de aynı), yalnız görünen liste sırası değişti.
import { ilAdi, ilCiftYazim, ilceNormalize, IL_ADLARI_ALFABETIK as ILLER } from '../../lib/lokasyon';
import { ilKey } from '../../lib/ilan-sabitler';
import IlceGirisi from '../_components/IlceGirisi';

const supabase = createClient();

const ARAC_TIPLERI = ['Minivan', 'Panelvan', 'Kamyonet', 'Kamyon', 'Kırkayak', 'TIR'];
const UST_YAPI = ['Açık Kasa', 'Kapalı Kasa', 'Tenteli', 'Damperli', 'Frigolu', 'Liftli', 'Sal Kasa', 'Lowbed'];
const DURUM_RENK: Record<string, { bg: string; color: string }> = {
  pending:        { bg: '#451a03', color: '#fb923c' },
  approved:       { bg: '#14532d', color: '#22c55e' },
  auto_published: { bg: '#1e3a5f', color: '#60a5fa' },
  rejected:       { bg: '#450a0a', color: '#f87171' },
  passive:        { bg: '#1f2937', color: '#9ca3af' },
};

function temizNotes(rawText: string): string {
  const ilkSatir = rawText.split('\n').find(l => l.trim().length > 5) || '';
  return ilkSatir
    .replace(/➡️?|→|--?>|==>/g, ' -> ')
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[*•~📌⭕]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function skorRenk(ilan: any): { border: string; badge: string; label: string; puan: number } {
  const stops = ilan.listing_stops || [];
  let skor = 0;
  if (ilan.contact_phone) skor += 30;
  // Dalga 5: metin kolonu düştü. Soru zaten "kalkış ili belli mi?" idi;
  // `origin_province_id` bunu daha dürüst sorar (metin doluyken id NULL
  // olabiliyordu — o satır 15 puanı hak etmiyordu).
  if (ilan.origin_province_id) skor += 15;
  if (stops.length > 0) skor += 15;
  if (ilan.vehicle_type?.length > 0) skor += 20;
  if (ilan.body_type?.length > 0) skor += 10;
  // `stops[0]` DEĞİL `some`: ilk durakta tonaj yoksa ama ikincide varsa ilan
  // eksik değildir — eskiden 5 puanı boş yere kaybediyordu.
  if (stops.some((s: any) => s?.weight_ton)) skor += 5;
  if (ilan.notes) skor += 5;
  if (skor >= 75) return { border: '#166534', badge: '🟢', label: 'Hazır', puan: skor };
  if (skor >= 45) return { border: '#854d0e', badge: '🟡', label: 'Kontrol Et', puan: skor };
  return { border: '#7f1d1d', badge: '🔴', label: 'Düzenleme Gerek', puan: skor };
}

// Audit score badge rengi
function auditRenk(score: number): { bg: string; color: string; label: string } {
  if (score >= 71) return { bg: '#450a0a', color: '#f87171', label: `🔴 ${score} puan` };
  if (score >= 31) return { bg: '#451a03', color: '#fbbf24', label: `🟡 ${score} puan` };
  return { bg: '#0d2b1a', color: '#22c55e', label: `🟢 ${score} puan` };
}

function omnisearchTip(metin: string): 'phone' | 'email' | null {
  const t = metin.trim();
  if (!t || t.length < 6) return null;
  if (/^[0+]/.test(t) && t.replace(/\D/g, '').length >= 7) return 'phone';
  if (t.includes('@') && t.length > 5) return 'email';
  return null;
}

const inp = {
  background: '#0d1117', color: '#e2e8f0', border: '1px solid #374151',
  borderRadius: 4, padding: '4px 8px', fontSize: '0.85rem', width: '100%', outline: 'none',
} as React.CSSProperties;

function KullaniciKart({ kullanici, onAskiya, onFiltrele }: {
  kullanici: any;
  onAskiya: (id: string, ad: string) => void;
  onFiltrele?: (id: string, ad: string) => void;
}) {
  const ad = kullanici.display_name || kullanici.email || kullanici.phone || 'Adsız';
  return (
    <div style={{
      background: '#0d1117', border: '1px solid #30363d', borderRadius: 8,
      padding: '12px 16px', marginBottom: 8, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
    }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1f2937', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>👤</div>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
          <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.9rem' }}>{ad}</span>
          <span style={{
            background: kullanici.role === 'admin' ? '#451a7f' : kullanici.role === 'moderator' ? '#1e3a5f' : '#1f2937',
            color: kullanici.role === 'admin' ? '#c084fc' : kullanici.role === 'moderator' ? '#60a5fa' : '#9ca3af',
            fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 4,
          }}>{kullanici.role}</span>
          {!kullanici.is_active && (
            <span style={{ background: '#450a0a', color: '#f87171', fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 4 }}>🚫 ASKIDA</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {kullanici.phone && <span style={{ color: '#60a5fa', fontSize: '0.78rem' }}>📞 {kullanici.phone}</span>}
          {kullanici.email && <span style={{ color: '#8b949e', fontSize: '0.78rem' }}>✉️ {kullanici.email}</span>}
          <span style={{ color: '#4b5563', fontSize: '0.72rem', fontFamily: 'monospace' }}>#{kullanici.id.substring(0, 8)}</span>
        </div>
      </div>
      {onFiltrele && (
        <button
          onClick={() => onFiltrele(kullanici.id, ad)}
          style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #1e3a5f', background: '#1a2535', color: '#60a5fa', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          🔍 İlanlarını Filtrele
        </button>
      )}
      {kullanici.is_active !== false && (
        <button
          onClick={() => onAskiya(kullanici.id, ad)}
          style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #7f1d1d', background: '#2a0a0a', color: '#f87171', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          🚫 Askıya Al
        </button>
      )}
    </div>
  );
}

// Filtre tipi — 'riskli' Sprint 3, 'mukerrer_ilan' 14 Ağu 2026 eklendi
type FiltreTip = 'pending' | 'approved' | 'rejected' | 'passive' | 'hepsi' | 'no_lane' | 'arsiv' | 'riskli' | 'mukerrer' | 'mukerrer_ilan';

export default function Moderator() {
  const [ilanlar, setIlanlar] = useState<any[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [filtre, setFiltre] = useState<FiltreTip>('pending');
  const [noLaneListesi, setNoLaneListesi] = useState<any[]>([]);
  // 11 Ağu 2026 — Excel mükerrer staging. `excel_dedup_staging` istemciye kapalı
  // (grant revoke + RLS), o yüzden liste/onay/ret server action üzerinden.
  const [mukerrerListesi, setMukerrerListesi] = useState<MukerrerStagingKaydi[]>([]);
  const [mukerrerIslem, setMukerrerIslem] = useState<string>('');
  // 14 Ağu 2026 — Telefon bazlı mükerrer ilan grupları
  const [mukerrerIlanGruplar, setMukerrerIlanGruplar] = useState<MukerrerIlanGrubu[]>([]);
  const [mukerrerIlanIslem, setMukerrerIlanIslem] = useState<string>('');
  const [islem, setIslem] = useState<string>('');
  const [duzenleId, setDuzenleId] = useState<string>('');
  // 8 Ağu 2026 (pratiklik) — "Çözümsüz" (no_lane) manuel ilan girişi eskiden
  // `duzenleId`yi `'no_lane_' + raw.id` string-prefix'iyle paylaşıyordu; aynı
  // state iki farklı iş akışını (gerçek ilan düzenleme vs. ham mesajdan yeni
  // ilan oluşturma) ayırt etmek için bir metin kalıbına bel bağlıyordu. Pratikte
  // çakışma riski düşüktü (`no_lane` tab'ı kendi ayrı listesini render ediyor,
  // gerçek ilan id'leri asla bu önekle başlamıyor) ama bir string kalıbına bağlı
  // olmak gereksiz bir kırılganlıktı — ayrı bir state daha açık ve ucuz.
  const [noLaneDuzenleId, setNoLaneDuzenleId] = useState<string>('');
  const [duzenleData, setDuzenleData] = useState<any>({});
  // 8 Ağu 2026 (pratiklik) — `docs/YAPILACAKLAR.md`'de açık bir madde olarak
  // duran gap: bu liste bellekteydi, sayfa yenilenince sıfırlanıyordu. Moderatör
  // "sonra bakarım" deyip 5 dk sonra sayfayı yenilerse tüm ertelemeler kaybolup
  // aynı ilanlar tekrar önüne düşüyordu. `localStorage`'a taşındı — cihaz
  // bazlı (birden fazla moderatör aynı hesabı paylaşırsa senkron olmaz, ama bu
  // bugünkü tek-moderatör kullanımı için yeterli; DB'ye taşımak ayrı bir iş).
  const SONRA_BAK_ANAHTAR = 'moderator_sonra_bak_v1';
  const [sonraBak, setSonraBak] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const ham = window.localStorage.getItem(SONRA_BAK_ANAHTAR);
      return ham ? new Set(JSON.parse(ham)) : new Set();
    } catch { return new Set(); }
  });
  useEffect(() => {
    try { window.localStorage.setItem(SONRA_BAK_ANAHTAR, JSON.stringify([...sonraBak])); } catch { /* quota vb. — sessizce yut, bellek içi hâli yine çalışır */ }
  }, [sonraBak]);
  const [sonraBakGoster, setSonraBakGoster] = useState(false);
  const [llmYukleniyor, setLlmYukleniyor] = useState(false);
  const [istatistik, setIstatistik] = useState<any>(null);
  const [aramaMetni, setAramaMetni] = useState('');
  const [filtreTelefon, setFiltreTelefon] = useState('');
  const [filtreKalkis, setFiltreKalkis] = useState('');
  const [filtreVaris, setFiltreVaris] = useState('');
  const [filtreAracTipi, setFiltreAracTipi] = useState('');
  const [filtreSkor, setFiltreSkor] = useState<'hepsi' | 'yesil' | 'sari' | 'kirmizi'>('hepsi');
  const [siralama, setSiralama] = useState<'tarih_yeni' | 'tarih_eski' | 'audit_yuksek' | 'audit_dusuk' | 'kalite_yuksek' | 'kalite_dusuk'>('tarih_yeni');

  const [filtreTarihBaslangic, setFiltreTarihBaslangic] = useState('');
  const [filtreTarihBitis, setFiltreTarihBitis] = useState('');
  // 20 Ağu 2026 — mobilde filtre satırı çok yer kaplıyordu; artık istenirse
  // açılan bir panel (mobil CSS media query, masaüstünde her zaman açık).
  const [filtrePanelAcik, setFiltrePanelAcik] = useState(false);
  // Ham mesaj artık her zaman görünmüyor — kart başına açılıp kapanan kutucuk.
  const [hamMesajAcik, setHamMesajAcik] = useState<Set<string>>(new Set());
  const hamMesajToggle = (id: string) => setHamMesajAcik(prev => {
    const yeni = new Set(prev);
    if (yeni.has(id)) yeni.delete(id); else yeni.add(id);
    return yeni;
  });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastClickedIdx, setLastClickedIdx] = useState<number | null>(null);
  const [bulkYukleniyor, setBulkYukleniyor] = useState(false);

  const [kullaniciBulguList, setKullaniciBulguList] = useState<any[]>([]);
  const [kullaniciAramaYukleniyor, setKullaniciAramaYukleniyor] = useState(false);

  // Kaynak ve kullanıcı filtreleri
  const [filtreIlanTipi, setFiltreIlanTipi] = useState<'hepsi' | 'yuk' | 'arac'>('hepsi');
  const [filtreKaynak, setFiltreKaynak] = useState('');
  const [filtreKullaniciId, setFiltreKullaniciId] = useState('');
  const [filtreKullaniciAd, setFiltreKullaniciAd] = useState('');

  // Düzenleme formundaki ilanın kullanıcı bilgisi
  const [duzenleKullanici, setDuzenleKullanici] = useState<any>(null);

  const ilanRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const router = useRouter();
  const [yetkiKontrol, setYetkiKontrol] = useState(true);

  // ── Auth
  useEffect(() => {
    async function kontrol() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/giris?redirect=/moderator'); return; }
      const { data: profil } = await supabase.from('users').select('role').eq('id', user.id).single();
      const role = (profil as any)?.role;
      if (role !== 'moderator' && role !== 'admin') { router.push('/'); return; }
      setYetkiKontrol(false);
    }
    kontrol();
  }, [router]);

  useEffect(() => { if (!yetkiKontrol) { getIlanlar(); getIstatistik(); } }, [filtre, yetkiKontrol, filtreTarihBaslangic, filtreTarihBitis, filtreKaynak, filtreKullaniciId]);

  // ── Omnisearch
  useEffect(() => {
    const tip = omnisearchTip(aramaMetni);
    if (!tip) { setKullaniciBulguList([]); return; }
    setKullaniciAramaYukleniyor(true);
    const timer = setTimeout(async () => {
      const res = await fetch('/api/moderator/kullanici-ara', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arama: aramaMetni.trim(), tip }),
      }).then(r => r.json()).catch(() => ({ kullanicilar: [] }));
      setKullaniciBulguList(res.kullanicilar || []);
      setKullaniciAramaYukleniyor(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [aramaMetni]);

  useEffect(() => { setSelectedIds(new Set()); setLastClickedIdx(null); }, [filtre]);

  async function getIstatistik() {
    const bugun = new Date(); bugun.setHours(0, 0, 0, 0);
    const [{ count: pending }, { count: bugunGelen }, { count: bugunOnaylanan }, { count: cozumsuz }, { count: riskli }, mukerrerRes, mukerrerIlanRes] = await Promise.all([
      supabase.from('listings').select('*', { count: 'exact', head: true }).eq('moderation_status', 'pending'),
      supabase.from('listings').select('*', { count: 'exact', head: true }).gte('created_at', bugun.toISOString()),
      supabase.from('listings').select('*', { count: 'exact', head: true }).eq('moderation_status', 'approved').gte('reviewed_at', bugun.toISOString()),
      supabase.from('raw_posts').select('*', { count: 'exact', head: true }).eq('processing_status', 'no_lane'),
      // Sprint 3: riskli ilan sayısı (audit_score > 30, archived değil)
      supabase.from('listings').select('*', { count: 'exact', head: true }).gt('audit_score', 30).neq('moderation_status', 'archived'),
      // 11 Ağu 2026 — Excel mükerrer bekleyen sayısı.
      mukerrerExcelListe(),
      // 14 Ağu 2026 — Telefon bazlı mükerrer grup sayısı.
      mukerrerGrupListe(200),
    ]);
    const mukerrer = mukerrerRes.ok ? mukerrerRes.veri.length : 0;
    const mukerrerIlan = mukerrerIlanRes.ok ? mukerrerIlanRes.veri.toplamGrup : 0;
    setIstatistik({ pending, bugunGelen, bugunOnaylanan, cozumsuz, riskli, mukerrer, mukerrerIlan });
  }

  async function getIlanlar() {
    setYukleniyor(true);
    if (filtre === 'no_lane') {
      const { data } = await supabase.from('raw_posts')
        .select('id, raw_text, sender_name, source, source_group, message_timestamp, quality_score')
        .eq('processing_status', 'no_lane').order('created_at', { ascending: false }).limit(100);
      setNoLaneListesi(data || []); setIlanlar([]); setYukleniyor(false); return;
    }

    if (filtre === 'mukerrer') {
      const res = await mukerrerExcelListe();
      setMukerrerListesi(res.ok ? res.veri : []);
      setIlanlar([]); setYukleniyor(false); return;
    }

    if (filtre === 'mukerrer_ilan') {
      const res = await mukerrerGrupListe();
      setMukerrerIlanGruplar(res.ok ? res.veri.gruplar : []);
      setIlanlar([]); setYukleniyor(false); return;
    }

    // Sprint 3: audit_score ve is_shadow_banned select'e eklendi
    // ⚠️ SPRINT_01 L1e — `contact_phone` BURADA ÇEKİLMEZ.
    // Bu istemci anon key kullanıyor ve o kolonun yetkisi anon/authenticated'dan
    // revoke edildi. Numaralar aşağıda `ilanTelefonlariGetir()` ile, rolü sunucuda
    // doğrulandıktan sonra ayrıca çekilip listeye birleştiriliyor.
    // 8 Ağu 2026 — `internal_audit_logs` de AYNI sebeple burada ÇEKİLMEZ (bkz.
    // `docs/20260808_listings_audit_kolon.sql`): kolon anon+authenticated'dan
    // tamamen revoke edildi (fired_rules/thresholds anti-spam motorunun iç
    // ayarlarını döküyordu, RLS satır bazında `using(true)` olduğu için herkes
    // her satırı okuyabiliyordu). Aşağıda `ilanAuditGetir()` ile birleştiriliyor.
    // `audit_score` İSTİSNA — o `authenticated`'da granted KALDI çünkü aşağıda
    // `.gt('audit_score', 30)` WHERE filtresi onu görmeden çalışamaz.
    // Dalga 5 (3 Ağu 2026): metin kolonları düştü. Satırlar `ilanlar` state'ine
    // HAM giriyor, yani `origin_province_id` / `stops[].province_id` adları
    // bileşenin her yerinde aynen görünür; çeviri gösterim anında `ilAdi()` ile.
    // 20 Ağu 2026 — `raw_text` artık raw_post_id'li satırlarda `listings`e
    // yazılmıyor (tekrar eden veri temizliği). `raw_posts` embed'i eklendi;
    // düzleştirme aşağıdaki `setIlanlar` içinde yapılıyor. 🚨 Embed önce
    // sessizce BOŞ dönüyordu: `raw_posts` RLS AÇIK ama sıfır policy'si vardı
    // (anon/authenticated için TÜM satırlar filtrelenir, GRANT var olsa bile) —
    // "Staff okuyabilir" policy'si eklenip düzeltildi (bkz. PROJE_HARITASI).
    // Ham metin artık kart üstünde HER ZAMAN açık değil — `hamMesajAcik`
    // ile kart başına aç/kapa kutucuğu (arama kutusu davranışı değişmedi).
    let query = supabase.from('listings').select(`
      id, listing_type, origin_province_id, origin_district, price_offer,
      source, created_at, moderation_status, status, notes, trust_level,
      raw_text, raw_post_id, raw_posts:raw_post_id ( raw_text ), vehicle_type, body_type, user_id,
      audit_score, is_shadow_banned,
      listing_stops ( id, stop_order, province_id, district, vehicle_count, cargo_type, weight_ton, pallet_count, notes )
    `).order('created_at', { ascending: false }).limit(200);

    // Tab filtresi
    if (filtre === 'arsiv') {
      query = query.eq('moderation_status', 'archived');
    } else if (filtre === 'hepsi') {
      query = (query as any).neq('moderation_status', 'archived');
    } else if (filtre === 'riskli') {
      // Sprint 3: audit_score > 30, archived hariç — shadow banned dahil
      query = (query as any).gt('audit_score', 30).neq('moderation_status', 'archived');
    } else if (filtre === 'pending') {
      // Süresi dolmuş pending ilanları gösterme (cron arşivlemeden önce de temiz kalsın)
      query = query.eq('moderation_status', 'pending')
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
    } else {
      query = query.eq('moderation_status', filtre);
    }

    if (filtreTarihBaslangic) query = query.gte('created_at', filtreTarihBaslangic);
    if (filtreTarihBitis)    query = (query as any).lte('created_at', filtreTarihBitis + 'T23:59:59');
    if (filtreKaynak)        query = query.eq('source', filtreKaynak);
    if (filtreKullaniciId)   query = query.eq('user_id', filtreKullaniciId);

    const { data } = await query;

    // Riskli tab'da yüksek puanlular üste gelsin
    const sorted = filtre === 'riskli'
      ? (data || []).sort((a: any, b: any) => (b.audit_score ?? 0) - (a.audit_score ?? 0))
      : (data || []);

    // SPRINT_01 L1e — numaraları server action'dan al ve birleştir.
    // Hata olursa liste yine gösterilir; sadece telefon sütunu boş kalır.
    // 8 Ağu 2026 — `internal_audit_logs` de aynı şekilde `ilanAuditGetir()`'den.
    let telefonlar: Record<string, string | null> = {};
    let auditLoglar: Record<string, any> = {};
    if (sorted.length > 0) {
      const [tel, audit] = await Promise.all([
        ilanTelefonlariGetir(sorted.map((i: any) => i.id)),
        ilanAuditGetir(sorted.map((i: any) => i.id)),
      ]);
      if (tel.ok) telefonlar = tel.veri;
      else console.warn('Telefonlar alınamadı:', tel.hata);
      if (audit.ok) auditLoglar = audit.veri;
      else console.warn('Audit kayıtları alınamadı:', audit.hata);
    }

    setIlanlar(sorted.map((i: any) => ({
      ...i,
      contact_phone: telefonlar[i.id] ?? null,
      internal_audit_logs: auditLoglar[i.id] ?? null,
      // raw_text boşsa (raw_post_id'li satır) embed edilen raw_posts'a düş.
      raw_text: i.raw_text ?? i.raw_posts?.raw_text ?? null,
      raw_posts: undefined,
    })));
    setYukleniyor(false);
  }

  // ── Client-side filtre + sıralama
  //
  // 8 Ağu 2026 (pratiklik) — `useMemo` YOKTU: 200 satırlık `ilanlar` her
  // render'da (ör. arama kutusuna TEK harf yazınca, ki `aramaMetni` her tuş
  // vuruşunda değişiyor) baştan filtreleniyor VE sıralanıyordu. Listenin
  // kendisi değişmediği sürece (ör. sadece `duzenleId` değiştiği için render
  // olduğunda) bu iş boşa tekrarlanıyordu. Bağımlılık dizisi filtre/sıralama
  // fonksiyonlarının okuduğu HER state'i kapsıyor — biri eksik kalırsa o
  // filtre "yapışık" görünür (değiştirince liste güncellenmez).
  const filtrelenmis = useMemo(() => ilanlar.filter(ilan => {
    const stops = ilan.listing_stops || [];
    if (!sonraBakGoster && sonraBak.has(ilan.id)) return false;
    if (aramaMetni) {
      const norm = aramaMetni.toLowerCase();
      // Dalga 5: il adları artık id'den türüyor. Serbest metin araması olduğu
      // için samanlığa ADI giriyor — moderatör "ankara" yazıp bulabilsin diye.
      const haystack = `${ilan.raw_text || ''} ${ilan.notes || ''} ${ilAdi(ilan.origin_province_id) || ''} ${stops.map((s: any) => ilAdi(s.province_id) || '').join(' ')}`.toLowerCase();
      if (!haystack.includes(norm)) return false;
    }
    if (filtreTelefon) { const tel = filtreTelefon.replace(/\D/g, ''); if (!(ilan.contact_phone || '').replace(/\D/g, '').includes(tel)) return false; }
    // Dalga 5: `filtreKalkis`/`filtreVaris` `ILLER` DROPDOWN'undan geliyor, yani
    // değerleri zaten kanonik il adları. `ilAdi()` de `locations.json`'daki aynı
    // kanonik adı döndürüyor → tam eşitlik karşılaştırması korunabiliyor.
    // (Panel'deki serbest metin kutusundan farklı; orada `includes` gerekmişti.)
    if (filtreKalkis && ilAdi(ilan.origin_province_id) !== filtreKalkis) return false;
    if (filtreVaris && !stops.some((s: any) => ilAdi(s.province_id) === filtreVaris)) return false;
    if (filtreAracTipi && !(ilan.vehicle_type || []).includes(filtreAracTipi)) return false;
    if (filtreIlanTipi !== 'hepsi' && ilan.listing_type !== filtreIlanTipi) return false;
    if (filtreSkor !== 'hepsi') {
      const r = skorRenk(ilan);
      if (filtreSkor === 'yesil' && r.badge !== '🟢') return false;
      if (filtreSkor === 'sari' && r.badge !== '🟡') return false;
      if (filtreSkor === 'kirmizi' && r.badge !== '🔴') return false;
    }
    return true;
  }), [ilanlar, sonraBakGoster, sonraBak, aramaMetni, filtreTelefon, filtreKalkis, filtreVaris, filtreAracTipi, filtreIlanTipi, filtreSkor]);

  // Sıralama uygula
  const siralanmis = useMemo(() => [...filtrelenmis].sort((a, b) => {
    if (siralama === 'tarih_yeni') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (siralama === 'tarih_eski') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (siralama === 'audit_yuksek') return (b.audit_score ?? 0) - (a.audit_score ?? 0);
    if (siralama === 'audit_dusuk') return (a.audit_score ?? 0) - (b.audit_score ?? 0);
    if (siralama === 'kalite_yuksek') return skorRenk(b).puan - skorRenk(a).puan;
    if (siralama === 'kalite_dusuk') return skorRenk(a).puan - skorRenk(b).puan;
    return 0;
  }), [filtrelenmis, siralama]);

  const sonraBakSayisi = ilanlar.filter(i => sonraBak.has(i.id)).length;
  const yesil   = siralanmis.filter(i => skorRenk(i).badge === '🟢').length;
  const sari    = siralanmis.filter(i => skorRenk(i).badge === '🟡').length;
  const kirmizi = siralanmis.filter(i => skorRenk(i).badge === '🔴').length;

  // ── Checkbox
  function handleCheckbox(id: string, idx: number, e: React.MouseEvent) {
    e.stopPropagation();
    const yeni = new Set(selectedIds);
    if (e.shiftKey && lastClickedIdx !== null) {
      const start = Math.min(lastClickedIdx, idx);
      const end   = Math.max(lastClickedIdx, idx);
      for (let i = start; i <= end; i++) {
        if (filtrelenmis[i]) yeni.add(filtrelenmis[i].id);
      }
    } else {
      if (yeni.has(id)) yeni.delete(id); else yeni.add(id);
    }
    setSelectedIds(yeni);
    setLastClickedIdx(idx);
  }

  function masterToggle() {
    if (selectedIds.size === siralanmis.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(siralanmis.map(i => i.id)));
  }

  // ── 8 Ağu 2026 (pratiklik) — İYİMSER YEREL GÜNCELLEME ────────────────────
  //
  // ÖNCEKİ HÂL: her tekli/toplu aksiyondan sonra (approve/reject/arşiv/shadow
  // ban/düzeltme iste — 13 ayrı çağrı noktası) TAM `getIlanlar()` (200 satır +
  // ayrı bir server action'la telefon birleştirme) + `getIstatistik()` (5 ayrı
  // count sorgusu) yeniden çekiliyordu. Sonuç: her tık ~yarım-bir saniye ağ
  // gecikmesi + tüm listenin yeniden render'ı — üstelik `siradakineGec()`'in
  // 350ms'lik "sonrakine kaydır" animasyonuyla YARIŞIYORDU, ekran sık sık
  // moderatör kaydırırken listenin altından kayıyordu.
  //
  // YENİ HÂL: sunucunun her aksiyon için TAM OLARAK hangi alanları yazdığı
  // (`app/api/moderator/toplu-islem/route.ts`ten okunarak) burada birebir
  // tekrarlanıyor; başarılı bir çağrıdan sonra `ilanlar` state'i AĞA
  // GİTMEDEN, anında güncelleniyor. Sekmenin server sorgusu hangi
  // `moderation_status`ları gösteriyorsa (`getIlanlar()`teki filtre bloğuyla
  // BİREBİR aynı mantık) yeni durum artık o kümede değilse satır listeden
  // kayboluyor, aksi hâlde rozeti güncellenmiş hâlde yerinde kalıyor (ör.
  // "approved" sekmesinde shadow ban uygulamak ilanı KAYBETMEMELİ, yalnız
  // "👁 Shadow" rozetini eklemeli). `getIstatistik()` hâlâ çağrılıyor (5 ucuz
  // count sorgusu, listeyi etkilemiyor) ama artık render'ı bloklamıyor.
  const AKSIYON_ALANLARI: Record<string, Record<string, unknown>> = {
    approve:           { moderation_status: 'approved',  status: 'active' },
    reject:            { moderation_status: 'rejected',  status: 'passive' },
    passive:           { status: 'passive' },
    archive:           { moderation_status: 'archived',  status: 'passive' },
    unarchive:         { moderation_status: 'pending' },
    shadow_ban_kaldir: { is_shadow_banned: false, moderation_status: 'approved', status: 'active' },
    shadow_ban:        { is_shadow_banned: true },
    correction_needed: { moderation_status: 'correction_needed', status: 'passive' },
  };

  function ilanlariYereldeUygula(ids: string[], patch: Record<string, unknown>) {
    const set = new Set(ids);
    const yeniDurum = patch.moderation_status as string | undefined;
    // Bu sekme moderation_status'a göre mi süzüyor? (`getIlanlar()`teki tab
    // filtresiyle aynı liste — 'hepsi'/'riskli'/'no_lane' başka kritere bakar.)
    const kalirMi = (mevcutDurum: string) => {
      if (yeniDurum === undefined) return true; // bu aksiyon moderation_status değiştirmiyor (ör. sade shadow_ban)
      if (filtre === 'arsiv')  return yeniDurum === 'archived';
      if (filtre === 'hepsi')  return yeniDurum !== 'archived';
      if (filtre === 'riskli') return yeniDurum !== 'archived';
      if (filtre === 'no_lane') return true; // ayrı liste (raw_posts), bu aksiyonlardan etkilenmez
      return yeniDurum === filtre; // pending/approved/rejected/passive/correction_needed
    };
    setIlanlar(prev => prev
      .filter(i => !set.has(i.id) || kalirMi(i.moderation_status))
      .map(i => set.has(i.id) ? { ...i, ...patch } : i));
    setSelectedIds(prev => {
      let degisti = false;
      const yeni = new Set(prev);
      for (const id of ids) if (yeni.delete(id)) degisti = true;
      return degisti ? yeni : prev;
    });
  }

  // ── Toplu işlem helper (service role API)
  async function topluApi(ids: string[], action: 'approve' | 'reject' | 'passive' | 'archive' | 'unarchive' | 'shadow_ban_kaldir' | 'shadow_ban') {
    const res = await fetch('/api/moderator/toplu-islem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, action }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Bilinmeyen hata');
    return json;
  }

  async function topluIslem(action: 'approve' | 'archive' | 'delete') {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const label = { approve: 'onaylanacak', archive: 'arşivlenecek', delete: 'reddedilecek' }[action];
    if (!confirm(`${ids.length} ilan ${label}. Devam et?`)) return;
    setBulkYukleniyor(true);
    try {
      const apiAction = action === 'delete' ? 'reject' : action;
      await topluApi(ids, apiAction);
      ilanlariYereldeUygula(ids, AKSIYON_ALANLARI[apiAction]);
    } catch (e: any) { alert('Hata: ' + e.message); }
    setBulkYukleniyor(false);
    getIstatistik();
  }

  // ── Sprint 3: Toplu shadow ban kaldır
  // Sprint 5+: Düzeltme İste modal
  const [duzeltmeModal, setDuzeltmeModal] = useState<{ id: string; bulk?: string[] } | null>(null);
  const [duzeltmeSebep, setDuzeltmeSebep] = useState('');
  const [duzeltmeMesaj, setDuzeltmeMesaj] = useState('');

  const DUZELTME_SEBEPLER = [
    'İletişim bilgisi paylaşılmış',
    'Yasaklı ifade veya kelime',
    'Yanıltıcı / hatalı bilgi',
    'Yasadışı içerik şüphesi',
    'Diğer (aşağıda açıklayın)',
  ];

  async function duzeltmeIsteOnayla() {
    if (!duzeltmeModal) return;
    const ids = duzeltmeModal.bulk ?? [duzeltmeModal.id];
    setIslem(duzeltmeModal.id);
    try {
      await fetch('/api/moderator/toplu-islem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids,
          action: 'correction_needed',
          correction_reason:  duzeltmeSebep || null,
          correction_message: duzeltmeMesaj || null,
        }),
      });
      ilanlariYereldeUygula(ids, AKSIYON_ALANLARI.correction_needed);
    } catch (e: any) { alert('Hata: ' + e.message); }
    setDuzeltmeModal(null); setDuzeltmeSebep(''); setDuzeltmeMesaj('');
    setIslem('');
    getIstatistik();
  }

  // Sprint 3+: Tekil shadow ban uygula
  async function shadowBanla(id: string) {
    setIslem(id);
    try { await topluApi([id], 'shadow_ban'); ilanlariYereldeUygula([id], AKSIYON_ALANLARI.shadow_ban); }
    catch (e: any) { alert('Hata: ' + e.message); }
    setIslem('');
    getIstatistik();
  }

  async function topluShadowBanKaldir() {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    if (!confirm(`${ids.length} ilandan shadow ban kaldırılacak ve onaylanacak. Devam et?`)) return;
    setBulkYukleniyor(true);
    try {
      await topluApi(ids, 'shadow_ban_kaldir');
      ilanlariYereldeUygula(ids, AKSIYON_ALANLARI.shadow_ban_kaldir);
    } catch (e: any) { alert('Hata: ' + e.message); }
    setBulkYukleniyor(false);
    getIstatistik();
  }

  async function topluOnaylaYesil() {
    const ids = siralanmis.filter(i => skorRenk(i).badge === '🟢').map(i => i.id);
    if (!ids.length) return;
    try { await topluApi(ids, 'approve'); ilanlariYereldeUygula(ids, AKSIYON_ALANLARI.approve); getIstatistik(); }
    catch (e: any) { alert('Toplu onay hatası: ' + e.message); }
  }

  async function topluReddet(badge: '🟡' | '🔴') {
    const ids = siralanmis.filter(i => skorRenk(i).badge === badge).map(i => i.id);
    if (!ids.length) return;
    try { await topluApi(ids, 'reject'); ilanlariYereldeUygula(ids, AKSIYON_ALANLARI.reject); getIstatistik(); }
    catch (e: any) { alert('Toplu red hatası: ' + e.message); }
  }

  async function arsivIslem(id: string, geriAl = false) {
    setIslem(id);
    try {
      await topluApi([id], geriAl ? 'unarchive' : 'archive');
      ilanlariYereldeUygula([id], AKSIYON_ALANLARI[geriAl ? 'unarchive' : 'archive']);
    }
    catch (e: any) { alert('Arşiv hatası: ' + e.message); }
    setIslem('');
    getIstatistik();
  }

  // ── Sprint 3: Tekil shadow ban kaldır
  async function shadowBanKaldir(id: string) {
    setIslem(id);
    try { await topluApi([id], 'shadow_ban_kaldir'); ilanlariYereldeUygula([id], AKSIYON_ALANLARI.shadow_ban_kaldir); }
    catch (e: any) { alert('Hata: ' + e.message); }
    setIslem('');
    getIstatistik();
  }

  async function kullaniciAskiyaAl(userId: string, displayName: string) {
    if (!confirm(`"${displayName}" hesabı askıya alınacak. Devam et?`)) return;
    const res = await fetch('/api/moderator/kullanici-askiya', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      setKullaniciBulguList(prev => prev.map(u => u.id === userId ? { ...u, is_active: false } : u));
      getIlanlar(); getIstatistik();
    } else { alert('Hata oluştu'); }
  }

  function siradakineGec(mevcutId: string, duzenlemeModu = false) {
    const idx = siralanmis.findIndex(i => i.id === mevcutId);
    const sonraki = siralanmis[idx + 1];
    if (sonraki) {
      setTimeout(() => {
        ilanRefs.current[sonraki.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (duzenlemeModu) duzenleAc(sonraki);
      }, 350);
    }
  }

  async function aksiyon(id: string, yeniModerasyon: string, yeniStatus: string) {
    setIslem(id);
    await supabase.from('listings').update({ moderation_status: yeniModerasyon, status: yeniStatus, reviewed_at: new Date().toISOString() }).eq('id', id);
    setIslem('');
    siradakineGec(id, false);
    ilanlariYereldeUygula([id], { moderation_status: yeniModerasyon, status: yeniStatus });
    getIstatistik();
  }

  function sonraBakEkleVeGec(id: string) {
    const duzenlemeModundaydı = duzenleId === id;
    const yeni = new Set(sonraBak); yeni.add(id); setSonraBak(yeni);
    siradakineGec(id, duzenlemeModundaydı);
  }

  // ── 8 Ağu 2026 (pratiklik) — Klavye kısayolları ─────────────────────────
  //
  // Yoğun triyaj yapan bir moderatör için fareyle her ilanda ayrı ayrı
  // "Onayla"ya tıklamak gereksiz bir sürtünme. Kısayollar KUYRUĞUN BAŞINDAKİ
  // karta uygulanır (`siralanmis[0]`) — "sonrakine kaydır" davranışı zaten bu
  // varsayımla çalışıyor (bkz. `siradakineGec`), yani liste zaten yukarıdan
  // aşağıya sırayla işlenmek üzere tasarlı.
  //
  // Kasıtlı olarak SINIRLI kapsam: yalnız standart moderasyon sekmelerinde
  // (arşiv/çözümsüz/riskli hariç — oradaki buton kümesi farklı) VE düzenleme
  // modunda DEĞİLKEN VE odak bir input/textarea/select'te DEĞİLKEN çalışır.
  // Aksi hâlde arama kutusuna "ara" yazan bir moderatör kazara ilan
  // onaylayabilirdi.
  useEffect(() => {
    function tusa(e: KeyboardEvent) {
      const hedef = e.target as HTMLElement | null;
      const yaziAlaninda = !!hedef && ['INPUT', 'TEXTAREA', 'SELECT'].includes(hedef.tagName);
      if (yaziAlaninda || duzenleId || e.metaKey || e.ctrlKey || e.altKey) return;
      if (filtre === 'arsiv' || filtre === 'no_lane') return;
      const ilkKart = siralanmis[0];
      if (!ilkKart) return;

      const tus = e.key.toLowerCase();
      if (tus === 'a') { e.preventDefault(); aksiyon(ilkKart.id, 'approved', 'active'); }
      else if (tus === 'r') { e.preventDefault(); aksiyon(ilkKart.id, 'rejected', 'passive'); }
      else if (tus === 's' || e.key === ' ') { e.preventDefault(); sonraBakEkleVeGec(ilkKart.id); }
      else if (tus === 'e') { e.preventDefault(); duzenleAc(ilkKart); }
    }
    window.addEventListener('keydown', tusa);
    return () => window.removeEventListener('keydown', tusa);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siralanmis, duzenleId, filtre]);

  function duzenleAc(ilan: any) {
    setDuzenleId(ilan.id);
    setDuzenleData({
      listing_type: ilan.listing_type,
      // Dalga 5: form METİN ile çalışmaya devam ediyor (`<select>` değerleri il
      // adı, `aliasOgren` da adı yazıyor) — yalnız BAŞLANGIÇ DEĞERİ id'den
      // türüyor. `duzenleKaydet` bu metni `ilCiftYazim()` ile geri çözüyor.
      origin_city: ilAdi(ilan.origin_province_id) ?? '',
      origin_district: ilan.origin_district || '',
      contact_phone: ilan.contact_phone || '',
      price_offer: ilan.price_offer || '',
      notes: ilan.notes || '',
      vehicle_type: ilan.vehicle_type || [],
      body_type: ilan.body_type || [],
      raw_text: ilan.raw_text || '',
      stops: (ilan.listing_stops || []).sort((a: any, b: any) => a.stop_order - b.stop_order).map((s: any) => ({
        id: s.id, city: ilAdi(s.province_id) ?? '', district: s.district || '',
        weight_ton: s.weight_ton || '', pallet_count: s.pallet_count || '',
        vehicle_count: s.vehicle_count || 1, cargo_type: s.cargo_type || '', notes: s.notes || '',
      }))
    });
    // Kullanıcı bilgisini ayrı çek
    setDuzenleKullanici(null);
    if (ilan.user_id) {
      fetch('/api/moderator/kullanici-ara', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ilan.user_id }),
      }).then(r => r.json()).then(res => setDuzenleKullanici(res.kullanici ?? null)).catch(() => {});
    }
  }

  async function duzenleKaydet(id: string, mod: 'onayla' | 'sadece_kaydet') {
    setIslem(id);

    // 🚨 DALGA 3 — ÇİFT YAZIM BURADA DA ZORUNLU.
    // Bu düzenleme yolu `moderatorIlanOlustur()` server action'ından GEÇMİYOR;
    // doğrudan tarayıcıdan UPDATE atıyor. `province_id` yazılmazsa moderatörün
    // düzeltmesi metne işler ama ID'de ESKİ DEĞERDE KALIR — ve Dalga 3'ten
    // sonra radar/nearby ID'ye baktığı için düzeltme HİÇ ETKİ ETMEZ.
    // Tehlike "boş kalması" değil, "eski değerde kalması": İstanbul→Ankara
    // düzeltilen satır metinde Ankara, ID'de 34 olur; `20260730_province_id.sql`
    // Adım 8.2 çapraz kontrolü bunu tutarsızlık olarak yakalar.
    // (Aynı gerekçe: `app/panel/actions.ts:105-108`.)
    const kalkisIl = ilCiftYazim(duzenleData.origin_city);
    if (!kalkisIl) {
      alert('Kalkış ili tanınamadı: ' + duzenleData.origin_city + '. Listeden bir il seçin.');
      setIslem('');
      return;
    }
    const kalkisIlce = ilceNormalize(kalkisIl.id, duzenleData.origin_district);

    // Duraklar `listings` UPDATE'inden ÖNCE çözülüyor: tanınmayan bir durak ili
    // varsa hiçbir şey yazılmadan çıkılsın. Aksi halde ilan güncellenir, duraklar
    // yarıda kalır ve satır kendisiyle çelişir.
    const cozulmusDuraklar: Array<{
      id: string | null; ad: string; ilId: number;
      ilceAd: string | null; ilceResmi: boolean | null; kaynak: any;
    }> = [];
    for (const stop of duzenleData.stops) {
      const il = ilCiftYazim(stop.city);
      if (!il) {
        alert('Varış ili tanınamadı: ' + stop.city + '. Listeden bir il seçin.');
        setIslem('');
        return;
      }
      // İlçe İL'E BAĞLI çözülüyor — "Kadıköy" İstanbul'un ilçesi, Ankara'nın değil.
      const ilce = ilceNormalize(il.id, stop.district);
      cozulmusDuraklar.push({
        id: stop.id ?? null, ad: il.ad, ilId: il.id,
        ilceAd: ilce?.ad ?? null, ilceResmi: ilce?.resmi ?? null, kaynak: stop,
      });
    }

    // ⚠️ SPRINT_01 L1e — `contact_phone` burada YOK, ayrı çağrılıyor (aşağıda) —
    // service-role'lü `ilanTelefonGuncelle()` zaten kendi başına atomik, tek
    // UPDATE; onu bu RPC'ye katmak fayda sağlamıyordu.
    //
    // 🚨 8 Ağu 2026 (pratiklik) — burası eskiden `listings` UPDATE'ini VE her
    // durak için ayrı ayrı (transaction'sız) update/insert atıyordu. İki sorun
    // vardı: (1) yarıda hata olursa ilan kendi duraklarıyla çelişirdi, (2)
    // formda SİLİNEN bir durak DB'de hiç silinmiyordu (döngü yalnız update/
    // insert biliyordu). Tek RPC çağrısına taşındı — `moderator_ilan_duzenle`
    // duraklarda SİL+YENİDEN-EKLE yapıyor (bkz. migration'daki not), ikisini
    // birden kapatıyor. RPC kendi içinde de rol kontrolü yapıyor — istemci
    // tarafındaki `yetkiKontrol`e güvenmiyor.
    const updateData: any = {
      listing_type: duzenleData.listing_type,
      // 🚨 DALGA 5 / KOVA D — `origin_city: kalkisIl.ad` BURADAN SİLİNDİ.
      //    `kalkisIl` çözümü DURUYOR; yalnız yazılan alan `.id`.
      origin_province_id: kalkisIl.id,
      origin_district: kalkisIlce?.ad ?? null,
      origin_district_official: kalkisIlce?.resmi ?? null,
      price_offer: duzenleData.price_offer || null, notes: duzenleData.notes,
      vehicle_type: duzenleData.vehicle_type, body_type: duzenleData.body_type,
    };
    if (mod === 'onayla') {
      updateData.moderation_status = 'approved';
      updateData.status = 'active';
      updateData.reviewed_at = new Date().toISOString();
      // Moderatör onaylıyorsa shadow ban'ı da kaldır
      updateData.is_shadow_banned = false;
    }

    const { error: rpcHata } = await supabase.rpc('moderator_ilan_duzenle', {
      p_listing_id: id,
      p_listing: updateData,
      p_stops: cozulmusDuraklar.map(d => ({
        province_id: d.ilId, district: d.ilceAd, district_official: d.ilceResmi,
        weight_ton: d.kaynak.weight_ton || null, pallet_count: d.kaynak.pallet_count || null,
        vehicle_count: d.kaynak.vehicle_count || 1, cargo_type: d.kaynak.cargo_type || null,
        notes: d.kaynak.notes || null,
      })),
    });
    if (rpcHata) {
      alert('Kaydedilemedi: ' + rpcHata.message);
      setIslem('');
      return;
    }

    const telSonuc = await ilanTelefonGuncelle(id, duzenleData.contact_phone || null);
    if (!telSonuc.ok) {
      // Numara kaydedilemedi — moderatör bunu bilmeli, diğer alanlar kaydedildi.
      alert('Telefon kaydedilemedi: ' + telSonuc.hata);
    }
    if (mod === 'onayla') await aliasOgren(duzenleData);
    setDuzenleId(''); setIslem('');
    siradakineGec(id, true);
    // Kart HEMEN doğru veriyle güncellensin — tam yeniden çekmeye gerek yok,
    // yeni değerler zaten yukarıda çözülmüştü (`kalkisIl`/`cozulmusDuraklar`).
    // `stop.id` yeni eklenen duraklarda null kalır ama gösterimde kullanılmıyor
    // (kart `stops.map((s,i) => <div key={i}>`, id'ye bakmıyor).
    ilanlariYereldeUygula([id], {
      ...updateData,
      listing_stops: cozulmusDuraklar.map((d, i) => ({
        id: d.id, stop_order: i + 1, province_id: d.ilId, district: d.ilceAd,
        vehicle_count: d.kaynak.vehicle_count || 1, cargo_type: d.kaynak.cargo_type || null,
        weight_ton: d.kaynak.weight_ton || null, pallet_count: d.kaynak.pallet_count || null,
      })),
      contact_phone: duzenleData.contact_phone || null,
    });
    getIstatistik();
  }

  function stopEkle() { setDuzenleData({ ...duzenleData, stops: [...(duzenleData.stops || []), { id: null, city: 'İstanbul', district: '', weight_ton: '', pallet_count: '', vehicle_count: 1, cargo_type: '', notes: '' }] }); }
  function stopSil(idx: number) { setDuzenleData({ ...duzenleData, stops: duzenleData.stops.filter((_: any, i: number) => i !== idx) }); }
  function stopGuncelle(idx: number, alan: string, deger: any) { const yeni = [...duzenleData.stops]; yeni[idx] = { ...yeni[idx], [alan]: deger }; setDuzenleData({ ...duzenleData, stops: yeni }); }

  async function aliasOgren(data: any) {
    // 🚨 KATLAMA SÖZLEŞMESİ — burada eskiden yerel bir `norm` vardı ve SIRASI
    // YANLIŞTI: önce `.toLowerCase()`, sonra `.replace(/İ/g,'i')`. JS'te
    // `'İ'.toLowerCase()` "i" + U+0307 (birleşik nokta) üretir, dolayısıyla
    // sonraki replace ARTIK EŞLEŞMEZ. Sonuç: "İkitelli" → "i̇kitelli" (görünmez
    // noktalı) olarak yazılıyordu; ne `lib/ilan-sabitler.ts::ilKey()` ne de
    // `public.il_key()` bu anahtarı üretir → alias hiçbir zaman EŞLEŞMEZDİ.
    // Sessiz ölü kayıt. Artık tek kaynak `ilKey` kullanılıyor.
    const norm = ilKey;
    if (data.origin_district && data.origin_city) await supabase.from('aliases').upsert({ alias: norm(data.origin_district), normalized: data.origin_city, district: data.origin_district, type: 'city', is_active: true, priority: 90 }, { onConflict: 'alias' });
    for (const stop of (data.stops || [])) { if (stop.district && stop.city) await supabase.from('aliases').upsert({ alias: norm(stop.district), normalized: stop.city, district: stop.district, type: 'city', is_active: true, priority: 90 }, { onConflict: 'alias' }); }
    for (const vt of (data.vehicle_type || [])) { if (vt) await supabase.from('aliases').upsert({ alias: norm(vt), normalized: vt, type: 'vehicle', is_active: true, priority: 80 }, { onConflict: 'alias' }); }
    for (const bt of (data.body_type || [])) { if (bt) await supabase.from('aliases').upsert({ alias: norm(bt), normalized: bt, type: 'body', is_active: true, priority: 70 }, { onConflict: 'alias' }); }
  }

  async function llmSor(ilan: any) {
    setLlmYukleniyor(true);
    try {
      const res = await fetch('/api/llm-parse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ raw_text: ilan.raw_text, notes: ilan.notes }) });
      const data = await res.json();
      if (data.success) {
        setDuzenleData((prev: any) => ({ ...prev, listing_type: data.result.listing_type || prev.listing_type, origin_city: data.result.origin_city || prev.origin_city, origin_district: data.result.origin_district || '', contact_phone: data.result.contact_phone || prev.contact_phone || '', vehicle_type: data.result.vehicle_type || prev.vehicle_type, body_type: data.result.body_type || prev.body_type, stops: data.result.stops?.map((s: any) => ({ id: null, city: s.city || 'İstanbul', district: s.district || '', weight_ton: s.weight_ton || '', pallet_count: s.pallet_count || '', vehicle_count: 1, cargo_type: s.cargo_type || '', notes: '' })) || prev.stops }));
      } else { alert('❌ Hata: ' + data.error); }
    } catch (e: any) { alert('❌ Hata: ' + e.message); }
    setLlmYukleniyor(false);
  }

  async function cikisYap() { await supabase.auth.signOut(); router.push('/giris'); }

  function filtreTemizle() {
    setAramaMetni(''); setFiltreTelefon(''); setFiltreKalkis(''); setFiltreVaris('');
    setFiltreAracTipi(''); setFiltreSkor('hepsi');
    setFiltreIlanTipi('hepsi'); setSiralama('tarih_yeni');
    setFiltreKaynak(''); setFiltreKullaniciId(''); setFiltreKullaniciAd('');
    setFiltreTarihBaslangic(''); setFiltreTarihBitis('');
  }
  const aktifFiltre = aramaMetni || filtreTelefon || filtreKalkis || filtreVaris || filtreAracTipi || filtreSkor !== 'hepsi' || filtreKaynak || filtreKullaniciId || filtreTarihBaslangic || filtreTarihBitis || filtreIlanTipi !== 'hepsi' || siralama !== 'tarih_yeni';

  if (yetkiKontrol) return (
    <div style={{ minHeight: '100vh', background: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b949e' }}>⏳</div>
  );

  function EditForm({ rawForLlm }: { rawForLlm?: string }) {
    return (
      <div>
        {/* Kullanıcı bilgisi */}
        {duzenleKullanici && (
          <div style={{ background: '#0a0f1a', border: '1px solid #1e3a5f', borderRadius: 6, padding: '8px 12px', marginBottom: 10, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: '#60a5fa', fontSize: '0.78rem', fontWeight: 700 }}>👤 {duzenleKullanici.display_name || 'Adsız'}</span>
            {duzenleKullanici.phone && <span style={{ color: '#8b949e', fontSize: '0.75rem' }}>📞 {duzenleKullanici.phone}</span>}
            {duzenleKullanici.email && <span style={{ color: '#8b949e', fontSize: '0.75rem' }}>✉️ {duzenleKullanici.email}</span>}
            <span style={{
              background: duzenleKullanici.is_active === false ? '#450a0a' : '#0d2b1a',
              color: duzenleKullanici.is_active === false ? '#f87171' : '#22c55e',
              fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 4
            }}>{duzenleKullanici.is_active === false ? '🚫 Askıda' : '✓ Aktif'}</span>
            <span style={{ color: '#4b5563', fontSize: '0.68rem', fontFamily: 'monospace', marginLeft: 'auto' }}>#{duzenleKullanici.id.substring(0, 8)}</span>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
          <div><div style={{ color: '#8b949e', fontSize: '0.68rem', marginBottom: 2 }}>İlan Tipi</div><select value={duzenleData.listing_type} onChange={e => setDuzenleData({ ...duzenleData, listing_type: e.target.value })} style={inp}><option value="yuk">Yük</option><option value="arac">Araç</option></select></div>
          <div><div style={{ color: '#8b949e', fontSize: '0.68rem', marginBottom: 2 }}>Telefon</div><input value={duzenleData.contact_phone} onChange={e => setDuzenleData({ ...duzenleData, contact_phone: e.target.value })} style={inp} /></div>
          <div><div style={{ color: '#8b949e', fontSize: '0.68rem', marginBottom: 2 }}>Kalkış İli</div><select value={duzenleData.origin_city} onChange={e => setDuzenleData({ ...duzenleData, origin_city: e.target.value })} style={inp}>{ILLER.map(il => <option key={il}>{il}</option>)}</select></div>
          <div><div style={{ color: '#8b949e', fontSize: '0.68rem', marginBottom: 2 }}>Kalkış İlçesi</div><IlceGirisi il={duzenleData.origin_city} value={duzenleData.origin_district} onChange={v => setDuzenleData({ ...duzenleData, origin_district: v })} style={inp} placeholder="İlçe" /></div>
          <div><div style={{ color: '#8b949e', fontSize: '0.68rem', marginBottom: 2 }}>Fiyat (TL)</div><input type="number" value={duzenleData.price_offer} onChange={e => setDuzenleData({ ...duzenleData, price_offer: e.target.value })} style={inp} placeholder="Opsiyonel" /></div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ color: '#8b949e', fontSize: '0.68rem', marginBottom: 4 }}>Araç Tipi</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ARAC_TIPLERI.map(tip => { const s = (duzenleData.vehicle_type || [])[0] === tip; return <button key={tip} onClick={() => setDuzenleData({ ...duzenleData, vehicle_type: s ? [] : [tip] })} style={{ padding: '3px 10px', borderRadius: 4, border: '1px solid', borderColor: s ? '#22c55e' : '#374151', background: s ? '#14532d' : '#0d1117', color: s ? '#22c55e' : '#9ca3af', fontSize: '0.78rem', cursor: 'pointer' }}>{tip}</button>; })}
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ color: '#8b949e', fontSize: '0.68rem', marginBottom: 4 }}>Üstyapı</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {UST_YAPI.map(tip => { const s = (duzenleData.body_type || []).includes(tip); return <button key={tip} onClick={() => { const m = duzenleData.body_type || []; setDuzenleData({ ...duzenleData, body_type: s ? m.filter((t: string) => t !== tip) : [...m, tip] }); }} style={{ padding: '3px 10px', borderRadius: 4, border: '1px solid', borderColor: s ? '#60a5fa' : '#374151', background: s ? '#1e3a5f' : '#0d1117', color: s ? '#60a5fa' : '#9ca3af', fontSize: '0.78rem', cursor: 'pointer' }}>{tip}</button>; })}
          </div>
        </div>
        {duzenleData.stops?.map((stop: any, idx: number) => (
          <div key={idx} style={{ background: '#0a0f1a', borderRadius: 6, padding: 10, marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ color: '#f97316', fontSize: '0.68rem', fontWeight: 700 }}>Varış {idx + 1}</div>
              <button onClick={() => stopSil(idx)} style={{ background: '#450a0a', border: 'none', color: '#f87171', borderRadius: 4, padding: '2px 8px', fontSize: '0.72rem', cursor: 'pointer' }}>✕ Sil</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
              <div><div style={{ color: '#8b949e', fontSize: '0.65rem', marginBottom: 2 }}>İl</div><select value={stop.city} onChange={e => stopGuncelle(idx, 'city', e.target.value)} style={inp}>{ILLER.map(il => <option key={il}>{il}</option>)}</select></div>
              <div><div style={{ color: '#8b949e', fontSize: '0.65rem', marginBottom: 2 }}>İlçe</div><IlceGirisi il={stop.city} value={stop.district} onChange={v => stopGuncelle(idx, 'district', v)} style={inp} placeholder="-" /></div>
              <div><div style={{ color: '#8b949e', fontSize: '0.65rem', marginBottom: 2 }}>Ton</div><input type="number" value={stop.weight_ton} onChange={e => stopGuncelle(idx, 'weight_ton', e.target.value)} style={inp} placeholder="-" /></div>
              <div><div style={{ color: '#8b949e', fontSize: '0.65rem', marginBottom: 2 }}>Palet</div><input type="number" value={stop.pallet_count} onChange={e => stopGuncelle(idx, 'pallet_count', e.target.value)} style={inp} placeholder="-" /></div>
            </div>
            <div style={{ marginTop: 6 }}><div style={{ color: '#8b949e', fontSize: '0.65rem', marginBottom: 2 }}>Yük Cinsi</div><input value={stop.cargo_type} onChange={e => stopGuncelle(idx, 'cargo_type', e.target.value)} style={inp} placeholder="Seramik, tekstil..." /></div>
            <div style={{ marginTop: 6 }}><div style={{ color: '#8b949e', fontSize: '0.65rem', marginBottom: 2 }}>Satır Notu</div><input value={stop.notes} onChange={e => stopGuncelle(idx, 'notes', e.target.value)} style={inp} placeholder="Varışa özel not..." /></div>
          </div>
        ))}
        <div style={{ marginBottom: 10 }}><div style={{ color: '#8b949e', fontSize: '0.68rem', marginBottom: 2 }}>Not</div><textarea value={duzenleData.notes} onChange={e => setDuzenleData({ ...duzenleData, notes: e.target.value })} rows={2} style={{ ...inp, resize: 'vertical' }} placeholder="Genel not" /></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={stopEkle} style={{ padding: '5px 12px', borderRadius: 4, border: '1px solid #374151', background: '#0d1117', color: '#22c55e', fontSize: '0.78rem', cursor: 'pointer' }}>+ Varış Ekle</button>
          <button onClick={() => llmSor({ raw_text: rawForLlm || duzenleData.raw_text, notes: duzenleData.notes })} disabled={llmYukleniyor} style={{ padding: '5px 12px', borderRadius: 4, border: '1px solid #374151', background: '#0d1117', color: '#a78bfa', fontSize: '0.78rem', cursor: 'pointer', opacity: llmYukleniyor ? 0.5 : 1 }}>{llmYukleniyor ? '⏳...' : '🤖 LLM\'e Sor'}</button>
        </div>
      </div>
    );
  }

  // ── Sprint 3: Fired rules özeti
  function AuditBilgi({ ilan }: { ilan: any }) {
    const score: number = ilan.audit_score ?? 0;
    if (score === 0) return null;
    const renk = auditRenk(score);
    const logs = ilan.internal_audit_logs;
    const firedRules: any[] = logs?.fired_rules || [];
    return (
      <div style={{ background: '#0a0a12', border: `1px solid ${score >= 71 ? '#450a0a' : '#451a03'}`, borderRadius: 6, padding: '10px 12px', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: firedRules.length > 0 ? 8 : 0 }}>
          <span style={{ background: renk.bg, color: renk.color, fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
            {renk.label}
          </span>
          {ilan.is_shadow_banned && (
            <span style={{ background: '#450a0a', color: '#f87171', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
              👁 Shadow Banned
            </span>
          )}
          {logs?.scanned_at && (
            <span style={{ color: '#4b5563', fontSize: '0.68rem' }}>
              Tarandı: {new Date(logs.scanned_at).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        {firedRules.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {firedRules.map((r: any, i: number) => (
              <span key={i} style={{ background: '#1a0808', color: '#f87171', fontSize: '0.68rem', padding: '2px 7px', borderRadius: 4, border: '1px solid #450a0a' }}>
                ⚠️ {r.description || r.rule_id} (+{r.weight})
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>

      {/* Düzeltme İste Modalı */}
      {duzeltmeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#161b22', border: '1px solid #854d0e', borderRadius: 12, padding: 24, width: '100%', maxWidth: 480 }}>
            <div style={{ color: '#fbbf24', fontWeight: 800, fontSize: '1rem', marginBottom: 4 }}>
              ✏️ Düzeltme İste
            </div>
            <div style={{ color: '#6b7280', fontSize: '0.78rem', marginBottom: 16 }}>
              {duzeltmeModal.bulk ? `${duzeltmeModal.bulk.length} ilan` : '1 ilan'} için düzeltme talebi gönderilecek.
            </div>

            {/* Sebep seçimi */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ color: '#8b949e', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>Neden?</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {DUZELTME_SEBEPLER.map(sebep => (
                  <label key={sebep} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '7px 10px', borderRadius: 6, background: duzeltmeSebep === sebep ? '#2a1d00' : 'transparent', border: `1px solid ${duzeltmeSebep === sebep ? '#854d0e' : '#30363d'}` }}>
                    <input type="radio" name="sebep" value={sebep} checked={duzeltmeSebep === sebep}
                      onChange={() => setDuzeltmeSebep(sebep)}
                      style={{ accentColor: '#fbbf24', width: 14, height: 14, cursor: 'pointer' }} />
                    <span style={{ color: duzeltmeSebep === sebep ? '#fbbf24' : '#e2e8f0', fontSize: '0.85rem' }}>{sebep}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Ek mesaj */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ color: '#8b949e', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>Ek Açıklama (opsiyonel)</div>
              <textarea value={duzeltmeMesaj} onChange={e => setDuzeltmeMesaj(e.target.value)}
                placeholder="Kullanıcıya görünecek ek not..."
                rows={3}
                style={{ width: '100%', background: '#0d1117', color: '#e2e8f0', border: '1px solid #374151', borderRadius: 6, padding: '8px 10px', fontSize: '0.85rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={duzeltmeIsteOnayla}
                disabled={!duzeltmeSebep}
                style={{ flex: 1, background: duzeltmeSebep ? '#fbbf24' : '#1f2937', color: duzeltmeSebep ? '#000' : '#4b5563', border: 'none', borderRadius: 8, padding: '10px', fontWeight: 700, fontSize: '0.88rem', cursor: duzeltmeSebep ? 'pointer' : 'not-allowed' }}>
                Gönder
              </button>
              <button
                onClick={() => { setDuzeltmeModal(null); setDuzeltmeSebep(''); setDuzeltmeMesaj(''); }}
                style={{ flex: 1, background: 'none', border: '1px solid #30363d', color: '#8b949e', borderRadius: 8, padding: '10px', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer' }}>
                İptal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 20 Ağu 2026 — mobilde filtre satırı çok yer kaplıyordu. Masaüstünde
          davranış AYNI kalsın diye JS state ile değil, CSS media query ile
          gizleniyor: `.mod-filtre-toggle` yalnız dar ekranda görünür,
          `.mod-filtre-satiri` yalnız dar ekranda ve `.acik` yokken gizlenir. */}
      <style>{`
        .mod-filtre-toggle { display: none; }
        .mod-filtre-satiri { display: flex; }
        @media (max-width: 768px) {
          .mod-filtre-toggle { display: block; }
          .mod-filtre-satiri { display: none; }
          .mod-filtre-satiri.acik { display: flex; }
        }
      `}</style>

      {/* NAV */}
      <nav style={{ background: '#161b22', borderBottom: '1px solid #30363d', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 16px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/logo.svg" alt="Yükegel" style={{ width: 24, height: 24 }} />
            <span style={{ fontWeight: 800, fontSize: '1rem' }}><span style={{ color: '#22c55e' }}>YÜKE</span><span style={{ color: '#e2e8f0' }}>GEL</span></span>
            <span style={{ color: '#8b949e', fontSize: '0.8rem' }}>/ Moderatör</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link href="/moderator/whatsapp-yukle" style={{ color: '#4ade80', fontSize: '0.8rem', textDecoration: 'none', border: '1px solid #166534', borderRadius: 6, padding: '4px 12px' }}>
              📱 WhatsApp Yükle
            </Link>
            <button onClick={cikisYap} style={{ background: 'none', border: '1px solid #30363d', color: '#8b949e', borderRadius: 6, padding: '4px 12px', fontSize: '0.8rem', cursor: 'pointer' }}>Çıkış</button>
          </div>
        </div>
      </nav>

      {/* İSTATİSTİK BAR */}
      {istatistik && (
        <div style={{ background: '#0d1117', borderBottom: '1px solid #1f2937' }}>
          <div style={{ maxWidth: 1400, margin: '0 auto', padding: '10px 16px', display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 16 }}>
              {[
                { label: 'Bekleyen',        val: istatistik.pending,        color: '#fb923c' },
                { label: 'Bugün Gelen',     val: istatistik.bugunGelen,     color: '#60a5fa' },
                { label: 'Bugün Onaylanan', val: istatistik.bugunOnaylanan, color: '#22c55e' },
                { label: 'Çözümsüz',        val: istatistik.cozumsuz,       color: '#f87171' },
                { label: 'Mükerrer Excel',  val: istatistik.mukerrer,       color: '#60a5fa' },  // 11 Ağu 2026
                { label: 'Riskli',          val: istatistik.riskli,         color: '#f87171' },  // Sprint 3
              ].map(k => (
                <div key={k.label} style={{ textAlign: 'center' }}>
                  <div style={{ color: k.color, fontWeight: 800, fontSize: '1.4rem', lineHeight: 1 }}>{k.val ?? '—'}</div>
                  <div style={{ color: '#6b7280', fontSize: '0.68rem', marginTop: 2 }}>{k.label}</div>
                </div>
              ))}
            </div>
            {filtre === 'pending' && (
              <div style={{ display: 'flex', gap: 10, marginLeft: 8, borderLeft: '1px solid #1f2937', paddingLeft: 16, flexWrap: 'wrap' }}>
                {[
                  { key: 'yesil', emoji: '🟢', count: yesil,   label: 'Hazır',      bg: '#0d2b1a', border: '#166534', color: '#22c55e' },
                  { key: 'sari',  emoji: '🟡', count: sari,    label: 'Kontrol Et', bg: '#2a1d00', border: '#854d0e', color: '#fbbf24' },
                  { key: 'kirmizi', emoji: '🔴', count: kirmizi, label: 'Düzenleme', bg: '#2a0d0d', border: '#7f1d1d', color: '#f87171' },
                ].map(r => (
                  <button key={r.key} onClick={() => setFiltreSkor(filtreSkor === r.key ? 'hepsi' : r.key as any)}
                    style={{ background: filtreSkor === r.key ? r.bg : 'none', border: '1px solid', borderColor: filtreSkor === r.key ? r.border : '#1f2937', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', color: r.color, fontSize: '0.8rem', fontWeight: 600 }}>
                    {r.emoji} {r.count} {r.label}
                  </button>
                ))}
                {filtreSkor === 'yesil' && yesil > 0 && (
                  <button onClick={topluOnaylaYesil} style={{ background: '#14532d', border: '1px solid #166534', borderRadius: 6, padding: '4px 14px', cursor: 'pointer', color: '#22c55e', fontSize: '0.8rem', fontWeight: 700 }}>⚡ Tümünü Onayla ({yesil})</button>
                )}
                {filtreSkor === 'sari' && sari > 0 && (
                  <button onClick={() => { if (confirm(`${sari} ilan reddedilecek. Emin misin?`)) topluReddet('🟡'); }}
                    style={{ background: '#2a0a0a', border: '1px solid #7f1d1d', borderRadius: 6, padding: '4px 14px', cursor: 'pointer', color: '#f87171', fontSize: '0.8rem', fontWeight: 700 }}>❌ Tümünü Reddet ({sari})</button>
                )}
                {filtreSkor === 'kirmizi' && kirmizi > 0 && (
                  <button onClick={() => { if (confirm(`${kirmizi} ilan reddedilecek. Emin misin?`)) topluReddet('🔴'); }}
                    style={{ background: '#2a0a0a', border: '1px solid #7f1d1d', borderRadius: 6, padding: '4px 14px', cursor: 'pointer', color: '#f87171', fontSize: '0.8rem', fontWeight: 700 }}>❌ Tümünü Reddet ({kirmizi})</button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 8 Ağu 2026 (pratiklik) — klavye kısayolu ipucu. Yalnız kısayolların
          gerçekten aktif olduğu sekmelerde gösterilir (bkz. yukarıdaki `tusa`
          handler'ının filtre kontrolü) — keşfedilebilirlik olmadan bir
          kısayol yok sayılır. */}
      {filtre !== 'arsiv' && filtre !== 'no_lane' && !duzenleId && siralanmis.length > 0 && (
        <div style={{ background: '#0d1117', borderBottom: '1px solid #1f2937', padding: '4px 16px', textAlign: 'center' }}>
          <span style={{ color: '#6b7280', fontSize: '0.68rem' }}>
            ⌨️ Kısayollar: <b style={{ color: '#9ca3af' }}>A</b> onayla · <b style={{ color: '#9ca3af' }}>R</b> reddet ·{' '}
            <b style={{ color: '#9ca3af' }}>S</b>/boşluk sonra · <b style={{ color: '#9ca3af' }}>E</b> düzenle (en üstteki karta uygulanır)
          </span>
        </div>
      )}

      {/* FİLTRE ÇUBUĞU */}
      <div style={{ background: '#161b22', borderBottom: '1px solid #30363d', position: 'sticky', top: 52, zIndex: 40 }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '8px 16px' }}>
          {/* Tab satırı */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
            {filtre !== 'no_lane' && siralanmis.length > 0 && (
              <div onClick={masterToggle} title="Tümünü seç / seçimi kaldır"
                style={{ width: 18, height: 18, border: '2px solid', borderRadius: 4, cursor: 'pointer', flexShrink: 0, borderColor: selectedIds.size > 0 ? '#3b82f6' : '#374151', background: selectedIds.size > 0 && selectedIds.size === siralanmis.length ? '#3b82f6' : selectedIds.size > 0 ? '#1e3a5f' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {selectedIds.size > 0 && (
                  <span style={{ color: selectedIds.size === filtrelenmis.length ? '#fff' : '#60a5fa', fontSize: '0.65rem', fontWeight: 900 }}>
                    {selectedIds.size === filtrelenmis.length ? '✓' : '–'}
                  </span>
                )}
              </div>
            )}
            {/* Tüm tab butonları — Sprint 3: riskli, 14 Ağu: mukerrer_ilan eklendi */}
            {(['pending', 'approved', 'rejected', 'passive', 'hepsi', 'no_lane', 'mukerrer', 'mukerrer_ilan', 'arsiv', 'riskli'] as const).map(f => (
              <button key={f} onClick={() => { setFiltre(f); setSonraBak(new Set()); filtreTemizle(); setSelectedIds(new Set()); setLastClickedIdx(null); }}
                style={{
                  padding: '5px 12px', borderRadius: 6, border: '1px solid',
                  borderColor: filtre === f ? (f === 'arsiv' ? '#854d0e' : f === 'riskli' ? '#7f1d1d' : (f === 'mukerrer' || f === 'mukerrer_ilan') ? '#1e3a5f' : '#22c55e') : '#30363d',
                  background: filtre === f ? (f === 'arsiv' ? '#2a1d00' : f === 'riskli' ? '#2a0d0d' : (f === 'mukerrer' || f === 'mukerrer_ilan') ? '#0d1b2a' : '#14532d') : '#0d1117',
                  color: filtre === f ? (f === 'arsiv' ? '#fbbf24' : f === 'riskli' ? '#f87171' : (f === 'mukerrer' || f === 'mukerrer_ilan') ? '#60a5fa' : '#22c55e') : '#8b949e',
                  fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                }}>
                {f === 'pending'       ? '⏳ Bekleyenler'
                  : f === 'approved'  ? '✅ Onaylananlar'
                  : f === 'rejected'  ? '❌ Reddedilenler'
                  : f === 'passive'   ? '💤 Pasifler'
                  : f === 'no_lane'   ? '🔍 Çözümsüz'
                  : f === 'mukerrer'  ? `🔁 Mükerrer Excel${istatistik?.mukerrer ? ` (${istatistik.mukerrer})` : ''}`
                  : f === 'mukerrer_ilan' ? `🔁 Mükerrer İlan${istatistik?.mukerrerIlan ? ` (${istatistik.mukerrerIlan})` : ''}`
                  : f === 'arsiv'     ? '🗄️ Arşiv'
                  : f === 'riskli'    ? `🔴 Riskli${istatistik?.riskli ? ` (${istatistik.riskli})` : ''}`
                  : '📋 Hepsi'}
              </button>
            ))}
            {sonraBakSayisi > 0 && (
              <button onClick={() => setSonraBakGoster(!sonraBakGoster)}
                style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #451a03', background: sonraBakGoster ? '#451a03' : '#0d1117', color: '#fb923c', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                ⏸ Sonraya ({sonraBakSayisi})
              </button>
            )}
            <span style={{ color: '#8b949e', fontSize: '0.75rem', marginLeft: 'auto' }}>
              {selectedIds.size > 0 && <span style={{ color: '#3b82f6', fontWeight: 700 }}>{selectedIds.size} seçili · </span>}
              {siralanmis.length} / {ilanlar.length} ilan
            </span>
          </div>
          {/* Filtre paneli aç/kapa — yalnız mobilde görünür (bkz. yukarıdaki <style>) */}
          <button onClick={() => setFiltrePanelAcik(v => !v)} className="mod-filtre-toggle"
            style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: `1px solid ${aktifFiltre ? '#22c55e' : '#30363d'}`, background: '#0d1117', color: aktifFiltre ? '#22c55e' : '#8b949e', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', marginBottom: 8 }}>
            🔍 Filtreler{aktifFiltre ? ' (aktif)' : ''} {filtrePanelAcik ? '▲' : '▼'}
          </button>
          {/* Filtre satırı */}
          <div className={`mod-filtre-satiri${filtrePanelAcik ? ' acik' : ''}`} style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1', minWidth: 200 }}>
              <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#4b5563', fontSize: '0.85rem' }}>
                {kullaniciAramaYukleniyor ? '⏳' : omnisearchTip(aramaMetni) ? '👤' : '🔍'}
              </span>
              <input value={aramaMetni} onChange={e => setAramaMetni(e.target.value)}
                placeholder="Ara: tel/email → kullanıcı; şehir, metin..."
                style={{ ...inp, paddingLeft: 28, borderRadius: 6, borderColor: omnisearchTip(aramaMetni) ? '#3b82f6' : '#374151' }} />
            </div>
            <input value={filtreTelefon} onChange={e => setFiltreTelefon(e.target.value)} placeholder="📞 Tel" style={{ ...inp, width: 110, borderRadius: 6 }} />
            <select value={filtreKalkis} onChange={e => setFiltreKalkis(e.target.value)} style={{ ...inp, width: 120, borderRadius: 6 }}>
              <option value=''>📍 Kalkış</option>{ILLER.map(il => <option key={il}>{il}</option>)}
            </select>
            <select value={filtreVaris} onChange={e => setFiltreVaris(e.target.value)} style={{ ...inp, width: 120, borderRadius: 6 }}>
              <option value=''>🏁 Varış</option>{ILLER.map(il => <option key={il}>{il}</option>)}
            </select>
            <select value={filtreAracTipi} onChange={e => setFiltreAracTipi(e.target.value)} style={{ ...inp, width: 110, borderRadius: 6 }}>
              <option value=''>🚛 Araç Tipi</option>{ARAC_TIPLERI.map(t => <option key={t}>{t}</option>)}
            </select>
            <select value={filtreIlanTipi} onChange={e => setFiltreIlanTipi(e.target.value as any)} style={{ ...inp, width: 110, borderRadius: 6 }}>
              <option value='hepsi'>📦 Tüm Tipler</option>
              <option value='yuk'>📦 Yük</option>
              <option value='arac'>🚛 Araç</option>
            </select>
            {/* Kaynak filtresi */}
            <select value={filtreKaynak} onChange={e => setFiltreKaynak(e.target.value)} style={{ ...inp, width: 120, borderRadius: 6 }}>
              <option value=''>📡 Tüm Kaynaklar</option>
              <option value='form'>Yükegel Form</option>
              <option value='whatsapp'>📱 WhatsApp</option>
              <option value='excel'>📄 Excel</option>
              <option value='facebook'>👥 Facebook</option>
            </select>
            {/* Kullanıcı filtresi aktifse göster */}
            {filtreKullaniciId && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1a2535', border: '1px solid #1e3a5f', borderRadius: 6, padding: '4px 10px' }}>
                <span style={{ color: '#60a5fa', fontSize: '0.78rem', fontWeight: 700 }}>👤 {filtreKullaniciAd}</span>
                <button onClick={() => { setFiltreKullaniciId(''); setFiltreKullaniciAd(''); }}
                  style={{ background: 'none', border: 'none', color: '#4b5563', cursor: 'pointer', fontSize: '0.85rem', lineHeight: 1 }}>✕</button>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="date" value={filtreTarihBaslangic} onChange={e => setFiltreTarihBaslangic(e.target.value)} style={{ ...inp, width: 130, borderRadius: 6, colorScheme: 'dark' }} />
              <span style={{ color: '#4b5563', fontSize: '0.75rem' }}>–</span>
              <input type="date" value={filtreTarihBitis} onChange={e => setFiltreTarihBitis(e.target.value)} style={{ ...inp, width: 130, borderRadius: 6, colorScheme: 'dark' }} />
            </div>
            <select value={siralama} onChange={e => setSiralama(e.target.value as any)}
              style={{ ...inp, width: 170, borderRadius: 6, borderColor: siralama !== 'tarih_yeni' ? '#22c55e' : '#374151' }}>
              <option value='tarih_yeni'>🕐 Yeniden Eskiye</option>
              <option value='tarih_eski'>🕐 Eskiden Yenie</option>
              <option value='audit_yuksek'>⚠️ Risk: Yüksekten Düşüğe</option>
              <option value='audit_dusuk'>⚠️ Risk: Düşükten Yükseğe</option>
              <option value='kalite_yuksek'>✅ Kalite: İyiden Kötüye</option>
              <option value='kalite_dusuk'>❌ Kalite: Kötüden İyiye</option>
            </select>
            {aktifFiltre && (
              <button onClick={filtreTemizle} style={{ background: 'none', border: '1px solid #374151', color: '#6b7280', borderRadius: 6, padding: '4px 10px', fontSize: '0.78rem', cursor: 'pointer' }}>✕ Temizle</button>
            )}
          </div>
        </div>
      </div>

      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '16px', paddingBottom: selectedIds.size > 0 ? 100 : 16 }}>

        {/* Omnisearch sonuçları */}
        {kullaniciBulguList.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: '#3b82f6', fontSize: '0.72rem', fontWeight: 700, marginBottom: 8, letterSpacing: '0.06em' }}>
              👤 KULLANICI SONUÇLARI ({kullaniciBulguList.length})
            </div>
            {kullaniciBulguList.map(k => (
              <KullaniciKart key={k.id} kullanici={k} onAskiya={kullaniciAskiyaAl}
                onFiltrele={(id, ad) => { setFiltreKullaniciId(id); setFiltreKullaniciAd(ad); setKullaniciBulguList([]); setAramaMetni(''); }}
              />
            ))}
            <div style={{ height: 1, background: '#1f2937', marginBottom: 16 }} />
          </div>
        )}

        {filtre === 'mukerrer' ? (
          /* ── Mükerrer Excel tab (11 Ağu 2026) ──
             Excel toplu yüklemede dedup_hash'i var olan bir ilana çarpan gruplar.
             Moderatör "araç/tonaj farklı, mükerrer değil" derse onaylar (ilan
             yazılır), gerçekten aynıysa reddeder. Aksiyonlar server action
             (`excel_dedup_staging` istemciye kapalı). */
          <div style={{ display: 'grid', gap: 10 }}>
            {mukerrerListesi.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#4b5563' }}><div style={{ fontSize: '2rem', marginBottom: 8 }}>✅</div><div>Bekleyen mükerrer Excel ilanı yok</div></div>
            ) : mukerrerListesi.map(kayit => (
              <div key={kayit.id} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '14px 16px' }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ background: '#0d1b2a', color: '#60a5fa', fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>🔁 Mükerrer Excel</span>
                  {kayit.seferNo && <span style={{ color: '#9ca3af', fontSize: '0.72rem' }}>Sefer {kayit.seferNo}</span>}
                  <span style={{ color: '#4b5563', fontSize: '0.72rem' }}>{new Date(kayit.createdAt).toLocaleString('tr-TR')}</span>
                  {kayit.matchedListingId && (
                    <a href={`/ilan/${kayit.matchedListingId}`} target="_blank" rel="noopener noreferrer"
                      style={{ color: '#60a5fa', fontSize: '0.72rem', marginLeft: 'auto', textDecoration: 'underline' }}>
                      Çakışan ilanı gör ↗
                    </a>
                  )}
                </div>
                <div style={{ background: '#0d1117', borderRadius: 6, padding: 12, border: '1px solid #1f2937', marginBottom: 10 }}>
                  <div style={{ color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 700, marginBottom: 4 }}>
                    {kayit.ozet.kalkis || '—'} → {kayit.ozet.varislar.join(', ') || '—'}
                  </div>
                  <div style={{ color: '#8b949e', fontSize: '0.76rem', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {kayit.ozet.tarih && <span>📅 {kayit.ozet.tarih}</span>}
                    {kayit.ozet.aracTipi && <span>🚛 {kayit.ozet.aracTipi}</span>}
                    {kayit.ozet.fiyat && <span>💰 {kayit.ozet.fiyat} TL</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button disabled={mukerrerIslem === kayit.id} onClick={async () => {
                    setMukerrerIslem(kayit.id);
                    const res = await mukerrerExcelOnayla(kayit.id);
                    setMukerrerIslem('');
                    if (!res.ok) { alert('Onaylanamadı: ' + res.hata); return; }
                    setMukerrerListesi(prev => prev.filter(k => k.id !== kayit.id));
                    getIstatistik();
                  }} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#14532d', color: '#22c55e', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', opacity: mukerrerIslem === kayit.id ? 0.5 : 1 }}>
                    {mukerrerIslem === kayit.id ? '...' : '✅ Mükerrer Değil, Yayınla'}
                  </button>
                  <button disabled={mukerrerIslem === kayit.id} onClick={async () => {
                    setMukerrerIslem(kayit.id);
                    const res = await mukerrerExcelReddet(kayit.id);
                    setMukerrerIslem('');
                    if (!res.ok) { alert('Reddedilemedi: ' + res.hata); return; }
                    setMukerrerListesi(prev => prev.filter(k => k.id !== kayit.id));
                    getIstatistik();
                  }} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#450a0a', color: '#f87171', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', opacity: mukerrerIslem === kayit.id ? 0.5 : 1 }}>
                    ❌ Gerçekten Mükerrer
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : filtre === 'mukerrer_ilan' ? (
          /* ── Mükerrer İlan tab (14 Ağu 2026) ──
             Aynı telefon + kalkış ili kombinasyonundan birden fazla aktif ilan.
             Moderatör her ilanı tek tek veya grubu toplu arşivleyebilir.
             Aksiyon: `mukerrerIlanArsivle` (server action, service role). */
          <div style={{ display: 'grid', gap: 16 }}>
            {mukerrerIlanGruplar.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#4b5563' }}>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>✅</div>
                <div>Telefon bazlı mükerrer ilan grubu yok</div>
              </div>
            ) : mukerrerIlanGruplar.map(grup => (
              <div key={`${grup.telefonHam}|${grup.ilId}`}
                style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '14px 16px' }}>
                {/* Grup başlığı */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
                  <span style={{ background: '#0d1b2a', color: '#60a5fa', fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
                    🔁 Mükerrer İlan
                  </span>
                  <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.85rem' }}>
                    📍 {grup.ilAdi}
                  </span>
                  <span style={{ color: '#9ca3af', fontSize: '0.76rem' }}>
                    📞 ···{grup.telefonSon4} · {grup.adet} ilan
                  </span>
                  <button
                    disabled={mukerrerIlanIslem.startsWith(`${grup.telefonHam}|${grup.ilId}`)}
                    onClick={async () => {
                      // En yeni hariç tümünü arşivle
                      const eskiler = [...grup.ilanlar].sort(
                        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                      ).slice(1);
                      setMukerrerIlanIslem(`${grup.telefonHam}|${grup.ilId}_toplu`);
                      const hatalar: string[] = [];
                      for (const ilan of eskiler) {
                        const res = await mukerrerIlanArsivle(ilan.id);
                        if (!res.ok) hatalar.push(ilan.id);
                      }
                      setMukerrerIlanIslem('');
                      if (hatalar.length > 0) { alert(`${hatalar.length} ilan arşivlenemedi.`); }
                      // Arşivlenen ilanları gruptan çıkar; 1 kalırsa grubu kaldır
                      const arsivlenenIds = new Set(eskiler.filter((_, i) => !hatalar.includes(eskiler[i].id)).map(i => i.id));
                      setMukerrerIlanGruplar(prev => prev
                        .map(g => g.telefonHam === grup.telefonHam && g.ilId === grup.ilId
                          ? { ...g, ilanlar: g.ilanlar.filter(il => !arsivlenenIds.has(il.id)) }
                          : g)
                        .filter(g => g.ilanlar.length > 1));
                    }}
                    style={{ marginLeft: 'auto', padding: '4px 12px', borderRadius: 6, border: 'none', background: '#450a0a', color: '#f87171', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', opacity: mukerrerIlanIslem.startsWith(`${grup.telefonHam}|${grup.ilId}`) ? 0.5 : 1 }}>
                    {mukerrerIlanIslem === `${grup.telefonHam}|${grup.ilId}_toplu` ? '...' : '🗑 Tümünü Arşivle (En Yenisi Hariç)'}
                  </button>
                </div>
                {/* İlan listesi */}
                <div style={{ display: 'grid', gap: 6 }}>
                  {[...grup.ilanlar].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((ilan, idx) => (
                    <div key={ilan.id} style={{ background: '#0d1117', borderRadius: 6, border: `1px solid ${idx === 0 ? '#166534' : '#1f2937'}`, padding: '8px 12px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      {idx === 0 && (
                        <span style={{ background: '#14532d', color: '#4ade80', fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 3, flexShrink: 0 }}>EN YENİ</span>
                      )}
                      <span style={{ color: '#9ca3af', fontSize: '0.75rem', flexShrink: 0 }}>
                        {new Date(ilan.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      {ilan.priceOffer && (
                        <span style={{ color: '#34d399', fontSize: '0.78rem', fontWeight: 600, flexShrink: 0 }}>
                          ₺{Number(ilan.priceOffer).toLocaleString('tr-TR')}
                        </span>
                      )}
                      {ilan.notes && (
                        <span style={{ color: '#6b7280', fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                          {ilan.notes.slice(0, 80)}
                        </span>
                      )}
                      <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                        <a href={`/ilan/${ilan.id}`} target="_blank" rel="noopener noreferrer"
                          style={{ color: '#60a5fa', fontSize: '0.72rem', textDecoration: 'underline' }}>
                          Gör ↗
                        </a>
                        <button
                          disabled={mukerrerIlanIslem === ilan.id}
                          onClick={async () => {
                            setMukerrerIlanIslem(ilan.id);
                            const res = await mukerrerIlanArsivle(ilan.id);
                            setMukerrerIlanIslem('');
                            if (!res.ok) { alert('Arşivlenemedi: ' + res.hata); return; }
                            setMukerrerIlanGruplar(prev => prev
                              .map(g => g.telefonHam === grup.telefonHam && g.ilId === grup.ilId
                                ? { ...g, ilanlar: g.ilanlar.filter(il => il.id !== ilan.id) }
                                : g)
                              .filter(g => g.ilanlar.length > 1));
                          }}
                          style={{ padding: '3px 10px', borderRadius: 5, border: 'none', background: mukerrerIlanIslem === ilan.id ? '#374151' : '#450a0a', color: '#f87171', fontWeight: 700, fontSize: '0.72rem', cursor: mukerrerIlanIslem === ilan.id ? 'not-allowed' : 'pointer' }}>
                          {mukerrerIlanIslem === ilan.id ? '...' : 'Arşivle'}
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : filtre === 'no_lane' ? (
          /* ── Çözümsüz tab */
          <div style={{ display: 'grid', gap: 10 }}>
            {noLaneListesi.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#4b5563' }}><div style={{ fontSize: '2rem', marginBottom: 8 }}>✅</div><div>Çözümsüz mesaj yok</div></div>
            ) : noLaneListesi.map(raw => (
              <div key={raw.id} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '14px 16px' }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 10, alignItems: 'center' }}>
                  <span style={{ background: '#1f2937', color: '#9ca3af', fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>🔍 Çözümsüz</span>
                  <span style={{ color: '#4b5563', fontSize: '0.72rem' }}>{raw.source_group} · {raw.sender_name}</span>
                  <span style={{ color: '#4b5563', fontSize: '0.68rem', marginLeft: 'auto', fontFamily: 'monospace' }}>#{raw.id.substring(0, 8)}</span>
                </div>
                <div style={{ background: '#0d1117', borderRadius: 6, padding: 12, border: '1px solid #1f2937', marginBottom: 10 }}>
                  <div style={{ color: '#94a3b8', fontSize: '0.78rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto', wordBreak: 'break-word' }}>{raw.raw_text}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => {
                    setDuzenleData({ listing_type: 'yuk', origin_city: 'İstanbul', origin_district: '', contact_phone: '', price_offer: '', notes: temizNotes(raw.raw_text), vehicle_type: [], body_type: [], raw_post_id: raw.id, raw_text: raw.raw_text, stops: [{ id: null, city: 'İstanbul', district: '', weight_ton: '', pallet_count: '', vehicle_count: 1, cargo_type: '', notes: '' }] });
                    setNoLaneDuzenleId(raw.id);
                  }} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #1e3a5f', background: '#1e3a5f', color: '#60a5fa', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>✏️ Manuel Gir</button>
                  <button onClick={async () => { await supabase.from('raw_posts').update({ processing_status: 'rejected' }).eq('id', raw.id); setNoLaneListesi(prev => prev.filter(r => r.id !== raw.id)); }}
                    style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#450a0a', color: '#f87171', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>❌ Reddet</button>
                </div>
                {noLaneDuzenleId === raw.id && (
                  <div style={{ marginTop: 12, borderTop: '1px solid #1f2937', paddingTop: 12 }}>
                    {EditForm({ rawForLlm: raw.raw_text })}
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button onClick={async () => {
                        // ILAN_VER_ANALIZ W1+ — burada eskiden TARAYICIDAN atılan bir
                        // `listings` INSERT'i ve ardından `listing_stops` için bir `for`
                        // döngüsü vardı. Üç sorunu birden taşıyordu: alanlar beyaz listeden
                        // geçmiyordu (V1), durak insert'i patlarsa duraksız ilan kalıyordu
                        // (V5) ve `moderation_status`/`trust_level` gibi ayrıcalıklı alanlar
                        // istemciden yazılıyordu. Hepsi `moderatorIlanOlustur()`'a taşındı;
                        // o da `ilan_olustur()` RPC'siyle tek transaction'da yazıyor.
                        // Telefon + `raw_posts` işaretlemesi de artık server action'ın işi.
                        const sonuc = await moderatorIlanOlustur({
                          listing_type: duzenleData.listing_type,
                          origin_city: duzenleData.origin_city,
                          origin_district: duzenleData.origin_district || null,
                          kaynak: raw.source || 'whatsapp',
                          raw_post_id: raw.id,
                          raw_text: raw.raw_text,
                          notes: duzenleData.notes,
                          vehicle_type: duzenleData.vehicle_type,
                          body_type: duzenleData.body_type,
                          contact_phone: duzenleData.contact_phone || null,
                          stops: duzenleData.stops.map((s: any) => ({
                            city: s.city,
                            district: s.district || null,
                            weight_ton: s.weight_ton || null,
                            pallet_count: s.pallet_count || null,
                            vehicle_count: s.vehicle_count || 1,
                            cargo_type: s.cargo_type || null,
                            notes: s.notes || null,
                          })),
                        });
                        if (!sonuc.ok) { alert('İlan oluşturulamadı: ' + sonuc.hata); return; }
                        await aliasOgren(duzenleData);
                        setNoLaneDuzenleId('');
                        setNoLaneListesi(prev => prev.filter(r => r.id !== raw.id));
                        getIstatistik();
                      }} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: '#22c55e', color: '#000', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>✅ Kaydet ve Onayla</button>
                      <button onClick={() => setNoLaneDuzenleId('')} style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #374151', background: '#1f2937', color: '#9ca3af', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>✕ İptal</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : yukleniyor ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#4b5563' }}>⏳ Yükleniyor...</div>
        ) : siralanmis.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#4b5563' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>{filtre === 'riskli' ? '✅' : '🔍'}</div>
            <div>{filtre === 'riskli' ? 'Riskli ilan yok, platform temiz!' : 'Filtrelerle eşleşen ilan bulunamadı'}</div>
            {sonraBakSayisi > 0 && <button onClick={() => setSonraBakGoster(true)} style={{ marginTop: 16, background: 'none', border: '1px solid #451a03', color: '#fb923c', borderRadius: 6, padding: '6px 16px', cursor: 'pointer', fontSize: '0.85rem' }}>⏸ Sonraya bırakılanları göster ({sonraBakSayisi})</button>}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {siralanmis.map((ilan, idx) => {
              const durum = DURUM_RENK[ilan.moderation_status] || DURUM_RENK.passive;
              const isYuk = ilan.listing_type === 'yuk';
              const durumIslem = islem === ilan.id;
              const duzenleniyor = duzenleId === ilan.id;
              const stops = (ilan.listing_stops || []).sort((a: any, b: any) => a.stop_order - b.stop_order);
              const hasSosyal = (ilan.source === 'whatsapp' || ilan.source === 'facebook') && ilan.raw_text;
              const skor = skorRenk(ilan);
              const secili = selectedIds.has(ilan.id);
              const auditScore: number = ilan.audit_score ?? 0;
              const isShadowBanned: boolean = ilan.is_shadow_banned ?? false;

              // Riskli tab'da kart kenarlığı audit score'a göre
              const kartBorder = filtre === 'riskli'
                ? (auditScore >= 71 ? '#7f1d1d' : '#854d0e')
                : (duzenleniyor ? '#22c55e' : secili ? '#3b82f6' : skor.border);

              return (
                <div key={ilan.id} ref={el => { ilanRefs.current[ilan.id] = el; }}
                  style={{ background: '#161b22', border: `1px solid ${kartBorder}`, borderRadius: 8, padding: '14px 16px', scrollMarginTop: 130 }}>

                  {/* Başlık */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div onClick={(e) => handleCheckbox(ilan.id, idx, e)} title="Seç (Shift+Click: aralık seç)"
                      style={{ width: 18, height: 18, border: '2px solid', borderRadius: 4, cursor: 'pointer', flexShrink: 0, borderColor: secili ? '#3b82f6' : '#374151', background: secili ? '#3b82f6' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {secili && <span style={{ color: '#fff', fontSize: '0.65rem', fontWeight: 900 }}>✓</span>}
                    </div>
                    <span style={{ fontSize: '1rem' }}>{skor.badge}</span>
                    <span style={{ background: '#1f2937', color: '#9ca3af', fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 4 }}>{skor.label}</span>
                    <span title="Kalite puanı (100 üzerinden)" style={{ background: '#0a1a0a', color: skor.badge === '🟢' ? '#22c55e' : skor.badge === '🟡' ? '#fbbf24' : '#f87171', fontSize: '0.65rem', fontWeight: 800, padding: '1px 7px', borderRadius: 4, border: `1px solid ${skor.badge === '🟢' ? '#166534' : skor.badge === '🟡' ? '#854d0e' : '#7f1d1d'}` }}>{skor.puan}/100</span>
                    <span style={{ background: isYuk ? '#7f1d1d' : '#14532d', color: isYuk ? '#fca5a5' : '#86efac', fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>{isYuk ? '🔴 YÜK' : '🟢 ARAÇ'}</span>
                    <span style={{ background: durum.bg, color: durum.color, fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>{ilan.moderation_status}</span>
                    {/* Sprint 3: audit score badge — sadece score > 0 ise */}
                    {auditScore > 0 && (() => {
                      const ar = auditRenk(auditScore);
                      return <span style={{ background: ar.bg, color: ar.color, fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>{ar.label}</span>;
                    })()}
                    {isShadowBanned && (
                      <span style={{ background: '#450a0a', color: '#f87171', fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>👁 Shadow</span>
                    )}
                    <span style={{ color: '#4b5563', fontSize: '0.72rem' }}>{ilan.source} · {new Date(ilan.created_at).toLocaleDateString('tr-TR')} {new Date(ilan.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                    {/* 20 Ağu 2026 — ham mesaj artık her zaman açık değil, isteğe
                        bağlı kutucuk. Bkz. aşağıdaki `hamMesajAcik` bloğu. */}
                    {hasSosyal && (
                      <button onClick={() => hamMesajToggle(ilan.id)}
                        style={{ background: hamMesajAcik.has(ilan.id) ? '#1e3a5f' : 'none', border: '1px solid #30363d', color: '#60a5fa', fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4, cursor: 'pointer' }}>
                        {ilan.source === 'whatsapp' ? '📱' : '👥'} Ham Mesaj {hamMesajAcik.has(ilan.id) ? '▲' : '▼'}
                      </button>
                    )}
                    <span style={{ color: '#4b5563', fontSize: '0.68rem', marginLeft: 'auto', fontFamily: 'monospace' }}>#{ilan.id.substring(0, 8)}</span>
                  </div>

                  {/* Ham mesaj kutucuğu — yalnız butona basılınca açılır */}
                  {hasSosyal && hamMesajAcik.has(ilan.id) && (
                    <div style={{ background: '#0d1117', borderRadius: 6, padding: 12, border: '1px solid #1f2937', overflow: 'hidden', marginBottom: 12 }}>
                      <div style={{ color: '#8b949e', fontSize: '0.68rem', fontWeight: 700, marginBottom: 6, letterSpacing: '0.05em' }}>{ilan.source === 'whatsapp' ? '📱 WHATSAPP' : '👥 FACEBOOK'}</div>
                      <div style={{ color: '#94a3b8', fontSize: '0.78rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto', overflowX: 'hidden', wordBreak: 'break-word' }}>{ilan.raw_text}</div>
                    </div>
                  )}

                  {/* Sprint 3: Audit bilgi bloğu — riskli tab veya score > 0 olan her ilanda */}
                  {(filtre === 'riskli' || auditScore > 0) && AuditBilgi({ ilan })}

                  {/* İçerik */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginBottom: 12 }}>
                    <div>
                      {duzenleniyor ? (
                        EditForm({})
                      ) : (
                        <div>
                          <div style={{ marginBottom: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                              <span style={{ color: '#22c55e', fontSize: '0.7rem', fontWeight: 700, minWidth: 14 }}>K</span>
                              <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.95rem' }}>{ilAdi(ilan.origin_province_id) ?? '—'}</span>
                              {ilan.origin_district && <span style={{ color: '#8b949e', fontSize: '0.85rem' }}>/ {ilan.origin_district}</span>}
                            </div>
                            {stops.map((s: any, i: number) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
                                <span style={{ color: '#f97316', fontSize: '0.7rem', fontWeight: 700, minWidth: 14 }}>V</span>
                                <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.95rem' }}>{ilAdi(s.province_id) ?? '—'}</span>
                                {s.district && <span style={{ color: '#8b949e', fontSize: '0.85rem' }}>/ {s.district}</span>}
                                {s.weight_ton && <span style={{ color: '#94a3b8', fontSize: '0.78rem', marginLeft: 4 }}>⚖ {s.weight_ton}t</span>}
                                {s.pallet_count && <span style={{ color: '#94a3b8', fontSize: '0.78rem', marginLeft: 4 }}>📦 {s.pallet_count}p</span>}
                                {s.vehicle_count > 1 && <span style={{ color: '#60a5fa', fontSize: '0.78rem', marginLeft: 4 }}>{s.vehicle_count} araç</span>}
                                {s.cargo_type && <span style={{ color: '#8b949e', fontSize: '0.78rem', marginLeft: 4 }}>· {s.cargo_type}</span>}
                              </div>
                            ))}
                          </div>
                          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ color: '#60a5fa', fontSize: '0.85rem', fontWeight: 600 }}>📞 {ilan.contact_phone || '—'}</span>
                            {(ilan.vehicle_type || []).map((v: string) => <span key={v} style={{ background: '#1a2535', color: '#60a5fa', fontSize: '0.72rem', padding: '1px 6px', borderRadius: 4 }}>🚛 {v}</span>)}
                            {(ilan.body_type || []).map((b: string) => <span key={b} style={{ background: '#1f2937', color: '#94a3b8', fontSize: '0.72rem', padding: '1px 6px', borderRadius: 4 }}>{b}</span>)}
                            {ilan.price_offer && <span style={{ color: '#22c55e', fontSize: '0.85rem', fontWeight: 600 }}>₺{ilan.price_offer}</span>}
                            {ilan.notes && <span style={{ color: '#8b949e', fontSize: '0.78rem' }}>📝 {ilan.notes.substring(0, 80)}{ilan.notes.length > 80 ? '...' : ''}</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Aksiyonlar */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid #1f2937', paddingTop: 12 }}>
                    {duzenleniyor ? (
                      <>
                        <button onClick={() => duzenleKaydet(ilan.id, 'onayla')} disabled={durumIslem} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#22c55e', color: '#000', fontWeight: 700, fontSize: '0.85rem', opacity: durumIslem ? 0.5 : 1 }}>✅ Kaydet ve Onayla</button>
                        <button onClick={() => duzenleKaydet(ilan.id, 'sadece_kaydet')} disabled={durumIslem} style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #1e3a5f', cursor: 'pointer', background: '#1e3a5f', color: '#60a5fa', fontWeight: 700, fontSize: '0.85rem', opacity: durumIslem ? 0.5 : 1 }}>💾 Sadece Kaydet</button>
                        <button onClick={() => sonraBakEkleVeGec(ilan.id)} style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #374151', cursor: 'pointer', background: '#0d1117', color: '#fb923c', fontWeight: 700, fontSize: '0.85rem' }}>⏸ Sonra</button>
                        <button onClick={() => aksiyon(ilan.id, 'rejected', 'passive')} disabled={durumIslem} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#450a0a', color: '#f87171', fontWeight: 700, fontSize: '0.85rem' }}>❌ Reddet</button>
                        <button onClick={() => setDuzenleId('')} style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #374151', cursor: 'pointer', background: '#1f2937', color: '#9ca3af', fontWeight: 700, fontSize: '0.85rem' }}>✕ İptal</button>
                      </>
                    ) : filtre === 'arsiv' ? (
                      <>
                        <button onClick={() => arsivIslem(ilan.id, true)} disabled={durumIslem} style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #374151', cursor: 'pointer', background: '#1f2937', color: '#e2e8f0', fontWeight: 700, fontSize: '0.85rem', opacity: durumIslem ? 0.5 : 1 }}>↩ Bekleyenlere Al</button>
                        <button onClick={() => aksiyon(ilan.id, 'rejected', 'passive')} disabled={durumIslem} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#450a0a', color: '#f87171', fontWeight: 700, fontSize: '0.85rem' }}>❌ Reddet</button>
                      </>
                    ) : (
                      <>
                        {/* Düzeltme iste — correction_needed değilse ve arşiv/reddi değilse */}
                        {ilan.moderation_status !== 'correction_needed'
                          && ilan.moderation_status !== 'rejected'
                          && ilan.moderation_status !== 'archived' && (
                          <button onClick={() => { setDuzeltmeModal({ id: ilan.id }); setDuzeltmeSebep(''); setDuzeltmeMesaj(''); }} disabled={durumIslem}
                            style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #854d0e', cursor: 'pointer', background: '#2a1d00', color: '#fbbf24', fontWeight: 700, fontSize: '0.85rem', opacity: durumIslem ? 0.5 : 1 }}>
                            ✏️ Düzeltme İste
                          </button>
                        )}
                        {/* Zaten düzeltme bekliyorsa badge göster */}
                        {ilan.moderation_status === 'correction_needed' && (
                          <span style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #854d0e', background: '#2a1d00', color: '#fbbf24', fontSize: '0.82rem', fontWeight: 700 }}>
                            ⏳ Düzeltme Bekleniyor
                          </span>
                        )}
                        {/* Shadow ban kaldır — shadow banned ise önce göster */}
                        {isShadowBanned && (
                          <button onClick={() => shadowBanKaldir(ilan.id)} disabled={durumIslem}
                            style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #166534', cursor: 'pointer', background: '#0d2b1a', color: '#22c55e', fontWeight: 700, fontSize: '0.85rem', opacity: durumIslem ? 0.5 : 1 }}>
                            {durumIslem ? '⏳...' : '👁 Shadow Ban Kaldır'}
                          </button>
                        )}
                        {/* Shadow ban uygula — onaylı ve henüz banned değilse */}
                        {!isShadowBanned && ilan.moderation_status === 'approved' && (
                          <button onClick={() => shadowBanla(ilan.id)} disabled={durumIslem}
                            style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #7f1d1d', cursor: 'pointer', background: '#2a0d0d', color: '#f87171', fontWeight: 700, fontSize: '0.85rem', opacity: durumIslem ? 0.5 : 1 }}>
                            {durumIslem ? '⏳...' : '👁 Shadow Banla'}
                          </button>
                        )}
                        {ilan.moderation_status !== 'approved' && (
                          <button onClick={() => aksiyon(ilan.id, 'approved', 'active')} disabled={durumIslem} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#22c55e', color: '#000', fontWeight: 700, fontSize: '0.85rem', opacity: durumIslem ? 0.5 : 1 }}>✅ Onayla</button>
                        )}
                        <button onClick={() => duzenleAc(ilan)} style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #1e3a5f', cursor: 'pointer', background: '#1e3a5f', color: '#60a5fa', fontWeight: 700, fontSize: '0.85rem' }}>✏️ Düzenle</button>
                        <button onClick={() => sonraBakEkleVeGec(ilan.id)} style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #374151', cursor: 'pointer', background: '#0d1117', color: '#fb923c', fontWeight: 700, fontSize: '0.85rem' }}>⏸ Sonra</button>
                        <button onClick={() => arsivIslem(ilan.id)} disabled={durumIslem} style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #854d0e', cursor: 'pointer', background: '#2a1d00', color: '#fbbf24', fontWeight: 700, fontSize: '0.85rem', opacity: durumIslem ? 0.5 : 1 }}>🗄️ Arşivle</button>
                        {ilan.moderation_status !== 'passive' && ilan.status !== 'passive' && (
                          <button onClick={() => aksiyon(ilan.id, 'passive', 'passive')} disabled={durumIslem} style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #374151', cursor: 'pointer', background: '#1f2937', color: '#9ca3af', fontWeight: 700, fontSize: '0.85rem' }}>💤 Pasif</button>
                        )}
                        {ilan.moderation_status !== 'rejected' && (
                          <button onClick={() => aksiyon(ilan.id, 'rejected', 'passive')} disabled={durumIslem} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#450a0a', color: '#f87171', fontWeight: 700, fontSize: '0.85rem' }}>❌ Reddet</button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Yüzen Toplu İşlem Barı */}
      {selectedIds.size > 0 && (() => {
        const seciliIlanlar = filtrelenmis.filter(i => selectedIds.has(i.id));
        const tumunuOnayli  = seciliIlanlar.every(i => i.moderation_status === 'approved');
        const tumunuReddi   = seciliIlanlar.every(i => i.moderation_status === 'rejected');
        const arsivTabinda  = filtre === 'arsiv';
        // Sprint 3: seçili ilanlardan shadow banned olanlar var mı?
        const hasShadowBanned = seciliIlanlar.some(i => i.is_shadow_banned);
        return (
          <div style={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            background: '#161b22', border: '1px solid #3b82f6', borderRadius: 14,
            padding: '12px 20px', display: 'flex', gap: 10, alignItems: 'center',
            boxShadow: '0 8px 40px rgba(0,0,0,0.7)', zIndex: 100, whiteSpace: 'nowrap',
          }}>
            <span style={{ color: '#3b82f6', fontWeight: 700, fontSize: '0.9rem', marginRight: 4 }}>
              ☑ {selectedIds.size} seçili
            </span>
            {/* Toplu düzeltme iste — seçililer arasında uygun olanlar varsa */}
            {seciliIlanlar.some(i => i.moderation_status !== 'correction_needed' && i.moderation_status !== 'rejected' && i.moderation_status !== 'archived') && (
              <button onClick={() => {
                const ids = seciliIlanlar
                  .filter(i => i.moderation_status !== 'correction_needed' && i.moderation_status !== 'rejected' && i.moderation_status !== 'archived')
                  .map(i => i.id);
                setDuzeltmeModal({ id: ids[0], bulk: ids });
                setDuzeltmeSebep(''); setDuzeltmeMesaj('');
              }} disabled={bulkYukleniyor}
                style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #854d0e', background: '#2a1d00', color: '#fbbf24', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', opacity: bulkYukleniyor ? 0.5 : 1 }}>
                ✏️ Düzeltme İste
              </button>
            )}
            {/* Toplu shadow ban kaldır */}
            {hasShadowBanned && (
              <button onClick={topluShadowBanKaldir} disabled={bulkYukleniyor}
                style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #166534', background: '#0d2b1a', color: '#22c55e', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', opacity: bulkYukleniyor ? 0.5 : 1 }}>
                👁 Shadow Ban Kaldır
              </button>
            )}
            {/* Toplu shadow ban uygula — seçililer arasında approved+not-banned varsa */}
            {seciliIlanlar.some(i => !i.is_shadow_banned && i.moderation_status === 'approved') && (
              <button onClick={async () => {
                const ids = seciliIlanlar.filter(i => !i.is_shadow_banned && i.moderation_status === 'approved').map(i => i.id);
                if (!confirm(`${ids.length} ilan shadow ban'a alınacak. Devam et?`)) return;
                setBulkYukleniyor(true);
                try { await topluApi(ids, 'shadow_ban'); ilanlariYereldeUygula(ids, AKSIYON_ALANLARI.shadow_ban); }
                catch (e: any) { alert('Hata: ' + e.message); }
                setBulkYukleniyor(false); getIstatistik();
              }} disabled={bulkYukleniyor}
                style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #7f1d1d', background: '#2a0d0d', color: '#f87171', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', opacity: bulkYukleniyor ? 0.5 : 1 }}>
                👁 Shadow Banla
              </button>
            )}
            {!arsivTabinda && !tumunuOnayli && (
              <button onClick={() => topluIslem('approve')} disabled={bulkYukleniyor}
                style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#14532d', color: '#22c55e', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', opacity: bulkYukleniyor ? 0.5 : 1 }}>
                ✅ Toplu Onayla
              </button>
            )}
            {arsivTabinda && (
              <button onClick={async () => {
                if (!confirm(`${selectedIds.size} ilan bekleyenlere alınacak. Devam et?`)) return;
                setBulkYukleniyor(true);
                const ids = Array.from(selectedIds);
                try { await topluApi(ids, 'unarchive'); ilanlariYereldeUygula(ids, AKSIYON_ALANLARI.unarchive); }
                catch (e: any) { alert('Hata: ' + e.message); }
                setBulkYukleniyor(false); getIstatistik();
              }} disabled={bulkYukleniyor}
                style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #374151', background: '#1f2937', color: '#e2e8f0', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', opacity: bulkYukleniyor ? 0.5 : 1 }}>
                ↩ Bekleyenlere Al
              </button>
            )}
            {!arsivTabinda && (
              <button onClick={() => topluIslem('archive')} disabled={bulkYukleniyor}
                style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #854d0e', background: '#2a1d00', color: '#fbbf24', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', opacity: bulkYukleniyor ? 0.5 : 1 }}>
                🗄️ Arşivle
              </button>
            )}
            {!tumunuReddi && (
              <button onClick={() => topluIslem('delete')} disabled={bulkYukleniyor}
                style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#450a0a', color: '#f87171', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', opacity: bulkYukleniyor ? 0.5 : 1 }}>
                ❌ Reddet
              </button>
            )}
            <button onClick={() => { setSelectedIds(new Set()); setLastClickedIdx(null); }}
              style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #374151', background: 'none', color: '#6b7280', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
              ✕
            </button>
            {bulkYukleniyor && <span style={{ color: '#8b949e', fontSize: '0.8rem' }}>⏳ İşleniyor...</span>}
          </div>
        );
      })()}
    </div>
  );
}
