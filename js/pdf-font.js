const PDF_CJK_FONT_NAME = 'NotoSansTC';
const PDF_CJK_FONT_FILE = 'NotoSansCJKtc-VF.ttf';
const PDF_CJK_FONT_URL = 'https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/Variable/TTF/NotoSansCJKtc-VF.ttf';

let _pdfCjkFontBase64 = null;

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function loadPdfCjkFont(doc) {
  if (!_pdfCjkFontBase64) {
    const res = await fetch(PDF_CJK_FONT_URL);
    if (!res.ok) throw new Error(`font HTTP ${res.status}`);
    _pdfCjkFontBase64 = arrayBufferToBase64(await res.arrayBuffer());
  }
  doc.addFileToVFS(PDF_CJK_FONT_FILE, _pdfCjkFontBase64);
  doc.addFont(PDF_CJK_FONT_FILE, PDF_CJK_FONT_NAME, 'normal');
  doc.addFont(PDF_CJK_FONT_FILE, PDF_CJK_FONT_NAME, 'bold');
  doc.setFont(PDF_CJK_FONT_NAME, 'normal');
}
