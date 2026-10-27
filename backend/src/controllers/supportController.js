const db = require('../config/db');
const { parsePagination, respondWithPagination } = require('../utils/pagination');
const { createAndSendNotification } = require('../config/socket');

const ticketStatuses = ['open', 'in_progress', 'resolved', 'closed'];
const ticketPriorities = ['low', 'normal', 'high', 'urgent'];

exports.getMyTickets = async (req, res) => {
  try {
    const userId = req.user?.user_id || req.user?.id;
    const result = await db.query(
      `SELECT t.ticket_id, t.contract_id, t.category, t.subject, t.description, t.priority,
              t.status, t.admin_response, t.created_at, t.updated_at, t.closed_at, r.room_number
       FROM t_maintenance_tickets t
       LEFT JOIN m_contracts c ON c.contract_id = t.contract_id
       LEFT JOIN m_rooms r ON r.room_id = c.room_id
       WHERE t.tenant_id = $1::bigint
       ORDER BY t.created_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tenant support tickets:', error);
    res.status(500).json({ error: 'ไม่สามารถโหลดรายการแจ้งปัญหาได้' });
  }
};

exports.createTicket = async (req, res) => {
  const { category, subject, description, priority = 'normal' } = req.body || {};
  if (
    typeof category !== 'string' || !category.trim() || category.length > 80 ||
    typeof subject !== 'string' || !subject.trim() || subject.length > 160 ||
    typeof description !== 'string' || !description.trim() || description.length > 5000 ||
    !ticketPriorities.includes(priority)
  ) {
    return res.status(400).json({ error: 'กรุณากรอกหัวข้อ ประเภท และรายละเอียดปัญหาให้ถูกต้อง' });
  }

  try {
    const userId = req.user?.user_id || req.user?.id;
    const result = await db.query(
      `INSERT INTO t_maintenance_tickets (tenant_id, contract_id, category, subject, description, priority)
       VALUES (
         $1::bigint,
         (SELECT contract_id FROM m_contracts WHERE tenant_id = $1::bigint AND status = 'active' ORDER BY contract_id DESC LIMIT 1),
         $2, $3, $4, $5
       )
       RETURNING ticket_id, category, subject, description, priority, status, created_at`,
      [userId, category.trim(), subject.trim(), description.trim(), priority]
    );

    // ดึงเลขห้องพักของผู้เช่าเพื่อแจ้งเตือนแอดมิน
    db.query(
      `SELECT r.room_number FROM m_contracts c
       JOIN m_rooms r ON r.room_id = c.room_id
       WHERE c.tenant_id = $1::bigint AND c.status = 'active'
       LIMIT 1`,
      [userId]
    ).then((roomRes) => {
      const roomNumber = roomRes.rows[0]?.room_number || '';
      return createAndSendNotification({
        targetRole: 'admin',
        title: 'มีคำร้องแจ้งซ่อมใหม่',
        message: `${roomNumber ? `ห้อง ${roomNumber}: ` : ''}${subject.trim()}`,
        type: 'warning',
        link: '/tenant-services'
      });
    }).catch((err) => console.error('[Socket] Failed to notify admins about new ticket:', err));

    res.status(201).json({ message: 'เปิดเคสแจ้งปัญหาแล้ว', ticket: result.rows[0] });
  } catch (error) {
    console.error('Error creating maintenance ticket:', error);
    res.status(500).json({ error: 'ไม่สามารถเปิดเคสแจ้งปัญหาได้' });
  }
};

exports.closeMyTicket = async (req, res) => {
  const ticketId = Number(req.params.id);
  if (!Number.isInteger(ticketId) || ticketId < 1) {
    return res.status(400).json({ error: 'หมายเลขเคสไม่ถูกต้อง' });
  }
  try {
    const userId = req.user?.user_id || req.user?.id;
    const result = await db.query(
      `UPDATE t_maintenance_tickets
       SET status = 'closed', closed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE ticket_id = $1 AND tenant_id = $2::bigint AND status IN ('open', 'resolved')
       RETURNING ticket_id, status, closed_at`,
      [ticketId, userId]
    );
    if (!result.rows.length) return res.status(409).json({ error: 'ปิดเคสนี้ไม่ได้ อาจไม่มีสิทธิ์หรือเคสกำลังดำเนินการอยู่' });
    res.json({ message: 'ปิดเคสเรียบร้อยแล้ว', ticket: result.rows[0] });
  } catch (error) {
    console.error('Error closing tenant support ticket:', error);
    res.status(500).json({ error: 'ไม่สามารถปิดเคสได้' });
  }
};

exports.getTickets = async (req, res) => {
  try {
    const pagination = parsePagination(req.query);
    const status = ticketStatuses.includes(req.query.status) ? req.query.status : '';
    const where = `WHERE ($1 = '' OR t.status = $1)`;
    const result = await db.query(
      `SELECT t.ticket_id, t.tenant_id, t.contract_id, t.category, t.subject, t.description,
              t.priority, t.status, t.admin_response, t.created_at, t.updated_at, t.closed_at,
              u.first_name, u.last_name, u.phone, r.room_number
       FROM t_maintenance_tickets t
       JOIN m_users u ON u.user_id = t.tenant_id
       LEFT JOIN m_contracts c ON c.contract_id = t.contract_id
       LEFT JOIN m_rooms r ON r.room_id = c.room_id
       ${where}
       ORDER BY CASE t.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'resolved' THEN 2 ELSE 3 END,
                CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
                t.created_at DESC
       ${pagination ? 'LIMIT $2 OFFSET $3' : ''}`,
      pagination ? [status, pagination.pageSize, pagination.offset] : [status]
    );
    if (!pagination) return res.json(result.rows);
    const count = await db.query(
      `SELECT COUNT(*) AS total FROM t_maintenance_tickets t ${where}`,
      [status]
    );
    respondWithPagination(req, res, result.rows, count.rows[0].total, pagination);
  } catch (error) {
    console.error('Error fetching support tickets for admin:', error);
    res.status(500).json({ error: 'ไม่สามารถโหลดรายการเคสได้' });
  }
};

exports.updateTicket = async (req, res) => {
  const ticketId = Number(req.params.id);
  const { status, admin_response = '' } = req.body || {};
  if (
    !Number.isInteger(ticketId) || ticketId < 1 ||
    !ticketStatuses.includes(status) ||
    typeof admin_response !== 'string' || admin_response.length > 5000
  ) {
    return res.status(400).json({ error: 'ข้อมูลอัปเดตเคสไม่ถูกต้อง' });
  }
  try {
    const result = await db.query(
      `UPDATE t_maintenance_tickets
       SET status = $1,
           admin_response = $2,
           updated_at = CURRENT_TIMESTAMP,
           closed_at = CASE WHEN $1 = 'closed' THEN CURRENT_TIMESTAMP WHEN $1 <> 'closed' THEN NULL ELSE closed_at END
       WHERE ticket_id = $3
       RETURNING ticket_id, tenant_id, subject, status, admin_response, updated_at, closed_at`,
      [status, admin_response.trim(), ticketId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'ไม่พบเคสแจ้งปัญหา' });

    const updated = result.rows[0];
    const statusLabels = {
      open: 'รอดำเนินการ',
      in_progress: 'กำลังดำเนินการ',
      resolved: 'แก้ไขเรียบร้อยแล้ว',
      closed: 'ปิดเคสแล้ว'
    };

    createAndSendNotification({
      userId: updated.tenant_id,
      title: 'อัปเดตการแจ้งซ่อม/ปัญหา',
      message: `เคส "${updated.subject}" มีการอัปเดตสถานะเป็น: ${statusLabels[status] || status}`,
      type: status === 'resolved' ? 'success' : 'info',
      link: '/tenant-services'
    }).catch((err) => console.error('[Socket] Failed to notify tenant:', err));

    res.json({ message: 'อัปเดตเคสเรียบร้อยแล้ว', ticket: updated });
  } catch (error) {
    console.error('Error updating maintenance ticket:', error);
    res.status(500).json({ error: 'ไม่สามารถอัปเดตเคสได้' });
  }
};
