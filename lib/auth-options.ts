import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/mail';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
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
          console.error('Auth error:', error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }: any) {
      if (user) {
        token.role = user.role;
        token.companyId = user.companyId;
        token.companyName = user.companyName;
        token.language = user.language;
        token.currency = user.currency;
        token.allowedPages = (user as any).allowedPages ?? [];
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
        session.user.role = token.role;
        session.user.companyId = token.companyId;
        session.user.companyName = token.companyName;
        session.user.language = token.language;
        session.user.currency = token.currency;
        (session.user as any).allowedPages = token.allowedPages ?? [];
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
