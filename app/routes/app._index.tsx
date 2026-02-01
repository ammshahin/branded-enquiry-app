import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function DashboardHome() {
  return (
    <s-page heading="Welcome to Branding HQ Enquiries">
      <s-stack gap="base">
        <s-card padding="loose" background="subdued">
          <s-stack gap="base">
            <s-heading level={2}>
              Manage enquiries without leaving Shopify
            </s-heading>
            <s-text tone="subdued">
              Capture storefront requests, track their journey, and keep the
              whole team aligned on next steps—all from one workspace.
            </s-text>
            <s-stack direction="inline" gap="base">
              <s-button href="/app/enquiries" variant="primary">
                Go to enquiries dashboard
              </s-button>
              <s-button
                href="/app/enquiries?status=AWAITING_CUSTOMER"
                variant="secondary"
              >
                Follow up waiting replies
              </s-button>
            </s-stack>
          </s-stack>
        </s-card>

        <s-grid columns="3" gap="base">
          <s-card padding="base">
            <s-stack gap="tight">
              <s-heading level={3}>See every submission</s-heading>
              <s-text tone="subdued">
                Review fresh enquiries, update workflow status, and leave
                internal notes so teammates know what happened last.
              </s-text>
            </s-stack>
          </s-card>
          <s-card padding="base">
            <s-stack gap="tight">
              <s-heading level={3}>Stay ahead of follow-ups</s-heading>
              <s-text tone="subdued">
                Filter by status to focus on quotes sent, awaiting customer
                responses, or completed work.
              </s-text>
            </s-stack>
          </s-card>
          <s-card padding="base">
            <s-stack gap="tight">
              <s-heading level={3}>Track outgoing emails</s-heading>
              <s-text tone="subdued">
                Each enquiry records staff & customer email attempts so you can
                confirm delivery and spot issues quickly.
              </s-text>
            </s-stack>
          </s-card>
        </s-grid>
      </s-stack>

      <s-section slot="aside" heading="Shortcuts">
        <s-stack gap="tight">
          <s-button href="/app/enquiries?status=NEW" variant="tertiary">
            View new enquiries
          </s-button>
          <s-button href="/app/enquiries?status=QUOTE_SENT" variant="tertiary">
            Monitor quotes sent
          </s-button>
          <s-button href="/app/enquiries?status=COMPLETED" variant="tertiary">
            Review completed requests
          </s-button>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
