import { prisma } from './prisma';

type LogParams = {
  companyId: string;
  userId?: string;
  userName?: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'ERROR';
  entity: string;
  entityId?: string;
  detail?: string;
  meta?: object;
  ip?: string;
};

export async function logAction(p: LogParams) {
  await (prisma.auditLog as any).create({ data: p }).catch(() => {});
}

export function getIp(req: Request): string | undefined {
  return (req.headers as any).get?.('x-forwarded-for')?.split(',')[0] ?? undefined;
}
