'use client';

import { useState, useEffect, useCallback } from 'react';
import { ilAdi } from '@/lib/lokasyon';

interface Stop { stop_order: number; province_id: number | null; district: string | null }
interface Satir {
  id: string;
  user_id: string | null;
  status: 'active' | 'passive' | string;
  moderation_status: string;
  contact_phone: string | null;
  origin_province_id: number | null;
  origin_district: string | null;
  created_at: string;
  updated_at: string;
  recurring_until: string | null;
  recurring_confirmed_at: string | null;
  listing_stops: Stop[];
  owner: { display_name: string | null; phone: string | null } | null;
  gunluk_temas: number;
}

function tarih(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function tarihSaat(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** Onay bekliyor mu — 7 gün eşiği panel şeridiyle aynı (yalnız görsel, gerçek karar cron'da). */
function onayBekliyorMu(confirmedAt: string | null): boolean {
  if (!confirmedAt) return true;
  return (Date.now() - new Date(confirmedAt).getTime()) / 86400_000 > 7;
}

export default function SurekliYuklerClient() {
  const [rows, setRows] = useState<Satir[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [durumFiltre, setDurumFiltre] = useState<'' | 'active' | 'passive'>('');
  const [islemId, setIslemId] = useState<string | null>(null);
  const [tarihDuzenle, setTarihDuzenle] = useState<{ id: string; deger: string } | null>(null);

  const yukle = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const qs = durumFiltre ? `?durum=${durumFiltre}` : '';
      const res = await fetch(`/api/admin/surekli-yukler${qs}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Yüklenemedi');
      setRows(d.data ?? []);
    } catch (e: any) {
      setFetchError(e.message);
    }
    setLoading(false);
  }, [durumFiltre]);

  useEffect(() => { yukle(); }, [yukle]);

  async function aksiyon(id: string, action: string, extra?: Record<string, unknown>) {
    setIslemId(id);
    try {
      const res = await fetch(`/api/admin/surekli-yukler/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const d = await res.json();
      if (res.ok) {
        if (action === 'sonlandir') {
          setRows(prev => prev.filter(r => r.id !== id));
        } else {
          setRows(prev => prev.map(r => r.id === id ? { ...r, ...d } : r));
        }
        setTarihDuzenle(null);
      } else {
        alert(d.error || 'Hata oluştu');
      }
    } catch (e: any) {
      alert(e.message);
    }
    setIslemId(null);
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['', 'active', 'passive'] as const).map(v => (
          <button key={v} onClick={() => setDurumFiltre(v)}
            style={{
              padding: '6px 14px', borderRadius: 6, fontSize: '0.82rem', cursor: 'pointer',
              border: `1px solid ${durumFiltre === v ? '#22c55e' : '#30363d'}`,
              background: durumFiltre === v ? '#14532d' : '#161b22',
              color: durumFiltre === v ? '#22c55e' : '#8b949e', fontWeight: durumFiltre === v ? 700 : 400,
            }}>
            {v === '' ? 'Tümü' : v === 'active' ? 'Aktif' : 'Pasif'}
          </button>
        ))}
        <button onClick={yukle} style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 6, fontSize: '0.82rem', border: '1px solid #30363d', background: 'none', color: '#8b949e', cursor: 'pointer' }}>
          ↻ Yenile
        </button>
      </div>

      {loading && <div style={{ color: '#8b949e', padding: 24, textAlign: 'center' }}>Yükleniyor...</div>}
      {fetchError && <div style={{ color: '#f87171', padding: 24, textAlign: 'center' }}>⚠️ {fetchError}</div>}
      {!loading && !fetchError && rows.length === 0 && (
        <div style={{ color: '#8b949e', padding: 24, textAlign: 'center' }}>Sürekli Yük ilanı yok.</div>
      )}

      {!loading && rows.length > 0 && (
        <div style={{ overflowX: 'auto', border: '1px solid #30363d', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: '#161b22' }}>
                {['Hat', 'İlan Veren', 'Başlangıç / Bitiş', 'Son Yenilenme / Son Onay', 'Bugün', 'Durum', 'Aksiyonlar'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#8b949e', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', borderBottom: '1px solid #30363d', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const stops = [...(r.listing_stops || [])].sort((a, b) => a.stop_order - b.stop_order);
                const son = stops[stops.length - 1];
                const kalkisAd = ilAdi(r.origin_province_id) ?? '';
                const varisAd = son ? (ilAdi(son.province_id) ?? '') : '';
                const bekliyor = onayBekliyorMu(r.recurring_confirmed_at);
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid #21262d', opacity: r.status === 'passive' ? 0.7 : 1 }}>
                    <td style={{ padding: 12 }}>
                      <a href={`/ilan/${r.id}`} style={{ color: '#e2e8f0', textDecoration: 'none', fontWeight: 600 }}>
                        {kalkisAd}{r.origin_district ? ` (${r.origin_district})` : ''} → {varisAd}{son?.district ? ` (${son.district})` : ''}
                      </a>
                    </td>
                    <td style={{ padding: 12, color: '#e2e8f0' }}>
                      {r.owner?.display_name || '—'}
                      <div style={{ color: '#8b949e', fontSize: '0.75rem' }}>{r.owner?.phone || r.contact_phone || '—'}</div>
                    </td>
                    <td style={{ padding: 12, color: '#8b949e' }}>
                      {tarih(r.created_at)} → {tarih(r.recurring_until)}
                    </td>
                    <td style={{ padding: 12, color: '#8b949e' }}>
                      {tarihSaat(r.updated_at)}
                      <div style={{ color: bekliyor ? '#fbbf24' : '#8b949e', fontSize: '0.75rem' }}>
                        Onay: {tarihSaat(r.recurring_confirmed_at)}{bekliyor && ' ⚠️'}
                      </div>
                    </td>
                    <td style={{ padding: 12, color: '#e2e8f0', textAlign: 'center' }}>{r.gunluk_temas}</td>
                    <td style={{ padding: 12 }}>
                      <span style={{
                        background: r.status === 'active' ? '#0d2818' : '#1e293b',
                        color: r.status === 'active' ? '#22c55e' : '#94a3b8',
                        fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                      }}>
                        {r.status === 'active' ? (bekliyor ? 'Aktif · onay bekliyor' : 'Aktif') : 'Pasif'}
                      </span>
                    </td>
                    <td style={{ padding: 12 }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {r.status === 'active' ? (
                          <button disabled={islemId === r.id} onClick={() => aksiyon(r.id, 'duraklat')}
                            style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid #30363d', background: 'none', color: '#8b949e', fontSize: '0.75rem', cursor: 'pointer' }}>
                            Duraklat
                          </button>
                        ) : (
                          <button disabled={islemId === r.id} onClick={() => aksiyon(r.id, 'aktiflestir')}
                            style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid #22c55e', background: '#0d2818', color: '#22c55e', fontSize: '0.75rem', cursor: 'pointer' }}>
                            Aktifleştir
                          </button>
                        )}
                        {tarihDuzenle?.id === r.id ? (
                          <>
                            <input type="date" value={tarihDuzenle.deger}
                              onChange={e => setTarihDuzenle({ id: r.id, deger: e.target.value })}
                              style={{ background: '#0d1117', border: '1px solid #30363d', color: '#e2e8f0', borderRadius: 5, padding: '3px 6px', fontSize: '0.75rem' }} />
                            <button disabled={islemId === r.id} onClick={() => aksiyon(r.id, 'tarih_duzenle', { recurring_until: tarihDuzenle.deger })}
                              style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid #22c55e', background: '#0d2818', color: '#22c55e', fontSize: '0.75rem', cursor: 'pointer' }}>
                              ✓
                            </button>
                            <button onClick={() => setTarihDuzenle(null)}
                              style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid #30363d', background: 'none', color: '#8b949e', fontSize: '0.75rem', cursor: 'pointer' }}>
                              ✕
                            </button>
                          </>
                        ) : (
                          <button onClick={() => setTarihDuzenle({ id: r.id, deger: r.recurring_until || '' })}
                            style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid #30363d', background: 'none', color: '#8b949e', fontSize: '0.75rem', cursor: 'pointer' }}>
                            Tarih Düzenle
                          </button>
                        )}
                        <button disabled={islemId === r.id}
                          onClick={() => { if (confirm('Bu Sürekli Yükü kalıcı olarak sonlandırmak istiyor musunuz?')) aksiyon(r.id, 'sonlandir'); }}
                          style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid #7f1d1d', background: 'none', color: '#f87171', fontSize: '0.75rem', cursor: 'pointer' }}>
                          Sonlandır
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
