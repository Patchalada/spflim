import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Info, X, ChevronRight } from 'lucide-react';
import ToastContext from './toastContext';
import { resolveNotificationRoute, executeNotificationNavigation } from '../utils/notificationRouter';

const toastStyles = {
  success: {
    icon: CheckCircle2,
    className: 'toast-success',
    role: 'status'
  },
  error: {
    icon: AlertCircle,
    className: 'toast-error',
    role: 'alert'
  },
  info: {
    icon: Info,
    className: 'toast-info',
    role: 'status'
  }
};

export function ToastProvider({ children }) {
  const navigate = useNavigate();
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback((message, type = 'info', options = null) => {
    const id = nextId.current++;
    const link = typeof options === 'string' ? options : options?.link || null;
    const onClick = typeof options === 'function' ? options : options?.onClick || null;
    const toast = {
      id,
      message: String(message),
      type: toastStyles[type] ? type : 'info',
      link,
      onClick
    };
    setToasts((current) => [...current.slice(-3), toast]);
    timers.current.set(id, setTimeout(() => dismiss(id), 5500));
  }, [dismiss]);

  const handleToastClick = (toast) => {
    if (toast.onClick) {
      toast.onClick();
      dismiss(toast.id);
    } else {
      const role = localStorage.getItem('role') || 'admin';
      executeNotificationNavigation(navigate, toast, role, () => {
        dismiss(toast.id);
      });
    }
  };

  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    timers.current.clear();
  }, []);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-relevant="additions">
        {toasts.map((toast) => {
          const style = toastStyles[toast.type];
          const Icon = style.icon;
          const role = localStorage.getItem('role') || 'admin';
          const targetRoute = toast.link ? resolveNotificationRoute(toast, role) : (toast.onClick ? null : resolveNotificationRoute(toast, role));
          const isClickable = Boolean(toast.onClick || targetRoute);

          return (
            <div
              key={toast.id}
              onClick={(e) => {
                if (e.target.closest('.toast-close')) return;
                if (isClickable) handleToastClick(toast);
              }}
              className={`toast-card ${style.className} ${
                isClickable ? 'cursor-pointer hover:shadow-lg hover:border-teal-600/40 transition' : ''
              }`}
              role={style.role}
              title={isClickable ? 'คลิกเพื่อไปยังหน้านี้' : undefined}
            >
              <Icon className="toast-icon shrink-0" size={19} aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="toast-message">{toast.message}</p>
                {targetRoute && (
                  <span className="mt-1 flex items-center gap-0.5 text-[11px] font-semibold text-teal-700 underline">
                    ไปที่หน้านี้ <ChevronRight size={12} />
                  </span>
                )}
              </div>
              <button
                type="button"
                className="toast-close"
                onClick={() => dismiss(toast.id)}
                aria-label="ปิดการแจ้งเตือน"
              >
                <X size={17} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
