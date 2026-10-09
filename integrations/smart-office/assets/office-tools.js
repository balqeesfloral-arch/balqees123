// Shared text/CSV helpers. This module contains no credentials or accounting rules.
export function normalizeSearch(value) {
  return String(value ?? '').normalize('NFKD').replace(/\p{M}/gu, '')
    .replace(/ـ/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .toLocaleLowerCase('ar').replace(/\s+/g, ' ').trim();
}

export function csvCell(value) {
  let text = String(value ?? '');
  // Keep exported text from executing as a spreadsheet formula.
  if (typeof value !== 'number' && /^[\s\u0000-\u001f\u007f]*[=+\-@]/u.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

export function buildCsv(columns, rows) {
  const lines = [columns.map(column => csvCell(column[1])).join(',')];
  for (const row of rows) lines.push(columns.map(column => csvCell(row[column[0]])).join(','));
  return '\uFEFF' + lines.join('\r\n');
}

const collator = new Intl.Collator('ar', {numeric:true, sensitivity:'base'});
export function compareValues(left, right, descending, numeric) {
  const emptyLeft = left === '' || left == null, emptyRight = right === '' || right == null;
  if (emptyLeft || emptyRight) return emptyLeft === emptyRight ? 0 : emptyLeft ? 1 : -1;
  let comparison;
  if (numeric && Number.isFinite(Number(left)) && Number.isFinite(Number(right))) comparison = Number(left) - Number(right);
  else comparison = collator.compare(normalizeSearch(left), normalizeSearch(right));
  return descending ? -comparison : comparison;
}
