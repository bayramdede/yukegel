// lib/loglar.ts — /admin/loglar SAYFASININ ve CSV export route'unun ORTAK veri
// çekme mantığı. 21 Ağu 2026 — sayfa (SATIR_LIMIT=300, ekran) ve export
// (EXPORT_LIMIT=5000, indirme) AYNI fonksiyonları çağırıyor ki iki yol
// birbirinden ayrışıp "ekranda görünen" ile "CSV'ye inen" farklı olmasın.
import { getServiceSupabase } from './auth';
import { ilAdi } from './lokasyon';
import type {
  AdminActionSatir, AuthEventSatir, IlanOzet, Kullanici, ListingViewSatir, SearchQuerySatir,
} from './loglar-format';

export interface Araliku {
  bas?: string | null; // ISO — created_at >= bas
  son?: string | null; // ISO — created_at <= son
  limit: number;
}

function tarihUygula(sorgu: any, a: Araliku) {
  let s = sorgu;
  if (a.bas) s = s.gte('created_at', a.bas);
  if (a.son) s = s.lte('created_at', a.son);
  return s.order('created_at', { ascending: false }).limit(a.limit);
}

async function kullaniciMapOlustur(svc: any, idler: (string | null)[]): Promise<Record<string, Kullanici>> {
  const idSet = new Set(idler.filter(Boolean) as string[]);
  const map: Record<string, Kullanici> = {};
  if (idSet.size === 0) return map;
  const { data } = await svc.from('users').select('id, display_name, email, phone').in('id', [...idSet]);
  for (const k of data ?? []) map[k.id] = { display_name: k.display_name, email: k.email, phone: k.phone };
  return map;
}

export async function authEventsGetir(a: Araliku): Promise<AuthEventSatir[]> {
  const svc = getServiceSupabase();
  const { data } = await tarihUygula(
    svc.from('auth_events').select('id, event, method, reason, user_id, ip, user_agent, created_at'), a
  );
  const rows = (data ?? []) as any[];
  const kullaniciMap = await kullaniciMapOlustur(svc, rows.map(r => r.user_id));
  return rows.map(r => ({ ...r, kullanici: r.user_id ? kullaniciMap[r.user_id] ?? null : null }));
}

export async function searchQueriesGetir(a: Araliku): Promise<SearchQuerySatir[]> {
  const svc = getServiceSupabase();
  const { data } = await tarihUygula(
    svc.from('search_queries').select('id, user_id, kaynak, kalkis_il_id, varis_il_id, tip, sonuc_sayisi, ip, created_at'), a
  );
  const rows = (data ?? []) as any[];
  const kullaniciMap = await kullaniciMapOlustur(svc, rows.map(r => r.user_id));
  return rows.map(r => ({
    ...r,
    kullanici: r.user_id ? kullaniciMap[r.user_id] ?? null : null,
    kalkis_il_adi: r.kalkis_il_id != null ? ilAdi(r.kalkis_il_id) : null,
    varis_il_adi: r.varis_il_id != null ? ilAdi(r.varis_il_id) : null,
  }));
}

export async function listingViewsGetir(a: Araliku): Promise<ListingViewSatir[]> {
  const svc = getServiceSupabase();
  const { data } = await tarihUygula(
    svc.from('listing_views').select('id, listing_id, viewer_user_id, ip, created_at'), a
  );
  const rows = (data ?? []) as any[];
  const kullaniciMap = await kullaniciMapOlustur(svc, rows.map(r => r.viewer_user_id));

  const listingIdSet = new Set(rows.map(r => r.listing_id).filter(Boolean));
  const ilanMap: Record<string, IlanOzet> = {};
  if (listingIdSet.size > 0) {
    const { data: ilanlar } = await svc
      .from('listings')
      .select('id, origin_province_id, listing_type, vehicle_type, body_type, listing_stops(province_id, stop_order)')
      .in('id', [...listingIdSet]);
    for (const i of (ilanlar ?? []) as any[]) {
      const duraklar = ((i.listing_stops || []) as any[]).sort((x, y) => x.stop_order - y.stop_order);
      ilanMap[i.id] = {
        listing_type: i.listing_type,
        kalkis_il_adi: i.origin_province_id != null ? ilAdi(i.origin_province_id) : null,
        varis_il_adi: duraklar[0]?.province_id != null ? ilAdi(duraklar[0].province_id) : null,
        ekstra_durak: Math.max(0, duraklar.length - 1),
        vehicle_type: i.vehicle_type,
        body_type: i.body_type,
      };
    }
  }

  return rows.map(r => ({
    ...r,
    kullanici: r.viewer_user_id ? kullaniciMap[r.viewer_user_id] ?? null : null,
    ilan: ilanMap[r.listing_id] ?? null,
  }));
}

export async function adminActionsGetir(a: Araliku): Promise<AdminActionSatir[]> {
  const svc = getServiceSupabase();
  const { data } = await tarihUygula(
    svc.from('admin_actions').select('id, actor_id, target_user_id, alan, eski_deger, yeni_deger, created_at'), a
  );
  const rows = (data ?? []) as any[];
  const kullaniciMap = await kullaniciMapOlustur(svc, [...rows.map(r => r.actor_id), ...rows.map(r => r.target_user_id)]);
  return rows.map(r => ({
    ...r,
    aktor: r.actor_id ? kullaniciMap[r.actor_id] ?? null : null,
    hedef: r.target_user_id ? kullaniciMap[r.target_user_id] ?? null : null,
  }));
}
