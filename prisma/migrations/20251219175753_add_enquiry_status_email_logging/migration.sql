-- CreateTable
CREATE TABLE "EnquiryEmailLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enquiryId" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "recipientType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "subject" TEXT,
    "errorMessage" TEXT,
    "providerId" TEXT,
    "metadata" JSONB,
    CONSTRAINT "EnquiryEmailLog_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Enquiry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "statusUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailNotificationState" TEXT NOT NULL DEFAULT 'pending',
    "lastEmailAttemptAt" DATETIME,
    "lastEmailError" TEXT,
    "shop" TEXT NOT NULL,
    "blockId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "companyName" TEXT,
    "phoneNumber" TEXT,
    "requestType" TEXT NOT NULL,
    "productReference" TEXT,
    "quantity" INTEGER,
    "productColour" TEXT,
    "printPosition" TEXT,
    "printColours" TEXT,
    "pantoneReference" TEXT,
    "deliveryDeadline" TEXT,
    "workedWithBefore" TEXT,
    "message" TEXT NOT NULL,
    "extraInformation" TEXT,
    "artworkNotes" TEXT,
    "productId" TEXT,
    "productHandle" TEXT,
    "productTitle" TEXT,
    "productUrl" TEXT,
    "attachmentFileName" TEXT,
    "attachmentMimeType" TEXT,
    "attachmentSize" INTEGER,
    "attachmentData" BLOB
);
INSERT INTO "new_Enquiry" ("artworkNotes", "attachmentData", "attachmentFileName", "attachmentMimeType", "attachmentSize", "blockId", "companyName", "createdAt", "deliveryDeadline", "email", "extraInformation", "firstName", "id", "lastName", "message", "name", "pantoneReference", "phoneNumber", "printColours", "printPosition", "productColour", "productHandle", "productId", "productReference", "productTitle", "productUrl", "quantity", "requestType", "shop", "updatedAt", "workedWithBefore") SELECT "artworkNotes", "attachmentData", "attachmentFileName", "attachmentMimeType", "attachmentSize", "blockId", "companyName", "createdAt", "deliveryDeadline", "email", "extraInformation", "firstName", "id", "lastName", "message", "name", "pantoneReference", "phoneNumber", "printColours", "printPosition", "productColour", "productHandle", "productId", "productReference", "productTitle", "productUrl", "quantity", "requestType", "shop", "updatedAt", "workedWithBefore" FROM "Enquiry";
DROP TABLE "Enquiry";
ALTER TABLE "new_Enquiry" RENAME TO "Enquiry";
CREATE INDEX "Enquiry_shop_createdAt_idx" ON "Enquiry"("shop", "createdAt");
CREATE INDEX "Enquiry_shop_status_idx" ON "Enquiry"("shop", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "EnquiryEmailLog_enquiryId_createdAt_idx" ON "EnquiryEmailLog"("enquiryId", "createdAt");
