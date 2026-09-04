/**
 * Mudy - Mudanya Üniversitesi öğrenci bilgi asistanı widget'ı.
 *
 * Kullanım:
 *   <script src="https://.../widget.js" data-api="https://.../api/chat" defer></script>
 *
 * Shadow DOM kullanıyor: sitenin CSS'i widget'ı, widget'ın CSS'i siteyi bozmaz.
 */
(function () {
  'use strict';

  const script = document.currentScript || document.querySelector('script[src*="widget.js"]');
  const API = (script && script.dataset.api) || new URL('/api/chat', location.origin).toString();
  const BASLIK = (script && script.dataset.baslik) || 'Mudy';
  const ALT_BASLIK = (script && script.dataset.altBaslik) || 'Mudanya Üniversitesi Öğrenci Asistanı';
  const AVATAR = (script && script.dataset.avatar) || new URL('/mudy.jpeg', location.origin).toString();

  const ONERILER = [
    'Bilgisayar Mühendisliği ücreti ne kadar?',
    'Hangi bölümler var?',
    'Kampüs nerede, nasıl gelebilirim?',
    'Kayıt için hangi belgeler gerekli?',
    'Yurt imkanları nasıl?',
  ];

  const RENK = { ana: '#030635', koyu: '#0c1a40', vurgu: '#e7272d' };

  const CSS = `
    :host { all: initial; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
    * { box-sizing: border-box; margin: 0; padding: 0; }

    .launcher {
      position: fixed; bottom: 24px; right: 24px; z-index: 2147483000;
      width: 68px; height: 68px; border-radius: 50%; cursor: pointer;
      border: 2px solid ${RENK.ana}; padding: 0; overflow: visible;
      background: #eef2fb;
      box-shadow: 0 10px 30px rgba(3,6,53,.35);
      transition: transform .2s ease, box-shadow .2s ease;
    }
    .launcher:hover { transform: translateY(-3px) scale(1.05); box-shadow: 0 16px 38px rgba(3,6,53,.45); }
    .launcher.gizli { display: none; }
    .launcher img {
      width: 100%; height: 100%; border-radius: 50%; object-fit: cover;
      display: block; pointer-events: none;
    }
    .nokta {
      position: absolute; top: 2px; right: 2px; width: 14px; height: 14px;
      border-radius: 50%; background: ${RENK.vurgu}; border: 2px solid #fff;
      animation: nabiz 2s infinite;
    }
    @keyframes nabiz {
      0%, 100% { box-shadow: 0 0 0 0 rgba(231,39,45,.5); }
      50% { box-shadow: 0 0 0 7px rgba(231,39,45,0); }
    }
    .baloncuk {
      position: absolute; right: 78px; top: 50%; transform: translateY(-50%);
      background: #fff; color: ${RENK.ana}; font-size: 13px; font-weight: 500;
      padding: 9px 14px; border-radius: 14px; white-space: nowrap;
      box-shadow: 0 6px 20px rgba(3,6,53,.18); pointer-events: none;
      opacity: 0; animation: ipucu 9s ease .8s forwards;
    }
    @keyframes ipucu {
      0% { opacity: 0; transform: translateY(-50%) translateX(8px); }
      6%, 78% { opacity: 1; transform: translateY(-50%) translateX(0); }
      100% { opacity: 0; transform: translateY(-50%) translateX(8px); }
    }
    @media (max-width: 520px) { .baloncuk { display: none; } }

    .panel {
      position: fixed; bottom: 24px; right: 24px; z-index: 2147483001;
      width: 400px; height: min(640px, calc(100vh - 48px));
      background: #fff; border-radius: 20px; overflow: hidden;
      display: none; flex-direction: column;
      box-shadow: 0 24px 60px rgba(3,6,53,.28), 0 0 0 1px rgba(3,6,53,.06);
      animation: gir .22s ease;
    }
    .panel.acik { display: flex; }
    @keyframes gir { from { opacity: 0; transform: translateY(12px) scale(.98); } }

    @media (max-width: 520px) {
      .panel { inset: 0; width: 100%; height: 100%; border-radius: 0; }
      .launcher { bottom: 16px; right: 16px; }
    }

    .baslik {
      background: ${RENK.ana}; color: #fff; padding: 16px 18px;
      display: flex; align-items: center; gap: 12px; flex-shrink: 0;
    }
    .logo {
      width: 42px; height: 42px; border-radius: 50%; flex-shrink: 0;
      background: #eef2fb; object-fit: cover;
      border: 2px solid rgba(255,255,255,.25);
    }
    .durum { display: flex; align-items: center; gap: 5px; }
    .durum i {
      width: 7px; height: 7px; border-radius: 50%; background: #4ade80;
      display: inline-block; flex-shrink: 0;
    }
    .baslik-metin { flex: 1; min-width: 0; }
    .baslik h3 { font-size: 15px; font-weight: 600; line-height: 1.3; }
    .baslik p { font-size: 12px; opacity: .72; margin-top: 2px; }
    .kapat {
      background: transparent; border: none; color: #fff; cursor: pointer;
      width: 32px; height: 32px; border-radius: 8px; display: grid; place-items: center;
      opacity: .75; transition: opacity .15s, background .15s;
    }
    .kapat:hover { opacity: 1; background: rgba(255,255,255,.12); }
    .kapat svg { width: 18px; height: 18px; }

    .akis {
      flex: 1; overflow-y: auto; padding: 18px; background: #f8f9fc;
      display: flex; flex-direction: column; gap: 14px;
      scrollbar-width: thin;
    }
    .akis::-webkit-scrollbar { width: 6px; }
    .akis::-webkit-scrollbar-thumb { background: #d4d9e6; border-radius: 3px; }

    .satir { display: flex; gap: 9px; align-items: flex-start; max-width: 100%; }
    .satir.kullanici { justify-content: flex-end; }
    .satir-avatar {
      width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
      background: #eef2fb; object-fit: cover; margin-top: 2px;
      border: 1px solid #e0e6f4;
    }

    .balon { font-size: 14px; line-height: 1.55; min-width: 0; }
    .balon.kullanici {
      background: ${RENK.ana}; color: #fff; max-width: 84%;
      padding: 11px 15px; border-radius: 16px 16px 4px 16px;
    }
    .balon.bot {
      background: #fff; color: #1c2233; max-width: calc(100% - 40px);
      padding: 13px 16px; border-radius: 16px 16px 16px 4px;
      box-shadow: 0 2px 10px rgba(3,6,53,.07);
    }
    .balon.bot.hata { background: #fef2f2; color: #991b1b; }

    .balon.bot p { margin-bottom: 8px; }
    .balon.bot p:last-child { margin-bottom: 0; }
    .balon.bot strong { font-weight: 650; color: ${RENK.ana}; }
    .balon.bot ul { margin: 6px 0 8px 18px; }
    .balon.bot li { margin-bottom: 4px; }
    .balon.bot a { color: ${RENK.ana}; text-decoration: underline; word-break: break-word; }
    .balon.bot code { background: #f1f3f9; padding: 1px 5px; border-radius: 4px; font-size: 13px; }

    .yaziyor { display: inline-flex; gap: 4px; align-items: center; height: 18px; }
    .yaziyor span {
      width: 7px; height: 7px; border-radius: 50%; background: #b4bccf;
      animation: zipla 1.1s infinite;
    }
    .yaziyor span:nth-child(2) { animation-delay: .15s; }
    .yaziyor span:nth-child(3) { animation-delay: .3s; }
    @keyframes zipla { 0%,60%,100% { transform: translateY(0); opacity: .5; } 30% { transform: translateY(-5px); opacity: 1; } }

    .ekler { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
    .ek {
      display: flex; align-items: center; gap: 8px; text-decoration: none;
      background: #f4f6fb; border: 1px solid #e4e8f2; border-radius: 10px;
      padding: 8px 11px; font-size: 12.5px; color: ${RENK.koyu}; font-weight: 500;
      transition: background .15s, border-color .15s;
    }
    .ek:hover { background: #eef1f8; border-color: #ccd4e6; }
    .ek-ikon { flex-shrink: 0; font-size: 14px; line-height: 1; }
    .ek-metin { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ek-gorseller { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
    .ek-gorseller img {
      width: 88px; height: 62px; object-fit: cover; border-radius: 8px;
      border: 1px solid #e4e8f2; cursor: pointer;
    }

    .oneriler { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 4px; padding-left: 39px; }
    .oneri {
      background: #fff; border: 1px solid #dbe1ee; color: ${RENK.koyu};
      border-radius: 999px; padding: 8px 13px; font-size: 12.5px; cursor: pointer;
      transition: background .15s, border-color .15s, transform .1s;
      font-family: inherit;
    }
    .oneri:hover { background: ${RENK.ana}; color: #fff; border-color: ${RENK.ana}; }
    .oneri:active { transform: scale(.97); }

    .giris {
      border-top: 1px solid #e8ebf3; background: #fff; padding: 12px;
      display: flex; gap: 8px; align-items: flex-end; flex-shrink: 0;
    }
    .giris textarea {
      flex: 1; resize: none; border: 1px solid #dbe1ee; border-radius: 12px;
      padding: 11px 13px; font-size: 14px; font-family: inherit; line-height: 1.4;
      max-height: 110px; outline: none; color: #1c2233;
      transition: border-color .15s, box-shadow .15s;
    }
    .giris textarea:focus { border-color: ${RENK.ana}; box-shadow: 0 0 0 3px rgba(3,6,53,.08); }
    .gonder {
      width: 42px; height: 42px; border-radius: 12px; border: none; cursor: pointer;
      background: ${RENK.ana}; color: #fff; display: grid; place-items: center;
      flex-shrink: 0; transition: opacity .15s, transform .1s;
    }
    .gonder:disabled { opacity: .4; cursor: not-allowed; }
    .gonder:not(:disabled):active { transform: scale(.94); }
    .gonder svg { width: 18px; height: 18px; }

    .dipnot {
      font-size: 10.5px; color: #8b93a8; text-align: center;
      padding: 0 12px 10px; background: #fff; flex-shrink: 0;
    }
  `;

  const IKON = {
    kapat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    gonder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
  };

  const EK_IKON = { pdf: '📄', harita: '📍', link: '🔗', telefon: '📞', eposta: '✉️' };

  // --- kurulum ---
  const host = document.createElement('div');
  host.id = 'mudu-chatbot';
  const kok = host.attachShadow({ mode: 'open' });
  const stil = document.createElement('style');
  stil.textContent = CSS;
  kok.appendChild(stil);

  const launcher = document.createElement('button');
  launcher.className = 'launcher';
  launcher.setAttribute('aria-label', `${BASLIK} asistanını aç`);
  launcher.innerHTML = `
    <img src="${AVATAR}" alt="${BASLIK}">
    <span class="nokta"></span>
    <span class="baloncuk">Merhaba, ben ${BASLIK}! Bir sorunuz mu var?</span>
  `;

  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', ALT_BASLIK);
  panel.innerHTML = `
    <div class="baslik">
      <img class="logo" src="${AVATAR}" alt="${BASLIK}">
      <div class="baslik-metin">
        <h3>${BASLIK}</h3>
        <p class="durum"><i></i> ${ALT_BASLIK}</p>
      </div>
      <button class="kapat" aria-label="Kapat">${IKON.kapat}</button>
    </div>
    <div class="akis" role="log" aria-live="polite"></div>
    <div class="giris">
      <textarea rows="1" placeholder="Sorunuzu yazın..." aria-label="Soru"></textarea>
      <button class="gonder" aria-label="Gönder">${IKON.gonder}</button>
    </div>
    <div class="dipnot">Yanıtlar mudanya.edu.tr içeriğinden üretilir. Resmi işlemler için üniversiteyle iletişime geçin.</div>
  `;

  kok.append(launcher, panel);
  document.body.appendChild(host);

  const akis = panel.querySelector('.akis');
  const alan = panel.querySelector('textarea');
  const gonderBtn = panel.querySelector('.gonder');

  let mesajlar = [];
  let mesgul = false;

  function kaydir() {
    akis.scrollTop = akis.scrollHeight;
  }

  function kacis(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  /** Model bazen cevabin basina isim etiketi koyuyor; widget zaten avatar gosteriyor. */
  function imzaSil(metin) {
    let s = metin.replace(/^\uFEFF/, '');
    s = s.replace(/^\s*(\*{0,2}Mudy\*{0,2})\s*[:\-–]?\s*/i, '');
    s = s.replace(/^\s*(\*{0,2}Mudy\*{0,2})\s*[:\-–]?\s*/i, '');
    return s;
  }

  /** Sade markdown: kalın, italik, kod, link, madde, paragraf. */
  function bicimlendir(metin) {
    const satirlar = kacis(metin).split('\n');
    let html = '';
    let listede = false;

    for (const ham of satirlar) {
      const satir = ham.trim();
      if (!satir) {
        if (listede) { html += '</ul>'; listede = false; }
        continue;
      }
      const madde = /^[-*•]\s+(.*)$/.exec(satir);
      if (madde) {
        if (!listede) { html += '<ul>'; listede = true; }
        html += `<li>${satirIci(madde[1])}</li>`;
      } else {
        if (listede) { html += '</ul>'; listede = false; }
        html += `<p>${satirIci(satir)}</p>`;
      }
    }
    if (listede) html += '</ul>';
    return html;
  }

  function satirIci(s) {
    return s
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
  }

  /** Bot mesajlari maskot avatariyla birlikte bir satir icinde yerlesir. */
  function balonEkle(tur, icerik) {
    const satir = document.createElement('div');
    satir.className = `satir ${tur}`;

    if (tur === 'bot') {
      const avatar = document.createElement('img');
      avatar.className = 'satir-avatar';
      avatar.src = AVATAR;
      avatar.alt = BASLIK;
      satir.appendChild(avatar);
    }

    const el = document.createElement('div');
    el.className = `balon ${tur}`;
    if (tur === 'kullanici') el.textContent = icerik;
    else el.innerHTML = icerik;

    satir.appendChild(el);
    akis.appendChild(satir);
    kaydir();
    return el;
  }

  function onerilerEkle() {
    const sarici = document.createElement('div');
    sarici.className = 'oneriler';
    ONERILER.forEach((s) => {
      const b = document.createElement('button');
      b.className = 'oneri';
      b.type = 'button';
      b.textContent = s;
      b.addEventListener('click', () => { sarici.remove(); sor(s); });
      sarici.appendChild(b);
    });
    akis.appendChild(sarici);
    kaydir();
  }

  function eklerEkle(balon, ekler) {
    if (!ekler || !ekler.length) return;

    const gorseller = ekler.filter((e) => e.tur === 'gorsel');
    const digerleri = ekler.filter((e) => e.tur !== 'gorsel');

    if (digerleri.length) {
      const sarici = document.createElement('div');
      sarici.className = 'ekler';
      digerleri.slice(0, 4).forEach((e) => {
        const a = document.createElement('a');
        a.className = 'ek';
        a.href = e.deger;
        a.target = '_blank';
        a.rel = 'noopener';
        a.innerHTML = `<span class="ek-ikon">${EK_IKON[e.tur] || '🔗'}</span><span class="ek-metin">${kacis(e.etiket)}</span>`;
        sarici.appendChild(a);
      });
      balon.appendChild(sarici);
    }

    if (gorseller.length) {
      const sarici = document.createElement('div');
      sarici.className = 'ek-gorseller';
      gorseller.slice(0, 3).forEach((e) => {
        const img = document.createElement('img');
        img.src = e.deger;
        img.alt = e.etiket;
        img.loading = 'lazy';
        img.addEventListener('click', () => window.open(e.deger, '_blank', 'noopener'));
        sarici.appendChild(img);
      });
      balon.appendChild(sarici);
    }
    kaydir();
  }

  async function sor(soru) {
    if (mesgul || !soru.trim()) return;
    mesgul = true;
    gonderBtn.disabled = true;
    alan.value = '';
    alan.style.height = 'auto';

    // ilk soru sorulduktan sonra oneri baloncuklari yerini sohbete birakir
    const eskiOneriler = akis.querySelector('.oneriler');
    if (eskiOneriler) eskiOneriler.remove();

    balonEkle('kullanici', soru);
    const balon = balonEkle('bot', '<span class="yaziyor"><span></span><span></span><span></span></span>');

    let metin = '';
    let ekler = [];
    let ilkParca = true;

    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ soru, gecmis: mesajlar.slice(-6) }),
      });
      if (!res.ok || !res.body) throw new Error('sunucu hatasi ' + res.status);

      const okuyucu = res.body.getReader();
      const kodlayici = new TextDecoder();
      let tampon = '';

      while (true) {
        const { done, value } = await okuyucu.read();
        if (done) break;
        tampon += kodlayici.decode(value, { stream: true });

        const bloklar = tampon.split('\n\n');
        tampon = bloklar.pop() || '';

        for (const blok of bloklar) {
          const olay = /^event:\s*(.+)$/m.exec(blok);
          const veri = /^data:\s*(.+)$/m.exec(blok);
          if (!olay || !veri) continue;
          let yuk;
          try { yuk = JSON.parse(veri[1]); } catch { continue; }

          if (olay[1] === 'meta') {
            ekler = yuk.ekler || [];
          } else if (olay[1] === 'delta') {
            if (ilkParca) { balon.innerHTML = ''; ilkParca = false; }
            metin += yuk.metin;
            balon.innerHTML = bicimlendir(imzaSil(metin));
            kaydir();
          } else if (olay[1] === 'hata') {
            balon.className = 'balon bot hata';
            balon.innerHTML = bicimlendir(yuk.mesaj);
            ilkParca = false;
          }
        }
      }

      if (metin) {
        const temiz = imzaSil(metin);
        balon.innerHTML = bicimlendir(temiz);
        eklerEkle(balon, ekler);
        mesajlar.push({ rol: 'user', metin: soru }, { rol: 'assistant', metin: temiz });
      } else if (ilkParca) {
        balon.className = 'balon bot hata';
        balon.innerHTML = '<p>Yanıt alınamadı. Lütfen tekrar deneyin.</p>';
      }
    } catch (err) {
      balon.className = 'balon bot hata';
      balon.innerHTML = `<p>Bağlantı kurulamadı: ${kacis(err.message)}</p>`;
    } finally {
      mesgul = false;
      gonderBtn.disabled = false;
      alan.focus();
    }
  }

  function ac() {
    panel.classList.add('acik');
    launcher.classList.add('gizli');
    if (!akis.children.length) {
      balonEkle('bot', bicimlendir(
        `Merhaba, ben **${BASLIK}**! Mudanya Üniversitesi öğrenci bilgi asistanıyım. Bölümler, ücretler, burslar, kayıt süreci, kampüs ve ulaşım hakkındaki sorularınızı yanıtlayabilirim.\n\nAşağıdaki örneklerden birini seçebilir veya kendi sorunuzu yazabilirsiniz.`,
      ));
      onerilerEkle();
    }
    setTimeout(() => alan.focus(), 100);
  }

  function kapa() {
    panel.classList.remove('acik');
    launcher.classList.remove('gizli');
  }

  launcher.addEventListener('click', ac);
  panel.querySelector('.kapat').addEventListener('click', kapa);
  gonderBtn.addEventListener('click', () => sor(alan.value));

  alan.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sor(alan.value); }
  });
  alan.addEventListener('input', () => {
    alan.style.height = 'auto';
    alan.style.height = Math.min(alan.scrollHeight, 110) + 'px';
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel.classList.contains('acik')) kapa();
  });

  window.MuduChatbot = { ac, kapa, sor };
})();
