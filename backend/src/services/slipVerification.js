const mockResults = {
  approved: {
    status: 'verified',
    message: 'ผลจำลอง: ตรวจสลิปผ่าน'
  },
  rejected: {
    status: 'rejected',
    message: 'ผลจำลอง: ตรวจสลิปไม่ผ่าน กรุณาตรวจสอบรูปและยอดเงิน'
  },
  duplicate: {
    status: 'duplicate',
    message: 'ผลจำลอง: พบสลิปนี้ในรายการที่ตรวจแล้ว'
  },
  review: {
    status: 'manual_review',
    message: 'โหมดจำลอง: ส่งสลิปให้แอดมินตรวจสอบด้วยตนเอง'
  }
};

function amountInSatang(amount) {
  const parsed = Number(amount);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

function mapSlipOkError(error) {
  const code = Number(error?.code);
  const message = typeof error?.message === 'string' ? error.message : 'SlipOK ตรวจสอบสลิปไม่สำเร็จ';
  if (code === 1012) return { status: 'duplicate', message, slipData: error.data };
  if (code === 1010 || code === 1009) return { status: 'manual_review', message };
  if ([1005, 1006, 1007, 1008, 1011, 1013, 1014].includes(code)) {
    return { status: 'rejected', message, slipData: error.data };
  }
  if ([1001, 1002, 1003, 1004, 1015].includes(code)) {
    const configurationMessage = code === 1002
      ? 'API Key ของ SlipOK ไม่ถูกต้อง'
      : code === 1001
        ? 'ไม่พบ Branch ID ของ SlipOK'
        : message;
    const configurationError = new Error(configurationMessage);
    configurationError.statusCode = 502;
    throw configurationError;
  }
  const serviceError = new Error(message);
  serviceError.statusCode = 502;
  throw serviceError;
}

async function callSlipOk({ image, mimeType, amount, apiKey, branchId }) {
  const form = new FormData();
  const imageBuffer = Buffer.from(image.split(',').pop(), 'base64');
  const extensionByMimeType = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp'
  };
  form.append('files', new Blob([imageBuffer], { type: mimeType }), `payment-slip.${extensionByMimeType[mimeType]}`);
  form.append('amount', String(Number(amount)));
  form.append('log', 'true');

  let response;
  try {
    response = await fetch(
      `https://api.slipok.com/api/line/apikey/${encodeURIComponent(branchId)}`,
      {
        method: 'POST',
        headers: { 'x-authorization': apiKey },
        body: form,
        signal: AbortSignal.timeout(20000)
      }
    );
  } catch (error) {
    const serviceError = new Error('เชื่อมต่อ SlipOK ไม่สำเร็จ กรุณาลองใหม่ภายหลัง');
    serviceError.statusCode = 502;
    serviceError.cause = error;
    throw serviceError;
  }

  let body;
  try {
    body = await response.json();
  } catch (error) {
    const serviceError = new Error('SlipOK ส่งข้อมูลตอบกลับไม่ถูกต้อง');
    serviceError.statusCode = 502;
    serviceError.cause = error;
    throw serviceError;
  }

  if (!response.ok || body.success !== true || body.data?.success !== true) {
    const upstreamCode = body.code ?? body.data?.code ?? null;
    const upstreamMessage = body.message ?? body.data?.message ?? null;
    console.warn('[SlipOK] API rejected slip verification', {
      httpStatus: response.status,
      code: upstreamCode,
      message: typeof upstreamMessage === 'string' ? upstreamMessage.slice(0, 300) : null
    });
    return mapSlipOkError(body);
  }

  const slipData = body.data;
  if (amountInSatang(slipData.amount) !== amountInSatang(amount)) {
    return { status: 'rejected', message: 'ยอดเงินในสลิปไม่ตรงกับยอดบิล', slipData };
  }
  if (typeof slipData.transRef !== 'string' || !slipData.transRef.trim()) {
    const serviceError = new Error('ผลตรวจ SlipOK ไม่มีเลขอ้างอิงรายการ จึงไม่สามารถยืนยันการชำระได้');
    serviceError.statusCode = 502;
    throw serviceError;
  }

  return {
    status: 'verified',
    message: 'SlipOK ตรวจสอบสลิปผ่านและยอดเงินตรงกับบิล',
    slipData
  };
}

async function verifySlip({ mode, mockResult, isProduction, image, mimeType, amount }) {
  if (mode === 'manual') {
    return {
      status: 'manual_review',
      message: 'ยังไม่ได้เปิดการตรวจสลิป กรุณารอแอดมินตรวจสอบ'
    };
  }

  if (mode === 'mock') {
    if (isProduction) {
      throw new Error('ปิดการใช้งานโหมดจำลองการตรวจสลิปใน production');
    }

    const result = mockResults[mockResult || 'review'];
    if (!result) {
      throw new Error('SLIPOK_MOCK_RESULT ต้องเป็น approved, rejected, duplicate หรือ review');
    }

    return { ...result, simulated: true };
  }

  if (mode !== 'api') {
    throw new Error('SLIPOK_MODE ต้องเป็น manual, mock หรือ api');
  }

  const apiKey = process.env.SLIPOK_API_KEY;
  const branchId = process.env.SLIPOK_BRANCH_ID;
  if (!apiKey || !branchId) {
    const configurationError = new Error('กรุณาตั้งค่า SLIPOK_API_KEY และ SLIPOK_BRANCH_ID ใน backend/.env');
    configurationError.statusCode = 503;
    throw configurationError;
  }
  if (!image || !mimeType || amountInSatang(amount) === null) {
    throw new Error('ข้อมูลรูปสลิปหรือยอดเงินสำหรับตรวจสอบไม่ถูกต้อง');
  }

  return callSlipOk({ image, mimeType, amount, apiKey, branchId });
}

module.exports = { verifySlip, amountInSatang };
