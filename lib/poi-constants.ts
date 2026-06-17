// ─────────────────────────────────────────────
// POI Paylaşılan Sabitler — 2 Kademeli Kategori Yapısı
// Bu dosyayı import eden: PoiEkleModal, PoiOnayClient, YolRehberiClient,
//   api/poi/route, api/admin/poi-import/route
// ─────────────────────────────────────────────

// ── Temel tipler ─────────────────────────────

export interface PoiAltKategori {
  value: string;
  label: string;
  icon: string;
  pinColor: string;
}

export interface PoiAnaKategori {
  value: string;       // Ana kategori slug (filtre gruplama için)
  label: string;
  icon: string;
  pinColor: string;    // Haritada ana grup rengi
  cokluSecim: boolean; // Filtrede çoklu alt-kategori seçimine izin ver mi?
  altlar: PoiAltKategori[];
}

// ── Ana kategori + alt kategori hiyerarşisi ──

export const POI_HIYERARSI: PoiAnaKategori[] = [
  {
    value: 'akaryakit_enerji',
    label: 'Akaryakıt & Enerji',
    icon: '⛽',
    pinColor: '#f59e0b',
    cokluSecim: true,
    altlar: [
      { value: 'akaryakit_istasyonu', label: 'Akaryakıt İstasyonu', icon: '⛽', pinColor: '#f59e0b' },
      { value: 'elektrik_sarj',       label: 'Elektrik Şarj Noktası', icon: '🔋', pinColor: '#22c55e' },
    ],
  },
  {
    value: 'park_konaklama',
    label: 'Park & Konaklama',
    icon: '🅿️',
    pinColor: '#3b82f6',
    cokluSecim: true,
    altlar: [
      { value: 'tir_parki',     label: 'TIR Parkı',      icon: '🅿️', pinColor: '#3b82f6' },
      { value: 'otel_pansiyon', label: 'Otel & Pansiyon', icon: '🛏️', pinColor: '#8b5cf6' },
    ],
  },
  {
    value: 'tamir_bakim',
    label: 'Tamir & Bakım',
    icon: '🔧',
    pinColor: '#dc2626',
    cokluSecim: true,
    altlar: [
      { value: 'motor_mekanik',     label: 'Motor & Mekanik',     icon: '🔧', pinColor: '#dc2626' },
      { value: 'lastikci',          label: 'Lastikçi',            icon: '🔄', pinColor: '#ef4444' },
      { value: 'elektrik_takograf', label: 'Elektrik & Takograf', icon: '⚡', pinColor: '#eab308' },
      { value: 'branda_dorse',      label: 'Branda & Dorse',      icon: '🚛', pinColor: '#0ea5e9' },
      { value: 'yikama_yaglama',    label: 'Yıkama & Yağlama',   icon: '🚿', pinColor: '#10b981' },
      { value: 'acil_yol_yardim',   label: 'Acil Yol Yardım',    icon: '🆘', pinColor: '#b91c1c' },
    ],
  },
  {
    value: 'yeme_icme',
    label: 'Yeme & İçme',
    icon: '🍽️',
    pinColor: '#f97316',
    cokluSecim: true,
    altlar: [
      { value: 'dinlenme_tesisi', label: 'Dinlenme Tesisi', icon: '☕', pinColor: '#f97316' },
      { value: 'esnaf_lokantasi', label: 'Esnaf Lokantası', icon: '🍲', pinColor: '#ea580c' },
    ],
  },
  {
    value: 'operasyon',
    label: 'Operasyon Noktaları',
    icon: '🏭',
    pinColor: '#6b7280',
    cokluSecim: false, // tek seçim
    altlar: [
      { value: 'kantar',             label: 'Kantar',                     icon: '⚖️', pinColor: '#6b7280' },
      { value: 'nakliyeciler_sitesi',label: 'Nakliyeciler Sitesi / Garaj', icon: '🏢', pinColor: '#4b5563' },
      { value: 'gumruk_sinir',       label: 'Gümrük & Sınır Kapısı',      icon: '🛃', pinColor: '#7c3aed' },
      { value: 'antrepo_depo',       label: 'Antrepo & Depo',             icon: '🏗️', pinColor: '#92400e' },
    ],
  },
];

