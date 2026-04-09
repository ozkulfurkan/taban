import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/mail';

export const portalAuthOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: 'portal-credentials',
      name: 'Portal',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const portalCustomer = await prisma.portalCustomer.findUnique({
          where: { email: credentials.email },
          include: {
            customer: { select: { id: true, companyId: true, name: true } },
            subcontractor: { select: { id: true, companyId: true } },
          },
        });

        if (!portalCustomer) throw new Error('INVALID_CREDENTIALS');

        const isValid = await bcrypt.compare(credentials.password, portalCustomer.password);
        if (!isValid) throw new Error('INVALID_CREDENTIALS');

        if (!portalCustomer.isActive) throw new Error('ACCOUNT_INACTIVE');

        if (!portalCustomer.emailVerified) {
          // Resend verify email
          const token = portalCustomer.emailVerifyToken ?? crypto.randomBytes(32).toString('hex');
          if (!portalCustomer.emailVerifyToken) {
            await prisma.portalCustomer.update({
              where: { id: portalCustomer.id },
              data: { emailVerifyToken: token },
            });
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
          name: portalCustomer.name ?? portalCustomer.customer?.name ?? portalCustomer.email,
          customerId: portalCustomer.customer?.id ?? null,
          subcontractorId: portalCustomer.subcontractor?.id ?? null,
          companyId: portalCustomer.customer?.companyId ?? portalCustomer.subcontractor?.companyId,
          type: 'portal',
          portalType: portalCustomer.portalType,
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.customerId = user.customerId ?? null;
        token.subcontractorId = user.subcontractorId ?? null;
        token.companyId = user.companyId;
        token.type = 'portal';
        token.portalType = user.portalType;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session?.user) {
        session.user.id = token.sub;
        session.user.customerId = token.customerId ?? null;
        (session.user as any).subcontractorId = token.subcontractorId ?? null;
        session.user.companyId = token.companyId;
        (session.user as any).type = 'portal';
        (session.user as any).portalType = token.portalType;
      }
      return session;
    },
  },
  pages: {
    signIn: '/portal/login',
  },
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
};
