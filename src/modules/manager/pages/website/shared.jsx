// src/modules/manager/pages/website/shared.jsx
//
// Small building blocks shared by every Website Management tab — mirrors
// the inline-style Modal/InputField pattern already used in
// SupportStaffPage.jsx etc., just factored out once since this feature
// has five tabs that all need the same pieces instead of duplicating
// them five times.
import { useState, useRef, useEffect } from "react";

export function Modal({ title, onClose, children, maxWidth = "560px" }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)",
        backdropFilter: "blur(3px)", zIndex: 1000, display: "flex",
        alignItems: "center", justifyContent: "center", padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff", borderRadius: "16px", width: "100%", maxWidth,
          maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#94A3B8", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: "24px" }}>{children}</div>
      </div>
    </div>
  );
}

export function InputField({ label, required, hint, children }) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "5px" }}>
        {label}{required && <span style={{ color: "#EF4444" }}> *</span>}
      </label>
      {children}
      {hint && <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#94A3B8" }}>{hint}</p>}
    </div>
  );
}

export const inputStyle = {
  width: "100%", padding: "9px 12px", borderRadius: "8px",
  border: "1px solid #E2E8F0", fontSize: "13px", color: "#1E293B",
  outline: "none", boxSizing: "border-box", background: "#F8FAFC",
};

export const textareaStyle = { ...inputStyle, minHeight: "80px", resize: "vertical", fontFamily: "inherit" };

export const btnPrimary = (accent = "#EA580C") => ({
  padding: "9px 18px", borderRadius: "8px", border: "none",
  background: accent, color: "#fff", fontSize: "13px", fontWeight: 600,
  cursor: "pointer",
});

export const btnSecondary = {
  padding: "9px 18px", borderRadius: "8px", border: "1px solid #E2E8F0",
  background: "#fff", color: "#475569", fontSize: "13px", fontWeight: 600,
  cursor: "pointer",
};

export const btnDanger = {
  padding: "7px 14px", borderRadius: "7px", border: "1px solid #FECACA",
  background: "#FEF2F2", color: "#B91C1C", fontSize: "12px", fontWeight: 600,
  cursor: "pointer",
};

export const btnGhost = {
  padding: "6px 10px", borderRadius: "7px", border: "1px solid #E2E8F0",
  background: "#fff", color: "#475569", fontSize: "12px", fontWeight: 600,
  cursor: "pointer",
};

export function FieldError({ error }) {
  if (!error) return null;
  return <p style={{ margin: "4px 0 0", fontSize: "11.5px", color: "#DC2626" }}>{error}</p>;
}

