import { NextResponse } from 'next/server';
import { getServerSupabase, getServiceSupabase } from '../../../../lib/auth';

// POST /api/auth/hesap-eslesme
// Body yok — yalnızca ÇAĞIRANIN KENDİ oturumunun email/telefonuyla eşleşen,
// başka (merged_into=null, kendisi hariç) bir `users` satırı var mı arar.
//
// 🚨 8 Ağu 2026 — bu route `app/giris/page.tsx::otpDogrula()`teki eski
// `supabase.from('users').select(...).or('phone.eq....,email.eq....')`
// sorgusunun yerini alıyor. O sorgu İSTEMCİDEN (`authenticated` rolüyle)
// atılıyordu; 7 Ağu güvenlik düzeltmesi `phone`/`email` kolonlarının SELECT
// yetkisini kaldırdı (bkz. `docs/20260807_guvenlik_kayit_giris.sql`) — bu
// kolonlar bir `.or()` FİLTRESİNDE geçse bile (SELECT listesinde hiç
// olmasalar da) Postgres okuma yetkisi ister, sorgu `42501` ile patlıyordu.
// Sonuç canlıda GERÇEKTEN yaşandı: telefon OTP ile giriş yapan kullanıcılar
// mevcut hesaplarıyla eşleştirilemeyip boş profil-tamamla ekranına düşüyordu.
//
// Çözüm istemciye `phone`/`email` GERİ AÇMAK değil (bu, 7 Ağu'da kapatılan asıl
// açığı geri açardı) — aramayı sunucuya, servis rolüyle taşımak. Güvenlik:
// arama kriteri İSTEMCİDEN gelmiyor, çağıranın KENDİ doğrulanmış oturumundan
// (`auth.getUser()`) okunuyor — biri başkasının telefonunu/e-postasını
// deneyerek hesap arayamaz, yalnız "benimle aynı email/telefonda başka bir
// hesap var mı" sorabilir.
export async function POST() {
  try {
    const supabase = await getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Oturum bulunamadı' }, { status: 401 });

    const kosullar: string[] = [];
    if (user.email) kosullar.push(`email.eq.${user.email}`);
    if (user.phone) {
      const p = user.phone.replace(/\D/g, '');
      const yerel = p.startsWith('90') ? '0' + p.slice(2) : p;
      const kisa  = p.startsWith('90') ? p.slice(2) : p;
      for (const t of new Set([p, `+${p}`, yerel, kisa])) kosullar.push(`phone.eq.${t}`);
    }
    if (kosullar.length === 0) return NextResponse.json({ eslesme: null });

    const svc = getServiceSupabase();
    const { data: eskiProfil } = await svc
      .from('users')
      .select('id, email, display_name')
      .or(kosullar.join(','))
      .is('merged_into', null)
      .neq('id', user.id)
      .maybeSingle();

    return NextResponse.json({ eslesme: eskiProfil ?? null });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Sunucu hatası' }, { status: 500 });
  }
}
