import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/mail';

async function authorizePortalCustomer(credentials: Record<string, string> | undefined) {
  if (!credentials?.email || !credentials?.password) return null;

  const portalCustomer = await prisma.portalCustomer.findUnique({
    where: { email: credentials.email },
    include: { customer: { select: { id: true, companyId: true, name: true } } },
  });

  if (!portalCustomer) throw new Error('INVALID_CREDENTIALS');

  const isValid = await bcrypt.compare(credentials.password, portalCustomer.password);
  if (!isValid) throw new Error('INVALID_CREDENTIALS');

  if (!portalCustomer.isActive) throw new Error('ACCOUNT_INACTIVE');

  if (!portalCustomer.emailVerified) {
    const token = portalCustomer.emailVerifyToken ?? crypto.randomBytes(32).toString('hex');
    if (!portalCustomer.emailVerifyToken) {
      await prisma.portalCustomer.update({ where: { id: portalCustomer.id }, data: { emailVerifyToken: token } });
    }
    const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
    const verifyUrl = `${baseUrl}/portal/verify-email?token=${token}`;
    sendMail({
      to: portalCustomer.email,
      subject: 'Portal - E-posta adresinizi doğrulayın',
      html: `<p>Merhaba ${portalCustomer.name ?? portalCustomer.email},</p>
        <p>Giriş yapabilmek için e-posta adresinizi doğrulayın:</p>
        <p><a href="${verifyUrl}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">E-postamı Doğrula</a></p>`,
      text: `Doğrulama linki: ${verifyUrl}`,
    }).catch(() => {});
    throw new Error('EMAIL_NOT_VERIFIED');
  }

  return {
    id: portalCustomer.id,
    email: portalCustomer.email,
    name: portalCustomer.name ?? portalCustomer.customer.name,
    customerId: portalCustomer.customer.id,
    companyId: portalCustomer.customer.companyId,
    type: 'portal',
  } as any;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        impersonateToken: { label: 'Impersonate Token', type: 'text' },
      },
      async authorize(credentials) {
        // Impersonation flow
        if (credentials?.impersonateToken) {
          const user = await prisma.user.findUnique({
            where: { impersonateToken: credentials.impersonateToken },
            include: { company: true },
          });
          if (!user || !user.impersonateTokenExpiry || user.impersonateTokenExpiry < new Date()) {
            return null;
          }
          await prisma.user.update({
            where: { id: user.id },
            data: { impersonateToken: null, impersonateTokenExpiry: null },
          });
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            companyId: user.companyId,
            companyName: user.company?.name ?? null,
            language: user.language,
            currency: user.currency,
            allowedPages: (user as any).allowedPages ?? [],
          } as any;
        }

        if (!credentials?.email || !credentials?.password) return null;
        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
            include: { company: true },
          });
          if (!user) return null;
          const isValid = await bcrypt.compare(credentials.password, user.password);
          if (!isValid) return null;
          if (!user.emailVerified) {
            const token = user.emailVerifyToken ?? crypto.randomBytes(32).toString('hex');
            if (!user.emailVerifyToken) {
              await prisma.user.update({
                where: { id: user.id },
                data: { emailVerifyToken: token },
              });
            }
            const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
            const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${token}`;
            sendMail({
              to: user.email,
              subject: 'SoleCost - E-posta adresinizi doğrulayın',
              html: `
                <p>Merhaba ${user.name ?? user.email},</p>
                <p>Hesabınıza giriş yapmak için e-posta adresinizi doğrulamanız gerekmektedir.</p>
                <p><a href="${verifyUrl}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">E-postamı Doğrula</a></p>
                <p>Butona tıklayamıyorsanız şu bağlantıyı kopyalayın: ${verifyUrl}</p>
              `,
              text: `E-postanızı doğrulamak için: ${verifyUrl}`,
            }).catch(() => {});
            throw new Error('EMAIL_NOT_VERIFIED');
          }
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            companyId: user.companyId,
            companyName: user.company?.name ?? null,
            language: user.language,
            currency: user.currency,
            allowedPages: (user as any).allowedPages ?? [],
          } as any;
        } catch (error) {
          if (error instanceof Error && error.message === 'EMAIL_NOT_VERIFIED') throw error;
          console.error('Auth error:', error);
          return null;
        }
      },
    }),
    CredentialsProvider({
      id: 'portal-credentials',
      name: 'Portal',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: authorizePortalCustomer,
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }: any) {
      if (user) {
        if ((user as any).type === 'portal') {
          token.type = 'portal';
          token.customerId = (user as any).customerId;
          token.companyId = user.companyId;
        } else {
          token.role = user.role;
          token.companyId = user.companyId;
          token.companyName = user.companyName;
          token.language = user.language;
          token.currency = user.currency;
          token.allowedPages = (user as any).allowedPages ?? [];
        }
      }
      if (trigger === 'update' && session) {
        token.language = session.language ?? token.language;
        token.currency = session.currency ?? token.currency;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session?.user) {
        session.user.id = token.sub;
        if (token.type === 'portal') {
          (session.user as any).type = 'portal';
          (session.user as any).customerId = token.customerId;
          session.user.companyId = token.companyId;
        } else {
          session.user.role = token.role;
          session.user.companyId = token.companyId;
          session.user.companyName = token.companyName;
          session.user.language = token.language;
          session.user.currency = token.currency;
          (session.user as any).allowedPages = token.allowedPages ?? [];
        }
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
