const db = require('../config/db');
const { parsePagination, respondWithPagination } = require('../utils/pagination');
const { validateUploadedDocument } = require('../utils/uploadedDocument');

exports.getMyRenewals = async (req, res) => {
  try {
    const userId = req.user?.user_id || req.user?.id;
    const [contractResult, requestResult] = await Promise.all([
      db.query(
        `SELECT c.contract_id, c.room_id, c.start_date::text AS start_date,
                c.end_date::text AS end_date, c.status, r.room_number,
                (CURRENT_DATE BETWEEN c.end_date - INTERVAL '30 days' AND c.end_date) AS renewal_window_open,
                EXISTS (
                  SELECT 1 FROM m_contract_renewal_requests rr
                  WHERE rr.contract_id = c.contract_id
                    AND rr.status IN ('pending', 'awaiting_tenant', 'awaiting_admin')
                ) AS has_pending_request
         FROM m_contracts c
         JOIN m_rooms r ON r.room_id = c.room_id
         WHERE c.tenant_id = $1 AND c.status = 'active'
         ORDER BY c.contract_id DESC LIMIT 1`,
        [userId]
      ),
      db.query(
        `SELECT rr.request_id, rr.contract_id, rr.proposed_end_date::text AS proposed_end_date,
                (rr.agreement_document IS NOT NULL) AS has_agreement_document,
                (rr.signed_document IS NOT NULL) AS has_signed_document,
                rr.tenant_note, rr.status, rr.admin_note,
                rr.submitted_at, rr.reviewed_at, r.room_number
         FROM m_contract_renewal_requests rr
         JOIN m_contracts c ON c.contract_id = rr.contract_id
         JOIN m_rooms r ON r.room_id = c.room_id
         WHERE rr.tenant_id = $1
         ORDER BY rr.submitted_at DESC`,
        [userId]
      )
    ]);
    res.json({ contract: contractResult.rows[0] || null, requests: requestResult.rows });
  } catch (error) {
    console.error('Error fetching tenant renewal requests:', error);
    res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลการต่อสัญญาได้' });
  }
};

exports.createMyRenewal = async (req, res) => {
  const { tenant_note = '' } = req.body || {};
  if (typeof tenant_note !== 'string' || tenant_note.length > 2000) {
    return res.status(400).json({ error: 'หมายเหตุต้องมีความยาวไม่เกิน 2,000 ตัวอักษร' });
  }

  try {
    const userId = req.user?.user_id || req.user?.id;
    const result = await db.withTransaction(async (client) => {
      const contractResult = await client.query(
        `SELECT contract_id
         FROM m_contracts
         WHERE tenant_id = $1 AND status = 'active'
         ORDER BY contract_id DESC LIMIT 1 FOR UPDATE`,
        [userId]
      );
      if (!contractResult.rows.length) return { error: 'ไม่พบสัญญาเช่าที่กำลังใช้งาน', status: 409 };
      const contractId = contractResult.rows[0].contract_id;

      const eligibility = await client.query(
        `SELECT CURRENT_DATE BETWEEN end_date - INTERVAL '30 days' AND end_date AS eligible
         FROM m_contracts WHERE contract_id = $1`,
        [contractId]
      );
      if (!eligibility.rows[0].eligible) {
        return { error: 'ส่งคำขอต่อสัญญาได้ภายใน 30 วันก่อนวันหมดสัญญาเท่านั้น', status: 400 };
      }
      const pending = await client.query(
        `SELECT 1 FROM m_contract_renewal_requests
         WHERE contract_id = $1 AND status IN ('pending', 'awaiting_tenant', 'awaiting_admin') LIMIT 1`,
        [contractId]
      );
      if (pending.rows.length) return { error: 'มีคำขอต่อสัญญาที่กำลังดำเนินการอยู่แล้ว', status: 409 };

      const request = await client.query(
        `INSERT INTO m_contract_renewal_requests (contract_id, tenant_id, tenant_note)
         VALUES ($1, $2, $3)
         RETURNING request_id, contract_id, status, submitted_at`,
        [contractId, userId, tenant_note.trim()]
      );
      return { request: request.rows[0] };
    });
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.status(201).json({ message: 'ส่งคำขอต่อสัญญาแล้ว รอผู้ดูแลพิจารณา', request: result.request });
  } catch (error) {
    console.error('Error creating tenant renewal request:', error);
    res.status(500).json({ error: 'ไม่สามารถส่งคำขอต่อสัญญาได้' });
  }
};

