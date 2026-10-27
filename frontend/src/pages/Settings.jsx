import { useCallback, useEffect, useState } from 'react';
import { Plus, Save, Trash2, ShieldCheck, UserPlus, Users } from 'lucide-react';
import api from '../api/axios';
import useToast from '../components/useToast';

export default function Settings() {
  const notify = useToast();
  const [admins, setAdmins] = useState([]);
  const [adminAccess, setAdminAccess] = useState('loading');
  const [adminForm, setAdminForm] = useState({
    username: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: ''
  });
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [rates, setRates] = useState({ water_rate: '', electric_rate: '' });
  const [dormitory, setDormitory] = useState({
    dormitory_name: 'ระบบจัดการหอพัก',
    dormitory_address: '',
    contact_phone: '',
    payment_instructions: '',
    promptpay_number: ''
  });
  const [roomTypes, setRoomTypes] = useState([]);
  const [newType, setNewType] = useState({ room_type: '', base_price: '' });
  const [loading, setLoading] = useState(true);
  const isPrimaryAdmin = admins.some((admin) => admin.is_primary_admin && admin.is_current_user);

  useEffect(() => {
    let cancelled = false;
    const loadSettings = async () => {
      try {
        const res = await api.get('/settings');
        if (cancelled) return;
        setRates({
          water_rate: res.data.water_rate,
          electric_rate: res.data.electric_rate
        });
        setDormitory({
          dormitory_name: res.data.dormitory_name || 'ระบบจัดการหอพัก',
          dormitory_address: res.data.dormitory_address || '',
          contact_phone: res.data.contact_phone || '',
          payment_instructions: res.data.payment_instructions || '',
          promptpay_number: res.data.promptpay_number || ''
        });
        setRoomTypes(res.data.room_types);
      } catch (err) {
        if (!cancelled) notify(err.response?.data?.error || 'โหลดการตั้งค่าไม่สำเร็จ', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void Promise.resolve().then(loadSettings).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [notify]);

  const loadAdmins = useCallback(async () => {
    try {
      const res = await api.get('/admins');
      setAdmins(res.data);
      setAdminAccess('allowed');
    } catch (err) {
      setAdminAccess('error');
      notify(err.response?.data?.error || 'โหลดบัญชีแอดมินไม่สำเร็จ', 'error');
    }
  }, [notify]);

  useEffect(() => {
    void Promise.resolve().then(loadAdmins).catch(() => {});
  }, [loadAdmins]);

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setSavingAdmin(true);
    try {
      await api.post('/admins', adminForm);
      setAdminForm({ username: '', password: '', first_name: '', last_name: '', phone: '' });
      notify('เพิ่มบัญชีแอดมินแล้ว', 'success');
      await loadAdmins();
    } catch (err) {
      notify(err.response?.data?.error || 'เพิ่มบัญชีแอดมินไม่สำเร็จ', 'error');
    } finally {
      setSavingAdmin(false);
    }
  };

  const handleDeleteAdmin = async (admin) => {
    if (!confirm(`ยืนยันลบบัญชีแอดมิน "${admin.username}"?`)) return;
    try {
      await api.delete(`/admins/${admin.user_id}`);
      setAdmins((current) => current.filter((item) => item.user_id !== admin.user_id));
      notify('ลบบัญชีแอดมินแล้ว', 'success');
    } catch (err) {
      notify(err.response?.data?.error || 'ลบบัญชีแอดมินไม่สำเร็จ', 'error');
    }
  };

  const handleSaveRates = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put('/settings/rates', {
        water_rate: Number(rates.water_rate),
        electric_rate: Number(rates.electric_rate)
      });
      setRates(res.data);
      notify('บันทึกอัตราค่าน้ำและค่าไฟแล้ว', 'success');
    } catch (err) {
      notify(err.response?.data?.error || 'บันทึกอัตราค่าน้ำและค่าไฟไม่สำเร็จ', 'error');
    }
  };

  const handleSaveDormitory = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put('/settings/dormitory', dormitory);
      setDormitory(res.data);
      window.dispatchEvent(new CustomEvent('dormitory-settings-updated', {
        detail: res.data.dormitory_name
      }));
      notify('บันทึกข้อมูลหอพักแล้ว', 'success');
    } catch (err) {
      notify(err.response?.data?.error || 'บันทึกข้อมูลหอพักไม่สำเร็จ', 'error');
    }
  };

  const handleAddRoomType = async (e) => {
    e.preventDefault();
    try {
      await api.post('/settings/room-types', {
        room_type: newType.room_type,
        base_price: Number(newType.base_price)
      });
      setNewType({ room_type: '', base_price: '' });
      const res = await api.get('/settings');
      setRates({
        water_rate: res.data.water_rate,
        electric_rate: res.data.electric_rate
      });
      setRoomTypes(res.data.room_types);
    } catch (err) {
      notify(err.response?.data?.error || 'เพิ่มประเภทห้องไม่สำเร็จ', 'error');
    }
  };

  const handleSaveRoomType = async (roomType) => {
    try {
      const res = await api.put(`/settings/room-types/${roomType.type_id}`, {
        base_price: Number(roomType.base_price)
      });
      setRoomTypes((current) => current.map((item) => (
        item.type_id === res.data.type_id ? res.data : item
      )));
    } catch (err) {
      notify(err.response?.data?.error || 'บันทึกราคาห้องไม่สำเร็จ', 'error');
    }
  };

  const handleDeleteRoomType = async (roomType) => {
    if (!confirm(`ยืนยันลบประเภทห้อง "${roomType.room_type}"?`)) return;
    try {
      await api.delete(`/settings/room-types/${roomType.type_id}`);
      setRoomTypes((current) => current.filter((item) => item.type_id !== roomType.type_id));
    } catch (err) {
      notify(err.response?.data?.error || 'ลบประเภทห้องไม่สำเร็จ', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">ตั้งค่าหอพัก</h1>
        <p className="text-sm text-gray-500">จัดการข้อมูลหอพัก อัตราค่าน้ำ ค่าไฟ และราคาเริ่มต้นตามประเภทห้อง</p>
      </div>

      {loading ? (
        <p className="text-center py-6 text-gray-500">กำลังโหลดการตั้งค่า...</p>
      ) : (
        <>
          <form onSubmit={handleSaveDormitory} className="space-y-4 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <div>
              <h2 className="font-semibold text-gray-800">ข้อมูลหอพักสำหรับเอกสาร</h2>
              <p className="mt-1 text-sm text-gray-500">ข้อมูลนี้จะแสดงบนใบแจ้งหนี้และใบเสร็จ</p>
            </div>
            <label className="block text-sm text-gray-700">
              ชื่อหอพัก
              <input
                required
                maxLength="150"
                value={dormitory.dormitory_name}
                onChange={(e) => setDormitory({ ...dormitory, dormitory_name: e.target.value })}
                className="mt-1 w-full rounded-lg border p-2.5"
              />
            </label>
            <label className="block text-sm text-gray-700">
              ที่อยู่
              <textarea
                maxLength="500"
                rows="2"
                value={dormitory.dormitory_address}
                onChange={(e) => setDormitory({ ...dormitory, dormitory_address: e.target.value })}
                className="mt-1 w-full rounded-lg border p-2.5"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-gray-700">
                เบอร์โทรศัพท์ติดต่อ
                <input
                  type="tel"
                  maxLength="50"
                  value={dormitory.contact_phone}
                  onChange={(e) => setDormitory({ ...dormitory, contact_phone: e.target.value })}
                  className="mt-1 w-full rounded-lg border p-2.5"
                />
              </label>
              <label className="text-sm text-gray-700">
                คำแนะนำการชำระเงิน
                <textarea
                  maxLength="1000"
                  rows="2"
                  value={dormitory.payment_instructions}
                  onChange={(e) => setDormitory({ ...dormitory, payment_instructions: e.target.value })}
                  className="mt-1 w-full rounded-lg border p-2.5"
                />
              </label>
              <label className="text-sm text-gray-700">
                เบอร์พร้อมเพย์สำหรับรับชำระ
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]{10}"
                  maxLength="10"
                  value={dormitory.promptpay_number}
                  onChange={(e) => setDormitory({
                    ...dormitory,
                    promptpay_number: e.target.value.replace(/\D/g, '').slice(0, 10)
                  })}
                  className="mt-1 w-full rounded-lg border p-2.5"
                  placeholder="เช่น 0948860469"
                />
                <span className="mt-1 block text-xs text-gray-500">เว้นว่างเพื่อไม่แสดงช่องทางพร้อมเพย์ในบิล</span>
              </label>
            </div>
            <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700">
              <Save size={16} /> บันทึกข้อมูลหอพัก
            </button>
          </form>

          <form onSubmit={handleSaveRates} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
            <h2 className="font-semibold text-gray-800">อัตราค่าสาธารณูปโภค</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="text-sm text-gray-700">
                ค่าน้ำ (บาท / หน่วย)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={rates.water_rate}
                  onChange={(e) => setRates({ ...rates, water_rate: e.target.value })}
                  className="mt-1 w-full border p-2.5 rounded-lg"
                />
              </label>
              <label className="text-sm text-gray-700">
                ค่าไฟ (บาท / หน่วย)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={rates.electric_rate}
                  onChange={(e) => setRates({ ...rates, electric_rate: e.target.value })}
                  className="mt-1 w-full border p-2.5 rounded-lg"
                />
              </label>
            </div>
            <button type="submit" className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
              <Save size={16} /> บันทึกอัตรา
            </button>
          </form>

          <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-5">
            <div>
              <h2 className="font-semibold text-gray-800">ประเภทห้องและราคา</h2>
              <p className="text-sm text-gray-500 mt-1">ราคาเหล่านี้จะถูกนำไปใช้เมื่อเพิ่มห้องใหม่</p>
            </div>
            {roomTypes.length > 0 ? (
              <div className="divide-y">
                {roomTypes.map((roomType) => (
                  <div key={roomType.type_id} className="py-3 flex flex-wrap items-center gap-3">
                    <span className="font-medium text-gray-800 flex-1 min-w-32">{roomType.room_type}</span>
                    <label className="text-sm text-gray-600 flex items-center gap-2">
                      ราคา/เดือน
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={roomType.base_price}
                        onChange={(e) => setRoomTypes((current) => current.map((item) => (
                          item.type_id === roomType.type_id
                            ? { ...item, base_price: e.target.value }
                            : item
                        )))}
                        className="w-36 border p-2 rounded-lg"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => handleSaveRoomType(roomType)}
                      className="p-2 rounded-lg text-indigo-600 hover:bg-indigo-50"
                      title="บันทึกราคา"
                    >
                      <Save size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteRoomType(roomType)}
                      className="p-2 rounded-lg text-red-500 hover:bg-red-50"
                      title="ลบประเภทห้อง"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">ยังไม่มีประเภทห้อง กรุณาเพิ่มประเภทห้องด้านล่างก่อนสร้างห้อง</p>
            )}

            <form onSubmit={handleAddRoomType} className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 border-t pt-4">
              <input
                type="text"
                required
                value={newType.room_type}
                onChange={(e) => setNewType({ ...newType, room_type: e.target.value })}
                placeholder="ชื่อประเภท เช่น ห้องกลาง"
                className="border p-2.5 rounded-lg"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={newType.base_price}
                onChange={(e) => setNewType({ ...newType, base_price: e.target.value })}
                placeholder="ค่าเช่าต่อเดือน"
                className="border p-2.5 rounded-lg"
              />
              <button type="submit" className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
                <Plus size={16} /> เพิ่มประเภท
              </button>
            </form>
          </section>

          <section className="space-y-5 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 text-indigo-600" size={21} />
              <div>
                <h2 className="font-semibold text-gray-800">จัดการบัญชีแอดมิน</h2>
                <p className="mt-1 text-sm text-gray-500">เฉพาะแอดมินหลักเท่านั้นที่เพิ่มหรือลบบัญชีแอดมินได้</p>
              </div>
            </div>

            {adminAccess === 'loading' ? (
              <p className="text-sm text-gray-500">กำลังตรวจสอบสิทธิ์...</p>
            ) : adminAccess === 'error' ? (
              <button type="button" onClick={loadAdmins} className="text-sm font-medium text-indigo-700 hover:underline">
                ลองโหลดรายชื่อแอดมินอีกครั้ง
              </button>
            ) : (
              <>
                {isPrimaryAdmin ? (
                  <form onSubmit={handleCreateAdmin} className="grid gap-3 border-b border-gray-100 pb-5 sm:grid-cols-2">
                    <input
                      required
                      maxLength="100"
                      value={adminForm.username}
                      onChange={(e) => setAdminForm({ ...adminForm, username: e.target.value })}
                      placeholder="ชื่อผู้ใช้"
                      className="rounded-lg border p-2.5 text-sm"
                    />
                    <input
                      required
                      type="password"
                      minLength="8"
                      maxLength="128"
                      value={adminForm.password}
                      onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                      placeholder="รหัสผ่าน (อย่างน้อย 8 ตัว)"
                      className="rounded-lg border p-2.5 text-sm"
                    />
                    <input
                      required
                      maxLength="100"
                      value={adminForm.first_name}
                      onChange={(e) => setAdminForm({ ...adminForm, first_name: e.target.value })}
                      placeholder="ชื่อ"
                      className="rounded-lg border p-2.5 text-sm"
                    />
                    <input
                      required
                      maxLength="100"
                      value={adminForm.last_name}
                      onChange={(e) => setAdminForm({ ...adminForm, last_name: e.target.value })}
                      placeholder="นามสกุล"
                      className="rounded-lg border p-2.5 text-sm"
                    />
                    <input
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]{10}"
                      maxLength="10"
                      value={adminForm.phone}
                      onChange={(e) => setAdminForm({ ...adminForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                      placeholder="เบอร์โทรศัพท์ 10 หลัก (ไม่บังคับ)"
                      className="rounded-lg border p-2.5 text-sm"
                    />
                    <button
                      type="submit"
                      disabled={savingAdmin}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      <UserPlus size={16} /> {savingAdmin ? 'กำลังเพิ่ม...' : 'เพิ่มแอดมิน'}
                    </button>
                  </form>
                ) : (
                  <p className="border-l-2 border-amber-400 bg-amber-50 p-3 text-sm text-amber-800">
                    ดูรายชื่อแอดมินได้ แต่การเพิ่มหรือลบทำได้โดยแอดมินหลักเท่านั้น
                  </p>
                )}

                <div className="space-y-2">
                  {admins.map((admin) => (
                    <div key={admin.user_id} className="flex flex-wrap items-center gap-3 border-b border-gray-100 py-3 last:border-0">
                      <Users size={17} className="text-gray-400" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-800">{admin.first_name} {admin.last_name} <span className="font-normal text-gray-500">({admin.username})</span></p>
                        <p className="text-xs text-gray-500">{admin.phone || 'ไม่มีเบอร์โทร'}</p>
                      </div>
                      {admin.is_primary_admin ? (
                        <span className="bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">แอดมินหลัก</span>
                      ) : isPrimaryAdmin ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteAdmin(admin)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 size={14} /> ลบ
                        </button>
                      ) : null}
                    </div>
                  ))}
                  {admins.length === 0 && <p className="text-sm text-gray-500">ไม่พบบัญชีแอดมิน</p>}
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
