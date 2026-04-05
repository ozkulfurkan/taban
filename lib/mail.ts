import nodemailer from 'nodemailer';

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

let transportPromise: Promise<nodemailer.Transporter> | null = null;

async function getTransport() {
  if (transportPromise) return transportPromise;

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT ?? '587', 10);
  const smtpSecure = process.env.SMTP_SECURE === 'true';
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  // SendGrid SMTP desteği
  if (process.env.SENDGRID_API_KEY) {
    transportPromise = Promise.resolve(
      nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        auth: {
          user: 'apikey',
          pass: process.env.SENDGRID_API_KEY,
        },
      })
    );
  } else if (!smtpHost) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMTP yapılandırması eksik. Lütfen SMTP_HOST, SMTP_USER ve SMTP_PASS çevre değişkenlerini ayarlayın.');
    }

    transportPromise = nodemailer.createTestAccount().then((account) => {
      return nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: {
          user: account.user,
          pass: account.pass,
        },
      });
    });
  } else {
    transportPromise = Promise.resolve(
      nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
      })
    );
  }

  return transportPromise;
}

export async function sendMail({ to, subject, html, text }: SendMailOptions) {
  const transport = await getTransport();
  const from = process.env.SMTP_FROM ?? `SoleCost <no-reply@${process.env.SMTP_HOST ?? 'localhost'}>`;

  const info = await transport.sendMail({
    from,
    to,
    subject,
    text: text ?? html.replace(/<[^>]+>/g, '').slice(0, 1000),
    html,
  });

  const preview = nodemailer.getTestMessageUrl(info);
  return {
    info,
    previewUrl: preview === false ? null : preview,
  };
}
