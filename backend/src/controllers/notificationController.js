const db = require('../config/db');
const { createAndSendNotification } = require('../config/socket');

exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user?.user_id || req.user?.id;
    const role = req.user?.role;

    let whereClause = '';
    let params = [userId];

    if (role === 'admin') {
      whereClause = `WHERE (user_id = $1 OR target_role = 'admin' OR (user_id IS NULL AND target_role IS NULL))`;
    } else {
      whereClause = `WHERE (user_id = $1 OR (target_role = 'tenant' AND user_id IS NULL))`;
    }

    const notificationsQuery = `
      SELECT notification_id, user_id, target_role, title, message, type, link, is_read, created_at
      FROM t_notifications
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT 40
    `;

    const unreadCountQuery = `
      SELECT COUNT(*) AS unread_count
      FROM t_notifications
      ${whereClause} AND is_read = false
    `;

    const [notifResult, countResult] = await Promise.all([
      db.query(notificationsQuery, params),
      db.query(unreadCountQuery, params)
    ]);

    // ล้างประวัติแจ้งเตือนที่เก่าเกิน 30 วันทิ้งอัตโนมัติ
    db.query(`DELETE FROM t_notifications WHERE created_at < NOW() - INTERVAL '30 days'`)
      .catch((e) => console.warn('[AutoPrune] Error:', e.message));

    res.json({
      notifications: notifResult.rows,
      unread_count: Number(countResult.rows[0]?.unread_count || 0)
    });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: 'ไม่สามารถโหลดการแจ้งเตือนได้' });
  }
};

exports.markAsRead = async (req, res) => {
  const notifId = Number(req.params.id);
  if (!Number.isInteger(notifId) || notifId < 1) {
    return res.status(400).json({ error: 'รหัสแจ้งเตือนไม่ถูกต้อง' });
  }

  try {
    const userId = req.user?.user_id || req.user?.id;
    const role = req.user?.role;

    const query = `
      UPDATE t_notifications
      SET is_read = true
      WHERE notification_id = $1
        AND (user_id = $2 OR (target_role = $3 AND user_id IS NULL) OR target_role IS NULL)
      RETURNING *
    `;

    const result = await db.query(query, [notifId, userId, role]);
    if (!result.rows.length) {
      return res.status(404).json({ error: 'ไม่พบรายการแจ้งเตือน' });
    }

    res.json({ message: 'ทำเครื่องหมายว่าอ่านแล้ว', notification: result.rows[0] });
  } catch (err) {
    console.error('Error marking notification as read:', err);
    res.status(500).json({ error: 'ไม่สามารถอัปเดตสถานะการแจ้งเตือนได้' });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user?.user_id || req.user?.id;
    const role = req.user?.role;

    let whereClause = '';
    let params = [userId];

    if (role === 'admin') {
      whereClause = `WHERE is_read = false AND (user_id = $1 OR target_role = 'admin' OR (user_id IS NULL AND target_role IS NULL))`;
    } else {
      whereClause = `WHERE is_read = false AND (user_id = $1 OR (target_role = 'tenant' AND user_id IS NULL))`;
    }

    await db.query(`UPDATE t_notifications SET is_read = true ${whereClause}`, params);

    res.json({ message: 'ทำเครื่องหมายว่าอ่านทั้งหมดแล้ว' });
  } catch (err) {
    console.error('Error marking all notifications as read:', err);
    res.status(500).json({ error: 'ไม่สามารถอัปเดตสถานะการแจ้งเตือนได้' });
  }
};

// ยิงแจ้งเตือนทดสอบ (สำหรับทดสอบระบบ Socket.io และกระดิ่งแจ้งเตือน)
exports.sendTestNotification = async (req, res) => {
  try {
    const userId = req.user?.user_id || req.user?.id;
    const role = req.user?.role;
    const { title, message, type = 'info', target, link } = req.body || {};

    const notifTitle = title || 'ทดสอบการแจ้งเตือน Real-time';
    const notifMessage = message || `ระบบ WebSocket ทำงานได้อย่างสมบูรณ์! เวลา: ${new Date().toLocaleTimeString('th-TH')}`;
    const notifLink = link !== undefined ? link : (role === 'admin' ? '/bills' : '/tenant-services');

    let targetUserId = null;
    let targetRole = null;

    if (target === 'me') {
      targetUserId = userId;
    } else if (target === 'admins') {
      targetRole = 'admin';
    } else if (target === 'tenants') {
      targetRole = 'tenant';
    } else {
      targetRole = role; // ส่งหากลุ่มตัวเอง
    }

    const notification = await createAndSendNotification({
      userId: targetUserId,
      targetRole,
      title: notifTitle,
      message: notifMessage,
      type,
      link: notifLink
    });

    res.json({
      message: 'ส่งการแจ้งเตือนสำเร็จ',
      notification
    });
  } catch (err) {
    console.error('Error sending test notification:', err);
    res.status(500).json({ error: 'ไม่สามารถส่งการแจ้งเตือนได้' });
  }
};

// ล้างการแจ้งเตือน (ลบเฉพาะที่อ่านแล้ว หรือล้างทั้งหมด)
exports.clearNotifications = async (req, res) => {
  try {
    const userId = req.user?.user_id || req.user?.id;
    const role = req.user?.role;
    const { onlyRead = 'true' } = req.query;

    let whereClause = '';
    let params = [userId];

    const readCondition = onlyRead === 'false' ? '' : 'AND is_read = true';

    if (role === 'admin') {
      whereClause = `WHERE (user_id = $1 OR target_role = 'admin' OR (user_id IS NULL AND target_role IS NULL)) ${readCondition}`;
    } else {
      whereClause = `WHERE (user_id = $1 OR (target_role = 'tenant' AND user_id IS NULL)) ${readCondition}`;
    }

    await db.query(`DELETE FROM t_notifications ${whereClause}`, params);

    res.json({ message: 'ล้างการแจ้งเตือนเรียบร้อยแล้ว' });
  } catch (err) {
    console.error('Error clearing notifications:', err);
    res.status(500).json({ error: 'ไม่สามารถล้างการแจ้งเตือนได้' });
  }
};

