import { useCallback, useState, useEffect } from 'react';
import { Plus, Home, X, Trash2, Eye, User, Phone, Calendar, ShieldCheck, Search, Edit2, UserPlus, ReceiptText } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import useToast from '../components/useToast';
import Pagination from '../components/Pagination';
import ContractAssignmentModal from '../components/ContractAssignmentModal';

export default function Rooms() {
  const notify = useToast();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null); // เก็บห้องที่เลือกดูรายละเอียด
  const [assignmentRoom, setAssignmentRoom] = useState(null);
  const [editingRoom, setEditingRoom] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalRooms, setTotalRooms] = useState(0);
  const [form, setForm] = useState({ room_number: '', floor: 1, room_type: '', status: 'vacant' });

  const fetchRoomTypes = useCallback(async () => {
    try {
      const settingsRes = await api.get('/settings');
      setRoomTypes(settingsRes.data.room_types);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchRooms = useCallback(async () => {
    try {
      const roomsRes = await api.get('/rooms', { params: { page, page_size: pageSize, search, status: statusFilter } });
      setRooms(roomsRes.data.items);
      setTotalRooms(roomsRes.data.pagination.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, statusFilter]);

  useEffect(() => {
    void Promise.resolve().then(fetchRooms).catch(() => {});
  }, [fetchRooms]);

  useEffect(() => {
    void Promise.resolve().then(fetchRoomTypes).catch(() => {});
  }, [fetchRoomTypes]);

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        room_number: form.room_number,
        floor: Number(form.floor),
        room_type: form.room_type,
        status: form.status
      };
      if (editingRoom) {
        await api.put(`/rooms/${editingRoom.room_id}`, payload);
      } else {
        await api.post('/rooms', payload);
      }
      setShowModal(false);
      setEditingRoom(null);
      setForm({ room_number: '', floor: 1, room_type: '', status: 'vacant' });
      await fetchRooms();
    } catch (err) {
      notify(err.response?.data?.error || 'ไม่สามารถเพิ่มห้องพักได้', 'error');
    }
  };

  const handleEditRoom = (room) => {
    setEditingRoom(room);
    setForm({
      room_number: room.room_number,
      floor: room.floor,
      room_type: room.room_type,
      status: room.status
    });
    setShowModal(true);
  };

  const handleDeleteRoom = async (id) => {
    if (!confirm('ยืนยันลบห้องพักนี้?')) return;
    try {
      await api.delete(`/rooms/${id}`);
      await fetchRooms();
    } catch (err) {
      notify(err.response?.data?.error || 'ไม่สามารถลบห้องพักได้', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">จัดการห้องพัก</h1>
          <p className="text-sm text-gray-500">ตรวจสอบสถานะห้อง และรายละเอียดผู้เช่า</p>
        </div>
        <button 
          onClick={() => setShowModal(true)} 
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition cursor-pointer shadow-sm font-medium"
        >
          <Plus size={18} /> เพิ่มห้องพัก
        </button>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
        <div className="relative max-w-sm">
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="ค้นหาห้อง เลขที่ ชั้น ประเภท หรือผู้เช่า"
            className="w-full border p-2.5 pl-9 rounded-lg text-sm"
          />
        </div>
        <label className="block max-w-xs text-xs font-medium text-gray-600">
          สถานะห้อง
          <select
            value={statusFilter}
            onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}
            className="mt-1 w-full rounded-lg border bg-white p-2.5 text-sm text-gray-800"
          >
            <option value="">ทุกสถานะ</option>
            <option value="vacant">ว่าง</option>
            <option value="occupied">มีผู้เช่า</option>
            <option value="maintenance">ปิดปรับปรุง</option>
          </select>
        </label>
        {loading ? (
          <p className="text-center py-4 text-gray-500">กำลังโหลดข้อมูล...</p>
        ) : (
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-700 uppercase border-b">
              <tr>
                <th className="p-3">เลขห้อง</th>
                <th className="p-3">ชั้น</th>
                <th className="p-3">ประเภท</th>
                <th className="p-3">ราคา/เดือน</th>
                <th className="p-3">สถานะ</th>
                <th className="p-3">ผู้เช่าปัจจุบัน</th>
                <th className="p-3 text-left">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.room_id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-semibold text-gray-800 flex items-center gap-2">
                    <Home size={16} className="text-indigo-500" /> ห้อง {room.room_number}
                  </td>
                  <td className="p-3">ชั้น {room.floor}</td>
                  <td className="p-3">{room.room_type}</td>
                  <td className="p-3">฿{Number(room.base_price).toLocaleString()}</td>
                  <td className="p-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      room.status === 'vacant' ? 'bg-emerald-100 text-emerald-700' : room.status === 'maintenance' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {room.status === 'vacant' ? 'ว่าง' : room.status === 'maintenance' ? 'ปิดปรับปรุง' : 'มีผู้เช่า'}
                    </span>
                  </td>
                  <td className="p-3">
                    {room.first_name ? (
                      <span className="font-medium text-gray-800">{room.first_name} {room.last_name}</span>
                    ) : (
                      <span className="text-gray-400 text-xs">- ไม่มีผู้เช่า -</span>
                    )}
                  </td>
                  <td className="p-3 text-left">
                    <div className="flex items-center justify-start gap-2">
                      <button 
                        onClick={() => setSelectedRoom(room)} 
                        className="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-md transition"
                        title="ดูรายละเอียดห้อง"
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        onClick={() => handleEditRoom(room)}
                        className="text-amber-600 hover:bg-amber-50 p-1.5 rounded-md transition"
                        title="แก้ไขข้อมูลห้อง"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDeleteRoom(room.room_id)} 
                        className="text-red-500 hover:bg-red-50 p-1.5 rounded-md transition"
                        title="ลบห้องพัก"
                      >
                        <Trash2 size={18} />
                      </button>
                      {room.status === 'vacant' && (
                        <button
                          type="button"
                          onClick={() => setAssignmentRoom(room)}
                          className="rounded-md p-1.5 text-teal-700 transition hover:bg-teal-50"
                          title="เลือกผู้เช่าและจัดสรรห้องนี้"
                          aria-label={`จัดสรรห้อง ${room.room_number}`}
                        >
                          <UserPlus size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={totalRooms}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          />
        )}
      </div>

      {/* Modal เพิ่มหรือแก้ไขห้องพัก */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-lg text-gray-800">{editingRoom ? 'แก้ไขข้อมูลห้อง' : 'เพิ่มห้องพักใหม่'}</h3>
              <button onClick={() => { setShowModal(false); setEditingRoom(null); }} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">เลขห้อง</label>
                <input type="text" required value={form.room_number} onChange={(e) => setForm({...form, room_number: e.target.value})} className="w-full border p-2 rounded-lg" placeholder="101" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">ชั้น</label>
                <input type="number" min="1" required value={form.floor} onChange={(e) => setForm({...form, floor: e.target.value})} className="w-full border p-2 rounded-lg" placeholder="1" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">ประเภทห้อง</label>
                <select
                  required
                  value={form.room_type}
                  onChange={(e) => setForm({ ...form, room_type: e.target.value })}
                  className="w-full border p-2 rounded-lg"
                >
                  <option value="">-- เลือกประเภทห้อง --</option>
                  {roomTypes.map((type) => (
                    <option key={type.type_id} value={type.room_type}>
                      {type.room_type} - ฿{Number(type.base_price).toLocaleString()}/เดือน
                    </option>
                  ))}
                </select>
              </div>
              {roomTypes.length === 0 ? (
                <p className="text-sm text-amber-700">
                  ต้องตั้งค่าประเภทห้องก่อน{' '}
                  <Link to="/settings" className="underline font-medium" onClick={() => setShowModal(false)}>
                    ไปหน้าตั้งค่า
                  </Link>
                </p>
              ) : (
                <p className="text-sm text-gray-500">
                  ค่าเช่าเริ่มต้น: ฿{Number(roomTypes.find((type) => type.room_type === form.room_type)?.base_price || 0).toLocaleString()} / เดือน
                </p>
              )}
              {editingRoom && (
                <div>
                  <label className="block text-sm font-medium mb-1">สถานะห้อง</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full border p-2 rounded-lg">
                    <option value="vacant">ว่าง</option>
                    <option value="occupied">มีผู้เช่า</option>
                    <option value="maintenance">ปิดปรับปรุง</option>
                  </select>
                </div>
              )}
              <button type="submit" disabled={roomTypes.length === 0} className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50">บันทึก</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal ดูรายละเอียดห้องและผู้เช่า */}
      {selectedRoom && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-3">
              <div className="flex items-center gap-2">
                <Home className="text-indigo-600" size={22} />
                <h3 className="font-bold text-lg text-gray-800">รายละเอียดห้อง {selectedRoom.room_number}</h3>
              </div>
              <button onClick={() => setSelectedRoom(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {/* ข้อมูลห้องพัก */}
            <div className="bg-slate-50 p-4 rounded-xl space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">ชั้น:</span>
                <span className="font-medium text-gray-800">ชั้น {selectedRoom.floor}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">ประเภทห้อง:</span>
                <span className="font-medium text-gray-800">{selectedRoom.room_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">ราคาค่าเช่า:</span>
                <span className="font-semibold text-indigo-600">฿{Number(selectedRoom.base_price).toLocaleString()} / เดือน</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">สถานะห้อง:</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                selectedRoom.status === 'vacant' ? 'bg-emerald-100 text-emerald-700' : selectedRoom.status === 'maintenance' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                }`}>
                {selectedRoom.status === 'vacant' ? 'ห้องว่าง' : selectedRoom.status === 'maintenance' ? 'ปิดปรับปรุง' : 'มีผู้เช่าพักอาศัย'}
                </span>
              </div>
            </div>

            {/* ข้อมูลผู้เช่าและสัญญา (ถ้ามี) */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">ข้อมูลผู้เช่าและสัญญา</h4>
              {selectedRoom.first_name ? (
                <div className="border border-gray-100 rounded-xl p-4 space-y-2.5 text-sm">
                  <div className="flex items-center gap-2 text-gray-800">
                    <User size={16} className="text-gray-400" />
                    <span className="font-medium">{selectedRoom.first_name} {selectedRoom.last_name}</span>
                    <span className="text-xs text-gray-400">({selectedRoom.username})</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone size={16} className="text-gray-400" />
                    <span>{selectedRoom.phone || 'ไม่มีเบอร์โทร'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <ShieldCheck size={16} className="text-gray-400" />
                    <span>เงินประกัน: ฿{Number(selectedRoom.deposit || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 text-xs">
                    <Calendar size={16} className="text-gray-400" />
                    <span>สัญญา: {new Date(selectedRoom.start_date).toLocaleDateString('th-TH')} ถึง {new Date(selectedRoom.end_date).toLocaleDateString('th-TH')}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 border border-dashed rounded-xl text-gray-400 text-sm">
                  ห้องนี้ยังว่างอยู่ ยังไม่มีสัญญาเช่า
                </div>
              )}

            </div>

            <div className="flex gap-2">
              {selectedRoom.contract_id && (
                <button
                  type="button"
                  onClick={() => navigate(`/bills?contract_id=${selectedRoom.contract_id}`)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-teal-700 py-2 text-sm font-semibold text-white hover:bg-teal-800"
                >
                  <ReceiptText size={16} /> ออกบิลห้องนี้
                </button>
              )}
              <button
                onClick={() => setSelectedRoom(null)}
                className="flex-1 rounded-lg bg-gray-100 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {assignmentRoom && (
        <ContractAssignmentModal
          initialRoom={assignmentRoom}
          onClose={() => setAssignmentRoom(null)}
          onAssigned={fetchRooms}
        />
      )}
    </div>
  );
}