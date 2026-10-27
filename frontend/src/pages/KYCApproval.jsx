import { useCallback, useEffect, useState } from 'react';
import {
  Check, X, Image as ImageIcon, Send, FileSignature, Building,
  User, Calendar, ShieldCheck, DollarSign, Eye, EyeOff, FileText, CheckCircle
} from 'lucide-react';
import api from '../api/axios';
import useToast from '../components/useToast';
import Pagination from '../components/Pagination';
import SignaturePad from '../components/SignaturePad';
import OfficialContractDocument from '../components/OfficialContractDocument';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const oneYearFrom = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  d.setFullYear(d.getFullYear() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatDate = (date) => {
  if (!date) return '-';
  return new Date(`${String(date).slice(0, 10)}T00:00:00`).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
};

export default function KYCApproval() {
  const notify = useToast();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewDoc, setViewDoc] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [rooms, setRooms] = useState([]);
  const [selectedRooms, setSelectedRooms] = useState({});
  const [reviewNotes, setReviewNotes] = useState({});
  const [history, setHistory] = useState([]);
  const [dormInfo, setDormInfo] = useState({
    dormitory_name: 'ระบบจัดการหอพัก',
    dormitory_address: '',
    contact_phone: '',
    water_rate: 18,
    electric_rate: 8
  });

  // Modal สำหรับออกสัญญาและลงนามแอดมิน
  const [approvalModal, setApprovalModal] = useState(null);
  const [submittingApproval, setSubmittingApproval] = useState(false);
  const [adminSig, setAdminSig] = useState('');
  const [rememberSig, setRememberSig] = useState(true);

  // โหลดข้อมูลหอพักและลายเซ็นแอดมินที่เคยบันทึกไว้ในเบราว์เซอร์
  useEffect(() => {
    api.get('/settings/public')
      .then((res) => {
        if (res.data) setDormInfo(res.data);
      })
      .catch((e) => console.error('Could not load dorm info:', e));

    const saved = localStorage.getItem('saved_dorm_admin_sig');
    if (saved) setAdminSig(saved);
  }, []);

  const fetchKYC = useCallback(async () => {
    try {
      const res = await api.get('/tenant/pending-kyc', { params: { page, page_size: pageSize } });
      const items = res.data.items || [];
      setList(items);
      setTotal(res.data.pagination?.total || 0);
      setSelectedRooms((current) => ({
        ...Object.fromEntries(items.map((user) => [
          user.user_id,
          current[user.user_id] ?? String(user.requested_room_id || '')
        ]))
      }));
    } catch (err) {
      notify(err.response?.data?.error || 'โหลดรายการรอตรวจสอบไม่สำเร็จ', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify, page, pageSize]);

  const fetchHistory = useCallback(async () => {
    try {
      const response = await api.get('/tenant/kyc-history');
      setHistory(response.data || []);
    } catch (err) {
      notify(err.response?.data?.error || 'โหลดประวัติการตรวจสอบไม่สำเร็จ', 'error');
    }
  }, [notify]);

  const fetchRooms = useCallback(async () => {
    try {
      const response = await api.get('/auth/available-rooms');
      setRooms(Array.isArray(response.data) ? response.data : (response.data.items || []));
    } catch (err) {
      notify(err.response?.data?.error || 'โหลดรายการห้องว่างไม่สำเร็จ', 'error');
    }
  }, [notify]);

  useEffect(() => {
    void Promise.resolve().then(fetchKYC).catch(() => {});
    void Promise.resolve().then(fetchRooms).catch(() => {});
    void Promise.resolve().then(fetchHistory).catch(() => {});
  }, [fetchHistory, fetchKYC, fetchRooms]);

  // เปิดหน้าต่างออกสัญญาเมื่อกด "อนุมัติ"
  const openApprovalModal = (user) => {
    const roomId = selectedRooms[user.user_id];
    if (!roomId) {
      notify('กรุณาเลือกห้องพักที่จะจัดสรรให้ผู้สมัครก่อนอนุมัติ', 'error');
      return;
    }
    const targetRoom = rooms.find((r) => String(r.room_id) === String(roomId));
    const start = today();
    setApprovalModal({
      user,
      roomId,
      room: targetRoom,
      startDate: start,
      endDate: oneYearFrom(start),
      deposit: targetRoom?.base_price ? String(Number(targetRoom.base_price) * 1) : '0',
      note: reviewNotes[user.user_id] || ''
    });
  };

  // กดยืนยันอนุมัติและส่งสัญญา
  const handleConfirmApproval = async (e) => {
    e.preventDefault();
    if (!approvalModal) return;
    setSubmittingApproval(true);

    try {
      if (rememberSig && adminSig) {
        localStorage.setItem('saved_dorm_admin_sig', adminSig);
      } else if (!rememberSig) {
        localStorage.removeItem('saved_dorm_admin_sig');
      }

      await api.post('/tenant/verify-kyc', {
        user_id: approvalModal.user.user_id,
        status: 'approved',
        room_id: approvalModal.roomId,
        start_date: approvalModal.startDate,
        end_date: approvalModal.endDate,
        deposit: Number(approvalModal.deposit) || 0,
        admin_signature: adminSig || null,
        note: approvalModal.note || ''
      });

      notify('อนุมัติ KYC และส่งสัญญาเช่าให้ผู้เช่าลงนามเรียบร้อยแล้ว', 'success');
      setApprovalModal(null);
      setViewDoc(null);
      await Promise.all([fetchKYC(), fetchHistory(), fetchRooms()]);
    } catch (err) {
      notify(err.response?.data?.error || 'เกิดข้อผิดพลาดในการอนุมัติ', 'error');
      if (err.response?.status === 409) await fetchRooms();
    } finally {
      setSubmittingApproval(false);
    }
  };

  // ปฏิเสธ KYC
  const handleReject = async (userId) => {
    if (!confirm('ยืนยันการปฏิเสธการสมัครของผู้ใช้นี้?')) return;
    try {
      await api.post('/tenant/verify-kyc', {
        user_id: userId,
        status: 'rejected',
        note: reviewNotes[userId] || ''
      });
      notify('ปฏิเสธ KYC เรียบร้อยแล้ว', 'success');
      setViewDoc(null);
      await Promise.all([fetchKYC(), fetchHistory(), fetchRooms()]);
    } catch (err) {
      notify(err.response?.data?.error || 'เกิดข้อผิดพลาด', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">ตรวจสอบเอกสารยืนยันตัวตน (KYC) & จัดทำสัญญา</h1>
        <p className="text-sm text-gray-500">
          ตรวจสอบเอกสารการสมัครสมาชิก จัดสรรห้องพัก และลงนามส่งสัญญาออนไลน์ให้ผู้เช่า
        </p>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        {loading ? (
          <p className="text-center py-6 text-gray-500">กำลังโหลดข้อมูล...</p>
        ) : total === 0 ? (
          <div className="text-center py-8 text-gray-400">ไม่มีรายการที่รอตรวจสอบ</div>
        ) : (
          <div className="overflow-x-auto">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-gray-700 uppercase border-b">
                  <tr>
                    <th className="p-3">ผู้สมัคร</th>
                    <th className="p-3">Username</th>
                    <th className="p-3">เบอร์โทร</th>
                    <th className="p-3">ห้องที่ขอ</th>
                    <th className="p-3">ห้องที่จะจัดสรร</th>
                    <th className="p-3">เอกสารแนบ</th>
                    <th className="p-3">หมายเหตุ</th>
                    <th className="p-3 text-center">การดำเนินการ</th>
                  </tr>
                </thead>
                <tbody>
                {list.map((u) => (
                  <tr key={u.user_id} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-semibold text-gray-800">{u.first_name} {u.last_name}</td>
                    <td className="p-3">{u.username}</td>
                    <td className="p-3">{u.phone || '-'}</td>
                    <td className="p-3">
                      {u.requested_room_number
                        ? `ห้อง ${u.requested_room_number} · ชั้น ${u.requested_room_floor}`
                        : 'ไม่ได้ระบุ'}
                      {u.requested_room_status && u.requested_room_status !== 'vacant' && (
                        <span className="mt-1 block text-xs text-rose-600">ห้องที่ขอไม่ว่างแล้ว</span>
                      )}
                    </td>
                    <td className="p-3">
                      <select
                        value={selectedRooms[u.user_id] ?? ''}
                        onChange={(event) => setSelectedRooms((current) => ({
                          ...current,
                          [u.user_id]: event.target.value
                        }))}
                        className="min-w-40 rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:ring-2 focus:ring-teal-600 outline-none"
                        aria-label={`เลือกห้องให้ ${u.first_name} ${u.last_name}`}
                      >
                        <option value="">เลือกห้องว่าง</option>
                        {u.requested_room_id && !rooms.some((room) => String(room.room_id) === String(u.requested_room_id)) && (
                          <option value={u.requested_room_id} disabled>
                            ห้อง {u.requested_room_number} ไม่ว่าง
                          </option>
                        )}
                        {rooms.map((room) => (
                          <option key={room.room_id} value={room.room_id}>
                            ห้อง {room.room_number} · ชั้น {room.floor}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3">
                      {u.has_kyc_document ? (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const response = await api.get(`/tenant/pending-kyc/${u.user_id}/document`);
                              setViewDoc({ ...u, kyc_document: response.data.document });
                            } catch (err) {
                              notify(err.response?.data?.error || 'โหลดเอกสารไม่สำเร็จ', 'error');
                            }
                          }}
                          className="inline-flex items-center gap-1 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-md font-medium cursor-pointer transition"
                        >
                          <ImageIcon size={14} /> ตรวจสอบเอกสาร
                        </button>
                      ) : (
                        <span className="text-xs text-rose-500">ไม่มีเอกสาร</span>
                      )}
                    </td>
                    <td className="p-3">
                      <input
                        type="text"
                        maxLength="1000"
                        value={reviewNotes[u.user_id] || ''}
                        onChange={(event) => setReviewNotes((current) => ({
                          ...current,
                          [u.user_id]: event.target.value
                        }))}
                        placeholder="บันทึกผลตรวจ (ไม่บังคับ)"
                        className="min-w-36 rounded-lg border border-gray-300 px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-teal-600"
                      />
                    </td>
                    <td className="p-3 text-center space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        disabled={!selectedRooms[u.user_id]}
                        onClick={() => openApprovalModal(u)}
                        className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs disabled:cursor-not-allowed disabled:opacity-50 transition cursor-pointer"
                        title="อนุมัติ KYC และส่งสัญญาออนไลน์"
                      >
                        <Check size={14} /> อนุมัติ & ออกสัญญา
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReject(u.user_id)}
                        className="inline-flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-700 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
                      >
                        <X size={14} /> ปฏิเสธ
                      </button>
                    </td>
                  </tr>
                ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {!loading && total > 0 && (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          />
        )}
      </div>

      {/* MODAL 1: อนุมัติ KYC และจัดทำสัญญา พร้อมตัวอย่างสัญญาฉบับจริง & พรีวิวลบลายเซ็นสด */}
      {approvalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-3 sm:p-5">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[95dvh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-50/80">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <FileSignature size={20} className="text-teal-700" />
                  อนุมัติ KYC และส่งหนังสือสัญญาเช่าห้องพัก
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  ตรวจสอบตัวอย่างร่างสัญญาด้านล่าง ลงนามผู้ให้เช่า แล้วส่งให้ผู้เช่าเซ็นออนไลน์
                </p>
              </div>
              <button
                type="button"
                onClick={() => setApprovalModal(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200/60 transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="overflow-y-auto p-6 space-y-6 flex-1">
              {/* ตั้งค่าสัญญาเบื้องต้น (วันที่, เงินประกัน) */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  <Calendar size={15} className="text-teal-700" />
                  กำหนดระยะเวลาและเงินประกันความเสียหาย
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      วันที่เริ่มสัญญา
                    </label>
                    <input
                      type="date"
                      required
                      value={approvalModal.startDate}
                      onChange={(e) => {
                        const start = e.target.value;
                        setApprovalModal({
                          ...approvalModal,
                          startDate: start,
                          endDate: oneYearFrom(start)
                        });
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      วันที่สิ้นสุดสัญญา
                    </label>
                    <input
                      type="date"
                      required
                      value={approvalModal.endDate}
                      onChange={(e) => setApprovalModal({ ...approvalModal, endDate: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      เงินประกันความเสียหาย (บาท)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      required
                      value={approvalModal.deposit}
                      onChange={(e) => setApprovalModal({ ...approvalModal, deposit: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                </div>
              </div>

              {/* ส่วนลงนามผู้ให้เช่า (Admin Signature) */}
              <div>
                <SignaturePad
                  label="ลงลายมือชื่อผู้ให้เช่า (หอพัก) — เซ็นสดหรืออัปโหลด"
                  initialSignature={adminSig}
                  onSignatureChange={(sig) => setAdminSig(sig || '')}
                />
                {adminSig && (
                  <label className="mt-2 flex items-center gap-2 text-xs text-slate-600 cursor-pointer pl-1">
                    <input
                      type="checkbox"
                      checked={rememberSig}
                      onChange={(e) => setRememberSig(e.target.checked)}
                      className="rounded text-teal-700 focus:ring-teal-600"
                    />
                    <span>บันทึกลายเซ็นนี้ไว้ใช้ในการอนุมัติสัญญาครั้งถัดไปอัตโนมัติ</span>
                  </label>
                )}
              </div>

              {/* ตัวอย่างหนังสือสัญญาเช่าฉบับจริง (Live Interactive Contract Preview) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <FileText size={15} className="text-teal-700" />
                    ตัวอย่างหนังสือสัญญาที่จะส่งให้ผู้เช่า (พรีวิวลบลายเซ็นตามจริง)
                  </h4>
                  <span className="text-[11px] font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                    Live Preview
                  </span>
                </div>

                <OfficialContractDocument
                  contract={{
                    room_number: approvalModal.room?.room_number,
                    floor: approvalModal.room?.floor,
                    room_type: approvalModal.room?.room_type,
                    base_price: approvalModal.room?.base_price,
                    deposit: approvalModal.deposit,
                    start_date: approvalModal.startDate,
                    end_date: approvalModal.endDate,
                    status: 'pending_signature',
                    admin_signature: adminSig,
                    admin_signed_at: new Date()
                  }}
                  dormitory={dormInfo}
                  tenant={approvalModal.user}
                  liveAdminSignature={adminSig}
                  id="printable-kyc-preview-contract"
                /></div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-slate-50/80">
              <span className="text-xs text-slate-500">
                {adminSig ? (
                  <span className="text-emerald-700 font-medium inline-flex items-center gap-1">
                    <CheckCircle size={14} /> มีลายเซ็นผู้ให้เช่าพร้อมส่ง
                  </span>
                ) : (
                  'แนะนำให้ลงลายมือชื่อผู้ให้เช่าก่อนส่ง'
                )}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setApprovalModal(null)}
                  disabled={submittingApproval}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleConfirmApproval}
                  disabled={submittingApproval}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-teal-800 disabled:opacity-50 transition cursor-pointer"
                >
                  <Send size={14} />
                  {submittingApproval ? 'กำลังส่งสัญญา...' : 'อนุมัติ KYC & ส่งสัญญาให้ผู้เช่าลงนาม'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ดูเอกสาร KYC ที่ผู้สมัครแนบมา */}
      {viewDoc && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92dvh] overflow-y-auto p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-gray-800 text-sm">เอกสารของ {viewDoc.first_name} {viewDoc.last_name}</h3>
              <button onClick={() => setViewDoc(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer"><X size={18} /></button>
            </div>
            <label className="block text-sm text-gray-700">
              ห้องที่จะจัดสรร (ชั้น {rooms.find((room) => String(room.room_id) === String(selectedRooms[viewDoc.user_id]))?.floor || '-'})
              <select
                value={selectedRooms[viewDoc.user_id] ?? ''}
                onChange={(event) => setSelectedRooms((current) => ({
                  ...current,
                  [viewDoc.user_id]: event.target.value
                }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">เลือกห้องว่าง</option>
                {viewDoc.requested_room_id && !rooms.some((room) => String(room.room_id) === String(viewDoc.requested_room_id)) && (
                  <option value={viewDoc.requested_room_id} disabled>
                    ห้อง {viewDoc.requested_room_number} ไม่ว่าง
                  </option>
                )}
                {rooms.map((room) => (
                  <option key={room.room_id} value={room.room_id}>
                    ห้อง {room.room_number} · ชั้น {room.floor} · {room.room_type}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-gray-700">
              หมายเหตุการตรวจสอบ (ไม่บังคับ)
              <input
                type="text"
                maxLength="1000"
                value={reviewNotes[viewDoc.user_id] || ''}
                onChange={(event) => setReviewNotes((current) => ({
                  ...current,
                  [viewDoc.user_id]: event.target.value
                }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            {viewDoc.kyc_document.startsWith('data:application/pdf;') ? (
              <iframe title={`เอกสารของ ${viewDoc.first_name} ${viewDoc.last_name}`} src={viewDoc.kyc_document} className="h-[60dvh] w-full rounded-lg border bg-gray-50" />
            ) : (
              <div className="max-h-[60dvh] overflow-auto flex justify-center bg-gray-50 rounded-lg p-2">
                <img src={viewDoc.kyc_document} alt="เอกสารยืนยันตัวตนหรือสัญญา" className="max-w-full rounded-md shadow" />
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setViewDoc(null);
                  openApprovalModal(viewDoc);
                }}
                disabled={!selectedRooms[viewDoc.user_id]}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50 transition cursor-pointer"
              >
                อนุมัติและไปขั้นตอนออกสัญญา
              </button>
              <button
                type="button"
                onClick={() => handleReject(viewDoc.user_id)}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-2 rounded-lg text-sm font-semibold transition cursor-pointer"
              >
                ปฏิเสธ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ประวัติการตรวจสอบ */}
      <section className="space-y-3 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-gray-800">ประวัติการตรวจสอบ KYC</h2>
          <p className="text-sm text-gray-500">แสดงผลตรวจล่าสุดไม่เกิน 100 รายการ</p>
        </div>
        {history.length === 0 ? (
          <p className="py-5 text-center text-sm text-gray-400">ยังไม่มีประวัติการตรวจสอบ</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm text-gray-600">
              <thead className="border-b bg-gray-50 text-gray-700">
                <tr>
                  <th className="p-3">ผู้สมัคร</th>
                  <th className="p-3">ผลตรวจ</th>
                  <th className="p-3">ห้อง</th>
                  <th className="p-3">ผู้ตรวจ / วันเวลา</th>
                  <th className="p-3">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {history.map((review) => (
                  <tr key={review.review_id} className="border-b">
                    <td className="p-3 font-medium text-slate-800">{review.first_name} {review.last_name}</td>
                    <td className="p-3">
                      <span className={review.status === 'approved' ? 'font-semibold text-emerald-700' : 'font-semibold text-rose-700'}>
                        {review.status === 'approved' ? 'อนุมัติ & ส่งสัญญา' : 'ปฏิเสธ'}
                      </span>
                    </td>
                    <td className="p-3">
                      {review.requested_room_number ? `ขอ ${review.requested_room_number}` : 'ไม่ระบุ'}
                      {review.assigned_room_number && (
                        <span className="block text-xs text-gray-500">
                          จัดสรร {review.assigned_room_number} · ชั้น {review.assigned_room_floor}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {review.reviewer_first_name} {review.reviewer_last_name}
                      <span className="block text-xs text-gray-400">{new Date(review.reviewed_at).toLocaleString('th-TH')}</span>
                    </td>
                    <td className="p-3">{review.note || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
