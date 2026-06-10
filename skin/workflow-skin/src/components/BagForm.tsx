import type { Bag } from "../lib/bags";

const fields: Array<{ key: keyof Bag; label: string; type?: string }> = [
  { key: "roaster", label: "Roaster" },
  { key: "bean", label: "Bean" },
  { key: "country", label: "Country" },
  { key: "region", label: "Region" },
  { key: "process", label: "Process" },
  { key: "roastDate", label: "Roast Date", type: "date" },
  { key: "roastLevel", label: "Roast Level" }
];

export function BagForm({
  value,
  onChange,
  onCancel,
  onSave
}: {
  value: Bag;
  onChange: (value: Bag) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <form
      className="bag-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <div className="form-header">
        <div>
          <span className="eyebrow">New Bean</span>
          <h2>Add a bag</h2>
        </div>
        <div className="form-actions">
          <button type="button" className="ghost-button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="primary-button">
            Save
          </button>
        </div>
      </div>
      <div className="form-grid">
        {fields.map((field) => (
          <label key={field.key}>
            <span>{field.label}</span>
            <input
              type={field.type ?? "text"}
              value={(value[field.key] as string | undefined) ?? ""}
              onChange={(event) => onChange({ ...value, [field.key]: event.target.value })}
            />
          </label>
        ))}
      </div>
      <label className="notes-field">
        <span>Notes</span>
        <textarea value={value.notes ?? ""} onChange={(event) => onChange({ ...value, notes: event.target.value })} />
      </label>
    </form>
  );
}
