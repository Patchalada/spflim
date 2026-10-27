const db = require('../config/db');

exports.getPublicDormitoryName = async (_req, res) => {
  try {
    const result = await db.query(
      'SELECT dormitory_name FROM m_billing_settings WHERE setting_id = 1'
    );
    res.json({ dormitory_name: result.rows[0]?.dormitory_name || 'ระบบจัดการหอพัก' });
  } catch (err) {
    console.error('Error fetching public dormitory name:', err);
    res.status(500).json({ error: 'ไม่สามารถโหลดชื่อหอพักได้' });
  }
};

exports.getSettings = async (req, res) => {
  try {
    const [settingsResult, roomTypesResult] = await Promise.all([
      db.query(
        `SELECT water_rate, electric_rate, dormitory_name, dormitory_address,
                contact_phone, payment_instructions, promptpay_number
         FROM m_billing_settings WHERE setting_id = 1`
      ),
      db.query(
        'SELECT type_id, room_type, base_price FROM m_room_types ORDER BY room_type'
      )
    ]);
    res.json({
      ...settingsResult.rows[0],
      room_types: roomTypesResult.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateDormitoryDetails = async (req, res) => {
  const fields = [
    ['dormitory_name', 'ชื่อหอพัก', 150],
    ['dormitory_address', 'ที่อยู่', 500],
    ['contact_phone', 'เบอร์โทรศัพท์', 50],
    ['payment_instructions', 'คำแนะนำการชำระเงิน', 1000],
    ['promptpay_number', 'เบอร์พร้อมเพย์', 10]
  ];
  const values = fields.map(([key]) => req.body?.[key]);
  if (values.some((value, index) => (
    typeof value !== 'string' ||
    value.trim().length > fields[index][2] ||
    (index === 0 && !value.trim())
  ))) {
    return res.status(400).json({ error: 'กรุณาตรวจสอบข้อมูลหอพักและความยาวของข้อความ' });
  }
  const promptPayNumber = req.body.promptpay_number.trim();
  if (promptPayNumber && !/^\d{10}$/.test(promptPayNumber)) {
    return res.status(400).json({ error: 'เบอร์พร้อมเพย์ต้องเป็นตัวเลข 10 หลัก หรือเว้นว่างเพื่อปิดการแสดงผล' });
  }

  try {
    const result = await db.query(
      `UPDATE m_billing_settings
       SET dormitory_name = $1, dormitory_address = $2,
           contact_phone = $3, payment_instructions = $4, promptpay_number = $5
       WHERE setting_id = 1
       RETURNING dormitory_name, dormitory_address, contact_phone,
                 payment_instructions, promptpay_number`,
      [...values.map((value) => value.trim()).slice(0, 4), promptPayNumber]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'ไม่พบการตั้งค่าหอพัก' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateRates = async (req, res) => {
  const { water_rate, electric_rate } = req.body || {};
  const waterRate = Number(water_rate);
  const electricRate = Number(electric_rate);

  if (
    !Number.isFinite(waterRate) ||
    waterRate < 0 ||
    !Number.isFinite(electricRate) ||
    electricRate < 0
  ) {
    return res.status(400).json({ error: 'กรุณาระบุค่าน้ำและค่าไฟเป็นตัวเลขตั้งแต่ 0 ขึ้นไป' });
  }

  try {
    const result = await db.query(
      `UPDATE m_billing_settings
       SET water_rate = $1, electric_rate = $2
       WHERE setting_id = 1
       RETURNING water_rate, electric_rate`,
      [waterRate, electricRate]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createRoomType = async (req, res) => {
  const { room_type, base_price } = req.body || {};
  const roomType = typeof room_type === 'string' ? room_type.trim() : '';
  const basePrice = Number(base_price);

  if (!roomType || !Number.isFinite(basePrice) || basePrice < 0) {
    return res.status(400).json({ error: 'กรุณาระบุชื่อประเภทห้องและราคาตั้งแต่ 0 ขึ้นไป' });
  }

  try {
    const result = await db.query(
      `INSERT INTO m_room_types (room_type, base_price)
       VALUES ($1, $2)
       RETURNING type_id, room_type, base_price`,
      [roomType, basePrice]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'มีประเภทห้องชื่อนี้อยู่แล้ว' });
    }
    res.status(500).json({ error: err.message });
  }
};

exports.updateRoomType = async (req, res) => {
  const { id } = req.params;
  const basePrice = Number(req.body?.base_price);

  if (!Number.isInteger(Number(id)) || !Number.isFinite(basePrice) || basePrice < 0) {
    return res.status(400).json({ error: 'กรุณาระบุราคาตั้งแต่ 0 ขึ้นไป' });
  }

  try {
    const result = await db.query(
      `UPDATE m_room_types SET base_price = $1
       WHERE type_id = $2
       RETURNING type_id, room_type, base_price`,
      [basePrice, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'ไม่พบประเภทห้องที่ระบุ' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteRoomType = async (req, res) => {
  const { id } = req.params;

  if (!Number.isInteger(Number(id))) {
    return res.status(400).json({ error: 'รหัสประเภทห้องไม่ถูกต้อง' });
  }

  try {
    const roomTypeResult = await db.query(
      'SELECT room_type FROM m_room_types WHERE type_id = $1',
      [id]
    );
    if (roomTypeResult.rows.length === 0) {
      return res.status(404).json({ error: 'ไม่พบประเภทห้องที่ระบุ' });
    }

    const usedResult = await db.query(
      'SELECT 1 FROM m_rooms WHERE room_type = $1 LIMIT 1',
      [roomTypeResult.rows[0].room_type]
    );
    if (usedResult.rows.length > 0) {
      return res.status(409).json({ error: 'ไม่สามารถลบประเภทห้องที่มีห้องใช้งานอยู่ได้' });
    }

    await db.query('DELETE FROM m_room_types WHERE type_id = $1', [id]);
    res.json({ message: 'ลบประเภทห้องสำเร็จ' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
