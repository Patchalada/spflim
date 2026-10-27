const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const db = require('./db');

let io = null;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => callback(null, true),
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Middleware ตรวจสอบ JWT Token ก่อนยอมรับการเชื่อมต่อ
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded; // { user_id, role, ... }
      next();
    } catch (err) {
      console.warn('[Socket Auth] Token verification failed:', err.message);
      next(new Error('Invalid or expired token'));
    }
  });

  // เมื่อ Client เชื่อมต่อสำเร็จ
  io.on('connection', async (socket) => {
    const rawUserId = socket.user?.user_id || socket.user?.id;
    const userId = rawUserId ? String(rawUserId) : null;
    const role = String(socket.user?.role || '').toLowerCase();

    // เข้าร่วมห้องตาม Role และ User ID ส่วนตัว
    if (role === 'admin') {
      await socket.join('admins');
    } else if (role === 'tenant') {
      await socket.join('tenants');
    }

    if (userId) {
      await socket.join(`user_${userId}`);
    }

    console.log(`[Socket.io] Connected: SocketID=${socket.id}, UserID=${userId}, Role=${role}`);

    // รองรับ client ทดสอบการเชื่อมต่อ (ping-pong)
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.io] Disconnected: SocketID=${socket.id}, UserID=${userId} (${reason})`);
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    console.warn('[Socket.io] getIO called before initSocket');
  }
  return io;
}

/**
 * บันทึกการแจ้งเตือนลง Database และส่ง Event ผ่าน Socket.io ทันที
 */
async function createAndSendNotification({ userId = null, targetRole = null, title, message, type = 'info', link = null }) {
  try {
    const result = await db.query(
      `INSERT INTO t_notifications (user_id, target_role, title, message, type, link)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, targetRole, title, message, type, link]
    );

    const notification = result.rows[0];

    if (io) {
      const targetUid = userId ? String(userId) : null;
      const normalizedRole = targetRole ? String(targetRole).toLowerCase() : null;

      if (targetUid) {
        // ส่งตรงไปยังห้องของผู้ใช้รายบุคคล
        io.to(`user_${targetUid}`).emit('new_notification', notification);
        console.log(`[Socket.io] Emitted notification to room: user_${targetUid}`);
      }

      if (normalizedRole === 'admin') {
        // ส่งไปยังห้องแอดมินทุกคน
        io.to('admins').emit('new_notification', notification);
        console.log('[Socket.io] Emitted notification to room: admins');
      } else if (normalizedRole === 'tenant') {
        // ส่งไปยังห้องผู้เช่าทุกคน
        io.to('tenants').emit('new_notification', notification);
        console.log('[Socket.io] Emitted notification to room: tenants');
      }

      if (!targetUid && !normalizedRole) {
        // Broadcast ทุกคน
        io.emit('new_notification', notification);
        console.log('[Socket.io] Broadcasted notification to all');
      }
    }

    return notification;
  } catch (err) {
    console.error('[Notification] Error creating/sending notification:', err);
    return null;
  }
}

module.exports = {
  initSocket,
  getIO,
  createAndSendNotification
};
