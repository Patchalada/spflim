import { useCallback, useState, useEffect, useRef } from 'react';
import { FileText, CheckCircle, Clock, X, Image as ImageIcon, Check, Calculator, Search, Plus, Trash2, CalendarDays, ReceiptText } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import useToast from '../components/useToast';
import Pagination from '../components/Pagination';

const localDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export default function Bills() {
  const notify = useToast();
  const [searchParams] = useSearchParams();
  const [bills, setBills] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [viewSlip, setViewSlip] = useState(null);
  const [rates, setRates] = useState({ water_rate: 18, electric_rate: 8 });
  const [billingMonth, setBillingMonth] = useState(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  );
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || 'all');
  const [allPeriods, setAllPeriods] = useState(() => searchParams.get('all_periods') === '1');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalBills, setTotalBills] = useState(0);
  const [paymentBill, setPaymentBill] = useState(null);
  const [dueDateBill, setDueDateBill] = useState(null);
  const [dueDateValue, setDueDateValue] = useState('');
  const roomBillingListRef = useRef(null);
  const requestedContractHandled = useRef(false);
  const [paymentForm, setPaymentForm] = useState({
    payment_date: localDate(),
    payment_method: 'cash',
    payment_reference: '',
    notes: ''
  });

  // ฟอร์มออกบิล
  const [form, setForm] = useState({
    contract_id: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    water_old_meter: 0,
    water_new_meter: '',
    electric_old_meter: 0,
    electric_new_meter: '',
    due_date: localDate(),
    water_rate: '',
    electric_rate: ''
  });

  const [selectedContractPrice, setSelectedContractPrice] = useState(0);
  const [extraCharges, setExtraCharges] = useState([]);

  const handleContractChange = useCallback(async (contractId) => {
    const found = contracts.find(c => c.contract_id === Number(contractId));
    setSelectedContractPrice(found ? Number(found.base_price || 0) : 0);

    if (!contractId) {
      setForm(prev => ({
        ...prev,
        contract_id: '',
        water_old_meter: 0,
        electric_old_meter: 0
      }));
      return;
    }

    try {
      const res = await api.get(`/bills/last-meter/${contractId}`);
      setForm(prev => ({
        ...prev,
        contract_id: contractId,
        water_old_meter: Number(res.data.last_water_meter || 0),
        water_new_meter: '',
        electric_old_meter: Number(res.data.last_electric_meter || 0),
        electric_new_meter: ''
      }));
    } catch (err) {
      notify(err.response?.data?.error || 'โหลดเลขมิเตอร์ล่าสุดไม่สำเร็จ', 'error');
    }
  }, [contracts, notify]);

  const fetchReferenceData = useCallback(async () => {
    try {
      const [resContracts, resSettings] = await Promise.all([
        api.get('/contracts'),
        api.get('/settings')
      ]);
      setContracts(resContracts.data.filter(c => c.status === 'active'));
      const defaultRates = {
        water_rate: Number(resSettings.data.water_rate),
        electric_rate: Number(resSettings.data.electric_rate)
      };
      setRates(defaultRates);
      setForm((current) => ({
        ...current,
        water_rate: current.water_rate || String(defaultRates.water_rate),
        electric_rate: current.electric_rate || String(defaultRates.electric_rate)
      }));
    } catch (err) {
      console.error(err);
    }
  }, []);

  const requestedContractId = searchParams.get('contract_id');
  useEffect(() => {
    if (!requestedContractId || !contracts.length || requestedContractHandled.current) return;
    const contract = contracts.find((item) => String(item.contract_id) === requestedContractId);
    if (!contract) return;
    requestedContractHandled.current = true;
    void Promise.resolve().then(() => {
      setForm((current) => ({
        ...current,
        contract_id: String(contract.contract_id),
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        due_date: localDate(),
        water_rate: String(rates.water_rate),
        electric_rate: String(rates.electric_rate)
      }));
      setSelectedContractPrice(Number(contract.base_price || 0));
      setShowModal(true);
      void handleContractChange(String(contract.contract_id));
    });
  }, [requestedContractId, contracts, rates.water_rate, rates.electric_rate, handleContractChange]);

  const fetchData = useCallback(async () => {
    try {
      const [year, month] = billingMonth.split('-').map(Number);
      const resBills = await api.get('/bills', {
          params: {
            page,
            page_size: pageSize,
            ...(allPeriods ? {} : { month, year }),
            status: statusFilter === 'all' ? '' : statusFilter,
            search
          }
        });
      setBills(resBills.data.items);
      setTotalBills(resBills.data.pagination.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [allPeriods, billingMonth, page, pageSize, search, statusFilter]);

  useEffect(() => {
    void Promise.resolve().then(fetchData).catch(() => {});
  }, [fetchData]);

  useEffect(() => {
    void Promise.resolve().then(fetchReferenceData).catch(() => {});
  }, [fetchReferenceData]);

  // รับ Event แจ้งเตือนแบบ Real-time และการคลิกจากการแจ้งเตือนเพื่อรีเฟรชตารางบิลทันที
  useEffect(() => {
    const handleRealtimeUpdate = () => {
      void Promise.resolve().then(fetchData).catch(() => {});
      void Promise.resolve().then(fetchReferenceData).catch(() => {});
    };

    window.addEventListener('dormitory-refresh-page', handleRealtimeUpdate);
    window.addEventListener('dormitory-realtime-notification', handleRealtimeUpdate);

    return () => {
      window.removeEventListener('dormitory-refresh-page', handleRealtimeUpdate);
      window.removeEventListener('dormitory-realtime-notification', handleRealtimeUpdate);
    };
  }, [fetchData, fetchReferenceData]);

  // คำนวณสรุปหน่วยและราคาทันที
  const waterUnits = Math.max(0, Number(form.water_new_meter || 0) - Number(form.water_old_meter || 0));
  const waterCost = waterUnits * Number(form.water_rate || 0);
  const electricUnits = Math.max(0, Number(form.electric_new_meter || 0) - Number(form.electric_old_meter || 0));
  const electricCost = electricUnits * Number(form.electric_rate || 0);
  const extraChargesTotal = extraCharges.reduce((sum, charge) => sum + Number(charge.amount || 0), 0);
  const estimatedTotal = selectedContractPrice + waterCost + electricCost + extraChargesTotal;

  const handleCreateBill = async (e) => {
    e.preventDefault();
    if (Number(form.water_new_meter) < Number(form.water_old_meter)) {
      notify('เลขมิเตอร์น้ำใหม่ ต้องไม่น้อยกว่ามิเตอร์เก่า', 'error');
      return;
    }
    if (Number(form.electric_new_meter) < Number(form.electric_old_meter)) {
      notify('เลขมิเตอร์ไฟใหม่ ต้องไม่น้อยกว่ามิเตอร์เก่า', 'error');
      return;
    }

    try {
      await api.post('/bills', {
        contract_id: Number(form.contract_id),
        month: Number(form.month),
        year: Number(form.year),
        water_old_meter: Number(form.water_old_meter),
        water_new_meter: Number(form.water_new_meter),
        electric_old_meter: Number(form.electric_old_meter),
        electric_new_meter: Number(form.electric_new_meter),
        due_date: form.due_date,
        water_rate: Number(form.water_rate),
        electric_rate: Number(form.electric_rate),
        extra_charges: extraCharges
          .filter((charge) => charge.description.trim() && charge.amount !== '')
          .map((charge) => ({ ...charge, amount: Number(charge.amount) }))
      });

      notify('ออกบิลสำเร็จเรียบร้อย', 'success');
      setShowModal(false);
      setForm({
        contract_id: '',
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        water_old_meter: 0,
        water_new_meter: '',
        electric_old_meter: 0,
        electric_new_meter: '',
        due_date: localDate(),
        water_rate: String(rates.water_rate),
        electric_rate: String(rates.electric_rate)
      });
      setExtraCharges([]);
      void Promise.resolve().then(fetchData).catch(() => {});
    } catch (err) {
      notify(err.response?.data?.error || err.response?.data?.message || 'ไม่สามารถออกบิลได้', 'error');
    }
  };

  const openBillModalForContract = (contract) => {
    setForm({
      contract_id: String(contract.contract_id),
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      water_old_meter: 0,
      water_new_meter: '',
      electric_old_meter: 0,
      electric_new_meter: '',
      due_date: localDate(),
      water_rate: String(rates.water_rate),
      electric_rate: String(rates.electric_rate)
    });
    setSelectedContractPrice(Number(contract.base_price || 0));
    setExtraCharges([]);
    setShowModal(true);
    void handleContractChange(String(contract.contract_id));
  };

  const handleUpdateDueDate = async (event) => {
    event.preventDefault();
    if (!dueDateBill) return;
    try {
      await api.put(`/bills/${dueDateBill.bill_id}/due-date`, { due_date: dueDateValue });
      notify('แก้วันครบกำหนดชำระแล้ว', 'success');
      setDueDateBill(null);
      void Promise.resolve().then(fetchData).catch(() => {});
    } catch (err) {
      notify(err.response?.data?.error || 'ไม่สามารถแก้วันครบกำหนดได้', 'error');
    }
  };

  const openPaymentForm = (bill) => {
    setPaymentBill(bill);
    setViewSlip(null);
    setPaymentForm({
      payment_date: localDate(),
      payment_method: 'cash',
      payment_reference: '',
      notes: ''
    });
  };

  const handlePayBill = async (e) => {
    e.preventDefault();
    if (!paymentBill) return;
    try {
      await api.post('/transactions/pay-bill', {
        bill_id: paymentBill.bill_id,
        ...paymentForm,
        payment_reference: paymentForm.payment_reference.trim() || null,
        notes: paymentForm.notes.trim() || null
      });
      notify('อนุมัติการชำระเงินสำเร็จ', 'success');
      setPaymentBill(null);
      void Promise.resolve().then(fetchData).catch(() => {});
    } catch (err) {
      notify(err.response?.data?.error || 'ไม่สามารถทำรายการได้', 'error');
    }
  };

  const visibleBills = bills;
  const contractsByFloor = contracts.reduce((groups, contract) => {
    const floor = contract.floor ?? 'ไม่ระบุชั้น';
    groups[floor] = [...(groups[floor] || []), contract];
    return groups;
  }, {});
  const visibleTotal = visibleBills.reduce((sum, bill) => sum + Number(bill.total_amount || 0), 0);
  const pendingBills = visibleBills.filter((bill) => bill.payment_status !== 'paid');
  const paidBills = visibleBills.filter((bill) => bill.payment_status === 'paid');
  const pendingTotal = pendingBills
    .reduce((sum, bill) => sum + Number(bill.total_amount || 0), 0);
  const paidTotal = paidBills.reduce((sum, bill) => sum + Number(bill.total_amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">การแจ้งชำระเงิน</h1>
          <p className="text-sm text-gray-500">ออกบิลมิเตอร์น้ำ-ไฟ และตรวจสอบการชำระเงิน</p>
        </div>
        <button 
          onClick={() => roomBillingListRef.current?.scrollIntoView({ behavior: 'smooth' })}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 transition cursor-pointer font-medium shadow-sm"
        >
          <FileText size={18} /> เลือกชั้นและห้องเพื่อออกบิล
        </button>
      </div>

      <section ref={roomBillingListRef} className="scroll-mt-6 space-y-4 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800">
            <ReceiptText className="text-indigo-600" size={20} /> เลือกห้องตามชั้นเพื่อออกบิล
          </h2>
          <p className="mt-1 text-sm text-gray-500">กดออกบิลจากห้องที่มีผู้เช่าได้เลย ไม่ต้องค้นหาห้องในรายการ</p>
        </div>
        {Object.keys(contractsByFloor).length ? (
          <div className="space-y-4">
            {Object.entries(contractsByFloor)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([floor, floorContracts]) => (
                <section key={floor} className="space-y-2">
                  <h3 className="border-b pb-2 text-sm font-semibold text-gray-700">ชั้น {floor}</h3>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {floorContracts.map((contract) => (
                      <article key={contract.contract_id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-800">ห้อง {contract.room_number}</p>
                          <p className="truncate text-xs text-gray-500">{contract.first_name} {contract.last_name}</p>
                          <p className="text-xs text-gray-500">ค่าเช่า ฿{Number(contract.base_price || 0).toLocaleString()}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openBillModalForContract(contract)}
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800"
                        >
                          <FileText size={14} /> ออกบิล
                        </button>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
          </div>
        ) : (
          <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">ยังไม่มีห้องที่มีสัญญาเช่าใช้งานอยู่</p>
        )}
      </section>

      {/* ตารางแสดงบิล */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
        <div className="grid gap-3 md:grid-cols-[180px_1fr_180px]">
          {allPeriods ? (
            <div className="flex flex-col justify-center text-xs font-medium text-indigo-700">
              แสดงบิลทุกช่วงเวลา
              <button type="button" onClick={() => { setAllPeriods(false); setPage(1); }} className="mt-1 text-left text-gray-500 underline">
                กลับไปดูเฉพาะรอบบิล
              </button>
            </div>
          ) : (
            <label className="text-xs font-medium text-gray-600">
              รอบบิล
              <input
                type="month"
                value={billingMonth}
                onChange={(e) => {
                  setBillingMonth(e.target.value);
                  setPage(1);
                }}
                className="mt-1 w-full rounded-lg border p-2.5 text-sm text-gray-800"
              />
            </label>
          )}
          <label className="text-xs font-medium text-gray-600">
            ค้นหาบิล / ห้อง / ผู้เช่า
            <span className="relative mt-1 block">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="เลขบิล ห้อง หรือชื่อผู้เช่า"
                className="w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm"
              />
            </span>
          </label>
          <label className="text-xs font-medium text-gray-600">
            สถานะชำระเงิน
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="mt-1 w-full rounded-lg border bg-white p-2.5 text-sm text-gray-800"
            >
              <option value="all">ทั้งหมด</option>
              <option value="pending">รอชำระ</option>
              <option value="paid">ชำระแล้ว</option>
            </select>
          </label>
        </div>
        <div className="grid gap-2 rounded-lg bg-gray-50 p-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <p className="text-gray-600">บิลในหน้านี้ <strong className="text-gray-900">{visibleBills.length}</strong> จากทั้งหมด {totalBills}</p>
          <p className="text-indigo-700">ยอดรวมในหน้านี้ <strong>฿{visibleTotal.toLocaleString()}</strong></p>
          <p className="text-amber-700">รอชำระในหน้านี้ <strong>{pendingBills.length} บิล · ฿{pendingTotal.toLocaleString()}</strong></p>
          <p className="text-emerald-700">ชำระแล้วในหน้านี้ <strong>{paidBills.length} บิล · ฿{paidTotal.toLocaleString()}</strong></p>
        </div>
        {loading ? (
          <p className="text-center py-6 text-gray-500">กำลังโหลดข้อมูล...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-700 uppercase border-b">
                <tr>
                  <th className="p-3">บิล #</th>
                  <th className="p-3">ห้อง / ผู้เช่า</th>
                  <th className="p-3">รอบเดือน</th>
                  <th className="p-3">ครบกำหนด</th>
                  <th className="p-3">มิเตอร์น้ำ (เก่า ➔ ใหม่)</th>
                  <th className="p-3">มิเตอร์ไฟ (เก่า ➔ ใหม่)</th>
                  <th className="p-3">ยอดรวม</th>
                  <th className="p-3">สถานะ</th>
                  <th className="p-3">เอกสาร</th>
                  <th className="p-3">สลิป</th>
                  <th className="p-3 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {visibleBills.map((b) => (
                  <tr key={b.bill_id} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-semibold text-gray-800">#{b.bill_id}</td>
                    <td className="p-3">
                      <div className="font-semibold text-gray-800">ห้อง {b.room_number}</div>
                      <div className="text-xs text-gray-400">{b.first_name} {b.last_name}</div>
                    </td>
                    <td className="p-3">{b.month}/{b.year}</td>
                    <td className="p-3">
                      <div className="whitespace-nowrap text-xs">{b.due_date ? new Date(`${String(b.due_date).slice(0, 10)}T00:00:00`).toLocaleDateString('th-TH') : '-'}</div>
                      {b.payment_status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => { setDueDateBill(b); setDueDateValue(String(b.due_date).slice(0, 10)); }}
                          className="mt-1 inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                        >
                          <CalendarDays size={13} /> แก้ไข
                        </button>
                      )}
                    </td>
                    <td className="p-3 text-xs">
                      {b.water_old_meter ?? 0} ➔ {b.water_new_meter ?? b.water_unit}
                      <span className="text-indigo-600 block font-medium">({b.water_unit} หน่วย = ฿{b.water_amount})</span>
                      {b.water_rate != null && <span className="block text-gray-400">฿{Number(b.water_rate).toLocaleString()}/หน่วย</span>}
                    </td>
                    <td className="p-3 text-xs">
                      {b.electric_old_meter ?? 0} ➔ {b.electric_new_meter ?? b.electric_unit}
                      <span className="text-indigo-600 block font-medium">({b.electric_unit} หน่วย = ฿{b.electric_amount})</span>
                      {b.electric_rate != null && <span className="block text-gray-400">฿{Number(b.electric_rate).toLocaleString()}/หน่วย</span>}
                    </td>
                    <td className="p-3 font-semibold text-indigo-600">
                      ฿{Number(b.total_amount).toLocaleString()}
                      {Array.isArray(b.extra_charges) && b.extra_charges.length > 0 && (
                        <span className="mt-1 block text-xs font-normal text-gray-500">
                          +{b.extra_charges.length} รายการเพิ่มเติม
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {b.payment_status === 'paid' ? (
                        <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full text-xs w-fit font-medium">
                          <CheckCircle size={14} /> ชำระแล้ว
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full text-xs w-fit font-medium">
                          <Clock size={14} /> รอชำระ
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <Link
                        to={`/bills/${b.bill_id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                      >
                        <FileText size={14} /> ดู / พิมพ์
                      </Link>
                    </td>
                    <td className="p-3">
                      {b.has_slip ? (
                        <div className="space-y-1">
                          <button
                            onClick={async () => {
                              try {
                                const response = await api.get(`/bills/${b.bill_id}/slip`);
                                setViewSlip({ ...b, slip_image: response.data.slip_image });
                              } catch (err) {
                                notify(err.response?.data?.error || 'โหลดสลิปไม่สำเร็จ', 'error');
                              }
                            }}
                            className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-md transition"
                          >
                            <ImageIcon size={14} /> ดูสลิป
                          </button>
                          {b.slip_verification_message && (
                            <span className="block max-w-40 text-xs text-gray-500">{b.slip_verification_message}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">ยังไม่แนบ</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {b.payment_status === 'pending' ? (
                        <button 
                          onClick={() => openPaymentForm(b)}
                          className="inline-flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer"
                        >
                          <Check size={14} /> ยืนยันการจ่าย
                        </button>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && visibleBills.length === 0 && (
          <p className="py-6 text-center text-sm text-gray-500">ไม่พบบิลที่ตรงกับเดือนและตัวกรองที่เลือก</p>
        )}
        {!loading && (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={totalBills}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          />
        )}
      </div>

      {/* Modal ออกบิลคำนวณมิเตอร์ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                <Calculator className="text-indigo-600" size={20} /> ออกบิลประจำเดือน (คำนวณมิเตอร์)
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <form onSubmit={handleCreateBill} className="space-y-4">
              <div className="rounded-lg bg-teal-50 p-3 text-sm text-teal-900">
                {(() => {
                  const selectedContract = contracts.find((contract) => String(contract.contract_id) === String(form.contract_id));
                  return selectedContract
                    ? <>ห้อง {selectedContract.room_number} · ชั้น {selectedContract.floor} · {selectedContract.first_name} {selectedContract.last_name}</>
                    : 'ไม่พบสัญญาห้องที่เลือก';
                })()}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ประจำเดือน (1-12)</label>
                  <input type="number" min="1" max="12" required value={form.month} onChange={(e) => setForm({...form, month: e.target.value})} className="w-full border p-2 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ปี (ค.ศ.)</label>
                  <input type="number" required value={form.year} onChange={(e) => setForm({...form, year: e.target.value})} className="w-full border p-2 rounded-lg text-sm" />
                </div>
              </div>

              {/* บล็อกมิเตอร์น้ำ */}
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-blue-900">มิเตอร์น้ำ (บาท / หน่วย)
                    <input type="number" min="0" step="0.01" required value={form.water_rate} onChange={(e) => setForm({...form, water_rate: e.target.value})} className="ml-2 w-24 rounded border bg-white px-2 py-1 text-xs" />
                  </label>
                  <span className="text-xs font-medium text-blue-700">ใช้ไป: {waterUnits} หน่วย (฿{waterCost.toLocaleString()})</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">มิเตอร์เก่า</label>
                    <input type="number" readOnly value={form.water_old_meter} className="w-full border bg-gray-100 p-2 rounded-lg text-sm text-gray-600 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-blue-700 font-medium mb-1">มิเตอร์ใหม่ล่าสุด *</label>
                    <input 
                      type="number" 
                      required 
                      value={form.water_new_meter} 
                      onChange={(e) => setForm({...form, water_new_meter: e.target.value})} 
                      className="w-full border p-2 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500" 
                      placeholder={`>= ${form.water_old_meter}`}
                    />
                  </div>
                </div>
              </div>

              {/* บล็อกมิเตอร์ไฟ */}
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-amber-900">มิเตอร์ไฟ (บาท / หน่วย)
                    <input type="number" min="0" step="0.01" required value={form.electric_rate} onChange={(e) => setForm({...form, electric_rate: e.target.value})} className="ml-2 w-24 rounded border bg-white px-2 py-1 text-xs" />
                  </label>
                  <span className="text-xs font-medium text-amber-700">ใช้ไป: {electricUnits} หน่วย (฿{electricCost.toLocaleString()})</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">มิเตอร์เก่า</label>
                    <input type="number" readOnly value={form.electric_old_meter} className="w-full border bg-gray-100 p-2 rounded-lg text-sm text-gray-600 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-amber-700 font-medium mb-1">มิเตอร์ใหม่ล่าสุด *</label>
                    <input 
                      type="number" 
                      required 
                      value={form.electric_new_meter} 
                      onChange={(e) => setForm({...form, electric_new_meter: e.target.value})} 
                      className="w-full border p-2 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-amber-500" 
                      placeholder={`>= ${form.electric_old_meter}`}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">กำหนดชำระ (Due Date)</label>
                <input type="date" required value={form.due_date} onChange={(e) => setForm({...form, due_date: e.target.value})} className="w-full border p-2 rounded-lg text-sm" />
              </div>

              <div className="space-y-3 rounded-xl border border-gray-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800">ค่าใช้จ่ายเพิ่มเติม</h4>
                    <p className="text-xs text-gray-500">เช่น อินเทอร์เน็ต ที่จอดรถ หรือค่าส่วนกลาง</p>
                  </div>
                  <button
                    type="button"
                    disabled={extraCharges.length >= 20}
                    onClick={() => setExtraCharges((current) => [...current, { description: '', amount: '' }])}
                    className="inline-flex items-center gap-1 rounded-lg bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-700 hover:bg-teal-100 disabled:opacity-50"
                  >
                    <Plus size={14} /> เพิ่มรายการ
                  </button>
                </div>
                {extraCharges.map((charge, index) => (
                  <div key={index} className="grid grid-cols-[1fr_120px_auto] gap-2">
                    <input
                      required
                      maxLength="100"
                      value={charge.description}
                      onChange={(e) => setExtraCharges((current) => current.map((item, itemIndex) => (
                        itemIndex === index ? { ...item, description: e.target.value } : item
                      )))}
                      placeholder="ชื่อรายการ"
                      className="min-w-0 rounded-lg border p-2 text-sm"
                    />
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      value={charge.amount}
                      onChange={(e) => setExtraCharges((current) => current.map((item, itemIndex) => (
                        itemIndex === index ? { ...item, amount: e.target.value } : item
                      )))}
                      placeholder="จำนวนเงิน"
                      className="w-full rounded-lg border p-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setExtraCharges((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                      className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"
                      aria-label="ลบรายการค่าใช้จ่าย"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>

              {/* ยอดประเมินรวม */}
              <div className="p-3 bg-gray-50 rounded-xl flex justify-between items-center text-sm font-semibold">
                <span className="text-gray-700">ยอดรวมทั้งสิ้น:</span>
                <span className="text-indigo-600 text-base">฿{estimatedTotal.toLocaleString()}</span>
              </div>

              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition shadow-md cursor-pointer">
                คำนวณและออกบิล
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal ดูสลิป */}
      {viewSlip && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-gray-800 text-sm">หลักฐานการโอนเงิน ห้อง {viewSlip.room_number}</h3>
              <button onClick={() => setViewSlip(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="max-h-[380px] overflow-auto flex justify-center bg-gray-50 rounded-lg p-2">
              <img src={viewSlip.slip_image} alt="Slip" className="max-w-full rounded-md shadow" />
            </div>
            <div className="space-y-2 pt-1">
              {viewSlip.payment_status === 'pending' && (
                <button
                  onClick={() => openPaymentForm(viewSlip)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Check size={16} /> ยืนยันยอดเงินและอนุมัติบิลนี้
                </button>
              )}
              <button onClick={() => setViewSlip(null)} className="w-full bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium">ปิด</button>
            </div>
          </div>
        </div>
      )}

      {paymentBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <form onSubmit={handlePayBill} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-gray-800">ยืนยันรับชำระบิล #{paymentBill.bill_id}</h3>
                <p className="mt-1 text-sm text-gray-500">ห้อง {paymentBill.room_number} · ฿{Number(paymentBill.total_amount).toLocaleString()}</p>
              </div>
              <button type="button" onClick={() => setPaymentBill(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <label className="block text-sm text-gray-700">
              วันที่รับชำระ
              <input
                type="date"
                required
                value={paymentForm.payment_date}
                onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                className="mt-1 w-full rounded-lg border p-2.5"
              />
            </label>
            <label className="block text-sm text-gray-700">
              วิธีชำระเงิน
              <select
                required
                value={paymentForm.payment_method}
                onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                className="mt-1 w-full rounded-lg border bg-white p-2.5"
              >
                <option value="cash">เงินสด</option>
                <option value="bank_transfer">โอนเงินผ่านธนาคาร</option>
                <option value="other">อื่น ๆ</option>
              </select>
            </label>
            <label className="block text-sm text-gray-700">
              เลขอ้างอิง / เลขที่รายการ (ไม่บังคับ)
              <input
                type="text"
                maxLength="200"
                value={paymentForm.payment_reference}
                onChange={(e) => setPaymentForm({ ...paymentForm, payment_reference: e.target.value })}
                className="mt-1 w-full rounded-lg border p-2.5"
              />
            </label>
            <label className="block text-sm text-gray-700">
              หมายเหตุ (ไม่บังคับ)
              <textarea
                maxLength="1000"
                rows="3"
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                className="mt-1 w-full rounded-lg border p-2.5"
              />
            </label>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setPaymentBill(null)} className="flex-1 rounded-lg bg-gray-100 py-2.5 text-sm font-medium text-gray-700">ยกเลิก</button>
              <button type="submit" className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">ยืนยันรับชำระ</button>
            </div>
          </form>
        </div>
      )}

      {dueDateBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={handleUpdateDueDate} className="w-full max-w-sm space-y-4 rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-semibold text-gray-800">แก้วันครบกำหนดบิล #{dueDateBill.bill_id}</h3>
                <p className="mt-1 text-xs text-gray-500">ห้อง {dueDateBill.room_number}</p>
              </div>
              <button type="button" onClick={() => setDueDateBill(null)} className="text-gray-400" aria-label="ปิด">
                <X size={18} />
              </button>
            </div>
            <label className="block text-sm text-gray-700">วันครบกำหนดใหม่
              <input type="date" required value={dueDateValue} onChange={(event) => setDueDateValue(event.target.value)} className="mt-1 w-full rounded-lg border p-2.5" />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDueDateBill(null)} className="rounded-lg border px-4 py-2 text-sm">ยกเลิก</button>
              <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">บันทึกวันครบกำหนด</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}