import ExcelJS from 'exceljs';
import { withIssnPreference } from './journal-identifiers';
import { columnValue, displayValue, numericValue, type Layout } from './layouts';
import type { Paper } from './papers';

export function headerTextColor(hex: string) {
  const rgb = [1,3,5].map(i => parseInt(hex.slice(i, i+2),16) / 255).map(c => c <= .04045 ? c/12.92 : ((c+.055)/1.055)**2.4);
  return rgb[0]*.2126 + rgb[1]*.7152 + rgb[2]*.0722 > .179 ? '#102035' : '#ffffff';
}
export async function ledgerXlsx(papers: Paper[], layout: Layout) {
  const workbook = new ExcelJS.Workbook(); workbook.creator = '논문대장';
  const sheet = workbook.addWorksheet('연구실적', { views: [{ state: 'frozen', ySplit: 1 }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  sheet.columns = layout.columns.map(c => ({ header: c.label, key: c.id, width: c.width }));
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: papers.length + 1, column: layout.columns.length } };
  papers.map(p=>withIssnPreference(p,layout.preferIssnL)).forEach((p, i) => { const row = sheet.addRow(layout.columns.map(c => { const raw = columnValue(p,c,i); const n = numericValue(raw); return n !== null && ['number','decimal','percent'].includes(c.format) ? c.format === 'percent' ? n/100 : n : displayValue(raw,c.format); }));
    row.eachCell({ includeEmpty: true }, (cell,j) => { const c = layout.columns[j-1];
      cell.font = { name: '맑은 고딕', size: layout.style.fontSize, color: { argb: 'FF19283C' } };
      cell.alignment = { horizontal: c.align, vertical: 'top', wrapText: layout.style.wrap };
      cell.numFmt = c.format === 'decimal' ? '0.00' : c.format === 'percent' ? '0.##%' : c.format === 'number' ? '0.########' : '@';
      if (layout.style.striped && i % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F5F9' } };
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFDCE4EE' } } };
    });
  });
  const header = sheet.getRow(1); header.height = 42;
  header.eachCell((cell,j) => { cell.font = { name: '맑은 고딕', size: layout.style.fontSize, bold: true, color: { argb: 'FF'+headerTextColor(layout.style.headerColor).slice(1).toUpperCase() } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF'+layout.style.headerColor.slice(1).toUpperCase() } }; cell.alignment = { horizontal: layout.columns[j-1].align, vertical: 'middle', wrapText: true }; });
  return workbook.xlsx.writeBuffer();
}
export function downloadBlob(content: BlobPart, filename: string, type: string) { const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
