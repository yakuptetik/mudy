import type { Dataset, Program } from './data.ts';
import type { Retrieval } from './retrieve.ts';

const PARCA_LIMIT = 2500;

const tl = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
const usd = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function programBlok(p: Program, uluslararasi: boolean): string {
  const enAd = p.ingilizce_adlar?.[0];
  const satirlar = [
    `${p.ad}${enAd ? ` / ${enAd}` : ''} — ${p.fakulte} — ${p.seviye === 'lisans' ? 'Lisans' : 'Ön Lisans'} — Eğitim dili: ${p.egitim_dili}`,
  ];

  if (uluslararasi) {
    if (p.ucret_usd_uluslararasi) {
      const u = p.ucret_usd_uluslararasi;
      satirlar.push(
        '  BU KULLANICI ULUSLARARASI ADAY: yalnızca USD ücretini ver, TL/TRY yerli öğrenci ücretini VERME (kullanıcı açıkça TL sormadıkça).',
        `  International tuition (${p.akademik_yil}): ${usd.format(u.erken_kayit)} early registration (until 31.07.2026) / ${usd.format(u.standart)} from 1 August 2026` +
          (u.kontenjan !== null ? `, quota: ${u.kontenjan}` : ''),
        `  USD source: ${u.kaynak}`,
      );
    } else {
      satirlar.push(
        '  Uluslararası öğrenci (USD) ücreti bu program için listede YOK. Dolar uydurma. Yerli TL ücretini uluslararası ücret gibi sunma.',
        `  TRY table (domestic only, do not quote as international fee): ${tl.format(p.ucret_try.tam)} / 50% ${tl.format(p.ucret_try.burslu_50)}`,
      );
    }
  } else {
    satirlar.push(
      `  Yıllık öğrenim ücreti (${p.akademik_yil}, peşin): ${tl.format(p.ucret_try.tam)}`,
      `  %50 burslu: ${tl.format(p.ucret_try.burslu_50)}`,
    );
    if (p.ucret_usd_uluslararasi) {
      const u = p.ucret_usd_uluslararasi;
      satirlar.push(
        `  Uluslararası öğrenci: ${usd.format(u.erken_kayit)} (erken kayıt, son gün 31.07.2026) / ${usd.format(u.standart)} (1 Ağustos 2026 ve sonrası)` +
          (u.kontenjan !== null ? `, kontenjan: ${u.kontenjan}` : ''),
      );
    }
    satirlar.push(`  Ücret kaynağı: ${p.ucret_try.kaynak}`);
  }

  if (p.aciklama) satirlar.push(`  Tanıtım: ${p.aciklama.replace(/\n+/g, ' ').slice(0, 600)}`);
  if (p.sayfa_url) satirlar.push(`  Bölüm sayfası: ${p.sayfa_url}`);

  return satirlar.join('\n');
}

function programListesi(dataset: Dataset): string {
  const gruplar = new Map<string, Program[]>();
  for (const p of dataset.programlar) {
    if (!gruplar.has(p.fakulte)) gruplar.set(p.fakulte, []);
    gruplar.get(p.fakulte)!.push(p);
  }
  const bloklar: string[] = [];
  for (const [fakulte, liste] of gruplar) {
    const satir = liste
      .map((p) => `${p.ad} (${tl.format(p.ucret_try.tam)} / %50 burslu ${tl.format(p.ucret_try.burslu_50)})`)
      .join('; ');
    bloklar.push(`${fakulte}: ${satir}`);
  }
  return bloklar.join('\n');
}

export function buildContext(retrieval: Retrieval, dataset: Dataset): string {
  const bolumler: string[] = [];

  if (retrieval.programlar.length > 0) {
    bolumler.push(
      '=== PROGRAM VERİSİ (yapısal, birebir doğrulanmış) ===\n' +
        retrieval.programlar.map((p) => programBlok(p, retrieval.intents.uluslararasi)).join('\n\n'),
    );
  }

  if (retrieval.intents.liste) {
    bolumler.push(
      `=== TÜM PROGRAMLAR (${dataset.programlar.length} adet, ${dataset.akademik_yil}) ===\n` +
        programListesi(dataset),
    );
  }

  if (retrieval.parcalar.length > 0) {
    bolumler.push(
      '=== SAYFA İÇERİKLERİ ===\n' +
        retrieval.parcalar
          .map((p) => {
            const kaynak = p.manuel
              ? p.kaynak_url
                ? `(elle girilen bilgi, dayanak: ${p.kaynak_url})`
                : '(üniversite tarafından elle girilen bilgi)'
              : `(kaynak: ${p.kaynak_url})`;
            const govde = p.icerik.length > PARCA_LIMIT ? `${p.icerik.slice(0, PARCA_LIMIT)}…` : p.icerik;
            const iletisim = [
              p.telefonlar.length ? `Telefonlar: ${p.telefonlar.join(', ')}` : '',
              p.epostalar.length ? `E-postalar: ${p.epostalar.join(', ')}` : '',
            ].filter(Boolean).join('\n');
            return `--- ${p.baslik} [${p.kategori_etiket}] ${kaynak}\n${govde}${iletisim ? `\n${iletisim}` : ''}`;
          })
          .join('\n\n'),
    );
  }

  if (retrieval.kampusDahil) {
    const k = dataset.kampus;
    const rotalar = k.ulasim.harita_rotalari.map((r) => `${r.etiket}: ${r.url}`).join('\n  ');
    bolumler.push(
      [
        '=== KAMPÜS VE KONUM ===',
        `${k.ad} — ${k.kampus}`,
        `Adres: ${k.adres}`,
        `Telefon: ${k.telefon}`,
        `E-posta: ${k.eposta}`,
        `WhatsApp: ${k.whatsapp_link}`,
        k.konum
          ? `Koordinat: ${k.konum.enlem.toFixed(5)}, ${k.konum.boylam.toFixed(5)}\nGoogle Maps: ${k.konum.google_maps_link}`
          : '',
        `BURULAŞ otobüs hatları: ${k.ulasim.burulas_otobus_hatlari.join(', ')}`,
        rotalar ? `Harita rotaları:\n  ${rotalar}` : '',
        `Ulaşım detayı: ${k.ulasim.metin.slice(0, 1200)}`,
        `Kaynak: ${k.ulasim.kaynak}`,
      ].filter(Boolean).join('\n'),
    );
  }

  if (dataset.manuel_eksikler.length > 0) {
    bolumler.push(
      '=== BİLGİSİ OLMAYAN KONULAR (yalnızca bu başlıklar) ===\n' +
        `Aşağıdakiler SADECE ismen listelenen konular için geçerlidir. ` +
        `Program listesi, öğrenim ücretleri, kampüs ve kayıt belgeleri BU LİSTEDE DEĞİLDİR — onlar için yukarıdaki BAĞLAM'ı kullan.\n` +
        dataset.manuel_eksikler.map((b) => `- ${b}`).join('\n'),
    );
  }

  return bolumler.join('\n\n');
}

