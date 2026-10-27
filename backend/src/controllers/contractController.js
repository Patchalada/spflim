const db = require('../config/db');
const { parsePagination, respondWithPagination } = require('../utils/pagination');

exports.getContracts = async (req, res) => {
  try {
    const pagination = parsePagination(req.query);
    const search = String(req.query.search || '').trim();
    const where = `WHERE ($1 = '' OR CONCAT_WS(' ', c.contract_id, r.room_number, u.first_name, u.last_name, u.phone, c.status) ILIKE '%' || $1 || '%')`;
    const query = `
      SELECT 
        c.contract_id, c.tenant_id, c.room_id, c.start_date, c.end_date, c.deposit, c.status,
        c.admin_signature, c.admin_signed_at, c.tenant_signature, c.tenant_signed_at, c.signed_document,
        r.room_number, r.floor, r.base_price,
        u.first_name, u.last_name, u.phone
      FROM m_contracts c
      JOIN m_rooms r ON c.room_id = r.room_id
      JOIN m_users u ON c.tenant_id = u.user_id
      ${where}
      ORDER BY c.contract_id DESC
      ${pagination ? 'LIMIT $2 OFFSET $3' : ''};
    `;
    const params = pagination ? [search, pagination.pageSize, pagination.offset] : [search];
    const result = await db.query(query, params);
    if (!pagination) return res.json(result.rows);
    const count = await db.query(
      `SELECT COUNT(*) AS total
       FROM m_contracts c
       JOIN m_rooms r ON c.room_id = r.room_id
       JOIN m_users u ON c.tenant_id = u.user_id
       ${where}`,
      [search]
    );
    respondWithPagination(req, res, result.rows, count.rows[0].total, pagination);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getContractById = async (req, res) => {
  const contractId = Number(req.params.id);
  if (!Number.isInteger(contractId) || contractId < 1) {
    return res.status(400).json({ error: 'รหัสสัญญาไม่ถูกต้อง' });
  }

  try {
    const query = `
      SELECT 
        c.contract_id, c.tenant_id, c.room_id, c.start_date, c.end_date, c.deposit, c.status,
        c.admin_signature, c.admin_signed_at, c.tenant_signature, c.tenant_signed_at, c.signed_document,
        r.room_number, r.floor, r.room_type, r.base_price,
        u.first_name, u.last_name, u.phone, u.username,
        u.kyc_document AS application_document, (u.kyc_document IS NOT NULL) AS has_kyc_document
      FROM m_contracts c
      JOIN m_rooms r ON c.room_id = r.room_id
      JOIN m_users u ON c.tenant_id = u.user_id
      WHERE c.contract_id = $1
    `;
    const [contractRes, settingsRes] = await Promise.all([
      db.query(query, [contractId]),
      db.query('SELECT dormitory_name, dormitory_address, contact_phone, water_rate, electric_rate, promptpay_number, payment_instructions FROM m_billing_settings LIMIT 1')
    ]);

    if (!contractRes.rows.length) {
      return res.status(404).json({ error: 'ไม่พบสัญญาเช่า' });
    }

    const contract = contractRes.rows[0];
    const settings = settingsRes.rows[0] || {};

    // ความปลอดภัย: ถ้าเป็นผู้เช่า ต้องเป็นสัญญาของตัวเองเท่านั้น
    if (req.user?.role === 'tenant' && Number(req.user?.user_id || req.user?.id) !== Number(contract.tenant_id)) {
      return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ดูสัญญาของผู้อื่น' });
    }

    res.json({
      ...contract,
      dormitory_name: settings.dormitory_name || 'ระบบจัดการหอพัก',
      dormitory_address: settings.dormitory_address || '',
      contact_phone: settings.contact_phone || '',
      water_rate: settings.water_rate,
      electric_rate: settings.electric_rate,
      settings
    });
  } catch (err) {
    console.error('Error fetching contract by id:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.createContract = async (req, res) => {
  const { room_id, tenant_id, start_date, end_date, deposit } = req.body;
  const parsedRoomId = Number(room_id);
  const parsedTenantId = Number(tenant_id);
  const parsedDeposit = Number(deposit);
  if (
    !Number.isInteger(parsedRoomId) || parsedRoomId < 1 ||
    !Number.isInteger(parsedTenantId) || parsedTenantId < 1 ||
    typeof start_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(start_date) ||
    !Number.isFinite(parsedDeposit) || parsedDeposit < 0
  ) {
    return res.status(400).json({ error: 'กรุณาตรวจสอบผู้เช่า ห้องพัก วันที่สัญญา และเงินประกัน' });
  }

  try {
    const result = await db.withTransaction(async (client) => {
      const room = await client.query(
        'SELECT room_id, status FROM m_rooms WHERE room_id = $1 FOR UPDATE',
        [parsedRoomId]
      );
      if (!room.rows.length) return { error: 'ไม่พบห้องพักที่เลือก', status: 404 };
      if (room.rows[0].status !== 'vacant') return { error: 'ห้องพักนี้ไม่ว่างแล้ว', status: 409 };

      const tenant = await client.query(
        `SELECT user_id FROM m_users
         WHERE user_id = $1 AND role = 'tenant'
           AND NOT EXISTS (
             SELECT 1 FROM m_contracts WHERE tenant_id = $1 AND status = 'active'
           )
         FOR UPDATE`,
        [parsedTenantId]
      );
      if (!tenant.rows.length) return { error: 'ไม่พบผู้เช่าที่เลือก หรือผู้เช่ามีห้องใช้งานอยู่แล้ว', status: 409 };

      const contract = await client.query(
        `INSERT INTO m_contracts (room_id, tenant_id, start_date, end_date, deposit, status)
         VALUES ($1, $2, $3::date, ($3::date + INTERVAL '1 year')::date, $4, 'active')
         RETURNING *`,
        [parsedRoomId, parsedTenantId, start_date, parsedDeposit]
      );
      await client.query("UPDATE m_rooms SET status = 'occupied' WHERE room_id = $1", [parsedRoomId]);
      return { contract: contract.rows[0] };
    });
    if (result.error) return res.status(result.status).json({ error: result.error });

    res.status(201).json({
      message: 'Contract created successfully',
      contract: result.contract
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateContractStatus = async (req, res) => {
  const { id } = req.params;
  const { status, start_date, end_date, deposit } = req.body || {};
  const validStatuses = ['active', 'terminated', 'expired'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'สถานะสัญญาไม่ถูกต้อง' });
  }
  if (deposit != null && (!Number.isFinite(Number(deposit)) || Number(deposit) < 0)) {
    return res.status(400).json({ error: 'เงินประกันต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป' });
  }
  try {
    const updateResult = await db.withTransaction(async (client) => {
      const existingResult = await client.query(
        `SELECT start_date::text AS start_date, status,
                TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD') AS today_date
         FROM m_contracts
         WHERE contract_id = $1
         FOR UPDATE`,
        [id]
      );
      if (existingResult.rows.length === 0) return { missing: true };
      const existingContract = existingResult.rows[0];
      if (existingContract.status !== 'active') return { locked: true };
      const effectiveStartDate = String(start_date || existingContract.start_date).slice(0, 10);
      let effectiveEndDate = end_date || null;
      if (!effectiveEndDate && status === 'terminated') {
        const currentDate = String(existingContract.today_date).slice(0, 10);
        effectiveEndDate = effectiveStartDate > currentDate ? effectiveStartDate : currentDate;
      }
      if (effectiveEndDate && effectiveStartDate > String(effectiveEndDate).slice(0, 10)) {
        return { invalidDateRange: true };
      }
      if (status === 'active' && effectiveEndDate) {
        const expectedEndDate = await client.query(
          `SELECT (($1::date + INTERVAL '1 year')::date)::text AS end_date`,
          [effectiveStartDate]
        );
        if (String(effectiveEndDate).slice(0, 10) !== expectedEndDate.rows[0].end_date) {
          return { invalidDuration: true };
        }
      }

      const result = await client.query(
        `UPDATE m_contracts
         SET status = $1,
             start_date = COALESCE($2::date, start_date),
             end_date = COALESCE($3::date, end_date),
             deposit = COALESCE($4::numeric, deposit)
         WHERE contract_id = $5::bigint
         RETURNING *`,
        [status, start_date || null, effectiveEndDate, deposit ?? null, id]
      );

      const updatedContract = result.rows[0];
      const activeRoomResult = await client.query(
        "SELECT 1 FROM m_contracts WHERE room_id = $1 AND status = 'active' LIMIT 1",
        [updatedContract.room_id]
      );
      await client.query(
        'UPDATE m_rooms SET status = $1 WHERE room_id = $2',
        [activeRoomResult.rows.length > 0 ? 'occupied' : 'vacant', updatedContract.room_id]
      );
      return { contract: updatedContract };
    });
    if (updateResult.missing) return res.status(404).json({ message: 'Contract not found' });
    if (updateResult.locked) {
      return res.status(409).json({ error: 'สัญญาที่สิ้นสุดแล้วไม่สามารถแก้ไขได้' });
    }
    if (updateResult.invalidDateRange) {
      return res.status(400).json({ error: 'วันเริ่มสัญญาต้องไม่อยู่หลังวันสิ้นสุดสัญญา' });
    }
    if (updateResult.invalidDuration) {
      return res.status(400).json({ error: 'สัญญาเช่าที่ใช้งานต้องมีระยะเวลา 1 ปี' });
    }

    res.json({ message: 'Contract status updated', contract: updateResult.contract });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};