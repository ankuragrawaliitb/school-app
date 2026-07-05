import { useEffect, useMemo, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Plus, Pencil, Trash2, X, ArrowRight, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const empty = {
  name: "",
  class_id: "",
  roll_no: "",
  admission_no: "",
  guardian_name: "",
  guardian_phone: "",
  dob: "",
  gender: "",
  address: "",
};

export default function Students() {
  const { can } = useAuth();
  const [rows, setRows] = useState([]);
  const [classes, setClasses] = useState([]);
  const [filter, setFilter] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [s, c] = await Promise.all([api.get("/students"), api.get("/classes")]);
    setRows(s.data);
    setClasses(c.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const classMap = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, c])), [classes]);

  const filtered = useMemo(() => {
    let r = rows;
    if (filter) r = r.filter((x) => x.class_id === filter);
    if (q) {
      const s = q.toLowerCase();
      r = r.filter((x) =>
        [x.name, x.roll_no, x.admission_no, x.guardian_name, x.guardian_phone].some((v) => (v || "").toLowerCase().includes(s))
      );
    }
    return r;
  }, [rows, filter, q]);

  const openNew = () => {
    if (classes.length === 0) {
      toast.error("Create a class first");
      return;
    }
    setEditing(null);
    setForm({ ...empty, class_id: classes[0].id });
    setOpen(true);
  };
  const openEdit = (r) => {
    setEditing(r);
    setForm({ ...empty, ...r });
    setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) await api.put(`/students/${editing.id}`, form);
      else await api.post("/students", form);
      setOpen(false);
      toast.success(editing ? "Student updated" : "Student created");
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const remove = async (r) => {
    if (!confirm(`Delete student "${r.name}"?`)) return;
    try {
      await api.delete(`/students/${r.id}`);
      toast.success("Deleted");
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  return (
    <div className="space-y-6" data-testid="students-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="overline mb-1">Roster</div>
          <h2 className="font-display text-2xl font-semibold">Students</h2>
        </div>
        {can("students", "edit") && (
          <button className="btn-primary h-10 px-4 flex items-center gap-2" onClick={openNew} data-testid="add-student-btn">
            <Plus size={16} /> New student
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, roll, guardian…"
            data-testid="student-search"
            className="w-full h-10 pl-9 pr-3 border border-zinc-300 rounded-sm focus:ring-2 focus:ring-[#002FA7]/40 focus:border-[#002FA7]"
          />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} data-testid="student-filter-class" className="h-10 px-3 border border-zinc-300 rounded-sm bg-white text-sm">
          <option value="">All classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}{c.section && ` — ${c.section}`}</option>
          ))}
        </select>
      </div>

      <div className="card-flat overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200">
              <th className="overline text-left px-4 py-3 font-normal">Name</th>
              <th className="overline text-left px-4 py-3 font-normal">Class</th>
              <th className="overline text-left px-4 py-3 font-normal">Roll no.</th>
              <th className="overline text-left px-4 py-3 font-normal">Guardian</th>
              <th className="overline text-left px-4 py-3 font-normal">Phone</th>
              <th className="w-32"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center text-zinc-400 py-10 text-sm">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-zinc-500 py-10 text-sm">No students found.</td></tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-t border-zinc-100 hover:bg-zinc-50" data-testid={`student-row-${r.id}`}>
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3 text-zinc-700">{classMap[r.class_id]?.name || "—"}{classMap[r.class_id]?.section && ` — ${classMap[r.class_id].section}`}</td>
                  <td className="px-4 py-3 num text-xs">{r.roll_no || "—"}</td>
                  <td className="px-4 py-3 text-zinc-700">{r.guardian_name || "—"}</td>
                  <td className="px-4 py-3 num text-xs">{r.guardian_phone || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1 items-center">
                      <Link to={`/students/${r.id}`} className="p-1.5 hover:bg-zinc-100 rounded-sm text-[#002FA7]" title="Open" data-testid={`open-student-${r.id}`}>
                        <ArrowRight size={14} />
                      </Link>
                      {can("students", "edit") && (
                        <button onClick={() => openEdit(r)} className="p-1.5 hover:bg-zinc-100 rounded-sm" data-testid={`edit-student-${r.id}`}><Pencil size={14} /></button>
                      )}
                      {can("students", "delete") && (
                        <button onClick={() => remove(r)} className="p-1.5 hover:bg-red-50 rounded-sm text-[#FF3B30]" data-testid={`delete-student-${r.id}`}><Trash2 size={14} /></button>
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
          <form onSubmit={save} className="bg-white border border-zinc-200 rounded-sm w-full max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="student-form">
            <div className="flex items-center justify-between px-5 h-14 border-b border-zinc-200 sticky top-0 bg-white">
              <div className="font-display font-semibold">{editing ? "Edit student" : "New student"}</div>
              <button type="button" onClick={() => setOpen(false)} className="p-1 hover:bg-zinc-100 rounded-sm"><X size={16} /></button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="overline block mb-2">Full name *</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full h-10 px-3 border border-zinc-300 rounded-sm focus:ring-2 focus:ring-[#002FA7]/40 focus:border-[#002FA7]" data-testid="student-name-input" />
              </div>
              <div>
                <label className="overline block mb-2">Class *</label>
                <select required value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })} className="w-full h-10 px-3 border border-zinc-300 rounded-sm bg-white" data-testid="student-class-select">
                  {classes.map((c) => (<option key={c.id} value={c.id}>{c.name}{c.section && ` — ${c.section}`}</option>))}
                </select>
              </div>
              <div>
                <label className="overline block mb-2">Roll no.</label>
                <input value={form.roll_no} onChange={(e) => setForm({ ...form, roll_no: e.target.value })} className="w-full h-10 px-3 border border-zinc-300 rounded-sm" />
              </div>
              <div>
                <label className="overline block mb-2">Admission no.</label>
                <input value={form.admission_no} onChange={(e) => setForm({ ...form, admission_no: e.target.value })} className="w-full h-10 px-3 border border-zinc-300 rounded-sm" />
              </div>
              <div>
                <label className="overline block mb-2">Date of birth</label>
                <input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} className="w-full h-10 px-3 border border-zinc-300 rounded-sm" />
              </div>
              <div>
                <label className="overline block mb-2">Gender</label>
                <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className="w-full h-10 px-3 border border-zinc-300 rounded-sm bg-white">
                  <option value="">—</option>
                  <option>Male</option><option>Female</option><option>Other</option>
                </select>
              </div>
              <div>
                <label className="overline block mb-2">Guardian name</label>
                <input value={form.guardian_name} onChange={(e) => setForm({ ...form, guardian_name: e.target.value })} className="w-full h-10 px-3 border border-zinc-300 rounded-sm" />
              </div>
              <div>
                <label className="overline block mb-2">Guardian phone</label>
                <input value={form.guardian_phone} onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })} className="w-full h-10 px-3 border border-zinc-300 rounded-sm" />
              </div>
              <div className="col-span-2">
                <label className="overline block mb-2">Address</label>
                <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} className="w-full px-3 py-2 border border-zinc-300 rounded-sm" />
              </div>
            </div>
            <div className="border-t border-zinc-200 p-4 flex justify-end gap-2 sticky bottom-0 bg-white">
              <button type="button" className="btn-ghost h-9 px-4" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="btn-primary h-9 px-4" data-testid="save-student-btn">{editing ? "Save" : "Create"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
