# Mudanya Üniversitesi Chatbot — Veri Katmanı

Öğrenci bilgi sistemi chatbotunun veri temeli. Veritabanı erişimi olmadığı için tüm
bilgi `mudanya.edu.tr` üzerinden kazınıyor (scraping) ve yapısal JSON'a çevriliyor.

Bu depo şu an **sadece veri katmanı**. Chatbot API'si, WhatsApp entegrasyonu ve web
widget'ı bu veri setinin üzerine kurulacak (bkz. [Sonraki adımlar](#sonraki-adımlar)).

## Neden bu şekilde

Fiyat, kontenjan ve tarih gibi bilgilerde uydurma cevap kabul edilemez. Bu yüzden:

- **Kritik sayılar yapısal alanlarda tutulur**, serbest metinde değil. Chatbot ücreti
  vektör aramasından değil `programs.json`'dan okur.
- **Her kaydın `kaynak_url`'si vardır.** Bot cevabın altına kaynağı koyabilir.
- **`npm run verify`** kaynak sayfaları canlı yeniden çekip veri setindeki her sayıyı
  karşılaştırır. Uyuşmazlıkta çıkış kodu 1 döner — cron/CI ile bozulmayı yakalar.
- Site 2200+ URL içeriyor ama bir öğrencinin sorduğu her şey ~38 sayfada geçiyor.
  Tam site indekslemek yerine [`scripts/catalog.ts`](scripts/catalog.ts) içinde
  **küratörlü sayfa listesi** kullanılıyor; bu, gürültüyü düşürüp doğruluğu artırıyor.

## Kurulum

```bash
npm install
```

Node 22+ gerekiyor (TypeScript dosyaları `--experimental-strip-types` ile doğrudan
çalıştırılıyor, ayrı derleme adımı yok).

## Komutlar

| Komut | İş |
| --- | --- |
| `npm run discover` | Sitemap + link takibiyle URL keşfi, ham HTML'i `data/raw/` içine indirir (~18 dk) |
| `npm run fees` | Ücret tablolarını `data/programs.json`'a çevirir |
| `npm run programs` | Programlara bölüm tanıtım metinlerini ekler |
| `npm run content` | Küratörlü sayfaları `data/content.json`'a çevirir |
| `npm run campus` | Konum/iletişim/ulaşım verisini `data/campus.json`'a çevirir |
| `npm run build:data` | Yukarıdaki 4 parse adımını sırayla çalıştırır (önbellekten, saniyeler) |
| `npm run scrape` | `discover` + `build:data` — sıfırdan tam yenileme |
| `npm run verify` | Sayıları canlı kaynakla karşılaştırır |
| `npm run inspect /icerik/645` | Bir sayfanın tablolarını grid olarak döker (geliştirme yardımcısı) |

`data/raw/` bir disk önbelleği. Parse adımlarını tekrar çalıştırmak siteye yeni istek
atmaz; sadece `discover` ve `verify` ağa çıkar. İstekler arası 400 ms bekleme var ve
`robots.txt` disallow listesi [`scripts/lib/http.ts`](scripts/lib/http.ts) içinde
uygulanıyor.

## Üretilen veri

### `data/programs.json` — 39 program

