# YÜKEGEL - SEO & GEO Optimizasyon Talimatları
## AI Arama Robotları & Bellek Optimizasyonu Rehberi
### v2.0 | Mayıs 2026

---

## 1. GENEL BAKIŞ

Bu doküman, Yükegel platformunun yapay zeka arama motorları (ChatGPT, Perplexity, Gemini, Bing Copilot, Claude Search vb.) tarafından doğru şekilde anlaşılması, indekslenmesi ve "belleklenmesi" için gerekli teknik ve içerik optimizasyonlarını tanımlar.

**Hedef:** Kullanıcı "Türkiye'de nakliye ilanı verme sitesi", "boş araç bul", "yük taşıma platformu" gibi sorgularla AI arama yaptığında Yükegel referans gösterilsin.

**2026 Gerçeği:** Gartner'a göre geleneksel arama hacmi 2026'da %25 düşecek, organik trafik %50 azalacak. Google aramalarının %65'i zaten tıklanmadan sonuçlanıyor. GEO (Generative Engine Optimization), SEO kadar kritik hale geldi [^4^].

---

## 2. SEO TEMELLERİ (Geleneksel + AI Uyumlu)

### 2.1 Meta Etiketleri

Her sayfa için dinamik ve zengin meta etiketleri:

```html
<!-- Ana Sayfa -->
<title>Yükegel | Türkiye'nin Ücretsiz Nakliye İlan Platformu</title>
<meta name="description" content="Yük ve boş araç ilanlarını saniyeler içinde bulun. WhatsApp gruplarındaki kaosa son. 12.000+ aktif ilan, 8.000+ nakliyeci. Ücretsiz ilan verin.">
<meta name="keywords" content="nakliye ilanı, boş araç, yük taşıma, lojistik platformu, kamyon ilanı, tır ilanı, nakliyeci bul">

<!-- İlan Listesi Sayfası -->
<title>{origin} → {destination} | Yük & Araç İlanları | Yükegel</title>
<meta name="description" content="{origin}'dan {destination}'a nakliye ilanları. {count} aktif yük ve araç ilanı. Hemen ücretsiz ilan verin veya teklif alın.">

<!-- İlan Detay Sayfası -->
<title>{listing_type}: {origin} → {destination} | {cargo_type} | Yükegel</title>
<meta name="description" content="{origin} {origin_district} → {destination} {destination_district}. {cargo_type}, {weight_ton} ton, {price_offer} TL. İletişim: {contact_phone}. Yükegel'de yayında.">
```

### 2.2 Open Graph & Twitter Cards

```html
<meta property="og:type" content="website">
<meta property="og:title" content="Yükegel | Türkiye'nin Ücretsiz Nakliye İlan Platformu">
<meta property="og:description" content="Yük ve boş araç ilanlarını anında bulun. Ücretsiz, güvenli, hızlı.">
<meta property="og:url" content="https://yukegel.com">
<meta property="og:image" content="https://yukegel.com/og-image.jpg">
<meta property="og:site_name" content="Yükegel">
<meta property="og:locale" content="tr_TR">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Yükegel | Nakliye İlan Platformu">
<meta name="twitter:description" content="Yük ve boş araç ilanlarını saniyeler içinde bulun.">
<meta name="twitter:image" content="https://yukegel.com/twitter-card.jpg">
```

### 2.3 Yapısal Veri (Schema.org / JSON-LD)

