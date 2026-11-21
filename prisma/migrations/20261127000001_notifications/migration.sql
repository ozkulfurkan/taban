-- Bildirim kutusu: gönderilen her anlık bildirim alıcı başına saklanır. Tekrar çalıştırılması güvenlidir.
CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "companyId" TEXT,
    "portalCustomerId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "url" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Notification_portalCustomerId_createdAt_idx" ON "Notification"("portalCustomerId", "createdAt");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Notification_userId_fkey') THEN
    ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Notification_portalCustomerId_fkey') THEN
    ALTER TABLE "Notification" ADD CONSTRAINT "Notification_portalCustomerId_fkey"
      FOREIGN KEY ("portalCustomerId") REFERENCES "PortalCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
