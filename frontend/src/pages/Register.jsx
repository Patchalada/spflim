import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, UserPlus, UploadCloud, FileCheck, Search } from 'lucide-react';
import dormitoryImage from '../assets/dormitory.svg';
import api from '../api/axios';
import useToast from '../components/useToast';
import AppInfo from '../components/AppInfo';
import Pagination from '../components/Pagination';

export default function Register() {
  const notify = useToast();
  const [form, setForm] = useState({
    username: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: '',
    room_id: '',
    kyc_document: '',
    profile_image: '',
    pdpa_consent: false
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [profileFileName, setProfileFileName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [dormitoryName, setDormitoryName] = useState('Residence Management');
  const [availableRooms, setAvailableRooms] = useState([]);
  const [roomFilters, setRoomFilters] = useState({ floors: [], room_types: [] });
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [roomSearch, setRoomSearch] = useState('');
  const [roomFloor, setRoomFloor] = useState('');
  const [roomType, setRoomType] = useState('');
  const [roomPage, setRoomPage] = useState(1);
  const [roomPageSize, setRoomPageSize] = useState(10);
  const [roomTotal, setRoomTotal] = useState(0);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/settings/public')
      .then((response) => setDormitoryName(response.data.dormitory_name))
      .catch((loadError) => console.error('Unable to load dormitory name:', loadError));
  }, [notify]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoadingRooms(true);
      try {
        const response = await api.get('/auth/available-rooms', {
          params: {
            page: roomPage,
            page_size: roomPageSize,
            search: roomSearch,
            floor: roomFloor,
            room_type: roomType
          }
        });
        if (cancelled) return;
        setAvailableRooms(response.data.items);
        setRoomTotal(response.data.pagination.total);
        setRoomFilters(response.data.filters);
      } catch (loadError) {
        if (!cancelled) {
          console.error('Unable to load available rooms:', loadError);
          notify(loadError.response?.data?.error || 'โหลดรายการห้องว่างไม่สำเร็จ', 'error');
        }
      } finally {
        if (!cancelled) setLoadingRooms(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [notify, roomFloor, roomPage, roomPageSize, roomSearch, roomType]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      notify('เลือกไฟล์ PDF, JPG, PNG หรือ WebP ขนาดไม่เกิน 10MB', 'error');
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onloadend = () => {
      setForm((prev) => ({ ...prev, kyc_document: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleProfileImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      notify('เลือกรูป JPG, PNG หรือ WebP ขนาดไม่เกิน 5MB', 'error');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({ ...prev, profile_image: reader.result }));
      setProfileFileName(file.name);
    };
    reader.onerror = () => notify('อ่านไฟล์รูปโปรไฟล์ไม่สำเร็จ', 'error');
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.room_id) {
      setError('กรุณาค้นหาและเลือกห้องพักที่ต้องการ');
      return;
    }
    if (!form.kyc_document) {
      setError('กรุณาแนบรูปภาพเอกสารยืนยันตัวตนหรือสัญญาเช่า');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/register', form);
      notify(res.data.message || 'ลงทะเบียนสำเร็จ', 'success');
      await navigate('/login');
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'ไม่สามารถลงทะเบียนได้');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen min-h-screen flex items-center justify-center p-4">
      <div className="auth-panel w-full max-w-md border border-white/60 p-8">
        <div className="mb-6 flex min-h-24 items-end gap-3 text-left">
          <div className="inline-flex h-12 w-12 items-center justify-center border border-white/70 bg-white/75 backdrop-blur">
            <img src={dormitoryImage} alt="" className="h-10 w-10 object-cover" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-800">{dormitoryName}</p>
            <h2 className="text-2xl font-bold text-gray-800">ลงทะเบียนเข้าใช้งาน</h2>
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 text-rose-600 p-3 rounded-lg text-sm mb-4 border border-rose-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">ชื่อจริง</label>
              <input
                type="text"
                required
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">นามสกุล</label>
              <input
                type="text"
                required
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">เบอร์โทรศัพท์</label>
            <input
              type="tel"
              required
              inputMode="numeric"
              pattern="[0-9]{10}"
              maxLength="10"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="กรอกเบอร์โทรศัพท์ 10 หลัก"
            />
          </div>

          <div className="space-y-3">
            <label htmlFor="registration-room" className="block text-xs font-medium text-gray-700 mb-1">กรุณาเลือกห้องพักที่ต้องการ(ตามที่แจ้งกับผู้ดูแลหอพัก)</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                id="registration-room"
                type="search"
                value={roomSearch}
                onChange={(event) => {
                  setRoomSearch(event.target.value);
                  setRoomPage(1);
                }}
                placeholder="ค้นหาด้วยเลขห้อง..."
                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                aria-label="กรองตามชั้น"
                value={roomFloor}
                onChange={(event) => {
                  setRoomFloor(event.target.value);
                  setRoomPage(1);
                }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">ทุกชั้น</option>
                {roomFilters.floors.map((floor) => <option key={floor} value={floor}>ชั้น {floor}</option>)}
              </select>
              <select
                aria-label="กรองตามประเภทห้อง"
                value={roomType}
                onChange={(event) => {
                  setRoomType(event.target.value);
                  setRoomPage(1);
                }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">ทุกประเภท</option>
                {roomFilters.room_types.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            {loadingRooms ? (
              <p className="py-5 text-center text-sm text-gray-500">กำลังค้นหาห้องว่าง...</p>
            ) : availableRooms.length > 0 ? (
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-gray-200 p-2">
                {availableRooms.map((room) => (
                  <button
                    key={room.room_id}
                    type="button"
                    onClick={() => {
                      setSelectedRoom(room);
                      setForm({ ...form, room_id: String(room.room_id) });
                    }}
                    aria-pressed={String(form.room_id) === String(room.room_id)}
                    className={`w-full rounded-lg border p-3 text-left text-sm transition ${
                      String(form.room_id) === String(room.room_id)
                        ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <span className="block font-semibold text-gray-800">ห้อง {room.room_number} · ชั้น {room.floor}</span>
                    <span className="mt-0.5 block text-xs text-gray-500">{room.room_type} · ฿{Number(room.base_price).toLocaleString()}/เดือน</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="py-5 text-center text-sm text-gray-500">
                {roomTotal === 0 ? 'ไม่พบห้องว่างที่ตรงกับเงื่อนไข' : 'ไม่มีห้องในหน้านี้'}
              </p>
            )}
            {selectedRoom && (
              <p className="text-xs font-semibold text-indigo-700">
                เลือกแล้ว: ห้อง {selectedRoom.room_number} · ชั้น {selectedRoom.floor}
              </p>
            )}
            <Pagination
              page={roomPage}
              pageSize={roomPageSize}
              total={roomTotal}
              onPageChange={setRoomPage}
              onPageSizeChange={(size) => { setRoomPageSize(size); setRoomPage(1); }}
            />
            <p className="text-xs text-gray-500">ห้องที่เลือกเป็นคำขอ รอแอดมินตรวจสอบ KYC และอนุมัติก่อนจัดสรรจริง</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">ชื่อผู้ใช้ (Username)</label>
            <input
              type="text"
              required
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">รหัสผ่าน (Password)</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          {/* อัปโหลดเอกสาร KYC */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">รูปโปรไฟล์ (ไม่บังคับ)</label>
            <label className="border-2 border-dashed border-gray-300 hover:border-indigo-500 rounded-lg p-3 flex flex-col items-center justify-center cursor-pointer bg-gray-50 transition">
              {profileFileName ? (
                <div className="flex items-center gap-2 text-indigo-600 text-xs font-medium">
                  <img src={form.profile_image} alt="ตัวอย่างรูปโปรไฟล์" className="h-10 w-10 rounded-full object-cover" />
                  <span><FileCheck size={16} className="inline" /> {profileFileName}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 text-gray-500 text-xs">
                  <UploadCloud size={20} className="text-gray-400" />
                  <span>เลือกรูป JPG, PNG หรือ WebP (ไม่เกิน 5MB)</span>
                </div>
              )}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleProfileImageChange} className="hidden" />
            </label>
          </div>

          {/* อัปโหลดเอกสาร KYC */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">แนบเอกสารยืนยันตัวตน / ใบสัญญา</label>
            <label className="border-2 border-dashed border-gray-300 hover:border-indigo-500 rounded-lg p-3 flex flex-col items-center justify-center cursor-pointer bg-gray-50 transition">
              {fileName ? (
                <div className="flex items-center gap-2 text-indigo-600 text-xs font-medium">
                  <FileCheck size={16} /> {fileName}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 text-gray-500 text-xs">
                  <UploadCloud size={20} className="text-gray-400" />
                  <span>คลิกเพื่อเลือกไฟล์รูปภาพหรือ PDF (ไม่เกิน 10MB)</span>
                </div>
              )}
              <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={handleFileChange} className="hidden" />
            </label>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            <p className="font-semibold">ประกาศความเป็นส่วนตัว (PDPA)</p>
            <p className="mt-1 leading-relaxed">
              ระบบเก็บชื่อ เบอร์โทร รูปโปรไฟล์ และเอกสารยืนยันตัวตน เพื่อสร้างบัญชี ตรวจสอบตัวตน
              และจัดการสัญญาเช่า บิล และการชำระเงิน จำกัดการเข้าถึงเฉพาะผู้มีหน้าที่ดูแล
              และเก็บข้อมูลเท่าที่จำเป็นตามระยะเวลาการให้บริการและข้อกำหนดทางกฎหมาย
              คุณสามารถขอเข้าถึง แก้ไข หรือลบข้อมูลได้โดยติดต่อผู้ดูแลหอพัก
            </p>
            <label className="mt-3 flex cursor-pointer items-start gap-2 font-medium">
              <input
                type="checkbox"
                required
                checked={form.pdpa_consent}
                onChange={(e) => setForm({ ...form, pdpa_consent: e.target.checked })}
                className="mt-0.5"
              />
              <span>ข้าพเจ้าอ่านและรับทราบประกาศความเป็นส่วนตัว และยินยอมให้ใช้ข้อมูลตามวัตถุประสงค์ข้างต้น</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || loadingRooms || roomTotal === 0 || !form.room_id}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition flex items-center justify-center gap-2 mt-2"
          >
            <UserPlus size={18} />
            <span>{loading ? 'กำลังส่งข้อมูล...' : 'ลงทะเบียนและส่งตรวจ KYC'}</span>
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-gray-500">
          มีบัญชีอยู่แล้ว? <Link to="/login" className="text-indigo-600 font-semibold hover:underline">เข้าสู่ระบบ</Link>
        </div>
        <AppInfo className="mt-4 text-center" />
      </div>
    </div>
  );
}