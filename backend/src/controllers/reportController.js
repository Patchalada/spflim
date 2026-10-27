const db = require('../config/db');
const { parsePagination, respondWithPagination } = require('../utils/pagination');

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function getDateRange(query) {
  const { start_date, end_date } = query;
  if (
    (start_date && !isValidDate(start_date)) ||
    (end_date && !isValidDate(end_date))
  ) {
    return { error: 'รูปแบบวันที่ไม่ถูกต้อง' };
  }
  if (start_date && end_date && start_date > end_date) {
    return { error: 'วันที่เริ่มต้นต้องไม่อยู่หลังวันที่สิ้นสุด' };
  }
  return { start_date: start_date || null, end_date: end_date || null };
}

exports.getDashboardSummary = async (req, res) => {
  const range = getDateRange(req.query);
  if (range.error) return res.status(400).json({ error: range.error });
  try {
    const roomStats = await db.query(`
      SELECT status, COUNT(*) as count 
      FROM m_rooms GROUP BY status
    `);

    const financialStats = await db.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense,
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount WHEN type = 'expense' THEN -amount ELSE 0 END), 0) as net_profit
      FROM t_transactions
      WHERE ($1::date IS NULL OR transaction_date >= $1::date)
        AND ($2::date IS NULL OR transaction_date <= $2::date)
    `, [range.start_date, range.end_date]);

    const pendingBills = await db.query(`
      SELECT COUNT(*) as unpaid_count, SUM(total_amount) as unpaid_amount 
      FROM t_bills
      WHERE payment_status = 'pending'
        AND ($1::date IS NULL OR due_date >= $1::date)
        AND ($2::date IS NULL OR due_date <= $2::date)
    `, [range.start_date, range.end_date]);

    res.json({
      room_summary: roomStats.rows,
      financial_summary: financialStats.rows[0],
      pending_bills_summary: pendingBills.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMonthlyFinancialReport = async (req, res) => {
  const range = getDateRange(req.query);
  if (range.error) return res.status(400).json({ error: range.error });
  try {
    const query = `
      SELECT 
        TO_CHAR(transaction_date, 'YYYY-MM') as month,
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
      FROM t_transactions
      WHERE ($1::date IS NULL OR transaction_date >= $1::date)
        AND ($2::date IS NULL OR transaction_date <= $2::date)
      GROUP BY TO_CHAR(transaction_date, 'YYYY-MM')
      ORDER BY month ASC;
    `;
    const result = await db.query(query, [range.start_date, range.end_date]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getRoomReport = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT r.room_id, r.room_number, r.floor, r.room_type, r.base_price, r.status,
             u.first_name, u.last_name
      FROM m_rooms r
      LEFT JOIN m_contracts c ON r.room_id = c.room_id AND c.status = 'active'
      LEFT JOIN m_users u ON c.tenant_id = u.user_id
      ORDER BY r.floor, r.room_number
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getTenantReport = async (req, res) => {
  try {
    const pagination = parsePagination(req.query);
    const search = String(req.query.search || '').trim();
    const where = `WHERE u.role = 'tenant'
      AND ($1 = '' OR CONCAT_WS(' ', u.user_id, u.username, u.first_name, u.last_name, u.phone,
        u.status, r.room_number) ILIKE '%' || $1 || '%')`;
    const result = await db.query(`
      SELECT u.user_id, u.username, u.first_name, u.last_name, u.phone, u.status AS account_status,
             c.contract_id, c.start_date, c.end_date, c.status AS contract_status,
             r.room_number, r.room_type, r.base_price
      FROM m_users u
      LEFT JOIN m_contracts c ON u.user_id = c.tenant_id AND c.status = 'active'
      LEFT JOIN m_rooms r ON c.room_id = r.room_id
      ${where}
      ORDER BY u.first_name, u.last_name
      ${pagination ? 'LIMIT $2 OFFSET $3' : ''}
    `,
    pagination ? [search, pagination.pageSize, pagination.offset] : [search]);
    if (!pagination) return res.json(result.rows);
    const count = await db.query(
      `SELECT COUNT(*) AS total
       FROM m_users u
       LEFT JOIN m_contracts c ON u.user_id = c.tenant_id AND c.status = 'active'
       LEFT JOIN m_rooms r ON c.room_id = r.room_id
       ${where}`,
      [search]
    );
    respondWithPagination(req, res, result.rows, count.rows[0].total, pagination);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getPaymentReport = async (req, res) => {
  const range = getDateRange(req.query);
  if (range.error) return res.status(400).json({ error: range.error });
  try {
    const result = await db.query(`
      SELECT b.bill_id, b.month, b.year, b.rent_amount, b.water_unit, b.water_amount,
             b.electric_unit, b.electric_amount, b.total_amount, b.payment_status, b.due_date,
             r.room_number, u.first_name, u.last_name
      FROM t_bills b
      JOIN m_contracts c ON b.contract_id = c.contract_id
      JOIN m_rooms r ON c.room_id = r.room_id
      JOIN m_users u ON c.tenant_id = u.user_id
      WHERE ($1::date IS NULL OR b.due_date >= $1::date)
        AND ($2::date IS NULL OR b.due_date <= $2::date)
      ORDER BY b.year DESC, b.month DESC, b.bill_id DESC
    `, [range.start_date, range.end_date]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};