Ücret ve kontenjan gibi kesinlik gerektiren her şey burada. Kaynaklar:
[TL ücretler](https://mudanya.edu.tr/icerik/645) ve
[uluslararası öğrenci ücretleri](https://mudanya.edu.tr/icerik/73).

```json
{
  "slug": "bilgisayar-muhendisligi--tr",
  "ad": "Bilgisayar Mühendisliği",
  "fakulte": "Mühendislik, Mimarlık ve Tasarım Fakültesi",
  "seviye": "lisans",
  "egitim_dili": "Türkçe",
  "akademik_yil": "2026-2027",
  "ucret_try": {
    "tam": 1224000,
    "burslu_50": 612000,
    "not": "Peşin ödeme için geçerlidir.",
    "kaynak": "https://mudanya.edu.tr/icerik/645"
  },
  "ucret_usd_uluslararasi": {
    "erken_kayit": 4800,
    "standart": 6000,
    "kontenjan": 45,
    "kaynak": "https://mudanya.edu.tr/icerik/73"
  },
  "sayfa_url": "https://mudanya.edu.tr/fakulte/muhendislik-mimarlik-tasarim/bolum/bilgisayar-muhendisligi-009248",
  "aciklama": "Bilgisayar mühendisliği; bilgisayarların bilgiyi nasıl ...",
  "detay_url": "..."
}
```

Ücret tablosu Word'den yapıştırılmış ve fakülte adları `rowspan` ile birleştirilmiş.
Düz metin çıkarma satırları kaydırıyor; bu yüzden
[`scripts/lib/table.ts`](scripts/lib/table.ts) tabloyu `rowspan`/`colspan` açarak
gride çeviriyor. **Dikkat:** `ÜCRETLİ` kolonu tam ücret, `%50 BURSLU` kolonu yarısı.
İkisini karıştırmak fiyatı yarı yarıya yanlış gösteriyor.

TL tablosunda olup uluslararası öğrenci listesinde yer almayan 7 program var (Aşçılık,
Gastronomi, Malzeme Bilimi, Biyoteknoloji, Tele Sağlık, İmalat Yürütme Sistemleri,
Ekonomi Finans İngilizce). Bunlarda `ucret_usd_uluslararasi` alanı `null` — tahmin
üretilmiyor.

### `data/content.json` — 38 parça, ~59.000 karakter

Serbest metin bilgisi; vektör aramaya girecek kısım. Her parçada kategori, o sayfanın
cevapladığı örnek sorular, PDF/form linkleri, görseller, harita linkleri ve sayfadan
toplanan telefon/e-posta var.

Kategoriler: `ucret_burs`, `basvuru_kayit`, `uluslararasi`, `akademik_takvim`,
`kampus_yasam`, `konum_ulasim`, `egitim_modeli`, `ogrenci_hizmet`, `kurumsal`,
`mevzuat`, `iletisim`.

### `data/campus.json` — konum kaydı

Konum sorusuna harita ve görselle cevap verebilmek için:

```json
{
  "adres": "Çağrışan Mah. 2029 Sk. No:2 16940 Mudanya/Bursa",
  "telefon_e164": "+902242242022",
  "eposta": "bilgi@mudanya.edu.tr",
  "whatsapp_link": "https://wa.me/902242242022",
  "konum": {
    "enlem": 40.29955979325504,
    "boylam": 28.947955873509045,
    "google_maps_link": "https://www.google.com/maps/search/?api=1&query=40.2995...",
    "not": "Koordinat, iletişim sayfasındaki gömülü Google Maps haritasından alındı."
  },
  "ulasim": { "harita_rotalari": [], "burulas_otobus_hatlari": ["14 L", "14 L3", "14 U"] },
  "gorseller": []
}
```

Sitedeki WhatsApp linki bozuk (`phone=++90(224)2242022`). Normalize edilmiş hali
`whatsapp_link`, kaynaktaki hali `whatsapp_link_kaynakta` alanında.

### `data/urls.json`

Keşfedilen 2211 URL, gruplara ayrılmış. Kataloğu genişletmek için referans.

## Doğrulama

```bash
npm run verify
```

Kontrol ettikleri:

- Akademik yıl başlığı değişmiş mi (yeni yıl ücretleri yayınlanmış mı)
- 39 programın tam ve %50 burslu TL ücreti kaynakla aynı mı
- USD erken kayıt / standart ücret ve kontenjan aynı mı
- `%50 burslu` gerçekten tam ücretin yarısı mı (tutarlılık kontrolü)
- 38 içerik sayfasının tamamı hâlâ HTTP 200 dönüyor mu

Son çalıştırma: **39/39 program birebir uyuşuyor.**

## Bilinen sınırlar

- **PDF içerikleri okunmuyor.** Burs yönergesi, yatay geçiş yönergesi, akademik takvim
  gibi belgeler link olarak veri setinde var ama içi parse edilmiyor. Chatbot bu
  konularda linki verebilir, içerikten cevap veremez.
- **Yurt ücretleri sitede yok.** Sadece anlaşmalı yurtların adı ve telefonu var.
- **`/aday-ogrenci` sayfası** istemci tarafında render ediliyor, sunucu HTML'i boş.
  Gerekirse Playwright ile alınabilir.
- **Lisansüstü ücretleri** `/icerik/92` içinde ama `programs.json`'a dahil edilmedi;
  lisans/önlisans yapısından farklı.
- **İngilizce içerik henüz çekilmedi.** Site `/faculty/...`, `/contact` gibi paralel
  bir İngilizce ağaç sunuyor (`sitemap-en.xml`, 1214 URL). Katalog İngilizce yollarla
  genişletilerek dile göre cevap verilebilir.

## Sonraki adımlar

1. **Supabase şeması**: `programs` tablosu (yapısal sorgu), `doc_chunks` + `pgvector`
   (metin arama), `conversations`/`messages`, cevaplanamayan soruları biriktiren
   `unanswered` tablosu.
2. **`/api/chat` çekirdeği**: niyet çıkarma → ücret sorusuysa SQL, konu sorusuysa
   vektör arama → LLM sadece bulunan bağlamı Türkçe/İngilizce cümleye döker.
   Bağlamda yoksa "bilmiyorum" + `bilgi@mudanya.edu.tr` yönlendirmesi.
3. **Web widget** (iframe) — hata ayıklaması WhatsApp'tan kolay, önce bu.
4. **WhatsApp Cloud API webhook'u** + buton/liste menüsü.
5. **Gece cron**: `npm run verify`, uyuşmazlıkta `npm run scrape` ve bildirim.
