const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { validateProfileImage } = require('../utils/profileImage');
const { validateUploadedDocument } = require('../utils/uploadedDocument');
const { parsePagination } = require('../utils/pagination');

const PDPA_POLICY_VERSION = '2026-09-29';

exports.getMyProfile = async (req, res) => {
  try {
    const userId = req.user?.user_id || req.user?.id;
    const result = await db.query(
      `SELECT user_id, username, first_name, last_name, phone, role, profile_image
       FROM m_users WHERE user_id = $1`,
      [userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'ไม่พบข้อมูลผู้ใช้' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching current user profile:', err);
    res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลโปรไฟล์ได้' });
  }
};

exports.updateMyProfileImage = async (req, res) => {
  const profileImage = validateProfileImage(req.body?.profile_image);
  if (profileImage === undefined) {
    return res.status(400).json({ error: 'ไฟล์รูปโปรไฟล์ไม่ถูกต้อง (รองรับ JPG, PNG หรือ WebP ไม่เกิน 5MB)' });
  }

  try {
    const userId = req.user?.user_id || req.user?.id;
    const result = await db.query(
      `UPDATE m_users SET profile_image = $1
       WHERE user_id = $2
       RETURNING user_id, profile_image`,
      [profileImage, userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'ไม่พบข้อมูลผู้ใช้' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating profile image:', err);
    res.status(500).json({ error: 'ไม่สามารถบันทึกรูปโปรไฟล์ได้' });
  }
};

exports.getAvailableRooms = async (req, res) => {
  try {
    const pagination = parsePagination(req.query);
    const search = String(req.query.search || '').trim();
    const floor = String(req.query.floor || '').trim();
    const roomType = String(req.query.room_type || '').trim();
    const where = `WHERE status = 'vacant'
      AND ($1 = '' OR CONCAT_WS(' ', room_number, floor, room_type) ILIKE '%' || $1 || '%')
      AND ($2 = '' OR floor::text = $2)
      AND ($3 = '' OR room_type = $3)`;
    const query = `
      SELECT room_id, room_number, floor, room_type, base_price
      FROM m_rooms
      ${where}
      ORDER BY floor ASC, room_number ASC
      ${pagination ? 'LIMIT $4 OFFSET $5' : ''}`;
    const params = pagination
      ? [search, floor, roomType, pagination.pageSize, pagination.offset]
      : [search, floor, roomType];
    const [result, filtersResult] = await Promise.all([
      db.query(query, params),
      pagination
        ? db.query(
          `SELECT
             ARRAY(SELECT DISTINCT floor FROM m_rooms WHERE status = 'vacant' ORDER BY floor) AS floors,
             ARRAY(SELECT DISTINCT room_type FROM m_rooms WHERE status = 'vacant' ORDER BY room_type) AS room_types`
        )
        : Promise.resolve(null)
    ]);
    if (!pagination) return res.json(result.rows);

    const count = await db.query(
      `SELECT COUNT(*) AS total FROM m_rooms ${where}`,
      [search, floor, roomType]
    );
    res.json({
      items: result.rows,
      pagination: {
        page: pagination.page,
        page_size: pagination.pageSize,
        total: Number(count.rows[0].total),
        total_pages: Math.ceil(Number(count.rows[0].total) / pagination.pageSize)
      },
      filters: filtersResult.rows[0]
    });
  } catch (err) {
    console.error('Error fetching rooms for registration:', err);
    res.status(500).json({ error: 'ไม่สามารถโหลดรายการห้องว่างได้' });
  }
};

// 1. ฟังก์ชันสมัครสมาชิก (Register พร้อมแนบเอกสาร KYC)
exports.register = async (req, res) => {
  const {
    username, password, first_name, last_name, phone, role, kyc_document,
    profile_image, pdpa_consent, room_id
  } = req.body || {};

  if (role !== undefined && role !== 'tenant') {
    return res.status(403).json({ error: 'สมัครสมาชิกได้เฉพาะบัญชีผู้เช่าเท่านั้น' });
  }
  if (pdpa_consent !== true) {
    return res.status(400).json({ error: 'กรุณารับทราบประกาศความเป็นส่วนตัวก่อนสมัครสมาชิก' });
  }
  const requestedRoomId = Number(room_id);
  if (!Number.isInteger(requestedRoomId) || requestedRoomId < 1) {
    return res.status(400).json({ error: 'กรุณาเลือกห้องพักที่ต้องการ(ตามที่แจ้งกับผู้ดูแลหอพัก)' });
  }
  if (typeof phone !== 'string' || !/^\d{10}$/.test(phone)) {
    return res.status(400).json({ error: 'เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลัก' });
  }
  const validatedProfileImage = validateProfileImage(profile_image);
  if (validatedProfileImage === undefined) {
    return res.status(400).json({ error: 'ไฟล์รูปโปรไฟล์ไม่ถูกต้อง (รองรับ JPG, PNG หรือ WebP ไม่เกิน 5MB)' });
  }
  const validatedKycDocument = validateUploadedDocument(kyc_document);
  if (!validatedKycDocument) {
    return res.status(400).json({ error: 'กรุณาแนบเอกสารสมัครเป็นรูป JPG, PNG, WebP หรือ PDF ขนาดไม่เกิน 10MB' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const userStatus = 'pending';

    const result = await db.withTransaction(async (client) => {
      const room = await client.query(
        `SELECT room_id FROM m_rooms
         WHERE room_id = $1 AND status = 'vacant'
         FOR UPDATE`,
        [requestedRoomId]
      );
      if (!room.rows.length) return { roomUnavailable: true };
      const user = await client.query(
        `INSERT INTO m_users (
           username, password, first_name, last_name, phone, role, status, kyc_document,
           profile_image, pdpa_consent_at, pdpa_policy_version, requested_room_id
         )
         VALUES ($1, $2, $3, $4, $5, 'tenant', $6, $7, $8, CURRENT_TIMESTAMP, $9, $10)
         RETURNING user_id, username, role, status`,
        [
          username,
          hashedPassword,
          first_name,
          last_name,
          phone,
          userStatus,
          validatedKycDocument.data,
          validatedProfileImage,
          PDPA_POLICY_VERSION,
          requestedRoomId
        ]
      );
      return { user: user.rows[0] };
    });
    if (result.roomUnavailable) {
      return res.status(409).json({ error: 'ห้องที่เลือกไม่ว่างแล้ว กรุณาเลือกห้องอื่น' });
    }

    res.status(201).json({
      message: 'ลงทะเบียนสำเร็จ กรุณารอผู้ดูแลระบบตรวจสอบและอนุมัติเอกสาร',
      user: result.user
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว' });
    }
    res.status(500).json({ error: err.message });
  }
};

// 2. ฟังก์ชันเข้าสู่ระบบ (Login)
exports.login = async (req, res) => {
  const { username, password } = req.body;
  try {
    const userQuery = await db.query('SELECT * FROM m_users WHERE username = $1', [username]);
    if (userQuery.rows.length === 0) return res.status(404).json({ message: 'User not found' });

    const user = userQuery.rows[0];

    // ตรวจสอบรหัสผ่าน
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ message: 'Invalid password' });

    // ตรวจสอบสถานะการอนุมัติเอกสาร (KYC) หลังถอดรหัสผ่านผ่านแล้ว
    if (user.status === 'pending') {
      return res.status(403).json({ message: 'บัญชีของคุณอยู่ระหว่างรอผู้ดูแลระบบตรวจสอบเอกสาร (KYC)' });
    }
    if (user.status === 'rejected') {
      return res.status(403).json({ message: 'เอกสารของคุณไม่ผ่านการอนุมัติ กรุณาติดต่อผู้ดูแลหอพัก' });
    }

    // สร้าง Token
    const token = jwt.sign(
      { user_id: user.user_id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: { user_id: user.user_id, username: user.username, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};