import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * SPRINT_01 C1 — çıkış artık YALNIZCA POST.
 *
 * Eski hali GET'i de kabul ediyordu. Bu, yan etkisi olan bir işlemi bir bağlantıya
 * bağlamak demek:
 *   - başka bir sitedeki `<img src="https://yukegel.com/cikis">` kullanıcıyı sessizce
 *     çıkış yaptırır (klasik CSRF logout)
 *   - tarayıcı/antivirüs link ön-yüklemesi (prefetch) veya bir sohbet uygulamasının
 *     link önizlemesi de aynı şeyi yapar — kullanıcı "kendiliğinden çıkış yapılıyor" der
 *
 * Şimdi: GET → 405. POST + Origin kontrolü. Çıkış butonları `<form method="post">`.
 */

export async function GET() {
  return NextResponse.json(
    { error: 'Method Not Allowed. Çıkış için POST kullanın.' },
    { status: 405, headers: { Allow: 'POST' } }
  );
}

export async function POST(request: Request) {
  // ── Origin kontrolü ───────────────────────────────────────────────
  // Tarayıcı POST'larda Origin header'ını her zaman gönderir. Başka bir sitedeki
  // gizli formdan gelen istek burada elenir.
  const origin = request.headers.get('origin');
  if (origin) {
    const beklenen = new URL(request.url).origin;
    if (origin !== beklenen) {
      return NextResponse.json({ error: 'Geçersiz kaynak' }, { status: 403 });
    }
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  );

  await supabase.auth.signOut();

  // 303: POST sonrası GET ile yönlendir (form tekrar gönderilmesin).
  const yanit = NextResponse.redirect(new URL('/', request.url), { status: 303 });

  // signOut cookie'leri silmiş olmalı; yine de artık sb- cookie'si kalmadığından emin ol.
  cookieStore.getAll().forEach(({ name }) => {
    if (name.startsWith('sb-')) yanit.cookies.delete(name);
  });

  return yanit;
}
