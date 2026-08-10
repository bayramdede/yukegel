@AGENTS.md

# Yükegel Proje Kuralları

## Sohbet başlangıcı — OTOMATİK
Her sohbetin ilk mesajından önce `docs/PROJE_HARITASI.md` dosyasını oku. Kullanıcı söylemese bile yap.

## Kaynak dosya okuma
Haritadan anlayabiliyorsan kaynak dosyayı okuma. Değişiklik yapacaksan o dosyayı oku.

## Sohbet sonunda — OTOMATİK
Şu değişikliklerden biri olduysa `docs/PROJE_HARITASI.md` ve `docs/YAPILACAKLAR.md`'yi güncelle:
- Yeni dosya/route eklendi veya silindi
- DB şeması değişti (yeni tablo, kolon, index)
- Görev tamamlandı veya yeni bug/görev ortaya çıktı
- Yeni pattern veya tuzak keşfedildi
- Auth akışı veya middleware değişti

### Üç dosyanın işi AYRI — karıştırma (10 Ağu 2026)
- `docs/YAPILACAKLAR.md` → **yalnız BEKLEYEN iş.** Bir madde kapandığında oradan
  **SİLİNİR**, "✅" diye bırakılmaz. Bu dosya 4.962 satıra çıkmış ve `⏳`
  işaretlerinin çoğu bayatlamıştı; liste ancak kısa kaldığı sürece doğru kalır.
- `docs/ARSIV_YAPILACAKLAR.md` → olay kaydı, ölçümler, gerekçeler. **Yeni madde eklenmez.**
- `docs/PROJE_HARITASI.md` §9 → kalıcı dersler. Bir ders gelecekte iş görecekse yeri burasıdır.

⚠️ Bir maddeyi kapatmadan önce **VERİYE bak, listeye değil.**

## Kod yazarken
- Dosya değişikliği → önce `read_text_file` ile mevcut hali oku
- Uzun dosyalarda `write_file` tercih et, `edit_file` ile partial match riski var
- Server action → ayrı dosyada `'use server'` directive
- RLS bypass → sadece admin/mod doğrulandıktan sonra `getServiceSupabase()`

#Otomasyon
- Otonom yapabileceğin her şeyi yap. Bir soru sıradaki maddeyi engellemiyorsa, o soruyu blockers.md dosyasına yaz ve bir sonraki maddeyle devam et. 
- Sadece gerçekten ilerlemeyi tıkayan kritik bir durumda dur ve sor.
