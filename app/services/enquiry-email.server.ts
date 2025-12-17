import nodemailer from "nodemailer";

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

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const getMailer = () => {
  const host = process.env.ENQUIRY_SMTP_HOST;
  const port = process.env.ENQUIRY_SMTP_PORT
    ? Number.parseInt(process.env.ENQUIRY_SMTP_PORT, 10)
    : undefined;

  if (!host || !port) {
    return null;
  }

  const secure = process.env.ENQUIRY_SMTP_SECURE === "true";
  const user = process.env.ENQUIRY_SMTP_USER;
  const pass = process.env.ENQUIRY_SMTP_PASS;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });
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

export const sendEnquiryEmails = async ({
  enquiry,
  attachment,
}: {
  enquiry: EnquiryEmailPayload;
  attachment: AttachmentPayload;
}) => {
  const transporter = getMailer();
  console.info("Transporter", { transporter });
  const fromAddress = process.env.ENQUIRY_NOTIFICATION_FROM;
  console.info("From address", { fromAddress });
  const staffRecipients = getStaffRecipients();
  console.info("Staff recipients", { staffRecipients });
  const customerRecipient = enquiry.email?.trim() || null;
  console.info("Customer recipient", { customerRecipient });

  if (!transporter || !fromAddress || (!staffRecipients.length && !customerRecipient)) {
    throw new Error("Failed to send enquiry notification email");
  }
  console.info("Transporter, from address, staff recipients, and customer recipient are all valid");
  const subject = buildSubject(enquiry);
  console.info("Subject", { subject });
  const staffMessage =
    "A new FREE visual enquiry has been submitted. Please review the details below and follow up with the customer.";
  const customerMessage =
    "This enquiry has been sent to our sales team. We will get back to you with a quotation asap.";

  const sendOperations: Promise<unknown>[] = [];

  if (staffRecipients.length) {
    sendOperations.push(
      transporter.sendMail({
        to: staffRecipients,
        from: fromAddress,
        subject,
        text: buildTextEmailBody(enquiry, staffMessage),
        html: buildHtmlEmailBody(enquiry, staffMessage),
        attachments: attachment
          ? [
              {
                filename: attachment.filename,
                content: attachment.data,
                contentType: attachment.mimeType,
              },
            ]
          : undefined,
      }),
    );
  }

  if (customerRecipient) {
    sendOperations.push(
      transporter.sendMail({
        to: customerRecipient,
        from: fromAddress,
        subject,
        text: buildTextEmailBody(enquiry, customerMessage),
        html: buildHtmlEmailBody(enquiry, customerMessage),
        attachments: attachment
          ? [
              {
                filename: attachment.filename,
                content: attachment.data,
                contentType: attachment.mimeType,
              },
            ]
          : undefined,
      }),
    );
  }

  await Promise.all(sendOperations);
};
