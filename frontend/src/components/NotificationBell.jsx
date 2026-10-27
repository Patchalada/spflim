import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Clock, Info, AlertTriangle, CheckCircle2, X, Trash2, ChevronRight } from 'lucide-react';
import useSocket from '../context/useSocket';
import { resolveNotificationRoute, executeNotificationNavigation } from '../utils/notificationRouter';

// แปลง timestamp เป็นข้อความเวลาที่เข้าใจง่าย
function formatTimeAgo(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return 'เมื่อสักครู่';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} ชั่วโมงที่แล้ว`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} วันที่แล้ว`;

  return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotifications, connected } = useSocket();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // ปิด Dropdown เมื่อคลิกนอกกล่อง
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleItemClick = (notif) => {
    if (!notif.is_read) {
      markAsRead(notif.notification_id);
    }
    const role = localStorage.getItem('role') || 'admin';
    executeNotificationNavigation(navigate, notif, role, () => {
      setIsOpen(false);
    });
  };

  const getIconForType = (type) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle size={17} className="text-amber-600" />;
      case 'success':
        return <CheckCircle2 size={17} className="text-emerald-600" />;
      case 'error':
        return <AlertTriangle size={17} className="text-rose-600" />;
      default:
        return <Info size={17} className="text-teal-600" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* ปุ่มกระดิ่งแจ้งเตือน */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-teal-800/15 bg-white/80 text-slate-700 shadow-sm transition hover:border-teal-700 hover:bg-white hover:text-teal-800 focus:outline-none"
        title="การแจ้งเตือน"
        aria-label="การแจ้งเตือน"
      >
        <Bell size={20} className={unreadCount > 0 ? 'text-teal-800' : 'text-slate-600'} />

        {/* จุดแสดงสถานะ Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white shadow-md">
            {unreadCount > 99 ? '99+' : unreadCount}
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60"></span>
          </span>
        )}
      </button>

      {/* เมนู Dropdown รายการแจ้งเตือน */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-slate-200 bg-white p-0 text-slate-800 shadow-2xl z-[99999] overflow-hidden ring-1 ring-black/5">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800">การแจ้งเตือน</span>
              {unreadCount > 0 ? (
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                  {unreadCount} ใหม่
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <span className={`inline-block h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                  {connected ? 'เชื่อมต่อแล้ว' : 'ออฟไลน์'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-teal-700 hover:bg-teal-50"
                  title="ทำเครื่องหมายว่าอ่านทั้งหมด"
                >
                  <CheckCheck size={14} /> อ่านทั้งหมด
                </button>
              )}
              {notifications.some((n) => n.is_read) && (
                <button
                  type="button"
                  onClick={() => clearNotifications(true)}
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                  title="ลบรายการที่อ่านแล้วออกจากกล่องแจ้งเตือน"
                >
                  <Trash2 size={13} /> ล้างที่อ่านแล้ว
                </button>
              )}
            </div>
          </div>

          {/* รายการแจ้งเตือน (Scrollable list) */}
          <div className="max-h-[380px] divide-y divide-slate-100 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Bell size={36} className="mx-auto mb-2 text-slate-300" strokeWidth={1.5} />
                <p className="text-sm font-medium">ไม่มีการแจ้งเตือน</p>
                <p className="text-xs text-slate-400">เมื่อมีเหตุการณ์ใหม่ ระบบจะแจ้งเตือนทันที</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const isUnread = !notif.is_read;
                const role = localStorage.getItem('role') || 'admin';
                const targetRoute = resolveNotificationRoute(notif, role);
                return (
                  <div
                    key={notif.notification_id}
                    onClick={() => handleItemClick(notif)}
                    className={`flex items-start gap-3 p-3.5 transition cursor-pointer ${
                      isUnread
                        ? 'bg-teal-50/40 hover:bg-teal-50/70'
                        : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0 rounded-lg p-1.5 bg-slate-100">
                      {getIconForType(notif.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm ${isUnread ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>
                          {notif.title}
                        </p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isUnread && (
                            <span className="h-2 w-2 rounded-full bg-teal-600" title="ยังไม่ได้อ่าน"></span>
                          )}
                          <ChevronRight size={14} className="text-slate-400 group-hover:text-teal-700 transition" />
                        </div>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {notif.message}
                      </p>
                      <div className="mt-1.5 flex items-center justify-between gap-1 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          {formatTimeAgo(notif.created_at)}
                        </span>
                        <span className="text-teal-700 font-medium hover:underline flex items-center gap-0.5">
                          แตะเพื่อเปิดหน้า <ChevronRight size={10} />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer ข้อมูลระบบทำความสะอาด */}
          {notifications.length > 0 && (
            <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-2 text-center text-[11px] text-slate-400">
              แสดงสูงสุด 40 รายการล่าสุด (ระบบลบประวัติเก่าเกิน 30 วันอัตโนมัติ)
            </div>
          )}
        </div>
      )}
    </div>
  );
}
