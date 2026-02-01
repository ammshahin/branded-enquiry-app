import type { ActionFunctionArgs } from "react-router";
import { Prisma } from "@prisma/client";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import {
  sendEnquiryEmails,
  type AttachmentPayload,
  type EnquiryEmailPayload,
  type EnquiryEmailSendOutcome,
} from "../services/enquiry-email.server";

type StoredEnquiry = EnquiryEmailPayload & {
  id: string;
  productId: string | null;
  attachmentFileName: string | null;
  attachmentMimeType: string | null;
  attachmentSize: number | null;
  attachmentData: Buffer | Uint8Array | null;
};

const getAttachmentFromForm = async (
  rawValue: FormDataEntryValue | null,
): Promise<AttachmentPayload> => {
  if (!rawValue || typeof rawValue === "string") {
    return null;
  }

  if (rawValue.size === 0) {
    return null;
  }

  const arrayBuffer = await rawValue.arrayBuffer();

  return {
    filename: rawValue.name || "attachment",
    mimeType: rawValue.type || "application/octet-stream",
    size: rawValue.size,
    data: Buffer.from(arrayBuffer),
  };
};

const parseInteger = (value: FormDataEntryValue | null) => {
  if (!value || typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const getStringFromEntry = (value: FormDataEntryValue | null) =>
  typeof value === "string" ? value : null;

const getStringField = (formData: FormData, field: string) =>
  getStringFromEntry(formData.get(field));

const normalizeString = (value: string | null) => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeWorkedWithBefore = (
  value: string | null,
): EnquiryEmailPayload["workedWithBefore"] => {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "yes" || normalized === "no" || normalized === "not_sure") {
    return normalized;
  }

  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method.toUpperCase() !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: "Method not allowed" }),
      {
        status: 405,
        headers: {
          Allow: "POST",
          "Content-Type": "application/json",
        },
      },
    );
  }

  const context = await authenticate.public.appProxy(request);
  const formData = await request.formData();

  const nameValue =
    normalizeString(getStringField(formData, "name")) ?? "Unknown contact";
  const companyName = normalizeString(getStringField(formData, "company_name"));
  const emailValue = normalizeString(getStringField(formData, "email")) ?? "";
  const phoneNumber = normalizeString(getStringField(formData, "phone_number"));
  const requestTypeValue =
    normalizeString(getStringField(formData, "request_type")) ??
    "visual_enquiry";
  const otherRequirements = normalizeString(
    getStringField(formData, "other_requirements"),
  );
  const messageValue =
    otherRequirements ??
    "Customer requested a FREE visual via the storefront enquiry form.";
  const blockId = getStringField(formData, "block_id");
  const productReference = normalizeString(
    getStringField(formData, "product_reference"),
  );
  const productId = getStringField(formData, "product_id");
  const productHandle = getStringField(formData, "product_handle");
  const productTitle = getStringField(formData, "product_title");
  const productUrl = getStringField(formData, "product_url");
  const deliveryDeadline = normalizeString(
    getStringField(formData, "delivery_deadline"),
  );
  const workedWithBefore = normalizeWorkedWithBefore(
    getStringField(formData, "worked_with_before"),
  );
  const quantityValue = parseInteger(formData.get("quantity"));

  console.info("Received enquiry submission", {
    shop: context.session?.shop ?? "unknown",
    blockId,
    name: nameValue,
    email: emailValue,
    requestType: requestTypeValue,
  });

  const attachment = await getAttachmentFromForm(formData.get("attachment"));
  const enquiry = (await prisma.enquiry.create({
    data: {
      shop: context.session?.shop ?? "unknown",
      blockId,
      name: nameValue,
      email: emailValue,
      requestType: requestTypeValue,
      productReference,
      quantity: quantityValue,
      message: messageValue,
      extraInformation: otherRequirements,
      productId,
      productHandle,
      productTitle,
      productUrl,
      companyName,
      phoneNumber,
      deliveryDeadline,
      workedWithBefore,
      attachmentFileName: attachment?.filename ?? null,
      attachmentMimeType: attachment?.mimeType ?? null,
      attachmentSize: attachment?.size ?? null,
      attachmentData: attachment?.data
        ? new Uint8Array(attachment.data)
        : null,
    },
  })) as StoredEnquiry;

  console.info("Saved enquiry", {
    enquiryId: enquiry.id,
    hasAttachment: Boolean(attachment),
  });

  const attemptedAt = new Date();
  let emailOutcome: EnquiryEmailSendOutcome | null = null;
  let emailError: unknown = null;

  try {
    console.info("Sending enquiry notification email", { enquiryId: enquiry.id });
    emailOutcome = await sendEnquiryEmails({ enquiry, attachment });
  } catch (error) {
    emailError = error;
    console.error("Failed to send enquiry notification email", {
      enquiryId: enquiry.id,
      error,
    });
  }

  const resolvedOutcome: EnquiryEmailSendOutcome =
    emailOutcome ??
    {
      attempts: [],
      notificationState: "FAILED",
      lastError:
        emailError instanceof Error
          ? emailError.message
          : "Unknown error sending enquiry notification email",
    };

  const updateData = {
    emailNotificationState: resolvedOutcome.notificationState,
    lastEmailAttemptAt: attemptedAt,
    lastEmailError: resolvedOutcome.lastError,
  };

  const updateOperations: Prisma.PrismaPromise<unknown>[] = [
    prisma.enquiry.update({
      where: { id: enquiry.id },
      data: updateData as Prisma.EnquiryUncheckedUpdateInput,
    }),
  ];

  if (resolvedOutcome.attempts.length) {
    type EnquiryEmailLogDelegate = {
      createMany: (args: Record<string, unknown>) => Prisma.PrismaPromise<unknown>;
    };

    const enquiryEmailLogDelegate = (prisma as unknown as {
      enquiryEmailLog: EnquiryEmailLogDelegate;
    }).enquiryEmailLog;

    updateOperations.push(
      enquiryEmailLogDelegate.createMany({
        data: resolvedOutcome.attempts.map((attempt) => ({
          enquiryId: enquiry.id,
          recipient: attempt.recipient,
          recipientType: attempt.recipientType,
          status: attempt.status,
          subject: attempt.subject,
          errorMessage: attempt.errorMessage,
          providerId: attempt.providerId,
          metadata:
            attempt.metadata !== null
              ? (attempt.metadata as Prisma.JsonValue)
              : Prisma.JsonNull,
        })),
      }),
    );
  }

  await prisma.$transaction(updateOperations);

  console.info("Notification email processed", {
    enquiryId: enquiry.id,
    totalAttempts: resolvedOutcome.attempts.length,
    notificationState: resolvedOutcome.notificationState,
    lastError: resolvedOutcome.lastError,
  });

  return new Response(
    JSON.stringify({ ok: true }),
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
};

export const loader = () =>
  new Response(null, { status: 405, headers: { Allow: "POST" } });
