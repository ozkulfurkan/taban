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

  try {
    await sendMail({
      to: email,
      subject: `SoleCost Production Mail Test - ${timestamp}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">SoleCost Production Mail Testi</h2>
          <p>Bu production ortamından gönderilen test mailidir.</p>
          <p><strong>Gönderim zamanı:</strong> ${timestamp}</p>
          <p><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</p>
          <p><strong>SMTP Host:</strong> ${process.env.SMTP_HOST || 'Not configured'}</p>
          <p><strong>User:</strong> ${user.email}</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 14px;">
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

Bu mail otomatik olarak gönderilmiştir. Lütfen yanıtlamayın.`
    });

    return NextResponse.json({
      success: true,
      message: `Test mail başarıyla gönderildi: ${email}`,
      timestamp,
      environment: process.env.NODE_ENV || 'development'
    });

  } catch (error) {
    console.error('Production mail test failed:', error);
    return NextResponse.json({
      error: 'Mail gönderim hatası',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp
    }, { status: 500 });
  }
}