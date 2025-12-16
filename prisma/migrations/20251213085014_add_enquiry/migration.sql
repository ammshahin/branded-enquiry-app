-- CreateTable
CREATE TABLE "Enquiry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "shop" TEXT NOT NULL,
    "blockId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "productReference" TEXT,
    "quantity" INTEGER,
    "message" TEXT NOT NULL,
    "extraInformation" TEXT,
    "productId" TEXT,
    "productHandle" TEXT,
    "productTitle" TEXT,
    "productUrl" TEXT,
    "attachmentFileName" TEXT,
    "attachmentMimeType" TEXT,
    "attachmentSize" INTEGER,
    "attachmentData" BLOB
);