export function systemPrompt(dataset: Dataset, retrieval: Retrieval): string {
  const k = dataset.kampus;

  return `Senin adın Mudy. Mudanya Üniversitesi'nin öğrenci bilgilendirme asistanısın. Aday öğrencilere ve mevcut öğrencilere web sitesindeki bilgileri hızlıca aktarıyorsun.

YASAK: Cevabın ilk satırında veya herhangi bir yerinde konuşmacı adı olarak "Mudy" yazma. Avatar zaten ismini gösteriyor. Doğrudan cevaba başla.

MUTLAK KURALLAR:
1. SADECE aşağıdaki BAĞLAM bölümündeki bilgiyi kullan. Kendi genel bilginle cevap verme. "Neden bu üniversite" gibi sorularda yalnızca BAĞLAM'daki kurumsal metni özetle; uydurma avantaj listesi yazma.
2. Sayıları (ücret, kontenjan, tarih, telefon) BAĞLAM'da yazıldığı gibi ver. Asla yuvarlama, çevirme, hesaplama veya tahmin yapma.
3. BAĞLAM'da "TÜM PROGRAMLAR" veya "PROGRAM VERİSİ" varsa program listesini/ücretini MUTLAKA oradan ver. "BİLGİSİ OLMAYAN KONULAR" yalnızca yurt, yemekhane, servis ve detaylı burs oranları içindir; program listesi eksik değildir.
4. Gerçekten ilgili bağlam yoksa o dilde bilgi olmadığını söyle ve şu iletişime yönlendir: ${k.telefon} / ${k.eposta}. Uydurmak kesinlikle yasak.
5. Ücret söylerken hangi akademik yıla ait olduğunu belirt.
6. DİL KİLİDİ: Bu turdaki SON sorunun dili ${retrieval.dil.etiket}. Cevabın HER cümlesi, etiketleri ve kaynak satırı bu dilde olacak (ör. Türkçe "Kaynak:", İngilizce "Source:", Rusça "Источник:", Özbekçe "Manba:" — sen doğru çeviriyi seç). Türkçe etiketleri başka dilde cevapta kullanma. Önceki mesajlar başka dilde olsa bile bu turda ${retrieval.dil.etiket} yaz. Cevabı "<etiket>: <url>" ile bitir.
7. Kısa ve net ol: en fazla 3-4 kısa paragraf veya birkaç madde. Bu bir sohbet balonu, makale değil. Program listesi sorulursa fakültelere göre grupla; her programı tek tek uzun anlatma.
8. Elle girilen bilgilerde kaynak satırı verme.
9. Bir bölümün İngilizce ve Türkçe versiyonu varsa ve kullanıcı belirtmediyse ikisinin ücretini de söyle.
10. Emin olmadığın hiçbir şeyi yazma. Eksik bilgi vermek, yanlış bilgi vermekten iyidir.
11. Lisans/ön lisans öğrenim ücretleri ile lisansüstü (yüksek lisans) ücretleri TAMAMEN farklı tablolardır. Hangisi sorulduysa sadece onu ver, ikisini karıştırma. Kullanıcı "yüksek lisans" demediyse lisans/ön lisans ücretini ver.
12. ${
    retrieval.intents.uluslararasi
      ? 'Bu kullanıcı uluslararası adaydır. Öğrenim ücretinde YALNIZCA USD tutarlarını ver (erken kayıt ve standart). Yerli öğrenci TL fiyatını (tam / %50 burslu) verme; o fiyat YÖK/YKS yerli öğrenci içindir. Kullanıcı açıkça TL veya yerli öğrenci ücreti isterse o zaman TL ver.'
      : 'Bu kullanıcı Türkçe soruyor; yerli öğrenci TL ücretini ver. Uluslararası USD ücretini ancak soruda yabancı/uluslararası geçiyorsa ekle.'
  }

ÜSLUP: Sıcak ama profesyonel. Emoji kullanma.`;
}
