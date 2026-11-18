import { useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { confirm, notify } from '@/core/dialog';
import { formatDate } from '@/core/format';
import { closeStatementLink, ensureStatementLink, shareStatementLink, type PartyKind, type ShareLink } from '@/core/statement';
import { Sheet } from './sheet';
import { T } from './ui';

/** Ekstre linki: gönder, kopyala, yenile, kapat. Link yoksa ilk açılışta oluşturulur. */
export function useLinkSheet(kind: PartyKind, id: string, partyName: string, canWrite: boolean) {
  const [link, setLink] = useState<ShareLink | null>(null);
  const [busy, setBusy] = useState(false);

  const open = async () => {
    setBusy(true);
    try {
      setLink(await ensureStatementLink(kind, id));
    } catch (e: any) {
      notify('Link alınamadı', e?.message || '');
    } finally {
      setBusy(false);
    }
  };

  const regenerate = async () => {
    if (!(await confirm('Yeni link oluşturulsun mu?', 'Daha önce gönderdiğiniz link artık açılmayacak.', 'Yeni link oluştur'))) return;
    try {
      const l = await ensureStatementLink(kind, id, true);
      await shareStatementLink(partyName, l.url);
    } catch (e: any) { notify('Link oluşturulamadı', e?.message || ''); }
  };

  const close = async () => {
    if (!(await confirm('Link kapatılsın mı?', 'Gönderdiğiniz link artık açılmayacak.', 'Linki kapat', true))) return;
    try { await closeStatementLink(kind, id); notify('Link kapatıldı'); }
    catch (e: any) { notify('Link kapatılamadı', e?.message || ''); }
  };

  const sheet = (
    <Sheet
      visible={!!link}
      onClose={() => setLink(null)}
      title="Ekstreyi link ile gönder"
      description={`Linki açan kişi ${partyName} hesap ekstresini giriş yapmadan görür. Ekstre her açılışta günceldir.`}
      actions={link ? [
        { label: 'Gönder', icon: 'share', onPress: () => { void shareStatementLink(partyName, link.url); }, testID: 'link-send' },
        { label: 'Linki kopyala', icon: 'link', onPress: () => { void Clipboard.setStringAsync(link.url).then(() => notify('Link kopyalandı')); } },
        ...(canWrite ? [
          { label: 'Yeni link oluştur', icon: 'plus' as const, onPress: () => { void regenerate(); } },
          { label: 'Linki kapat', icon: 'alert' as const, destructive: true, onPress: () => { void close(); } },
        ] : []),
      ] : []}
    >
      {link ? (
        <T variant="small" testID="link-info">
          Oluşturulma {formatDate(link.createdAt)} · {link.viewCount} kez görüntülendi
          {link.lastViewedAt ? ` · son ${formatDate(link.lastViewedAt)}` : ''}
        </T>
      ) : null}
    </Sheet>
  );

  return { open, busy, sheet };
}
