import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api, { formatApiError, inr } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ArrowLeft, Plus, X, FileText, Receipt as ReceiptIcon, Percent, Wallet } from "lucide-react";
import { toast } from "sonner";

const FREQ_OPTIONS = [
  { v: "monthly", label: "Monthly" },
  { v: "quarterly", label: "Quarterly" },
  { v: "yearly", label: "Yearly" },
  { v: "one_time", label: "One-time" },
];

export default function StudentDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const [student, setStudent] = useState(null);
  const [cls, setCls] = useState(null);
  const [fee, setFee] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [components, setComponents] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [discounts, setDiscounts] = useState([]);

  const [invOpen, setInvOpen] = useState(false);
  const [invForm, setInvForm] = useState({ frequency: "monthly", period_label: "", component_ids: [], due_date: "", notes: "" });

  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState({ invoice_id: "", amount: 0, method: "cash", reference: "", notes: "" });

  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideForm, setOverrideForm] = useState({ fee_component_id: "", amount: 0 });

  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountForm, setDiscountForm] = useState({ fee_component_id: "", amount: 0, reason: "" });

  const load = async () => {
    const [s, fs, inv, pay, comps, ovs, disc] = await Promise.all([
      api.get(`/students/${id}`),
      api.get(`/students/${id}/fee-structure`),
      api.get(`/invoices?student_id=${id}`),
      api.get(`/payments?student_id=${id}`),
      api.get(`/fee-components`).catch(() => ({ data: [] })),
      api.get(`/fee-overrides?scope=student&scope_id=${id}`).catch(() => ({ data: [] })),
      api.get(`/discounts?student_id=${id}`).catch(() => ({ data: [] })),
    ]);
    setStudent(s.data);
    setFee(fs.data);
    setInvoices(inv.data);
    setPayments(pay.data);
    setComponents(comps.data);
    setOverrides(ovs.data);
    setDiscounts(disc.data);
    try {
      const c = await api.get(`/classes`);
      setCls(c.data.find((x) => x.id === s.data.class_id));
    } catch {}
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  if (!student || !fee) return <div className="text-zinc-500 text-sm">Loading…</div>;

  const createInvoice = async (e) => {
    e.preventDefault();
    try {
      const payload = { student_id: id, ...invForm };
      if (!payload.component_ids?.length) delete payload.component_ids;
      await api.post("/invoices", payload);
      setInvOpen(false);
      toast.success("Invoice created");
      setInvForm({ frequency: "monthly", period_label: "", component_ids: [], due_date: "", notes: "" });
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const createPayment = async (e) => {
    e.preventDefault();
    try {
      await api.post("/payments", { ...payForm, amount: Number(payForm.amount) });
      setPayOpen(false);
      toast.success("Payment recorded — receipt ready");
      setPayForm({ invoice_id: "", amount: 0, method: "cash", reference: "", notes: "" });
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const saveOverride = async (e) => {
    e.preventDefault();
    try {
      await api.post("/fee-overrides", { scope: "student", scope_id: id, fee_component_id: overrideForm.fee_component_id, amount: Number(overrideForm.amount) });
      setOverrideOpen(false);
      toast.success("Student fee override saved");
      setOverrideForm({ fee_component_id: "", amount: 0 });
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const removeOverride = async (o) => {
    if (!confirm("Remove this override?")) return;
    try { await api.delete(`/fee-overrides/${o.id}`); toast.success("Removed"); load(); } catch (err) { toast.error(formatApiError(err)); }
  };

  const saveDiscount = async (e) => {
    e.preventDefault();
    try {
      const payload = { student_id: id, amount: Number(discountForm.amount), reason: discountForm.reason };
      if (discountForm.fee_component_id) payload.fee_component_id = discountForm.fee_component_id;
      await api.post("/discounts", payload);
      setDiscountOpen(false);
      toast.success("Discount added");
      setDiscountForm({ fee_component_id: "", amount: 0, reason: "" });
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const removeDiscount = async (d) => {
    if (!confirm("Delete discount?")) return;
    try { await api.delete(`/discounts/${d.id}`); toast.success("Deleted"); load(); } catch (err) { toast.error(formatApiError(err)); }
  };

  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const totalDue = invoices.reduce((s, i) => s + Math.max(0, Number(i.total) - Number(i.paid_amount || 0)), 0);
  const componentMap = Object.fromEntries(components.map((c) => [c.id, c]));

  return (
    <div className="space-y-8" data-testid="student-detail-page">
      <div>
        <Link to="/students" className="text-xs text-zinc-500 hover:text-zinc-900 inline-flex items-center gap-1 mb-3">
          <ArrowLeft size={13} /> All students
        </Link>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="overline mb-1">Student profile</div>
            <h2 className="font-display text-3xl font-semibold tracking-tight">{student.name}</h2>
            <div className="text-sm text-zinc-500 mt-1">
              {cls?.name}{cls?.section && ` — ${cls.section}`} · Roll <span className="num">{student.roll_no || "—"}</span> · Adm <span className="num">{student.admission_no || "—"}</span>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {can("invoices", "edit") && (
              <button onClick={() => setInvOpen(true)} className="btn-primary h-10 px-4 flex items-center gap-2" data-testid="new-invoice-btn"><FileText size={15} /> Generate invoice</button>
            )}
            {can("payments", "edit") && (
              <button onClick={() => { setPayForm({ ...payForm, invoice_id: invoices.find((i) => i.status !== "paid")?.id || "" }); setPayOpen(true); }} className="btn-ghost h-10 px-4 flex items-center gap-2" data-testid="new-payment-btn"><ReceiptIcon size={15} /> Record payment</button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-flat p-5">
          <div className="overline mb-2">Guardian</div>
          <div className="font-medium">{student.guardian_name || "—"}</div>
          <div className="num text-sm text-zinc-600">{student.guardian_phone || "—"}</div>
        </div>
        <div className="card-flat p-5">
          <div className="overline mb-2">Paid to date</div>
          <div className="font-display text-2xl font-semibold">{inr(totalPaid)}</div>
        </div>
        <div className="card-flat p-5">
          <div className="overline mb-2">Outstanding</div>
          <div className="font-display text-2xl font-semibold text-[#0A0A0A]">{inr(totalDue)}</div>
        </div>
      </div>

      {/* Fee structure */}
      <section className="card-flat">
        <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between">
          <div className="overline flex items-center gap-2"><Wallet size={13} /> Effective fee structure</div>
          {can("fee_components", "edit") && (
            <button onClick={() => setOverrideOpen(true)} className="text-xs text-[#002FA7] hover:underline" data-testid="add-override-btn">+ Set student-specific amount</button>
          )}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200">
              <th className="overline text-left px-5 py-2 font-normal">Component</th>
              <th className="overline text-left px-5 py-2 font-normal">Frequency</th>
              <th className="overline text-right px-5 py-2 font-normal">Amount</th>
              <th className="overline text-right px-5 py-2 font-normal">Discount</th>
              <th className="overline text-right px-5 py-2 font-normal">Effective</th>
            </tr>
          </thead>
          <tbody>
            {fee.items.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-zinc-500 text-sm">No fee components defined.</td></tr>
            ) : (
              fee.items.map((it) => (
                <tr key={it.fee_component_id} className="border-t border-zinc-100">
                  <td className="px-5 py-2 font-medium">{it.name}</td>
                  <td className="px-5 py-2 text-xs uppercase tracking-wider text-zinc-500">{it.frequency.replace("_", " ")}</td>
                  <td className="px-5 py-2 num-r">{inr(it.amount)}</td>
                  <td className="px-5 py-2 num-r text-[#FF3B30]">{it.discount ? `− ${inr(it.discount)}` : "—"}</td>
                  <td className="px-5 py-2 num-r font-semibold">{inr(Math.max(0, it.amount - it.discount))}</td>
                </tr>
              ))
            )}
            {fee.general_discount > 0 && (
              <tr className="border-t border-zinc-200 bg-zinc-50">
                <td colSpan={3} className="px-5 py-2 text-xs text-zinc-500">General discount (applies to any invoice)</td>
                <td className="px-5 py-2 num-r text-[#FF3B30]">− {inr(fee.general_discount)}</td>
                <td></td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Overrides */}
      {overrides.length > 0 && (
        <section className="card-flat">
          <div className="px-5 py-4 border-b border-zinc-200 overline">Student-specific overrides</div>
          <table className="w-full text-sm">
            <tbody>
              {overrides.map((o) => (
                <tr key={o.id} className="border-t border-zinc-100">
                  <td className="px-5 py-2 font-medium">{componentMap[o.fee_component_id]?.name || o.fee_component_id}</td>
                  <td className="px-5 py-2 num-r">{inr(o.amount)}</td>
                  <td className="px-5 py-2 text-right">
                    {can("fee_components", "delete") && (
                      <button onClick={() => removeOverride(o)} className="text-xs text-[#FF3B30] hover:underline" data-testid={`remove-override-${o.id}`}>Remove</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Discounts */}
      <section className="card-flat">
        <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between">
          <div className="overline flex items-center gap-2"><Percent size={13} /> Special discounts</div>
          {can("discounts", "edit") && (
            <button onClick={() => setDiscountOpen(true)} className="text-xs text-[#002FA7] hover:underline" data-testid="add-discount-btn">+ Add discount</button>
          )}
        </div>
        {discounts.length === 0 ? (
          <div className="text-sm text-zinc-500 px-5 py-6">No special discounts.</div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {discounts.map((d) => (
                <tr key={d.id} className="border-t border-zinc-100">
                  <td className="px-5 py-2">{d.fee_component_id ? componentMap[d.fee_component_id]?.name || d.fee_component_id : <span className="text-zinc-500">General</span>}</td>
                  <td className="px-5 py-2 text-zinc-600 text-xs">{d.reason || "—"}</td>
                  <td className="px-5 py-2 num-r text-[#FF3B30]">− {inr(d.amount)}</td>
                  <td className="px-5 py-2 text-right">
                    {can("discounts", "delete") && (
                      <button onClick={() => removeDiscount(d)} className="text-xs text-[#FF3B30] hover:underline" data-testid={`remove-discount-${d.id}`}>Remove</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Invoices */}
      <section className="card-flat">
        <div className="px-5 py-4 border-b border-zinc-200 overline">Invoices</div>
        {invoices.length === 0 ? (
          <div className="px-5 py-6 text-sm text-zinc-500">No invoices yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="overline text-left px-5 py-2 font-normal">Invoice</th>
                <th className="overline text-left px-5 py-2 font-normal">Period</th>
                <th className="overline text-right px-5 py-2 font-normal">Total</th>
                <th className="overline text-right px-5 py-2 font-normal">Paid</th>
                <th className="overline text-right px-5 py-2 font-normal">Balance</th>
                <th className="overline text-right px-5 py-2 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id} className="border-t border-zinc-100">
                  <td className="px-5 py-2 num text-xs">{i.invoice_number}</td>
                  <td className="px-5 py-2">{i.period_label}</td>
                  <td className="px-5 py-2 num-r">{inr(i.total)}</td>
                  <td className="px-5 py-2 num-r">{inr(i.paid_amount || 0)}</td>
                  <td className="px-5 py-2 num-r font-semibold">{inr(Math.max(0, i.total - (i.paid_amount || 0)))}</td>
                  <td className="px-5 py-2 text-right">
                    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${i.status === "paid" ? "bg-[#34C759]/15 text-[#0d7a2d]" : i.status === "partial" ? "bg-[#FFD700]/25 text-[#7a5a00]" : "bg-zinc-200 text-zinc-700"}`}>{i.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Receipts */}
      <section className="card-flat">
        <div className="px-5 py-4 border-b border-zinc-200 overline">Payment receipts</div>
        {payments.length === 0 ? (
          <div className="px-5 py-6 text-sm text-zinc-500">No payments recorded.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="overline text-left px-5 py-2 font-normal">Receipt</th>
                <th className="overline text-left px-5 py-2 font-normal">Period</th>
                <th className="overline text-left px-5 py-2 font-normal">Method</th>
                <th className="overline text-right px-5 py-2 font-normal">Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-t border-zinc-100">
                  <td className="px-5 py-2 num text-xs">{p.receipt_number}</td>
                  <td className="px-5 py-2">{p.period_label}</td>
                  <td className="px-5 py-2 text-xs uppercase tracking-wider text-zinc-500">{p.method}</td>
                  <td className="px-5 py-2 num-r font-semibold">{inr(p.amount)}</td>
                  <td className="px-5 py-2 text-right">
                    <Link to={`/receipts/${p.id}/print`} target="_blank" className="text-xs text-[#002FA7] hover:underline" data-testid={`view-receipt-${p.id}`}>Open receipt</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Invoice modal */}
      {invOpen && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center z-50 p-4 no-print">
          <form onSubmit={createInvoice} className="bg-white border border-zinc-200 rounded-sm w-full max-w-lg" data-testid="invoice-form">
            <div className="flex items-center justify-between px-5 h-14 border-b border-zinc-200">
              <div className="font-display font-semibold">Generate invoice</div>
              <button type="button" onClick={() => setInvOpen(false)} className="p-1 hover:bg-zinc-100 rounded-sm"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="overline block mb-2">Frequency *</label>
                <select value={invForm.frequency} onChange={(e) => setInvForm({ ...invForm, frequency: e.target.value, component_ids: [] })} className="w-full h-10 px-3 border border-zinc-300 rounded-sm bg-white" data-testid="invoice-frequency">
                  {FREQ_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="overline block mb-2">Period label *</label>
                <input required placeholder="Jan 2026 / Q1 2026 / AY 2025-26" value={invForm.period_label} onChange={(e) => setInvForm({ ...invForm, period_label: e.target.value })} className="w-full h-10 px-3 border border-zinc-300 rounded-sm" data-testid="invoice-period" />
              </div>
              <div>
                <label className="overline block mb-2">Components (optional — leave empty for all matching)</label>
                <div className="border border-zinc-200 rounded-sm max-h-40 overflow-y-auto p-2 space-y-1">
                  {components.filter((c) => c.frequency === invForm.frequency).length === 0 ? (
                    <div className="text-xs text-zinc-500 p-2">No components with this frequency.</div>
                  ) : (
                    components.filter((c) => c.frequency === invForm.frequency).map((c) => (
                      <label key={c.id} className="flex items-center gap-2 text-sm px-2 py-1 hover:bg-zinc-50 cursor-pointer">
                        <input type="checkbox" checked={invForm.component_ids.includes(c.id)} onChange={(e) => setInvForm({ ...invForm, component_ids: e.target.checked ? [...invForm.component_ids, c.id] : invForm.component_ids.filter((x) => x !== c.id) })} />
                        {c.name}
                      </label>
                    ))
                  )}
                </div>
              </div>
              <div>
                <label className="overline block mb-2">Due date</label>
                <input type="date" value={invForm.due_date} onChange={(e) => setInvForm({ ...invForm, due_date: e.target.value })} className="w-full h-10 px-3 border border-zinc-300 rounded-sm" />
              </div>
            </div>
            <div className="border-t border-zinc-200 p-4 flex justify-end gap-2">
              <button type="button" className="btn-ghost h-9 px-4" onClick={() => setInvOpen(false)}>Cancel</button>
              <button type="submit" className="btn-primary h-9 px-4" data-testid="save-invoice-btn">Generate</button>
            </div>
          </form>
        </div>
      )}

      {/* Payment modal */}
      {payOpen && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center z-50 p-4 no-print">
          <form onSubmit={createPayment} className="bg-white border border-zinc-200 rounded-sm w-full max-w-lg" data-testid="payment-form">
            <div className="flex items-center justify-between px-5 h-14 border-b border-zinc-200">
              <div className="font-display font-semibold">Record payment</div>
              <button type="button" onClick={() => setPayOpen(false)} className="p-1 hover:bg-zinc-100 rounded-sm"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="overline block mb-2">Invoice *</label>
                <select required value={payForm.invoice_id} onChange={(e) => {
                  const inv = invoices.find((x) => x.id === e.target.value);
                  const remaining = inv ? Math.max(0, Number(inv.total) - Number(inv.paid_amount || 0)) : 0;
                  setPayForm({ ...payForm, invoice_id: e.target.value, amount: remaining });
                }} className="w-full h-10 px-3 border border-zinc-300 rounded-sm bg-white" data-testid="payment-invoice-select">
                  <option value="">—</option>
                  {invoices.filter((i) => i.status !== "paid").map((i) => (
                    <option key={i.id} value={i.id}>{i.invoice_number} · {i.period_label} · Balance {inr(i.total - (i.paid_amount || 0))}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="overline block mb-2">Amount (₹) *</label>
                <input type="number" required min="0.01" step="0.01" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} className="w-full h-10 px-3 border border-zinc-300 rounded-sm num" data-testid="payment-amount" />
              </div>
              <div>
                <label className="overline block mb-2">Method</label>
                <select value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })} className="w-full h-10 px-3 border border-zinc-300 rounded-sm bg-white">
                  <option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="bank">Bank Transfer</option><option value="cheque">Cheque</option>
                </select>
              </div>
              <div>
                <label className="overline block mb-2">Reference / Txn ID</label>
                <input value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} className="w-full h-10 px-3 border border-zinc-300 rounded-sm" />
              </div>
            </div>
            <div className="border-t border-zinc-200 p-4 flex justify-end gap-2">
              <button type="button" className="btn-ghost h-9 px-4" onClick={() => setPayOpen(false)}>Cancel</button>
              <button type="submit" className="btn-primary h-9 px-4" data-testid="save-payment-btn">Record & issue receipt</button>
            </div>
          </form>
        </div>
      )}

      {/* Override modal */}
      {overrideOpen && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center z-50 p-4 no-print">
          <form onSubmit={saveOverride} className="bg-white border border-zinc-200 rounded-sm w-full max-w-md">
            <div className="flex items-center justify-between px-5 h-14 border-b border-zinc-200">
              <div className="font-display font-semibold">Student-specific fee amount</div>
              <button type="button" onClick={() => setOverrideOpen(false)} className="p-1 hover:bg-zinc-100 rounded-sm"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="overline block mb-2">Component *</label>
                <select required value={overrideForm.fee_component_id} onChange={(e) => setOverrideForm({ ...overrideForm, fee_component_id: e.target.value })} className="w-full h-10 px-3 border border-zinc-300 rounded-sm bg-white">
                  <option value="">—</option>
                  {components.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.frequency})</option>)}
                </select>
              </div>
              <div>
                <label className="overline block mb-2">Amount (₹) *</label>
                <input type="number" required min="0" step="0.01" value={overrideForm.amount} onChange={(e) => setOverrideForm({ ...overrideForm, amount: e.target.value })} className="w-full h-10 px-3 border border-zinc-300 rounded-sm num" />
              </div>
            </div>
            <div className="border-t border-zinc-200 p-4 flex justify-end gap-2">
              <button type="button" className="btn-ghost h-9 px-4" onClick={() => setOverrideOpen(false)}>Cancel</button>
              <button type="submit" className="btn-primary h-9 px-4">Save</button>
            </div>
          </form>
        </div>
      )}

      {/* Discount modal */}
      {discountOpen && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center z-50 p-4 no-print">
          <form onSubmit={saveDiscount} className="bg-white border border-zinc-200 rounded-sm w-full max-w-md" data-testid="discount-form">
            <div className="flex items-center justify-between px-5 h-14 border-b border-zinc-200">
              <div className="font-display font-semibold">Add discount</div>
              <button type="button" onClick={() => setDiscountOpen(false)} className="p-1 hover:bg-zinc-100 rounded-sm"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="overline block mb-2">Applies to</label>
                <select value={discountForm.fee_component_id} onChange={(e) => setDiscountForm({ ...discountForm, fee_component_id: e.target.value })} className="w-full h-10 px-3 border border-zinc-300 rounded-sm bg-white" data-testid="discount-component-select">
                  <option value="">General (any invoice)</option>
                  {components.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.frequency})</option>)}
                </select>
              </div>
              <div>
                <label className="overline block mb-2">Amount (₹) *</label>
                <input type="number" required min="0" step="0.01" value={discountForm.amount} onChange={(e) => setDiscountForm({ ...discountForm, amount: e.target.value })} className="w-full h-10 px-3 border border-zinc-300 rounded-sm num" data-testid="discount-amount" />
              </div>
              <div>
                <label className="overline block mb-2">Reason</label>
                <input value={discountForm.reason} onChange={(e) => setDiscountForm({ ...discountForm, reason: e.target.value })} className="w-full h-10 px-3 border border-zinc-300 rounded-sm" placeholder="Sibling, merit, etc." />
              </div>
            </div>
            <div className="border-t border-zinc-200 p-4 flex justify-end gap-2">
              <button type="button" className="btn-ghost h-9 px-4" onClick={() => setDiscountOpen(false)}>Cancel</button>
              <button type="submit" className="btn-primary h-9 px-4" data-testid="save-discount-btn">Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
