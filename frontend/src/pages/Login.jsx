import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, LogIn, Lock, User, UserPlus } from 'lucide-react';
import { useEffect } from 'react';
import dormitoryImage from '../assets/dormitory.svg';
import api from '../api/axios';
import AppInfo from '../components/AppInfo';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [dormitoryName, setDormitoryName] = useState('Residence Management');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/settings/public')
      .then((response) => setDormitoryName(response.data.dormitory_name))
      .catch((loadError) => console.error('Unable to load dormitory name:', loadError));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { username, password });
      
      // บันทึก Token และ Role
      localStorage.setItem('token', res.data.token);
      if (res.data.user?.role) {
        localStorage.setItem('role', res.data.user.role);
      }
      window.dispatchEvent(new Event('auth-changed'));

      // ตรวจสอบ Role เพื่อแยก Route นำทาง
      const userRole = res.data.user?.role;
      if (userRole === 'admin') {
        await navigate('/dashboard');
      } else if (userRole === 'tenant') {
        await navigate('/my-dashboard');
      } else {
        await navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen min-h-screen flex items-center justify-center p-4">
      <div className="auth-panel w-full max-w-md border border-white/60 p-8">
        {/* Header Section */}
        <div className="mb-8 flex min-h-24 items-end gap-3 text-left">
          <div className="inline-flex h-12 w-12 items-center justify-center border border-white/70 bg-white/75 backdrop-blur">
            <img src={dormitoryImage} alt="" className="h-10 w-10 object-cover" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-800">{dormitoryName}</p>
            <h2 className="text-2xl font-bold text-slate-800">เข้าสู่ระบบหอพัก</h2>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-rose-50 text-rose-600 p-3 rounded-lg text-sm mb-6 border border-rose-100 flex items-center gap-2">
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อผู้ใช้ (Username)</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="กรอกชื่อผู้ใช้"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800 outline-none transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่าน (Password)</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="กรอกรหัสผ่าน"
                className="w-full pl-10 pr-11 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800 outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-indigo-500/20 disabled:opacity-50"
          >
            <LogIn size={20} />
            <span>{loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}</span>
          </button>
        </form>

        {/* Divider & Register Section */}
        <div className="mt-6 pt-6 border-t border-gray-100 text-center">
          <p className="text-sm text-gray-500 mb-3">ยังไม่มีบัญชีผู้ใช้งาน?</p>
          <Link
            to="/register"
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 border border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-medium rounded-lg transition duration-150"
          >
            <UserPlus size={18} />
            <span>สมัครสมาชิกใหม่</span>
          </Link>
        </div>
        <AppInfo className="mt-5 text-center" />
      </div>
    </div>
  );
}