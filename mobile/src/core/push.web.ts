// Web'de anlık bildirim yok: kayıt ve silme işlemleri boş geçer
export async function registerForPush(): Promise<string | null> {
  return null;
}

export async function unregisterPush(): Promise<void> {}
