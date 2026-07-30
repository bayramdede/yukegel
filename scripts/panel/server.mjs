#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
//  Yükegel — YEREL YÖNETİM PANELİ (sunucu)
//  Çalıştır:  npm run panel      → http://127.0.0.1:4711
// ─────────────────────────────────────────────────────────────────────────────
//
// 30 Tem 2026 — NEDEN AYRI BİR SUNUCU, NEDEN NEXT ROUTE DEĞİL.
//
// Bu panel git komutu çalıştırıyor: `git add`, `push`, `rm .git/index.lock`,
// `launchctl`, `supabase functions deploy`. Böyle bir yetenek Next.js
// uygulamasının içine konulursa Vercel'e deploy edilen kod ağacına girer.
// `NODE_ENV` guard'ı bugün doğru olsa bile, yarın biri route'u kopyalar veya
// guard'ı kaldırır — ve o an uzaktan komut çalıştırma açığı olur.
//
// Bu dosya uygulama ağacının DIŞINDA (`scripts/`), Next build'ine hiç girmez,
// yalnız `127.0.0.1`'e bağlanır (LAN'daki başka makine erişemez) ve yalnız
// sen `npm run panel` yazınca ayaktadır. Next dev server kapalıyken de çalışır.
//
// 🚨 `HOST`'u 0.0.0.0 yapma. Bu sunucu kimlik doğrulaması YAPMAZ; tek koruması
//    loopback'e bağlı olmasıdır.
//
// Bağımlılık yok — sadece Node yerleşikleri. `npm install` gerekmez.

