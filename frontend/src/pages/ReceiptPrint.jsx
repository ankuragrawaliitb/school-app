import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api, { inr } from "@/lib/api";
import { Printer, Download, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { toast } from "sonner";

export default function ReceiptPrint() {
  const { id } = useParams();
  const [receipt, setReceipt] = useState(null);
  const [settings, setSettings] = useState(null);
  const [student, setStudent] = useState(null);
  const [cls, setCls] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    (async () => {
      const p = await api.get(`/payments/${id}`);
      setReceipt(p.data);
      const s = await api.get("/settings").catch(() => ({ data: null }));
      setSettings(s.data || {});
      const st = await api.get(`/students/${p.data.student_id}`).catch(() => ({ data: null }));
      setStudent(st.data);
      if (st.data) {
        const c = await api.get("/classes").catch(() => ({ data: [] }));
        setCls(c.data.find((x) => x.id === st.data.class_id));
      }
    })();
  }, [id]);

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const el = document.getElementById("printable");
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff" });
      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
      const w = canvas.width * ratio;
      const h = canvas.height * ratio;
      pdf.addImage(img, "PNG", (pageW - w) / 2, 24, w, h);
      pdf.save(`${receipt.receipt_number}.pdf`);
      toast.success("PDF downloaded");
    } catch (e) {
      toast.error("Could not generate PDF");
    } finally {
      setDownloading(false);
    }
  };

  if (!receipt) return <div className="p-10 text-sm text-zinc-500">Loading…</div>;

  const s = settings || {};
  const items = receipt.items_snapshot || [];
  const subtotal = items.reduce((sum, it) => sum + Number(it.amount || 0), 0);
  const discount = items.reduce((sum, it) => sum + Number(it.discount || 0), 0);
  const total = Number(receipt.invoice_total || 0);

  return (
    <div className="min-h-screen bg-zinc-100 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-4 no-print">
          <button onClick={() => window.close()} className="btn-ghost h-9 px-3 text-sm">← Close</button>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="btn-ghost h-9 px-3 flex items-center gap-2 text-sm" data-testid="print-receipt-btn">
              <Printer size={14} /> Print
            </button>
            <button onClick={downloadPdf} disabled={downloading} className="btn-primary h-9 px-3 flex items-center gap-2 text-sm disabled:opacity-60" data-testid="download-pdf-btn">
              {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} PDF
            </button>
          </div>
        </div>

        <div id="printable" className="bg-white border border-zinc-200 rounded-sm p-10">
          {/* Header */}
          <div className="flex justify-between items-start border-b border-zinc-900 pb-6 mb-6">
            <div>
              {s.show_logo && s.logo_url ? (
                <img src={s.logo_url} alt="logo" className="h-14 mb-3 object-contain" />
              ) : null}
              <div className="font-display font-bold text-2xl leading-tight">{s.school_name || "My School"}</div>
              {s.address && <div className="text-xs text-zinc-600 mt-1 max-w-sm">{s.address}</div>}
              {(s.phone || s.email) && (
                <div className="text-xs text-zinc-600 mt-0.5 num">
                  {s.phone}{s.phone && s.email && " · "}{s.email}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="overline mb-1">{s.receipt_header || "Fee Receipt"}</div>
              <div className="font-mono text-lg font-bold">{receipt.receipt_number}</div>
              <div className="text-xs text-zinc-500 num mt-1">{new Date(receipt.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
            </div>
          </div>

          {/* Student info */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <div className="overline mb-1">Received from</div>
              <div className="font-display font-semibold text-lg">{receipt.student_name}</div>
              {cls && <div className="text-sm text-zinc-600">{cls.name}{cls.section && ` — ${cls.section}`}</div>}
              {student?.roll_no && <div className="text-xs text-zinc-500 num mt-0.5">Roll: {student.roll_no}</div>}
              {student?.admission_no && <div className="text-xs text-zinc-500 num">Adm no.: {student.admission_no}</div>}
              {student?.guardian_name && <div className="text-xs text-zinc-600 mt-1">Guardian: {student.guardian_name}</div>}
            </div>
            <div>
              <div className="overline mb-1">Payment details</div>
              <div className="text-sm space-y-0.5">
                <div><span className="text-zinc-500">Period:</span> {receipt.period_label}</div>
                <div><span className="text-zinc-500">Invoice:</span> <span className="num text-xs">{receipt.invoice_number}</span></div>
                <div><span className="text-zinc-500">Method:</span> <span className="uppercase">{receipt.method}</span></div>
                {receipt.reference && <div><span className="text-zinc-500">Ref:</span> <span className="num">{receipt.reference}</span></div>}
              </div>
            </div>
          </div>

          {/* Items */}
          <table className="w-full text-sm border-t border-b border-zinc-900">
            <thead>
              <tr className="border-b border-zinc-300">
                <th className="text-left py-2 overline font-normal">Component</th>
                <th className="text-right py-2 overline font-normal">Amount</th>
                <th className="text-right py-2 overline font-normal">Discount</th>
                <th className="text-right py-2 overline font-normal">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={idx} className="border-b border-zinc-100">
                  <td className="py-2">{it.name}</td>
                  <td className="py-2 num-r">{inr(it.amount)}</td>
                  <td className="py-2 num-r">{it.discount ? `− ${inr(it.discount)}` : "—"}</td>
                  <td className="py-2 num-r">{inr(Math.max(0, Number(it.amount) - Number(it.discount || 0)))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="py-2 text-right text-xs text-zinc-500">Subtotal</td>
                <td className="py-2 num-r">{inr(subtotal)}</td>
              </tr>
              {discount > 0 && (
                <tr>
                  <td colSpan={3} className="py-1 text-right text-xs text-zinc-500">Total discount</td>
                  <td className="py-1 num-r text-[#FF3B30]">− {inr(discount)}</td>
                </tr>
              )}
              <tr className="border-t border-zinc-300">
                <td colSpan={3} className="py-2 text-right overline">Invoice total</td>
                <td className="py-2 num-r font-semibold">{inr(total)}</td>
              </tr>
              <tr>
                <td colSpan={3} className="py-2 text-right overline">Paid now</td>
                <td className="py-2 num-r font-bold text-lg">{inr(receipt.amount)}</td>
              </tr>
            </tfoot>
          </table>

          {receipt.notes && (
            <div className="mt-4 text-xs text-zinc-500">Notes: {receipt.notes}</div>
          )}

          <div className="mt-10 grid grid-cols-2 gap-6 items-end">
            <div className="text-xs text-zinc-500">
              <div>{s.receipt_footer || "This is a computer generated receipt."}</div>
              <div className="mt-1">Collected by: <span className="text-zinc-800 num">{receipt.collected_by}</span></div>
            </div>
            {s.show_signature_line !== false && (
              <div className="text-right">
                <div className="border-t border-zinc-400 pt-1 inline-block min-w-[180px]">
                  <div className="overline">Authorised signature</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
