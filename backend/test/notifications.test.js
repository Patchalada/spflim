const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { initSocket, getIO } = require('../src/config/socket');

test('Socket.io initializes and attaches to HTTP server', () => {
  const dummyServer = http.createServer();
  const io = initSocket(dummyServer);
  assert.ok(io, 'io instance should be created');
  assert.equal(getIO(), io, 'getIO should return the initialized instance');
  dummyServer.close();
});
