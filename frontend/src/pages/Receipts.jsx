import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { inr } from "@/lib/api";
import { Printer, Download } from "lucide-react";

export default function Receipts() {
  const [rows, setRows] = useState([]);
  useEffect(() => { (async () => { const { data } = await api.get("/payments"); setRows(data); })(); }, []);

  return (
    <div className="space-y-6" data-testid="receipts-page">
      <div>
        <div className="overline mb-1">Collections</div>
        <h2 className="font-display text-2xl font-semibold">Fee receipts</h2>
      </div>

      <div className="card-flat overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200">
              <th className="overline text-left px-4 py-3 font-normal">Receipt no.</th>
              <th className="overline text-left px-4 py-3 font-normal">Student</th>
              <th className="overline text-left px-4 py-3 font-normal">Period</th>
              <th className="overline text-left px-4 py-3 font-normal">Method</th>
              <th className="overline text-left px-4 py-3 font-normal">Date</th>
              <th className="overline text-right px-4 py-3 font-normal">Amount</th>
              <th className="w-40"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-sm text-zinc-500">No receipts issued yet.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                  <td className="px-4 py-3 num text-xs">{r.receipt_number}</td>
                  <td className="px-4 py-3">{r.student_name}</td>
                  <td className="px-4 py-3 text-zinc-600">{r.period_label}</td>
                  <td className="px-4 py-3 text-xs uppercase tracking-wider text-zinc-500">{r.method}</td>
                  <td className="px-4 py-3 num text-xs text-zinc-500">{new Date(r.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
                  <td className="px-4 py-3 num-r font-semibold">{inr(r.amount)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/receipts/${r.id}/print`} target="_blank" className="text-xs text-[#002FA7] hover:underline inline-flex items-center gap-1" data-testid={`open-receipt-${r.id}`}>
                      <Printer size={12} /> Print / PDF
                    </Link>
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
