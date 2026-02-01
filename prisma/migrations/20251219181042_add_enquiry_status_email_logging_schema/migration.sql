-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Enquiry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "statusUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statusNotes" TEXT,
    "emailNotificationState" TEXT NOT NULL DEFAULT 'PENDING',
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
INSERT INTO "new_Enquiry" ("artworkNotes", "attachmentData", "attachmentFileName", "attachmentMimeType", "attachmentSize", "blockId", "companyName", "createdAt", "deliveryDeadline", "email", "emailNotificationState", "extraInformation", "firstName", "id", "lastEmailAttemptAt", "lastEmailError", "lastName", "message", "name", "pantoneReference", "phoneNumber", "printColours", "printPosition", "productColour", "productHandle", "productId", "productReference", "productTitle", "productUrl", "quantity", "requestType", "shop", "status", "statusNotes", "statusUpdatedAt", "updatedAt", "workedWithBefore") SELECT "artworkNotes", "attachmentData", "attachmentFileName", "attachmentMimeType", "attachmentSize", "blockId", "companyName", "createdAt", "deliveryDeadline", "email", "emailNotificationState", "extraInformation", "firstName", "id", "lastEmailAttemptAt", "lastEmailError", "lastName", "message", "name", "pantoneReference", "phoneNumber", "printColours", "printPosition", "productColour", "productHandle", "productId", "productReference", "productTitle", "productUrl", "quantity", "requestType", "shop", "status", "statusNotes", "statusUpdatedAt", "updatedAt", "workedWithBefore" FROM "Enquiry";
DROP TABLE "Enquiry";
ALTER TABLE "new_Enquiry" RENAME TO "Enquiry";
CREATE INDEX "Enquiry_shop_createdAt_idx" ON "Enquiry"("shop", "createdAt");
CREATE INDEX "Enquiry_shop_status_idx" ON "Enquiry"("shop", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Normalize existing status values to new enum casing
UPDATE "Enquiry" SET "status" = 'NEW' WHERE "status" = 'new';
UPDATE "Enquiry" SET "status" = 'IN_PROGRESS' WHERE "status" = 'in_progress';
UPDATE "Enquiry" SET "status" = 'AWAITING_CUSTOMER' WHERE "status" = 'awaiting_customer';
UPDATE "Enquiry" SET "status" = 'QUOTE_SENT' WHERE "status" = 'quote_sent';
UPDATE "Enquiry" SET "status" = 'COMPLETED' WHERE "status" = 'completed';
UPDATE "Enquiry" SET "status" = 'CLOSED' WHERE "status" = 'closed';

UPDATE "Enquiry" SET "emailNotificationState" = 'PENDING' WHERE "emailNotificationState" = 'pending';
UPDATE "Enquiry" SET "emailNotificationState" = 'SENT' WHERE "emailNotificationState" = 'sent';
UPDATE "Enquiry" SET "emailNotificationState" = 'PARTIAL' WHERE "emailNotificationState" = 'partial';
UPDATE "Enquiry" SET "emailNotificationState" = 'FAILED' WHERE "emailNotificationState" = 'failed';

UPDATE "EnquiryEmailLog" SET "status" = 'SUCCESS' WHERE "status" = 'success';
UPDATE "EnquiryEmailLog" SET "status" = 'FAILURE' WHERE "status" IN ('failed', 'failure');

UPDATE "EnquiryEmailLog" SET "recipientType" = 'STAFF' WHERE "recipientType" = 'staff';
UPDATE "EnquiryEmailLog" SET "recipientType" = 'CUSTOMER' WHERE "recipientType" = 'customer';
