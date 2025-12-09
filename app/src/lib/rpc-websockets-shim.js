/**
 * Shim for rpc-websockets compatibility
 * 
 * Some dependencies (like older @solana/web3.js internals) try to import from
 * 'rpc-websockets/dist/lib/client' or 'rpc-websockets/dist/lib/client/websocket.browser'
 * 
 * This shim provides a compatible WebSocket client implementation.
 */

// Try to load from the actual rpc-websockets package
let Client;
try {
  // rpc-websockets v7.x uses .cjs extension
  Client = require('rpc-websockets/dist/lib/client/websocket.browser.cjs');
} catch (e1) {
  try {
    // Fallback to main module
    const rpcWebsockets = require('rpc-websockets');
    Client = rpcWebsockets.Client || rpcWebsockets;
  } catch (e2) {
    // Provide a minimal WebSocket wrapper as last resort
    Client = class WebSocketClient {
      constructor(address, options = {}) {
        this.socket = new WebSocket(address);
        this.socket.onopen = () => this.emit && this.emit('open');
        this.socket.onclose = () => this.emit && this.emit('close');
        this.socket.onerror = (e) => this.emit && this.emit('error', e);
        this.socket.onmessage = (msg) => this.emit && this.emit('message', msg.data);
      }
      close() { this.socket.close(); }
      send(data) { this.socket.send(data); }
    };
  }
}

module.exports = Client;
module.exports.Client = Client;
module.exports.default = Client;
