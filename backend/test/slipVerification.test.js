const test = require('node:test');
const assert = require('node:assert/strict');
const { verifySlip, amountInSatang } = require('../src/services/slipVerification');

test('manual mode leaves payment for admin review', async () => {
  assert.deepEqual(await verifySlip({ mode: 'manual' }), {
    status: 'manual_review',
    message: 'ยังไม่ได้เปิดการตรวจสลิป กรุณารอแอดมินตรวจสอบ'
  });
});

test('mock mode can simulate approval and marks the result as simulated', async () => {
  assert.deepEqual(await verifySlip({
    mode: 'mock',
    mockResult: 'approved',
    isProduction: false
  }), {
    status: 'verified',
    message: 'ผลจำลอง: ตรวจสลิปผ่าน',
    simulated: true
  });
});

test('mock mode supports rejection, duplicate, and manual-review cases', async () => {
  for (const result of ['rejected', 'duplicate', 'review']) {
    assert.equal((await verifySlip({
      mode: 'mock',
      mockResult: result,
      isProduction: false
    })).simulated, true);
  }
});

test('mock mode is blocked in production', async () => {
  await assert.rejects(
    verifySlip({ mode: 'mock', mockResult: 'approved', isProduction: true }),
    /ปิดการใช้งานโหมดจำลอง/
  );
});

test('unknown mode and mock result fail explicitly', async () => {
  await assert.rejects(verifySlip({ mode: 'slipok' }), /SLIPOK_MODE/);
  await assert.rejects(
    verifySlip({ mode: 'mock', mockResult: 'anything', isProduction: false }),
    /SLIPOK_MOCK_RESULT/
  );
});

test('real API mode posts a multipart image with amount and SlipOK duplicate/account checks', async () => {
  const previousFetch = global.fetch;
  const previousApiKey = process.env.SLIPOK_API_KEY;
  const previousBranchId = process.env.SLIPOK_BRANCH_ID;
  let request;
  process.env.SLIPOK_API_KEY = 'test-api-key';
  process.env.SLIPOK_BRANCH_ID = '12345';
  global.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({
      success: true,
      data: { success: true, amount: 3139, transRef: 'slip-reference-1' }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const result = await verifySlip({
      mode: 'api',
      amount: '3139.00',
      image: 'data:image/png;base64,aGVsbG8=',
      mimeType: 'image/png'
    });
    assert.equal(result.status, 'verified');
    assert.equal(result.slipData.transRef, 'slip-reference-1');
    assert.equal(request.url, 'https://api.slipok.com/api/line/apikey/12345');
    assert.equal(request.options.headers['x-authorization'], 'test-api-key');
    assert.match(request.options.body.get('files').name, /\.png$/);
    assert.equal(request.options.body.get('amount'), '3139');
    assert.equal(request.options.body.get('log'), 'true');
  } finally {
    global.fetch = previousFetch;
    if (previousApiKey === undefined) delete process.env.SLIPOK_API_KEY;
    else process.env.SLIPOK_API_KEY = previousApiKey;
    if (previousBranchId === undefined) delete process.env.SLIPOK_BRANCH_ID;
    else process.env.SLIPOK_BRANCH_ID = previousBranchId;
  }
});

test('real API mode rejects a successful SlipOK response with the wrong bill amount', async () => {
  const previousFetch = global.fetch;
  const previousApiKey = process.env.SLIPOK_API_KEY;
  const previousBranchId = process.env.SLIPOK_BRANCH_ID;
  process.env.SLIPOK_API_KEY = 'test-api-key';
  process.env.SLIPOK_BRANCH_ID = '12345';
  global.fetch = async () => new Response(JSON.stringify({
    success: true,
    data: { success: true, amount: 100, transRef: 'slip-reference-2' }
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  try {
    const result = await verifySlip({
      mode: 'api',
      amount: '3139.00',
      image: 'data:image/jpeg;base64,aGVsbG8=',
      mimeType: 'image/jpeg'
    });
    assert.equal(result.status, 'rejected');
    assert.equal(result.message, 'ยอดเงินในสลิปไม่ตรงกับยอดบิล');
  } finally {
    global.fetch = previousFetch;
    if (previousApiKey === undefined) delete process.env.SLIPOK_API_KEY;
    else process.env.SLIPOK_API_KEY = previousApiKey;
    if (previousBranchId === undefined) delete process.env.SLIPOK_BRANCH_ID;
    else process.env.SLIPOK_BRANCH_ID = previousBranchId;
  }
});

test('SlipOK failures log upstream status, code, and message without logging credentials', async () => {
  const previousFetch = global.fetch;
  const previousWarn = console.warn;
  const previousApiKey = process.env.SLIPOK_API_KEY;
  const previousBranchId = process.env.SLIPOK_BRANCH_ID;
  const logEntries = [];
  process.env.SLIPOK_API_KEY = 'test-api-key';
  process.env.SLIPOK_BRANCH_ID = '12345';
  global.fetch = async () => new Response(JSON.stringify({
    success: false,
    code: 1002,
    message: 'API Key ไม่ถูกต้อง'
  }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  console.warn = (...args) => logEntries.push(args);

  try {
    await assert.rejects(
      verifySlip({
        mode: 'api',
        amount: '100',
        image: 'data:image/png;base64,aGVsbG8=',
        mimeType: 'image/png'
      }),
      /API Key ของ SlipOK ไม่ถูกต้อง/
    );
    assert.deepEqual(logEntries, [[
      '[SlipOK] API rejected slip verification',
      { httpStatus: 401, code: 1002, message: 'API Key ไม่ถูกต้อง' }
    ]]);
    assert.equal(JSON.stringify(logEntries).includes('test-api-key'), false);
  } finally {
    global.fetch = previousFetch;
    console.warn = previousWarn;
    if (previousApiKey === undefined) delete process.env.SLIPOK_API_KEY;
    else process.env.SLIPOK_API_KEY = previousApiKey;
    if (previousBranchId === undefined) delete process.env.SLIPOK_BRANCH_ID;
    else process.env.SLIPOK_BRANCH_ID = previousBranchId;
  }
});

test('amount comparison rounds to satang', () => {
  assert.equal(amountInSatang('3139.00'), 313900);
  assert.equal(amountInSatang(3139), 313900);
  assert.equal(amountInSatang('not a number'), null);
});
