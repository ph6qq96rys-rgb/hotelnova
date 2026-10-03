import { useI18n } from "../../../../i18n";


const grnFooterAmharicPhrases: Record<string, string> = {
  "Draft saved": "ድራፍት ተቀምጧል",
  "Unsaved draft": "ያልተቀመጠ ድራፍት",
  "Cancel": "ሰርዝ",
  "Saving...": "በማስቀመጥ ላይ...",
  "Save Draft": "ድራፍት አስቀምጥ",
  "Posting...": "በመፖሰት ላይ...",
  "Post Receipt": "መቀበያ ፖስት አድርግ",
};

function grnFooterText(language: string, text: string): string {
  return language === "am" ? grnFooterAmharicPhrases[text] ?? text : text;
}
type Props = {
  id?: string;
  busy: boolean;
  saving: boolean;
  posting: boolean;
  onCancel: () => void;
  onSave: () => void;
  onPost: () => void;
};

export default function GrnEditorFooter({ id, busy, saving, posting, onCancel, onSave, onPost }: Props) {
  const { language } = useI18n();
  const tx = (text: string) => grnFooterText(language, text);

  return (
    <footer className="grn-editor-footer">
      <span>{id ? `${tx("Draft saved")}: ${id}` : tx("Unsaved draft")}</span>
      <div>
        <button type="button" className="btn" disabled={busy} onClick={onCancel}>{tx("Cancel")}</button>
        <button type="button" className="btn" disabled={busy} onClick={onSave}>{saving ? tx("Saving...") : tx("Save Draft")}</button>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={onPost}>{posting ? tx("Posting...") : tx("Post Receipt")}</button>
      </div>
    </footer>
  );
}
