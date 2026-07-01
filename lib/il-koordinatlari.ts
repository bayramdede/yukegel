// ─────────────────────────────────────────────────────────────
// Türkiye 81 il merkez koordinatları
// Kaynak: app/api/admin/poi-import/route.ts içindeki tablo ile aynı.
// Kullanım: GPS konumundan "hangi ildesin" tahmini (reverse-geocoding
// API çağrısı gerektirmeden, offline haversine hesabı).
// ─────────────────────────────────────────────────────────────
export const IL_KOORDINAT: Record<string, { lat: number; lng: number; radius: number }> = {
  'Adana':          { lat: 37.0000, lng: 35.3213, radius: 80000 },
  'Adıyaman':       { lat: 37.7648, lng: 38.2786, radius: 60000 },
  'Afyonkarahisar': { lat: 38.7507, lng: 30.5567, radius: 80000 },
  'Ağrı':           { lat: 39.7191, lng: 43.0503, radius: 80000 },
  'Amasya':         { lat: 40.6499, lng: 35.8353, radius: 60000 },
  'Ankara':         { lat: 39.9334, lng: 32.8597, radius: 80000 },
  'Antalya':        { lat: 36.8969, lng: 30.7133, radius: 80000 },
  'Artvin':         { lat: 41.1828, lng: 41.8183, radius: 50000 },
  'Aydın':          { lat: 37.8444, lng: 27.8458, radius: 70000 },
  'Balıkesir':      { lat: 39.6484, lng: 27.8826, radius: 80000 },
  'Bilecik':        { lat: 40.1508, lng: 29.9792, radius: 50000 },
  'Bingöl':         { lat: 38.8847, lng: 40.4983, radius: 60000 },
  'Bitlis':         { lat: 38.4006, lng: 42.1095, radius: 60000 },
  'Bolu':           { lat: 40.5760, lng: 31.5788, radius: 60000 },
  'Burdur':         { lat: 37.7203, lng: 30.2906, radius: 60000 },
  'Bursa':          { lat: 40.1826, lng: 29.0665, radius: 70000 },
  'Çanakkale':      { lat: 40.1553, lng: 26.4142, radius: 70000 },
  'Çankırı':        { lat: 40.6013, lng: 33.6134, radius: 60000 },
  'Çorum':          { lat: 40.5506, lng: 34.9556, radius: 70000 },
  'Denizli':        { lat: 37.7765, lng: 29.0864, radius: 70000 },
  'Diyarbakır':     { lat: 37.9144, lng: 40.2306, radius: 80000 },
  'Edirne':         { lat: 41.6818, lng: 26.5623, radius: 60000 },
  'Elazığ':         { lat: 38.6810, lng: 39.2264, radius: 60000 },
  'Erzincan':       { lat: 39.7500, lng: 39.5000, radius: 70000 },
  'Erzurum':        { lat: 39.9000, lng: 41.2700, radius: 80000 },
  'Eskişehir':      { lat: 39.7767, lng: 30.5206, radius: 70000 },
  'Gaziantep':      { lat: 37.0662, lng: 37.3833, radius: 70000 },
  'Giresun':        { lat: 40.9128, lng: 38.3895, radius: 60000 },
  'Gümüşhane':      { lat: 40.4386, lng: 39.4814, radius: 60000 },
  'Hakkari':        { lat: 37.5744, lng: 43.7408, radius: 50000 },
  'Hatay':          { lat: 36.4018, lng: 36.3498, radius: 70000 },
  'Isparta':        { lat: 37.7648, lng: 30.5566, radius: 60000 },
  'Mersin':         { lat: 36.8000, lng: 34.6333, radius: 80000 },
  'İstanbul':       { lat: 41.0082, lng: 28.9784, radius: 50000 },
  'İzmir':          { lat: 38.4192, lng: 27.1287, radius: 70000 },
  'Kars':           { lat: 40.6013, lng: 43.0975, radius: 60000 },
  'Kastamonu':      { lat: 41.3887, lng: 33.7827, radius: 70000 },
  'Kayseri':        { lat: 38.7312, lng: 35.4787, radius: 70000 },
  'Kırklareli':     { lat: 41.7333, lng: 27.2167, radius: 60000 },
  'Kırşehir':       { lat: 39.1425, lng: 34.1709, radius: 60000 },
  'Kocaeli':        { lat: 40.8533, lng: 29.8815, radius: 50000 },
  'Konya':          { lat: 37.8714, lng: 32.4846, radius: 100000 },
  'Kütahya':        { lat: 39.4242, lng: 29.9833, radius: 70000 },
  'Malatya':        { lat: 38.3552, lng: 38.3095, radius: 70000 },
  'Manisa':         { lat: 38.6191, lng: 27.4289, radius: 70000 },
  'Kahramanmaraş':  { lat: 37.5858, lng: 36.9371, radius: 70000 },
  'Mardin':         { lat: 37.3212, lng: 40.7245, radius: 70000 },
  'Muğla':          { lat: 37.2153, lng: 28.3636, radius: 80000 },
  'Muş':            { lat: 38.7462, lng: 41.5064, radius: 60000 },
  'Nevşehir':       { lat: 38.6939, lng: 34.6857, radius: 60000 },
  'Niğde':          { lat: 37.9667, lng: 34.6833, radius: 60000 },
  'Ordu':           { lat: 40.9839, lng: 37.8764, radius: 60000 },
  'Rize':           { lat: 41.0201, lng: 40.5234, radius: 50000 },
  'Sakarya':        { lat: 40.6940, lng: 30.4358, radius: 60000 },
  'Samsun':         { lat: 41.2867, lng: 36.3300, radius: 70000 },
  'Siirt':          { lat: 37.9333, lng: 41.9500, radius: 60000 },
  'Sinop':          { lat: 42.0231, lng: 35.1531, radius: 50000 },
  'Sivas':          { lat: 39.7477, lng: 37.0179, radius: 80000 },
  'Tekirdağ':       { lat: 40.9833, lng: 27.5167, radius: 70000 },
  'Tokat':          { lat: 40.3167, lng: 36.5500, radius: 70000 },
  'Trabzon':        { lat: 41.0015, lng: 39.7178, radius: 60000 },
  'Tunceli':        { lat: 39.1079, lng: 39.5482, radius: 50000 },
  'Şanlıurfa':      { lat: 37.1591, lng: 38.7969, radius: 80000 },
  'Uşak':           { lat: 38.6823, lng: 29.4082, radius: 60000 },
  'Van':            { lat: 38.4942, lng: 43.3800, radius: 80000 },
  'Yozgat':         { lat: 39.8181, lng: 34.8147, radius: 70000 },
  'Zonguldak':      { lat: 41.4564, lng: 31.7987, radius: 60000 },
  'Aksaray':        { lat: 38.3687, lng: 34.0370, radius: 60000 },
  'Bayburt':        { lat: 40.2552, lng: 40.2249, radius: 50000 },
  'Karaman':        { lat: 37.1759, lng: 33.2287, radius: 60000 },
  'Kırıkkale':      { lat: 39.8468, lng: 33.5153, radius: 50000 },
  'Batman':         { lat: 37.8812, lng: 41.1351, radius: 60000 },
  'Şırnak':         { lat: 37.5164, lng: 42.4611, radius: 60000 },
  'Bartın':         { lat: 41.6344, lng: 32.3375, radius: 50000 },
  'Ardahan':        { lat: 41.1105, lng: 42.7022, radius: 50000 },
  'Iğdır':          { lat: 39.9167, lng: 44.0450, radius: 50000 },
  'Yalova':         { lat: 40.6500, lng: 29.2667, radius: 40000 },
  'Karabük':        { lat: 41.2061, lng: 32.6204, radius: 50000 },
  'Kilis':          { lat: 36.7184, lng: 37.1212, radius: 40000 },
  'Osmaniye':       { lat: 37.0742, lng: 36.2461, radius: 50000 },
  'Düzce':          { lat: 40.8438, lng: 31.1565, radius: 50000 },
};

/** İki koordinat arası mesafe (metre) — haversine formülü */
export function haversineMetre(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Verilen GPS konumuna en yakın ili döner (il merkezine kuş uçuşu mesafe ile) */
export function enYakinIl(lat: number, lng: number): { il: string; mesafe_km: number } {
  let enYakin = { il: 'İstanbul', mesafe: Infinity };
  for (const [il, koor] of Object.entries(IL_KOORDINAT)) {
    const d = haversineMetre(lat, lng, koor.lat, koor.lng);
    if (d < enYakin.mesafe) enYakin = { il, mesafe: d };
  }
  return { il: enYakin.il, mesafe_km: Math.round(enYakin.mesafe / 100) / 10 };
}
