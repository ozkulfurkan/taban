import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth, useCanWrite } from '@/core/auth';
import { notify } from '@/core/dialog';
import { shareDocumentPdf, type PdfDoc } from '@/core/document-pdf';
import { formatDate, money } from '@/core/format';
import { useTheme } from '@/hooks/use-theme';
import { Badge, Button, Card, Screen, Section, T } from './ui';

export type DocView = PdfDoc & {
  partyHref: string;
  status?: { label: string; tone: 'success' | 'warning' | 'neutral' | 'danger' };
  paid?: number;
  /** Aynı cari için yeni belge (örn. satıştan iade) */
  followUp?: { label: string; href: string };
};

/** Satış, iade ve alış belgelerinin ortak detay görünümü */
export function DocumentView({ doc, refreshing, onRefresh }: { doc: DocView; refreshing?: boolean; onRefresh?: () => void }) {
  const c = useTheme();
  const { user } = useAuth();
  const canWrite = useCanWrite();
  const [busy, setBusy] = useState(false);
  const companyName = user?.type === 'staff' ? user.companyName : null;

  const pdf = async () => {
    setBusy(true);
    try { await shareDocumentPdf({ ...doc, companyName }); }
    catch (e: any) { notify('PDF oluşturulamadı', e?.message || ''); }
    finally { setBusy(false); }
  };

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <Card style={{ backgroundColor: c.strong, borderColor: c.strong }}>
        <View style={styles.between}>
          <T variant="small" color={c.strongText} style={{ opacity: 0.8 }}>{doc.title}</T>
          {doc.status ? <Badge label={doc.status.label} tone={doc.status.tone} /> : null}
        </View>
        <T variant="moneyLarge" color={c.strongText} testID="doc-view-total">{money(doc.total, doc.currency)}</T>
        <T variant="small" color={c.strongText} style={{ opacity: 0.8 }}>
          {formatDate(doc.date)}{doc.dueDate ? ` · Vade ${formatDate(doc.dueDate)}` : ''}
          {doc.paid ? ` · Ödenen ${money(doc.paid, doc.currency)}` : ''}
        </T>
      </Card>

      <Card onPress={() => router.push(doc.partyHref)}>
        <T variant="label">{doc.partyLabel}</T>
        <T style={{ fontWeight: '600' }} color={c.primary}>{doc.partyName}</T>
      </Card>

      <Section title={`Kalemler (${doc.lines.length})`}>
        <Card style={{ gap: 0, paddingVertical: 4 }}>
          {doc.lines.map((l, i) => (
            <View key={i} style={[styles.line, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <T style={{ fontWeight: '500' }}>{l.code ? `[${l.code}] ` : ''}{l.description}</T>
                <T variant="small">
                  {money(l.quantity, '').trim().replace(/,00$/, '')}{l.unit ? ` ${l.unit}` : ''}
                  {l.unitPrice != null ? ` × ${money(l.unitPrice, '').trim()}` : ''}
                  {l.discount ? ` · %${l.discount} isk.` : ''}
                </T>
              </View>
              <T variant="money">{money(l.total, '').trim()}</T>
            </View>
          ))}
        </Card>
      </Section>

      <Card>
        {doc.vatRate ? (
          <>
            <Row label="Ara toplam" value={money(doc.subtotal, doc.currency)} />
            <Row label={`KDV %${doc.vatRate}`} value={money(doc.vatAmount ?? 0, doc.currency)} />
          </>
        ) : null}
        <Row label="Toplam" value={money(doc.total, doc.currency)} strong />
      </Card>
      {doc.notes ? <T variant="small">Not: {doc.notes}</T> : null}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button title="PDF paylaş" icon="pdf" variant="secondary" onPress={pdf} loading={busy} style={{ flex: 1 }} />
        {canWrite && doc.followUp ? (
          <Button title={doc.followUp.label} icon="plus" variant="secondary" onPress={() => router.push(doc.followUp!.href)} style={{ flex: 1 }} />
        ) : null}
      </View>
      <T variant="small" style={{ textAlign: 'center' }}>Belgeyi düzenlemek ve silmek web uygulamasından yapılır.</T>
    </Screen>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.between}>
      <T variant={strong ? 'body' : 'small'} style={strong ? { fontWeight: '700' } : undefined}>{label}</T>
      <T variant="money" style={strong ? { fontSize: 18 } : undefined}>{value}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  line: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 10 },
});
