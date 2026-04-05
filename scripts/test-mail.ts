import 'dotenv/config';
import { sendMail } from '../lib/mail';

async function testMail() {
  console.log('🧪 Mail gönderim testi başlatılıyor...\n');

  // Gerçek test mail adresinizi buraya yazın
  const testEmail = process.argv[2] || 'admin@termoland.com.tr';

  console.log('📧 Test mail adresi:', testEmail);
  console.log('🔧 SMTP Host:', process.env.SMTP_HOST);
  console.log('👤 SMTP User:', process.env.SMTP_USER);
  console.log('');

  try {
    await sendMail({
      to: testEmail,
      subject: 'SoleCost Mail Testi - Gerçek SMTP',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">SoleCost Mail Sistemi Testi</h2>
          <p>Bu bir test mailidir. Eğer bu maili görüyorsanız, SMTP yapılandırması doğru çalışıyor demektir.</p>
          <p><strong>Gönderim zamanı:</strong> ${new Date().toLocaleString('tr-TR')}</p>
          <p><strong>SMTP Host:</strong> ${process.env.SMTP_HOST || 'Test Account'}</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 14px;">
            Bu mail otomatik olarak gönderilmiştir. Lütfen yanıtlamayın.
          </p>
        </div>
      `,
      text: `SoleCost Mail Sistemi Testi

Bu bir test mailidir. Eğer bu maili görüyorsanız, SMTP yapılandırması doğru çalışıyor demektir.

Gönderim zamanı: ${new Date().toLocaleString('tr-TR')}
SMTP Host: ${process.env.SMTP_HOST || 'Test Account'}

Bu mail otomatik olarak gönderilmiştir. Lütfen yanıtlamayın.`
    });

    console.log('\n✅ Mail başarıyla gönderildi!');
    console.log(`📬 Lütfen ${testEmail} adresini kontrol edin.`);

  } catch (error) {
    console.error('\n❌ Mail gönderim hatası:', error);
    process.exit(1);
  }
}

testMail();