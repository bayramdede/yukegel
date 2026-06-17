// ─────────────────────────────────────────────
// POI Paylaşılan Sabitler
// Bu dosyayı import eden: PoiEkleModal, PoiOnayClient, YolRehberiClient, api/poi/route
// ─────────────────────────────────────────────

export interface PoiKategori {
  value: string;
  label: string;
  icon: string;
  pinColor: string;
}

/** Yeni eklemeler için seçim listesi — 11 TIR/Kamyon kategorisi */
export const POI_KATEGORILER: PoiKategori[] = [
  { value: 'tir_parki',     label: 'Tır Parkı',          icon: '🅿️', pinColor: '#3b82f6' },
  { value: 'lokanta',       label: 'Kamyoncu Lokantası',  icon: '🍲', pinColor: '#f97316' },
  { value: 'konaklama',     label: 'Konaklama',           icon: '🛏️', pinColor: '#8b5cf6' },
  { value: 'lastikci',      label: 'Lastikçi',            icon: '🔄', pinColor: '#ef4444' },
  { value: 'motorcu',       label: 'Motorcu',             icon: '🔧', pinColor: '#dc2626' },
  { value: 'elektrikci',    label: 'Elektrikçi',          icon: '⚡', pinColor: '#eab308' },
  { value: 'kaportaci',     label: 'Kaportacı',           icon: '🔨', pinColor: '#f59e0b' },
  { value: 'dorse_branda',  label: 'Dorse / Branda',      icon: '🚛', pinColor: '#0ea5e9' },
  { value: 'frigo_ustasi',  label: 'Frigo Ustası',        icon: '❄️', pinColor: '#06b6d4' },
  { value: 'kantar',        label: 'Kantar',              icon: '⚖️', pinColor: '#6b7280' },
  { value: 'yikama',        label: 'Yıkama / Yağlama',    icon: '🚿', pinColor: '#10b981' },
];

/** Eski kategoriler — DB'de mevcut kayıtlar için görüntüleme desteği */
export const POI_ESKI_KATEGORILER: PoiKategori[] = [
  { value: 'park_dinlenme',   label: 'Park & Dinlenme',   icon: '🅿️', pinColor: '#2563eb' },
  { value: 'yemek',           label: 'Yemek',             icon: '🍲', pinColor: '#ea580c' },
  { value: 'tamirci',         label: 'Tamirci',           icon: '🛠️', pinColor: '#b91c1c' },
  { value: 'tesis_akaryakit', label: 'Tesis & Yakıt',     icon: '⛽', pinColor: '#ca8a04' },
  { value: 'kantar_resmi',    label: 'Kantar (Resmi)',     icon: '⚖️', pinColor: '#4b5563' },
];

/** Tüm kategoriler (yeni + eski) — filtreler ve görüntüleme için */
export const POI_TUM_KATEGORILER: PoiKategori[] = [
  ...POI_KATEGORILER,
  ...POI_ESKI_KATEGORILER,
];

/** key → label map (hem yeni hem eski) */
export const POI_KATEGORI_ETIKET: Record<string, string> = Object.fromEntries(
  POI_TUM_KATEGORILER.map(k => [k.value, k.label])
);

/** API validasyonu için geçerli kategori değerleri */
export const POI_GECERLI_KATEGORILER: string[] = POI_TUM_KATEGORILER.map(k => k.value);

/** Etiket önerileri — kategori bazlı */
export const POI_ALT_ETIKETLER: Record<string, string[]> = {
  tir_parki:     ['7/24 Açık', 'Güvenlik Kameralı', 'Duş İmkanı', 'WC', 'Bekçi Var'],
  lokanta:       ['Sulu Yemek', 'Uygun Fiyat', '7/24 Açık', 'Paket Servis', 'Kamyoncu Dostu'],
  konaklama:     ['Tır Park Yeri Var', 'Duş İmkanı', 'Dorseyi Ayırmaya Gerek Yok', '7/24 Resepsiyon'],
  lastikci:      ['Nöbetçi', '7/24 Açık', 'Çekici', 'Balans', 'Rot Balans'],
  motorcu:       ['Nöbetçi', 'Çekici Var', '7/24 Açık', 'Garantili İş', 'Parça Depolu'],
  elektrikci:    ['Nöbetçi', '7/24 Açık', 'Akü Satışı', 'Takometre'],
  kaportaci:     ['Alüminyum', 'Paslanmaz', 'Boya', 'Sigorta İşi'],
  dorse_branda:  ['Branda Değişimi', 'Tenteci', 'Dorse Kaynak', 'Yan Perde'],
  frigo_ustasi:  ['Thermo King', 'Carrier', 'Yedek Parça', 'Soğutucu Gaz'],
  kantar:        ['Vezneli', 'Resmi Tartı', 'CMR', 'Geçiş Belgesi'],
  yikama:        ['Tır Yıkama', 'Motor Yıkama', 'Yağlama', 'Kabin Yıkama'],
  // eski
  park_dinlenme:   ['Tır Park Yeri Var', '7/24 Açık', 'Güvenlik Kameralı', 'Duş İmkanı', 'WC'],
  yemek:           ['Sulu Yemek', 'Kamyoncu Dostu', 'Uygun Fiyat', '7/24 Açık', 'Paket Servis'],
  tamirci:         ['Nöbetçi', '7/24 Açık', 'Çekici', 'Lastik', 'Elektrik'],
  tesis_akaryakit: ['Tır Girişine Uygun', 'Akaryakıt', 'Otopark', 'Duş', 'Kafe'],
  kantar_resmi:    ['Vezneli Kantar', 'Resmi Tartı', 'CMR', 'Geçiş Belgesi'],
};

export const POI_GENEL_ETIKETLER = [
  '7/24 Açık', 'Tır Park Yeri Var', 'Güvenlik Kameralı', 'Duş İmkanı',
  'WC', 'Kamyoncu Dostu', 'Sulu Yemek', 'Nöbetçi', 'Çekici',
  'Uygun Fiyat', 'Dorseyi Ayırmaya Gerek Yok',
];

/** Excel import normalize haritası */
export const POI_KAT_NORM: Record<string, string> = {
  // yeni
  tir_parki: 'tir_parki', 'tır parkı': 'tir_parki',
  lokanta: 'lokanta',
  konaklama: 'konaklama',
  lastikci: 'lastikci', lastikçi: 'lastikci',
  motorcu: 'motorcu',
  elektrikci: 'elektrikci', elektrikçi: 'elektrikci',
  kaportaci: 'kaportaci', kaportacı: 'kaportaci',
  dorse_branda: 'dorse_branda', 'dorse / branda': 'dorse_branda',
  frigo_ustasi: 'frigo_ustasi', 'frigo ustası': 'frigo_ustasi',
  kantar: 'kantar',
  yikama: 'yikama',
  // eski
  park_dinlenme: 'park_dinlenme', 'park & dinlenme': 'park_dinlenme', 'park ve dinlenme': 'park_dinlenme',
  yemek: 'yemek',
  tamirci: 'tamirci', 'tamirci & usta': 'tamirci', 'tamirci ve usta': 'tamirci',
  tesis_akaryakit: 'tesis_akaryakit', 'tesis & akaryakıt': 'tesis_akaryakit',
  'tesis & akaryakit': 'tesis_akaryakit', 'tesis ve akaryakıt': 'tesis_akaryakit',
  kantar_resmi: 'kantar_resmi', 'kantar & resmi': 'kantar_resmi', 'kantar ve resmi': 'kantar_resmi',
};
