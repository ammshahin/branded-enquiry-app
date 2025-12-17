import type { ActionFunctionArgs } from "react-router";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import {
  sendEnquiryEmails,
  type AttachmentPayload,
  type EnquiryEmailPayload,
} from "../services/enquiry-email.server";

type StoredEnquiry = EnquiryEmailPayload & {
  id: string;
  productId: string | null;
  attachmentFileName: string | null;
  attachmentMimeType: string | null;
  attachmentSize: number | null;
  attachmentData: Buffer | null;
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
  const enquiryDelegate = (
    prisma as unknown as {
      enquiry: {
        create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
      };
    }
  ).enquiry;
  const enquiry = (await enquiryDelegate.create({
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
      attachmentData: attachment?.data ?? null,
    },
  })) as StoredEnquiry;

  console.info("Saved enquiry", {
    enquiryId: enquiry.id,
    hasAttachment: Boolean(attachment),
  });

  try {
    console.info("Sending enquiry notification email", { enquiryId: enquiry.id });
    await sendEnquiryEmails({ enquiry, attachment });
    console.info("Notification email sent", { enquiryId: enquiry.id });
  } catch (error) {
    console.error("Failed to send enquiry notification email", {
      enquiryId: enquiry.id,
      error,
    });
  }

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