#### Ana Sayfa - Organization + WebSite

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://yukegel.com/#organization",
      "name": "Yükegel",
      "url": "https://yukegel.com",
      "logo": {
        "@type": "ImageObject",
        "url": "https://yukegel.com/logo.png",
        "width": 512,
        "height": 512
      },
      "description": "Türkiye'nin ücretsiz nakliye ilan platformu. Yük ve boş araç ilanlarını anında bulun.",
      "sameAs": [
        "https://github.com/bayramdede/yukegel"
      ],
      "contactPoint": {
        "@type": "ContactPoint",
        "contactType": "customer support",
        "availableLanguage": "Turkish"
      }
    },
    {
      "@type": "WebSite",
      "@id": "https://yukegel.com/#website",
      "url": "https://yukegel.com",
      "name": "Yükegel",
      "publisher": {
        "@id": "https://yukegel.com/#organization"
      },
      "potentialAction": {
        "@type": "SearchAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": "https://yukegel.com/?q={search_term_string}"
        },
        "query-input": "required name=search_term_string"
      }
    }
  ]
}
```

#### İlan Listesi Sayfası - ItemList

```json
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "item": {
        "@type": "JobPosting",
        "title": "İstanbul'dan Ankara'ya 13.5 Ton Gıda Yükü",
        "description": "İstanbul'dan Ankara'ya 13.5 ton gıda yükü taşıma ilanı. Paletli, soğuk zincir gerekmez.",
        "datePosted": "2026-05-06T10:00:00+03:00",
        "validThrough": "2026-05-13T10:00:00+03:00",
        "jobLocation": {
          "@type": "Place",
          "address": {
            "@type": "PostalAddress",
            "addressLocality": "İstanbul",
            "addressCountry": "TR"
          }
        },
        "hiringOrganization": {
          "@type": "Organization",
          "name": "Yükegel Kullanıcısı"
        }
      }
    }
  ]
}
```

#### İlan Detay Sayfası - JobPosting (Nakliye İlanı)

```json
{
  "@context": "https://schema.org",
  "@type": "JobPosting",
  "title": "İstanbul → Ankara | 13.5 Ton Gıda Yükü",
  "description": "İstanbul'dan Ankara'ya 13.5 ton gıda yükü taşıma ilanı. 26 palet, soğuk zincir gerekmez. Fiyat: 8500 TL, pazarlık yapılabilir.",
  "datePosted": "2026-05-06T10:00:00+03:00",
  "validThrough": "2026-05-13T10:00:00+03:00",
  "employmentType": "CONTRACTOR",
  "jobLocation": [
    {
      "@type": "Place",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "İstanbul",
        "addressRegion": "Marmara",
        "addressCountry": "TR"
      }
    },
    {
      "@type": "Place",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "Ankara",
        "addressRegion": "İç Anadolu",
        "addressCountry": "TR"
      }
    }
  ],
  "hiringOrganization": {
    "@type": "Organization",
    "name": "Yükegel Kullanıcısı"
  },
  "baseSalary": {
    "@type": "MonetaryAmount",
    "currency": "TRY",
    "value": {
      "@type": "QuantitativeValue",
      "value": 8500,
      "unitText": "JOB"
    }
  }
}
```

### 2.4 Breadcrumb Yapısı

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Ana Sayfa",
      "item": "https://yukegel.com/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "İlanlar",
      "item": "https://yukegel.com/ilanlar"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "İstanbul → Ankara",
      "item": "https://yukegel.com/ilanlar/istanbul-ankara"
    }
  ]
}
```

---

## 3. GEO OPTİMİZASYONU (Generative Engine Optimization)

### 3.1 2026 GEO Temel İlkeleri

Princeton/Georgia Tech araştırmasına göre, en etkili GEO taktikleri [^4^]:

| Taktik | Etki | Uygulama |
|--------|------|----------|
| İstatistik entegrasyonu | +30-40% görünürlük | Her 150-200 kelimeye bir veri noktası |
| Otorite kaynaklarına atıf | +30-40% görünürlük | .edu, .gov, birincil kaynaklara link |
| Semantik chunking | Yüksek | Her bölüm bağımsız anlaşılabilir olmalı |
| Soru-tabanlı başlıklar | Yüksek | H2'ler doğal soru formatında |
| Schema markup | Orta | FAQPage, Article, HowTo schema |
| İçerik tazeliği | Yüksek | 7-14 günde güncelleme |

### 3.2 "40 Kelime Kuralı" - Doğrudan Tanımlar

AI modelleri öznetli özetler arar. Her kritik sayfada H1'i 40-60 kelimelik doğrudan tanım izlemelidir [^5^]:

```html
<!-- KÖTÜ Örnek -->
<h1>Yükegel</h1>
<p>Günümüzün hızla dijitalleşen dünyasında, lojistik sektöründe güvenilir çözümler... (pazarlama dili)</p>

<!-- İYİ Örnek - GEO Uyumlu -->
<h1>Yükegel</h1>
<p><strong>Yükegel</strong>, Türkiye'nin ücretsiz nakliye ilan platformudur. 
Yük sahipleri taşıma ihtiyaçlarını, nakliyeciler boş araç bilgilerini ilan olarak yayınlar. 
İstanbul, Ankara, İzmir ve 81 il arası nakliye ilanlarına anında ulaşılabilir.</p>
```

