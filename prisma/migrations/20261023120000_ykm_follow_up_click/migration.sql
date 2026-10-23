-- CreateTable
CREATE TABLE "FollowUpClick" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "instagramAccountId" TEXT NOT NULL,
    "recipientHash" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowUpClick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FollowUpClick_automationId_idx" ON "FollowUpClick"("automationId");

-- CreateIndex
CREATE INDEX "FollowUpClick_instagramAccountId_createdAt_idx" ON "FollowUpClick"("instagramAccountId", "createdAt");
