/**
 * 從檔案取得純文字（.txt 直接讀取；.pdf 用 pdfjs-dist；.xlsx/.xls 用 xlsx）
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.txt')) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result ?? ''));
      r.onerror = () => reject(new Error('無法讀取檔案'));
      r.readAsText(file, 'UTF-8');
    });
  }
  if (name.endsWith('.pdf')) {
    try {
      const pdfjs = await import('pdfjs-dist');
      const buf = await file.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: buf }).promise;
      const numPages = doc.numPages;
      const parts: string[] = [];
      for (let i = 1; i <= numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const text = content.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ');
        parts.push(text);
      }
      return parts.join('\n').trim();
    } catch (e) {
      throw new Error('PDF 解析失敗，請改貼上文字或上傳 .txt / .xlsx 檔。' + (e instanceof Error ? ` ${e.message}` : ''));
    }
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const parts: string[] = [];
      for (const sheetName of wb.SheetNames) {
        const sheet = wb.Sheets[sheetName];
        // 轉成 CSV 字串，方便 AI 辨識欄位與截止日
        const csv = XLSX.utils.sheet_to_csv(sheet);
        if (csv.trim()) parts.push(`[工作表: ${sheetName}]\n${csv}`);
      }
      return parts.join('\n\n').trim() || '(無內容)';
    } catch (e) {
      throw new Error('Excel 解析失敗，請改貼上文字或上傳 .txt 檔。' + (e instanceof Error ? ` ${e.message}` : ''));
    }
  }
  throw new Error('僅支援 .txt、.pdf 或 .xlsx / .xls 檔案');
}
