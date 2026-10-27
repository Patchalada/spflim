const db = require('../config/db');
const { parsePagination, respondWithPagination } = require('../utils/pagination');

exports.getRooms = async (req, res) => {
  try {
    const pagination = parsePagination(req.query);
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || '');
    const where = `WHERE ($1 = '' OR CONCAT_WS(' ', r.room_number, r.floor, r.room_type, r.status, u.first_name, u.last_name) ILIKE '%' || $1 || '%')
      AND ($2 = '' OR r.status = $2)`;
    const query = `
      SELECT 
        r.room_id,
        r.room_number,
        r.floor,
        r.room_type,
        r.base_price,
        r.status,
        c.contract_id,
        c.start_date,
        c.end_date,
        c.deposit,
        u.user_id AS tenant_id,
        u.first_name,
        u.last_name,
        u.phone,
        u.username
      FROM m_rooms r
      LEFT JOIN m_contracts c ON r.room_id = c.room_id AND c.status = 'active'
      LEFT JOIN m_users u ON c.tenant_id = u.user_id
      ${where}
      ORDER BY r.floor ASC, r.room_number ASC
      ${pagination ? 'LIMIT $3 OFFSET $4' : ''};
    `;
    const params = pagination ? [search, status, pagination.pageSize, pagination.offset] : [search, status];
    const result = await db.query(query, params);
    if (!pagination) return res.json(result.rows);
    const count = await db.query(
      `SELECT COUNT(*) AS total
       FROM m_rooms r
       LEFT JOIN m_contracts c ON r.room_id = c.room_id AND c.status = 'active'
       LEFT JOIN m_users u ON c.tenant_id = u.user_id
       ${where}`,
      [search, status]
    );
    respondWithPagination(req, res, result.rows, count.rows[0].total, pagination);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createRoom = async (req, res) => {
  const { room_number, floor, room_type, status = 'vacant' } = req.body || {};

  try {
    // 1. ตรวจสอบว่ามีห้องหมายเลขนี้อยู่แล้วหรือไม่
    const existingRoom = await db.query(
      'SELECT room_id FROM m_rooms WHERE room_number = $1',
      [room_number]
    );

    if (existingRoom.rows.length > 0) {
      return res.status(400).json({ 
        error: `ห้องหมายเลข ${room_number} มีอยู่ในระบบแล้ว ไม่สามารถเพิ่มซ้ำได้` 
      });
    }

    const roomTypeResult = await db.query(
      'SELECT base_price FROM m_room_types WHERE room_type = $1',
      [room_type]
    );
    if (roomTypeResult.rows.length === 0) {
      return res.status(400).json({ error: 'กรุณาเลือกประเภทห้องที่ตั้งค่าไว้แล้ว' });
    }

    // 2. บันทึกห้องพักใหม่
    const insertQuery = `
      INSERT INTO m_rooms (room_number, floor, room_type, base_price, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const result = await db.query(insertQuery, [
      room_number,
      floor,
      room_type,
      roomTypeResult.rows[0].base_price,
      status
    ]);

    res.status(201).json({
      message: 'เพิ่มห้องพักสำเร็จ',
      room: result.rows[0]
    });
  } catch (err) {
    console.error('Error in createRoom:', err);
    // ดักกรณีชน UNIQUE constraint ของ Postgres
    if (err.code === '23505') {
      return res.status(400).json({ 
        error: `ห้องหมายเลข ${room_number} มีอยู่ในระบบแล้ว` 
      });
    }
    res.status(500).json({ error: err.message });
  }
};

exports.updateRoom = async (req, res) => {
  const { id } = req.params;
  const { room_number, floor, room_type, status } = req.body || {};
  try {
    const roomTypeResult = await db.query(
      'SELECT base_price FROM m_room_types WHERE room_type = $1',
      [room_type]
    );
    if (roomTypeResult.rows.length === 0) {
      return res.status(400).json({ error: 'กรุณาเลือกประเภทห้องที่ตั้งค่าไว้แล้ว' });
    }
    const result = await db.query(
      `UPDATE m_rooms 
       SET room_number = $1, floor = $2, room_type = $3, base_price = $4, status = $5 
       WHERE room_id = $6 RETURNING *`,
      [room_number, floor, room_type, roomTypeResult.rows[0].base_price, status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Room not found' });
    res.json({ message: 'Room updated successfully', room: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: `ห้องหมายเลข ${room_number} มีอยู่ในระบบแล้ว` });
    }
    res.status(500).json({ error: err.message });
  }
};

exports.deleteRoom = async (req, res) => {
  const { id } = req.params;
  try {
    const reviewReferences = await db.query(
      `SELECT 1
       FROM m_users
       WHERE requested_room_id = $1
       UNION ALL
       SELECT 1
       FROM m_kyc_reviews
       WHERE requested_room_id = $1 OR assigned_room_id = $1
       LIMIT 1`,
      [id]
    );
    if (reviewReferences.rows.length > 0) {
      return res.status(409).json({ error: 'ไม่สามารถลบห้องที่มีคำขอสมัครหรือประวัติการตรวจสอบ KYC อ้างอิงอยู่ได้' });
    }
    const result = await db.query('DELETE FROM m_rooms WHERE room_id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Room not found' });
    res.json({ message: 'Room deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};