import type { CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';

/**
 * HTML tablosunu rowspan/colspan'i acilmis 2 boyutlu diziye cevirir.
 * Site tablolari Word'den yapistirilmis (MsoNormalTable) ve fakulte adlari
 * rowspan ile birlestirilmis; duz metin cikarma bu yuzden satirlari kaydiriyor.
 */
export function tableToGrid($: CheerioAPI, table: Element): string[][] {
  const grid: string[][] = [];

  const place = (row: number, col: number, value: string) => {
    (grid[row] ??= [])[col] = value;
  };

  const rows = $(table).find('tr').toArray();

  rows.forEach((tr, rowIndex) => {
    let col = 0;
    for (const cell of $(tr).children('td,th').toArray()) {
      // dolu olan hucreleri atla (ustteki rowspan buraya tasmis)
      while (grid[rowIndex]?.[col] !== undefined) col++;

      const $cell = $(cell);
      const text = cleanCellText($cell.text());
      const colspan = Math.max(1, parseInt($cell.attr('colspan') ?? '1', 10) || 1);
      const rowspan = Math.max(1, parseInt($cell.attr('rowspan') ?? '1', 10) || 1);

      for (let r = 0; r < rowspan; r++) {
        for (let c = 0; c < colspan; c++) {
          place(rowIndex + r, col + c, text);
        }
      }
      col += colspan;
    }
  });

  const width = Math.max(0, ...grid.map((r) => r?.length ?? 0));
  return grid.map((row) =>
    Array.from({ length: width }, (_, i) => (row?.[i] ?? '').trim()),
  );
}

export function cleanCellText(raw: string): string {
  return raw
    .replace(/\u00a0/g, ' ')
    .replace(/\u200b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "₺1.224.000,00" -> 1224000 ; "4800" -> 4800 ; bos/gecersiz -> null */
export function parseMoney(raw: string): number | null {
  const s = cleanCellText(raw).replace(/[₺$\s]/g, '').replace(/TL|USD/gi, '');
  if (!s || !/\d/.test(s)) return null;

  // Turkce format: nokta binlik, virgul ondalik
  const normalized = s.replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function parseInteger(raw: string): number | null {
  const s = cleanCellText(raw).replace(/[^\d]/g, '');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