export function FormBanner({ message }) {
  if (!message) return null;
  return (
    <div style={{ padding: "10px 14px", borderRadius: "8px", background: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C", fontSize: "12.5px", marginBottom: "14px" }}>
      {message}
    </div>
  );
}

export function EmptyState({ text }) {
  return (
    <div style={{ padding: "48px 20px", textAlign: "center", color: "#94A3B8", fontSize: "13px" }}>
      {text}
    </div>
  );
}

export function LoadingState() {
  return (
    <div style={{ padding: "48px 20px", textAlign: "center", color: "#94A3B8", fontSize: "13px" }}>
      Loading…
    </div>
  );
}

export function StatusPill({ active, activeLabel = "Active", inactiveLabel = "Inactive" }) {
  return (
    <span style={{
      padding: "2px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: 600,
      background: active ? "#F0FDF4" : "#F8FAFC",
      color:      active ? "#16A34A" : "#94A3B8",
      border: `1px solid ${active ? "#BBF7D0" : "#E2E8F0"}`,
    }}>
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}

export function FeaturedPill({ featured }) {
  if (!featured) return null;
  return (
    <span style={{ padding: "2px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: 600, background: "#FFFBEB", color: "#D97706", border: "1px solid #FDE68A" }}>
      ★ Featured
    </span>
  );
}

// There's no activate/deactivate-style dedicated endpoint for
// is_featured — callers PATCH it directly. This button lives in the
// same action-column slot as the Activate/Deactivate button so it's
// always visible (unlike FeaturedPill, which only renders when already
// featured and isn't clickable).
export function FeaturedToggleButton({ featured, onClick, busy }) {
  return (
    <button
      style={{
        ...btnGhost,
        opacity: busy ? 0.6 : 1,
        color: featured ? "#D97706" : btnGhost.color,
        borderColor: featured ? "#FDE68A" : btnGhost.border.split(" ").pop(),
        background: featured ? "#FFFBEB" : btnGhost.background,
      }}
      onClick={onClick}
      disabled={busy}
      title={featured ? "Remove from featured" : "Mark as featured"}
    >
      {featured ? "★ Unfeature" : "☆ Feature"}
    </button>
  );
}

// Simple up/down reordering (no drag-and-drop dependency) — call
// onReorder(newIdsInOrder) once the user moves a row, and the parent
// hits the backend's reorder/ endpoint with that full list.
export function ReorderButtons({ index, total, onMoveUp, onMoveDown }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
      <button
        onClick={onMoveUp}
        disabled={index === 0}
        title="Move up"
        style={{ ...btnGhost, padding: "2px 6px", opacity: index === 0 ? 0.35 : 1, cursor: index === 0 ? "not-allowed" : "pointer" }}
      >▲</button>
      <button
        onClick={onMoveDown}
        disabled={index === total - 1}
        title="Move down"
        style={{ ...btnGhost, padding: "2px 6px", opacity: index === total - 1 ? 0.35 : 1, cursor: index === total - 1 ? "not-allowed" : "pointer" }}
      >▼</button>
    </div>
  );
}

// A proper photo upload control — the raw <input type="file"> has no
// styling of its own, so left bare it renders squeezed against
// surrounding labels/hints with no visible affordance. This wraps it in
// a hidden input triggered by a styled button, shows a live preview
// (existing server photo, or the newly-picked file before it's even
// uploaded), and adds a real "Remove" action.
//
// Controlled fully by the parent form's state:
//   currentUrl  — absolute URL of the existing photo (editing), or null
//   file        — a newly-picked File not yet saved, or null
//   removed     — true if the user clicked Remove on an existing photo
//                 (parent should send remove_photo: true to the backend)
//   onSelect(file) — called with the picked File
//   onRemove()     — called when Remove is clicked
export function PhotoUploadField({ currentUrl, file, removed, onSelect, onRemove, hint }) {
  const inputRef = useRef(null);
  const [objectUrl, setObjectUrl] = useState(null);

  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const previewUrl = objectUrl || (!removed ? currentUrl : null);
  const hasPhoto = !!previewUrl;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
      <div style={{
        width: "64px", height: "64px", borderRadius: "10px", overflow: "hidden", flexShrink: 0,
        background: "#F1F5F9", border: "1px solid #E2E8F0",
        display: "flex", alignItems: "center", justifyContent: "center", color: "#CBD5E1",
      }}>
        {hasPhoto ? (
          <img src={previewUrl} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        )}
      </div>

      <div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button type="button" style={btnGhost} onClick={() => inputRef.current?.click()}>
            {hasPhoto ? "Change Photo" : "Choose Photo"}
          </button>
          {hasPhoto && (
            <button
              type="button"
              style={btnDanger}
              onClick={() => {
                if (inputRef.current) inputRef.current.value = "";
                onRemove();
              }}
            >
              Remove
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onSelect(f);
          }}
        />
        {hint && <p style={{ margin: "6px 0 0", fontSize: "11px", color: "#94A3B8" }}>{hint}</p>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, message, confirmLabel = "Delete", onConfirm, onCancel, danger = true }) {
  const [busy, setBusy] = useState(false);
  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={title} onClose={onCancel} maxWidth="420px">
      <p style={{ margin: "0 0 20px", fontSize: "13.5px", color: "#475569", lineHeight: 1.5 }}>{message}</p>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
        <button style={btnSecondary} onClick={onCancel} disabled={busy}>Cancel</button>
        <button
          style={{ ...btnPrimary(danger ? "#DC2626" : "#EA580C"), opacity: busy ? 0.7 : 1 }}
          onClick={handleConfirm}
          disabled={busy}
        >
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

// Small helper to move an item within an array, returning the new
// ordered array of ids — used by every tab's up/down reorder handlers.
export function moveItem(items, fromIndex, toIndex) {
  const arr = [...items];
  const [moved] = arr.splice(fromIndex, 1);
  arr.splice(toIndex, 0, moved);
  return arr;
}

// Extracts a human-readable message from a DRF error response —
// field errors ({field: [msg, ...]}), {error: "..."}, or a plain string.
export function extractApiError(err, fallback = "Something went wrong. Please try again.") {
  const data = err?.response?.data;
  if (!data) return fallback;
  if (typeof data === "string") return data;
  if (data.error) return Array.isArray(data.error) ? data.error.join(" ") : data.error;
  if (data.detail) return data.detail;
  const firstKey = Object.keys(data)[0];
  if (firstKey && Array.isArray(data[firstKey])) {
    return `${firstKey.replace(/_/g, " ")}: ${data[firstKey][0]}`;
  }
  return fallback;
}

// A simple add/remove/reorder editor for a plain list of strings — used
// for area_of_expertise / education / awards / languages_known style
// fields. `value` is always a plain string array; `onChange` receives
// the new array. Reorder buttons reuse the same ReorderButtons +
// moveItem pattern as the Instagram/YouTube tabs' drag-free reordering,
// for visual consistency rather than inventing a new interaction.
export function StringListField({ value, onChange, placeholder = "Add an item…" }) {
  const [draft, setDraft] = useState("");
  const items = Array.isArray(value) ? value : [];

  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onChange([...items, trimmed]);
    setDraft("");
  };

  const remove = (index) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const move = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= items.length) return;
    onChange(moveItem(items, index, newIndex));
  };

  return (
    <div>
      {items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "8px" }}>
          {items.map((item, i) => (
            <div
              key={i}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "7px 10px", borderRadius: "7px", background: "#F8FAFC",
                border: "1px solid #F1F5F9", fontSize: "12.5px", color: "#374151",
              }}
            >
              {items.length > 1 && (
                <ReorderButtons index={i} total={items.length} onMoveUp={() => move(i, -1)} onMoveDown={() => move(i, 1)} />
              )}
              <span style={{ flex: 1, minWidth: 0, wordBreak: "break-word" }}>{item}</span>
              <button
                type="button"
                onClick={() => remove(i)}
                style={{ background: "none", border: "none", color: "#B91C1C", cursor: "pointer", fontSize: "13px", fontWeight: 700, padding: "0 0 0 10px", flexShrink: 0 }}
                aria-label={`Remove ${item}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: "8px" }}>
        <input
          style={{ ...inputStyle, flex: 1 }}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
        />
        <button type="button" style={btnGhost} onClick={commit}>Add</button>
      </div>
    </div>
  );
}

// Converts a 0-based index into a spreadsheet-style letter label:
// 0→a, 1→b, …, 25→z, 26→aa, 27→ab, … Used to auto-number sub-headings
// (a., b., c., …) purely at render time — never stored, so reordering a
// sub-heading always keeps the lettering sequential and correct.
export function letterLabel(index) {
  let n = index + 1;
  let label = "";
  while (n > 0) {
    n -= 1;
    label = String.fromCharCode(97 + (n % 26)) + label;
    n = Math.floor(n / 26);
  }
  return label;
}

// Editor for a nested "alphabet list" — the auto-lettered (a., b., c., …
// computed at render time from position, never stored) entries that can
// live underneath a sub-heading as an alternative to a plain bullet
// list. Each lettered entry has its own optional short description
// paragraph AND its own optional bullet list, both usable together on
// the same entry. `value` is always a plain array of
// {description, items} objects; `onChange` receives the new array.
export function AlphabetListField({ value, onChange }) {
  const entries = Array.isArray(value) ? value : [];

  const addEntry = () => {
    onChange([...entries, { description: "", items: [] }]);
  };
  const updateDescription = (index, description) => {
    onChange(entries.map((e, i) => (i === index ? { ...e, description } : e)));
  };
  const updateItems = (index, items) => {
    onChange(entries.map((e, i) => (i === index ? { ...e, items } : e)));
  };
  const removeEntry = (index) => {
    onChange(entries.filter((_, i) => i !== index));
  };
  const move = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= entries.length) return;
    onChange(moveItem(entries, index, newIndex));
  };

  return (
    <div>
      {entries.length > 0 && (
        <div style={{ display: "grid", gap: "10px", marginBottom: "10px" }}>
          {entries.map((entry, i) => (
            <div key={i} style={{ border: "1px solid #E2E8F0", borderRadius: "9px", padding: "10px", background: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                {entries.length > 1 && (
                  <ReorderButtons index={i} total={entries.length} onMoveUp={() => move(i, -1)} onMoveDown={() => move(i, 1)} />
                )}
                <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#94A3B8", flexShrink: 0 }}>{letterLabel(i)}.</span>
                <span style={{ fontSize: "11.5px", color: "#94A3B8", flex: 1 }}>Alphabet list entry {letterLabel(i)}</span>
                <button
                  type="button"
                  onClick={() => removeEntry(i)}
                  style={{ background: "none", border: "none", color: "#B91C1C", cursor: "pointer", fontSize: "13px", fontWeight: 700, padding: "0 0 0 4px", flexShrink: 0 }}
                  aria-label={`Remove entry ${letterLabel(i)}`}
                >
                  ×
                </button>
              </div>
              <textarea
                style={{ ...textareaStyle, minHeight: "50px", marginBottom: "8px" }}
                placeholder="Short description for this entry (optional, can be used together with bullets below)…"
                value={entry.description || ""}
                onChange={(e) => updateDescription(i, e.target.value)}
              />
              <StringListField
                value={entry.items}
                onChange={(items) => updateItems(i, items)}
                placeholder="Bullet point for this entry (optional, can be used together with the description above)…"
              />
            </div>
          ))}
        </div>
      )}
      <button type="button" style={btnGhost} onClick={addEntry}>+ Add Alphabet List Entry</button>
    </div>
  );
}

// Editor for a list of {heading, description, items[], alphabet_list[]}
// sub-groups nested inside a content section — e.g. a "Treatments and
// Procedures" section with its own top-level bullets (handled separately
// by StringListField) PLUS any number of plain sub-headings, each with
// an optional short description paragraph, followed by EITHER its own
// plain bullet list OR a nested "alphabet list" (auto-lettered entries,
// each with its own optional description + bullets, both usable
// together). Sub-headings themselves are no longer auto-lettered — only
// the nested alphabet list is. `value` is always a plain array of
// {heading, description, items, alphabet_list} objects; `onChange`
// receives the new array. Switching a sub-heading's mode between
// "Bullet list" and "Alphabet list" clears whichever one it's switching
// away from, so a saved sub-heading only ever carries one of the two —
// matching the either/or contract the public page renders against.
export function SubsectionsField({ value, onChange }) {
  const subsections = Array.isArray(value) ? value : [];

  const addSubsection = () => {
    onChange([...subsections, { heading: "", description: "", items: [], alphabet_list: [], list_type: "bullets" }]);
  };
  const updateHeading = (index, heading) => {
    onChange(subsections.map((s, i) => (i === index ? { ...s, heading } : s)));
  };
  const updateDescription = (index, description) => {
    onChange(subsections.map((s, i) => (i === index ? { ...s, description } : s)));
  };
  const updateItems = (index, items) => {
    onChange(subsections.map((s, i) => (i === index ? { ...s, items } : s)));
  };
  const updateAlphabetList = (index, alphabet_list) => {
    onChange(subsections.map((s, i) => (i === index ? { ...s, alphabet_list } : s)));
  };
  const setMode = (index, mode) => {
    onChange(subsections.map((s, i) => {
      if (i !== index) return s;
      return mode === "alphabet"
        ? { ...s, items: [], list_type: "alphabet" }
        : { ...s, alphabet_list: [], list_type: "bullets" };
    }));
  };
  const removeSubsection = (index) => {
    onChange(subsections.filter((_, i) => i !== index));
  };
  const move = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= subsections.length) return;
    onChange(moveItem(subsections, index, newIndex));
  };

  return (
    <div>
      {subsections.length > 0 && (
        <div style={{ display: "grid", gap: "10px", marginBottom: "10px" }}>
          {subsections.map((sub, i) => {
            const hasAlphabetList = (sub.alphabet_list || []).length > 0;
            const mode = sub.list_type === "alphabet" || sub.list_type === "bullets"
              ? sub.list_type
              : (hasAlphabetList ? "alphabet" : "bullets");
            return (
              <div key={i} style={{ border: "1px solid #F1F5F9", borderRadius: "10px", padding: "12px", background: "#F8FAFC" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  {subsections.length > 1 && (
                    <ReorderButtons index={i} total={subsections.length} onMoveUp={() => move(i, -1)} onMoveDown={() => move(i, 1)} />
                  )}
                  <input
                    style={{ ...inputStyle, flex: 1 }}
                    placeholder="Sub-heading, e.g. 'Minimally Invasive Spine Surgery'"
                    value={sub.heading || ""}
                    onChange={(e) => updateHeading(i, e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => removeSubsection(i)}
                    style={{ background: "none", border: "none", color: "#B91C1C", cursor: "pointer", fontSize: "13px", fontWeight: 700, padding: "0 0 0 4px", flexShrink: 0 }}
                    aria-label="Remove sub-heading"
                  >
                    ×
                  </button>
                </div>
                <textarea
                  style={{ ...textareaStyle, minHeight: "60px", marginBottom: "10px" }}
                  placeholder="Short description paragraph for this sub-heading (optional)…"
                  value={sub.description || ""}
                  onChange={(e) => updateDescription(i, e.target.value)}
                />

                <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setMode(i, "bullets")}
                    style={{
                      ...btnGhost, flex: 1,
                      background: mode === "bullets" ? "#EA580C" : "#fff",
                      color: mode === "bullets" ? "#fff" : btnGhost.color,
                      borderColor: mode === "bullets" ? "#EA580C" : btnGhost.border.split(" ").pop(),
                    }}
                  >
                    Bullet list
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode(i, "alphabet")}
                    style={{
                      ...btnGhost, flex: 1,
                      background: mode === "alphabet" ? "#EA580C" : "#fff",
                      color: mode === "alphabet" ? "#fff" : btnGhost.color,
                      borderColor: mode === "alphabet" ? "#EA580C" : btnGhost.border.split(" ").pop(),
                    }}
                  >
                    Alphabet list
                  </button>
                </div>

                {mode === "bullets" ? (
                  <StringListField
                    value={sub.items}
                    onChange={(items) => updateItems(i, items)}
                    placeholder="Bullet point under this sub-heading…"
                  />
                ) : (
                  <AlphabetListField
                    value={sub.alphabet_list}
                    onChange={(alphabet_list) => updateAlphabetList(i, alphabet_list)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
      <button type="button" style={btnGhost} onClick={addSubsection}>+ Add Sub-heading</button>
    </div>
  );
}

// Compact "N thing, N thing…" summary line for read-only card/list
// views — used so a manager can tell at a glance whether a record's
// optional list fields have been filled in, without opening the edit
// modal. Omits zero-count parts entirely; falls back to a muted
// "not added yet" style hint if every part is empty.
export function CountSummary({ parts, emptyText = "Not filled in yet" }) {
  const nonEmpty = parts.filter((p) => p.count > 0);
  if (nonEmpty.length === 0) {
    return <span style={{ color: "#CBD5E1" }}>{emptyText}</span>;
  }
  return (
    <>
      {nonEmpty.map((p, i) => (
        <span key={p.label}>
          {i > 0 && " · "}
          {p.count} {p.count === 1 ? p.label : p.pluralLabel || `${p.label}s`}
        </span>
      ))}
    </>
  );
}

// Labeled link-preview card for URLs we can't (or don't want to)
// embed live — e.g. Instagram, whose oEmbed endpoint requires an
// approved Meta app/access token we don't have server-side. Gives
// managers a clear visual confirmation of what they're publishing
// instead of a bare text link.
export function LinkPreviewCard({ url, label, icon, caption }) {
  let host = url;
  try { host = new URL(url).hostname.replace(/^www\./, ""); } catch { /* keep raw url */ }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      style={{
        display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px",
        borderRadius: "10px", border: "1px solid #E2E8F0", background: "#F8FAFC",
        textDecoration: "none", minWidth: 0,
      }}
    >
      <div style={{
        width: "40px", height: "40px", borderRadius: "9px", flexShrink: 0,
        background: "#fff", border: "1px solid #E2E8F0",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px",
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: "12.5px", fontWeight: 700, color: "#0F172A", display: "flex", alignItems: "center", gap: "6px" }}>
          {label}
          <span style={{ fontWeight: 600, color: "#94A3B8", fontSize: "11px" }}>↗</span>
        </div>
        <div style={{ fontSize: "11.5px", color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {host}
        </div>
        {caption && (
          <div style={{ fontSize: "12px", color: "#374151", marginTop: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {caption}
          </div>
        )}
      </div>
    </a>
  );
}

// Highlighted banner shown on newly-created draft rows (is_active ===
// false) so "why isn't my post showing up" is obvious at a glance
// instead of a silent, easy-to-miss extra step.
export function DraftBanner({ onActivate, busy }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px",
      padding: "8px 12px", borderRadius: "8px", background: "#FFFBEB",
      border: "1px solid #FDE68A", color: "#92400E", fontSize: "12px", fontWeight: 600, marginTop: "8px",
    }}>
      <span>🕒 Draft — not visible on the public site until activated.</span>
      <button
        type="button"
        onClick={onActivate}
        disabled={busy}
        style={{
          padding: "4px 10px", borderRadius: "6px", border: "1px solid #FCD34D",
          background: "#fff", color: "#92400E", fontSize: "11.5px", fontWeight: 700,
          cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1, flexShrink: 0,
        }}
      >
        Activate
      </button>
    </div>
  );
}