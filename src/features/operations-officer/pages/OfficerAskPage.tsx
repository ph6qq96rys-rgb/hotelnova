import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Send } from "lucide-react";

import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { StateMessage } from "../../../components/ui/Feedback";
import { Select } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { useHasPermission } from "../../../auth/usePermissions";
import { apiError, Field } from "../../finance/components/glShared";
import { officerApi, type OfficerMessage } from "../api/officerApi";
import { BranchSelect, EvidenceList, OfficerNav, Section, useOfficerRefs, when } from "../components/officerShared";

const EXAMPLES = ["What needs my attention today?", "Which targets are at risk this week?", "Which deliveries are late?", "What instructions are overdue?"];

export default function OfficerAskPage() {
  const { companyId = "" } = useParams<{ companyId: string }>();
  const canSeeCompany = useHasPermission("aiops.view.company");
  const { refs, loaded } = useOfficerRefs(companyId);
  const [branchId, setBranchId] = useState("");
  const [language, setLanguage] = useState<"en" | "am">("en");
  const [question, setQuestion] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<OfficerMessage[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (loaded && !canSeeCompany && !branchId && refs.branches.length > 0) setBranchId(refs.branches[0].id); }, [loaded, canSeeCompany, branchId, refs.branches]);

  async function ask(text: string) {
    const q = text.trim();
    if (!q) return;
    setBusy(true); setError(null);
    try {
      const r = await officerApi.ask(companyId, { question: q, branchId: branchId || null, threadId, language });
      setThreadId(r.threadId);
      setMessages((m) => [...m, r.question, r.answer]);
      setNotes(r.notes);
      setQuestion("");
    } catch (e) { setError(apiError(e, "The officer could not answer.")); }
    finally { setBusy(false); }
  }

  function newConversation() { setThreadId(null); setMessages([]); setNotes([]); setError(null); }

  return (
    <div className="gl-page">
      <PageHeader title="Ask the Officer"
        subtitle="Questions about your branches in plain language. Answers use only what you are allowed to see, name their sources and say how current the data is. Asking never changes anything."
        actions={messages.length > 0 ? <Button variant="outline" onClick={newConversation} disabled={busy}>New conversation</Button> : null} />
      <OfficerNav />
      <div className="gl-toolbar">
        <Field label="About"><BranchSelect value={branchId} onChange={(v) => { setBranchId(v); newConversation(); }} branches={refs.branches} allLabel={canSeeCompany ? "The whole company" : undefined} /></Field>
        <Field label="Answer in">
          <Select value={language} onChange={(e) => setLanguage(e.target.value as "en" | "am")}>
            <option value="en">English</option>
            <option value="am">አማርኛ (Amharic)</option>
          </Select>
        </Field>
      </div>

      <Section title="Conversation">
        {messages.length === 0 ? (
          <div className="gl-toolbar">
            {EXAMPLES.map((e) => <Button key={e} size="sm" variant="outline" disabled={busy} onClick={() => void ask(e)}>{e}</Button>)}
          </div>
        ) : (
          <div className="oo-thread" aria-live="polite">
            {messages.map((m) => (
              <div key={m.id} className={m.role === "User" ? "oo-msg is-user" : "oo-msg"}>
                <div className="oo-basis">{m.role === "User" ? "You" : "Operations Officer"} · {when(m.atUtc)}</div>
                <p>{m.text}</p>
                {m.role !== "User" ? <>
                  <div className="oo-meta">
                    <span>Data as of {when(m.dataAsOfUtc)}</span>
                    <span>{m.modelVersion ? `Written by ${m.modelVersion} from the facts` : "Facts listed directly, no language model"}</span>
                  </div>
                  <EvidenceList items={m.sources} empty="No specific records." />
                </> : null}
              </div>
            ))}
          </div>
        )}
        {notes.map((n) => <p key={n} className="gl-muted">{n}</p>)}
        {error ? <StateMessage tone="error">{error}</StateMessage> : null}
        <form className="oo-ask" onSubmit={(e) => { e.preventDefault(); void ask(question); }}>
          <Field label="Your question" wide>
            <Textarea rows={2} value={question} maxLength={1000} onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(question); } }} />
          </Field>
          <Button type="submit" disabled={busy || !question.trim() || (!branchId && !canSeeCompany)}><Send size={16} /> Ask</Button>
        </form>
      </Section>
    </div>
  );
}
