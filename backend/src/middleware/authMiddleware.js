const jwt = require('jsonwebtoken');
const db = require('../config/db');

exports.verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access Denied: No Token Provided' });

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(403).json({ message: 'Invalid or Expired Token' });
  }
};

exports.authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient Permissions' });
    }
    next();
  };
};

exports.requirePrimaryAdmin = async (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'เฉพาะผู้ดูแลระบบเท่านั้น' });
  }

  try {
    const userId = req.user.user_id || req.user.id;
    const result = await db.query(
      `SELECT is_primary_admin FROM m_users
       WHERE user_id = $1 AND role = 'admin'`,
      [userId]
    );
    if (!result.rows[0]?.is_primary_admin) {
      return res.status(403).json({ message: 'เฉพาะแอดมินหลักเท่านั้นที่จัดการบัญชีแอดมินได้' });
    }
    next();
  } catch (err) {
    console.error('Error checking primary admin permission:', err);
    res.status(500).json({ message: 'ไม่สามารถตรวจสอบสิทธิ์แอดมินหลักได้' });
  }
};