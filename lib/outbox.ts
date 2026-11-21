import { appendFileSync } from 'fs';

// Test ortamı: NOTIFY_OUTBOX tanımlıysa e-posta ve anlık bildirim gerçekten gönderilmez,
// bu dosyaya satır satır (JSON) yazılır. Testler bildirimin kime gittiğini buradan doğrular.
// Canlı ortamda tanımlanmaz.
export function outboxPath() {
  return process.env.NOTIFY_OUTBOX || null;
}

export function writeOutbox(entry: Record<string, unknown>) {
  const path = outboxPath();
  if (!path) return false;
  try {
    appendFileSync(path, JSON.stringify({ ...entry, at: new Date().toISOString() }) + '\n');
  } catch (e) {
    console.error('outbox', e);
  }
  return true;
}