import { createServer } from 'node:http';
import { spawn, execFile } from 'node:child_process';
import { readFile, readdir, unlink, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const calistirAsync = promisify(execFile);

// scripts/panel/server.mjs → üç seviye yukarısı proje kökü
const PROJE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LOCK = path.join(PROJE, '.git', 'index.lock');
const FONKSIYON_DIZINI = path.join(PROJE, 'supabase', 'functions');
const DAEMON_LOG = path.join(PROJE, 'scripts', 'auto-deploy.log');
const DAEMON_ETIKET = 'com.yukegel.autodeploy';
const PLIST_HEDEF = path.join(os.homedir(), 'Library', 'LaunchAgents', `${DAEMON_ETIKET}.plist`);
const PLIST_KAYNAK = path.join(PROJE, 'scripts', `${DAEMON_ETIKET}.plist`);
const ENV_DOSYA = path.join(os.homedir(), '.config', 'yukegel', 'auto-deploy.env');
const YEDEK_DAL = 'yedek';

const HOST = '127.0.0.1';
const PORT = Number(process.env.PANEL_PORT || 4711);

// launchd/Homebrew araçları terminal dışından da bulunsun
const PATH_GENIS = [
  '/opt/homebrew/bin',
  '/usr/local/bin',
  path.join(os.homedir(), '.npm-global', 'bin'),
  process.env.PATH || '',
].join(':');

// ── Yardımcılar ──────────────────────────────────────────────────────────────

/** Çıktısı okunacak kısa komutlar. Patlarsa boş string döner, panel çökmez. */
async function oku(cmd, args) {
  try {
    const { stdout } = await calistirAsync(cmd, args, {
      cwd: PROJE,
      env: { ...process.env, PATH: PATH_GENIS },
      maxBuffer: 4 * 1024 * 1024,
    });
    return stdout.trimEnd();
  } catch (e) {
    return (e.stdout || '').trimEnd();
  }
}

/**
 * SUPABASE_ACCESS_TOKEN repo DIŞINDA duruyor (`~/.config/yukegel/auto-deploy.env`)
 * — bkz. auto-deploy.sh. Panelden edge function deploy ederken de aynı dosyayı
 * okuyoruz, yoksa `supabase` CLI "Access token not provided" ile sessizce düşer.
 */
async function ortamDegiskenleri() {
  const ek = {};
  try {
    const metin = await readFile(ENV_DOSYA, 'utf8');
    for (const satir of metin.split('\n')) {
      const t = satir.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i > 0) ek[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
  } catch {
    /* dosya yok — supabase deploy'da uyarı basılır */
  }
  return ek;
}

// ── Durum ────────────────────────────────────────────────────────────────────

async function durum() {
  const [dal, porcelain, commitler, uzakDurum] = await Promise.all([
    oku('git', ['rev-parse', '--abbrev-ref', 'HEAD']),
    oku('git', ['status', '--porcelain']),
    oku('git', ['log', '-10', '--pretty=%h%s%cr%an']),
    oku('git', ['rev-list', '--left-right', '--count', 'HEAD...@{upstream}']),
  ]);

  const degisenler = porcelain
    .split('\n')
    .filter(Boolean)
    .map(satir => ({ kod: satir.slice(0, 2).trim() || '??', yol: satir.slice(3) }));

  let lock = null;
  try {
    const s = await stat(LOCK);
    lock = { var: true, yas: Math.round((Date.now() - s.mtimeMs) / 1000) };
  } catch {
    lock = { var: false, yas: 0 };
  }

  const [onde = '0', geride = '0'] = uzakDurum.split(/\s+/);

  let fonksiyonlar = [];
  try {
    const girdiler = await readdir(FONKSIYON_DIZINI, { withFileTypes: true });
    fonksiyonlar = girdiler.filter(d => d.isDirectory() && !d.name.startsWith('_')).map(d => d.name);
  } catch {
    /* supabase/functions yoksa boş liste */
  }

  const launchctl = await oku('launchctl', ['list']);
  const daemon = launchctl.split('\n').some(s => s.includes(DAEMON_ETIKET));

  return {
    dal,
    degisenler,
    commitler: commitler
      .split('\n')
      .filter(Boolean)
      .map(s => {
        const [hash, konu, ne_zaman, yazar] = s.split('');
        return { hash, konu, ne_zaman, yazar };
      }),
    lock,
    onde: Number(onde) || 0,
    geride: Number(geride) || 0,
    fonksiyonlar,
    daemon,
    tokenVar: existsSync(ENV_DOSYA),
    proje: PROJE,
  };
}

// ── Komut akışı ──────────────────────────────────────────────────────────────

function yaz(res, metin) {
  if (!res.writableEnded) res.write(metin);
}

/** Tek komut çalıştır, çıktısını canlı akıt. Çıkış kodunu döndürür. */
function akit(res, cmd, args, ek = {}) {
  return new Promise(cozul => {
    yaz(res, `\x01$ ${cmd} ${args.join(' ')}\n`);
    let cocuk;
    try {
      cocuk = spawn(cmd, args, {
        cwd: PROJE,
        env: { ...process.env, ...ek, PATH: PATH_GENIS },
      });
    } catch (e) {
      yaz(res, `✗ ${e.message}\n`);
      return cozul(1);
    }
    cocuk.stdout.on('data', d => yaz(res, d.toString()));
    cocuk.stderr.on('data', d => yaz(res, d.toString()));
    cocuk.on('error', e => {
      yaz(res, `✗ komut çalıştırılamadı: ${e.message}\n`);
      cozul(1);
    });
    cocuk.on('close', kod => cozul(kod ?? 1));
  });
}

/** Lock varsa bekle. Daemon commit atıyor olabilir; 15 sn sonra pes et. */
async function lockBekle(res, saniye = 15) {
  for (let i = 0; i < saniye; i++) {
    if (!existsSync(LOCK)) return true;
    if (i === 0) yaz(res, '⏳ .git/index.lock var (daemon commit atıyor olabilir), bekleniyor…\n');
    await new Promise(r => setTimeout(r, 1000));
  }
  if (existsSync(LOCK)) {
    yaz(res, '✗ .git/index.lock 15 sn\'dir duruyor. "Kilidi aç" düğmesini kullan.\n');
    return false;
  }
  return true;
}

const ISLER = {
  /** Takılı kalmış `.git/index.lock` dosyasını sil. */
  async 'lock-ac'(res) {
    if (!existsSync(LOCK)) {
      yaz(res, '✓ Zaten kilit yok — silinecek bir şey bulunamadı.\n');
      return 0;
    }
    const s = await stat(LOCK);
    const yas = Math.round((Date.now() - s.mtimeMs) / 1000);
    yaz(res, `Kilit dosyası: ${LOCK}\nYaşı: ${yas} sn\n`);
    if (yas < 5) {
      // 🚨 Taze lock = başka bir git komutu ŞU AN çalışıyor demektir. Silmek
      //    o komutun index'i yarım yazmasına yol açar. Önce 5 sn bekle.
      yaz(res, 'Kilit çok taze, git komutu hâlâ çalışıyor olabilir — 5 sn bekleniyor…\n');
      await new Promise(r => setTimeout(r, 5000));
      if (!existsSync(LOCK)) {
        yaz(res, '✓ Kilit kendiliğinden kalktı, silmeye gerek kalmadı.\n');
        return 0;
      }
    }
    await unlink(LOCK);
    yaz(res, '✓ Kilit silindi.\n');
    return 0;
  },

  /**
   * YEDEKLE — `git add -A` + commit + push `yedek` dalına.
   *
   * 🚨 `main`'e DEĞİL. Vercel Hobby'de kayan 24 saatte 100 deployment sınırı var
   *    ve iptal edilen deployment'lar da sayılıyor. Kaydetme başına push `main`'e
   *    giderse kota gün içinde biter — 29 Tem'de tam olarak bu oldu (bkz.
   *    scripts/deploy.sh başlığı). Canlıya çıkış tek kapı: Deploy düğmesi.
   */
  async yedekle(res, { mesaj }) {
    if (!(await lockBekle(res))) return 1;
    const durum = await oku('git', ['status', '--porcelain']);
    if (!durum) {
      yaz(res, 'ℹ Değişiklik yok — commit atılmadı. Yine de push deneniyor.\n');
    } else {
      if ((await akit(res, 'git', ['add', '-A'])) !== 0) return 1;
      const etiket = mesaj?.trim() || new Date().toLocaleString('tr-TR');
      if ((await akit(res, 'git', ['commit', '-m', `auto: ${etiket}`])) !== 0) return 1;
    }
    let kod = await akit(res, 'git', ['push', 'origin', `HEAD:${YEDEK_DAL}`]);
    if (kod !== 0) {
      // `yedek` bir aynadır; `main` rebase'lendiyse ileri sarmaz.
      // `--force-with-lease` — düz `--force` DEĞİL: uzaktaki dal son gördüğümüzden
      // beri başkası tarafından değiştiyse yine durur.
      yaz(res, '… push reddedildi, --force-with-lease ile tekrar deneniyor\n');
      kod = await akit(res, 'git', ['push', '--force-with-lease', 'origin', `HEAD:${YEDEK_DAL}`]);
    }
    yaz(res, kod === 0 ? `\n✓ '${YEDEK_DAL}' dalına gönderildi. Vercel deployment OLUŞMAZ.\n` : '\n✗ Push başarısız.\n');
    return kod;
  },

  /** DEPLOY — mevcut `scripts/deploy.sh`. Tek kapı burası, mantık kopyalanmıyor. */
  async deploy(res, { mesaj }) {
    if (!(await lockBekle(res))) return 1;
    const metin = (mesaj || '').trim() || 'elle deploy';
    const kod = await akit(res, 'bash', [path.join(PROJE, 'scripts', 'deploy.sh'), metin]);
    return kod;
  },

  /** Tip kontrolü — deploy'un da içinde var, burada tek başına. */
  async tsc(res) {
    const kod = await akit(res, 'npx', ['tsc', '--noEmit']);
    yaz(res, kod === 0 ? '\n✓ Tipler temiz.\n' : '\n✗ Tip hatası var — deploy DURUR.\n');
    return kod;
  },

  /** Supabase edge function deploy. */
  async 'fn-deploy'(res, { fn }) {
    const ad = String(fn || '');
    // Dizin adı doğrulanmadan CLI'a verilirse yol kaçışı olur.
    if (!/^[a-z0-9_-]+$/i.test(ad) || !existsSync(path.join(FONKSIYON_DIZINI, ad))) {
      yaz(res, `✗ Geçersiz fonksiyon adı: ${ad}\n`);
      return 1;
    }
    const ek = await ortamDegiskenleri();
    if (!ek.SUPABASE_ACCESS_TOKEN && !process.env.SUPABASE_ACCESS_TOKEN) {
      yaz(res, `✗ SUPABASE_ACCESS_TOKEN yok (${ENV_DOSYA}).\n`);
      yaz(res, '  Dosyayı oluştur:  SUPABASE_ACCESS_TOKEN=sbp_xxxxx   (chmod 600)\n');
      return 1;
    }
    return akit(res, 'supabase', ['functions', 'deploy', ad, '--project-ref', 'gobepcswwsoswodhaufy'], ek);
  },

  async 'daemon-baslat'(res) {
    const plist = existsSync(PLIST_HEDEF) ? PLIST_HEDEF : PLIST_KAYNAK;
    yaz(res, `plist: ${plist}\n`);
    return akit(res, 'launchctl', ['load', '-w', plist]);
  },

  async 'daemon-durdur'(res) {
    const plist = existsSync(PLIST_HEDEF) ? PLIST_HEDEF : PLIST_KAYNAK;
    yaz(res, `plist: ${plist}\n`);
    return akit(res, 'launchctl', ['unload', '-w', plist]);
  },

  async 'daemon-log'(res) {
    if (!existsSync(DAEMON_LOG)) {
      yaz(res, `✗ Log dosyası yok: ${DAEMON_LOG}\n`);
      return 1;
    }
    return akit(res, 'tail', ['-n', '80', DAEMON_LOG]);
  },

  /** Uzaktaki değişiklikleri çek. */
  async cek(res) {
    if (!(await lockBekle(res))) return 1;
    return akit(res, 'git', ['pull', '--rebase']);
  },
};

// ── HTTP ─────────────────────────────────────────────────────────────────────

const sunucu = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);

  // 🚨 DNS rebinding koruması. Tarayıcı `127.0.0.1` dışında bir Host ile
  //    gelirse (kötü niyetli bir sayfa senin makinene ad çözümleyebilir)
  //    isteği reddet. Loopback bağlanması tek başına bunu engellemez.
  const host = (req.headers.host || '').split(':')[0];
  if (host && host !== '127.0.0.1' && host !== 'localhost') {
    res.writeHead(403).end('Yalnızca 127.0.0.1');
    return;
  }

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    const html = await readFile(path.join(path.dirname(fileURLToPath(import.meta.url)), 'index.html'));
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(html);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/durum') {
    const veri = await durum();
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(veri));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/calistir') {
    // Basit CSRF kapısı: form gönderimi bu başlığı ekleyemez, fetch ekler.
    if (req.headers['x-panel'] !== '1') {
      res.writeHead(403).end('x-panel başlığı yok');
      return;
    }
    let gövde = '';
    for await (const parca of req) gövde += parca;
    let istek = {};
    try {
      istek = JSON.parse(gövde || '{}');
    } catch {
      res.writeHead(400).end('Geçersiz JSON');
      return;
    }
    const is = ISLER[istek.is];
    if (!is) {
      res.writeHead(400).end('Bilinmeyen iş');
      return;
    }
    res.writeHead(200, {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-accel-buffering': 'no',
    });
    let kod = 1;
    try {
      kod = await is(res, istek);
    } catch (e) {
      yaz(res, `\n✗ Beklenmeyen hata: ${e.message}\n`);
    }
    yaz(res, `\x01[bitti:${kod}]\n`);
    res.end();
    return;
  }

  res.writeHead(404).end('yok');
});

sunucu.listen(PORT, HOST, () => {
  console.log('');
  console.log('  🛠  Yükegel yönetim paneli');
  console.log(`     http://${HOST}:${PORT}`);
  console.log(`     proje: ${PROJE}`);
  console.log('     kapatmak için Ctrl+C');
  console.log('');
});

sunucu.on('error', e => {
  if (e.code === 'EADDRINUSE') {
    console.error(`✗ ${PORT} portu dolu. Panel zaten açık olabilir: http://${HOST}:${PORT}`);
    console.error(`  Başka port:  PANEL_PORT=4712 npm run panel`);
    process.exit(1);
  }
  throw e;
});
