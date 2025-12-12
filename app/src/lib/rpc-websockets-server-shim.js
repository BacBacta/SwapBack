/**
 * Server-side shim for rpc-websockets compatibility
 * Uses the 'ws' package directly for Node.js environments
 */

const EventEmitter = require('events');

let WebSocketImpl;

try {
  // Use native ws package for Node.js
  WebSocketImpl = require('ws');
} catch {
  // Fallback: provide a mock for edge cases
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

// Create a wrapper that matches rpc-websockets Client interface
class WebSocketClient extends EventEmitter {
  constructor(address, options = {}) {
    super();
    this.socket = new WebSocketImpl(address, options);
    
    this.socket.on('open', () => this.emit('open'));
    this.socket.on('close', (code, reason) => this.emit('close', code, reason));
    this.socket.on('error', (error) => this.emit('error', error));
    this.socket.on('message', (data) => this.emit('message', data));
  }
  
  close(code, reason) {
    this.socket.close(code, reason);
  }
  
  send(data, options, callback) {
    const cb = callback || (typeof options === 'function' ? options : () => {});
    try {
      this.socket.send(data, options);
      cb();
    } catch (error) {
      cb(error);
    }
  }
  
  addEventListener(type, listener, options) {
    if (this.socket.addEventListener) {
      this.socket.addEventListener(type, listener, options);
    } else {
      this.on(type, listener);
    }
  }
}

// Factory function matching rpc-websockets default export
function createWebSocket(address, options) {
  return new WebSocketClient(address, options);
}

module.exports = createWebSocket;
module.exports.default = createWebSocket;
module.exports.Client = WebSocketClient;
module.exports.WebSocketClient = WebSocketClient;
