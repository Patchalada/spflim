import { useCallback, useEffect, useState } from 'react';
import { Building, User, Edit2, X, FileText, CheckCircle, Clock, UploadCloud, Image as ImageIcon, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import useToast from '../components/useToast';
import Pagination from '../components/Pagination';
import ContractDocumentModal from '../components/ContractDocumentModal';

export default function TenantDashboard() {
  const notify = useToast();
  const [profile, setProfile] = useState(null);
  const [bills, setBills] = useState([]);
  const [billPage, setBillPage] = useState(1);
  const [billPageSize, setBillPageSize] = useState(10);
  const [billTotal, setBillTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', phone: '' });

  // จัดการอัปโหลดสลิป
  const [uploadingBillId, setUploadingBillId] = useState(null);
  const [selectedSlipModal, setSelectedSlipModal] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [profileRes, billsRes] = await Promise.all([
        api.get('/tenant/me'),
        api.get('/tenant/my-bills', { params: { page: billPage, page_size: billPageSize } })
      ]);

      const profileData = profileRes.data || {};
      setProfile(profileData);
      setBills(billsRes.data.items);
      setBillTotal(billsRes.data.pagination.total);

      setEditForm({
        first_name: profileData.first_name || '',
        last_name: profileData.last_name || '',
        phone: profileData.phone || ''
      });
    } catch (err) {
      console.error('Error fetching tenant data:', err);
    } finally {
      setLoading(false);
    }
  }, [billPage, billPageSize]);

  useEffect(() => {
    void Promise.resolve().then(fetchData).catch(() => {});
  }, [fetchData]);

  // รับ Event แจ้งเตือนแบบ Real-time และการคลิกจากการแจ้งเตือนเพื่อรีเฟรชข้อมูลห้องพักและบิลของผู้เช่าทันที
  useEffect(() => {
    const handleRealtimeUpdate = () => {
      void Promise.resolve().then(fetchData).catch(() => {});
    };

    window.addEventListener('dormitory-refresh-page', handleRealtimeUpdate);
    window.addEventListener('dormitory-realtime-notification', handleRealtimeUpdate);

    return () => {
      window.removeEventListener('dormitory-refresh-page', handleRealtimeUpdate);
      window.removeEventListener('dormitory-realtime-notification', handleRealtimeUpdate);
    };
  }, [fetchData]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      await api.put('/tenant/update-profile', editForm);
      notify('แก้ไขข้อมูลส่วนตัวสำเร็จ', 'success');
      setShowEditModal(false);
      await fetchData();
    } catch (err) {
      notify(err.response?.data?.error || 'ไม่สามารถแก้ไขข้อมูลได้', 'error');
    }
  };

  // จัดการแปลงไฟล์รูปเป็น Base64 แล้วส่งไปบันทึก
  const handleFileChange = (e, billId) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      notify('ขนาดไฟล์รูปต้องไม่เกิน 5MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        setUploadingBillId(billId);
        const response = await api.post('/tenant/upload-slip', {
          bill_id: billId,
          slip_image: reader.result
        });
        const result = response.data || {};
        notify(
          `${result.simulated ? '[ผลจำลอง] ' : ''}${result.message || 'ส่งสลิปเรียบร้อยแล้ว'}${result.notification_warning ? ` (${result.notification_warning})` : ''}`,
          result.verification_status === 'rejected' || result.verification_status === 'duplicate' ? 'error' : 'success'
        );
        await fetchData();
      } catch (err) {
        notify(err.response?.data?.error || 'อัปโหลดสลิปไม่สำเร็จ', 'error');
      } finally {
        setUploadingBillId(null);
      }
    };
    reader.readAsDataURL(file);
  };

  if (loading) return <p className="text-center py-8 text-gray-500">กำลังโหลดข้อมูลผู้เช่า...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">แดชบอร์ดผู้เช่า</h1>

      {profile?.contract_status === 'pending_signature' && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg text-amber-800">
              <FileText size={22} />
            </div>
            <div>
              <h3 className="font-bold text-amber-900 text-sm">สัญญาเช่าห้องพักรอการลงนามจากคุณ</h3>
              <p className="text-xs text-amber-800">
                ผู้ดูแลหอพักได้ตรวจสอบเอกสาร KYC ผ่านแล้ว กรุณาตรวจสอบและลงนามสัญญาเช่าเพื่อเริ่มต้นการเข้าพัก
              </p>
            </div>
          </div>
          <Link
            to="/my-contract"
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 transition"
          >
            ไปหน้าลงนามสัญญา <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* ข้อมูลโปรไฟล์ และห้องพัก */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <User className="text-indigo-600" size={20} /> ข้อมูลส่วนตัว
            </h2>
            <button 
              onClick={() => setShowEditModal(true)} 
              className="text-xs text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer font-medium"
            >
              <Edit2 size={14} /> แก้ไขข้อมูล
            </button>
          </div>
          <div className="space-y-2 text-sm text-gray-600">
            <p><span className="font-semibold text-gray-700">ชื่อ-นามสกุล:</span> {profile?.first_name} {profile?.last_name}</p>
            <p><span className="font-semibold text-gray-700">เบอร์โทรศัพท์:</span> {profile?.phone || '-'}</p>
            <p><span className="font-semibold text-gray-700">ชื่อผู้ใช้:</span> {profile?.username}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Building className="text-indigo-600" size={20} /> สัญญาเช่าห้องพัก
              </h2>
              {profile?.contract_id && (
                <div className="flex items-center gap-2">
                  <button 
                    type="button"
                    onClick={() => setShowContractModal(true)} 
                    className="text-xs bg-teal-50 hover:bg-teal-100 text-teal-700 font-semibold px-2.5 py-1 rounded-md flex items-center gap-1 transition cursor-pointer"
                  >
                    <FileText size={13} /> ดูสัญญาเช่า
                  </button>
                  <Link 
                    to="/my-contract" 
                    className="text-xs text-indigo-600 hover:underline font-medium"
                  >
                    หน้าสัญญาเต็ม
                  </Link>
                </div>
              )}
            </div>
            {profile?.room_number ? (
              <div className="space-y-2 text-sm text-gray-600">
                <p><span className="font-semibold text-gray-700">ห้องพัก:</span> <span className="text-indigo-600 font-bold">ห้อง {profile.room_number}</span> (ชั้น {profile.floor})</p>
                <p><span className="font-semibold text-gray-700">ประเภทห้อง:</span> {profile.room_type}</p>
                <p><span className="font-semibold text-gray-700">ค่าเช่า:</span> ฿{Number(profile.base_price || 0).toLocaleString()} / เดือน</p>
                <p><span className="font-semibold text-gray-700">เงินประกัน:</span> ฿{Number(profile.deposit || 0).toLocaleString()}</p>
                <p><span className="font-semibold text-gray-700">วันเริ่มสัญญา:</span> {profile.start_date ? new Date(profile.start_date).toLocaleDateString('th-TH') : '-'}</p>
                <p><span className="font-semibold text-gray-700">วันสิ้นสุดสัญญา:</span> {profile.end_date ? new Date(profile.end_date).toLocaleDateString('th-TH') : '-'}</p>
                <p><span className="font-semibold text-gray-700">สถานะสัญญา:</span> {profile.contract_status === 'pending_signature' ? <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">รอคุณลงนามสัญญา</span> : profile.contract_status === 'active' ? <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">ใช้งานอยู่</span> : profile.contract_status || '-'}</p>
                <p><span className="font-semibold text-gray-700">เอกสารสัญญา:</span> {profile.has_kyc_document ? <span className="text-emerald-700 font-medium">แนบไฟล์ตอนสมัครแล้ว</span> : <span className="text-amber-600 font-medium">ยังไม่มีไฟล์แนบ</span>}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-400">ยังไม่มีสัญญาเช่าที่ใช้งานอยู่</p>
            )}
          </div>
        </div>
      </div>

      {/* ประวัติบิลและการชำระเงิน */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <FileText className="text-indigo-600" size={20} /> บิลและประวัติการชำระเงิน
        </h2>
        {bills.length > 0 ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {bills.map((b) => (
              <article key={b.bill_id} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className={`flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4 ${
                  b.payment_status === 'paid' ? 'bg-emerald-50/70' : 'bg-amber-50/70'
                }`}>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">บิล #{String(b.bill_id).padStart(6, '0')}</p>
                    <h3 className="mt-1 text-lg font-bold text-gray-900">รอบบิล {String(b.month).padStart(2, '0')}/{b.year}</h3>
                    <p className="mt-1 text-xs text-gray-600">
                      ครบกำหนด {b.due_date ? new Date(`${String(b.due_date).slice(0, 10)}T00:00:00`).toLocaleDateString('th-TH') : '-'}
                    </p>
                  </div>
                  {b.payment_status === 'paid' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                      <CheckCircle size={14} /> ชำระแล้ว
                    </span>
                  ) : b.slip_verification_status === 'rejected' || b.slip_verification_status === 'duplicate' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-700">
                      {b.slip_verification_status === 'duplicate' ? 'สลิปซ้ำ' : 'ตรวจสลิปไม่ผ่าน'}
                    </span>
                  ) : b.slip_verification_status === 'manual_review' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-3 py-1.5 text-xs font-semibold text-sky-700">
                      <Clock size={14} /> รอตรวจสลิป
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800">
                      <Clock size={14} /> รอชำระ
                    </span>
                  )}
                </div>

                <div className="space-y-3 p-5">
                  <div className="divide-y divide-gray-100 rounded-lg border border-gray-100 px-3">
                    <div className="flex justify-between gap-3 py-2.5 text-sm">
                      <span className="text-gray-600">ค่าเช่าห้องพัก</span>
                      <span className="font-medium text-gray-800">฿{Number(b.rent_amount || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between gap-3 py-2.5 text-sm">
                      <span className="text-gray-600">
                        ค่าน้ำ <span className="text-xs text-gray-400">({b.water_unit} หน่วย · มิเตอร์ {b.water_old_meter ?? 0} → {b.water_new_meter ?? '-'})</span>
                      </span>
                      <span className="shrink-0 font-medium text-gray-800">฿{Number(b.water_amount || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between gap-3 py-2.5 text-sm">
                      <span className="text-gray-600">
                        ค่าไฟ <span className="text-xs text-gray-400">({b.electric_unit} หน่วย · มิเตอร์ {b.electric_old_meter ?? 0} → {b.electric_new_meter ?? '-'})</span>
                      </span>
                      <span className="shrink-0 font-medium text-gray-800">฿{Number(b.electric_amount || 0).toLocaleString()}</span>
                    </div>
                    {(Array.isArray(b.extra_charges) ? b.extra_charges : []).map((charge, index) => (
                      <div key={`${b.bill_id}-extra-${index}`} className="flex justify-between gap-3 py-2.5 text-sm">
                        <span className="text-gray-600">{charge.description}</span>
                        <span className="shrink-0 font-medium text-gray-800">฿{Number(charge.amount || 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-dashed border-gray-200 pt-3">
                    <span className="text-sm font-semibold text-gray-600">ยอดชำระทั้งหมด</span>
                    <span className="text-xl font-bold text-teal-700">฿{Number(b.total_amount || 0).toLocaleString()}</span>
                  </div>

                  {b.payment_status !== 'paid' && b.promptpay_number && (
                    <div className="rounded-lg border border-teal-100 bg-teal-50 px-4 py-3">
                      <p className="text-xs font-semibold text-teal-800">ช่องทางชำระเงิน</p>
                      <p className="mt-1 text-sm font-medium text-gray-800">พร้อมเพย์: {b.promptpay_number}</p>
                      <p className="mt-1 text-xs text-gray-600">โอนตามยอดบิล แล้วแนบสลิปเพื่อแจ้งชำระ</p>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Link
                      to={`/bills/${b.bill_id}`}
                      className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-teal-800"
                    >
                      <FileText size={16} /> {b.payment_status === 'paid' ? 'ดูใบเสร็จ / พิมพ์' : 'ดูใบแจ้งหนี้ / พิมพ์'}
                    </Link>
                    {b.payment_status !== 'paid' && (
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3.5 py-2 text-sm font-medium text-teal-800 hover:bg-teal-100">
                        <UploadCloud size={15} />
                        <span>{uploadingBillId === b.bill_id ? 'กำลังส่ง...' : b.has_slip ? 'เปลี่ยนสลิป' : 'แนบสลิป'}</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          disabled={uploadingBillId === b.bill_id}
                          onChange={(e) => handleFileChange(e, b.bill_id)}
                        />
                      </label>
                    )}
                    {b.slip_verification_message && b.payment_status !== 'paid' && (
                      <p className="w-full text-xs text-gray-500">{b.slip_verification_message}</p>
                    )}
                    {b.has_slip && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const response = await api.get(`/bills/${b.bill_id}/slip`);
                            setSelectedSlipModal(response.data.slip_image);
                          } catch (err) {
                            notify(err.response?.data?.error || 'โหลดสลิปไม่สำเร็จ', 'error');
                          }
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
                      >
                        <ImageIcon size={16} /> ดูสลิป
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-10 text-center">
            <FileText className="mx-auto text-gray-400" size={30} />
            <p className="mt-2 text-sm text-gray-500">ยังไม่มีประวัติบิลหรือใบแจ้งชำระเงิน</p>
          </div>
        )}
        {billTotal > 0 && (
          <Pagination
            page={billPage}
            pageSize={billPageSize}
            total={billTotal}
            onPageChange={setBillPage}
            onPageSizeChange={(size) => { setBillPageSize(size); setBillPage(1); }}
          />
        )}
      </div>

      {/* Modal ดูภาพสลิป */}
      {selectedSlipModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-gray-800 text-sm">หลักฐานการโอนเงิน</h3>
              <button onClick={() => setSelectedSlipModal(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="max-h-96 overflow-auto flex justify-center bg-gray-50 rounded-lg p-2">
              <img src={selectedSlipModal} alt="Slip" className="max-w-full rounded-md shadow" />
            </div>
            <button 
              onClick={() => setSelectedSlipModal(null)} 
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium transition cursor-pointer"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      )}

      {/* Modal แก้ไขข้อมูลส่วนตัว */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-lg text-gray-800">แก้ไขข้อมูลส่วนตัว</h3>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleUpdateProfile} className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">ชื่อจริง</label>
                <input 
                  type="text" 
                  value={editForm.first_name} 
                  onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} 
                  className="w-full border p-2 rounded-lg text-sm" 
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">นามสกุล</label>
                <input 
                  type="text" 
                  value={editForm.last_name} 
                  onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} 
                  className="w-full border p-2 rounded-lg text-sm" 
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">เบอร์โทรศัพท์</label>
                <input 
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]{10}"
                  maxLength="10"
                  value={editForm.phone} 
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  className="w-full border p-2 rounded-lg text-sm" 
                />
              </div>
              <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 mt-2">
                บันทึกการเปลี่ยนแปลง
              </button>
            </form>
          </div>
        </div>
      )}

      {/* โมดอลแสดงสัญญาเช่าฉบับเต็ม พร้อมพิมพ์/ดาวน์โหลด */}
      {showContractModal && (profile?.contracts?.[0] || profile?.contract_id) && (
        <ContractDocumentModal
          contract={{
            ...(profile?.contracts?.[0] || {}),
            contract_id: profile?.contracts?.[0]?.contract_id || profile?.contract_id,
            start_date: profile?.contracts?.[0]?.start_date || profile?.start_date,
            end_date: profile?.contracts?.[0]?.end_date || profile?.end_date,
            deposit: profile?.contracts?.[0]?.deposit || profile?.deposit,
            status: profile?.contracts?.[0]?.contract_status || profile?.contracts?.[0]?.status || profile?.contract_status || 'active',
            admin_signature: profile?.contracts?.[0]?.admin_signature || profile?.admin_signature,
            admin_signed_at: profile?.contracts?.[0]?.admin_signed_at || profile?.admin_signed_at,
            tenant_signature: profile?.contracts?.[0]?.tenant_signature || profile?.tenant_signature,
            tenant_signed_at: profile?.contracts?.[0]?.tenant_signed_at || profile?.tenant_signed_at,
            signed_document: profile?.contracts?.[0]?.signed_document || profile?.signed_document,
            tenant_id: profile.user_id,
            user_id: profile.user_id,
            first_name: profile.first_name,
            last_name: profile.last_name,
            phone: profile.phone,
            username: profile.username,
            room_number: profile.room_number,
            floor: profile.floor,
            room_type: profile.room_type,
            base_price: profile.base_price,
            dormitory_name: profile.dormitory_name || profile.settings?.dormitory_name,
            dormitory_address: profile.dormitory_address || profile.settings?.dormitory_address,
            contact_phone: profile.contact_phone || profile.settings?.contact_phone,
            water_rate: profile.water_rate ?? profile.settings?.water_rate,
            electric_rate: profile.electric_rate ?? profile.settings?.electric_rate,
            application_document: profile.application_document,
            has_kyc_document: profile.has_kyc_document,
          }}
          documents={profile.documents || []}
          onClose={() => setShowContractModal(false)}
        />
      )}
    </div>
  );
}