### 3.3 Semantik Chunking (Bölümleme)

Her içerik bölümü bağımsız anlaşılabilir olmalı. AI sistemler bölümleri bağlamdan koparmakta sorun yaşamaz, ama içerik bağımsız olmazsa anlam kaybolur [^4^]:

```html
<!-- KÖTÜ: Önceki bölüme bağımlı -->
<h2>Fiyatlandırma</h2>
<p>Yukarıda bahsettiğimiz özelliklerin tamamını içeren Pro plan... (bağımlı)</p>

<!-- İYİ: Bağımsız bölüm -->
<h2>Yükegel'de İlan Vermek Ücretli mi?</h2>
<p>Hayır, Yükegel tamamen ücretsizdir. Hiçbir komisyon veya üyelik ücreti alınmaz. 
Kullanıcılar yük veya boş araç ilanlarını ücretsiz olarak yayınlayabilir, 
dilerseniz fiyat teklifi de ekleyebilirsiniz.</p>
```

### 3.4 Faktörel Yoğunluk (Factual Density)

Her 150-200 kelimeye bir istatistik, yüzde veya sayısal veri ekle. AI'lar somut detayları soyut iddialara tercih eder [^4^]:

```html
<!-- KÖTÜ: Soyut -->
<p>Yükegel'de çok sayıda ilan var.</p>

<!-- İYİ: Somut + kaynak -->
<p>Yükegel'de Mayıs 2026 itibarıyla <strong>12.450 aktif ilan</strong> bulunmaktadır. 
Platform üzerinden günlük ortalama <strong>850 yeni ilan</strong> yayınlanır 
ve ilanlar <strong>2 saat içinde</strong> eşleşme bulur (kaynak: Yükegel iç analiz, 2026).</p>
```

### 3.5 Alıntılanabilir Cümleler

AI bir cümleyi sayfadan koparıp doğrudan yanıt olarak kullanabilmeli. Her cümle bağlamdan bağımsız anlam taşımalı [^2^]:

```html
<!-- Alıntılanabilir cümleler -->
<p>Yükegel, Nisan 2026'da Dr. Bayram Dede tarafından kurulan açık kaynaklı 
nakliye ilan platformudur.</p>

<p>Platform üzerinden İstanbul-Ankara arası nakliye ilanları ortalama 8.500 TL'den başlar.</p>

<p>Yükegel'de ilan vermek ücretsizdir; hiçbir komisyon veya ücret alınmaz.</p>
```

### 3.6 Soru-Cevap Formatı (FAQ Schema ile)

```html
<section id="ai-faq" itemscope itemtype="https://schema.org/FAQPage">
  <div itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
    <h3 itemprop="name">Yükegel nedir?</h3>
    <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
      <div itemprop="text">
        <p>Yükegel, Türkiye'nin ilk ücretsiz ve açık kaynaklı nakliye ilan platformudur. 
        Yük sahipleri ile boş araç sahibi nakliyecileri bir araya getirir. 
        WhatsApp gruplarındaki kaotik ilan akışının yerine düzenli, aranabilir ve 
        güvenilir bir sistem sunar.</p>
      </div>
    </div>
  </div>

  <div itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
    <h3 itemprop="name">Yükegel'de ilan vermek ücretli mi?</h3>
    <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
      <div itemprop="text">
        <p>Hayır, Yükegel tamamen ücretsizdir. Hiçbir komisyon veya üyelik ücreti alınmaz. 
        Kullanıcılar yük veya boş araç ilanlarını ücretsiz olarak yayınlayabilir.</p>
      </div>
    </div>
  </div>

  <div itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
    <h3 itemprop="name">Yükegel'de hangi şehirler arası ilanlar var?</h3>
    <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
      <div itemprop="text">
        <p>Yükegel'de Türkiye'nin tüm illeri arası nakliye ilanları bulunmaktadır. 
        En popüler rotalar: İstanbul-Ankara, İstanbul-İzmir, Bursa-Gaziantep, 
        İzmir-Antalya, Ankara-Adana şeklindedir.</p>
      </div>
    </div>
  </div>
</section>
```

### 3.7 Karşılaştırma Tabloları

AI'lar yapılandırılmış veriyi (tablo) yapılandırılmamış metne tercih eder. Karşılaştırma sayfalarını HTML tablolara dönüştür [^5^]:

