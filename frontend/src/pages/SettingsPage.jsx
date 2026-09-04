import { useNavigate } from "react-router-dom";

import { api } from "@/api/client";
import { useApi } from "@/hooks/useApi";
import { Button, Eyebrow, Money, PageHeader, StatusBadge } from "@/ui";

function Group({ title, hint, children }) {
  return (
    <section className="mb-9">
      <div className="mb-2 flex items-center gap-3">
        <Eyebrow>{title}</Eyebrow>
        <span className="h-px flex-1 bg-surface-line" />
        {hint ? <span className="text-2xs text-ink-faint">{hint}</span> : null}
      </div>
      <div className="divide-y divide-surface-line border-t border-surface-line">{children}</div>
    </section>
  );
}

function Row({ label, hint, children }) {
  return (
    <div className="flex items-center justify-between gap-6 py-3.5">
      <div className="min-w-0">
        <p className="text-sm text-ink-primary">{label}</p>
        {hint ? <p className="mt-0.5 text-xs text-ink-muted">{hint}</p> : null}
      </div>
      <div className="shrink-0 text-right">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { data } = useApi(() => api.getConfig(), []);
  const email = localStorage.getItem("duenorth_email");
  const bank = ((data?.bank_rate ?? 0.055) * 100).toFixed(2);
  const stat = ((data?.statutory_rate ?? 0.165) * 100).toFixed(2);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Settings"
        subtitle="Configuration DueNorth reads at runtime. Statutory values are sourced from the RBI, not editable here."
      />

      <Group title="Statutory rate" hint={`as of ${data?.as_of || "2026-08-05"}`}>
        <Row label="RBI Bank Rate" hint={data?.source || "RBI Monetary Policy Committee"}>
          <span className="font-mono text-sm tnum text-ink-secondary">{bank}%</span>
        </Row>
        <Row label="Section 16 statutory rate" hint="3× Bank Rate, compounded monthly">
          <span className="font-mono text-sm tnum text-jade-300">{stat}%</span>
        </Row>
      </Group>

      <Group title="Automation policy">
        <Row label="Human-in-the-loop threshold" hint="Invoices above this always route to review">
          <Money amount={1000000} size="sm" />
        </Row>
        <Row label="Collection mode" hint="Live Razorpay calls are gated server-side">
          <StatusBadge tone="steel" label="Dry run" />
        </Row>
        <Row label="Automatic MSEFC filing" hint="DueNorth only ever prepares drafts — you file">
          <StatusBadge tone="jade" label="Never" dot={false} />
        </Row>
        <Row label="Disputed invoices" hint="Statutory pressure is always paused">
          <StatusBadge tone="amber" label="Held for review" />
        </Row>
      </Group>

      <Group title="Notifications">
        <Row label="WhatsApp payment alerts" hint="Set WA_TOKEN / WA_PHONE_ID / WA_RECIPIENT to enable">
          <StatusBadge tone="neutral" label="Not configured" dot={false} />
        </Row>
        <Row label="Error monitoring" hint="Set SENTRY_DSN to enable">
          <StatusBadge tone="neutral" label="Not configured" dot={false} />
        </Row>
      </Group>

      <Group title="Account">
        <Row label="Signed in as">
          <span className="text-sm text-ink-secondary">{email}</span>
        </Row>
        <Row label="Session">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              localStorage.removeItem("duenorth_email");
              navigate("/login");
            }}
          >
            Sign out
          </Button>
        </Row>
      </Group>
    </div>
  );
}
