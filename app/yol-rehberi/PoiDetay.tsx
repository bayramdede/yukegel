'use client';

import { useEffect, useState } from 'react';
import { KATEGORILER } from './YolRehberiClient';
import { POI_KATEGORI_ETIKET, POI_KATEGORI_IKON, POI_KATEGORI_RENK } from '../../lib/poi-constants';

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  quick_tags: string[];
  is_verified_visit: boolean;
  review_type: 'verified' | 'guest';
  created_at: string;
  user_id: string;
}

interface PoiDetay {
  id: string;
  name: string;
  description: string | null;
  category: string;
  categories?: string[];   // çoklu alt kategori
  latitude: number;
  longitude: number;
  address: string | null;
  city: string | null;
  phone: string | null;
  website: string | null;
  photos: string[];
  tags: string[];
  badges: Record<string, boolean>;
  estimated_wait_minutes: number | null;
  is_emergency: boolean;
  avg_rating: number;
  review_count: number;
  reviews: Review[];
}

// Kategori bazlı hızlı etiket seçenekleri (yeni + eski backward compat)
const HIZLI_ETIKETLER: Record<string, { pozitif: string[]; negatif: string[] }> = {
  // Yeni kategoriler
  akaryakit_istasyonu: {
    pozitif: ['Temiz', 'Hızlı Servis', 'Geniş Alan', 'Duş İyi', 'TIR Girişi Uygun'],
    negatif: ['Sıra Uzun', 'Kirli WC', 'Pahalı'],
  },
  elektrik_sarj: {
    pozitif: ['Hızlı Şarj', 'Çalışıyor', 'Gölgelik Var'],
    negatif: ['Arızalı', 'Yavaş Şarj', 'Bekleme Var'],
  },
  tir_parki: {
    pozitif: ['Temiz', 'Güvenli', 'Geniş Park Yeri', 'Aydınlık', 'Bekçi Var'],
    negatif: ['Kirli', 'Park Yeri Dar', 'Güvensiz'],
  },
  otel_pansiyon: {
    pozitif: ['Temiz Oda', 'Sessiz', 'Yardımsever', 'Güvenli Park'],
    negatif: ['Gürültülü', 'Oda Kirli', 'Fiyat Yüksek'],
  },
  motor_mekanik: {
    pozitif: ['Usta Dürüst', 'Hızlı', 'Kaliteli İş', 'Uygun Fiyat'],
    negatif: ['Pahalı', 'Yavaş', 'Şüpheli Fiyat'],
  },
  lastikci: {
    pozitif: ['Hızlı', 'Uygun Fiyat', 'İyi Malzeme'],
    negatif: ['Pahalı', 'Yavaş', 'Kalitesiz'],
  },
  elektrik_takograf: {
    pozitif: ['Uzman', 'Hızlı', 'Sertifikalı'],
    negatif: ['Pahalı', 'Yavaş', 'Yetersiz Ekipman'],
  },
  branda_dorse: {
    pozitif: ['Kaliteli İş', 'Hızlı', 'Uygun Fiyat'],
    negatif: ['Pahalı', 'Yavaş', 'Malzeme Kalitesiz'],
  },
  yikama_yaglama: {
    pozitif: ['Temiz', 'Hızlı', 'Uygun Fiyat'],
    negatif: ['Kirli', 'Yavaş', 'Pahalı'],
  },
  acil_yol_yardim: {
    pozitif: ['Hızlı Müdahale', '7/24 Açık', 'Güvenilir'],
    negatif: ['Geç Geldi', 'Pahalı', 'Yetersiz Ekipman'],
  },
  dinlenme_tesisi: {
    pozitif: ['Lezzetli', 'Temiz', 'Doyurucu', 'Uygun Fiyat', 'Rahat Ortam'],
    negatif: ['Pahalı', 'Servis Yavaş', 'Hijyen Sorunu'],
  },
  esnaf_lokantasi: {
    pozitif: ['Lezzetli', 'Temiz', 'Doyurucu', 'Uygun Fiyat', 'Kamyoncu Dostu'],
    negatif: ['Pahalı', 'Servis Yavaş', 'Hijyen Sorunu'],
  },
  kantar: {
    pozitif: ['Hızlı', 'Güvenilir Tartı', 'Personel Yardımsever'],
    negatif: ['Uzun Bekleme', 'Bürokratik'],
  },
  nakliyeciler_sitesi: {
    pozitif: ['Güvenli', 'Geniş Alan', 'Hizmetler Mevcut'],
    negatif: ['Kalabalık', 'Pahalı', 'Güvensiz'],
  },
  gumruk_sinir: {
    pozitif: ['Hızlı Geçiş', 'Organizeli', 'Yardımsever'],
    negatif: ['Uzun Kuyruk', 'Bürokratik', 'Yavaş'],
  },
  antrepo_depo: {
    pozitif: ['Güvenli', 'Temiz', 'Forklift Mevcut'],
    negatif: ['Pahalı', 'Yer Yok', 'Yavaş'],
  },
  // Eski kategoriler (backward compat)
  park_dinlenme: {
    pozitif: ['Temiz', 'Güvenli', 'Geniş Park Yeri', 'Aydınlık'],
    negatif: ['Kirli', 'Park Yeri Dar', 'Güvensiz'],
  },
  yemek: {
    pozitif: ['Lezzetli', 'Temiz', 'Doyurucu', 'Uygun Fiyat'],
    negatif: ['Pahalı', 'Servis Yavaş', 'Hijyen Sorunu'],
  },
  konaklama: {
    pozitif: ['Temiz Oda', 'Sessiz', 'Yardımsever', 'Güvenli Park'],
    negatif: ['Gürültülü', 'Oda Kirli', 'Fiyat Yüksek'],
  },
  tamirci: {
    pozitif: ['Usta Dürüst', 'Hızlı', 'Kaliteli İş', 'Uygun Fiyat'],
    negatif: ['Pahalı', 'Yavaş', 'Şüpheli Fiyat'],
  },
  tesis_akaryakit: {
    pozitif: ['Temiz', 'Hızlı Servis', 'Geniş Alan', 'Duş İyi'],
    negatif: ['Sıra Uzun', 'Kirli WC', 'Pahalı'],
  },
  kantar_resmi: {
    pozitif: ['Hızlı', 'Güvenilir Tartı', 'Personel Yardımsever'],
    negatif: ['Uzun Bekleme', 'Bürokratik'],
  },
};