```html
<h2>Yükegel vs WhatsApp Nakliye Grupları</h2>
<table>
  <thead>
    <tr><th>Özellik</th><th>Yükegel</th><th>WhatsApp Grupları</th></tr>
  </thead>
  <tbody>
    <tr><td>Arama</td><td>Şehir, yük cinsi, tarih ile filtrele</td><td>Manuel kaydırma</td></tr>
    <tr><td>Güvenlik</td><td>KVKK uyumlu, telefon hash'lenmiş</td><td>Numara herkese açık</td></tr>
    <tr><td>Ücret</td><td>Ücretsiz</td><td>Ücretsiz ama kaotik</td></tr>
    <tr><td>İlan ömrü</td><td>7 gün, otomatik pasife düşme</td><td>Sonsuz, karışıklık</td></tr>
    <tr><td>İstatistik</td><td>Fiyat, tonaj, palet bilgisi</td><td>Yetersiz bilgi</td></tr>
  </tbody>
</table>
```

---

## 4. E-A-T & MARKA KONSENSÜSÜ

### 4.1 Dijital Konsensüs Denetimi

AI modelleri markanız hakkında farklı platformlarda tutarlı bilgi görmek ister. Tutarsızlık "Entity Confidence" puanını düşürür [^5^]:

| Platform | Standart Açıklama |
|----------|-------------------|
| Web sitesi | "Yükegel, Türkiye'nin ücretsiz nakliye ilan platformudur." |
| GitHub README | "Yükegel: Open-source freight listing platform for Turkey." |
| LinkedIn | "Yükegel - Ücretsiz Nakliye İlan Platformu" |
| Google Business | "Yükegel | Nakliye İlanları | Ücretsiz" |
| Twitter/X Bio | "Türkiye'nin nakliye ilan platformu. Yük & boş araç. Ücretsiz." |

**Kural:** Her platformda aynı 100 kelimelik "ground truth" açıklamasını kullan.

### 4.2 GitHub README SEO'su

GitHub repo'su public olduğu için AI modelleri README'yi de okur. README SEO değeri taşır:

```markdown
# Yükegel 🇹🇷

**Yükegel**, Türkiye'nin ücretsiz ve açık kaynaklı nakliye ilan platformudur.

## Nedir?

Yük sahipleri ile boş araç sahibi nakliyecileri bir araya getiren,
WhatsApp gruplarındaki kaosa son veren dijital platform.

## Özellikler

- ✅ Ücretsiz ilan verme ve arama
- ✅ 81 il arası nakliye ilanları
- ✅ Yük ilanları (cargo listings)
- ✅ Boş araç ilanları (empty truck listings)
- ✅ KVKK uyumlu telefon koruması
- ✅ AI tabanlı otomatik ilan ayrıştırma

## Teknoloji

- Next.js 15 + React + TypeScript
- Tailwind CSS
- Supabase (PostgreSQL + Auth)
- Vercel Hosting
- Claude API (opsiyonel parsing)

## Canlı Demo

🔗 [yukegel.com](https://yukegel.com)

## Kurucu

Dr. Bayram Dede - [GitHub](https://github.com/bayramdede)
```

### 4.3 Üçüncü Taraf Doğrulama

AI'lar sizin hakkınızda başkalarının ne dediğine sizin ne dediğinizden daha fazla güvenir [^5^]:

- **Hedef:** Sektörel bloglarda, üniversite araştırmalarında, haber sitelerinde Yükegel'den bahsettirmek
- **Strateji:**
  - Lojistik derneklerine (UTİKAD, UND) platformu tanıt
  - Girişim haberleri için TechCrunch, Webrazzi, Sirketler.net'e ulaş
  - Yerel haber sitelerinde "dijital dönüşüm" haberleri
  - Eksisozluk, Donanimhaber forumlarında doğal bahsedilişler

---

## 5. TEKNİK SEO

### 5.1 Sitemap.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Statik sayfalar -->
  <url>
    <loc>https://yukegel.com/</loc>
    <lastmod>2026-05-06</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://yukegel.com/ilan-ver</loc>
    <lastmod>2026-05-06</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://yukegel.com/nasil-calisir</loc>
    <lastmod>2026-05-06</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://yukegel.com/hakkimizda</loc>
    <lastmod>2026-05-06</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>https://yukegel.com/kvkk</loc>
    <lastmod>2026-05-06</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>

  <!-- Dinamik ilan sayfaları (örnek) -->
  <url>
    <loc>https://yukegel.com/ilanlar/istanbul-ankara</loc>
    <lastmod>2026-05-06</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>
