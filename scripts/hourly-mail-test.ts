import 'dotenv/config';
import { sendMail } from '../lib/mail';

const TARGET_EMAIL = 'termolandtic@gmail.com';
const INTERVAL_MINUTES = 60; // Saat başı

async function sendTestMail() {
  const now = new Date();
  const timestamp = now.toLocaleString('tr-TR');

  console.log(`\n📧 Saat başı test maili gönderiliyor... (${timestamp})`);

  try {
    await sendMail({
      to: TARGET_EMAIL,
      subject: `SoleCost Saat Başı Test - ${timestamp}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">SoleCost Saat Başı Test Maili</h2>
          <p>Bu otomatik saat başı test mailidir.</p>
          <p><strong>Gönderim zamanı:</strong> ${timestamp}</p>
          <p><strong>Sonraki mail:</strong> ${new Date(now.getTime() + INTERVAL_MINUTES * 60 * 1000).toLocaleString('tr-TR')}</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 14px;">
            Bu mail otomatik olarak gönderilmiştir. Lütfen yanıtlamayın.
          </p>
        </div>
      `,
      text: `SoleCost Saat Başı Test Maili

Bu otomatik saat başı test mailidir.

Gönderim zamanı: ${timestamp}
Sonraki mail: ${new Date(now.getTime() + INTERVAL_MINUTES * 60 * 1000).toLocaleString('tr-TR')}

Bu mail otomatik olarak gönderilmiştir. Lütfen yanıtlamayın.`
    });

    console.log(`✅ Mail başarıyla gönderildi: ${TARGET_EMAIL}`);
    console.log(`⏰ Sonraki mail: ${new Date(now.getTime() + INTERVAL_MINUTES * 60 * 1000).toLocaleString('tr-TR')}`);

  } catch (error) {
    console.error(`❌ Mail gönderim hatası:`, error);
  }
}

async function startHourlyMail() {
  console.log('🚀 Saat başı mail servisi başlatılıyor...');
  console.log(`📧 Hedef: ${TARGET_EMAIL}`);
  console.log(`⏱️  Aralık: ${INTERVAL_MINUTES} dakika`);
  console.log('🛑 Durdurmak için Ctrl+C basın\n');

  // İlk maili hemen gönder
  await sendTestMail();

  // Saat başı tekrar et (60 dakika = 3,600,000 ms)
  setInterval(sendTestMail, INTERVAL_MINUTES * 60 * 1000);
}

startHourlyMail();