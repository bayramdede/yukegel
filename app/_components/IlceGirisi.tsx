'use client';

import { useId } from 'react';
import { ilceler, ilId } from '../../lib/lokasyon';

// 8 Ağu 2026 — `docs/COGRAFI_GECIS.md`'nin "Serbest ilçe girişi" bölümü (spec md.7)
// baştan beri "İlçe alanı Searchable Select AMA serbest girişe kapalı değil"
// diyordu. Kod tarafı bunu hiç kurmamıştı: ilan-ver ve moderatör formlarında
// ilçe alanı sıfır önerili düz bir `<input>` idi — spec ile canlı arasında
// (Bayram'ın deyişiyle) "öyle konuşmadık" farkı buydu. Veri zaten vardı
// (`locations.json`, 973 resmî ilçe, `lib/lokasyon.ts::ilceler()`); eksik olan
// yalnız bu bileşendi.
//
// Native `<input list>` + `<datalist>` seçildi (üçüncü parti kütüphane yok,
// projenin geri kalanıyla aynı sadelik): seçilen ile göre öneri listesi
// filtrelenir, kullanıcı listede olmayan bir şey de yazabilir (spec'in
// istediği "serbest girişe kapalı değil" tam olarak bu). Resmî/serbest ayrımı
// zaten `ilceNormalize()`/`district_official` ile SUNUCU tarafında yapılıyor —
// bu bileşen yalnız ÖNERİ sağlar, DOĞRULAMA yapmaz.
interface Props {
  /** İl adı VEYA `province_id` — `ilId()` ikisini de çözer. Seçilmemişse öneri boş kalır. */
  il: string | number | null | undefined;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  /** Etiketi `<label>` olmayan yerlerde erişilebilir ad (ve testler için tutamak). */
  ariaLabel?: string;
}

export default function IlceGirisi({ il, value, onChange, placeholder, style, disabled, ariaLabel }: Props) {
  const listId = useId();
  const id = ilId(il ?? '');
  const secenekler = id ? ilceler(id) : [];

  return (
    <>
      <input
        list={listId}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? (secenekler.length ? 'İlçe seçin veya yazın' : 'İlçe (opsiyonel)')}
        style={style}
        disabled={disabled}
        aria-label={ariaLabel}
        autoComplete="off"
      />
      {/* İl seçilmemişse datalist boş kalır — input yine de serbest yazıma açık kalır. */}
      <datalist id={listId}>
        {secenekler.map(d => <option key={d} value={d} />)}
      </datalist>
    </>
  );
}
