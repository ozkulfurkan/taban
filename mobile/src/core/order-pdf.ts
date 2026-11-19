import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { ordersHtml, type PrintableOrder } from '@shared/order-print';

// Sipariş föyü web ile aynı HTML'den (lib/order-print) üretilir: PDF paylaşımı ya da AirPrint / Android yazdırma
export type { PrintableOrder };
type Opts = { title: string; companyName?: string | null };

/** PDF oluşturup paylaşım menüsünü açar (WhatsApp, e-posta, Dosyalar...) */
export async function shareOrdersPdf(orders: PrintableOrder[], opts: Opts) {
  const html = ordersHtml(orders, opts);
  if (Platform.OS === 'web') { await Print.printAsync({ html }); return; }
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: opts.title });
}

/** Sistemin yazdırma penceresi (AirPrint / Android yazdırma) */
export async function printOrders(orders: PrintableOrder[], opts: Opts) {
  await Print.printAsync({ html: ordersHtml(orders, opts) });
}
