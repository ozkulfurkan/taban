import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/mail';
import { LIMITS, clientIp, normEmail, isLimited, recordAttempt, clearAttempts } from '@/lib/login-throttle';

const sameList = (a: unknown, b: unknown) =>
  JSON.stringify([...((a as string[]) ?? [])].sort()) === JSON.stringify([...((b as string[]) ?? [])].sort());

// Hata fırlatmak next-auth'ta oturumu geçersiz kılar: getServerSession null döner,
// /api/auth/session çerezi temizler ve kullanıcı yeniden giriş yapar.
async function assertTokenStillValid(token: any) {
  if (!token?.sub) throw new Error('SESSION_INVALID');

  if (token.type === 'portal') {
    const pc = await prisma.portalCustomer.findUnique({
      where: { id: token.sub },
      select: { isActive: true, customerId: true, subcontractor: { select: { id: true } } },
    });
    if (!pc || !pc.isActive) throw new Error('SESSION_REVOKED');
    if ((pc.customerId ?? null) !== (token.customerId ?? null)) throw new Error('SESSION_CHANGED');
    if ((pc.subcontractor?.id ?? null) !== (token.subcontractorId ?? null)) throw new Error('SESSION_CHANGED');
    return;
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: token.sub },
    select: { role: true, companyId: true, allowedPages: true, company: { select: { name: true, companyType: true } } },
  });
  if (!dbUser) throw new Error('SESSION_REVOKED');
  if (
    dbUser.role !== token.role ||
    (dbUser.companyId ?? null) !== (token.companyId ?? null) ||
    !sameList(dbUser.allowedPages, token.allowedPages)
  ) {
    throw new Error('SESSION_CHANGED');
  }
  token.companyName = dbUser.company?.name ?? token.companyName;
  token.companyType = dbUser.company?.companyType ?? token.companyType;
}

export async function authorizePortalCustomer(credentials: Record<string, string> | undefined, req?: any) {
  if (!credentials?.email || !credentials?.password) return null;
  const acctKey = `portal:${normEmail(credentials.email)}`;
  const ipKey = `login-ip:${clientIp(req?.headers)}`;
  if ((await isLimited(acctKey, LIMITS.loginPerAccount)) || (await isLimited(ipKey, LIMITS.loginPerIp))) {
    throw new Error('TOO_MANY_ATTEMPTS');
  }

  const portalCustomer = await prisma.portalCustomer.findUnique({
    where: { email: credentials.email },
    include: {
      customer: { select: { id: true, companyId: true, name: true } },
      subcontractor: { select: { id: true, companyId: true } },
    },
  });

  if (!portalCustomer) {
    await recordAttempt(acctKey, ipKey);
    throw new Error('INVALID_CREDENTIALS');
  }

  const isValid = await bcrypt.compare(credentials.password, portalCustomer.password);
  if (!isValid) {
    await recordAttempt(acctKey, ipKey);
    throw new Error('INVALID_CREDENTIALS');
  }
  await clearAttempts(acctKey);

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
    name: portalCustomer.name ?? portalCustomer.customer?.name ?? portalCustomer.email,
    customerId: portalCustomer.customer?.id ?? null,
    subcontractorId: portalCustomer.subcontractor?.id ?? null,
    companyId: portalCustomer.customer?.companyId ?? portalCustomer.subcontractor?.companyId,
    type: 'portal',
    portalType: portalCustomer.portalType,
  } as any;
}

// Firma kullanıcısı girişi: web (NextAuth) ve mobil giriş aynı kuralları kullanır
// (deneme sınırı, e-posta doğrulaması). Hatalı bilgide null döner.
export async function authorizeStaff(credentials: Record<string, string> | undefined, req?: any) {
  if (!credentials?.email || !credentials?.password) return null;
  const acctKey = `login:${normEmail(credentials.email)}`;
  const ipKey = `login-ip:${clientIp((req as any)?.headers)}`;
  if ((await isLimited(acctKey, LIMITS.loginPerAccount)) || (await isLimited(ipKey, LIMITS.loginPerIp))) {
    throw new Error('TOO_MANY_ATTEMPTS');
  }
  try {
    const user = await prisma.user.findUnique({
      where: { email: credentials.email },
      include: { company: { select: { name: true, companyType: true } } },
    });
    if (!user) {
      await recordAttempt(acctKey, ipKey);
      return null;
    }
    const isValid = await bcrypt.compare(credentials.password, user.password);
    if (!isValid) {
      await recordAttempt(acctKey, ipKey);
      return null;
    }
    await clearAttempts(acctKey);
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
      companyType: user.company?.companyType ?? 'SOLE_MANUFACTURER',
      language: user.language,
      currency: user.currency,
      allowedPages: (user as any).allowedPages ?? [],
    } as any;
  } catch (error) {
    if (error instanceof Error && error.message === 'EMAIL_NOT_VERIFIED') throw error;
    if (error instanceof Error && error.message === 'TOO_MANY_ATTEMPTS') throw error;
    console.error('Auth error:', error);
    return null;
  }
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
      async authorize(credentials, req) {
        // Impersonation flow
        if (credentials?.impersonateToken) {
          const user = await prisma.user.findUnique({
            where: { impersonateToken: credentials.impersonateToken },
            include: { company: { select: { name: true, companyType: true } } },
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
            companyType: user.company?.companyType ?? 'SOLE_MANUFACTURER',
            language: user.language,
            currency: user.currency,
            allowedPages: (user as any).allowedPages ?? [],
          } as any;
        }

        return authorizeStaff(credentials, req);
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
          token.portalType = (user as any).portalType;
          token.customerId = (user as any).customerId ?? null;
          token.subcontractorId = (user as any).subcontractorId ?? null;
          token.companyId = user.companyId;
        } else {
          token.role = user.role;
          token.companyId = user.companyId;
          token.companyName = user.companyName;
          token.companyType = (user as any).companyType ?? 'SOLE_MANUFACTURER';
          token.language = user.language;
          token.currency = user.currency;
          token.allowedPages = (user as any).allowedPages ?? [];
        }
      }
      if (trigger === 'update' && session) {
        token.language = session.language ?? token.language;
        token.currency = session.currency ?? token.currency;
      }
      // Her istekte oturumun hâlâ geçerli olduğunu doğrula. Middleware çerezdeki
      // bilgiye göre karar verdiği için, rol/firma/izin değişince oturum düşürülür.
      if (!user) {
        try {
          await assertTokenStillValid(token);
        } catch (error) {
          // Sadece bilinçli geçersizlikler oturumu düşürür; anlık veritabanı
          // hatası yüzünden kullanıcıyı sistemden atmayalım.
          if (error instanceof Error && error.message.startsWith('SESSION_')) throw error;
          console.error('Session validation skipped (database error):', error);
        }
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session?.user) {
        session.user.id = token.sub;
        if (token.type === 'portal') {
          (session.user as any).type = 'portal';
          (session.user as any).portalType = token.portalType;
          (session.user as any).customerId = token.customerId ?? null;
          (session.user as any).subcontractorId = token.subcontractorId ?? null;
          session.user.companyId = token.companyId;
        } else {
          session.user.role = token.role;
          session.user.companyId = token.companyId;
          session.user.companyName = token.companyName;
          (session.user as any).companyType = token.companyType ?? 'SOLE_MANUFACTURER';
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
