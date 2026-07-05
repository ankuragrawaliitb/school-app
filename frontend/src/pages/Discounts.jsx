import { useEffect, useMemo, useState } from "react";
import api, { formatApiError, inr } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Plus, Trash2, X, Percent } from "lucide-react";
import { toast } from "sonner";

export default function Discounts() {
  const { can } = useAuth();
  const [discounts, setDiscounts] = useState([]);
  const [students, setStudents] = useState([]);
  const [components, setComponents] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ student_id: "", fee_component_id: "", amount: 0, reason: "" });

  const load = async () => {
    const [d, s, c] = await Promise.all([api.get("/discounts"), api.get("/students"), api.get("/fee-components")]);
    setDiscounts(d.data); setStudents(s.data); setComponents(c.data);
  };
  useEffect(() => { load(); }, []);

  const stMap = useMemo(() => Object.fromEntries(students.map((s) => [s.id, s])), [students]);
  const cMap = useMemo(() => Object.fromEntries(components.map((c) => [c.id, c])), [components]);

  const filtered = discounts.filter((d) => {
    if (!q) return true;
    const name = stMap[d.student_id]?.name || "";
    return name.toLowerCase().includes(q.toLowerCase());
  });

  const openNew = () => {
    if (students.length === 0) return toast.error("Add students first");
    setForm({ student_id: students[0].id, fee_component_id: "", amount: 0, reason: "" });
    setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, amount: Number(form.amount) };
      if (!payload.fee_component_id) delete payload.fee_component_id;
      await api.post("/discounts", payload);
      setOpen(false);
      toast.success("Discount added");
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const remove = async (d) => {
    if (!confirm("Delete this discount?")) return;
    try { await api.delete(`/discounts/${d.id}`); toast.success("Deleted"); load(); } catch (err) { toast.error(formatApiError(err)); }
  };

  return (
    <div className="space-y-6" data-testid="discounts-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="overline mb-1">Concessions</div>
          <h2 className="font-display text-2xl font-semibold">Student discounts</h2>
          <p className="text-sm text-zinc-500 mt-1">Fixed-amount concessions applied to invoices at billing time.</p>
        </div>
        {can("discounts", "edit") && (
          <button className="btn-primary h-10 px-4 flex items-center gap-2" onClick={openNew} data-testid="add-discount-btn">
            <Plus size={16} /> New discount
          </button>
        )}
      </div>

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by student name" className="w-full max-w-md h-10 px-3 border border-zinc-300 rounded-sm" data-testid="discount-search" />

      <div className="card-flat overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-zinc-500">
            <Percent size={24} className="mx-auto text-zinc-300 mb-3" />
            No discounts configured.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="overline text-left px-4 py-3 font-normal">Student</th>
                <th className="overline text-left px-4 py-3 font-normal">Applies to</th>
                <th className="overline text-left px-4 py-3 font-normal">Reason</th>
                <th className="overline text-right px-4 py-3 font-normal">Amount</th>
                <th className="w-16"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium">{stMap[d.student_id]?.name || "—"}</td>
                  <td className="px-4 py-3">{d.fee_component_id ? cMap[d.fee_component_id]?.name : <span className="text-zinc-500">General</span>}</td>
                  <td className="px-4 py-3 text-zinc-600">{d.reason || "—"}</td>
                  <td className="px-4 py-3 num-r text-[#FF3B30]">− {inr(d.amount)}</td>
                  <td className="px-4 py-3 text-right">
                    {can("discounts", "delete") && (
                      <button onClick={() => remove(d)} className="p-1.5 hover:bg-red-50 rounded-sm text-[#FF3B30]"><Trash2 size={14} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center z-50 p-4">
          <form onSubmit={save} className="bg-white border border-zinc-200 rounded-sm w-full max-w-md" data-testid="new-discount-form">
            <div className="flex items-center justify-between px-5 h-14 border-b border-zinc-200">
              <div className="font-display font-semibold">New discount</div>
              <button type="button" onClick={() => setOpen(false)} className="p-1 hover:bg-zinc-100 rounded-sm"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="overline block mb-2">Student *</label>
                <select required value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} className="w-full h-10 px-3 border border-zinc-300 rounded-sm bg-white" data-testid="discount-student-select">
                  {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="overline block mb-2">Applies to</label>
                <select value={form.fee_component_id} onChange={(e) => setForm({ ...form, fee_component_id: e.target.value })} className="w-full h-10 px-3 border border-zinc-300 rounded-sm bg-white">
                  <option value="">General (any invoice)</option>
                  {components.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.frequency})</option>)}
                </select>
              </div>
              <div>
                <label className="overline block mb-2">Amount (₹) *</label>
                <input type="number" required min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full h-10 px-3 border border-zinc-300 rounded-sm num" data-testid="new-discount-amount" />
              </div>
              <div>
                <label className="overline block mb-2">Reason</label>
                <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="w-full h-10 px-3 border border-zinc-300 rounded-sm" />
              </div>
            </div>
            <div className="border-t border-zinc-200 p-4 flex justify-end gap-2">
              <button type="button" className="btn-ghost h-9 px-4" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="btn-primary h-9 px-4" data-testid="save-new-discount-btn">Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
