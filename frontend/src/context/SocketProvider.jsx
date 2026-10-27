import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import SocketContext from './socketContext';
import useToast from '../components/useToast';
import api from '../api/axios';

const getSocketUrl = () => {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  const hostname = window.location.hostname || 'localhost';
  return `http://${hostname}:5000`;
};

// เล่นเสียงแจ้งเตือนแบบ Web Audio API (นุ่มนวล สบายหู ไม่ต้องใช้ไฟล์ภายนอก)
function playNotificationSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // โน้ตสองจังหวะสั้นๆ Ding-Dong
    osc.frequency.setValueAtTime(784, ctx.currentTime); // G5
    osc.frequency.setValueAtTime(1046.5, ctx.currentTime + 0.12); // C6

    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    // ป้องกันกรณีเบราว์เซอร์บล็อก autoplay ก่อนผู้ใช้คลิกหน้าจอ
  }
}

export function SocketProvider({ children }) {
  const notify = useToast();
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const socketRef = useRef(null);

  // ดักจับการเปลี่ยนแปลง Token ทันทีเมื่อล็อกอินหรือล็อกเอาต์
  useEffect(() => {
    const syncToken = () => {
      const currentToken = localStorage.getItem('token');
      setToken((prev) => (prev !== currentToken ? currentToken : prev));
    };

    window.addEventListener('storage', syncToken);
    window.addEventListener('auth-changed', syncToken);

    // เช็กสถานะ token ทุก 1 วินาที เพื่อความมั่นใจว่าไม่หลุดจากการเปลี่ยน state
    const interval = setInterval(syncToken, 1000);

    return () => {
      window.removeEventListener('storage', syncToken);
      window.removeEventListener('auth-changed', syncToken);
      clearInterval(interval);
    };
  }, []);

  // โหลดรายการแจ้งเตือนล่าสุดจากฐานข้อมูล
  const fetchNotifications = useCallback(async () => {
    const currentToken = localStorage.getItem('token');
    if (!currentToken) return;

    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.notifications || []);
      setUnreadCount(Number(res.data.unread_count || 0));
    } catch (err) {
      console.warn('[Notifications] Unable to load notifications:', err.message);
    }
  }, []);

  // เชื่อมต่อ Socket.io
  useEffect(() => {
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    void Promise.resolve().then(fetchNotifications).catch(() => {});

    const socketUrl = getSocketUrl();
    const newSocket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('[Socket.io] Connected to server successfully. ID:', newSocket.id);
      setConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('[Socket.io] Disconnected from server:', reason);
      setConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.warn('[Socket.io] Connection error:', error.message);
      setConnected(false);
    });

    // ดักฟังการแจ้งเตือน Real-time ใหม่
    newSocket.on('new_notification', (data) => {
      console.log('[Socket.io] Received new_notification:', data);

      // 1. เพิ่มเข้าในรายการและอัปเดตตัวเลขแจ้งเตือน
      setNotifications((prev) => [data, ...prev.filter((n) => n.notification_id !== data.notification_id)]);
      setUnreadCount((prev) => prev + (data.is_read ? 0 : 1));

      // 2. ส่งเสียงเตือน
      playNotificationSound();

      // 3. แสดง Toast Alert บนหน้าจอ (พร้อมส่ง link เพื่อให้คลิกนำทางได้)
      const toastType = ['success', 'error', 'info'].includes(data.type) ? data.type : 'info';
      notify(`${data.title}: ${data.message}`, toastType, { link: data.link });

      // 4. กระจาย Custom Event ให้หน้าเพจที่เปิดอยู่ (เช่น บิล หรือ เคสแจ้งซ่อม) รีโหลดข้อมูลทันที
      window.dispatchEvent(new CustomEvent('dormitory-realtime-notification', { detail: data }));
    });

    return () => {
      newSocket.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
    };
  }, [token, fetchNotifications, notify]);

  // มาร์กรายการว่าอ่านแล้ว
  const markAsRead = useCallback(async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.notification_id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }, []);

  // มาร์กทั้งหมดว่าอ่านแล้ว
  const markAllAsRead = useCallback(async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  }, []);

  // ยิงแจ้งเตือนทดสอบ
  const sendTestNotification = useCallback(async (payload = {}) => {
    try {
      const res = await api.post('/notifications/test', payload);
      return res.data;
    } catch (err) {
      console.error('Failed to send test notification:', err);
      throw err;
    }
  }, []);

  // ล้างการแจ้งเตือน
  const clearNotifications = useCallback(async (onlyRead = true) => {
    try {
      await api.delete('/notifications/clear', { params: { onlyRead: String(onlyRead) } });
      if (onlyRead) {
        setNotifications((prev) => prev.filter((n) => !n.is_read));
      } else {
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Failed to clear notifications:', err);
    }
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket,
        connected,
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        clearNotifications,
        refreshNotifications: fetchNotifications,
        sendTestNotification
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}
