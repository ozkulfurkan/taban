-- Mobil anlık bildirim için cihaz kayıtları (Expo push token). Tekrar çalıştırılması güvenlidir.
CREATE TABLE IF NOT EXISTS "PushToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT,
    "userId" TEXT,
    "portalCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PushToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PushToken_token_key" ON "PushToken"("token");
CREATE INDEX IF NOT EXISTS "PushToken_userId_idx" ON "PushToken"("userId");
CREATE INDEX IF NOT EXISTS "PushToken_portalCustomerId_idx" ON "PushToken"("portalCustomerId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PushToken_userId_fkey') THEN
    ALTER TABLE "PushToken" ADD CONSTRAINT "PushToken_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PushToken_portalCustomerId_fkey') THEN
    ALTER TABLE "PushToken" ADD CONSTRAINT "PushToken_portalCustomerId_fkey"
      FOREIGN KEY ("portalCustomerId") REFERENCES "PortalCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
