const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const dbPath = require.resolve('../src/config/db');
const previousDbModule = require.cache[dbPath];
let currentUser;
let databaseError;
let lastQuery;

const mockDbModule = new Module(dbPath, module);
mockDbModule.filename = dbPath;
mockDbModule.loaded = true;
mockDbModule.exports = {
  query: async (query, [username]) => {
    lastQuery = { query, username };
    if (databaseError) throw databaseError;
    return { rows: currentUser?.username === username ? [currentUser] : [] };
  }
};

require.cache[dbPath] = mockDbModule;
const { login } = require('../src/controllers/authController');
if (previousDbModule) require.cache[dbPath] = previousDbModule;
else delete require.cache[dbPath];

process.env.JWT_SECRET = 'test-secret-for-auth-controller';

async function submitLogin(username, password) {
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };

  await login({ body: { username, password } }, response);
  return response;
}

async function makeUser({
  username = 'admin-test',
  password = 'correct-password',
  status = 'approved',
  role = 'admin',
  passwordHash
} = {}) {
  return {
    user_id: 17,
    username,
    password: passwordHash || await bcrypt.hash(password, 4),
    status,
    role
  };
}

test.beforeEach(() => {
  databaseError = null;
  lastQuery = null;
});

test('login rejects an unknown username', async () => {
  currentUser = await makeUser();

  const response = await submitLogin('missing-user', 'correct-password');

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.body, { message: 'User not found' });
});

test('login rejects an incorrect password', async () => {
  currentUser = await makeUser();

  const response = await submitLogin('admin-test', 'wrong-password');

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, { message: 'Invalid password' });
});

test('login blocks accounts pending KYC review', async () => {
  currentUser = await makeUser({ status: 'pending', role: 'tenant' });

  const response = await submitLogin('admin-test', 'correct-password');

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.message, 'บัญชีของคุณอยู่ระหว่างรอผู้ดูแลระบบตรวจสอบเอกสาร (KYC)');
});

test('login blocks accounts rejected by KYC review', async () => {
  currentUser = await makeUser({ status: 'rejected', role: 'tenant' });

  const response = await submitLogin('admin-test', 'correct-password');

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.message, 'เอกสารของคุณไม่ผ่านการอนุมัติ กรุณาติดต่อผู้ดูแลหอพัก');
});

test('login returns a valid token and user details for an approved admin', async () => {
  currentUser = await makeUser();

  const response = await submitLogin('admin-test', 'correct-password');

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.message, 'Login successful');
  assert.deepEqual(response.body.user, {
    user_id: 17,
    username: 'admin-test',
    role: 'admin'
  });
  const tokenPayload = jwt.verify(response.body.token, process.env.JWT_SECRET);
  assert.equal(tokenPayload.user_id, 17);
  assert.equal(tokenPayload.role, 'admin');
});

test('login returns a valid token for an approved tenant', async () => {
  currentUser = await makeUser({ role: 'tenant' });

  const response = await submitLogin('admin-test', 'correct-password');

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.user.role, 'tenant');
});

test('login treats usernames as case-sensitive', async () => {
  currentUser = await makeUser({ username: 'Admin-Test' });

  const response = await submitLogin('admin-test', 'correct-password');

  assert.equal(response.statusCode, 404);
  assert.equal(response.body.message, 'User not found');
});

test('login does not trim whitespace from usernames', async () => {
  currentUser = await makeUser();

  const response = await submitLogin(' admin-test ', 'correct-password');

  assert.equal(response.statusCode, 404);
  assert.equal(response.body.message, 'User not found');
});

test('login treats passwords as case-sensitive', async () => {
  currentUser = await makeUser({ password: 'Correct-Password' });

  const response = await submitLogin('admin-test', 'correct-password');

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.message, 'Invalid password');
});

test('login preserves leading and trailing password whitespace', async () => {
  currentUser = await makeUser({ password: ' correct-password ' });

  const response = await submitLogin('admin-test', 'correct-password');

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.message, 'Invalid password');
});

test('login accepts a password containing Thai characters', async () => {
  const password = 'รหัสผ่าน-ทดสอบ-123';
  currentUser = await makeUser({ password });

  const response = await submitLogin('admin-test', password);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.user.username, 'admin-test');
});

test('login checks password before revealing pending KYC status', async () => {
  currentUser = await makeUser({ status: 'pending', role: 'tenant' });

  const response = await submitLogin('admin-test', 'wrong-password');

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, { message: 'Invalid password' });
});

test('login checks password before revealing rejected KYC status', async () => {
  currentUser = await makeUser({ status: 'rejected', role: 'tenant' });

  const response = await submitLogin('admin-test', 'wrong-password');

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, { message: 'Invalid password' });
});

test('login allows an active account with valid credentials', async () => {
  currentUser = await makeUser({ status: 'active' });

  const response = await submitLogin('admin-test', 'correct-password');

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.user.role, 'admin');
});

test('login response does not expose password hash or internal account fields', async () => {
  currentUser = await makeUser();

  const response = await submitLogin('admin-test', 'correct-password');

  assert.deepEqual(Object.keys(response.body.user).sort(), ['role', 'user_id', 'username']);
  assert.equal(JSON.stringify(response.body).includes(currentUser.password), false);
  assert.equal(JSON.stringify(response.body).includes('approved'), false);
});

test('login token expires after one day', async () => {
  currentUser = await makeUser();

  const response = await submitLogin('admin-test', 'correct-password');
  const tokenPayload = jwt.verify(response.body.token, process.env.JWT_SECRET);

  assert.equal(tokenPayload.exp - tokenPayload.iat, 24 * 60 * 60);
});

test('login token cannot be verified with a different secret', async () => {
  currentUser = await makeUser();

  const response = await submitLogin('admin-test', 'correct-password');

  assert.throws(() => jwt.verify(response.body.token, 'different-secret'));
});

test('login passes username as a parameterized database value', async () => {
  currentUser = await makeUser({ username: "' OR 1=1 --" });

  const response = await submitLogin("' OR 1=1 --", 'correct-password');

  assert.equal(response.statusCode, 200);
  assert.match(lastQuery.query, /username\s*=\s*\$1/);
  assert.equal(lastQuery.username, "' OR 1=1 --");
});

test('login returns a server error when the database query fails', async () => {
  currentUser = await makeUser();
  databaseError = new Error('database unavailable');

  const response = await submitLogin('admin-test', 'correct-password');

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, { error: 'database unavailable' });
});

test('login rejects a malformed stored password hash as an invalid password', async () => {
  currentUser = await makeUser({ passwordHash: 'not-a-bcrypt-hash' });

  const response = await submitLogin('admin-test', 'correct-password');

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, { message: 'Invalid password' });
});

test('login treats an empty username as an unknown username', async () => {
  currentUser = await makeUser();

  const response = await submitLogin('', 'correct-password');

  assert.equal(response.statusCode, 404);
  assert.equal(response.body.message, 'User not found');
  assert.equal(lastQuery.username, '');
});
