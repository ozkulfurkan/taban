const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;

export function nowUtc(): Date {
  return new Date();
}

export function toDateInputValue(value?: string | Date | null): string {
  const date = value ? new Date(value) : new Date();
  const istanbulDate = new Date(date.getTime() + ISTANBUL_OFFSET_MS);
  return istanbulDate.toISOString().slice(0, 10);
}

export function parseDateInput(value?: string | null): Date | null {
  if (!value) return null;

  const dateOnlyMatch = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(value);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    if (!year || !month || !day) return null;
    return new Date(Date.UTC(year, month - 1, day) - ISTANBUL_OFFSET_MS);
  }

  const dateTimeLocalMatch = /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2})(?::([0-9]{2})(?:\.(\d+))?)?$/.exec(value);
  if (dateTimeLocalMatch) {
    const year = Number(dateTimeLocalMatch[1]);
    const month = Number(dateTimeLocalMatch[2]);
    const day = Number(dateTimeLocalMatch[3]);
    const hour = Number(dateTimeLocalMatch[4]);
    const minute = Number(dateTimeLocalMatch[5]);
    const second = Number(dateTimeLocalMatch[6] || '0');
    const millisecond = Number((dateTimeLocalMatch[7] || '0').padEnd(3, '0'));
    if (!year || !month || !day) return null;
    return new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond) - ISTANBUL_OFFSET_MS);
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function parseDateInputOrNow(value?: string | null): Date {
  return parseDateInput(value) ?? nowUtc();
}

export function parseDateEndOfDay(value?: string | null): Date | null {
  if (!value) return null;
  const dayStart = parseDateInput(value);
  if (!dayStart) return null;
  return new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
}

export function formatDate(value?: string | Date | number | null, locale = 'tr-TR'): string {
  if (value === null || value === undefined) return '';
  return new Intl.DateTimeFormat(locale, { timeZone: 'Europe/Istanbul' }).format(new Date(value));
}

export function formatDateTime(value?: string | Date | number | null, locale = 'tr-TR'): string {
  if (value === null || value === undefined) return '';
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'Europe/Istanbul',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
