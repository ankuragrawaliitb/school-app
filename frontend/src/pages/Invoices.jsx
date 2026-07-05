import { useEffect, useMemo, useState } from "react";
import api, { formatApiError, inr } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Trash2, ArrowRight, Filter } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

export default function Invoices() {
  const { can } = useAuth();
  const [rows, setRows] = useState([]);
  const [students, setStudents] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [studentFilter, setStudentFilter] = useState("");

  const load = async () => {
    const q = [];
    if (studentFilter) q.push(`student_id=${studentFilter}`);
    if (statusFilter) q.push(`status_filter=${statusFilter}`);
    const [i, s] = await Promise.all([api.get(`/invoices?${q.join("&")}`), api.get("/students")]);
    setRows(i.data);
    setStudents(s.data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [studentFilter, statusFilter]);

  const stMap = useMemo(() => Object.fromEntries(students.map((s) => [s.id, s])), [students]);

  const remove = async (r) => {
    if (!confirm(`Delete invoice ${r.invoice_number}?`)) return;
    try { await api.delete(`/invoices/${r.id}`); toast.success("Deleted"); load(); } catch (err) { toast.error(formatApiError(err)); }
  };

  return (
    <div className="space-y-6" data-testid="invoices-page">
      <div>
        <div className="overline mb-1">Billing</div>
        <h2 className="font-display text-2xl font-semibold">Invoices</h2>
        <p className="text-sm text-zinc-500 mt-1">Generate invoices from a student profile. All invoices for the school appear here.</p>
      </div>

      <div className="flex gap-3 items-center flex-wrap">
        <Filter size={14} className="text-zinc-400" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 px-3 border border-zinc-300 rounded-sm bg-white text-sm" data-testid="filter-status">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
        </select>
        <select value={studentFilter} onChange={(e) => setStudentFilter(e.target.value)} className="h-10 px-3 border border-zinc-300 rounded-sm bg-white text-sm">
          <option value="">All students</option>
          {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <div className="card-flat overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200">
              <th className="overline text-left px-4 py-3 font-normal">Invoice</th>
              <th className="overline text-left px-4 py-3 font-normal">Student</th>
              <th className="overline text-left px-4 py-3 font-normal">Period</th>
              <th className="overline text-right px-4 py-3 font-normal">Subtotal</th>
              <th className="overline text-right px-4 py-3 font-normal">Discount</th>
              <th className="overline text-right px-4 py-3 font-normal">Total</th>
              <th className="overline text-right px-4 py-3 font-normal">Paid</th>
              <th className="overline text-right px-4 py-3 font-normal">Status</th>
              <th className="w-24"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-10 text-sm text-zinc-500">No invoices found.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-zinc-100 hover:bg-zinc-50" data-testid={`invoice-row-${r.id}`}>
                  <td className="px-4 py-3 num text-xs">{r.invoice_number}</td>
                  <td className="px-4 py-3">{r.student_name}</td>
                  <td className="px-4 py-3 text-zinc-600">{r.period_label}</td>
                  <td className="px-4 py-3 num-r">{inr(r.subtotal)}</td>
                  <td className="px-4 py-3 num-r text-[#FF3B30]">{r.total_discount ? `− ${inr(r.total_discount)}` : "—"}</td>
                  <td className="px-4 py-3 num-r font-semibold">{inr(r.total)}</td>
                  <td className="px-4 py-3 num-r">{inr(r.paid_amount || 0)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${r.status === "paid" ? "bg-[#34C759]/15 text-[#0d7a2d]" : r.status === "partial" ? "bg-[#FFD700]/25 text-[#7a5a00]" : "bg-zinc-200 text-zinc-700"}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <Link to={`/students/${r.student_id}`} className="p-1.5 hover:bg-zinc-100 rounded-sm text-[#002FA7]" title="Open student"><ArrowRight size={14} /></Link>
                      {can("invoices", "delete") && r.paid_amount === 0 && (
                        <button onClick={() => remove(r)} className="p-1.5 hover:bg-red-50 rounded-sm text-[#FF3B30]" data-testid={`delete-invoice-${r.id}`}><Trash2 size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
