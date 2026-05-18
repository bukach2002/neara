CREATE TYPE "SessionAudience" AS ENUM ('admin', 'customer');
CREATE TYPE "OtpPurpose" AS ENUM ('login', 'password_reset');
CREATE TYPE "OtpChannel" AS ENUM ('email', 'sms', 'whatsapp');

ALTER TABLE "users" ADD COLUMN "mobileNumber" TEXT;
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;

ALTER TABLE "sessions" ADD COLUMN "audience" "SessionAudience" NOT NULL DEFAULT 'admin';
ALTER TABLE "sessions" ADD COLUMN "trustedDevice" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "otp_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "channel" "OtpChannel" NOT NULL,
    "recipient" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_tokens_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "customers" ADD COLUMN "userId" UUID;

CREATE UNIQUE INDEX "users_mobileNumber_key" ON "users"("mobileNumber");
CREATE UNIQUE INDEX "otp_tokens_tokenHash_key" ON "otp_tokens"("tokenHash");
CREATE INDEX "sessions_audience_expiresAt_idx" ON "sessions"("audience", "expiresAt");
CREATE INDEX "otp_tokens_userId_purpose_channel_createdAt_idx" ON "otp_tokens"("userId", "purpose", "channel", "createdAt");
CREATE INDEX "otp_tokens_expiresAt_idx" ON "otp_tokens"("expiresAt");
CREATE INDEX "customers_userId_idx" ON "customers"("userId");

ALTER TABLE "otp_tokens" ADD CONSTRAINT "otp_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customers" ADD CONSTRAINT "customers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
