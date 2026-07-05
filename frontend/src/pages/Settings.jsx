import { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Save, Building } from "lucide-react";
import { toast } from "sonner";

const empty = {
  school_name: "My School",
  address: "",
  phone: "",
  email: "",
  logo_url: "",
  receipt_header: "Fee Receipt",
  receipt_footer: "This is a computer generated receipt.",
  show_logo: true,
  show_signature_line: true,
  receipt_prefix: "RCPT",
  currency_symbol: "₹",
};

export default function Settings() {
  const { can } = useAuth();
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const editable = can("settings", "edit");

  useEffect(() => {
    (async () => {
      try { const { data } = await api.get("/settings"); setForm({ ...empty, ...data }); } catch {}
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/settings", form);
      toast.success("Settings saved");
    } catch (err) { toast.error(formatApiError(err)); }
    setSaving(false);
  };

  return (
    <div className="space-y-6" data-testid="settings-page">
      <div className="flex items-center justify-between">
        <div>
          <div className="overline mb-1">Institution</div>
          <h2 className="font-display text-2xl font-semibold">School settings & receipt template</h2>
        </div>
        {editable && (
          <button onClick={save} disabled={saving} className="btn-primary h-10 px-4 flex items-center gap-2" data-testid="save-settings-btn">
            <Save size={15} /> {saving ? "Saving…" : "Save"}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card-flat p-5 space-y-4">
          <div className="overline flex items-center gap-2"><Building size={13} /> School details</div>
          <Field label="School name" value={form.school_name} onChange={(v) => setForm({ ...form, school_name: v })} disabled={!editable} testid="school-name-input" />
          <Field label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} disabled={!editable} textarea />
          <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} disabled={!editable} />
          <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} disabled={!editable} />
          <Field label="Logo URL" value={form.logo_url} onChange={(v) => setForm({ ...form, logo_url: v })} disabled={!editable} placeholder="https://…" />
        </div>
        <div className="card-flat p-5 space-y-4">
          <div className="overline">Receipt template</div>
          <Field label="Receipt title" value={form.receipt_header} onChange={(v) => setForm({ ...form, receipt_header: v })} disabled={!editable} testid="receipt-header-input" />
          <Field label="Receipt footer" value={form.receipt_footer} onChange={(v) => setForm({ ...form, receipt_footer: v })} disabled={!editable} textarea />
          <Field label="Receipt number prefix" value={form.receipt_prefix} onChange={(v) => setForm({ ...form, receipt_prefix: v })} disabled={!editable} />
          <div className="flex items-center gap-6 pt-2">
            <Toggle label="Show logo" checked={form.show_logo} onChange={(v) => setForm({ ...form, show_logo: v })} disabled={!editable} testid="toggle-logo" />
            <Toggle label="Signature line" checked={form.show_signature_line} onChange={(v) => setForm({ ...form, show_signature_line: v })} disabled={!editable} testid="toggle-signature" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, disabled, textarea, placeholder, testid }) {
  return (
    <div>
      <label className="overline block mb-2">{label}</label>
      {textarea ? (
        <textarea data-testid={testid} disabled={disabled} value={value || ""} onChange={(e) => onChange(e.target.value)} rows={3} className="w-full px-3 py-2 border border-zinc-300 rounded-sm disabled:bg-zinc-50" placeholder={placeholder} />
      ) : (
        <input data-testid={testid} disabled={disabled} value={value || ""} onChange={(e) => onChange(e.target.value)} className="w-full h-10 px-3 border border-zinc-300 rounded-sm disabled:bg-zinc-50" placeholder={placeholder} />
      )}
    </div>
  );
}

function Toggle({ label, checked, onChange, disabled, testid }) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <button type="button" disabled={disabled} data-testid={testid} onClick={() => onChange(!checked)} className={`w-11 h-6 rounded-sm relative transition-colors ${checked ? "bg-[#002FA7]" : "bg-zinc-200"} disabled:opacity-50`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-sm bg-white transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>
      <span>{label}</span>
    </label>
  );
}
