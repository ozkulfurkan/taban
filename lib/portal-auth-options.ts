import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { authorizePortalCustomer } from '@/lib/auth-options';

export const portalAuthOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: 'portal-credentials',
      name: 'Portal',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      // Ana girişle aynı kural (çoklu firma hesabı, deneme sınırı, doğrulama)
      authorize: (credentials, req) => authorizePortalCustomer(credentials as any, req),
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
