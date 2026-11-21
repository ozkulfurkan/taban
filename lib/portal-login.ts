import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { LIMITS, clientIp, normEmail, isLimited, recordAttempt, clearAttempts } from '@/lib/login-throttle';

// Portal girişi: aynı e-posta farklı firmalarda ayrı portal hesabı olabilir. Girilen şifreye uyan
// hesaplar bulunur; birden fazlaysa kullanıcı firmayı seçer (CHOOSE_ACCOUNT). Web, fason ve mobil
// girişleri aynı kuralı kullanır.

export const portalAccountInclude = {
  customer: { select: { id: true, companyId: true, name: true, company: { select: { name: true } } } },
  subcontractor: { select: { id: true, companyId: true, company: { select: { name: true } } } },
} as const;

export type PortalAccountChoice = { id: string; companyName: string; portalType: string };

export class ChooseAccountError extends Error {
  accounts: PortalAccountChoice[];
  constructor(accounts: PortalAccountChoice[]) {
    super('CHOOSE_ACCOUNT');
    this.accounts = accounts;
  }
}

const companyNameOf = (a: any) => a.customer?.company?.name ?? a.subcontractor?.company?.name ?? 'Firma';

/** Şifresi uyan portal hesapları (deneme sınırıyla). Hiçbiri uymuyorsa INVALID_CREDENTIALS fırlatır. */
export async function matchPortalAccounts(email: string, password: string, req?: any) {
  const acctKey = `portal:${normEmail(email)}`;
  const ipKey = `login-ip:${clientIp(req?.headers)}`;
  if ((await isLimited(acctKey, LIMITS.loginPerAccount)) || (await isLimited(ipKey, LIMITS.loginPerIp))) {
    throw new Error('TOO_MANY_ATTEMPTS');
  }
  const candidates = await prisma.portalCustomer.findMany({
    where: { email: { equals: email.trim(), mode: 'insensitive' } },
    include: portalAccountInclude,
    orderBy: { createdAt: 'asc' },
    take: 20,
  });
  const matches = [];
  for (const c of candidates) if (await bcrypt.compare(password, c.password)) matches.push(c);
  if (!matches.length) {
    await recordAttempt(acctKey, ipKey);
    throw new Error('INVALID_CREDENTIALS');
  }
  await clearAttempts(acctKey);
  return matches;
}

/** Giriş yapılacak hesabı seçer: accountId verildiyse o (şifresi uymalı), tek aktif hesap varsa o, birden çoksa seçim istenir. */
export function pickPortalAccount<T extends { id: string; isActive: boolean }>(matches: T[], accountId?: string | null): T {
  if (accountId) {
    const chosen = matches.find(m => m.id === accountId);
    if (!chosen) throw new Error('INVALID_CREDENTIALS');
    return chosen;
  }
  const active = matches.filter(m => m.isActive);
  if (active.length > 1) throw new ChooseAccountError(active.map(choiceOf));
  return active[0] ?? matches[0];
}

export const choiceOf = (a: any): PortalAccountChoice => ({ id: a.id, companyName: companyNameOf(a), portalType: a.portalType });
