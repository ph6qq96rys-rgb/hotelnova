import { CateringLayout } from "../components/CateringLayout";
// src/features/eventmanagment/sales/SalesWorkbenchPage.tsx
//
// Sales workbench: customers, inquiries, quotations and events as real
// documents with list -> detail navigation and working lifecycle actions.
//
// This replaces the read-only Sales tab, which listed records as cards and
// whose "New inquiry" button had no handler. Selection is held in the URL so a
// document can be linked and survives a refresh.

import { useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { BadgeDollarSign, CalendarCheck2, FileText, Users } from "lucide-react";
import { useAppScope } from "../../../app/useAppScope";
import { CustomersScreen } from "./CustomersScreen";
import { InquiriesScreen } from "./InquiriesScreen";
import { QuotationsScreen } from "./QuotationsScreen";
import { EventsScreen } from "./EventsScreen";
import { ErrorBanner } from "./ui";
import "./sales.css";

type DocKey = "customers" | "inquiries" | "quotations" | "events";

const tabs: Array<{ key: DocKey; label: string; icon: ReactNode; caption: string }> = [
  { key: "customers", label: "Customers", icon: <Users size={16} />, caption: "Accounts and contacts" },
  { key: "inquiries", label: "Inquiries", icon: <FileText size={16} />, caption: "Incoming enquiries" },
  { key: "quotations", label: "Quotations", icon: <BadgeDollarSign size={16} />, caption: "Pricing and approval" },
  { key: "events", label: "Events", icon: <CalendarCheck2 size={16} />, caption: "Confirmed and settled" },
];

function isDocKey(value: string | null): value is DocKey {
  return value === "customers" || value === "inquiries" || value === "quotations" || value === "events";
}

export default function SalesWorkbenchPage() {
  const { companyId, branchId } = useAppScope();
  const [params, setParams] = useSearchParams();

  const doc: DocKey = isDocKey(params.get("doc")) ? (params.get("doc") as DocKey) : "inquiries";
  const selectedId = params.get("id");

  // Cross-document handoffs: raise a quotation from an inquiry, confirm an
  // event from an accepted quotation.
  const [draftForInquiryId, setDraftForInquiryId] = useState<string | null>(null);
  const [confirmQuotationId, setConfirmQuotationId] = useState<string | null>(null);

  const activeTab = useMemo(() => tabs.find((tab) => tab.key === doc) ?? tabs[1], [doc]);

  function go(next: DocKey, id: string | null) {
    const updated = new URLSearchParams(params);
    updated.set("doc", next);
    updated.delete("new");
    if (id) updated.set("id", id);
    else updated.delete("id");
    setParams(updated, { replace: false });
  }

  const select = (id: string | null) => go(doc, id);

  return (
    <CateringLayout><main className="cat-shell">
      <header className="cat-shell__head">
        <div>
          <span className="cat-eyebrow">Event Management / Sales</span>
          <h1>{activeTab.label}</h1>
          <p>{activeTab.caption}</p>
        </div>
      </header>

      <nav aria-label="Sales documents" className="cat-tabs">
        {tabs.map((tab) => (
          <button
            aria-current={tab.key === doc ? "page" : undefined}
            className={`cat-tab${tab.key === doc ? " is-active" : ""}`}
            key={tab.key}
            onClick={() => go(tab.key, null)}
            type="button"
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>

      {!companyId ? (
        <ErrorBanner message="Select a company workspace to work with catering sales documents." />
      ) : (
        <section className="cat-shell__body">
          {doc === "customers" ? (
            <CustomersScreen companyId={companyId} onSelect={select} selectedId={selectedId} />
          ) : null}

          {doc === "inquiries" ? (
            <InquiriesScreen
              startNew={params.get("new") === "1"}
              onNewConsumed={() => { const next = new URLSearchParams(params); next.delete("new"); setParams(next, { replace: true }); }}
              branchId={branchId}
              companyId={companyId}
              onRaiseQuotation={(inquiryId) => {
                setDraftForInquiryId(inquiryId);
                go("quotations", null);
              }}
              onSelect={select}
              selectedId={selectedId}
            />
          ) : null}

          {doc === "quotations" ? (
            <QuotationsScreen
              branchId={branchId}
              companyId={companyId}
              draftForInquiryId={draftForInquiryId}
              onConfirmEvent={(quotationId) => {
                setConfirmQuotationId(quotationId);
                go("events", null);
              }}
              onDraftConsumed={() => setDraftForInquiryId(null)}
              onSelect={select}
              selectedId={selectedId}
            />
          ) : null}

          {doc === "events" ? (
            <EventsScreen
              branchId={branchId}
              companyId={companyId}
              confirmQuotationId={confirmQuotationId}
              onConfirmConsumed={() => setConfirmQuotationId(null)}
              onSelect={select}
              selectedId={selectedId}
            />
          ) : null}
        </section>
      )}
    </main></CateringLayout>
  );
}
