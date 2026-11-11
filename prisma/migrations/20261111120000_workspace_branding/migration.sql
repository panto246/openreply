-- YKM fork: per-company branding (all nullable, no data change)
ALTER TABLE "Workspace" ADD COLUMN "brandName" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "logoUrl" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "websiteUrl" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "contactEmail" TEXT;