// ── Düzleştirilmiş yardımcı listeler ─────────

/** Sadece alt kategoriler (form seçimi, API validasyonu için) */
export const POI_ALT_KATEGORILER: PoiAltKategori[] = POI_HIYERARSI.flatMap(a => a.altlar);

/** Eski kategoriler — DB'de mevcut kayıtlar için görüntüleme desteği */
export const POI_ESKI_KATEGORILER: PoiAltKategori[] = [
  { value: 'motorcu',          label: 'Motorcu',           icon: '🔧', pinColor: '#dc2626' },
  { value: 'elektrikci',       label: 'Elektrikçi',        icon: '⚡', pinColor: '#eab308' },
  { value: 'kaportaci',        label: 'Kaportacı',         icon: '🔨', pinColor: '#f59e0b' },
  { value: 'dorse_branda',     label: 'Dorse / Branda',    icon: '🚛', pinColor: '#0ea5e9' },
  { value: 'frigo_ustasi',     label: 'Frigo Ustası',      icon: '❄️', pinColor: '#06b6d4' },
  { value: 'lokanta',          label: 'Kamyoncu Lokantası', icon: '🍲', pinColor: '#f97316' },
  { value: 'konaklama',        label: 'Konaklama',         icon: '🛏️', pinColor: '#8b5cf6' },
  { value: 'tesis_akaryakit',  label: 'Tesis & Yakıt',    icon: '⛽', pinColor: '#ca8a04' },
  { value: 'yikama',           label: 'Yıkama / Yağlama', icon: '🚿', pinColor: '#10b981' },
  { value: 'park_dinlenme',    label: 'Park & Dinlenme',   icon: '🅿️', pinColor: '#2563eb' },
  { value: 'yemek',            label: 'Yemek',             icon: '🍲', pinColor: '#ea580c' },
  { value: 'tamirci',          label: 'Tamirci',           icon: '🛠️', pinColor: '#b91c1c' },
  { value: 'kantar_resmi',     label: 'Kantar (Resmi)',    icon: '⚖️', pinColor: '#4b5563' },
];

/** Tüm alt kategoriler (yeni + eski) — harita pin rengi ve görüntüleme için */
export const POI_TUM_ALT_KATEGORILER: PoiAltKategori[] = [
  ...POI_ALT_KATEGORILER,
  ...POI_ESKI_KATEGORILER,
];

/** key → label map (hem yeni hem eski) */
export const POI_KATEGORI_ETIKET: Record<string, string> = Object.fromEntries(
  POI_TUM_ALT_KATEGORILER.map(k => [k.value, k.label])
);

/** key → pinColor map */
export const POI_KATEGORI_RENK: Record<string, string> = Object.fromEntries(
  POI_TUM_ALT_KATEGORILER.map(k => [k.value, k.pinColor])
);

/** key → icon map */
export const POI_KATEGORI_IKON: Record<string, string> = Object.fromEntries(
  POI_TUM_ALT_KATEGORILER.map(k => [k.value, k.icon])
);

/** API validasyonu için geçerli kategori değerleri (yeni + eski) */
export const POI_GECERLI_KATEGORILER: string[] = POI_TUM_ALT_KATEGORILER.map(k => k.value);

/** Alt kategori → Ana kategori map */
export const POI_ALT_ANA_MAP: Record<string, string> = Object.fromEntries(
  POI_HIYERARSI.flatMap(a => a.altlar.map(alt => [alt.value, a.value]))
);

// ── Backward-compat export'lar ────────────────
// (eski import'ları kırmamak için)

/** @deprecated POI_ALT_KATEGORILER kullan */
export const POI_KATEGORILER = POI_ALT_KATEGORILER;

/** @deprecated POI_TUM_ALT_KATEGORILER kullan */
export const POI_TUM_KATEGORILER = POI_TUM_ALT_KATEGORILER;

// ── Etiket önerileri — kategori bazlı ────────

