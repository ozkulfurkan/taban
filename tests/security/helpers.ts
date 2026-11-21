import 'dotenv/config';
import { request, APIRequestContext, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Güvenlik testleri tarayıcı açmadan doğrudan API'yi çağırır.
// Her koşu kendi firmalarını ve kullanıcılarını yaratır; mevcut veriye dokunmaz.

export const prisma = new PrismaClient();
export const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
export const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const PASSWORD = 'Guvenlik123';

export const email = (name: string) => `sec-${name}-${RUN}@test.local`;

export async function newClient(): Promise<APIRequestContext> {
  return request.newContext({ baseURL: BASE_URL });
}

// next-auth credentials girişi; başarılıysa istemcide oturum çerezi kalır.
export async function login(
  api: APIRequestContext,
  userEmail: string,
  password = PASSWORD,
  provider: 'credentials' | 'portal-credentials' = 'credentials',
) {
  const csrf = await (await api.get('/api/auth/csrf')).json();
  const res = await api.post(`/api/auth/callback/${provider}`, {
    form: { email: userEmail, password, csrfToken: csrf.csrfToken, json: 'true' },
    maxRedirects: 0,
  });
  const body = await res.json().catch(() => ({}));
  const session = await (await api.get('/api/auth/session')).json();
  return { session, error: new URL(body?.url ?? BASE_URL, BASE_URL).searchParams.get('error') };
}

export async function loggedIn(userEmail: string, password = PASSWORD, provider?: 'credentials' | 'portal-credentials') {
  const api = await newClient();
  const { session } = await login(api, userEmail, password, provider);
  expect(session?.user, `${userEmail} giriş yapabilmeli`).toBeTruthy();
  return api;
}

// Yeni firma + sahibini doğrudan veritabanında oluşturur ve sahibi olarak giriş yapar.
// (Kayıt ekranının dakikalık sınırına takılmamak için API yerine veritabanı kullanılır.)
export async function createCompany(name: string) {
  const company = await prisma.company.create({ data: { name: `${name} firma ${RUN}` } });
  const ownerEmail = await createUser(company.id, name, 'COMPANY_OWNER');
  return { ownerEmail, companyId: company.id, owner: await loggedIn(ownerEmail) };
}

// Firma içinde verilen rolde kullanıcı oluşturur (doğrudan veritabanına).
export async function createUser(companyId: string, name: string, role: 'COMPANY_OWNER' | 'EDITOR' | 'VIEWER', allowedPages: string[] = []) {
  const userEmail = email(name);
  await prisma.user.create({
    data: {
      email: userEmail, name, role, allowedPages, companyId, emailVerified: true,
      password: await bcrypt.hash(PASSWORD, 10),
    },
  });
  return userEmail;
}

export async function createPortalCustomer(customerId: string, name: string, portalEmail = email(name), password = PASSWORD) {
  const customer = await prisma.customer.findUniqueOrThrow({ where: { id: customerId }, select: { companyId: true } });
  await prisma.portalCustomer.create({
    data: { email: portalEmail, customerId, companyId: customer.companyId, emailVerified: true, password: await bcrypt.hash(password, 10) },
  });
  return portalEmail;
}

export async function cleanup() {
  // Kilit testinin IP sayacı da dahil, bu koşunun deneme kayıtlarını temizle
  await prisma.loginAttempt.deleteMany({
    where: { OR: [{ key: { contains: RUN } }, { key: { startsWith: 'login-ip:' } }, { key: { startsWith: 'statement-ip:' } }] },
  });
  await prisma.$disconnect();
}
