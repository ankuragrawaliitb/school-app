import { useEffect, useState } from "react";
import api, { inr } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Users, Building2, FileText, TrendingUp, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [s, i, p] = await Promise.all([
          api.get("/stats"),
          api.get("/invoices").catch(() => ({ data: [] })),
          api.get("/payments").catch(() => ({ data: [] })),
        ]);
        setStats(s.data);
        setInvoices(i.data.slice(0, 6));
        setPayments(p.data.slice(0, 6));
      } catch {}
    })();
  }, []);

  const cards = stats
    ? [
        { label: "Students enrolled", value: stats.total_students, icon: Users, testid: "stat-students" },
        { label: "Classes", value: stats.total_classes, icon: Building2, testid: "stat-classes" },
        { label: "Invoices pending", value: stats.total_pending_invoices, icon: FileText, testid: "stat-pending" },
        { label: "Outstanding", value: inr(stats.outstanding), icon: TrendingUp, testid: "stat-outstanding", isCurrency: true },
      ]
    : [];

  return (
    <div className="space-y-8" data-testid="dashboard-page">
      <div>
        <div className="overline mb-1">Welcome back, {user?.name}</div>
        <h2 className="font-display text-3xl font-semibold tracking-tight">Operations overview</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="card-flat p-5" data-testid={c.testid}>
              <div className="flex items-start justify-between mb-4">
                <div className="overline">{c.label}</div>
                <Icon size={16} className="text-zinc-400" />
              </div>
              <div className={`font-display font-semibold tracking-tight ${c.isCurrency ? "text-2xl" : "text-4xl"}`}>
                {c.value ?? "—"}
              </div>
            </div>
          );
        })}
      </div>

      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card-flat p-5">
            <div className="overline mb-4">Collections</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-zinc-500 mb-1">This month</div>
                <div className="font-display text-2xl font-semibold">{inr(stats.collected_this_month)}</div>
              </div>
              <div>
                <div className="text-xs text-zinc-500 mb-1">All time</div>
                <div className="font-display text-2xl font-semibold">{inr(stats.collected_total)}</div>
              </div>
            </div>
          </div>
          <div className="card-flat p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="overline">Recent invoices</div>
              <Link to="/invoices" className="text-xs text-[#002FA7] hover:underline inline-flex items-center gap-1">
                View all <ArrowUpRight size={12} />
              </Link>
            </div>
            {invoices.length === 0 ? (
              <div className="text-sm text-zinc-500 py-6 text-center">No invoices yet.</div>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {invoices.map((i) => (
                    <tr key={i.id} className="border-t border-zinc-100">
                      <td className="py-2">{i.student_name}</td>
                      <td className="py-2 text-zinc-500 text-xs">{i.period_label}</td>
                      <td className="py-2 num-r">{inr(i.total)}</td>
                      <td className="py-2 text-right">
                        <span
                          className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${
                            i.status === "paid"
                              ? "bg-[#34C759]/15 text-[#0d7a2d]"
                              : i.status === "partial"
                              ? "bg-[#FFD700]/25 text-[#7a5a00]"
                              : "bg-zinc-200 text-zinc-700"
                          }`}
                        >
                          {i.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      <div className="card-flat p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="overline">Recent receipts</div>
          <Link to="/receipts" className="text-xs text-[#002FA7] hover:underline inline-flex items-center gap-1">
            View all <ArrowUpRight size={12} />
          </Link>
        </div>
        {payments.length === 0 ? (
          <div className="text-sm text-zinc-500 py-6 text-center">No payments recorded yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="overline text-left py-2 font-normal">Receipt</th>
                <th className="overline text-left py-2 font-normal">Student</th>
                <th className="overline text-left py-2 font-normal">Period</th>
                <th className="overline text-right py-2 font-normal">Amount</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-t border-zinc-100">
                  <td className="py-2 num">{p.receipt_number}</td>
                  <td className="py-2">{p.student_name}</td>
                  <td className="py-2 text-zinc-500 text-xs">{p.period_label}</td>
                  <td className="py-2 num-r">{inr(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
