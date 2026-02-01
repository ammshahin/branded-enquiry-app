import Mailgun from "mailgun.js";
import formData from "form-data";

export type AttachmentPayload = {
  filename: string;
  mimeType: string;
  size: number;
  data: Buffer;
} | null;

export type EnquiryEmailPayload = {
  name: string;
  email: string;
  companyName: string | null;
  phoneNumber: string | null;
  requestType: string;
  productReference: string | null;
  quantity: number | null;
  deliveryDeadline: string | null;
  workedWithBefore: "yes" | "no" | "not_sure" | null;
  message: string;
  extraInformation: string | null;
  productTitle: string | null;
  productHandle: string | null;
  productUrl: string | null;
  attachmentFileName?: string | null;
};

export const ENQUIRY_EMAIL_RECIPIENT = {
  STAFF: "STAFF",
  CUSTOMER: "CUSTOMER",
  OTHER: "OTHER",
} as const;
export type EnquiryEmailRecipientType =
  (typeof ENQUIRY_EMAIL_RECIPIENT)[keyof typeof ENQUIRY_EMAIL_RECIPIENT];

export const ENQUIRY_EMAIL_STATUS = {
  SUCCESS: "SUCCESS",
  FAILURE: "FAILURE",
} as const;
export type EnquiryEmailStatus =
  (typeof ENQUIRY_EMAIL_STATUS)[keyof typeof ENQUIRY_EMAIL_STATUS];

export const ENQUIRY_NOTIFICATION_STATE = {
  PENDING: "PENDING",
  SENT: "SENT",
  PARTIAL: "PARTIAL",
  FAILED: "FAILED",
} as const;
export type EnquiryNotificationState =
  (typeof ENQUIRY_NOTIFICATION_STATE)[keyof typeof ENQUIRY_NOTIFICATION_STATE];

export type EnquiryEmailSendAttempt = {
  recipient: string;
  recipientType: EnquiryEmailRecipientType;
  status: EnquiryEmailStatus;
  subject: string;
  errorMessage: string | null;
  providerId: string | null;
  metadata: Record<string, unknown> | null;
};

