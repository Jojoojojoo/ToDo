/**
 * 從檔案取得純文字（.txt 直接讀取；.pdf 需依賴 pdfjs-dist，未安裝時回傳錯誤訊息）
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
      throw new Error('PDF 解析失敗，請改貼上文字或上傳 .txt 檔。' + (e instanceof Error ? ` ${e.message}` : ''));
    }
  }
  throw new Error('僅支援 .txt 或 .pdf 檔案');
}
