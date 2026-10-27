import { useCallback, useEffect, useState } from 'react';
import { Search, UserPlus, X } from 'lucide-react';
import api from '../api/axios';
import useToast from './useToast';
import Pagination from './Pagination';

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const endDateForStart = (startDate) => {
  if (!startDate) return '';
  const date = new Date(`${startDate}T00:00:00`);
  const month = date.getMonth();
  date.setFullYear(date.getFullYear() + 1);
  if (date.getMonth() !== month) date.setDate(0);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export default function ContractAssignmentModal({ initialTenant = null, initialRoom = null, onClose, onAssigned }) {
  const notify = useToast();
  const initialTenantId = initialTenant?.user_id;
  const [tenantRows, setTenantRows] = useState([]);
  const [roomRows, setRoomRows] = useState([]);
  const [tenantSearch, setTenantSearch] = useState('');
  const [roomSearch, setRoomSearch] = useState('');
  const [tenantPage, setTenantPage] = useState(1);
  const [roomPage, setRoomPage] = useState(1);
  const [tenantPageSize, setTenantPageSize] = useState(10);
  const [roomPageSize, setRoomPageSize] = useState(10);
  const [tenantTotal, setTenantTotal] = useState(0);
  const [roomTotal, setRoomTotal] = useState(0);
  const [selectedTenant, setSelectedTenant] = useState(initialTenant);
  const [selectedRoom, setSelectedRoom] = useState(initialRoom);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    start_date: today(),
    end_date: endDateForStart(today()),
    deposit: '0'
  });
  const fetchTenants = useCallback(async () => {
    setLoadingTenants(true);
    try {
      const response = await api.get('/tenant/available-tenants', {
        params: {
          page: tenantPage,
          page_size: tenantPageSize,
          search: tenantSearch,
          status: initialTenantId || ''
        }
      });
      setTenantRows(response.data.items);
      setTenantTotal(response.data.pagination.total);
    } catch (err) {
      notify(err.response?.data?.error || 'โหลดรายชื่อผู้เช่าไม่สำเร็จ', 'error');
    } finally {
      setLoadingTenants(false);
    }
  }, [initialTenantId, notify, tenantPage, tenantPageSize, tenantSearch]);

  const fetchRooms = useCallback(async () => {
    setLoadingRooms(true);
    try {
      const response = await api.get('/rooms', {
        params: { page: roomPage, page_size: roomPageSize, search: roomSearch, status: 'vacant' }
      });
      setRoomRows(response.data.items);
      setRoomTotal(response.data.pagination.total);
    } catch (err) {
      notify(err.response?.data?.error || 'โหลดรายการห้องว่างไม่สำเร็จ', 'error');
    } finally {
      setLoadingRooms(false);
    }
  }, [notify, roomPage, roomPageSize, roomSearch]);

  useEffect(() => {
    void Promise.resolve().then(fetchTenants).catch(() => {});
  }, [fetchTenants]);

  useEffect(() => {
    void Promise.resolve().then(fetchRooms).catch(() => {});
  }, [fetchRooms]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedTenant || !selectedRoom) {
      notify('กรุณาเลือกผู้เช่าและห้องพัก', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.post('/contracts', {
        tenant_id: selectedTenant.user_id,
        room_id: selectedRoom.room_id,
        start_date: form.start_date,
        end_date: endDateForStart(form.start_date),
        deposit: Number(form.deposit)
      });
      notify(`จัดสรรห้อง ${selectedRoom.room_number} ให้ ${selectedTenant.first_name} ${selectedTenant.last_name} แล้ว`, 'success');
      await onAssigned();
      onClose();
    } catch (err) {
      notify(err.response?.data?.error || err.response?.data?.message || 'ไม่สามารถจัดสรรห้องพักได้', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-4">
      <form
        onSubmit={handleSubmit}
        className={`my-auto max-h-[calc(100dvh-1.5rem)] w-full space-y-4 overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:space-y-5 sm:p-6 ${
          initialTenant || initialRoom ? 'max-w-2xl' : 'max-w-5xl'
        }`}
      >
        <div className="flex items-start justify-between border-b pb-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900">จัดสรรผู้เช่าเข้าห้อง</h2>
            <p className="mt-1 text-sm text-gray-500">ค้นหาและเลือกจากรายการได้ ไม่ต้องเลื่อน dropdown ยาว</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100" aria-label="ปิด">
            <X size={20} />
          </button>
        </div>

        {(initialTenant || initialRoom) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {initialTenant && (
              <div className="rounded-xl border border-teal-200 bg-teal-50 p-3">
                <p className="text-xs font-medium text-teal-700">ผู้เช่าที่เลือก</p>
                <p className="mt-1 font-semibold text-gray-800">{initialTenant.first_name} {initialTenant.last_name}</p>
                <p className="text-xs text-gray-500">{initialTenant.username} · {initialTenant.phone || 'ไม่มีเบอร์โทร'}</p>
              </div>
            )}
            {initialRoom && (
              <div className="rounded-xl border border-teal-200 bg-teal-50 p-3">
                <p className="text-xs font-medium text-teal-700">ห้องที่เลือก</p>
                <p className="mt-1 font-semibold text-gray-800">ห้อง {initialRoom.room_number} · ชั้น {initialRoom.floor}</p>
                <p className="text-xs text-gray-500">{initialRoom.room_type} · ฿{Number(initialRoom.base_price).toLocaleString()}/เดือน</p>
              </div>
            )}
          </div>
        )}

        <div className={`grid gap-5 ${initialTenant || initialRoom ? 'lg:grid-cols-1' : 'lg:grid-cols-2'}`}>
          {!initialTenant && <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">1. เลือกผู้เช่าที่ยังไม่มีห้อง</h3>
              <div className="relative mt-2">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={tenantSearch}
                  onChange={(event) => { setTenantSearch(event.target.value); setTenantPage(1); }}
                  placeholder="ค้นหาชื่อ เบอร์โทร หรือ username"
                  className="w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm"
                />
              </div>
            </div>
            <div className={`${initialTenant || initialRoom ? 'max-h-48' : 'max-h-64'} space-y-2 overflow-y-auto rounded-xl border border-gray-100 p-2`}>
              {loadingTenants ? <p className="p-4 text-center text-sm text-gray-500">กำลังโหลด...</p> : tenantRows.map((tenant) => (
                <button
                  key={tenant.user_id}
                  type="button"
                  onClick={() => setSelectedTenant(tenant)}
                  className={`w-full rounded-lg border p-3 text-left transition ${
                    selectedTenant?.user_id === tenant.user_id ? 'border-teal-600 bg-teal-50 ring-1 ring-teal-600' : 'border-gray-100 hover:bg-gray-50'
                  }`}
                >
                  <span className="block text-sm font-semibold text-gray-800">{tenant.first_name} {tenant.last_name}</span>
                  <span className="mt-0.5 block text-xs text-gray-500">{tenant.username} · {tenant.phone || 'ไม่มีเบอร์โทร'}</span>
                </button>
              ))}
              {!loadingTenants && tenantRows.length === 0 && <p className="p-4 text-center text-sm text-gray-500">ไม่พบผู้เช่าที่ยังไม่มีห้อง</p>}
            </div>
            <Pagination
              page={tenantPage}
              pageSize={tenantPageSize}
              total={tenantTotal}
              onPageChange={setTenantPage}
              onPageSizeChange={(size) => { setTenantPageSize(size); setTenantPage(1); }}
            />
            {selectedTenant && !initialTenant && <p className="text-xs font-medium text-teal-700">เลือกแล้ว: {selectedTenant.first_name} {selectedTenant.last_name}</p>}
          </section>}

          {!initialRoom && <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">2. เลือกห้องว่าง</h3>
              <div className="relative mt-2">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={roomSearch}
                  onChange={(event) => { setRoomSearch(event.target.value); setRoomPage(1); }}
                  placeholder="ค้นหาเลขห้อง ชั้น หรือประเภท"
                  className="w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm"
                />
              </div>
            </div>
            <div className={`${initialTenant || initialRoom ? 'max-h-48' : 'max-h-64'} space-y-2 overflow-y-auto rounded-xl border border-gray-100 p-2`}>
              {loadingRooms ? <p className="p-4 text-center text-sm text-gray-500">กำลังโหลด...</p> : roomRows.map((room) => (
                <button
                  key={room.room_id}
                  type="button"
                  onClick={() => setSelectedRoom(room)}
                  className={`w-full rounded-lg border p-3 text-left transition ${
                    selectedRoom?.room_id === room.room_id ? 'border-teal-600 bg-teal-50 ring-1 ring-teal-600' : 'border-gray-100 hover:bg-gray-50'
                  }`}
                >
                  <span className="block text-sm font-semibold text-gray-800">ห้อง {room.room_number} · ชั้น {room.floor}</span>
                  <span className="mt-0.5 block text-xs text-gray-500">{room.room_type} · ฿{Number(room.base_price).toLocaleString()}/เดือน</span>
                </button>
              ))}
              {!loadingRooms && roomRows.length === 0 && <p className="p-4 text-center text-sm text-gray-500">ไม่พบห้องว่าง</p>}
            </div>
            <Pagination
              page={roomPage}
              pageSize={roomPageSize}
              total={roomTotal}
              onPageChange={setRoomPage}
              onPageSizeChange={(size) => { setRoomPageSize(size); setRoomPage(1); }}
            />
            {selectedRoom && !initialRoom && <p className="text-xs font-medium text-teal-700">เลือกแล้ว: ห้อง {selectedRoom.room_number}</p>}
          </section>}
        </div>

        <div className="grid gap-3 border-t pt-4 sm:grid-cols-3">
          <label className="text-sm text-gray-700">วันเริ่มสัญญา
            <input type="date" required value={form.start_date} onChange={(event) => setForm({ ...form, start_date: event.target.value, end_date: endDateForStart(event.target.value) })} className="mt-1 w-full rounded-lg border p-2.5" />
          </label>
          <label className="text-sm text-gray-700">วันสิ้นสุดสัญญา
            <input type="date" readOnly value={form.end_date} className="mt-1 w-full rounded-lg border bg-gray-100 p-2.5" />
            <span className="mt-1 block text-xs text-gray-500">กำหนดอัตโนมัติ 1 ปีจากวันเริ่มสัญญา</span>
          </label>
          <label className="text-sm text-gray-700">เงินประกัน
            <input type="number" min="0" step="0.01" required value={form.deposit} onChange={(event) => setForm({ ...form, deposit: event.target.value })} className="mt-1 w-full rounded-lg border p-2.5" />
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">ยกเลิก</button>
          <button
            type="submit"
            disabled={saving || loadingTenants || loadingRooms || tenantTotal === 0 || roomTotal === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            <UserPlus size={16} /> {saving ? 'กำลังบันทึก...' : 'สร้างสัญญาและจัดสรรห้อง'}
          </button>
        </div>
      </form>
    </div>
  );
}
