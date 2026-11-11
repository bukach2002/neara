-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OtpPurpose" ADD VALUE 'verify_email';
ALTER TYPE "OtpPurpose" ADD VALUE 'verify_mobile';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "mfaEnabledAt" TIMESTAMP(3),
ADD COLUMN     "mfaSecretCiphertext" TEXT,
ADD COLUMN     "mobileVerifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "absoluteExpiresAt" TIMESTAMP(3),
ADD COLUMN     "deviceId" TEXT,
ADD COLUMN     "deviceName" TEXT,
ADD COLUMN     "lastUsedAt" TIMESTAMP(3),
ADD COLUMN     "platform" TEXT,
ADD COLUMN     "revokedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "mobile_refresh_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deviceName" TEXT,
    "platform" TEXT,
    "audience" "SessionAudience" NOT NULL,
    "replacedByTokenHash" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mobile_refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mobile_refresh_tokens_tokenHash_key" ON "mobile_refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "mobile_refresh_tokens_userId_familyId_idx" ON "mobile_refresh_tokens"("userId", "familyId");

-- CreateIndex
CREATE INDEX "mobile_refresh_tokens_userId_revokedAt_idx" ON "mobile_refresh_tokens"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "mobile_refresh_tokens_expiresAt_idx" ON "mobile_refresh_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "sessions_userId_audience_idx" ON "sessions"("userId", "audience");

-- AddForeignKey
ALTER TABLE "mobile_refresh_tokens" ADD CONSTRAINT "mobile_refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

