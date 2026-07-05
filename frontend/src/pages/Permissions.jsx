import { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const RESOURCE_LABELS = {
  students: "Students",
  classes: "Classes",
  fee_components: "Fee structure",
  discounts: "Discounts",
  invoices: "Invoices",
  payments: "Payments & receipts",
  users: "Users",
  settings: "Settings",
};

export default function Permissions() {
  const { user, refreshPermissions } = useAuth();
  const [perms, setPerms] = useState({});
  const [meta, setMeta] = useState({ resources: [], actions: [], roles: [] });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await api.get("/permissions");
    setPerms(data.permissions);
    setMeta({ resources: data.resources, actions: data.actions, roles: data.roles });
  };
  useEffect(() => { load(); }, []);

  const toggle = (role, resource, action) => {
    if (role === "admin") return;
    setPerms((p) => {
      const next = JSON.parse(JSON.stringify(p));
      next[role] = next[role] || {};
      next[role][resource] = next[role][resource] || {};
      next[role][resource][action] = !next[role][resource][action];
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/permissions", { permissions: perms });
      toast.success("Permissions updated");
      await refreshPermissions();
    } catch (err) { toast.error(formatApiError(err)); }
    setSaving(false);
  };

  if (user?.role !== "admin") {
    return <div className="card-flat p-10 text-center text-sm text-zinc-500"><ShieldCheck size={24} className="mx-auto text-zinc-300 mb-3" />Only administrators can manage permissions.</div>;
  }

  return (
    <div className="space-y-6" data-testid="permissions-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="overline mb-1">Access control</div>
          <h2 className="font-display text-2xl font-semibold">Role permissions</h2>
          <p className="text-sm text-zinc-500 mt-1 max-w-2xl">Configure what Principal and Staff can view, edit or delete. Admin always has full access.</p>
        </div>
        <button onClick={save} disabled={saving} className="btn-primary h-10 px-4 flex items-center gap-2" data-testid="save-permissions-btn"><Save size={15} /> {saving ? "Saving…" : "Save changes"}</button>
      </div>

      {meta.roles.filter((r) => r !== "admin").map((role) => (
        <div key={role} className="card-flat" data-testid={`role-${role}`}>
          <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between">
            <div>
              <div className="overline">Role</div>
              <div className="font-display text-lg font-semibold capitalize">{role}</div>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="overline text-left px-5 py-2 font-normal">Resource</th>
                {meta.actions.map((a) => (
                  <th key={a} className="overline text-center px-5 py-2 font-normal">{a}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {meta.resources.map((res) => (
                <tr key={res} className="border-t border-zinc-100">
                  <td className="px-5 py-2 font-medium">{RESOURCE_LABELS[res] || res}</td>
                  {meta.actions.map((a) => {
                    const val = !!perms?.[role]?.[res]?.[a];
                    return (
                      <td key={a} className="text-center py-2">
                        <button
                          type="button"
                          onClick={() => toggle(role, res, a)}
                          data-testid={`perm-${role}-${res}-${a}`}
                          className={`w-11 h-6 rounded-sm relative transition-colors ${val ? "bg-[#002FA7]" : "bg-zinc-200"}`}
                        >
                          <span className={`absolute top-0.5 w-5 h-5 rounded-sm bg-white transition-all ${val ? "left-[22px]" : "left-0.5"}`} />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
