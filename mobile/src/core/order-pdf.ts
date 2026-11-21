import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { ordersHtml, type PrintableOrder } from '@shared/order-print';
import { productsHtml, type ProductSummary } from '@shared/order-summary';

// Sipariş föyleri web ile aynı HTML'den (lib/order-print, lib/order-summary) üretilir:
// PDF paylaşımı ya da AirPrint / Android yazdırma
export type { PrintableOrder };
type Opts = { title: string; companyName?: string | null };

async function shareHtml(html: string, title: string) {
  if (Platform.OS === 'web') { await Print.printAsync({ html }); return; }
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: title });
}

/** Sipariş föyü PDF'i: paylaşım menüsü (WhatsApp, e-posta, Dosyalar...) */
export const shareOrdersPdf = (orders: PrintableOrder[], opts: Opts) => shareHtml(ordersHtml(orders, opts), opts.title);

/** Sipariş föyü: sistemin yazdırma penceresi (AirPrint / Android yazdırma) */
export const printOrders = (orders: PrintableOrder[], opts: Opts) => Print.printAsync({ html: ordersHtml(orders, opts) });

/** Ürün bazlı föy PDF'i (bekleyen siparişlerin ürün toplamları) */
export const shareProductsPdf = (summary: ProductSummary[], opts: Opts) => shareHtml(productsHtml(summary, opts), opts.title);

/** Ürün bazlı föy: yazdırma penceresi */
export const printProducts = (summary: ProductSummary[], opts: Opts) => Print.printAsync({ html: productsHtml(summary, opts) });
