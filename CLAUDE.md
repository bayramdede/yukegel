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

## Kod yazarken
- Dosya değişikliği → önce `read_text_file` ile mevcut hali oku
- Uzun dosyalarda `write_file` tercih et, `edit_file` ile partial match riski var
- Server action → ayrı dosyada `'use server'` directive
- RLS bypass → sadece admin/mod doğrulandıktan sonra `getServiceSupabase()`
