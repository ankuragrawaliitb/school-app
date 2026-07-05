import { useEffect, useMemo, useState } from "react";
import api, { formatApiError, inr } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Plus, Pencil, Trash2, X, Layers } from "lucide-react";
import { toast } from "sonner";

const FREQS = [
  { v: "monthly", label: "Monthly" },
  { v: "quarterly", label: "Quarterly" },
  { v: "yearly", label: "Yearly" },
  { v: "one_time", label: "One-time" },
];

const empty = { name: "", frequency: "monthly", default_amount: 0, description: "" };

export default function FeeComponents() {
  const { can } = useAuth();
  const [rows, setRows] = useState([]);
  const [classes, setClasses] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [ovForm, setOvForm] = useState({ open: false, fc: null, class_id: "", amount: 0 });

  const load = async () => {
    const [fc, cl, ov] = await Promise.all([
      api.get("/fee-components"),
      api.get("/classes").catch(() => ({ data: [] })),
      api.get("/fee-overrides?scope=class").catch(() => ({ data: [] })),
    ]);
    setRows(fc.data);
    setClasses(cl.data);
    setOverrides(ov.data);
  };
  useEffect(() => { load(); }, []);

  const classMap = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, c])), [classes]);

  const overridesByComp = useMemo(() => {
    const map = {};
    for (const o of overrides) {
      map[o.fee_component_id] = map[o.fee_component_id] || [];
      map[o.fee_component_id].push(o);
    }
    return map;
  }, [overrides]);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (r) => { setEditing(r); setForm({ ...r }); setOpen(true); };

  const save = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, default_amount: Number(form.default_amount) };
      if (editing) await api.put(`/fee-components/${editing.id}`, payload);
      else await api.post("/fee-components", payload);
      setOpen(false);
      toast.success(editing ? "Component updated" : "Component created");
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const remove = async (r) => {
    if (!confirm(`Delete component "${r.name}"?`)) return;
    try { await api.delete(`/fee-components/${r.id}`); toast.success("Deleted"); load(); } catch (err) { toast.error(formatApiError(err)); }
  };

  const saveOverride = async (e) => {
    e.preventDefault();
    try {
      await api.post("/fee-overrides", { fee_component_id: ovForm.fc.id, scope: "class", scope_id: ovForm.class_id, amount: Number(ovForm.amount) });
      setOvForm({ open: false, fc: null, class_id: "", amount: 0 });
      toast.success("Class-level amount saved");
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const removeOverride = async (o) => {
    if (!confirm("Remove this class-level override?")) return;
    try { await api.delete(`/fee-overrides/${o.id}`); toast.success("Removed"); load(); } catch (err) { toast.error(formatApiError(err)); }
  };

  return (
    <div className="space-y-6" data-testid="fee-components-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="overline mb-1">Fee catalog</div>
          <h2 className="font-display text-2xl font-semibold">Fee components</h2>
          <p className="text-sm text-zinc-500 mt-1 max-w-2xl">Define universal defaults per frequency. Override amounts class-wise here, or student-wise from a student's profile.</p>
        </div>
        {can("fee_components", "edit") && (
          <button className="btn-primary h-10 px-4 flex items-center gap-2" onClick={openNew} data-testid="add-component-btn">
            <Plus size={16} /> New component
          </button>
        )}
      </div>

      <div className="space-y-3">
        {rows.length === 0 ? (
          <div className="card-flat p-10 text-center text-sm text-zinc-500">
            <Layers size={24} className="mx-auto text-zinc-300 mb-3" />
            No fee components yet. Start by adding one — e.g. "Tuition — Monthly".
          </div>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="card-flat" data-testid={`fc-row-${r.id}`}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
                <div>
                  <div className="font-display font-semibold">{r.name}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    <span className="uppercase tracking-wider">{r.frequency.replace("_", " ")}</span>
                    {r.description && <> · {r.description}</>}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="overline">Default</div>
                    <div className="num-r font-semibold">{inr(r.default_amount)}</div>
                  </div>
                  <div className="flex gap-1">
                    {can("fee_components", "edit") && (
                      <button onClick={() => openEdit(r)} className="p-1.5 hover:bg-zinc-100 rounded-sm" data-testid={`edit-fc-${r.id}`}><Pencil size={14} /></button>
                    )}
                    {can("fee_components", "delete") && (
                      <button onClick={() => remove(r)} className="p-1.5 hover:bg-red-50 rounded-sm text-[#FF3B30]" data-testid={`delete-fc-${r.id}`}><Trash2 size={14} /></button>
                    )}
                  </div>
                </div>
              </div>
              <div className="px-5 py-3 flex items-center justify-between">
                <div className="overline">Class-wise overrides</div>
                {can("fee_components", "edit") && classes.length > 0 && (
                  <button onClick={() => setOvForm({ open: true, fc: r, class_id: classes[0].id, amount: r.default_amount })} className="text-xs text-[#002FA7] hover:underline" data-testid={`add-class-override-${r.id}`}>
                    + Add class override
                  </button>
                )}
              </div>
              {(overridesByComp[r.id] || []).length === 0 ? (
                <div className="px-5 pb-4 text-xs text-zinc-500">No class-specific amounts. All classes use the default.</div>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {(overridesByComp[r.id] || []).map((o) => (
                      <tr key={o.id} className="border-t border-zinc-100">
                        <td className="px-5 py-2">{classMap[o.scope_id]?.name || "Unknown class"}{classMap[o.scope_id]?.section && ` — ${classMap[o.scope_id].section}`}</td>
                        <td className="px-5 py-2 num-r">{inr(o.amount)}</td>
                        <td className="px-5 py-2 text-right">
                          {can("fee_components", "delete") && (
                            <button onClick={() => removeOverride(o)} className="text-xs text-[#FF3B30] hover:underline">Remove</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))
        )}
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center z-50 p-4">
          <form onSubmit={save} className="bg-white border border-zinc-200 rounded-sm w-full max-w-md" data-testid="fc-form">
            <div className="flex items-center justify-between px-5 h-14 border-b border-zinc-200">
              <div className="font-display font-semibold">{editing ? "Edit component" : "New component"}</div>
              <button type="button" onClick={() => setOpen(false)} className="p-1 hover:bg-zinc-100 rounded-sm"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="overline block mb-2">Name *</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full h-10 px-3 border border-zinc-300 rounded-sm" placeholder="Tuition" data-testid="fc-name-input" />
              </div>
              <div>
                <label className="overline block mb-2">Frequency *</label>
                <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className="w-full h-10 px-3 border border-zinc-300 rounded-sm bg-white" data-testid="fc-frequency-select">
                  {FREQS.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}
                </select>
              </div>
              <div>
                <label className="overline block mb-2">Default amount (₹) *</label>
                <input type="number" required min="0" step="0.01" value={form.default_amount} onChange={(e) => setForm({ ...form, default_amount: e.target.value })} className="w-full h-10 px-3 border border-zinc-300 rounded-sm num" data-testid="fc-amount-input" />
              </div>
              <div>
                <label className="overline block mb-2">Description</label>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full h-10 px-3 border border-zinc-300 rounded-sm" />
              </div>
            </div>
            <div className="border-t border-zinc-200 p-4 flex justify-end gap-2">
              <button type="button" className="btn-ghost h-9 px-4" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="btn-primary h-9 px-4" data-testid="save-fc-btn">{editing ? "Save" : "Create"}</button>
            </div>
          </form>
        </div>
      )}

      {ovForm.open && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center z-50 p-4">
          <form onSubmit={saveOverride} className="bg-white border border-zinc-200 rounded-sm w-full max-w-md" data-testid="class-override-form">
            <div className="flex items-center justify-between px-5 h-14 border-b border-zinc-200">
              <div className="font-display font-semibold">Class override — {ovForm.fc?.name}</div>
              <button type="button" onClick={() => setOvForm({ open: false, fc: null, class_id: "", amount: 0 })} className="p-1 hover:bg-zinc-100 rounded-sm"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="overline block mb-2">Class *</label>
                <select required value={ovForm.class_id} onChange={(e) => setOvForm({ ...ovForm, class_id: e.target.value })} className="w-full h-10 px-3 border border-zinc-300 rounded-sm bg-white">
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}{c.section && ` — ${c.section}`}</option>)}
                </select>
              </div>
              <div>
                <label className="overline block mb-2">Amount (₹) *</label>
                <input type="number" required min="0" step="0.01" value={ovForm.amount} onChange={(e) => setOvForm({ ...ovForm, amount: e.target.value })} className="w-full h-10 px-3 border border-zinc-300 rounded-sm num" />
              </div>
            </div>
            <div className="border-t border-zinc-200 p-4 flex justify-end gap-2">
              <button type="button" className="btn-ghost h-9 px-4" onClick={() => setOvForm({ open: false, fc: null, class_id: "", amount: 0 })}>Cancel</button>
              <button type="submit" className="btn-primary h-9 px-4">Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
