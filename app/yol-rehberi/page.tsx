import { Metadata } from 'next';
import YolRehberiClient from './YolRehberiClient';

export const metadata: Metadata = {
  title: 'Yol Rehberi — Yükegel',
  description: 'Yoldaki tır parkları, lokantalar, tamirciler, konaklama ve akaryakıt noktaları. Kamyoncu dostu harita.',
};

export default function YolRehberiPage() {
  return <YolRehberiClient />;
}
