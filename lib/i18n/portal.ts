'use client';

import { useCallback } from 'react';
import { useLanguage } from './language-context';

// Müşteri portalı çevirileri. Anahtar Türkçe metnin kendisidir (gettext tarzı):
// tp('Siparişlerim') İngilizcede "My Orders" döner, çevirisi yoksa Türkçe kalır.
const EN: Record<string, string> = {
  // Çerçeve ve giriş
  'Müşteri Portalı': 'Customer Portal',
  'Ana Sayfa': 'Home',
  'Siparişlerim': 'My Orders',
  'Katalog': 'Catalog',
  'Çıkış': 'Sign out',
  'Dil': 'Language',
  'SoleCost B2B Sipariş Sistemi': 'SoleCost B2B Ordering',
  'Giriş Yap': 'Sign in',
  'Giriş yapılıyor...': 'Signing in...',
  'E-posta': 'Email',
  'Şifre': 'Password',
  'E-posta adresiniz doğrulandı. Giriş yapabilirsiniz.': 'Your email address is verified. You can sign in now.',
  'E-posta adresiniz doğrulanmamış. Doğrulama maili gönderildi, lütfen gelen kutunuzu kontrol edin.':
    'Your email address is not verified yet. We sent you a verification email; please check your inbox.',
  'Çok fazla hatalı deneme yapıldı. Lütfen 15 dakika sonra tekrar deneyin veya şifrenizi sıfırlayın.':
    'Too many failed attempts. Please try again in 15 minutes or reset your password.',
  'Hesabınız pasif durumda. Lütfen firma sahibi ile iletişime geçin.': 'Your account is inactive. Please contact the supplier.',
  'E-posta adresi veya şifre hatalı.': 'Incorrect email or password.',
  'Bir hata oluştu.': 'Something went wrong.',
  'Hata oluştu': 'Something went wrong',

  // Ana sayfa
  'Hoşgeldiniz': 'Welcome',
  'Sipariş durumlarınızı buradan takip edebilirsiniz.': 'Track the status of your orders here.',
  'Yeni Sipariş': 'New Order',
  'Son Siparişler': 'Recent Orders',
  'Tümünü Gör': 'View all',
  'Henüz sipariş yok': 'No orders yet',
  'Toplam Sipariş': 'Total Orders',
  'Aktif Sipariş': 'Active Orders',
  'Teslim Edildi': 'Delivered',

  // Sipariş durumları
  'Sipariş Alındı': 'Order Received',
  'Üretimde': 'In Production',
  'Üretime Girdi': 'In Production',
  'Kalıplama': 'Molding',
  'Boyama': 'Painting',
  'Paketleme': 'Packaging',
  'Sevkiyata Hazır': 'Ready to Ship',
  'Sevk Edildi': 'Shipped',
  'İptal': 'Cancelled',
  'İptal Edildi': 'Cancelled',

  // Sipariş listesi ve detayı
  'Tümü': 'All',
  'Sipariş No': 'Order No',
  'Sipariş bulunamadı': 'No orders found',
  'Sipariş bulunamadı.': 'Order not found.',
  'Tekrarla': 'Reorder',
  'Tarih': 'Date',
  'Ürün': 'Product',
  'Adet': 'Quantity',
  'Durum': 'Status',
  'Termin': 'Due date',
  'Geri': 'Back',
  'Sipariş Durumu': 'Order Status',
  'Sipariş Detayları': 'Order Details',
  'Sevkiyat Bilgileri': 'Shipping Details',
  'Durum Geçmişi': 'Status History',
  'Beden Dağılımı': 'Size Breakdown',
  'Toplam Beden Dağılımı': 'Total Size Breakdown',
  'İrsaliye No': 'Delivery Note No',
  'Taşıyıcı': 'Carrier',
  'Sevk Tarihi': 'Ship Date',
  'Renk': 'Color',
  'Malzeme': 'Material',
  'Model Kodu': 'Model Code',
  'Notlar': 'Notes',
  'Toplam': 'Total',
  'çift': 'pairs',

  // Yeni sipariş ve katalog
  'Ürün Bilgileri': 'Product Details',
  'Katalogdan Seç': 'Choose from catalog',
  '— Seçiniz —': '— Select —',
  'İstenen Termin': 'Requested Due Date',
  'İstenen Termin Tarihi': 'Requested Due Date',
  'Renk Bilgileri': 'Color Details',
  'örn: SC-100': 'e.g. SC-100',
  'örn: Termo': 'e.g. Thermo',
  'örn: Siyah, Kahve...': 'e.g. Black, Brown...',
  'örn: Siyah': 'e.g. Black',
  'Eklemek istediğiniz notlar...': 'Any notes you would like to add...',
  'Ek notlar...': 'Additional notes...',
  'Siparişi Gönder': 'Submit Order',
  'Gönderiliyor...': 'Submitting...',
  'Ürün Kataloğu': 'Product Catalog',
  'Katalog henüz yüklenmedi.': 'The catalog has not been published yet.',
  'Mevcut Numaralar': 'Available Sizes',
  'Birim': 'Unit',
  'Bu sipariş iptal edildi.': 'This order has been cancelled.',
  'Hazırlanıyor': 'Preparing',
  'Miktar': 'Quantity',
  'Renk / açıklama (isteğe bağlı)': 'Color / note (optional)',
  'Kapat': 'Close',
  'Sipariş Ver': 'Order',
  'Renk *': 'Color *',
  'Adet (Numaraya Göre)': 'Quantity (by size)',
  'Sepete Ekle': 'Add to Cart',
  'Sepet': 'Cart',
  'Sepet boş': 'Your cart is empty',
  'Genel Toplam': 'Grand Total',
  'Sil': 'Remove',
  'Ara...': 'Search...',
  'Boya/Apre': 'Painting/Finishing',
  'Boya / Apre': 'Painting/Finishing',
  'ürün': 'items',
  'Siparişleri Gönder': 'Submit Orders',
};

export function usePortalText() {
  const { language, setLanguage } = useLanguage();
  const tp = useCallback((text: string) => (language === 'en' ? EN[text] ?? text : text), [language]);
  return { tp, language, setLanguage };
}

export const PORTAL_EN = EN;
