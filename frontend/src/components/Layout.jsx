import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import { LayoutDashboard, UsersRound, DoorOpen, ReceiptText, LogOut, House, BadgeCheck, SlidersHorizontal, ChartNoAxesCombined, UserRound, Camera, Wrench, Menu, X, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import api from '../api/axios';
import useToast from './useToast';
import AppInfo from './AppInfo';
import NotificationBell from './NotificationBell';

export default function Layout() {
  const navigate = useNavigate();
  const notify = useToast();
  const role = localStorage.getItem('role');
  const [profile, setProfile] = useState(null);
  const [dormitoryName, setDormitoryName] = useState('ระบบจัดการหอพัก');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar_open');
      if (saved !== null) return saved === 'true';
      return window.innerWidth >= 768;
    }
    return true;
  });

  const toggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar_open', String(next));
      return next;
    });
  };

  const dragStartX = useRef(null);
  const isDragging = useRef(false);

  // รองรับการลากด้วยเมาส์ (Desktop)
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    dragStartX.current = e.clientX;
    isDragging.current = false;

    const onMouseMove = (moveEvent) => {
      const diffX = moveEvent.clientX - dragStartX.current;
      if (Math.abs(diffX) > 6) {
        isDragging.current = true;
      }
    };

    const onMouseUp = (upEvent) => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      if (isDragging.current && dragStartX.current !== null) {
        const diffX = upEvent.clientX - dragStartX.current;
        if (sidebarOpen && diffX < -25) {
          setSidebarOpen(false);
          localStorage.setItem('sidebar_open', 'false');
        } else if (!sidebarOpen && diffX > 25) {
          setSidebarOpen(true);
          localStorage.setItem('sidebar_open', 'true');
        }
      }
      setTimeout(() => {
        isDragging.current = false;
        dragStartX.current = null;
      }, 50);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // รองรับการลากด้วยการสัมผัส (Mobile / Tablet Touch)
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    if (!touch) return;
    dragStartX.current = touch.clientX;
    isDragging.current = false;

    const onTouchMove = (moveEvent) => {
      const currentTouch = moveEvent.touches[0];
      if (!currentTouch) return;
      const diffX = currentTouch.clientX - dragStartX.current;
      if (Math.abs(diffX) > 6) {
        isDragging.current = true;
      }
    };

    const onTouchEnd = (endEvent) => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);

      if (isDragging.current && dragStartX.current !== null) {
        const changedTouch = endEvent.changedTouches[0];
        if (changedTouch) {
          const diffX = changedTouch.clientX - dragStartX.current;
          if (sidebarOpen && diffX < -25) {
            setSidebarOpen(false);
            localStorage.setItem('sidebar_open', 'false');
          } else if (!sidebarOpen && diffX > 25) {
            setSidebarOpen(true);
            localStorage.setItem('sidebar_open', 'true');
          }
        }
      }
      setTimeout(() => {
        isDragging.current = false;
        dragStartX.current = null;
      }, 50);
    };

    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
  };

  const handleHandleClick = () => {
    if (!isDragging.current) {
      toggleSidebar();
    }
  };

  useEffect(() => {
    let mounted = true;
    api.get('/auth/me')
      .then((response) => {
        if (mounted) setProfile(response.data);
      })
      .catch((error) => {
        console.error('Unable to load current user profile:', error);
      });
    api.get('/settings/public')
      .then((response) => {
        if (mounted) setDormitoryName(response.data.dormitory_name || 'ระบบจัดการหอพัก');
      })
      .catch((error) => {
        console.error('Unable to load dormitory name:', error);
      });
    const handleDormitorySettingsUpdate = (event) => {
      setDormitoryName(event.detail || 'ระบบจัดการหอพัก');
    };
    window.addEventListener('dormitory-settings-updated', handleDormitorySettingsUpdate);
    return () => {
      mounted = false;
      window.removeEventListener('dormitory-settings-updated', handleDormitorySettingsUpdate);
    };
  }, []);

  const handleProfilePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      notify('เลือกรูป JPG, PNG หรือ WebP ขนาดไม่เกิน 5MB', 'error');
      return;
    }

    setUploadingPhoto(true);
    try {
      const profileImage = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('อ่านไฟล์รูปไม่สำเร็จ'));
        reader.readAsDataURL(file);
      });
      const response = await api.put('/auth/profile-image', { profile_image: profileImage });
      setProfile((current) => ({ ...current, profile_image: response.data.profile_image }));
      notify('เปลี่ยนรูปโปรไฟล์สำเร็จ', 'success');
    } catch (error) {
      notify(error.response?.data?.error || error.message || 'เปลี่ยนรูปโปรไฟล์ไม่สำเร็จ', 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    window.dispatchEvent(new Event('auth-changed'));
    void navigate('/login');
  };

  // เมนูของ Admin
  const adminMenuItems = [
    { name: 'แดชบอร์ด', icon: LayoutDashboard, path: '/dashboard' },
    { name: 'ตรวจสอบเอกสาร', icon: BadgeCheck, path: '/kyc-approval' },
    { name: 'จัดการห้องพัก', icon: DoorOpen, path: '/rooms' },
    { name: 'จัดการผู้เช่า', icon: UsersRound, path: '/tenants' },
    { name: 'บิลและการชำระเงิน', icon: ReceiptText, path: '/bills' },
    { name: 'ตั้งค่าอัตราและห้อง', icon: SlidersHorizontal, path: '/settings' },
    { name: 'รายงานและการเงิน', icon: ChartNoAxesCombined, path: '/reports' },
    { name: 'ต่อสัญญา / เคสแจ้งปัญหา', icon: Wrench, path: '/tenant-services' },
  ];

  // เมนูของ ผู้เช่า (Tenant)
  const tenantMenuItems = [
    { name: 'ข้อมูลห้องพักและบิล', icon: House, path: '/my-dashboard' },
    { name: 'สัญญาเช่าห้องพัก', icon: FileText, path: '/my-contract' },
    { name: 'ต่อสัญญา / แจ้งปัญหา', icon: Wrench, path: '/tenant-services' },
  ];

  // เลือกใช้เมนูกลุ่มตาม Role
  const menuItems = role === 'admin' ? adminMenuItems : tenantMenuItems;

  return (
    <div className="relative flex h-screen h-dvh min-h-0 bg-transparent text-slate-800">
      {/* Sidebar Navigation (เปิด/ปิด ได้) */}
      <aside
        className={`hidden md:flex fixed inset-y-0 left-0 z-50 flex-col justify-between text-white transition-all duration-300 ease-in-out md:static md:z-auto ${
          sidebarOpen
            ? 'w-64 translate-x-0 opacity-100'
            : '-translate-x-full md:translate-x-0 md:w-0 md:min-w-0 md:!border-r-0 md:opacity-0 md:pointer-events-none md:overflow-hidden'
        }`}
      >
        <div className="w-64 flex flex-col justify-between h-full shrink-0">
          <div>
            <div className="brand-panel flex items-center justify-between border-b border-white/20 p-6">
              <div className="flex items-center gap-3 min-w-0">
                <label className="profile-photo-picker shrink-0" title="เปลี่ยนรูปโปรไฟล์">
                  {profile?.profile_image ? (
                    <img src={profile.profile_image} alt="รูปโปรไฟล์" className="brand-image profile-avatar" />
                  ) : (
                    <span className="brand-image profile-avatar profile-avatar-placeholder">
                      <UserRound size={24} />
                    </span>
                  )}
                  <span className="profile-photo-camera"><Camera size={12} /></span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleProfilePhotoChange}
                    disabled={uploadingPhoto}
                    className="sr-only"
                    aria-label="เปลี่ยนรูปโปรไฟล์"
                  />
                </label>
                <div className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-teal-100">Residence</span>
                  <span className="block max-w-36 truncate font-semibold tracking-wide text-white" title={dormitoryName}>{dormitoryName}</span>
                  {profile && <span className="block truncate text-xs text-slate-500">{profile.first_name} {profile.last_name}</span>}
                </div>
              </div>

              {/* ปุ่มปิด Sidebar สำหรับจอมือถือ */}
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="md:hidden shrink-0 rounded p-1.5 text-slate-500 hover:bg-slate-200/50 hover:text-slate-800 cursor-pointer"
                aria-label="ปิดเมนู"
              >
                <X size={18} />
              </button>
            </div>

            <nav className="space-y-1 p-3">
              {menuItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/dashboard'}
                  onClick={() => {
                    if (typeof window !== 'undefined' && window.innerWidth < 768) {
                      setSidebarOpen(false);
                    }
                  }}
                  className="flex items-center gap-3 px-3 py-3 text-sm"
                >
                  <item.icon size={19} strokeWidth={1.8} />
                  <span>{item.name}</span>
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="border-t border-white/20 p-4">
            <AppInfo className="mb-2 px-3" />
            <button
              onClick={handleLogout}
              className="flex w-full cursor-pointer items-center gap-3 px-3 py-3 text-sm text-rose-200 transition hover:bg-rose-400/15 hover:text-white"
            >
              <LogOut size={19} strokeWidth={1.8} />
              <span>ออกจากระบบ</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ตัวลาก/ปุ่มเปิดปิดขอบแนบบาร์ (Drag & Click Grip Handle on Sidebar Edge) */}
      <div
        className={`hidden md:block fixed md:absolute top-1/2 -translate-y-1/2 z-40 transition-all duration-300 ease-in-out ${
          sidebarOpen ? 'left-64 -ml-2' : 'left-0'
        }`}
      >
        <button
          type="button"
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onClick={handleHandleClick}
          className="group flex flex-col items-center justify-center h-10 w-3.5 rounded-r-md border border-slate-300/80 bg-white/95 text-slate-400 shadow-sm backdrop-blur-xs transition hover:w-4.5 hover:border-teal-600 hover:bg-white hover:text-teal-700 hover:shadow-md focus:outline-none cursor-ew-resize select-none"
          title={sidebarOpen ? 'คลิกหรือลากไปทางซ้ายเพื่อปิดแถบเมนู' : 'คลิกหรือลากไปทางขวาเพื่อเปิดแถบเมนู'}
          aria-label={sidebarOpen ? 'ปิดแถบเมนู' : 'เปิดแถบเมนู'}
        >
          {/* ขีดๆ เล็กๆ (Grip indicator lines) พร้อมลูกศรบอกทิศทาง */}
          <div className="flex flex-col items-center justify-center gap-0.5">
            {sidebarOpen ? (
              <ChevronLeft size={9} className="text-slate-400 group-hover:text-teal-600 transition" />
            ) : (
              <ChevronRight size={9} className="text-slate-400 group-hover:text-teal-600 transition" />
            )}
            <span className="h-1.5 w-0.5 rounded-full bg-slate-300 group-hover:bg-teal-600 transition"></span>
            <span className="h-1.5 w-0.5 rounded-full bg-slate-400 group-hover:bg-teal-600 transition"></span>
            <span className="h-1.5 w-0.5 rounded-full bg-slate-300 group-hover:bg-teal-600 transition"></span>
          </div>
        </button>
      </div>

      {/* Main Content Area with Top Navbar */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="relative z-30 h-16 shrink-0 px-4 sm:px-6 flex items-center justify-between border-b border-teal-900/10 bg-white/80 backdrop-blur-md shadow-xs">
          <div className="flex items-center gap-3">
            {/* ปุ่มเปิด/ปิด Sidebar (แนบบาร์) */}
            <button
              type="button"
              onClick={toggleSidebar}
              className="hidden h-10 w-10 items-center justify-center rounded-lg border border-teal-800/15 bg-white/90 text-slate-700 shadow-xs transition hover:border-teal-700 hover:bg-white hover:text-teal-800 focus:outline-none md:flex cursor-pointer"
              title={sidebarOpen ? 'ปิดแถบเมนู (Sidebar)' : 'เปิดแถบเมนู (Sidebar)'}
              aria-label={sidebarOpen ? 'ปิดแถบเมนู (Sidebar)' : 'เปิดแถบเมนู (Sidebar)'}
            >
              <Menu size={20} />
            </button>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-100">
                {role === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้เช่า'}
              </span>
              <span className="text-slate-300">/</span>
              <span className="text-sm font-semibold text-slate-800 truncate max-w-[170px] sm:max-w-xs" title={dormitoryName}>
                {dormitoryName}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell />
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-3 pb-24 sm:p-6 md:p-8 md:pb-8">
          <Outlet />
        </main>
      </div>
      <nav
        aria-label="เมนูหลัก"
        style={{ gridTemplateColumns: `repeat(${menuItems.length + 1}, minmax(0, 1fr))` }}
        className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 grid border-t border-teal-900/10 bg-white/95 px-1 pt-1 shadow-[0_-4px_16px_rgba(15,53,57,0.10)] backdrop-blur-md md:hidden"
      >
        {menuItems.map((item) => {
          const mobileLabels = {
            '/dashboard': 'หน้าแรก',
            '/kyc-approval': 'KYC',
            '/rooms': 'ห้อง',
            '/tenants': 'ผู้เช่า',
            '/bills': 'บิล',
            '/settings': 'ตั้งค่า',
            '/reports': 'รายงาน',
            '/tenant-services': 'บริการ',
            '/my-dashboard': 'หน้าหลัก',
            '/my-contract': 'สัญญา'
          };
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/dashboard'}
              aria-label={item.name}
              title={item.name}
              className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-md px-0.5 py-1.5 text-center text-[9px] font-medium leading-tight text-slate-500 transition-colors"
            >
              <item.icon size={19} strokeWidth={1.8} />
              <span className="max-w-full truncate">{mobileLabels[item.path] || item.name}</span>
            </NavLink>
          );
        })}
        <button
          type="button"
          onClick={handleLogout}
          aria-label="ออกจากระบบ"
          className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-md px-0.5 py-1.5 text-[9px] font-medium leading-tight text-rose-600"
        >
          <LogOut size={19} strokeWidth={1.8} />
          <span>ออก</span>
        </button>
      </nav>
    </div>
  );
}