import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { sendMail } from '@/lib/mail';

export async function POST(req: NextRequest) {
  // Sadece admin kullanıcılar test mail gönderebilsin
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = session.user as any;
  if (!user.companyId) {
    return NextResponse.json({ error: 'No company access' }, { status: 403 });
  }

  const { email } = await req.json();
  if (!email) {
    return NextResponse.json({ error: 'Email address required' }, { status: 400 });
  }

  const timestamp = new Date().toLocaleString('tr-TR');

  console.log('🧪 MAIL TEST BAŞLATILIYOR');
  console.log('📧 Hedef:', email);
  console.log('👤 Gönderen:', user.email);
  console.log('🔧 SMTP_HOST:', process.env.SMTP_HOST);
  console.log('🔧 SMTP_PORT:', process.env.SMTP_PORT);
  console.log('🔧 SMTP_SECURE:', process.env.SMTP_SECURE);
  console.log('🔧 SMTP_USER:', process.env.SMTP_USER ? '***SET***' : 'NOT SET');
  console.log('🔧 SMTP_PASS:', process.env.SMTP_PASS ? '***SET***' : 'NOT SET');
  console.log('🔧 SMTP_FROM:', process.env.SMTP_FROM);
  console.log('🌍 NODE_ENV:', process.env.NODE_ENV);
  console.log('🏠 VERCEL_ENV:', process.env.VERCEL_ENV);
  console.log('🌐 VERCEL_URL:', process.env.VERCEL_URL);

  try {
    const result = await sendMail({
      to: email,
      subject: `SoleCost Production Mail Test - ${timestamp}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
          <h2 style="color: #2563eb; margin-top: 0;">SoleCost Production Mail Testi</h2>
          <p>Bu production ortamından gönderilen test mailidir.</p>
          <div style="background: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
            <p><strong>Gönderim zamanı:</strong> ${timestamp}</p>
            <p><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</p>
            <p><strong>SMTP Host:</strong> ${process.env.SMTP_HOST || 'Not configured'}</p>
            <p><strong>User:</strong> ${user.email}</p>
            <p><strong>Test ID:</strong> ${Date.now()}</p>
          </div>
          <p style="color: #059669; font-weight: bold;">✅ Eğer bu maili görüyorsanız, SMTP yapılandırması çalışıyor!</p>
          <p style="color: #dc2626;">❌ Eğer bu maili görmüyorsanız:</p>
          <ul style="color: #dc2626;">
            <li>Spam/Junk klasörünü kontrol edin</li>
            <li>Mail sağlayıcınızla iletişime geçin</li>
            <li>SMTP ayarlarını tekrar kontrol edin</li>
          </ul>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #6b7280; font-size: 14px; margin-bottom: 0;">
            Bu mail otomatik olarak gönderilmiştir. Lütfen yanıtlamayın.
          </p>
        </div>
      `,
      text: `SoleCost Production Mail Testi

Bu production ortamından gönderilen test mailidir.

Gönderim zamanı: ${timestamp}
Environment: ${process.env.NODE_ENV || 'development'}
SMTP Host: ${process.env.SMTP_HOST || 'Not configured'}
User: ${user.email}
Test ID: ${Date.now()}

✅ Eğer bu maili görüyorsanız, SMTP yapılandırması çalışıyor!

❌ Eğer bu maili görmüyorsanız:
- Spam/Junk klasörünü kontrol edin
- Mail sağlayıcınızla iletişime geçin
- SMTP ayarlarını tekrar kontrol edin

Bu mail otomatik olarak gönderilmiştir. Lütfen yanıtlamayın.`
    });

    console.log('✅ MAIL GÖNDERİM BAŞARILI');
    console.log('📧 Message ID:', result?.info?.messageId);
    console.log('📧 Response:', result);

    return NextResponse.json({
      success: true,
      message: `Test mail başarıyla gönderildi: ${email}`,
      timestamp,
      environment: process.env.NODE_ENV || 'development',
      smtpHost: process.env.SMTP_HOST,
      testId: Date.now(),
      messageId: result?.info?.messageId
    });

  } catch (error) {
    console.error('❌ MAIL GÖNDERİM HATASI:', error);

    return NextResponse.json({
      error: 'Mail gönderim hatası',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp,
      smtpDebug: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE,
        user: process.env.SMTP_USER ? '***configured***' : 'NOT SET',
        from: process.env.SMTP_FROM
      }
    }, { status: 500 });
  }
}