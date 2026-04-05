import 'dotenv/config';
import { sendMail } from '../lib/mail';

async function testMail() {
  console.log('🧪 Mail gönderim testi başlatılıyor...\n');

  // Gerçek test mail adresinizi buraya yazın
  const testEmail = process.argv[2] || 'admin@termoland.com.tr';

  console.log('📧 Test mail adresi:', testEmail);
  console.log('🔧 SMTP Host:', process.env.SMTP_HOST);
  console.log('👤 SMTP User:', process.env.SMTP_USER);
  console.log('🌍 Environment:', process.env.NODE_ENV);
  console.log('');

  try {
    const result = await sendMail({
      to: testEmail,
      subject: 'SoleCost Mail Testi - Detaylı SMTP',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">SoleCost Detaylı Mail Testi</h2>
          <p>Bu mail SMTP bağlantısının detaylarını test etmek için gönderilmiştir.</p>
          <p><strong>Gönderim zamanı:</strong> ${new Date().toLocaleString('tr-TR')}</p>
          <p><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</p>
          <p><strong>SMTP Host:</strong> ${process.env.SMTP_HOST || 'Not configured'}</p>
          <p><strong>Message ID:</strong> ${result?.info?.messageId || 'N/A'}</p>
          <p><strong>Response:</strong> ${result?.info?.response || 'N/A'}</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 14px;">
            Bu mail otomatik olarak gönderilmiştir. Lütfen yanıtlamayın.
          </p>
        </div>
      `,
      text: `SoleCost Detaylı Mail Testi

Bu mail SMTP bağlantısının detaylarını test etmek için gönderilmiştir.

Gönderim zamanı: ${new Date().toLocaleString('tr-TR')}
Environment: ${process.env.NODE_ENV || 'development'}
SMTP Host: ${process.env.SMTP_HOST || 'Not configured'}
Message ID: ${result?.info?.messageId || 'N/A'}
Response: ${result?.info?.response || 'N/A'}

Bu mail otomatik olarak gönderilmiştir. Lütfen yanıtlamayın.`
    });

    console.log('\n✅ Mail başarıyla gönderildi!');
    console.log('📧 Message ID:', result?.info?.messageId);
    console.log('📧 Accepted:', result?.info?.accepted);
    console.log('📧 Rejected:', result?.info?.rejected);
    console.log('📧 Response:', result?.info?.response);
    console.log(`📬 Lütfen ${testEmail} adresini kontrol edin.`);

  } catch (error) {
    console.error('\n❌ Mail gönderim hatası:', error);
    console.error('🔍 Hata detayları:', {
      name: error.name,
      message: error.message,
      code: error.code,
      response: error.response,
      responseCode: error.responseCode
    });
    process.exit(1);
  }
}

testMail();