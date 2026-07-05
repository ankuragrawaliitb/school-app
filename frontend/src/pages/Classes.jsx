import { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";

const empty = { name: "", section: "", academic_year: "" };

export default function Classes() {
  const { can } = useAuth();
  const [rows, setRows] = useState([]);
  const [studentCounts, setStudentCounts] = useState({});
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [c, s] = await Promise.all([api.get("/classes"), api.get("/students").catch(() => ({ data: [] }))]);
    setRows(c.data);
    const counts = {};
    for (const st of s.data) counts[st.class_id] = (counts[st.class_id] || 0) + 1;
    setStudentCounts(counts);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };
  const openEdit = (r) => {
    setEditing(r);
    setForm({ name: r.name, section: r.section || "", academic_year: r.academic_year || "" });
    setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) await api.put(`/classes/${editing.id}`, form);
      else await api.post("/classes", form);
      setOpen(false);
      toast.success(editing ? "Class updated" : "Class created");
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const remove = async (r) => {
    if (!confirm(`Delete class "${r.name}"?`)) return;
    try {
      await api.delete(`/classes/${r.id}`);
      toast.success("Deleted");
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  return (
    <div className="space-y-6" data-testid="classes-page">
      <div className="flex items-center justify-between">
        <div>
          <div className="overline mb-1">Structure</div>
          <h2 className="font-display text-2xl font-semibold">Classes</h2>
        </div>
        {can("classes", "edit") && (
          <button className="btn-primary h-10 px-4 flex items-center gap-2" onClick={openNew} data-testid="add-class-btn">
            <Plus size={16} /> New class
          </button>
        )}
      </div>

      <div className="card-flat overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200">
              <th className="overline text-left px-4 py-3 font-normal">Name</th>
              <th className="overline text-left px-4 py-3 font-normal">Section</th>
              <th className="overline text-left px-4 py-3 font-normal">Academic year</th>
              <th className="overline text-right px-4 py-3 font-normal">Students</th>
              <th className="w-24"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center text-zinc-400 py-10 text-sm">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="text-center text-zinc-500 py-10">
                <div className="mb-2">No classes yet.</div>
                {can("classes", "edit") && <button className="btn-primary h-9 px-4 text-xs" onClick={openNew}>Create your first class</button>}
              </td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-zinc-100 hover:bg-zinc-50 transition-colors" data-testid={`class-row-${r.id}`}>
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3 text-zinc-600">{r.section || "—"}</td>
                  <td className="px-4 py-3 text-zinc-600 num text-xs">{r.academic_year || "—"}</td>
                  <td className="px-4 py-3 num-r">{studentCounts[r.id] || 0}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      {can("classes", "edit") && (
                        <button onClick={() => openEdit(r)} className="p-1.5 hover:bg-zinc-100 rounded-sm" data-testid={`edit-class-${r.id}`}>
                          <Pencil size={14} />
                        </button>
                      )}
                      {can("classes", "delete") && (
                        <button onClick={() => remove(r)} className="p-1.5 hover:bg-red-50 rounded-sm text-[#FF3B30]" data-testid={`delete-class-${r.id}`}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 no-print p-4">
          <form onSubmit={save} className="bg-white border border-zinc-200 rounded-sm w-full max-w-md" data-testid="class-form">
            <div className="flex items-center justify-between px-5 h-14 border-b border-zinc-200">
              <div className="font-display font-semibold">{editing ? "Edit class" : "New class"}</div>
              <button type="button" onClick={() => setOpen(false)} className="p-1 hover:bg-zinc-100 rounded-sm"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="overline block mb-2">Name *</label>
                <input required autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full h-10 px-3 border border-zinc-300 rounded-sm focus:ring-2 focus:ring-[#002FA7]/40 focus:border-[#002FA7]" placeholder="Grade 10" data-testid="class-name-input" />
              </div>
              <div>
                <label className="overline block mb-2">Section</label>
                <input value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} className="w-full h-10 px-3 border border-zinc-300 rounded-sm focus:ring-2 focus:ring-[#002FA7]/40 focus:border-[#002FA7]" placeholder="A" data-testid="class-section-input" />
              </div>
              <div>
                <label className="overline block mb-2">Academic year</label>
                <input value={form.academic_year} onChange={(e) => setForm({ ...form, academic_year: e.target.value })} className="w-full h-10 px-3 border border-zinc-300 rounded-sm focus:ring-2 focus:ring-[#002FA7]/40 focus:border-[#002FA7]" placeholder="2025-2026" data-testid="class-year-input" />
              </div>
            </div>
            <div className="border-t border-zinc-200 p-4 flex justify-end gap-2">
              <button type="button" className="btn-ghost h-9 px-4" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="btn-primary h-9 px-4" data-testid="save-class-btn">{editing ? "Save" : "Create"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
