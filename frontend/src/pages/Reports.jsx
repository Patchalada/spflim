import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Download, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react';
import api from '../api/axios';
import useToast from '../components/useToast';

const formatMoney = (value) => Number(value || 0).toLocaleString('th-TH');
const localDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

function downloadCsv(filename, rows) {
  if (!rows.length) return false;
  const headers = Object.keys(rows[0]);
  const escape = (value) => {
    const safeValue = /^[=+\-@]/.test(String(value ?? '')) ? `'${value}` : String(value ?? '');
    return `"${safeValue.replaceAll('"', '""')}"`;
  };
  const csv = [headers.map(escape).join(','), ...rows.map((row) => headers.map((key) => escape(row[key])).join(','))].join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  return true;
}

async function fetchReportData(dateRange) {
  const params = {
    start_date: dateRange.start_date || undefined,
    end_date: dateRange.end_date || undefined
  };
  const [summaryRes, monthlyRes, roomsRes, tenantsRes, paymentsRes, transactionsRes] = await Promise.all([
    api.get('/reports/dashboard', { params }),
    api.get('/reports/monthly-financial', { params }),
    api.get('/reports/rooms'),
    api.get('/reports/tenants'),
    api.get('/reports/payments', { params }),
    api.get('/transactions', { params })
  ]);
  return {
    summary: summaryRes.data,
    monthly: monthlyRes.data,
    rooms: roomsRes.data,
    tenants: tenantsRes.data,
    payments: paymentsRes.data,
    transactions: transactionsRes.data
  };
}

