import { useEffect, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, useSearchParams } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { ChevronDownIcon, ChevronUpIcon } from "@shopify/polaris-icons";

import prisma from "../../db.server";
import { authenticate } from "../../shopify.server";
import styles from "./styles.module.css";

const STATUS_OPTIONS = [
  { value: "NEW", label: "New" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "AWAITING_CUSTOMER", label: "Awaiting customer" },
  { value: "QUOTE_SENT", label: "Quote sent" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CLOSED", label: "Closed" },
] as const;

const PAGE_SIZE = 10;

const EMAIL_STATE_LABELS: Record<string, string> = {
  PENDING: "Pending",
  SENT: "Sent",
  PARTIAL: "Partially sent",
  FAILED: "Failed",
};

const RECIPIENT_LABELS: Record<string, string> = {
  STAFF: "Staff",
  CUSTOMER: "Customer",
  OTHER: "Other",
};

const STATUS_MAP = new Map(
  STATUS_OPTIONS.map((option) => [option.value, option.label]),
);
const STATUS_VALUES = STATUS_OPTIONS.map((option) => option.value);

const STATUS_TONE: Record<
  string,
  "info" | "success" | "critical" | "attention"
> = {
  NEW: "info",
  IN_PROGRESS: "attention",
  AWAITING_CUSTOMER: "attention",
  QUOTE_SENT: "attention",
  COMPLETED: "success",
  CLOSED: "success",
};

const EMAIL_TONE: Record<
  string,
  "info" | "success" | "critical" | "attention"
> = {
  PENDING: "attention",
  SENT: "success",
  PARTIAL: "attention",
  FAILED: "critical",
};

const formatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

const formatDateTime = (value: string | null) => {
  if (!value) {
    return "—";
  }

  return formatter.format(new Date(value));
};

const formatWorkedWith = (value: string | null) => {
  switch (value) {
    case "yes":
      return "Yes";
    case "no":
      return "No";
    case "not_sure":
      return "Not sure";
    default:
      return "—";
  }
};

const safeStringify = (value: unknown) => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

export type LoaderData = {
  enquiries: Array<{
    id: string;
    createdAt: string;
    status: string;
    statusUpdatedAt: string;
    statusNotes: string | null;
    name: string;
    email: string;
    companyName: string | null;
    phoneNumber: string | null;
    requestType: string;
    productTitle: string | null;
    productReference: string | null;
    quantity: number | null;
    deliveryDeadline: string | null;
    workedWithBefore: string | null;
    message: string;
    extraInformation: string | null;
    emailNotificationState: string;
    lastEmailAttemptAt: string | null;
    lastEmailError: string | null;
    emailLogs: Array<{
      id: string;
      createdAt: string;
      recipient: string;
      recipientType: string;
      status: string;
      subject: string | null;
      errorMessage: string | null;
      providerId: string | null;
      metadata: unknown;
    }>;
  }>;
  statusCounts: Record<string, number>;
  statusFilter: string | null;
  query: string;
  page: number;
  pageSize: number;
  totalMatching: number;
};

export type ActionData =
  | {
      ok: true;
      enquiry: {
        id: string;
        status: string;
        statusNotes: string | null;
        statusUpdatedAt: string;
      };
    }
  | { ok: false; error: string };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);

  const rawStatus = url.searchParams.get("status");
  const rawQuery = url.searchParams.get("q")?.trim() ?? "";
  const rawPage = url.searchParams.get("page");

  const normalizedStatus = rawStatus ? rawStatus.toUpperCase() : null;
  const statusFilter = STATUS_VALUES.includes(normalizedStatus ?? "")
    ? normalizedStatus
    : null;
  const query = rawQuery.slice(0, 120);
  const requestedPage = (() => {
    const parsed = Number.parseInt(rawPage ?? "", 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return 1;
    }
    return parsed;
  })();

  const where: Record<string, unknown> = { shop: session.shop };

  if (statusFilter) {
    where.status = statusFilter;
  }

  if (query) {
    where.AND = [
      {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
          { companyName: { contains: query, mode: "insensitive" } },
          { productTitle: { contains: query, mode: "insensitive" } },
          { productReference: { contains: query, mode: "insensitive" } },
          { message: { contains: query, mode: "insensitive" } },
        ],
      },
    ];
  }

  const totalMatching = await prisma.enquiry.count({
    where: where as never,
  });

  const maxPage = Math.max(1, Math.ceil(totalMatching / PAGE_SIZE));
  const page = Math.min(requestedPage, maxPage);
  const skip = (page - 1) * PAGE_SIZE;

  const enquiries = await prisma.enquiry.findMany({
    where: where as never,
    orderBy: { createdAt: "desc" },
    skip,
    take: PAGE_SIZE,
    include: {
      emailLogs: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  const groupedCounts = (await prisma.enquiry.groupBy({
    by: ["status"],
    _count: { _all: true },
    where: { shop: session.shop },
  })) as Array<{ status: string; _count: { _all: number } }>;

  const statusCounts: Record<string, number> = {};
  for (const option of STATUS_OPTIONS) {
    statusCounts[option.value] = 0;
  }
  for (const entry of groupedCounts) {
    statusCounts[entry.status] = entry._count._all;
  }

  const payload: LoaderData = {
    enquiries: enquiries.map((enquiry) => ({
      id: enquiry.id,
      createdAt: enquiry.createdAt.toISOString(),
      status: enquiry.status,
      statusUpdatedAt: enquiry.statusUpdatedAt.toISOString(),
      statusNotes: enquiry.statusNotes,
      name: enquiry.name,
      email: enquiry.email,
      companyName: enquiry.companyName,
      phoneNumber: enquiry.phoneNumber,
      requestType: enquiry.requestType,
      productTitle: enquiry.productTitle,
      productReference: enquiry.productReference,
      quantity: enquiry.quantity,
      deliveryDeadline: enquiry.deliveryDeadline,
      workedWithBefore: enquiry.workedWithBefore,
      message: enquiry.message,
      extraInformation: enquiry.extraInformation,
      emailNotificationState: enquiry.emailNotificationState,
      lastEmailAttemptAt: enquiry.lastEmailAttemptAt
        ? enquiry.lastEmailAttemptAt.toISOString()
        : null,
      lastEmailError: enquiry.lastEmailError,
      emailLogs: enquiry.emailLogs.map((log) => ({
        id: log.id,
        createdAt: log.createdAt.toISOString(),
        recipient: log.recipient,
        recipientType: log.recipientType,
        status: log.status,
        subject: log.subject,
        errorMessage: log.errorMessage,
        providerId: log.providerId,
        metadata: log.metadata,
      })),
    })),
    statusCounts,
    statusFilter,
    query,
    page,
    pageSize: PAGE_SIZE,
    totalMatching,
  };

  return Response.json(payload);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const intent = formData.get("intent");
  if (intent !== "update-status") {
    return Response.json(
      { ok: false, error: "Unsupported action" },
      { status: 400 },
    );
  }

  const enquiryIdRaw = formData.get("enquiryId");
  const statusRaw = formData.get("status");
  const notesRaw = formData.get("statusNotes");

  const enquiryId = typeof enquiryIdRaw === "string" ? enquiryIdRaw.trim() : "";
  const statusValue =
    typeof statusRaw === "string" ? statusRaw.trim().toUpperCase() : "";
  const statusNotes =
    typeof notesRaw === "string" && notesRaw.trim().length > 0
      ? notesRaw.trim()
      : null;

  if (!enquiryId) {
    return Response.json(
      { ok: false, error: "Missing enquiry identifier" },
      { status: 400 },
    );
  }

  if (!STATUS_VALUES.includes(statusValue)) {
    return Response.json(
      { ok: false, error: "Invalid status value" },
      { status: 400 },
    );
  }

  const existing = await prisma.enquiry.findUnique({
    where: { id: enquiryId },
    select: { id: true, shop: true, status: true },
  });

  if (!existing || existing.shop !== session.shop) {
    return Response.json(
      { ok: false, error: "Enquiry not found" },
      { status: 404 },
    );
  }

  const shouldRefreshTimestamp = existing.status !== statusValue;
  const now = new Date();

  const updated = await prisma.enquiry.update({
    where: { id: enquiryId },
    data: {
      status: statusValue as never,
      statusNotes,
      ...(shouldRefreshTimestamp ? { statusUpdatedAt: now } : {}),
    },
    select: {
      id: true,
      status: true,
      statusNotes: true,
      statusUpdatedAt: true,
    },
  });

  return Response.json({
    ok: true,
    enquiry: {
      id: updated.id,
      status: updated.status,
      statusNotes: updated.statusNotes,
      statusUpdatedAt: updated.statusUpdatedAt.toISOString(),
    },
  });
};

export default function EnquiriesDashboard() {
  const data = useLoaderData() as LoaderData;
  const fetcher = useFetcher<ActionData>();
  const appBridge = useAppBridge();
  const [params, setParams] = useSearchParams();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusPopoverId, setStatusPopoverId] = useState<string | null>(null);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      if (fetcher.data.ok) {
        appBridge.toast.show("Enquiry updated");
        setStatusPopoverId(null);
      } else if (fetcher.data.error) {
        appBridge.toast.show(fetcher.data.error, { isError: true });
      }
    }
  }, [appBridge, fetcher.data, fetcher.state]);

  useEffect(() => {
    if (!statusPopoverId) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;

      if (target?.closest("[data-status-popover-root]")) {
        return;
      }

      setStatusPopoverId(null);
    };

    window.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [statusPopoverId]);

  const hasResults = data.enquiries.length > 0;
  const filterStatus = params.get("status") ?? "";
  const filterQuery = params.get("q") ?? "";
  const totalEnquiries = Object.values(data.statusCounts).reduce(
    (acc, count) => acc + count,
    0,
  );
  const totalMatching = data.totalMatching;
  const pageSize = data.pageSize;
  const page = data.page;
  const totalPages = Math.max(1, Math.ceil(totalMatching / pageSize));
  const hasPreviousPage = page > 1;
  const hasNextPage = page < totalPages;
  const rangeStart = totalMatching === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd =
    totalMatching === 0
      ? 0
      : Math.min(totalMatching, rangeStart + pageSize - 1);

  const changePage = (targetPage: number) => {
    const safeTarget = Math.min(Math.max(targetPage, 1), totalPages);
    const nextParams = new URLSearchParams(params);
    if (safeTarget <= 1) {
      nextParams.delete("page");
    } else {
      nextParams.set("page", String(safeTarget));
    }
    setExpandedId(null);
    setStatusPopoverId(null);
    setParams(nextParams, { replace: true });
  };

  const handlePreviousPage = () => {
    if (hasPreviousPage) {
      changePage(page - 1);
    }
  };

  const handleNextPage = () => {
    if (hasNextPage) {
      changePage(page + 1);
    }
  };

  const emailSummary = Object.entries(EMAIL_STATE_LABELS).map(
    ([state, label]) => {
      const count = data.enquiries.filter(
        (enquiry) => enquiry.emailNotificationState === state,
      ).length;
      return { state, label, count };
    },
  );

  const metricCards = [
    {
      id: "TOTAL",
      label: "Total enquiries",
      value: totalEnquiries,
    },
    ...STATUS_OPTIONS.map((option) => ({
      id: option.value,
      label: option.label,
      value: data.statusCounts[option.value] ?? 0,
    })),
  ];

  return (
    <s-page heading="Enquiries dashboard">
      <div className={styles.pageRoot}>
        <s-section>
          <div className={styles.metricsRow}>
            {metricCards.map((metric) => (
              <s-card
                key={metric.id}
                padding="base"
                className={styles.metricCard}
                background="subdued"
              >
                <s-stack gap="tight">
                  <s-heading level={metric.id === "TOTAL" ? 3 : 4}>
                    {metric.label}
                  </s-heading>
                  <span className={styles.metricValue}>{metric.value}</span>
                  <s-text tone="subdued">{metric.helper}</s-text>
                </s-stack>
              </s-card>
            ))}
          </div>
        </s-section>

        {/* <s-card padding="base" className={styles.filterCard}>
          <s-heading level={3}>Filter enquiries</s-heading>
          <form method="get" className={styles.filterForm}>
            <div className={styles.filterField}>
              <label htmlFor="status-select">Status</label>
              <select
                id="status-select"
                name="status"
                defaultValue={filterStatus}
              >
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.filterField}>
              <label htmlFor="search-input">Search</label>
              <input
                id="search-input"
                type="search"
                name="q"
                placeholder="Name, email, product, message..."
                defaultValue={filterQuery}
              />
            </div>
            <div className={styles.filterActions}>
              <s-button type="submit" variant="primary">
                Apply
              </s-button>
              <s-button
                type="button"
                variant="tertiary"
                onClick={() => setParams({})}
              >
                Clear
              </s-button>
            </div>
          </form>
        </s-card> */}

        {/* <s-card padding="base">
          <s-heading level={3}>Email delivery summary</s-heading>
          <div className={styles.emailSummaryGrid}>
            {emailSummary.map((entry) => (
              <s-card key={entry.state} padding="base" background="subdued">
                <s-stack gap="tight">
                  <s-heading level={4}>{entry.label}</s-heading>
                  <s-badge tone={EMAIL_TONE[entry.state] ?? "info"}>
                    {entry.count} {entry.count === 1 ? "attempt" : "attempts"}
                  </s-badge>
                </s-stack>
              </s-card>
            ))}
          </div>
        </s-card> */}

        <s-divider />
        <section>
          {hasResults ? (
            <>
              <div className={styles.tableHeader}>
                <span>Contact</span>
                <span>Status</span>
                <span>Actions</span>
              </div>
              <div className={styles.enquiryCards}>
                {data.enquiries.map((enquiry) => {
                  const isExpanded = expandedId === enquiry.id;
                  const isPopoverOpen = statusPopoverId === enquiry.id;
                  const ExpandIcon = isExpanded
                    ? ChevronUpIcon
                    : ChevronDownIcon;
                  return (
                    <s-stack
                      key={enquiry.id}
                      padding="base"
                      background="subdued"
                    >
                      <div className={styles.row}>
                        <div className={styles.rowContent}>
                          <div className={styles.rowTop}>
                            <div>
                              <s-heading level={4}>{enquiry.name}</s-heading>
                              <div className={styles.rowMeta}>
                                <span>{enquiry.email}</span>
                              </div>
                            </div>
                            <div className={styles.rowBadges}>
                              <s-badge
                                tone={STATUS_TONE[enquiry.status] ?? "info"}
                              >
                                {STATUS_MAP.get(enquiry.status) ??
                                  enquiry.status}
                              </s-badge>
                            </div>
                          </div>
                        </div>
                        <div className={styles.rowActions}>
                          <div
                            className={styles.popoverWrap}
                            data-status-popover-root
                          >
                            <s-button
                              type="button"
                              variant="tertiary"
                              aria-label="Update status"
                              onClick={() =>
                                setStatusPopoverId(
                                  isPopoverOpen ? null : enquiry.id,
                                )
                              }
                            >
                              ⋯
                            </s-button>
                            {isPopoverOpen && (
                              <div className={styles.popoverCard}>
                                <StatusForm
                                  fetcher={fetcher}
                                  enquiry={enquiry}
                                  layout="compact"
                                />
                              </div>
                            )}
                          </div>
                          <s-button
                            type="button"
                            variant="tertiary"
                            onClick={() =>
                              setExpandedId(isExpanded ? null : enquiry.id)
                            }
                            aria-expanded={isExpanded}
                            aria-label={
                              isExpanded ? "Hide details" : "Show details"
                            }
                          >
                            <ExpandIcon
                              aria-hidden
                              className={styles.expandIcon}
                            />
                            <span className={styles.visuallyHidden}>
                              {isExpanded ? "Hide details" : "Show details"}
                            </span>
                          </s-button>
                        </div>
                      </div>
                      {isExpanded && (
                        <>
                          <s-divider />
                          <div className={styles.cardDetails}>
                            <div className={styles.detailMeta}>
                              <s-text tone="subdued">
                                Company: {enquiry.companyName ?? "—"} · Phone:{" "}
                                {enquiry.phoneNumber ?? "—"}
                              </s-text>
                              <s-text tone="subdued">
                                Received: {formatDateTime(enquiry.createdAt)} ·
                                Updated:{" "}
                                {formatDateTime(enquiry.statusUpdatedAt)}
                              </s-text>
                            </div>
                            <div className={styles.rowSummary}>
                              <s-text tone="subdued">
                                Request type: {enquiry.requestType} · Worked
                                with us before:{" "}
                                {formatWorkedWith(enquiry.workedWithBefore)}
                              </s-text>
                              <s-text>
                                {enquiry.message}
                                {enquiry.extraInformation
                                  ? ` ${enquiry.extraInformation}`
                                  : ""}
                              </s-text>
                              <s-text tone="subdued">
                                Quantity:{" "}
                                {typeof enquiry.quantity === "number"
                                  ? enquiry.quantity
                                  : "—"}{" "}
                                · Deadline: {enquiry.deliveryDeadline ?? "—"}
                              </s-text>
                            </div>
                            <div className={styles.detailGrid}>
                              <s-text tone="subdued">
                                Product title: {enquiry.productTitle ?? "—"} ·
                                Product reference:{" "}
                                {enquiry.productReference ?? "—"}
                              </s-text>
                              <s-text tone="subdued">
                                SKU / ID: {enquiry.productReference ?? "—"}
                              </s-text>
                            </div>
                            <div className={styles.detailBadges}>
                              <s-badge
                                tone={
                                  EMAIL_TONE[enquiry.emailNotificationState] ??
                                  "info"
                                }
                              >
                                {EMAIL_STATE_LABELS[
                                  enquiry.emailNotificationState
                                ] ?? enquiry.emailNotificationState}
                              </s-badge>
                              {enquiry.lastEmailAttemptAt ? (
                                <s-text tone="subdued">
                                  Last attempt:{" "}
                                  {formatDateTime(enquiry.lastEmailAttemptAt)}
                                </s-text>
                              ) : null}
                              {enquiry.lastEmailError ? (
                                <s-text tone="critical">
                                  Last error: {enquiry.lastEmailError}
                                </s-text>
                              ) : null}
                            </div>
                            <div>
                              <s-heading level={4}>Email history</s-heading>
                              <EmailLog logs={enquiry.emailLogs} />
                            </div>
                          </div>
                        </>
                      )}
                    </s-stack>
                  );
                })}
              </div>
              {totalPages > 1 && (
                <div className={styles.paginationBar}>
                  <s-text tone="subdued">
                    {`Showing ${rangeStart}-${rangeEnd} of ${totalMatching}`}
                  </s-text>
                  <div className={styles.paginationButtons}>
                    <s-button
                      type="button"
                      variant="tertiary"
                      disabled={!hasPreviousPage}
                      onClick={handlePreviousPage}
                    >
                      Previous
                    </s-button>
                    <s-text tone="subdued">{`Page ${page} of ${totalPages}`}</s-text>
                    <s-button
                      type="button"
                      variant="tertiary"
                      disabled={!hasNextPage}
                      onClick={handleNextPage}
                    >
                      Next
                    </s-button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className={styles.emptyState}>
              <s-text tone="subdued">
                No enquiries found for the current filters. Try adjusting your
                search.
              </s-text>
            </div>
          )}
        </section>
      </div>
    </s-page>
  );
}

function StatusForm({
  enquiry,
  fetcher,
  layout = "default",
}: {
  enquiry: LoaderData["enquiries"][number];
  fetcher: ReturnType<typeof useFetcher<ActionData>>;
  layout?: "default" | "compact";
}) {
  const isSubmitting = fetcher.state !== "idle";

  return (
    <fetcher.Form
      method="post"
      className={
        layout === "compact" ? styles.statusFormCompact : styles.statusForm
      }
    >
      <input type="hidden" name="intent" value="update-status" />
      <input type="hidden" name="enquiryId" value={enquiry.id} />
      <div className={styles.statusFormField}>
        <span>Workflow status</span>
        <select
          name="status"
          defaultValue={enquiry.status}
          disabled={isSubmitting}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.statusFormField}>
        <span>Internal notes</span>
        <textarea
          name="statusNotes"
          defaultValue={enquiry.statusNotes ?? ""}
          disabled={isSubmitting}
          placeholder="Add context or next steps for the team"
        />
      </div>
      <s-button
        type="submit"
        variant="primary"
        {...(isSubmitting ? { loading: true } : {})}
      >
        Update status
      </s-button>
    </fetcher.Form>
  );
}

function EmailLog({
  logs,
}: {
  logs: LoaderData["enquiries"][number]["emailLogs"];
}) {
  if (!logs.length) {
    return (
      <s-text tone="subdued">
        No email attempts recorded yet for this enquiry.
      </s-text>
    );
  }

  return (
    <ul className={styles.emailLogList}>
      {logs.map((log) => (
        <li key={log.id}>
          <s-stack gap="extra-tight">
            <s-text tone="subdued">
              {RECIPIENT_LABELS[log.recipientType] ?? log.recipientType} ·{" "}
              {formatDateTime(log.createdAt)}
            </s-text>
            <s-badge tone={log.status === "SUCCESS" ? "success" : "critical"}>
              {log.status === "SUCCESS" ? "Delivered" : "Failed"}
            </s-badge>
            <s-text>Recipient: {log.recipient}</s-text>
            {log.errorMessage && (
              <s-text tone="critical">Error: {log.errorMessage}</s-text>
            )}
            {log.metadata && (
              <pre className={styles.metadataPre}>
                {safeStringify(log.metadata)}
              </pre>
            )}
          </s-stack>
        </li>
      ))}
    </ul>
  );
}
