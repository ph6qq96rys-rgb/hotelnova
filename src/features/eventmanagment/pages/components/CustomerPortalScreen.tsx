import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { formatCurrency } from "../../../../shared/currency/currencyFormat";
import { Impact, Input, PrototypeAction, Select } from "./common";

export default function PortalScreen({ onPrototypeAction }: { onPrototypeAction: (action: string) => void }) {
  const portalSteps = [
    ["Inquiry", "Submitted and tracked", "Reference INQ-2026-0918"],
    ["Proposal", "Ready for review", "Premium dinner package"],
    ["Quotation", "Current valid quote", "Accept or reject Q-2026-044 v3"],
    ["Change order", "One approved", "CO-118 stage extension"],
    ["Payment", "Deposit partially paid", "ETB 2,458 remaining"],
    ["Documents", "Authorized downloads", "Proposal, quotation, receipts, terms"],
  ];

  return (
    <section className="cem-screen">
      <div className="cem-portal-preview">
        <div>
          <p className="cem-eyebrow">Customer portal</p>
          <h2>Grand Horizon Events</h2>
          <p>Secure proposal, quotation, terms, payment, document, coordinator messaging, and post-event feedback workspace for Ambassador Foundation.</p>
          <div className="cem-portal-actions">
            <button className="cem-button cem-button--primary" type="button">Accept quotation</button>
            <button className="cem-button cem-button--secondary" type="button">Reject quotation</button>
          </div>
        </div>
        <section className="cem-panel cem-portal-brand-card">
          <strong>HotelNova Downtown</strong>
          <span>Brand colors, Birr currency, company contacts, cancellation terms, and secure link policy applied.</span>
          <small>Secure link expires Aug 19, 2026 and can be revoked by the coordinator.</small>
        </section>
      </div>
      <CustomerServiceRequestPanel onPrototypeAction={onPrototypeAction} />
      <section className="cem-portal-workspace">
        <section className="cem-panel">
          <h3>Proposal summary</h3>
          <Impact label="Event" value="Fundraising dinner" />
          <Impact label="Date" value="Sep 18, 2026" />
          <Impact label="Guests" value="180" />
          <Impact label="Deposit" value="ETB 7,458 due" />
        </section>
        <section className="cem-panel">
          <h3>Portal activity</h3>
          <div className="cem-stack">
            {portalSteps.map(([title, status, detail]) => (
              <article className="cem-live-card" key={title}>
                <strong>{title}</strong>
                <span>{status}</span>
                <small>{detail}</small>
              </article>
            ))}
          </div>
        </section>
        <section className="cem-panel">
          <h3>Coordinator communication</h3>
          <div className="cem-stack">
            <Impact label="Assigned coordinator" value="Hana Bekele" />
            <Impact label="Last message" value="Menu option question answered today 09:20" />
            <Input label="Message" value="Please confirm the vegetarian alternate count." />
            <button className="cem-button cem-button--secondary" type="button">Send message</button>
          </div>
        </section>
        <section className="cem-panel">
          <h3>Customer-safe boundary</h3>
          <div className="cem-internal-margin">
            <span>Data isolation</span>
            <strong>No internal costs, margins, approvals, inventory, notes, or employee-only details</strong>
            <small>Customer links are tenant/company scoped, revocable, and cannot expose another customer event.</small>
          </div>
          <button className="cem-button cem-button--secondary" type="button">Submit post-event feedback</button>
        </section>
      </section>
      <CustomerFeedbackPanel onPrototypeAction={onPrototypeAction} />
    </section>
  );
}


