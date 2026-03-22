import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { NextResponse } from 'next/server';

export async function getAuthSession() {
  return await getServerSession(authOptions);
}

export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

export function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

export function calcNetWeight(grossWeight: number, wasteRate: number): number {
  return grossWeight * (1 + (wasteRate ?? 0) / 100);
}

export function calcMaterialCost(netWeight: number, pricePerKg: number): number {
  return (netWeight / 1000) * pricePerKg;
}

export function calcLaborSalaryBased(monthlySalary: number, workDays: number, dailyProduction: number): number {
  if (!workDays || !dailyProduction) return 0;
  return monthlySalary / (workDays * dailyProduction);
}

export function calcSellingPrice(totalCost: number, profitMargin: number): number {
  if (profitMargin >= 100) return totalCost * 2;
  return totalCost / (1 - (profitMargin ?? 0) / 100);
}