export const POI_ALT_ETIKETLER: Record<string, string[]> = {
  // Yeni kategoriler
  akaryakit_istasyonu: ['TIR Girişine Uygun', '7/24 Açık', 'Otopark Var', 'Duş İmkanı', 'Market'],
  elektrik_sarj:       ['Hızlı Şarj', '7/24 Açık', 'Gölgelik Var'],
  tir_parki:           ['7/24 Açık', 'Güvenlik Kameralı', 'Duş İmkanı', 'WC', 'Bekçi Var'],
  otel_pansiyon:       ['Tır Park Yeri Var', 'Duş İmkanı', 'Dorseyi Ayırmaya Gerek Yok', '7/24 Resepsiyon'],
  motor_mekanik:       ['Nöbetçi', 'Çekici Var', '7/24 Açık', 'Garantili İş', 'Parça Depolu'],
  lastikci:            ['Nöbetçi', '7/24 Açık', 'Çekici', 'Balans', 'Rot Balans'],
  elektrik_takograf:   ['Nöbetçi', '7/24 Açık', 'Akü Satışı', 'Takometre'],
  branda_dorse:        ['Branda Değişimi', 'Tenteci', 'Dorse Kaynak', 'Yan Perde'],
  yikama_yaglama:      ['Tır Yıkama', 'Motor Yıkama', 'Yağlama', 'Kabin Yıkama'],
  acil_yol_yardim:     ['7/24 Açık', 'Çekici', 'Lastik', 'Motor', 'Elektrik'],
  dinlenme_tesisi:     ['Sulu Yemek', 'Uygun Fiyat', '7/24 Açık', 'Paket Servis', 'Duş İmkanı'],
  esnaf_lokantasi:     ['Sulu Yemek', 'Uygun Fiyat', '7/24 Açık', 'Paket Servis', 'Kamyoncu Dostu'],
  kantar:              ['Vezneli', 'Resmi Tartı', 'CMR', 'Geçiş Belgesi'],
  nakliyeciler_sitesi: ['Uzun Süreli Park', 'Güvenlikli', 'Dorse Park', 'Oto Tamirci'],
  gumruk_sinir:        ['24 Saat', 'TIR Geçişi', 'TIR Parkı', 'Döviz'],
  antrepo_depo:        ['Soğuk Depo', 'Kapalı Alan', 'Forklift', 'Tartı'],
  // Eski kategoriler (backward compat)
  motorcu:             ['Nöbetçi', 'Çekici Var', '7/24 Açık', 'Garantili İş', 'Parça Depolu'],
  elektrikci:          ['Nöbetçi', '7/24 Açık', 'Akü Satışı', 'Takometre'],
  kaportaci:           ['Alüminyum', 'Paslanmaz', 'Boya', 'Sigorta İşi'],
  dorse_branda:        ['Branda Değişimi', 'Tenteci', 'Dorse Kaynak', 'Yan Perde'],
  frigo_ustasi:        ['Thermo King', 'Carrier', 'Yedek Parça', 'Soğutucu Gaz'],
  lokanta:             ['Sulu Yemek', 'Uygun Fiyat', '7/24 Açık', 'Paket Servis', 'Kamyoncu Dostu'],
  konaklama:           ['Tır Park Yeri Var', 'Duş İmkanı', 'Dorseyi Ayırmaya Gerek Yok', '7/24 Resepsiyon'],
  tesis_akaryakit:     ['TIR Girişine Uygun', 'Akaryakıt', 'Otopark', 'Duş', 'Kafe'],
  yikama:              ['Tır Yıkama', 'Motor Yıkama', 'Yağlama', 'Kabin Yıkama'],
  park_dinlenme:       ['Tır Park Yeri Var', '7/24 Açık', 'Güvenlik Kameralı', 'Duş İmkanı', 'WC'],
  yemek:               ['Sulu Yemek', 'Kamyoncu Dostu', 'Uygun Fiyat', '7/24 Açık', 'Paket Servis'],
  tamirci:             ['Nöbetçi', '7/24 Açık', 'Çekici', 'Lastik', 'Elektrik'],
  kantar_resmi:        ['Vezneli Kantar', 'Resmi Tartı', 'CMR', 'Geçiş Belgesi'],
};

export const POI_GENEL_ETIKETLER = [
  '7/24 Açık', 'Tır Park Yeri Var', 'Güvenlik Kameralı', 'Duş İmkanı',
  'WC', 'Kamyoncu Dostu', 'Sulu Yemek', 'Nöbetçi', 'Çekici',
  'Uygun Fiyat', 'Dorseyi Ayırmaya Gerek Yok',
];

