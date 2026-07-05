import { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Plus, Pencil, Trash2, X, User } from "lucide-react";
import { toast } from "sonner";

const empty = { username: "", password: "", name: "", role: "staff" };

export default function Users() {
  const { user: me } = useAuth();
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const isAdmin = me?.role === "admin";

  const load = async () => { const { data } = await api.get("/users"); setRows(data); };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (r) => { setEditing(r); setForm({ username: r.username, password: "", name: r.name, role: r.role }); setOpen(true); };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        const payload = { name: form.name, role: form.role };
        if (form.password) payload.password = form.password;
        await api.put(`/users/${editing.id}`, payload);
      } else {
        await api.post("/users", form);
      }
      setOpen(false);
      toast.success(editing ? "User updated" : "User created");
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const remove = async (r) => {
    if (!confirm(`Delete user "${r.username}"?`)) return;
    try { await api.delete(`/users/${r.id}`); toast.success("Deleted"); load(); } catch (err) { toast.error(formatApiError(err)); }
  };

  return (
    <div className="space-y-6" data-testid="users-page">
      <div className="flex items-center justify-between">
        <div>
          <div className="overline mb-1">Access</div>
          <h2 className="font-display text-2xl font-semibold">Users</h2>
        </div>
        {isAdmin && (
          <button onClick={openNew} className="btn-primary h-10 px-4 flex items-center gap-2" data-testid="add-user-btn"><Plus size={16} /> New user</button>
        )}
      </div>

      <div className="card-flat overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200">
              <th className="overline text-left px-4 py-3 font-normal">Username</th>
              <th className="overline text-left px-4 py-3 font-normal">Name</th>
              <th className="overline text-left px-4 py-3 font-normal">Role</th>
              <th className="w-32"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-zinc-100" data-testid={`user-row-${r.id}`}>
                <td className="px-4 py-3 num text-sm">{r.username}</td>
                <td className="px-4 py-3">{r.name}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${r.role === "admin" ? "bg-[#002FA7] text-white" : r.role === "principal" ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-900"}`}>{r.role}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  {isAdmin && (
                    <div className="inline-flex gap-1">
                      <button onClick={() => openEdit(r)} className="p-1.5 hover:bg-zinc-100 rounded-sm" data-testid={`edit-user-${r.id}`}><Pencil size={14} /></button>
                      {r.id !== me.id && (
                        <button onClick={() => remove(r)} className="p-1.5 hover:bg-red-50 rounded-sm text-[#FF3B30]" data-testid={`delete-user-${r.id}`}><Trash2 size={14} /></button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center z-50 p-4">
          <form onSubmit={save} className="bg-white border border-zinc-200 rounded-sm w-full max-w-md" data-testid="user-form">
            <div className="flex items-center justify-between px-5 h-14 border-b border-zinc-200">
              <div className="font-display font-semibold">{editing ? "Edit user" : "New user"}</div>
              <button type="button" onClick={() => setOpen(false)} className="p-1 hover:bg-zinc-100 rounded-sm"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              {!editing && (
                <div>
                  <label className="overline block mb-2">Username *</label>
                  <input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="w-full h-10 px-3 border border-zinc-300 rounded-sm num" data-testid="user-username-input" />
                </div>
              )}
              <div>
                <label className="overline block mb-2">Full name *</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full h-10 px-3 border border-zinc-300 rounded-sm" data-testid="user-name-input" />
              </div>
              <div>
                <label className="overline block mb-2">Role *</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full h-10 px-3 border border-zinc-300 rounded-sm bg-white" data-testid="user-role-select">
                  <option value="admin">Admin</option>
                  <option value="principal">Principal</option>
                  <option value="staff">Staff</option>
                </select>
              </div>
              <div>
                <label className="overline block mb-2">{editing ? "New password (leave blank to keep)" : "Password *"}</label>
                <input type="password" required={!editing} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full h-10 px-3 border border-zinc-300 rounded-sm" data-testid="user-password-input" />
              </div>
            </div>
            <div className="border-t border-zinc-200 p-4 flex justify-end gap-2">
              <button type="button" className="btn-ghost h-9 px-4" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="btn-primary h-9 px-4" data-testid="save-user-btn">{editing ? "Save" : "Create"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
