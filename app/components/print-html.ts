// Verilen HTML'i gizli bir çerçevede yazdırma penceresinde açar ("PDF olarak kaydet" ile PDF alınır).
export async function printHtml(html: string) {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open(); doc.write(html); doc.close();
  await Promise.all(Array.from(doc.images).map(i => (i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))));
  frame.contentWindow!.focus();
  frame.contentWindow!.print();
  setTimeout(() => frame.remove(), 60_000);
}