interface Props {
  poiId: string;
  userLat: number | null;
  userLng: number | null;
  onKapat: () => void;
}

export default function PoiDetay({ poiId, userLat, userLng, onKapat }: Props) {
  const [poi, setPoi] = useState<PoiDetay | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [yorumAcik, setYorumAcik] = useState(false);
  const [yildiz, setYildiz] = useState(0);
  const [yorum, setYorum] = useState('');
  const [secilenEtiketler, setSecilenEtiketler] = useState<string[]>([]);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [mesaj, setMesaj] = useState('');

  useEffect(() => {
    async function fetchDetay() {
      try {
        const res = await fetch(`/api/poi/${poiId}`);
        const json = await res.json();
        if (json.success) setPoi(json.data);
      } catch (err) {
        console.error(err);
      } finally {
        setYukleniyor(false);
      }
    }
    fetchDetay();
  }, [poiId]);

  const handleYolTarifi = () => {
    if (!poi) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${poi.latitude},${poi.longitude}`;
    window.open(url, '_blank');
  };

  const toggleEtiket = (e: string) => {
    setSecilenEtiketler(prev =>
      prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]
    );
  };

  const handleYorumGonder = async () => {
    if (yildiz === 0) { setMesaj('Lütfen puan verin.'); return; }
    setGonderiliyor(true);
    setMesaj('');
    try {
      const res = await fetch(`/api/poi/${poiId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: yildiz,
          comment: yorum || null,
          quick_tags: secilenEtiketler,
          user_lat: userLat,
          user_lng: userLng,
        }),
      });
      const json = await res.json();
      setMesaj(json.message || (json.success ? 'Yorum kaydedildi.' : json.error));
      if (json.success) {
        setYorumAcik(false);
        // Detayı yenile
        const r2 = await fetch(`/api/poi/${poiId}`);
        const j2 = await r2.json();
        if (j2.success) setPoi(j2.data);
      }
    } catch {
      setMesaj('Bir hata oluştu.');
    } finally {
      setGonderiliyor(false);
    }
  };

  const kat = KATEGORILER.find(k => k.key === poi?.category);
  const hizliEtiketler = poi ? HIZLI_ETIKETLER[poi.category] : null;

  return (
    // Overlay
    <div
      onClick={onKapat}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        zIndex: 1000, display: 'flex', alignItems: 'flex-end',
      }}
    >
      {/* Panel */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxHeight: '90dvh',
          background: '#161b22', borderRadius: '16px 16px 0 0',
          overflowY: 'auto', padding: '0 0 32px',
        }}
      >
        {/* Tutamaç */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: '#30363d' }} />
        </div>

        {yukleniyor ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#8b949e' }}>
            Yükleniyor...
          </div>
        ) : !poi ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#ef4444' }}>
            Konum bulunamadı.
          </div>
        ) : (
          <div style={{ padding: '0 20px' }}>
            {/* Başlık */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 10, flexShrink: 0,
                background: kat?.pinColor || '#8b949e',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
              }}>
                {kat?.icon || '📍'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 18, color: '#e6edf3', marginBottom: 4 }}>
                  {poi.name}
                  {poi.is_emergency && (
                    <span style={{ marginLeft: 8, fontSize: 12, color: '#ef4444', fontWeight: 400 }}>
                      🔴 Nöbetçi
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: '#8b949e' }}>
                  {kat?.label}
                  {poi.city && ` · ${poi.city}`}
                </div>
              </div>
            </div>

            {/* Puan */}
            {poi.avg_rating > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
                background: '#0d1117', borderRadius: 8, padding: '8px 12px',
              }}>
                <span style={{ fontSize: 20, color: '#eab308' }}>★</span>
                <span style={{ fontSize: 22, fontWeight: 700, color: '#e6edf3' }}>
                  {poi.avg_rating.toFixed(1)}
                </span>
                <span style={{ fontSize: 13, color: '#8b949e' }}>
                  {poi.review_count} yorum
                </span>
              </div>
            )}

            {/* Tahmini bekleme */}
            {poi.estimated_wait_minutes != null && (
              <div style={{
                background: '#1c2128', border: '1px solid #f59e0b',
                borderRadius: 8, padding: '8px 12px', marginBottom: 12,
                fontSize: 13, color: '#fbbf24',
              }}>
                ⏳ Tahmini bekleme: ~{poi.estimated_wait_minutes} dakika
              </div>
            )}

            {/* Açıklama */}
            {poi.description && (
              <p style={{ fontSize: 14, color: '#8b949e', marginBottom: 12, lineHeight: 1.5 }}>
                {poi.description}
              </p>
            )}

            {/* Adres / Telefon */}
            {poi.address && (
              <div style={{
                background: '#0d1117', borderRadius: 8, padding: '10px 12px',
                marginBottom: 12, fontSize: 13, color: '#8b949e',
              }}>
                📍 {poi.address}
              </div>
            )}

            {/* Tır uygunluk rozetleri */}
            {Object.keys(poi.badges).length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {poi.badges.guvenlik_kamerali && <Badge>🎥 Güvenlik Kameralı</Badge>}
                {poi.badges.agir_vasita_uygun && <Badge>🚛 Ağır Vasıta Uygun</Badge>}
                {poi.badges.dorsesiz_giris && <Badge>✅ Dorsesiz Giriş</Badge>}
              </div>
            )}

            {/* Özellik etiketleri */}
            {poi.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {poi.tags.map(tag => (
                  <span key={tag} style={{
                    fontSize: 12, padding: '4px 8px', borderRadius: 6,
                    background: '#14532d', color: '#22c55e',
                  }}>
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Aksiyon butonları */}
            <div style={{ display: 'flex', gap: 10, marginBottom: poi.phone ? 10 : 20 }}>
              <button
                onClick={handleYolTarifi}
                style={{
                  flex: 1, padding: '13px 0', borderRadius: 10,
                  background: '#22c55e', color: '#0d1117',
                  border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                }}
              >
                🗺️ Yol Tarifi Al
              </button>
            </div>

            {/* Telefon — varsa tam genişlikte, numara görünür */}
            {poi.phone && (
              <a
                href={`tel:${poi.phone}`}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 10, width: '100%', padding: '13px 0', borderRadius: 10,
                  background: poi.category === 'tamirci' ? '#7f1d1d' : '#21262d',
                  border: `1px solid ${poi.category === 'tamirci' ? '#ef4444' : '#30363d'}`,
                  color: poi.category === 'tamirci' ? '#fca5a5' : '#e6edf3',
                  fontWeight: 700, fontSize: 15, cursor: 'pointer',
                  textDecoration: 'none', marginBottom: 20,
                  boxSizing: 'border-box',
                }}
              >
                <span style={{ fontSize: 20 }}>📞</span>
                <span>{poi.phone}</span>
              </a>
            )}

            {/* Yorum yaz butonu */}
            <button
              onClick={() => setYorumAcik(!yorumAcik)}
              style={{
                width: '100%', padding: '10px 0', borderRadius: 8,
                background: 'transparent', border: '1px solid #30363d',
                color: '#8b949e', fontSize: 13, cursor: 'pointer', marginBottom: 16,
              }}
            >
              {yorumAcik ? 'İptal' : '✏️ Değerlendirme Yaz'}
            </button>

            {/* Yorum formu */}
            {yorumAcik && (
              <div style={{
                background: '#0d1117', borderRadius: 10, padding: 16, marginBottom: 20,
              }}>
                {/* Yıldız seçimi */}
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 14 }}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <button
                      key={s}
                      onClick={() => setYildiz(s)}
                      style={{
                        fontSize: 30, background: 'none', border: 'none',
                        cursor: 'pointer', opacity: s <= yildiz ? 1 : 0.3,
                        transition: 'opacity 0.1s',
                      }}
                    >
                      ★
                    </button>
                  ))}
                </div>

                {/* Hızlı etiketler */}
                {hizliEtiketler && (
                  <>
                    <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 6 }}>Hızlı değerlendirme:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                      {hizliEtiketler.pozitif.map(e => (
                        <button
                          key={e}
                          onClick={() => toggleEtiket(e)}
                          style={{
                            padding: '5px 10px', borderRadius: 16, fontSize: 12,
                            border: `1px solid ${secilenEtiketler.includes(e) ? '#22c55e' : '#30363d'}`,
                            background: secilenEtiketler.includes(e) ? '#14532d' : 'transparent',
                            color: secilenEtiketler.includes(e) ? '#22c55e' : '#8b949e',
                            cursor: 'pointer',
                          }}
                        >
                          👍 {e}
                        </button>
                      ))}
                      {hizliEtiketler.negatif.map(e => (
                        <button
                          key={e}
                          onClick={() => toggleEtiket(e)}
                          style={{
                            padding: '5px 10px', borderRadius: 16, fontSize: 12,
                            border: `1px solid ${secilenEtiketler.includes(e) ? '#ef4444' : '#30363d'}`,
                            background: secilenEtiketler.includes(e) ? '#7f1d1d' : 'transparent',
                            color: secilenEtiketler.includes(e) ? '#ef4444' : '#8b949e',
                            cursor: 'pointer',
                          }}
                        >
                          👎 {e}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* Metin yorumu */}
                <textarea
                  value={yorum}
                  onChange={e => setYorum(e.target.value)}
                  placeholder="Opsiyonel: detaylı yorum..."
                  rows={3}
                  style={{
                    width: '100%', background: '#161b22', border: '1px solid #30363d',
                    borderRadius: 8, color: '#e6edf3', padding: '8px 10px',
                    fontSize: 13, resize: 'vertical', boxSizing: 'border-box',
                    fontFamily: "'IBM Plex Sans', sans-serif",
                  }}
                />

                {mesaj && (
                  <div style={{ fontSize: 13, marginTop: 8, color: mesaj.startsWith('✅') ? '#22c55e' : '#f87171' }}>
                    {mesaj}
                  </div>
                )}

                <button
                  onClick={handleYorumGonder}
                  disabled={gonderiliyor || yildiz === 0}
                  style={{
                    marginTop: 12, width: '100%', padding: '10px 0',
                    borderRadius: 8, background: yildiz > 0 ? '#22c55e' : '#21262d',
                    color: yildiz > 0 ? '#0d1117' : '#8b949e',
                    border: 'none', fontWeight: 600, fontSize: 14,
                    cursor: yildiz > 0 ? 'pointer' : 'not-allowed',
                  }}
                >
                  {gonderiliyor ? 'Gönderiliyor...' : 'Puanla ve Kaydet'}
                </button>
              </div>
            )}

            {/* Yorumlar listesi */}
            {poi.reviews.length > 0 && (
              <>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#8b949e', marginBottom: 10 }}>
                  Son Yorumlar
                </div>
                {poi.reviews.map(r => (
                  <div key={r.id} style={{
                    background: '#0d1117', borderRadius: 8, padding: '10px 12px',
                    marginBottom: 8, border: '1px solid #21262d',
                  }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ color: '#eab308', fontSize: 13 }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                      {r.is_verified_visit && (
                        <span style={{ fontSize: 11, color: '#22c55e', background: '#14532d', padding: '2px 6px', borderRadius: 4 }}>
                          ✓ Doğrulanmış Ziyaret
                        </span>
                      )}
                    </div>
                    {r.quick_tags.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                        {r.quick_tags.map(t => (
                          <span key={t} style={{ fontSize: 11, color: '#8b949e', background: '#21262d', padding: '2px 6px', borderRadius: 4 }}>
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {r.comment && (
                      <p style={{ fontSize: 13, color: '#8b949e', margin: 0, lineHeight: 1.5 }}>
                        {r.comment}
                      </p>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 12, padding: '4px 10px', borderRadius: 6,
      background: '#1c2128', border: '1px solid #22c55e', color: '#22c55e',
    }}>
      {children}
    </span>
  );
}
