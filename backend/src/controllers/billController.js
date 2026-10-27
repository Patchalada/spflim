const db = require('../config/db');
const { parsePagination, respondWithPagination } = require('../utils/pagination');
const { createAndSendNotification } = require('../config/socket');

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

exports.getBills = async (req, res) => {
  try {
    const pagination = parsePagination(req.query);
    const month = req.query.month === undefined ? null : Number(req.query.month);
    const year = req.query.year === undefined ? null : Number(req.query.year);
    const status = String(req.query.status || '');
    const search = String(req.query.search || '').trim();
    const where = `WHERE ($1::integer IS NULL OR b.month = $1)
      AND ($2::integer IS NULL OR b.year = $2)
      AND ($3 = '' OR b.payment_status = $3)
      AND ($4 = '' OR CONCAT_WS(' ', b.bill_id, r.room_number, u.first_name, u.last_name) ILIKE '%' || $4 || '%')`;
    const query = `
      SELECT 
        b.bill_id, b.month, b.year, b.rent_amount,
        b.water_unit, b.water_amount, b.electric_unit, b.electric_amount,
        b.water_rate, b.electric_rate,
        b.water_old_meter, b.water_new_meter,
        b.electric_old_meter, b.electric_new_meter,
        b.total_amount, b.payment_status, b.due_date,
        (b.slip_image IS NOT NULL) AS has_slip,
        b.slip_verification_status, b.slip_verification_message, b.extra_charges,
        r.room_number,
        u.first_name, u.last_name
      FROM t_bills b
      JOIN m_contracts c ON b.contract_id = c.contract_id
      JOIN m_rooms r ON c.room_id = r.room_id
      JOIN m_users u ON c.tenant_id = u.user_id
      ${where}
      ORDER BY b.bill_id DESC
      ${pagination ? 'LIMIT $5 OFFSET $6' : ''};
    `;
    const filterParams = [month, year, status, search];
    const result = await db.query(
      query,
      pagination ? [...filterParams, pagination.pageSize, pagination.offset] : filterParams
    );
    if (!pagination) return res.json(result.rows);
    const count = await db.query(
      `SELECT COUNT(*) AS total
       FROM t_bills b
       JOIN m_contracts c ON b.contract_id = c.contract_id
       JOIN m_rooms r ON c.room_id = r.room_id
       JOIN m_users u ON c.tenant_id = u.user_id
       ${where}`,
      filterParams
    );
    respondWithPagination(req, res, result.rows, count.rows[0].total, pagination);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getBillSlip = async (req, res) => {
  const billId = Number(req.params.bill_id);
  if (!Number.isInteger(billId) || billId < 1) {
    return res.status(400).json({ error: 'รหัสบิลไม่ถูกต้อง' });
  }

  try {
    const result = await db.query(
      `SELECT b.slip_image
       FROM t_bills b
       JOIN m_contracts c ON c.contract_id = b.contract_id
       WHERE b.bill_id = $1
         AND ($3 = 'admin' OR c.tenant_id = $2)
         AND b.slip_image IS NOT NULL`,
      [billId, req.user.user_id || req.user.id, req.user.role]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'ไม่พบสลิป หรือคุณไม่มีสิทธิ์เข้าถึง' });
    }
    res.json({ slip_image: result.rows[0].slip_image });
  } catch (err) {
    console.error('Error fetching bill slip:', err);
    res.status(500).json({ error: 'ไม่สามารถโหลดสลิปได้' });
  }
};

