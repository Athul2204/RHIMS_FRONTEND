// src/modules/admin/pages/HospitalSettingsPage.jsx
import { useEffect, useState } from "react";
import { getHospitalSettings, patchHospitalSettings } from "../api/adminApi";

const G = "#16A34A";

const Ico = ({ path, size = 18, color = "currentColor", extra }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={path} />
    {extra && <path d={extra} />}
  </svg>
);

const ICONS = {
  settings:  "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
  rupee:     "M6 3h12 M6 8h12 M6 13h8a4 4 0 0 1 0 8H6l3-4H6",
  check:     "M20 6L9 17l-5-5",
  hospital:  "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  clock:     "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 6v6l4 2",
  info:      "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 8h.01 M12 12v4",
};

const inp = {
  padding:"11px 14px", borderRadius:"10px", border:"1px solid #E2E8F0",
  outline:"none", fontSize:"15px", color:"#1E293B", boxSizing:"border-box",
  width:"100%",
};

const SectionCard = ({ title, icon, children }) => (
  <div style={{ background:"#fff", borderRadius:"16px", border:"1px solid #F1F5F9", boxShadow:"0 1px 3px rgba(0,0,0,0.06)", overflow:"hidden", marginBottom:"20px" }}>
    <div style={{ padding:"18px 24px", borderBottom:"1px solid #F8FAFC", display:"flex", alignItems:"center", gap:"12px" }}>
      <div style={{ width:"36px", height:"36px", borderRadius:"10px", background:`${G}12`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
        <Ico path={icon} size={18} color={G} />
      </div>
      <h3 style={{ margin:0, fontSize:"15px", fontWeight:700, color:"#0F172A" }}>{title}</h3>
    </div>
    <div style={{ padding:"22px 24px" }}>{children}</div>
  </div>
);

export default function HospitalSettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");
  const [mrdFee, setMrdFee]     = useState("");

  useEffect(() => {
    setLoading(true);
    getHospitalSettings()
      .then(data => {
        setSettings(data);
        setMrdFee(data.mrd_registration_fee ?? "0");
      })
      .catch(() => setError("Failed to load hospital settings."))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true); setError(""); setSuccess("");
    try {
      const res = await patchHospitalSettings({
        mrd_registration_fee: parseFloat(mrdFee) || 0,
      });
      setSettings(res);
      setSuccess("Settings saved successfully.");
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      const data = err?.response?.data;
      if (data && typeof data === "object") {
        const msgs = [];
        const extract = (obj, prefix = "") => {
          Object.entries(obj).forEach(([k, v]) => {
            const l = prefix ? `${prefix} ${k}` : k;
            if (Array.isArray(v)) msgs.push(`${l}: ${v.join(" ")}`);
            else if (typeof v === "object" && v) extract(v, l);
            else msgs.push(`${l}: ${v}`);
          });
        };
        extract(data);
        setError(msgs.join(" | "));
      } else {
        setError(err.message || "Failed to save settings.");
      }
    } finally {
      setSaving(false);
    }
  };

  const lastUpdated = settings?.updated_at
    ? new Date(settings.updated_at).toLocaleString("en-IN", { dateStyle:"medium", timeStyle:"short" })
    : null;

  return (
    <div style={{ background:"#F8FAFC", minHeight:"100%", margin:"-20px -16px", padding:"24px" }}>

      {/* Page Header */}
      <div style={{ marginBottom:"24px" }}>
        <h1 style={{ fontSize:"20px", fontWeight:700, color:"#0F172A", margin:0 }}>Hospital Settings</h1>
        <p style={{ fontSize:"13px", color:"#64748B", marginTop:"4px" }}>
          Configure hospital-wide defaults and fee structures.
        </p>
      </div>

      {error && (
        <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", color:"#DC2626", borderRadius:"10px", padding:"12px 16px", marginBottom:"16px", fontSize:"14px" }}>{error}</div>
      )}
      {success && (
        <div style={{ background:"#F0FDF4", border:"1px solid #86EFAC", color:"#15803D", borderRadius:"10px", padding:"12px 16px", marginBottom:"16px", fontSize:"14px", display:"flex", alignItems:"center", gap:"10px" }}>
          <Ico path={ICONS.check} size={16} color="#15803D" /> {success}
        </div>
      )}

      {loading ? (
        <div style={{ background:"#fff", borderRadius:"16px", padding:"48px", textAlign:"center", border:"1px solid #F1F5F9" }}>
          <div style={{ color:"#94A3B8", fontSize:"14px" }}>Loading settings…</div>
        </div>
      ) : (
        <div style={{ maxWidth:"680px" }}>

          {/* MRD Registration Fee */}
          <SectionCard title="Patient Registration" icon={ICONS.hospital}>
            <div style={{ marginBottom:"18px" }}>
              <label style={{ display:"block", fontSize:"13px", fontWeight:600, color:"#475569", marginBottom:"6px" }}>
                MRD Registration Fee (₹)
              </label>
              <div style={{ position:"relative" }}>
                <span style={{ position:"absolute", left:"13px", top:"50%", transform:"translateY(-50%)", fontSize:"15px", color:"#94A3B8", fontWeight:600 }}>₹</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={mrdFee}
                  onChange={e => setMrdFee(e.target.value)}
                  style={{ ...inp, paddingLeft:"32px" }}
                  placeholder="0.00"
                />
              </div>
              <p style={{ fontSize:"12px", color:"#94A3B8", marginTop:"7px", display:"flex", alignItems:"center", gap:"5px" }}>
                <Ico path={ICONS.info} size={13} color="#94A3B8" />
                One-time fee charged when a new patient (MRD) record is first created.
              </p>
            </div>

            {lastUpdated && (
              <div style={{ display:"flex", alignItems:"center", gap:"6px", fontSize:"12px", color:"#94A3B8", marginBottom:"18px" }}>
                <Ico path={ICONS.clock} size={13} color="#94A3B8" />
                Last updated: {lastUpdated}
              </div>
            )}

            <div style={{ display:"flex", justifyContent:"flex-end" }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ display:"flex", alignItems:"center", gap:"8px", padding:"10px 24px", borderRadius:"10px", border:"none", background: saving ? "#86EFAC" : G, color:"#fff", fontSize:"14px", fontWeight:600, cursor: saving ? "not-allowed" : "pointer" }}>
                {saving
                  ? <><Ico path={ICONS.clock} size={15} color="#fff" /> Saving…</>
                  : <><Ico path={ICONS.check} size={15} color="#fff" /> Save Settings</>
                }
              </button>
            </div>
          </SectionCard>

          {/* Info Card */}
          <div style={{ background:"#F0FDF4", border:"1px solid #BBF7D0", borderRadius:"14px", padding:"18px 22px", display:"flex", gap:"14px" }}>
            <div style={{ flexShrink:0, paddingTop:"2px" }}>
              <Ico path={ICONS.info} size={18} color={G} />
            </div>
            <div>
              <p style={{ margin:0, fontSize:"13px", fontWeight:600, color:"#15803D", marginBottom:"4px" }}>About Hospital Settings</p>
              <p style={{ margin:0, fontSize:"13px", color:"#166534", lineHeight:"1.6" }}>
                These settings apply globally across the system. The MRD registration fee is automatically 
                added to reception bills when a new patient record is created. Changes take effect immediately 
                for all new transactions.
              </p>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}