// ── Excel import normalize haritası ──────────
// Kullanıcının Excel'de yazabileceği değerleri yeni slug'lara çevirir

export const POI_KAT_NORM: Record<string, string> = {
  // Yeni değerler (direkt geçerli)
  akaryakit_istasyonu:        'akaryakit_istasyonu',
  'akaryakıt istasyonu':      'akaryakit_istasyonu',
  'akaryakit istasyonu':      'akaryakit_istasyonu',
  elektrik_sarj:              'elektrik_sarj',
  'elektrik şarj':            'elektrik_sarj',
  'elektrik sarj':            'elektrik_sarj',
  'şarj noktası':             'elektrik_sarj',
  tir_parki:                  'tir_parki',
  'tır parkı':                'tir_parki',
  'tir parki':                'tir_parki',
  otel_pansiyon:              'otel_pansiyon',
  'otel & pansiyon':          'otel_pansiyon',
  'otel pansiyon':            'otel_pansiyon',
  motor_mekanik:              'motor_mekanik',
  'motor & mekanik':          'motor_mekanik',
  'motor mekanik':            'motor_mekanik',
  lastikci:                   'lastikci',
  lastikçi:                   'lastikci',
  elektrik_takograf:          'elektrik_takograf',
  'elektrik & takograf':      'elektrik_takograf',
  'elektrik takograf':        'elektrik_takograf',
  branda_dorse:               'branda_dorse',
  'branda & dorse':           'branda_dorse',
  'branda dorse':             'branda_dorse',
  yikama_yaglama:             'yikama_yaglama',
  'yıkama & yağlama':         'yikama_yaglama',
  'yikama yaglama':           'yikama_yaglama',
  acil_yol_yardim:            'acil_yol_yardim',
  'acil yol yardım':          'acil_yol_yardim',
  'acil yol yardim':          'acil_yol_yardim',
  dinlenme_tesisi:            'dinlenme_tesisi',
  'dinlenme tesisi':          'dinlenme_tesisi',
  esnaf_lokantasi:            'esnaf_lokantasi',
  'esnaf lokantası':          'esnaf_lokantasi',
  'esnaf lokantasi':          'esnaf_lokantasi',
  kantar:                     'kantar',
  nakliyeciler_sitesi:        'nakliyeciler_sitesi',
  'nakliyeciler sitesi':      'nakliyeciler_sitesi',
  'nakliyeciler sitesi / garaj': 'nakliyeciler_sitesi',
  gumruk_sinir:               'gumruk_sinir',
  'gümrük & sınır kapısı':    'gumruk_sinir',
  'gumruk sinir':             'gumruk_sinir',
  antrepo_depo:               'antrepo_depo',
  'antrepo & depo':           'antrepo_depo',
  'antrepo depo':             'antrepo_depo',

  // Eski değerler → yeni karşılıkları
  motorcu:                    'motor_mekanik',
  'motorcu':                  'motor_mekanik',
  elektrikci:                 'elektrik_takograf',
  elektrikçi:                 'elektrik_takograf',
  kaportaci:                  'motor_mekanik',
  kaportacı:                  'motor_mekanik',
  dorse_branda:               'branda_dorse',
  'dorse / branda':           'branda_dorse',
  frigo_ustasi:               'motor_mekanik',
  'frigo ustası':             'motor_mekanik',
  lokanta:                    'esnaf_lokantasi',
  konaklama:                  'otel_pansiyon',
  yikama:                     'yikama_yaglama',
  park_dinlenme:              'tir_parki',
  'park & dinlenme':          'tir_parki',
  'park ve dinlenme':         'tir_parki',
  yemek:                      'esnaf_lokantasi',
  tamirci:                    'motor_mekanik',
  'tamirci & usta':           'motor_mekanik',
  'tamirci ve usta':          'motor_mekanik',
  tesis_akaryakit:            'akaryakit_istasyonu',
  'tesis & akaryakıt':        'akaryakit_istasyonu',
  'tesis & akaryakit':        'akaryakit_istasyonu',
  'tesis ve akaryakıt':       'akaryakit_istasyonu',
  kantar_resmi:               'kantar',
  'kantar & resmi':           'kantar',
  'kantar ve resmi':          'kantar',
};
