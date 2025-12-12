/**
 * Server-side shim for rpc-websockets compatibility
 * Uses the 'ws' package directly for Node.js environments
 */

// Minimal shim mapping directly to the ws implementation for server builds
let WebSocketImpl;
try {
  WebSocketImpl = require('ws');
} catch {
  WebSocketImpl = class MockWebSocket {
    constructor() {
      console.warn('[rpc-websockets-server-shim] WebSocket not available');
    }
    close() {}
    send() {}
    addEventListener() {}
    removeEventListener() {}
  };
}

module.exports = WebSocketImpl;
module.exports.default = WebSocketImpl;
module.exports.Client = WebSocketImpl;
module.exports.WebSocketClient = WebSocketImpl;
