// lib/loglar-format.ts — /admin/loglar için SAF (DB'siz) yardımcılar.
// Hem istemci bileşeni (LoglarClient.tsx) hem CSV export route'u (server)
// AYNI formatı/filtre mantığını kullansın diye buraya çıkarıldı — ikisi
// ayrışırsa "ekrandaki" ile "indirilen" farklı görünür.

export type Sekme = 'auth' | 'search' | 'view' | 'admin';

export const SEKMELER: readonly Sekme[] = ['auth', 'search', 'view', 'admin'];

export const SEKME_ETIKET: Record<Sekme, string> = {
  auth: '🔐 Giriş Olayları',
  search: '🔍 Arama Sorguları',
  view: '👁️ İlan Görüntülemeleri',
  admin: '🛠️ Admin/Mod İşlemleri',
};

export type Kullanici = { display_name: string | null; email: string | null; phone: string | null } | null;

export type IlanOzet = {
  listing_type: string | null;
  kalkis_il_adi: string | null; varis_il_adi: string | null; ekstra_durak: number;
  vehicle_type: string[] | null; body_type: string[] | null;
} | null;

export type AuthEventSatir = {
  id: number; event: string; method: string; reason: string | null;
  user_id: string | null; ip: string | null; user_agent: string | null;
  created_at: string; kullanici: Kullanici;
};
export type SearchQuerySatir = {
  id: number; user_id: string | null; kaynak: string;
  kalkis_il_id: number | null; varis_il_id: number | null; tip: string | null;
  sonuc_sayisi: number | null; ip: string | null; created_at: string;
  kullanici: Kullanici; kalkis_il_adi: string | null; varis_il_adi: string | null;
};
export type ListingViewSatir = {
  id: number; listing_id: string; viewer_user_id: string | null; ip: string | null;
  created_at: string; kullanici: Kullanici; ilan: IlanOzet;
};
export type AdminActionSatir = {
  id: number; actor_id: string | null; target_user_id: string | null; alan: string;
  eski_deger: unknown; yeni_deger: unknown; created_at: string;
  aktor: Kullanici; hedef: Kullanici;
};

export function tarihFormat(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function kullaniciEtiket(k: Kullanici): string {
  if (!k) return '—';
  return k.display_name || k.email || k.phone || '—';
}

export function kullaniciAramayaUyar(k: Kullanici, q: string): boolean {
  if (!q) return true;
  const hedef = `${k?.display_name ?? ''} ${k?.email ?? ''} ${k?.phone ?? ''}`.toLowerCase();
  return hedef.includes(q);
}

// "Tekirdağ → Ankara +2 · TIR (Tenteli)" — detaya girmeden ilanı tanımaya yeter.
export function ilanOzeti(ilan: IlanOzet): string {
  if (!ilan) return '';
  const rota = [ilan.kalkis_il_adi, ilan.varis_il_adi].filter(Boolean).join(' → ') || '—';
  const durakEki = ilan.ekstra_durak > 0 ? ` +${ilan.ekstra_durak}` : '';
  const arac = (ilan.vehicle_type ?? []).join('/');
  const ustyapi = (ilan.body_type ?? []).length ? ` (${(ilan.body_type ?? []).join('/')})` : '';
  const aracEki = arac ? ` · ${arac}${ustyapi}` : '';
  return `${rota}${durakEki}${aracEki}`;
}
