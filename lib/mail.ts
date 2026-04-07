import nodemailer from 'nodemailer';

interface SendMailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  cc?: string | string[];
}

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendMail({ to, subject, html, text, cc }: SendMailOptions) {
  const from = process.env.SMTP_FROM ?? `SoleCost <${process.env.SMTP_USER}>`;

  const info = await transporter.sendMail({
    from,
    to,
    ...(cc ? { cc } : {}),
    subject,
    text: text ?? html.replace(/<[^>]+>/g, '').slice(0, 1000),
    html,
  });

  console.log('✅ Mail gönderildi:', info.messageId);
  return { info, previewUrl: null };
}
