const test = require('node:test');
const assert = require('node:assert/strict');
const supportController = require('../src/controllers/supportController');

test('createTicket rejects invalid inputs', async () => {
  const cases = [
    { body: {}, expected: 'กรุณากรอกหัวข้อ ประเภท และรายละเอียดปัญหาให้ถูกต้อง' },
    { body: { category: '', subject: 'test', description: 'test' }, expected: 'กรุณากรอกหัวข้อ ประเภท และรายละเอียดปัญหาให้ถูกต้อง' },
    { body: { category: 'ซ่อมบำรุง', subject: '', description: 'test' }, expected: 'กรุณากรอกหัวข้อ ประเภท และรายละเอียดปัญหาให้ถูกต้อง' },
    { body: { category: 'ซ่อมบำรุง', subject: 'test', description: '' }, expected: 'กรุณากรอกหัวข้อ ประเภท และรายละเอียดปัญหาให้ถูกต้อง' },
    { body: { category: 'ซ่อมบำรุง', subject: 'test', description: 'test', priority: 'invalid_priority' }, expected: 'กรุณากรอกหัวข้อ ประเภท และรายละเอียดปัญหาให้ถูกต้อง' }
  ];

  for (const c of cases) {
    let responseStatus = null;
    let responseBody = null;
    const req = {
      body: c.body,
      user: { user_id: 1, role: 'tenant' }
    };
    const res = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(data) {
        responseBody = data;
        return this;
      }
    };

    await supportController.createTicket(req, res);
    assert.equal(responseStatus, 400);
    assert.equal(responseBody.error, c.expected);
  }
});

test('closeMyTicket rejects invalid ticket ID', async () => {
  let responseStatus = null;
  let responseBody = null;
  const req = {
    params: { id: 'invalid-id' },
    user: { user_id: 1, role: 'tenant' }
  };
  const res = {
    status(code) {
      responseStatus = code;
      return this;
    },
    json(data) {
      responseBody = data;
      return this;
    }
  };

  await supportController.closeMyTicket(req, res);
  assert.equal(responseStatus, 400);
  assert.equal(responseBody.error, 'หมายเลขเคสไม่ถูกต้อง');
});
