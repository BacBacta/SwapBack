/**
 * Minimal shim for rpc-websockets to keep Next.js build happy.
 * Avoids self-requiring the bundled module (which caused "Class extends value undefined")
 * and provides a lightweight EventEmitter-based client backed by `ws` when available.
 */

const { EventEmitter } = require('events');

// Pick a WebSocket implementation if it exists (browser or the `ws` package).
let WebSocketImpl = typeof WebSocket !== 'undefined' ? WebSocket : null;
try {
  if (!WebSocketImpl) {
    // `ws` is available in the server runtime; ignore if not installed for build-only usage.
    // eslint-disable-next-line global-require
    WebSocketImpl = require('ws');
  }
} catch (err) {
  WebSocketImpl = null;
}

class CommonClient extends EventEmitter {
  constructor(url, options = {}) {
    super();
    this.url = url;
    this.options = options;
    this.socket = null;

    if (options.autoconnect !== false) {
      this.connect();
    }
  }

  connect() {
    // If no WebSocket implementation is available, emit open so callers can continue gracefully.
    if (!WebSocketImpl) {
      queueMicrotask(() => this.emit('open'));
      return;
    }

    if (this.socket) return;
    this.socket = new WebSocketImpl(this.url, this.options);

    this.socket.onopen = (...args) => this.emit('open', ...args);
    this.socket.onclose = (...args) => this.emit('close', ...args);
    this.socket.onerror = (err) => this.emit('error', err);
    this.socket.onmessage = (msg) => this.emit('message', msg.data);
  }

  close(code, reason) {
    if (this.socket && this.socket.close) {
      this.socket.close(code, reason);
    }
    this.socket = null;
    this.emit('close');
  }

  send(data) {
    if (this.socket && this.socket.readyState === this.socket.OPEN) {
      this.socket.send(data);
    }
  }
}

module.exports = CommonClient;
module.exports.Client = CommonClient;
module.exports.CommonClient = CommonClient;
module.exports.WebSocket = WebSocketImpl;
module.exports.default = CommonClient;