export default function Reports() {
  const notify = useToast();
  const location = useLocation();
  const [summary, setSummary] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [payments, setPayments] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [dateRange, setDateRange] = useState(() => ({
    start_date: `${new Date().getFullYear()}-01-01`,
    end_date: localDate()
  }));
  const [expense, setExpense] = useState({
    category: '',
    amount: '',
    description: '',
    transaction_date: localDate()
  });

  const loadReports = async () => {
    setLoading(true);
    try {
      const data = await fetchReportData(dateRange);
      setSummary(data.summary);
      setMonthly(data.monthly);
      setRooms(data.rooms);
      setTenants(data.tenants);
      setPayments(data.payments);
      setTransactions(data.transactions);
      setLastUpdated(new Date());
    } catch (err) {
      notify(err.response?.data?.error || 'โหลดรายงานไม่สำเร็จ', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    let refreshing = false;
    const refreshReports = async (initialLoad) => {
      if (refreshing) return;
      refreshing = true;
      try {
        const data = await fetchReportData(dateRange);
        if (cancelled) return;
        setSummary(data.summary);
        setMonthly(data.monthly);
        setRooms(data.rooms);
        setTenants(data.tenants);
        setPayments(data.payments);
        setTransactions(data.transactions);
        setLastUpdated(new Date());
      } catch (err) {
        if (!cancelled && initialLoad) notify(err.response?.data?.error || 'โหลดรายงานไม่สำเร็จ', 'error');
        else if (!cancelled) console.error('Automatic report refresh failed:', err);
      } finally {
        refreshing = false;
        if (!cancelled && initialLoad) setLoading(false);
      }
    };
    void refreshReports(true);
    const intervalId = setInterval(() => void refreshReports(false), 30000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [dateRange, notify]);

  useEffect(() => {
    if (!loading && location.hash === '#expense-transactions') {
      document.getElementById('expense-transactions')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [loading, location.hash]);

  const handleAddExpense = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/transactions/expenses', {
        ...expense,
        amount: Number(expense.amount)
      });
      setExpense({
        category: '',
        amount: '',
        description: '',
        transaction_date: localDate()
      });
      await loadReports();
      notify('บันทึกรายจ่ายแล้ว', 'success');
    } catch (err) {
      notify(err.response?.data?.error || 'บันทึกรายจ่ายไม่สำเร็จ', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/transactions/expenses/${editingExpense.transaction_id}`, {
        category: editingExpense.category,
        amount: Number(editingExpense.amount),
        description: editingExpense.description,
        transaction_date: editingExpense.transaction_date
      });
      setEditingExpense(null);
      await loadReports();
    } catch (err) {
      notify(err.response?.data?.error || 'บันทึกรายจ่ายไม่สำเร็จ', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExpense = async (transaction) => {
    if (!confirm(`ยืนยันลบรายจ่าย "${transaction.description}" จำนวน ฿${formatMoney(transaction.amount)}?`)) return;
    try {
      await api.delete(`/transactions/expenses/${transaction.transaction_id}`);
      await loadReports();
    } catch (err) {
      notify(err.response?.data?.error || 'ลบรายจ่ายไม่สำเร็จ', 'error');
    }
  };

  const updateDateRange = (field, value) => {
    setDateRange((current) => ({ ...current, [field]: value }));
  };

  const exportCsv = (filename, rows) => {
    if (!downloadCsv(filename, rows)) notify('ไม่มีข้อมูลสำหรับส่งออก', 'info');
  };

  const financial = summary?.financial_summary || {};
  const roomStatus = Object.fromEntries((summary?.room_summary || []).map((item) => [item.status, Number(item.count)]));
  const maxBar = Math.max(1, ...monthly.flatMap((item) => [Number(item.income), Number(item.expense)]));
  const expenses = transactions.filter((item) => item.type === 'expense');
  const reportCards = [
    { label: 'รายรับในช่วงวันที่เลือก', value: financial.total_income },
    { label: 'รายจ่ายในช่วงวันที่เลือก', value: financial.total_expense },
    { label: 'กำไรสุทธิในช่วงวันที่เลือก', value: financial.net_profit },
    { label: 'ยอดบิลค้างชำระ', value: summary?.pending_bills_summary?.unpaid_amount }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">รายงานและการเงิน</h1>
          <p className="text-sm text-gray-500">ภาพรวมรายรับ รายจ่าย กำไร ห้องพัก ผู้เช่า และการชำระเงิน</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && <span className="hidden text-xs text-gray-400 sm:inline">อัปเดต {lastUpdated.toLocaleTimeString('th-TH')}</span>}
          <button onClick={loadReports} className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm hover:bg-gray-50">
            <RefreshCw size={16} /> อัปเดตข้อมูล
          </button>
        </div>
      </div>

      <section className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <label className="text-sm text-gray-600">ตั้งแต่
          <input type="date" value={dateRange.start_date} max={dateRange.end_date} onChange={(e) => updateDateRange('start_date', e.target.value)} className="mt-1 block rounded-lg border p-2" />
        </label>
        <label className="text-sm text-gray-600">ถึง
          <input type="date" value={dateRange.end_date} min={dateRange.start_date} max={localDate()} onChange={(e) => updateDateRange('end_date', e.target.value)} className="mt-1 block rounded-lg border p-2" />
        </label>
        <span className="pb-2 text-xs text-gray-400">กรองรายรับ/รายจ่ายตามวันที่ และบิลตามวันครบกำหนด · รีเฟรชทุก 30 วินาที</span>
      </section>

      {loading ? (
        <p className="py-8 text-center text-gray-500">กำลังโหลดรายงาน...</p>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {reportCards.map((card) => (
              <div key={card.label} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="mt-2 text-2xl font-bold text-gray-800">฿{formatMoney(card.value)}</p>
              </div>
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-[2fr_1fr]">
            <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
              <h2 className="font-semibold text-gray-800">รายรับและรายจ่ายรายเดือนในช่วงที่เลือก</h2>
              {monthly.length ? (
                <div className="mt-5 space-y-4">
                  {monthly.map((item) => (
                    <div key={item.month} className="grid grid-cols-[5rem_1fr] items-center gap-3 text-sm">
                      <span className="text-gray-600">{item.month}</span>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <div className="h-3 rounded bg-emerald-500" style={{ width: `${Math.max(1, Number(item.income) / maxBar * 100)}%` }} />
                          <span className="whitespace-nowrap text-xs text-gray-600">รับ ฿{formatMoney(item.income)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-3 rounded bg-rose-400" style={{ width: `${Math.max(1, Number(item.expense) / maxBar * 100)}%` }} />
                          <span className="whitespace-nowrap text-xs text-gray-600">จ่าย ฿{formatMoney(item.expense)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="mt-4 text-sm text-gray-500">ยังไม่มีรายการทางการเงิน</p>}
            </div>

            <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
              <h2 className="font-semibold text-gray-800">บันทึกรายจ่าย</h2>
              <form onSubmit={handleAddExpense} className="mt-4 space-y-3">
                <label className="block text-sm text-gray-600">หมวดหมู่
                  <input required value={expense.category} onChange={(e) => setExpense({ ...expense, category: e.target.value })} placeholder="เช่น ค่าซ่อมบำรุง" className="mt-1 w-full rounded-lg border p-2.5" />
                </label>
                <label className="block text-sm text-gray-600">จำนวนเงิน
                  <input type="number" min="0.01" step="0.01" required value={expense.amount} onChange={(e) => setExpense({ ...expense, amount: e.target.value })} className="mt-1 w-full rounded-lg border p-2.5" />
                </label>
                <label className="block text-sm text-gray-600">วันที่
                  <input type="date" required value={expense.transaction_date} onChange={(e) => setExpense({ ...expense, transaction_date: e.target.value })} className="mt-1 w-full rounded-lg border p-2.5" />
                </label>
                <label className="block text-sm text-gray-600">รายละเอียด
                  <textarea required value={expense.description} onChange={(e) => setExpense({ ...expense, description: e.target.value })} rows="2" className="mt-1 w-full rounded-lg border p-2.5" />
                </label>
                <button type="submit" disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-white hover:bg-indigo-700 disabled:opacity-50">
                  <Plus size={16} /> {saving ? 'กำลังบันทึก...' : 'บันทึกรายจ่าย'}
                </button>
              </form>
            </div>
          </section>

          <section id="expense-transactions" className="scroll-mt-6 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-gray-800">รายการรายจ่ายล่าสุด</h2>
                <p className="text-sm text-gray-500">มี {expenses.length} รายการในช่วงวันที่เลือก</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => exportCsv('expenses.csv', expenses)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-50">
                  <Download size={16} /> ส่งออกรายจ่าย
                </button>
                <button onClick={() => exportCsv('transactions.csv', transactions)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-50">
                  <Download size={16} /> ส่งออกรายการการเงินทั้งหมด
                </button>
              </div>
            </div>
            <div className="mt-4 max-h-96 overflow-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="border-b bg-gray-50 text-gray-700">
                <tr><th className="p-3">วันที่</th><th className="p-3">หมวดหมู่</th><th className="p-3">รายละเอียด</th><th className="p-3 text-right">จำนวนเงิน</th><th className="p-3 text-center">จัดการ</th></tr>
                </thead>
                <tbody>
                  {expenses.map((item, index) => (
                    <tr key={item.transaction_id ?? `${item.transaction_date}-${index}`} className="border-b">
                      <td className="p-3">{String(item.transaction_date).slice(0, 10)}</td>
                      <td className="p-3">{item.category}</td>
                      <td className="p-3">{item.description}</td>
                      <td className="p-3 text-right">฿{formatMoney(item.amount)}</td>
                      <td className="p-3">
                        <div className="flex justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingExpense({
                              ...item,
                              transaction_date: String(item.transaction_date).slice(0, 10)
                            })}
                            className="rounded-lg p-2 text-indigo-600 hover:bg-indigo-50"
                            title="แก้ไขรายจ่าย"
                          >
                            <Save size={16} />
                          </button>
                          <button type="button" onClick={() => handleDeleteExpense(item)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50" title="ลบรายจ่าย">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!expenses.length && <tr><td colSpan="5" className="p-5 text-center text-gray-400">ยังไม่มีรายการรายจ่ายในช่วงวันที่เลือก</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold text-gray-800">รายงานห้องพัก ({rooms.length})</h2>
                <button onClick={() => exportCsv('rooms.csv', rooms)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-50"><Download size={15} /> CSV</button>
              </div>
              <p className="mt-2 text-sm text-gray-500">ว่าง {roomStatus.vacant || 0} ห้อง · มีผู้เช่า {roomStatus.occupied || 0} ห้อง</p>
              <div className="mt-3 max-h-52 overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead><tr className="border-b text-gray-500"><th className="py-2">ห้อง</th><th>ประเภท</th><th>สถานะ</th><th className="text-right">ค่าเช่า</th></tr></thead>
                  <tbody>{rooms.slice(0, 8).map((room) => <tr key={room.room_id} className="border-b last:border-0"><td className="py-2">{room.room_number}</td><td>{room.room_type}</td><td>{room.status}</td><td className="text-right">฿{formatMoney(room.base_price)}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold text-gray-800">รายงานผู้เช่า ({tenants.length})</h2>
                <button onClick={() => exportCsv('tenants.csv', tenants)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-50"><Download size={15} /> CSV</button>
              </div>
              <p className="mt-2 text-sm text-gray-500">รายชื่อผู้เช่าทั้งหมดพร้อมข้อมูลห้องและสัญญาที่กำลังใช้งาน</p>
              <div className="mt-3 max-h-52 overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead><tr className="border-b text-gray-500"><th className="py-2">ชื่อ</th><th>เบอร์โทร</th><th>ห้อง</th></tr></thead>
                  <tbody>{tenants.slice(0, 8).map((tenant) => <tr key={tenant.user_id} className="border-b last:border-0"><td className="py-2">{tenant.first_name} {tenant.last_name}</td><td>{tenant.phone || '-'}</td><td>{tenant.room_number || 'ยังไม่มีห้อง'}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-gray-800">รายงานการชำระเงิน ({payments.length})</h2>
                <p className="text-sm text-gray-500">ชำระแล้ว {payments.filter((item) => item.payment_status === 'paid').length} · ค้างชำระ {payments.filter((item) => item.payment_status !== 'paid').length}</p>
              </div>
              <button onClick={() => exportCsv('payments.csv', payments)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-50"><Download size={16} /> ส่งออก CSV</button>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="border-b bg-gray-50 text-gray-700"><tr><th className="p-3">รอบบิล</th><th className="p-3">ห้อง / ผู้เช่า</th><th className="p-3">สถานะ</th><th className="p-3 text-right">ยอด</th></tr></thead>
                <tbody>
                  {payments.slice(0, 8).map((payment) => (
                    <tr key={payment.bill_id} className="border-b">
                      <td className="p-3">{payment.month}/{payment.year}</td>
                      <td className="p-3">ห้อง {payment.room_number} · {payment.first_name} {payment.last_name}</td>
                      <td className="p-3">{payment.payment_status === 'paid' ? 'ชำระแล้ว' : 'ค้างชำระ'}</td>
                      <td className="p-3 text-right">฿{formatMoney(payment.total_amount)}</td>
                    </tr>
                  ))}
                  {!payments.length && <tr><td colSpan="4" className="p-5 text-center text-gray-400">ยังไม่มีข้อมูลบิล</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      {editingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={handleSaveExpense} className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold text-gray-800">แก้ไขรายการรายจ่าย</h2>
              <button type="button" onClick={() => setEditingExpense(null)} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
            </div>
            <label className="block text-sm text-gray-600">หมวดหมู่
              <input required value={editingExpense.category} onChange={(e) => setEditingExpense({ ...editingExpense, category: e.target.value })} className="mt-1 w-full rounded-lg border p-2.5" />
            </label>
            <label className="block text-sm text-gray-600">จำนวนเงิน
              <input type="number" min="0.01" step="0.01" required value={editingExpense.amount} onChange={(e) => setEditingExpense({ ...editingExpense, amount: e.target.value })} className="mt-1 w-full rounded-lg border p-2.5" />
            </label>
            <label className="block text-sm text-gray-600">วันที่
              <input type="date" required value={editingExpense.transaction_date} onChange={(e) => setEditingExpense({ ...editingExpense, transaction_date: e.target.value })} className="mt-1 w-full rounded-lg border p-2.5" />
            </label>
            <label className="block text-sm text-gray-600">รายละเอียด
              <textarea required value={editingExpense.description} onChange={(e) => setEditingExpense({ ...editingExpense, description: e.target.value })} rows="3" className="mt-1 w-full rounded-lg border p-2.5" />
            </label>
            <button type="submit" disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-white hover:bg-indigo-700 disabled:opacity-50">
              <Save size={16} /> {saving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
