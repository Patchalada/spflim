const bcrypt = require('bcrypt');
const db = require('../config/db');

exports.listAdmins = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT user_id, username, first_name, last_name, phone,
              is_primary_admin, created_at,
              user_id = $1 AS is_current_user
       FROM m_users
       WHERE role = 'admin'
       ORDER BY is_primary_admin DESC, user_id ASC`,
      [req.user.user_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error listing admin accounts:', err);
    res.status(500).json({ error: 'ไม่สามารถโหลดบัญชีแอดมินได้' });
  }
};

exports.createAdmin = async (req, res) => {
  const { username, password, first_name, last_name, phone = '' } = req.body || {};
  if (
    typeof username !== 'string' || !username.trim() || username.trim().length > 100 ||
    typeof password !== 'string' || password.length < 8 || password.length > 128 ||
    typeof first_name !== 'string' || !first_name.trim() || first_name.trim().length > 100 ||
    typeof last_name !== 'string' || !last_name.trim() || last_name.trim().length > 100 ||
    typeof phone !== 'string' || (phone !== '' && !/^\d{10}$/.test(phone))
  ) {
    return res.status(400).json({
      error: 'กรุณากรอกชื่อผู้ใช้ ชื่อ นามสกุล รหัสผ่านให้ถูกต้อง และเบอร์โทรต้องมี 10 หลัก'
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.query(
      `INSERT INTO m_users (
         username, password, first_name, last_name, phone,
         role, status, kyc_document, is_primary_admin
       )
       VALUES ($1, $2, $3, $4, $5, 'admin', 'approved', NULL, FALSE)
       RETURNING user_id, username, first_name, last_name, phone, is_primary_admin, created_at`,
      [username.trim(), hashedPassword, first_name.trim(), last_name.trim(), phone.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว' });
    }
    console.error('Error creating admin account:', err);
    res.status(500).json({ error: 'ไม่สามารถสร้างบัญชีแอดมินได้' });
  }
};

exports.deleteAdmin = async (req, res) => {
  const adminId = Number(req.params.id);
  if (!Number.isInteger(adminId) || adminId < 1) {
    return res.status(400).json({ error: 'รหัสแอดมินไม่ถูกต้อง' });
  }

  try {
    const result = await db.withTransaction(async (client) => {
      const target = await client.query(
        `SELECT user_id, is_primary_admin
         FROM m_users WHERE user_id = $1 AND role = 'admin'
         FOR UPDATE`,
        [adminId]
      );
      if (target.rows.length === 0) return { missing: true };
      if (target.rows[0].is_primary_admin) return { primary: true };

      const contracts = await client.query(
        'SELECT 1 FROM m_contracts WHERE tenant_id = $1 LIMIT 1',
        [adminId]
      );
      if (contracts.rows.length > 0) return { hasContracts: true };
      const reviews = await client.query(
        'SELECT 1 FROM m_kyc_reviews WHERE reviewed_by = $1 LIMIT 1',
        [adminId]
      );
      if (reviews.rows.length > 0) return { hasReviews: true };

      await client.query(
        'DELETE FROM m_users WHERE user_id = $1 AND role = $2 AND is_primary_admin = FALSE',
        [adminId, 'admin']
      );
      return { deleted: true };
    });

    if (result.missing) return res.status(404).json({ error: 'ไม่พบบัญชีแอดมินที่ระบุ' });
    if (result.primary) return res.status(409).json({ error: 'ไม่สามารถลบบัญชีแอดมินหลักได้' });
    if (result.hasContracts) {
      return res.status(409).json({ error: 'ไม่สามารถลบบัญชีที่มีประวัติสัญญาผูกอยู่ได้' });
    }
    if (result.hasReviews) {
      return res.status(409).json({ error: 'ไม่สามารถลบบัญชีที่มีประวัติการตรวจสอบ KYC ได้' });
    }
    res.json({ message: 'ลบบัญชีแอดมินแล้ว' });
  } catch (err) {
    console.error('Error deleting admin account:', err);
    res.status(500).json({ error: 'ไม่สามารถลบบัญชีแอดมินได้' });
  }
};
