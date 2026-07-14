-- CreateTable
CREATE TABLE "WalletLock" (
    "id" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3),

    CONSTRAINT "WalletLock_pkey" PRIMARY KEY ("id")
);