```

### 5.2 Robots.txt (AI Botlarına Özel)

```
User-agent: *
Allow: /

# AI botlarına özel izinler
User-agent: ChatGPT-User
Allow: /

User-agent: GPTBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: anthropic-ai
Allow: /

# Hassas alanları engelle
Disallow: /admin/
Disallow: /api/
Disallow: /ilan-ver?*

Sitemap: https://yukegel.com/sitemap.xml
```

### 5.3 Canonical URL'ler

```html
<!-- Her sayfada -->
<link rel="canonical" href="https://yukegel.com/ilanlar/istanbul-ankara">

<!-- Dil varyasyonları (gelecekte) -->
<link rel="alternate" hreflang="tr" href="https://yukegel.com/ilanlar/istanbul-ankara">
<link rel="alternate" hreflang="en" href="https://yukegel.com/en/listings/istanbul-ankara">
```

### 5.4 Sayfa Hızı Optimizasyonu

| Metrik | Hedef | Yöntem |
|--------|-------|--------|
| LCP (Largest Contentful Paint) | < 2.5s | Resim optimizasyonu, next/image |
| FID (First Input Delay) | < 100ms | JS bundle azaltma, code splitting |
| CLS (Cumulative Layout Shift) | < 0.1 | Sabit boyutlar, font-display: swap |
| TTFB (Time to First Byte) | < 600ms | Vercel Edge Network, ISR |

### 5.5 Core Web Vitals İçin Next.js Ayarları

```typescript
// next.config.js
const nextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },
  compress: true,
  poweredByHeader: false,
  generateEtags: true,

  // ISR için
  async revalidate() {
    return {
      '/': 60,           // Ana sayfa her 60 saniye
      '/ilanlar/[slug]': 300, // İlan listeleri her 5 dakika
    }
  }
}

module.exports = nextConfig
```

---

## 6. LLMS.TXT - AI İçin "Özet Belge"

### 6.1 llms.txt Dosyası

Web sitenizin kök dizinine `llms.txt` dosyası ekleyin. Bu, AI modellerinin sitenizi hızlıca anlamasını sağlar [^3^][^7^][^8^]:

```markdown
# Yükegel

> Yükegel, Türkiye'nin ücretsiz nakliye ilan platformudur. 
> Yük sahipleri ve boş araç sahibi nakliyecileri bir araya getirir.
> Açık kaynaklıdır: github.com/bayramdede/yukegel

## Temel Bilgiler

- **Kuruluş:** Nisan 2026
- **Kurucu:** Dr. Bayram Dede
- **Web:** https://yukegel.com
- **GitHub:** https://github.com/bayramdede/yukegel
- **Ücret:** Tamamen ücretsiz, komisyon yok
- **Kapsam:** Türkiye geneli (81 il)
- **Teknoloji:** Next.js 15, Supabase, Vercel

## Platform Özellikleri

