import type { Metadata } from 'next';

/**
 * SPRINT_01 S2 — `/moderator-giris` arama motorlarına kapalı.
 *
 * Burada `follow: false` (diğer auth sayfalarından FARKLI): moderatör giriş ekranının
 * varlığını duyurmanın hiçbir faydası yok, üstelik crawler'ın buradan `/moderator`'a
 * geçmesini de istemiyoruz.
 *
 * ⚠️ Bu bir güvenlik önlemi DEĞİL — `robots` meta'sı yalnız dürüst crawler'ları bağlar.
 * Asıl sınır `proxy.ts` (M1) + sunucu tarafı rol kontrolü (M2). Buradaki amaç
 * yönetim yüzeyinin arama sonuçlarında görünmemesi.
 */
export const metadata: Metadata = {
  title: 'Moderatör Girişi — Yükegel',
  robots: { index: false, follow: false },
};

export default function ModeratorGirisLayout({ children }: { children: React.ReactNode }) {
  return children;
}
