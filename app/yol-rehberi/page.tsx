import { Metadata } from 'next';
import { Suspense } from 'react';
import YolRehberiClient from './YolRehberiClient';

export const metadata: Metadata = {
  title: 'Yol Rehberi — Yükegel',
  description: 'Yoldaki tır parkları, lokantalar, tamirciler, konaklama ve akaryakıt noktaları. Kamyoncu dostu harita.',
};

export default function YolRehberiPage() {
  // YolRehberiClient useSearchParams kullanıyor (kategori deep-link) — Suspense zorunlu
  return (
    <Suspense fallback={<div style={{ height: '100dvh', background: '#0d1117' }} />}>
      <YolRehberiClient />
    </Suspense>
  );
}
