const db = require('../config/db');
const { createAndSendNotification } = require('../config/socket');

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// ดึงรายการประวัติการเงินทั้งหมด
exports.getTransactions = async (req, res) => {
  const { start_date, end_date } = req.query;
  if (
    (start_date && !isValidDate(start_date)) ||
    (end_date && !isValidDate(end_date)) ||
    (start_date && end_date && start_date > end_date)
  ) {
    return res.status(400).json({ error: 'ช่วงวันที่ไม่ถูกต้อง' });
  }
  try {
    const result = await db.query(
      `SELECT * FROM t_transactions
       WHERE ($1::date IS NULL OR transaction_date >= $1::date)
         AND ($2::date IS NULL OR transaction_date <= $2::date)
       ORDER BY transaction_date DESC`,
      [start_date || null, end_date || null]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createExpense = async (req, res) => {
  const { category, amount, description, transaction_date } = req.body || {};
  const parsedAmount = Number(amount);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const parsedDate = transaction_date || today;

  if (
    typeof category !== 'string' ||
    !category.trim() ||
    typeof description !== 'string' ||
    !description.trim() ||
    !Number.isFinite(parsedAmount) ||
    parsedAmount <= 0
  ) {
    return res.status(400).json({ error: 'กรุณาระบุหมวดหมู่ รายละเอียด และจำนวนเงินที่มากกว่า 0' });
  }
  if (!isValidDate(parsedDate)) {
    return res.status(400).json({ error: 'วันที่ทำรายการไม่ถูกต้อง' });
  }

  try {
    const result = await db.query(
      `INSERT INTO t_transactions (type, category, amount, description, transaction_date)
       VALUES ('expense', $1, $2, $3, $4)
       RETURNING *`,
      [category.trim(), parsedAmount, description.trim(), parsedDate]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateExpense = async (req, res) => {
  const { id } = req.params;
  const { category, amount, description, transaction_date } = req.body || {};
  const parsedAmount = Number(amount);

  if (
    !Number.isInteger(Number(id)) ||
    typeof category !== 'string' ||
    !category.trim() ||
    typeof description !== 'string' ||
    !description.trim() ||
    !Number.isFinite(parsedAmount) ||
    parsedAmount <= 0
  ) {
    return res.status(400).json({ error: 'กรุณาระบุหมวดหมู่ รายละเอียด และจำนวนเงินที่มากกว่า 0' });
  }
  if (
    typeof transaction_date !== 'string' ||
    !isValidDate(transaction_date)
  ) {
    return res.status(400).json({ error: 'วันที่ทำรายการไม่ถูกต้อง' });
  }

  try {
    const result = await db.query(
      `UPDATE t_transactions
       SET category = $1, amount = $2, description = $3, transaction_date = $4
       WHERE transaction_id = $5 AND type = 'expense'
       RETURNING *`,
      [category.trim(), parsedAmount, description.trim(), transaction_date, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'ไม่พบรายการรายจ่ายที่ระบุ' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteExpense = async (req, res) => {
  const { id } = req.params;
  if (!Number.isInteger(Number(id))) {
    return res.status(400).json({ error: 'รหัสรายการไม่ถูกต้อง' });
  }

  try {
    const result = await db.query(
      `DELETE FROM t_transactions
       WHERE transaction_id = $1 AND type = 'expense'
       RETURNING transaction_id`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'ไม่พบรายการรายจ่ายที่ระบุ' });
    }
    res.json({ message: 'ลบรายการรายจ่ายแล้ว' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ชำระเงินบิล (Pay Bill) -> เปลี่ยนสถานะบิลเป็น paid + บันทึกรายรับอัตโนมัติ
exports.payBill = async (req, res) => {
  const billId = Number(req.body?.bill_id);
  const paymentDate = req.body?.payment_date || req.body?.transaction_date || (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  })();
  const paymentMethod = req.body?.payment_method || 'other';
  const reference = req.body?.payment_reference;
  const note = req.body?.notes;

  if (!Number.isInteger(billId) || billId < 1) {
    return res.status(400).json({ error: 'รหัสบิลไม่ถูกต้อง' });
  }
  if (!isValidDate(paymentDate)) {
    return res.status(400).json({ error: 'วันที่รับชำระไม่ถูกต้อง' });
  }
  if (!['cash', 'bank_transfer', 'other'].includes(paymentMethod)) {
    return res.status(400).json({ error: 'วิธีชำระเงินไม่ถูกต้อง' });
  }
  if (
    (reference != null && (typeof reference !== 'string' || reference.trim().length > 200)) ||
    (note != null && (typeof note !== 'string' || note.trim().length > 1000))
  ) {
    return res.status(400).json({ error: 'เลขอ้างอิงหรือหมายเหตุต้องไม่เกินความยาวที่กำหนด' });
  }

  try {
    const transaction = await db.withTransaction(async (client) => {
      const billResult = await client.query(
        `SELECT b.bill_id, b.month, b.year, b.total_amount, b.payment_status, c.tenant_id
         FROM t_bills b
         JOIN m_contracts c ON c.contract_id = b.contract_id
         WHERE b.bill_id = $1 FOR UPDATE OF b`,
        [billId]
      );
      if (billResult.rows.length === 0) return { missing: true };
      const bill = billResult.rows[0];
      if (bill.payment_status === 'paid') return { alreadyPaid: true };
      if (bill.payment_status !== 'pending') return { invalidStatus: true };

      const updatedBill = await client.query(
        `UPDATE t_bills SET payment_status = 'paid'
         WHERE bill_id = $1 AND payment_status = 'pending'`,
        [billId]
      );
      if (updatedBill.rowCount !== 1) return { invalidStatus: true };
      const result = await client.query(
        `INSERT INTO t_transactions
           (type, category, amount, description, transaction_date,
            payment_method, payment_reference, notes, bill_id)
         VALUES ('income', 'Rent Payment', $1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          bill.total_amount,
          `ชำระบิลประจำเดือน ${bill.month}/${bill.year} (Bill ID: ${bill.bill_id})`,
          paymentDate,
          paymentMethod,
          reference?.trim() || null,
          note?.trim() || null,
          bill.bill_id
        ]
      );
      return { transaction: result.rows[0], bill, tenantId: bill.tenant_id };
    });

    if (transaction.missing) return res.status(404).json({ message: 'Bill not found' });
    if (transaction.alreadyPaid) return res.status(400).json({ message: 'This bill has already been paid' });
    if (transaction.invalidStatus) return res.status(400).json({ error: 'ไม่สามารถยืนยันการชำระบิลในสถานะนี้ได้' });

    if (transaction.tenantId) {
      createAndSendNotification({
        userId: transaction.tenantId,
        title: 'การชำระเงินเสร็จสมบูรณ์',
        message: `บิลประจำงวด ${transaction.bill.month}/${transaction.bill.year} ยอด ฿${Number(transaction.bill.total_amount).toLocaleString()} ได้รับการบันทึกการชำระเงินเรียบร้อยแล้ว`,
        type: 'success',
        link: '/my-dashboard'
      }).catch((err) => console.error('[Socket] Tenant payment notification error:', err));
    }

    res.status(200).json({
      message: 'Bill paid successfully',
      transaction: transaction.transaction
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};