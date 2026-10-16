'use strict';
(function (global) {
  function cell(value) {
    if (value == null) return '';
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
    let text = String(value);
    // Spreadsheet applications may execute cells beginning with a formula marker,
    // including after whitespace. Preserve them as literal text.
    if (/^[\s\uFEFF]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }
  function serialize(rows) { return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n'; }
  function download(name, rows) {
    const url = URL.createObjectURL(new Blob([serialize(rows)], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `${String(name).replace(/[^a-z0-9._-]+/gi, '-').slice(0,100)}.csv`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  global.AECsv = { cell, serialize, download };
  if (typeof module !== 'undefined') module.exports = global.AECsv;
})(typeof window !== 'undefined' ? window : globalThis);
