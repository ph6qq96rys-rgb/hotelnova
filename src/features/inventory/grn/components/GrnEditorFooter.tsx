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
  return (
    <footer className="grn-editor-footer">
      <span>{id ? `Draft saved: ${id}` : "Unsaved draft"}</span>
      <div>
        <button type="button" className="btn" disabled={busy} onClick={onCancel}>Cancel</button>
        <button type="button" className="btn" disabled={busy} onClick={onSave}>{saving ? "Saving..." : "Save Draft"}</button>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={onPost}>{posting ? "Posting..." : "Post Receipt"}</button>
      </div>
    </footer>
  );
}