exports.getRenewalRequests = async (req, res) => {
  try {
    const pagination = parsePagination(req.query);
    const status = ['pending', 'awaiting_tenant', 'awaiting_admin', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : '';
    const where = `WHERE ($1 = '' OR rr.status = $1)`;
    const result = await db.query(
      `SELECT rr.request_id, rr.contract_id, rr.tenant_id, rr.proposed_end_date::text AS proposed_end_date,
              (rr.agreement_document IS NOT NULL) AS has_agreement_document,
              (rr.signed_document IS NOT NULL) AS has_signed_document,
              rr.tenant_note, rr.status, rr.admin_note, rr.submitted_at, rr.reviewed_at,
             u.first_name, u.last_name, u.username, u.phone, r.room_number,
             c.end_date::text AS current_end_date
       FROM m_contract_renewal_requests rr
       JOIN m_users u ON u.user_id = rr.tenant_id
       JOIN m_contracts c ON c.contract_id = rr.contract_id
       JOIN m_rooms r ON r.room_id = c.room_id
       ${where}
       ORDER BY CASE rr.status WHEN 'pending' THEN 0 WHEN 'awaiting_tenant' THEN 1 WHEN 'awaiting_admin' THEN 2 ELSE 3 END,
                rr.submitted_at DESC
       ${pagination ? 'LIMIT $2 OFFSET $3' : ''}`,
      pagination ? [status, pagination.pageSize, pagination.offset] : [status]
    );
    if (!pagination) return res.json(result.rows);
    const count = await db.query(
      `SELECT COUNT(*) AS total FROM m_contract_renewal_requests rr ${where}`,
      [status]
    );
    respondWithPagination(req, res, result.rows, count.rows[0].total, pagination);
  } catch (error) {
    console.error('Error fetching renewal requests for admin:', error);
    res.status(500).json({ error: 'ไม่สามารถโหลดคำขอต่อสัญญาได้' });
  }
};

exports.getRenewalDocument = async (req, res) => {
  const requestId = Number(req.params.id);
  const kind = req.params.kind;
  if (!Number.isInteger(requestId) || requestId < 1 || !['agreement', 'signed'].includes(kind)) {
    return res.status(400).json({ error: 'รหัสเอกสารไม่ถูกต้อง' });
  }

  try {
    const column = kind === 'agreement' ? 'agreement_document' : 'signed_document';
    const result = await db.query(
      `SELECT rr.${column} AS document
       FROM m_contract_renewal_requests rr
       WHERE rr.request_id = $1
         AND ($3 = 'admin' OR rr.tenant_id = $2)`,
      [requestId, req.user.user_id || req.user.id, req.user.role]
    );
    if (!result.rows.length || !result.rows[0].document) {
      return res.status(404).json({ error: 'ไม่พบเอกสาร หรือคุณไม่มีสิทธิ์เข้าถึง' });
    }
    res.json({ document: result.rows[0].document });
  } catch (error) {
    console.error('Error fetching renewal document:', error);
    res.status(500).json({ error: 'ไม่สามารถโหลดเอกสารได้' });
  }
};

exports.reviewRenewalRequest = async (req, res) => {
  const requestId = Number(req.params.id);
  const { status, admin_note = '' } = req.body || {};
  if (
    !Number.isInteger(requestId) || requestId < 1 ||
    !['approved', 'rejected'].includes(status) ||
    typeof admin_note !== 'string' || admin_note.length > 2000
  ) {
    return res.status(400).json({ error: 'ข้อมูลการพิจารณาคำขอไม่ถูกต้อง' });
  }

  try {
    const adminId = req.user?.user_id || req.user?.id;
    const result = await db.withTransaction(async (client) => {
      const requestResult = await client.query(
        `SELECT request_id, status FROM m_contract_renewal_requests
         WHERE request_id = $1 FOR UPDATE`,
        [requestId]
      );
      if (!requestResult.rows.length) return { error: 'ไม่พบคำขอต่อสัญญา', statusCode: 404 };
      if (requestResult.rows[0].status !== 'pending') {
        return { error: 'คำขอนี้ได้รับการพิจารณาแล้ว', statusCode: 409 };
      }
      await client.query(
        `UPDATE m_contract_renewal_requests
         SET status = $1, admin_note = $2, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = $3
         WHERE request_id = $4`,
        [status === 'approved' ? 'awaiting_tenant' : 'rejected', admin_note.trim(), adminId, requestId]
      );
      return { success: true };
    });
    if (result.error) return res.status(result.statusCode).json({ error: result.error });
    res.json({
      message: status === 'approved' ? 'อนุมัติคำขอแล้ว สามารถส่งสัญญาให้ผู้เช่าได้' : 'ปฏิเสธคำขอต่อสัญญาแล้ว'
    });
  } catch (error) {
    console.error('Error reviewing renewal request:', error);
    res.status(500).json({ error: 'ไม่สามารถบันทึกผลการพิจารณาได้' });
  }
};

exports.sendRenewalAgreement = async (req, res) => {
  const requestId = Number(req.params.id);
  const { agreement_document, admin_note = '' } = req.body || {};
  const uploadedDocument = validateUploadedDocument(agreement_document);
  if (
    !Number.isInteger(requestId) || requestId < 1 ||
    !uploadedDocument ||
    typeof admin_note !== 'string' || admin_note.length > 2000
  ) {
    return res.status(400).json({ error: 'กรุณาแนบไฟล์สัญญา PDF/รูปไม่เกิน 10MB และตรวจสอบหมายเหตุ' });
  }
  try {
    const result = await db.withTransaction(async (client) => {
      const renewal = await client.query(
        `SELECT rr.request_id, rr.contract_id, rr.status,
                (c.end_date + INTERVAL '1 year')::date::text AS proposed_end_date
         FROM m_contract_renewal_requests rr
         JOIN m_contracts c ON c.contract_id = rr.contract_id
         WHERE rr.request_id = $1 FOR UPDATE OF rr, c`,
        [requestId]
      );
      if (!renewal.rows.length) return { error: 'ไม่พบคำขอต่อสัญญา', statusCode: 404 };
      if (renewal.rows[0].status !== 'awaiting_tenant') {
        return { error: 'ต้องอนุมัติคำขอต่อสัญญาก่อนส่งสัญญาให้ผู้เช่า', statusCode: 409 };
      }
      await client.query(
        `UPDATE m_contract_renewal_requests
         SET proposed_end_date = $1::date, agreement_document = $2, admin_note = $3
         WHERE request_id = $4`,
        [renewal.rows[0].proposed_end_date, uploadedDocument.data, admin_note.trim(), requestId]
      );
      return { success: true };
    });
    if (result.error) return res.status(result.statusCode).json({ error: result.error });
    res.json({ message: 'ส่งร่างสัญญาให้ผู้เช่าแล้ว รอลงนามและอัปโหลดกลับ' });
  } catch (error) {
    console.error('Error sending renewal agreement:', error);
    res.status(500).json({ error: 'ไม่สามารถส่งสัญญาให้ผู้เช่าได้' });
  }
};

exports.uploadSignedRenewal = async (req, res) => {
  const requestId = Number(req.params.id);
  const signedDocument = validateUploadedDocument(req.body?.signed_document);
  if (!Number.isInteger(requestId) || requestId < 1) {
    return res.status(400).json({ error: 'หมายเลขคำขอต่อสัญญาไม่ถูกต้อง' });
  }
  if (!signedDocument) {
    return res.status(400).json({ error: 'กรุณาแนบเอกสารที่ลงนามแล้วเป็น PDF หรือรูป ขนาดไม่เกิน 10MB' });
  }
  try {
    const tenantId = req.user?.user_id || req.user?.id;
    const result = await db.query(
      `UPDATE m_contract_renewal_requests
       SET signed_document = $1, status = 'awaiting_admin'
       WHERE request_id = $2 AND tenant_id = $3 AND status = 'awaiting_tenant'
         AND agreement_document IS NOT NULL AND proposed_end_date IS NOT NULL
       RETURNING request_id`,
      [signedDocument.data, requestId, tenantId]
    );
    if (!result.rows.length) {
      return res.status(409).json({ error: 'ยังไม่มีร่างสัญญาให้เซ็น หรือส่งเอกสารลงนามแล้ว' });
    }
    res.json({ message: 'ส่งสัญญาที่ลงนามแล้วให้ผู้ดูแลตรวจสอบ' });
  } catch (error) {
    console.error('Error uploading signed renewal agreement:', error);
    res.status(500).json({ error: 'ไม่สามารถส่งสัญญาที่ลงนามแล้วได้' });
  }
};

exports.completeRenewal = async (req, res) => {
  const requestId = Number(req.params.id);
  if (!Number.isInteger(requestId) || requestId < 1) {
    return res.status(400).json({ error: 'หมายเลขคำขอต่อสัญญาไม่ถูกต้อง' });
  }
  try {
    const result = await db.withTransaction(async (client) => {
      const renewal = await client.query(
        `SELECT rr.request_id, rr.contract_id, rr.proposed_end_date::text AS proposed_end_date,
                rr.status, rr.signed_document
         FROM m_contract_renewal_requests rr
         WHERE rr.request_id = $1
         FOR UPDATE`,
        [requestId]
      );
      if (!renewal.rows.length) return { error: 'ไม่พบคำขอต่อสัญญา', statusCode: 404 };
      const request = renewal.rows[0];
      if (request.status !== 'awaiting_admin' || !request.signed_document || !request.proposed_end_date) {
        return { error: 'ผู้เช่ายังไม่ได้ส่งสัญญาที่ลงนามแล้ว', statusCode: 409 };
      }
      const contract = await client.query(
        `UPDATE m_contracts SET end_date = $1::date
         WHERE contract_id = $2 AND status = 'active' AND end_date < $1::date
         RETURNING contract_id`,
        [request.proposed_end_date, request.contract_id]
      );
      if (!contract.rows.length) return { error: 'สัญญาปัจจุบันไม่สามารถต่ออายุได้แล้ว', statusCode: 409 };
      await client.query(
        `UPDATE m_contract_renewal_requests SET status = 'approved'
         WHERE request_id = $1`,
        [requestId]
      );
      return { success: true };
    });
    if (result.error) return res.status(result.statusCode).json({ error: result.error });
    res.json({ message: 'ตรวจเอกสารแล้วและบันทึกการต่อสัญญาเรียบร้อย' });
  } catch (error) {
    console.error('Error finalizing renewal agreement:', error);
    res.status(500).json({ error: 'ไม่สามารถยืนยันการต่อสัญญาได้' });
  }
};