export type EnquiryEmailSendOutcome = {
  attempts: EnquiryEmailSendAttempt[];
  notificationState: EnquiryNotificationState;
  lastError: string | null;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const getMailer = () => {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  const fromEmail = process.env.MAILGUN_FROM_EMAIL;

  if (!apiKey || !domain || !fromEmail) {
    return null;
  }

  const mailgun = new Mailgun(formData);
  const client = mailgun.client({
    username: "api",
    key: apiKey,
    url: process.env.MAILGUN_API_BASE_URL,
  });

  return {
    client,
    domain,
    fromEmail,
  };
};

const formatWorkedWithBefore = (value: EnquiryEmailPayload["workedWithBefore"]) => {
  switch (value) {
    case "yes":
      return "Yes";
    case "no":
      return "No";
    case "not_sure":
      return "I'm not sure";
    default:
      return null;
  }
};

const buildTextEmailBody = (
  payload: EnquiryEmailPayload,
  confirmationCopy: string,
) => {
  const safe = (value: string | null | undefined) =>
    value && value.trim().length > 0 ? value.trim() : "—";
  const worked = formatWorkedWithBefore(payload.workedWithBefore) ?? "—";

  const lines: string[] = [
    "New FREE visual enquiry received.",
    "",
    confirmationCopy,
    "",
    "Product Information",
    `  Product Name: ${safe(payload.productTitle)}`,
    `  Product SKU: ${safe(payload.productReference)}`,
    `  Required Date: ${safe(payload.deliveryDeadline)}`,
    `  Quantity for Quote: ${safe(
      payload.quantity !== null ? String(payload.quantity) : null,
    )}`,
    "",
    "Customer Information",
    `  Name: ${safe(payload.name)}`,
    `  Email: ${safe(payload.email)}`,
    `  Phone: ${safe(payload.phoneNumber)}`,
    `  Company: ${safe(payload.companyName)}`,
    "",
    "Other Information",
    `  Source: ${safe(
      payload.requestType === "visual_enquiry"
        ? "Free visual enquiry"
        : payload.requestType,
    )}`,
    `  Worked with us before: ${worked}`,
    `  Notes: ${safe(payload.extraInformation ?? payload.message)}`,
    `  Attachment: ${safe(payload.attachmentFileName)}`,
  ];

  return lines.join("\n");
};

const buildHtmlEmailBody = (
  payload: EnquiryEmailPayload,
  confirmationCopy: string,
) => {
  const logoUrl =
    "https://cdn.shopify.com/s/files/1/1017/8425/6851/files/WhatsApp_Image_2025-12-04_at_6.15.10_PM.jpg?v=1765388437";

  const safeHtml = (value: string | null | undefined) =>
    value && value.trim().length > 0
      ? escapeHtml(value.trim()).replace(/\r?\n/g, "<br />")
      : '<span style="color:#777777;">&mdash;</span>';

  const productLink =
    payload.productUrl && payload.productTitle
      ? `<a href="${escapeHtml(
          payload.productUrl,
        )}" style="color:#8aa2ff;text-decoration:none;">${escapeHtml(
          payload.productTitle,
        )}</a>`
      : safeHtml(payload.productTitle);

  const emailLink = payload.email
    ? `<a href="mailto:${escapeHtml(
        payload.email,
      )}" style="color:#8aa2ff;text-decoration:none;">${escapeHtml(
        payload.email,
      )}</a>`
    : '<span style="color:#777777;">&mdash;</span>';

  const phoneLink =
    payload.phoneNumber && payload.phoneNumber.trim().length > 0
      ? `<a href="tel:${escapeHtml(
          payload.phoneNumber.trim(),
        )}" style="color:#8aa2ff;text-decoration:none;">${escapeHtml(
          payload.phoneNumber.trim(),
        )}</a>`
      : '<span style="color:#777777;">&mdash;</span>';

  const quantity =
    payload.quantity !== null
      ? escapeHtml(String(payload.quantity))
      : '<span style="color:#777777;">&mdash;</span>';

  const workedWith = formatWorkedWithBefore(payload.workedWithBefore);
  const sourceBase =
    payload.requestType === "visual_enquiry"
      ? "Free visual enquiry"
      : payload.requestType;
  const sourceCombined =
    workedWith !== null
      ? `${sourceBase} - Previously worked with us: ${workedWith}`
      : sourceBase;

  const notes = payload.extraInformation ?? payload.message;

  const attachment =
    payload.attachmentFileName && payload.attachmentFileName.trim().length > 0
      ? escapeHtml(payload.attachmentFileName.trim())
      : '<span style="color:#777777;">No attachment</span>';

  return `
<table width="100%" cellspacing="0" cellpadding="0" border="0" align="center" bgcolor="#0b0b0b" style="margin:0;padding:24px 0;background-color:#0b0b0b;">
  <tr>
    <td align="center">
      <table width="600" cellspacing="0" cellpadding="0" border="0" style="border:4px solid #E68906;border-collapse:collapse;background-color:#0f0f0f;font-family:Arial,Helvetica,sans-serif;color:#ffffff;">
        <tr>
          <td align="center" bgcolor="#E68906" style="padding:18px;">
            <table width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
              <tr>
                <td align="left" valign="middle" style="font-size:0;line-height:0;">
                  <img src="${logoUrl}" alt="Branding HQ" width="140" style="display:block;border:0;outline:none;text-decoration:none;width:140px;height:auto;">
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 28px;">
            <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#171717;border:1px solid #E68906;color:#e0e0e0;border-collapse:collapse;">
              <tr>
                <td style="padding:18px;font-size:14px;line-height:20px;">
                  ${escapeHtml(confirmationCopy)}
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 28px 24px;">
            <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#141414;border:1px solid #1f1f1f;border-collapse:collapse;">
              <tr>
                <td style="padding:22px 24px;">
                  <table width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                    <tr>
                      <td align="center" style="padding-bottom:18px;">
                        <table width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                          <tr>
                            <td style="border-top:1px solid #E68906;height:1px;font-size:0;line-height:0;">&nbsp;</td>
                          </tr>
                          <tr>
                            <td style="padding:10px 0;font-size:16px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#ffffff;text-align:center;">Product Information</td>
                          </tr>
                          <tr>
                            <td style="border-bottom:1px solid #E68906;height:1px;font-size:0;line-height:0;">&nbsp;</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                  <table width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                    <tr>
                      <td width="45%" valign="top" style="padding:6px 12px 6px 0;font-size:13px;color:#cccccc;">Product Name</td>
                      <td width="55%" valign="top" style="padding:6px 0;font-size:13px;color:#ffffff;">${productLink}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 12px 6px 0;font-size:13px;color:#cccccc;">Product SKU</td>
                      <td style="padding:6px 0;font-size:13px;color:#ffffff;">${safeHtml(
                        payload.productReference,
                      )}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 12px 6px 0;font-size:13px;color:#cccccc;">Required Date</td>
                      <td style="padding:6px 0;font-size:13px;color:#ffffff;">${safeHtml(
                        payload.deliveryDeadline,
                      )}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 12px 0 0;font-size:13px;color:#cccccc;">Quantity for Quote</td>
                      <td style="padding:6px 0 0;font-size:13px;color:#ffffff;">${quantity}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 28px 24px;">
            <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#141414;border:1px solid #1f1f1f;border-collapse:collapse;">
              <tr>
                <td style="padding:22px 24px;">
                  <table width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                    <tr>
                      <td align="center" style="padding-bottom:18px;">
                        <table width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                          <tr>
                            <td style="border-top:1px solid #E68906;height:1px;font-size:0;line-height:0;">&nbsp;</td>
                          </tr>
                          <tr>
                            <td style="padding:10px 0;font-size:16px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#ffffff;text-align:center;">Customer Information</td>
                          </tr>
                          <tr>
                            <td style="border-bottom:1px solid #E68906;height:1px;font-size:0;line-height:0;">&nbsp;</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                  <table width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                    <tr>
                      <td width="45%" valign="top" style="padding:6px 12px 6px 0;font-size:13px;color:#cccccc;">Name</td>
                      <td width="55%" valign="top" style="padding:6px 0;font-size:13px;color:#ffffff;">${safeHtml(
                        payload.name,
                      )}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 12px 6px 0;font-size:13px;color:#cccccc;">Email</td>
                      <td style="padding:6px 0;font-size:13px;">${emailLink}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 12px 6px 0;font-size:13px;color:#cccccc;">Phone</td>
                      <td style="padding:6px 0;font-size:13px;">${phoneLink}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 12px 0 0;font-size:13px;color:#cccccc;">Company</td>
                      <td style="padding:6px 0 0;font-size:13px;color:#ffffff;">${safeHtml(
                        payload.companyName,
                      )}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 28px 32px;">
            <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#141414;border:1px solid #1f1f1f;border-collapse:collapse;">
              <tr>
                <td style="padding:22px 24px;">
                  <table width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                    <tr>
                      <td align="center" style="padding-bottom:18px;">
                        <table width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                          <tr>
                            <td style="border-top:1px solid #E68906;height:1px;font-size:0;line-height:0;">&nbsp;</td>
                          </tr>
                          <tr>
                            <td style="padding:10px 0;font-size:16px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#ffffff;text-align:center;">Other Information</td>
                          </tr>
                          <tr>
                            <td style="border-bottom:1px solid #E68906;height:1px;font-size:0;line-height:0;">&nbsp;</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                  <table width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                    <tr>
                      <td width="45%" valign="top" style="padding:6px 12px 6px 0;font-size:13px;color:#cccccc;">Source</td>
                      <td width="55%" valign="top" style="padding:6px 0;font-size:13px;color:#ffffff;">${safeHtml(
                        sourceCombined,
                      )}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 12px 6px 0;font-size:13px;color:#cccccc;">Notes</td>
                      <td style="padding:6px 0;font-size:13px;color:#ffffff;">${safeHtml(
                        notes,
                      )}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 12px 0 0;font-size:13px;color:#cccccc;">Attachment</td>
                      <td style="padding:6px 0 0;font-size:13px;color:#ffffff;">${attachment}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" bgcolor="#E68906" style="padding:18px 24px;">
            <span style="font-size:12px;color:#ffffff;line-height:18px;">
              Branding HQ &bull; 15 Warren Park Way, Enderby, Leicester, LE19 4SA &bull;
              <a href="https://www.brandinghq.co.uk" style="color:#ffffff;text-decoration:none;">www.brandinghq.co.uk</a>
            </span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
};

const buildSubject = (payload: EnquiryEmailPayload) =>
  `[Free Visual] ${payload.name}`;

const getStaffRecipients = () => {
  if (!process.env.ENQUIRY_STAFF_EMAIL) {
    return [];
  }

  return process.env.ENQUIRY_STAFF_EMAIL.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const summarizeAttempts = (
  attempts: EnquiryEmailSendAttempt[],
): {
  notificationState: EnquiryNotificationState;
  lastError: string | null;
} => {
  if (attempts.length === 0) {
    return {
      notificationState: ENQUIRY_NOTIFICATION_STATE.FAILED,
      lastError: "No email recipients configured for enquiry notifications",
    };
  }

  const failures = attempts.filter(
    (entry) => entry.status === ENQUIRY_EMAIL_STATUS.FAILURE,
  );
  const successes = attempts.filter(
    (entry) => entry.status === ENQUIRY_EMAIL_STATUS.SUCCESS,
  );
  const lastFailure = failures.at(-1)?.errorMessage ?? null;

  if (failures.length === 0) {
    return {
      notificationState: ENQUIRY_NOTIFICATION_STATE.SENT,
      lastError: null,
    };
  }

  if (successes.length > 0) {
    return {
      notificationState: ENQUIRY_NOTIFICATION_STATE.PARTIAL,
      lastError: lastFailure,
    };
  }

  return {
    notificationState: ENQUIRY_NOTIFICATION_STATE.FAILED,
    lastError: lastFailure,
  };
};

const buildErrorMetadata = (error: unknown): Record<string, unknown> | null => {
  if (error && typeof error === "object") {
    const candidate = error as {
      name?: string;
      message?: string;
      status?: number;
      statusCode?: number;
      code?: string;
      details?: unknown;
    };

    return {
      name: candidate.name ?? "Error",
      status: candidate.status ?? candidate.statusCode ?? null,
      code: candidate.code ?? null,
      details: candidate.details ?? null,
    };
  }

  return null;
};

const buildSuccessMetadata = (result: unknown): Record<string, unknown> | null => {
  if (result && typeof result === "object") {
    const candidate = result as { id?: string; message?: string };
    return {
      message: candidate.message ?? null,
    };
  }

  return null;
};

const normalizeErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown error sending email";
};

export const sendEnquiryEmails = async ({
  enquiry,
  attachment,
}: {
  enquiry: EnquiryEmailPayload;
  attachment: AttachmentPayload;
}): Promise<EnquiryEmailSendOutcome> => {
  const mailer = getMailer();
  const fromAddress = mailer?.fromEmail ?? null;
  const staffRecipients = getStaffRecipients();
  const customerRecipient = enquiry.email?.trim() || null;
  const subject = buildSubject(enquiry);

  const staffMessage =
    "A new FREE visual enquiry has been submitted. Please review the details below and follow up with the customer.";
  const customerMessage =
    "This enquiry has been sent to our sales team. We will get back to you with a quotation asap.";

  const attachments =
    attachment && attachment.data
      ? [
          {
            data: attachment.data,
            filename: attachment.filename ?? "attachment",
            contentType: attachment.mimeType,
          },
        ]
      : undefined;

  const staffBodies =
    staffRecipients.length > 0
      ? {
          text: buildTextEmailBody(enquiry, staffMessage),
          html: buildHtmlEmailBody(enquiry, staffMessage),
        }
      : null;
  const customerBodies = customerRecipient
    ? {
        text: buildTextEmailBody(enquiry, customerMessage),
        html: buildHtmlEmailBody(enquiry, customerMessage),
      }
    : null;

  const intendedRecipients: Array<{
    email: string;
    recipientType: EnquiryEmailRecipientType;
    textBody: string;
    htmlBody: string;
  }> = [];

  if (staffBodies) {
    for (const email of staffRecipients) {
      intendedRecipients.push({
        email,
        recipientType: ENQUIRY_EMAIL_RECIPIENT.STAFF,
        textBody: staffBodies.text,
        htmlBody: staffBodies.html,
      });
    }
  }

  if (customerRecipient && customerBodies) {
    intendedRecipients.push({
      email: customerRecipient,
      recipientType: ENQUIRY_EMAIL_RECIPIENT.CUSTOMER,
      textBody: customerBodies.text,
      htmlBody: customerBodies.html,
    });
  }

  if (!intendedRecipients.length) {
    const attempts: EnquiryEmailSendAttempt[] = [
      {
        recipient: "n/a",
        recipientType: ENQUIRY_EMAIL_RECIPIENT.OTHER,
        status: ENQUIRY_EMAIL_STATUS.FAILURE,
        subject,
        errorMessage: "No email recipients configured for enquiry notifications",
        providerId: null,
        metadata: null,
      },
    ];

    const summary = summarizeAttempts(attempts);

    return {
      attempts,
      notificationState: summary.notificationState,
      lastError: summary.lastError,
    };
  }

  const misconfigurationError = !mailer
    ? "Mailgun client is not configured."
    : !fromAddress
      ? "Missing Mailgun sender address."
      : null;

  const attempts: EnquiryEmailSendAttempt[] = [];

  const sendToRecipient = async (recipient: {
    email: string;
    recipientType: EnquiryEmailRecipientType;
    textBody: string;
    htmlBody: string;
  }) => {
    if (misconfigurationError || !mailer || !fromAddress) {
      attempts.push({
        recipient: recipient.email,
        recipientType: recipient.recipientType,
        status: ENQUIRY_EMAIL_STATUS.FAILURE,
        subject,
        errorMessage: misconfigurationError ?? "Mailer configuration is incomplete.",
        providerId: null,
        metadata: { reason: "missing_mailer_configuration" },
      });
      return;
    }

    try {
      const response = await mailer.client.messages.create(mailer.domain, {
        to: recipient.email,
        from: fromAddress,
        subject,
        text: recipient.textBody,
        html: recipient.htmlBody,
        ...(attachments ? { attachment: attachments } : {}),
      });

      const providerId =
        response && typeof response === "object" && "id" in response
          ? (response.id as string)
          : null;

      attempts.push({
        recipient: recipient.email,
        recipientType: recipient.recipientType,
        status: ENQUIRY_EMAIL_STATUS.SUCCESS,
        subject,
        errorMessage: null,
        providerId,
        metadata: buildSuccessMetadata(response),
      });
    } catch (error) {
      attempts.push({
        recipient: recipient.email,
        recipientType: recipient.recipientType,
        status: ENQUIRY_EMAIL_STATUS.FAILURE,
        subject,
        errorMessage: normalizeErrorMessage(error),
        providerId: null,
        metadata: buildErrorMetadata(error),
      });
    }
  };

  for (const recipient of intendedRecipients) {
    // eslint-disable-next-line no-await-in-loop
    await sendToRecipient(recipient);
  }

  const summary = summarizeAttempts(attempts);

  return {
    attempts,
    notificationState: summary.notificationState,
    lastError: summary.lastError,
  };
};
