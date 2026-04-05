import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { sendMail } from '@/lib/mail';

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: 'E-posta zorunlu' }, { status: 400 });

  // Always return success to avoid email enumeration
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ ok: true, message: 'Eğer bu e-posta kayıtlıysa sıfırlama bağlantısı gönderildi.' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken: token, resetTokenExpiry: expiry },
  });

  const baseUrl = req.headers.get('origin') || process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;

  let previewUrl: string | null = null;
  try {
    const result = await sendMail({
      to: user.email,
      subject: 'SoleCost Şifre Sıfırlama',
      html: `
        <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.5;">
          <p>Merhaba,</p>
          <p>Şifrenizi sıfırlamak için aşağıdaki butona tıklayın:</p>
          <p>
            <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">
              Şifremi Sıfırlamak İstiyorum
            </a>
          </p>
          <p>Bu bağlantı 24 saat içinde geçerlidir.</p>
          <p style="margin-top: 24px; color: #555;">SoleCost kullandığınız için teşekkür ederiz.</p>
        </div>
      `,
      text: `Merhaba,\n\nŞifrenizi sıfırlamak için aşağıdaki bağlantıyı kullanın:\n${resetUrl}\n\nBu bağlantı 24 saat içinde geçerlidir.\n\nSoleCost kullandığınız için teşekkür ederiz.`,
    });
    previewUrl = result.previewUrl;
  } catch (emailError) {
    console.error('Forgot password email failed:', emailError);
  }

  const responseBody: any = {
    ok: true,
    message: 'Şifre sıfırlama bağlantısı e-posta olarak gönderildi. E-posta gelmezse spam klasörünü kontrol edin.',
  };

  if (previewUrl) {
    responseBody.previewUrl = previewUrl;
  }

  return NextResponse.json(responseBody);
}