function CustomerServiceRequestPanel({ onPrototypeAction }: { onPrototypeAction: (action: string) => void }) {
  const [packageName, setPackageName] = useState("Gold Package");
  const [guestCount, setGuestCount] = useState(500);
  const [submitted, setSubmitted] = useState(false);
  const packages = [
    { name: "Bronze Package", price: 650, detail: "Buffet basics, water service, standard staffing" },
    { name: "Gold Package", price: 950, detail: "Premium buffet, dessert, coffee station, standard decor" },
    { name: "Premium Package", price: 1350, detail: "Plated service, premium proteins, dessert station, VIP setup" },
    { name: "Custom", price: 0, detail: "Build a menu from preferred dishes and special service requirements" },
  ];
  const menuItems = [
    "Beef tibs station",
    "Vegetarian lentil roulade",
    "Injera and bread service",
    "Seasonal salad",
    "Dessert miniatures",
    "Coffee and tea station",
  ];
  const selectedPackage = packages.find((item) => item.name === packageName) ?? packages[1];
  const estimatedTotal = selectedPackage.price * guestCount;

  return (
    <section className="cem-panel cem-customer-request">
      <div className="cem-panel-head">
        <div>
          <p className="cem-eyebrow">Submit catering/event service</p>
          <h3>Tell us about your event and customize the menu</h3>
          <p>Customers can request a service, select a package, adjust menu preferences, and submit notes without seeing internal ERP controls.</p>
        </div>
        <span className="cem-filter-chip">{submitted ? "Submitted" : "Draft request"}</span>
      </div>

      {submitted ? (
        <div className="cem-success-state" role="status">
          <CheckCircle2 size={28} />
          <div>
            <h3>Request submitted</h3>
            <p>Reference CUS-REQ-2026-0912 was sent to the catering team. A coordinator will prepare the quotation and confirm availability.</p>
          </div>
        </div>
      ) : null}

      <div className="cem-customer-request__grid">
        <section className="cem-customer-request__form">
          <div className="cem-form-grid">
            <Input label="Full name *" value="Selam Tesfaye" />
            <Input label="Email *" value="selam@example.com" type="email" />
            <Input label="Phone *" value="+251 911 000 000" />
            <Input label="Event name *" value="Wedding reception" />
            <Input label="Event date *" value="2026-09-12" type="date" />
            <Input label="Preferred venue" value="Millennium Hall" />
            <label className="cem-field">
              <span>Guest count *</span>
              <input type="number" value={guestCount} onChange={(event) => setGuestCount(Number(event.target.value || 0))} />
            </label>
            <Select label="Service style" options={["Buffet", "Plated", "Cocktail", "Conference service"]} />
            <label className="cem-field wide">
              <span>Dietary, allergen, cultural, or accessibility notes</span>
              <textarea defaultValue="Vegetarian options, nut-free dessert, VIP table, and coffee ceremony." />
            </label>
          </div>
        </section>

        <section className="cem-customer-package-picker">
          <h3>Choose package</h3>
          <div className="cem-customer-package-list">
            {packages.map((item) => (
              <button
                className={`cem-customer-package${packageName === item.name ? " is-selected" : ""}`}
                type="button"
                key={item.name}
                onClick={() => setPackageName(item.name)}
              >
                <strong>{item.name}</strong>
                <span>{item.detail}</span>
                <small>{item.price ? `ETB ${item.price.toLocaleString()} per guest` : "Coordinator priced after review"}</small>
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="cem-customer-menu-customizer">
        <div>
          <h3>Customize menu/package</h3>
          <p>Select preferred menu items, add service options, and leave substitutions for coordinator review.</p>
        </div>
        <div className="cem-customer-menu-options">
          {menuItems.map((item, index) => (
            <label className="cem-checkbox-row" key={item}>
              <input type="checkbox" defaultChecked={index < 4 || packageName !== "Bronze Package"} />
              <span>{item}</span>
            </label>
          ))}
        </div>
        <div className="cem-form-grid">
          <Select label="Add-on service" options={["Coffee ceremony", "Live grill station", "Dessert station", "None"]} />
          <Select label="Staffing preference" options={["Standard staffing", "Extra waiters", "VIP service team"]} />
          <Select label="Equipment need" options={["Standard setup", "Stage and projector", "Outdoor setup", "Custom"]} />
          <label className="cem-field wide">
            <span>Menu customization notes</span>
            <textarea defaultValue="Replace chicken dish with beef tibs. Add more vegetarian portions and a premium dessert table." />
          </label>
        </div>
      </div>

      <section className="cem-review-panel">
        <h3>Customer request summary</h3>
        <div className="cem-review-grid">
          <Impact label="Package" value={selectedPackage.name} />
          <Impact label="Guests" value={guestCount.toLocaleString()} />
          <Impact label="Estimated total" value={selectedPackage.price ? formatCurrency(estimatedTotal) : "Pending coordinator pricing"} />
          <Impact label="Next step" value="Coordinator confirms availability and prepares quotation" />
        </div>
        <div className="cem-form-actions">
          <button className="cem-button cem-button--secondary" type="button">Save draft</button>
          <button className="cem-button cem-button--primary" type="button" onClick={() => { setSubmitted(true); onPrototypeAction("Submit customer catering request"); }}>
            Submit request
          </button>
        </div>
      </section>
    </section>
  );
}

function CustomerFeedbackPanel({ onPrototypeAction }: { onPrototypeAction: (action: string) => void }) {
  const ratings = ["Food", "Service", "Venue", "Timeliness", "Overall satisfaction"];

  return (
    <section className="cem-panel cem-feedback-panel">
      <div className="cem-panel-head">
        <div>
          <h3>Post-event feedback</h3>
          <p>Ambassador Foundation can submit feedback only for the Grand Horizon Events record linked to this secure portal.</p>
        </div>
        <span className="cem-filter-chip">Submission saved</span>
      </div>
      <div className="cem-feedback-context">
        <Impact label="Company" value="HotelNova Downtown" />
        <Impact label="Event" value="Grand Horizon Events" />
        <Impact label="Customer" value="Ambassador Foundation" />
        <Impact label="Feedback link" value="Tenant and event scoped" />
      </div>
      <div className="cem-rating-grid">
        {ratings.map((label) => (
          <label className="cem-rating-field" key={label}>
            <span>{label} *</span>
            <select defaultValue={label === "Timeliness" ? "2" : "4"} aria-label={`${label} rating`}>
              {["5", "4", "3", "2", "1"].map((score) => <option key={score}>{score}</option>)}
            </select>
          </label>
        ))}
      </div>
      <div className="cem-form-grid">
        <label className="cem-field wide">
          <span>Comments *</span>
          <textarea defaultValue="Food and service were excellent. Setup was late, which delayed guest seating." />
        </label>
        <label className="cem-field wide">
          <span>Areas needing improvement</span>
          <textarea defaultValue="Please improve setup timing and arrival communication." />
        </label>
      </div>
      <div className="cem-feedback-footer">
        <label className="cem-checkbox-row">
          <input type="checkbox" />
          <span>Send me marketing updates about future event offers</span>
        </label>
        <div className="cem-approval-strip">
          <strong>Service recovery workflow</strong>
          <span>Low timeliness rating triggers coordinator follow-up and manager review after submission confirmation.</span>
        </div>
        <PrototypeAction variant="primary" onRun={() => onPrototypeAction("Submit feedback")}>Submit feedback</PrototypeAction>
      </div>
    </section>
  );
}