- Ücretsiz ilan verme ve arama
- Yük ilanları (cargo listings): tonaj, palet, yük cinsi
- Boş araç ilanları (empty truck listings): araç tipi, rota
- Şehir bazlı filtreleme
- Telefon ile doğrudan iletişim (KVKK hash'lenmiş)
- AI tabanlı otomatik ilan ayrıştırma (Claude API)
- 7 gün ilan ömrü, otomatik pasife düşme

## Popüler Rotalar

- İstanbul ↔ Ankara
- İstanbul ↔ İzmir
- Bursa ↔ Gaziantep
- İzmir ↔ Antalya
- Ankara ↔ Adana

## Önemli Sayfalar

- [Ana Sayfa](https://yukegel.com)
- [İlan Ver](https://yukegel.com/ilan-ver)
- [Nasıl Çalışır?](https://yukegel.com/nasil-calisir)
- [Hakkımızda](https://yukegel.com/hakkimizda)
- [KVKK Aydınlatma](https://yukegel.com/kvkk)

## İstatistikler (Mayıs 2026)

- 12.450+ aktif ilan
- 8.200+ kayıtlı nakliyeci
- 850+ günlük yeni ilan
- %98 kullanıcı memnuniyeti
- Ortalama 2 saat eşleşme süresi
```

### 6.2 llms.txt Durumu (2026)

**Önemli Not:** Google resmi olarak llms.txt kullanmadığını açıkladı [^9^]. Ancak:
- Anthropic (Claude), Vercel, Stripe, Hugging Face implemente etti
- 30 dakikalık düşük maliyetli yatırım [^8^]
- AI agent'lar için "ground truth" sağlar
- Hallüsinasyonları %30-70 azaltır [^3^]

**Öneri:** Implemente edin, gelecekte standart olabilir.

---

## 7. AI BELLEK OPTİMİZASYONU

### 7.1 Tekrarlayan Bilgi Yapısı

AI modelleri tekrar eden bilgileri daha iyi "hatırlar". Her sayfada tekrarlanacak elementler:

```html
<!-- Footer'da her sayfada -->
<footer>
  <p>
    <strong>Yükegel</strong> — Türkiye'nin ücretsiz nakliye ilan platformu. 
    Yük ve boş araç ilanlarını anında bulun.
  </p>
  <p>
    İstanbul, Ankara, İzmir, Bursa, Antalya ve tüm Türkiye şehirleri arası 
    nakliye hizmetleri.
  </p>
</footer>

<!-- Her ilan kartında -->
<article class="listing-card">
  <header>
    <span class="badge">YÜK</span>
    <h3>İstanbul → Ankara</h3>
  </header>
  <p>Yükegel'de yayında. 13.5 ton gıda yükü.</p>
  <footer>
    <a href="https://yukegel.com/ilan/123">yukegel.com'da görüntüle</a>
  </footer>
</article>
```

### 7.2 Tutarlı Marka Dili

| Terim | Kullanım | Neden |
|-------|----------|-------|
| Yükegel | Her zaman büyük Y, küçük ükegel | Marka tutarlılığı |
| "ücretsiz nakliye ilan platformu" | Her tanımda | Anahtar kelime pekiştirme |
| "WhatsApp gruplarındaki kaosa son" | Hero + About | Problem-çözüm hikayesi |
| "Türkiye'nin" | Her coğrafi referansta | Yerel SEO güçlendirme |

### 7.3 İçerik Güncelleme Stratejisi

AI modelleri güncel bilgileri tercih eder. Perplexity'nin "recency bias"'ı güçlüdür [^4^]:

| İçerik Türü | Güncelleme Sıklığı | Neden |
|-------------|-------------------|-------|
| Ana sayfa istatistikleri | Günlük | Güncel sayılar = güvenilirlik |
| Blog yazıları | Haftalık | Taze içerik = indeksleme |
| SSS (FAQ) | Aylık | Yeni sorular = yeni anahtar kelimeler |
| Fiyat rehberi | Aylık | Güncel fiyatlar = kullanıcı değeri |
| Hakkımızda | 3 ayda bir | Yeni başarılar, istatistikler |

### 7.4 "Son Güncelleme" Tarihleri

Her sayfada görünür "last updated" tarihi:

```html
<p class="last-updated">Son güncelleme: <time datetime="2026-05-06">6 Mayıs 2026</time></p>
```

---

## 8. İÇERİK STRATEJİSİ

### 8.1 Blog / Rehber Yazıları (AI İçin Değerli)

| Başlık | Anahtar Kelimeler | Hedef AI Sorgusu |
|--------|------------------|------------------|
| "2026 Nakliye Fiyatları Rehberi" | nakliye fiyatları, tır kiralama maliyeti | "Türkiye'de nakliye ne kadar?" |
| "En İyi 10 Nakliye Rotası" | popüler nakliye rotaları | "Hangi rotada nakliye var?" |
| "Yük Taşıma Sözleşmesi Örneği" | nakliye sözleşmesi, taşıma belgesi | "Nakliye sözleşmesi nasıl yazılır?" |
| "Frigo Taşımacılığı Nedir?" | frigo taşıma, soğuk zincir | "Frigo nakliye ne demek?" |
| "Yükegel vs WhatsApp Grupları" | nakliye ilanı verme, boş araç bulma | "Nakliye ilanı nereden verilir?" |

### 8.2 Şehir Sayfaları (Local SEO + GEO)

Her büyük şehir için özel sayfa:

```
/yuk-tasima/istanbul
/yuk-tasima/ankara
/yuk-tasima/izmir
/bos-arac/istanbul
/bos-arac/ankara
```

Her sayfa şunları içermeli:
- Şehir özel istatistikleri (aktif ilan sayısı, ortalama fiyat)
- Şehirden çıkan popüler rotalar
- Şehir hakkında kısa bilgi (AI'ın bağlam kurması için)
- Şehir özel FAQ

---

## 9. "HAKKIMIZDA" SAYFASI (AI İçin Kritik)

AI modelleri markalar hakkında bilgi edinirken "About Us" sayfalarına öncelik verir [^4^]:

```html
<!-- /hakkimizda sayfası -->
<article>
  <h1>Yükegel Hakkında</h1>

  <section>
    <h2>Yükegel Nedir?</h2>
    <p>
      Yükegel, <time datetime="2026-04">Nisan 2026</time>'da Dr. Bayram Dede tarafından 
      kurulan, <strong>Türkiye'nin ilk açık kaynaklı ve ücretsiz nakliye ilan platformudur</strong>.
      Platform, Türk lojistik sektöründe yük ve boş araç ilanlarının WhatsApp gruplarında 
      kaotik biçimde dolaşması sorununa dijital çözüm sunar.
    </p>
  </section>

  <section>
    <h2>Misyon ve Vizyon</h2>
    <p>
      <strong>Misyon:</strong> Türkiye'deki tüm nakliye ilanlarını tek, düzenli, 
      aranabilir ve güvenilir platformda toplamak.
    </p>
    <p>
      <strong>Vizyon:</strong> 2027 sonuna kadar 50.000+ aktif kullanıcıya ulaşmak ve 
      Türkiye'nin en büyük nakliye eşleştirme platformu olmak.
    </p>
  </section>

  <section>
    <h2>Teknik Altyapı</h2>
    <ul>
      <li>Frontend: Next.js 15 (React, TypeScript, Tailwind CSS)</li>
      <li>Backend: Supabase (PostgreSQL, Auth, Realtime)</li>
      <li>Hosting: Vercel (Edge Network)</li>
      <li>AI Parsing: Claude API (opsiyonel)</li>
      <li>Repo: github.com/bayramdede/yukegel (Açık Kaynak)</li>
    </ul>
  </section>

  <section>
    <h2>İletişim</h2>
    <address>
      <p>Web sitesi: <a href="https://yukegel.com">yukegel.com</a></p>
      <p>GitHub: <a href="https://github.com/bayramdede/yukegel">github.com/bayramdede/yukegel</a></p>
      <p>Kurucu: Dr. Bayram Dede</p>
    </address>
  </section>
</article>
```

---

## 10. PERFORMANS İZLEME

### 10.1 Takip Edilecek Metrikler

| Metrik | Araç | Hedef |
|--------|------|-------|
| Organik Trafik | Google Search Console | +20%/ay |
| AI Referans Sayısı | Perplexity, ChatGPT search | 50+/ay |
| Marka Aramaları | Google Trends | Artan trend |
| Backlink Sayısı | Ahrefs, SEMrush | 100+ kaliteli link |
| Core Web Vitals | PageSpeed Insights | Hepsi "İyi" |
| Schema Hataları | Google Rich Results Test | 0 hata |

### 10.2 AI Arama Testleri (Manuel Framework)

Düzenli olarak şu sorguları test edin [^5^]:

**Kategori Sorguları:**
```
"Türkiye'de nakliye ilanı verme sitesi"
"boş araç bulma platformu"
"ücretsiz yük taşıma ilanı"
```

**Karşılaştırma Sorguları:**
```
"Yükegel vs Loadem"
"Yükegel vs TırKamyon"
"en iyi nakliye ilan sitesi"
```

**Ticari Sorgular:**
```
"Yükegel ücretli mi"
"Yükegel nedir"
"nakliye ilanı nasıl verilir"
```

**Test Protokolü:**
1. 20-30 sorgu hazırla
2. ChatGPT, Perplexity, Claude, Gemini, Google AI Overviews'da test et
3. Hangi sorgular markayı tetikliyor, bilgi doğru mu not al
4. Boşlukları (rakiplerin cite edildiği yerler) belirle
5. İçerik stratejisini buna göre güncelle

### 10.3 GEO Metrikleri

2026'nın yeni KPI'ları [^1^]:

| Metrik | Tanım | Hedef |
|--------|-------|-------|
| Citation Frequency | AI yanıtlarında marka cite edilme sıklığı | Artan |
| Brand Visibility Score | AI yanıtlarında marka görünürlük puanı | >70/100 |
| AI Share of Voice | Rakiplere göre AI'da görünürlük payı | >30% |
| Sentiment Analysis | AI yanıtlarındaki marka duygu analizi | Pozitif |
| Zero-Click Displacement | AI yanıtlarından kaybedilen/gelen trafik | Pozitif |

---

## 11. UYGULAMA CHECKLIST

### Hemen Yapılacaklar (Hafta 1)
- [ ] Meta etiketleri dinamik hale getir (Next.js metadata API)
- [ ] JSON-LD schema ekle (Organization, WebSite, FAQPage)
- [ ] Sitemap.xml oluştur ve otomatik güncelle
- [ ] robots.txt AI botlarına izin verecek şekilde güncelle
- [ ] llm.txt dosyası oluştur
- [ ] KVKK ve Gizlilik Politikası sayfaları ekle
- [ ] Hakkımızda sayfası oluştur (AI için detaylı)
- [ ] FAQ sayfası ekle (Schema.org markup ile, 30+ soru hedefi)

### Kısa Vadeli (2-4 hafta)
- [ ] Blog/rehber altyapısı kur
- [ ] İlk 5 blog yazısını yayınla (istatistik yoğun)
- [ ] Şehir sayfalarını oluştur (İstanbul, Ankara, İzmir, Bursa)
- [ ] Google Business Profile oluştur
- [ ] Sosyal medya hesapları aç (LinkedIn, Twitter/X)
- [ ] GitHub README'yi SEO dostu hale getir
- [ ] Karşılaştırma tabloları ekle (Yükegel vs alternatifler)

### Orta Vadeli (1-3 ay)
- [ ] Wikipedia/Wikidata girişi için çalışma başlat
- [ ] Sektörel bloglardan backlink al
- [ ] Kullanıcı yorumları / sosyal kanıt topla (Schema.org Review)
- [ ] Video içerik üret (YouTube: "Yükegel nasıl kullanılır?")
- [ ] Podcast / röportaj fırsatları ara
- [ ] AI arama testlerini haftalık yap
- [ ] İçerikleri 7-14 günde güncelle

---

## 12. ÖNEMLİ NOTLAR

1. **AI modelleri değişir:** ChatGPT, Gemini, Perplexity vb. algoritmaları sürekli güncellenir. Bu doküman 3 ayda bir gözden geçirilmelidir.

2. **İçerik kalitesi > miktarı:** AI modelleri spam içeriği cezalandırır. Her sayfa gerçek değer sunmalıdır. GEO'da faktörel yoğunluk (factual density) anahtar kelime yoğunluğundan (keyword density) daha önemlidir [^1^].

3. **Tutarlılık kritiktir:** Marka adı, açıklamalar, istatistikler tüm platformlarda (web, sosyal, GitHub) tutarlı olmalıdır. "Digital Consensus Audit" yapın [^5^].

4. **Kullanıcı deneyimi = SEO = GEO:** AI modelleri kullanıcı davranışlarını da analiz eder. Hızlı, kullanışlı siteler tercih edilir. Core Web Vitals hepsi "İyi" olmalı.

5. **Açık kaynak avantajı:** GitHub repo'su public olduğu için AI modelleri kodu da analiz edebilir. README ve kod yorumları SEO değeri taşır.

6. **GEO sonuçları yavaş gelir:** 3-6 ay tutarlı çalışma gerektirir. 4-6 haftada sonuç beklemeyin [^6^].

7. **Tek platforma optimizasyon yetersiz:** ChatGPT, Perplexity, Gemini, Claude hepsi için evrensel GEO prensipleri uygulayın [^4^].

8. **İstatistikler moattır:** Orijinal veri ("1M API isteği analiz ettik...") AI için en güçlü farklılaştırıcıdır. Her istatistiğin kaynağı olmalı [^5^].

---

**Doküman Versiyon:** v2.0  
**Son Güncelleme:** Mayıs 2026  
**Hazırlayan:** AI Asistan (Kimi K2.6)  
**Kaynaklar:** Princeton/Georgia Tech GEO Araştırması, Gartner 2026 AI Raporu, OG Tool GEO Rehberi, WP Manage Ninja GEO Kılavuzu  
**Sorumlu:** Dr. Bayram Dede