exports.getBillById = async (req, res) => {
  const billId = Number(req.params.bill_id);
  if (!Number.isInteger(billId) || billId < 1) {
    return res.status(400).json({ error: 'รหัสบิลไม่ถูกต้อง' });
  }

  try {
    const result = await db.query(
      `SELECT
         b.bill_id, b.month, b.year, b.rent_amount,
         b.water_unit, b.water_amount, b.water_old_meter, b.water_new_meter,
         b.water_rate, b.electric_unit, b.electric_amount, b.electric_old_meter, b.electric_new_meter,
         b.electric_rate,
         b.total_amount, b.payment_status, b.due_date,
         b.extra_charges,
         r.room_number, r.floor, r.room_type,
         u.user_id AS tenant_id, u.first_name, u.last_name, u.phone,
         payment.transaction_date AS paid_at, payment.payment_method,
         payment.payment_reference, payment.notes,
         settings.dormitory_name, settings.dormitory_address,
         settings.contact_phone, settings.payment_instructions,
         settings.promptpay_number
       FROM t_bills b
       JOIN m_contracts c ON b.contract_id = c.contract_id
       JOIN m_rooms r ON c.room_id = r.room_id
       JOIN m_users u ON c.tenant_id = u.user_id
       LEFT JOIN LATERAL (
         SELECT transaction_date, payment_method, payment_reference, notes
         FROM t_transactions
         WHERE type = 'income'
           AND (
             bill_id = b.bill_id
             OR (bill_id IS NULL AND description =
               'ชำระบิลประจำเดือน ' || b.month || '/' || b.year || ' (Bill ID: ' || b.bill_id || ')')
           )
         ORDER BY COALESCE(bill_id = b.bill_id, FALSE) DESC, transaction_id DESC
         LIMIT 1
       ) payment ON TRUE
       LEFT JOIN m_billing_settings settings ON settings.setting_id = 1
       WHERE b.bill_id = $1
         AND ($3 = 'admin' OR c.tenant_id = $2)
       LIMIT 1`,
      [billId, req.user.user_id || req.user.id, req.user.role]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'ไม่พบบิลที่ระบุ' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching bill document:', err);
    res.status(500).json({ error: 'ไม่สามารถโหลดเอกสารบิลได้' });
  }
};

// ดึงเลขมิเตอร์ล่าสุดของสัญญาห้องพักนี้ (เพื่อนำไปเป็นมิเตอร์เก่า)
exports.getLastMeter = async (req, res) => {
  const { contract_id } = req.params;
  try {
    const query = `
      SELECT 
        COALESCE(water_new_meter, 0) AS last_water_meter,
        COALESCE(electric_new_meter, 0) AS last_electric_meter
      FROM t_bills 
      WHERE contract_id = $1 
      ORDER BY bill_id DESC 
      LIMIT 1;
    `;
    const result = await db.query(query, [contract_id]);
    
    if (result.rows.length === 0) {
      return res.json({ last_water_meter: 0, last_electric_meter: 0 });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateBillDueDate = async (req, res) => {
  const billId = Number(req.params.bill_id);
  const dueDate = req.body?.due_date;
  if (!Number.isInteger(billId) || billId < 1 || !isValidDate(dueDate)) {
    return res.status(400).json({ error: 'กรุณาระบุรหัสบิลและวันครบกำหนดที่ถูกต้อง' });
  }

  try {
    const result = await db.query(
      `UPDATE t_bills SET due_date = $1::date
       WHERE bill_id = $2 AND payment_status = 'pending'
       RETURNING bill_id, due_date`,
      [dueDate, billId]
    );
    if (!result.rows.length) {
      const existing = await db.query('SELECT bill_id FROM t_bills WHERE bill_id = $1', [billId]);
      return existing.rows.length
        ? res.status(409).json({ error: 'แก้วันครบกำหนดได้เฉพาะบิลที่ยังรอชำระ' })
        : res.status(404).json({ error: 'ไม่พบบิลที่ระบุ' });
    }
    res.json({ message: 'แก้วันครบกำหนดแล้ว', bill: result.rows[0] });
  } catch (error) {
    console.error('Error updating bill due date:', error);
    res.status(500).json({ error: 'ไม่สามารถแก้วันครบกำหนดได้' });
  }
};

// ออกบิลประจำเดือน
exports.createBill = async (req, res) => {
  const { 
    contract_id, month, year, 
    water_old_meter, water_new_meter, 
    electric_old_meter, electric_new_meter, 
    due_date, water_rate, electric_rate,
    extra_charges = []
  } = req.body || {};

  try {
    if (
      !Number.isInteger(Number(contract_id)) || Number(contract_id) < 1 ||
      !Number.isInteger(Number(month)) || Number(month) < 1 || Number(month) > 12 ||
      !Number.isInteger(Number(year)) || Number(year) < 2000 ||
      !isValidDate(due_date)
    ) {
      return res.status(400).json({ error: 'กรุณาระบุสัญญา รอบบิล และวันครบกำหนดให้ถูกต้อง' });
    }
    if (!Array.isArray(extra_charges) || extra_charges.length > 20) {
      return res.status(400).json({ error: 'รายการค่าใช้จ่ายเพิ่มเติมไม่ถูกต้อง (เพิ่มได้สูงสุด 20 รายการ)' });
    }
    const parsedCharges = [];
    for (const charge of extra_charges) {
      if (
        !charge ||
        typeof charge.description !== 'string' ||
        !charge.description.trim() ||
        charge.description.trim().length > 100 ||
        !Number.isFinite(Number(charge.amount)) ||
        Number(charge.amount) < 0
      ) {
        return res.status(400).json({ error: 'กรุณาตรวจสอบชื่อและจำนวนเงินของรายการเพิ่มเติม' });
      }
      parsedCharges.push({
        description: charge.description.trim(),
        amount: Number(charge.amount)
      });
    }

    const parsedWaterOld = Number(water_old_meter || 0);
    const parsedWaterNew = Number(water_new_meter || 0);
    const parsedElectricOld = Number(electric_old_meter || 0);
    const parsedElectricNew = Number(electric_new_meter || 0);

    if (parsedWaterNew < parsedWaterOld) {
      return res.status(400).json({ error: 'เลขมิเตอร์น้ำใหม่ ต้องไม่น้อยกว่ามิเตอร์น้ำเก่า' });
    }
    if (parsedElectricNew < parsedElectricOld) {
      return res.status(400).json({ error: 'เลขมิเตอร์ไฟใหม่ ต้องไม่น้อยกว่ามิเตอร์ไฟเก่า' });
    }

    // คำนวณจำนวนหน่วยที่ใช้จริง
    const water_unit = parsedWaterNew - parsedWaterOld;
    const electric_unit = parsedElectricNew - parsedElectricOld;

    // ดึงค่าเช่าห้องตามสัญญา
    const contractQuery = `
      SELECT c.contract_id, c.tenant_id, r.room_number, r.base_price
      FROM m_contracts c 
      JOIN m_rooms r ON c.room_id = r.room_id 
      WHERE c.contract_id = $1 AND c.status = 'active';
    `;
    const contractResult = await db.query(contractQuery, [contract_id]);

    if (contractResult.rows.length === 0) {
      return res.status(404).json({ error: 'ไม่พบสัญญาเช่าที่ระบุ' });
    }

    const rent_amount = parseFloat(contractResult.rows[0].base_price || 0);
    const ratesResult = await db.query(
      'SELECT water_rate, electric_rate FROM m_billing_settings WHERE setting_id = 1'
    );
    const defaultRates = ratesResult.rows[0];
    const parsedWaterRate = water_rate === undefined ? Number(defaultRates.water_rate) : Number(water_rate);
    const parsedElectricRate = electric_rate === undefined ? Number(defaultRates.electric_rate) : Number(electric_rate);
    if (
      !Number.isFinite(parsedWaterRate) || parsedWaterRate < 0 ||
      !Number.isFinite(parsedElectricRate) || parsedElectricRate < 0
    ) {
      return res.status(400).json({ error: 'อัตราค่าน้ำและค่าไฟต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป' });
    }
    const water_amount = water_unit * parsedWaterRate;
    const electric_amount = electric_unit * parsedElectricRate;
    const extraChargesTotal = parsedCharges.reduce((sum, charge) => sum + charge.amount, 0);
    const total_amount = rent_amount + water_amount + electric_amount + extraChargesTotal;

    const insertQuery = `
      INSERT INTO t_bills (
        contract_id, month, year, rent_amount, 
        water_old_meter, water_new_meter, water_unit, water_amount,
        electric_old_meter, electric_new_meter, electric_unit, electric_amount, 
        total_amount, payment_status, due_date, extra_charges, water_rate, electric_rate
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending', $14, $15::jsonb, $16, $17)
      RETURNING *;
    `;

    const result = await db.query(insertQuery, [
      contract_id, month, year, rent_amount,
      parsedWaterOld, parsedWaterNew, water_unit, water_amount,
      parsedElectricOld, parsedElectricNew, electric_unit, electric_amount,
      total_amount, due_date, JSON.stringify(parsedCharges), parsedWaterRate, parsedElectricRate
    ]);

    const createdBill = result.rows[0];
    const tenantId = contractResult.rows[0]?.tenant_id;
    if (tenantId) {
      createAndSendNotification({
        userId: tenantId,
        title: 'มีบิลค่าเช่าใหม่',
        message: `บิลประจำงวด ${month}/${year} ยอดรวม ฿${Number(total_amount).toLocaleString()} ครบกำหนดชำระ ${due_date}`,
        type: 'info',
        link: '/my-dashboard'
      }).catch((err) => console.error('[Socket] Failed to notify tenant about bill:', err));
    }

    res.status(201).json({
      message: 'ออกบิลสำเร็จ',
      bill: createdBill
    });
  } catch (err) {
    console.error('Error in createBill:', err);
    res.status(500).json({ error: err.message });
  }
};