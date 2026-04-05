import nodemailer from 'nodemailer';
import { constants } from 'node:crypto';

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

let transportPromise: Promise<nodemailer.Transporter> | null = null;

async function getTransport() {
  // Cache'i temizle eğer env değişti
  if (transportPromise) {
    const currentHost = process.env.SMTP_HOST;
    const currentPort = process.env.SMTP_PORT;
    console.log("Transport cache'de var, kullanılıyor");
    return transportPromise;
  }

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT ?? '465', 10);
  const smtpSecure = process.env.SMTP_SECURE === 'true';
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  console.log('🔌 SMTP Bağlantısı kuruluyor...');
  console.log('   HOST:', smtpHost);
  console.log('   PORT:', smtpPort);
  console.log('   SECURE:', smtpSecure);
  console.log('   USER:', smtpUser);

  // SendGrid SMTP desteği
  if (process.env.SENDGRID_API_KEY) {
    console.log('📤 SendGrid kullanılıyor');
    transportPromise = Promise.resolve(
      nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        auth: {
          user: 'apikey',
          pass: process.env.SENDGRID_API_KEY,
        },
        tls: {
          rejectUnauthorized: false,
          minVersion: 'TLSv1.2',
        },
      })
    );
  } else if (!smtpHost) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMTP yapılandırması eksik. Lütfen SMTP_HOST, SMTP_USER ve SMTP_PASS çevre değişkenlerini ayarlayın.');
    }

    console.log('🧪 Test hesabı (Ethereal) kullanılıyor');
    transportPromise = nodemailer.createTestAccount().then((account) => {
      return nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: {
          user: account.user,
          pass: account.pass,
        },
        tls: {
          rejectUnauthorized: false,
          minVersion: 'TLSv1.2',
        },
      });
    });
  } else {
    console.log('📧 Kurumsal SMTP kullanılıyor');
    transportPromise = Promise.resolve(
      nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
        tls: {
          rejectUnauthorized: false,
          minVersion: 'TLSv1.2',
          secureOptions: constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION | constants.SSL_OP_LEGACY_SERVER_CONNECT,
        },
      })
    );
  }

  return transportPromise;
}

export async function sendMail({ to, subject, html, text }: SendMailOptions) {
  try {
    const transport = await getTransport();
    const from = process.env.SMTP_FROM ?? `SoleCost <no-reply@${process.env.SMTP_HOST ?? 'localhost'}>`;

    console.log('📧 Mail gönderiliyor...');
    console.log('   TO:', to);
    console.log('   FROM:', from);
    console.log('   SUBJECT:', subject);

    const info = await transport.sendMail({
      from,
      to,
      subject,
      text: text ?? html.replace(/<[^>]+>/g, '').slice(0, 1000),
      html,
    });

    console.log('✅ Mail başarıyla gönderildi:', info.messageId);
    console.log('📊 Mail info:', {
      messageId: info.messageId,
      envelope: info.envelope,
      accepted: info.accepted,
      rejected: info.rejected,
      pending: info.pending,
      response: info.response
    });

    const preview = nodemailer.getTestMessageUrl(info);
    return {
      info,
      previewUrl: preview === false ? null : preview,
    };
  } catch (error) {
    console.error('❌ Mail gönderme hatası:', error);
    console.error('🔍 Hata detayları:', {
      name: error.name,
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode
    });
    throw error;
  }
}

