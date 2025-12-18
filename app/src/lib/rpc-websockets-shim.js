/**
 * Minimal shim for rpc-websockets to keep Next.js build happy.
 * Avoids self-requiring the bundled module (which caused "Class extends value undefined")
 * and provides a lightweight EventEmitter-based client backed by `ws` when available.
 */

const { EventEmitter } = require('events');

// Reuse the browser shim so both environments share the same normalization logic
const browserWebSocketFactory = require('./rpc-websockets-browser-shim');

const DEFAULT_URL = 'ws://localhost:8080';

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

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function attachEvent(target, eventName, handler) {
  if (!target) return;
  if (typeof target.addEventListener === 'function') {
    target.addEventListener(eventName, handler);
  } else if (typeof target.on === 'function') {
    target.on(eventName, handler);
  }
}

function defaultFactory(address, options) {
  // browserWebSocketFactory is now a factory function that returns WebSocketBrowserImpl instance
  // It matches the original rpc-websockets/dist/lib/client/websocket.browser.cjs interface
  if (typeof browserWebSocketFactory === 'function') {
    try {
      return browserWebSocketFactory(address, options);
    } catch (e) {
      console.warn('[rpc-websockets-shim] Factory error:', e);
    }
  }
  
  // browserWebSocketFactory might also be an object with .default property
  if (browserWebSocketFactory && typeof browserWebSocketFactory.default === 'function') {
    try {
      return browserWebSocketFactory.default(address, options);
    } catch (e) {
      console.warn('[rpc-websockets-shim] Factory.default error:', e);
    }
  }

  if (!WebSocketImpl) {
    return null;
  }

  return new WebSocketImpl(address, options?.protocols);
}

class CommonClient extends EventEmitter {
  constructor(arg1, arg2, arg3) {
    super();

    const hasFactoryArg = typeof arg1 === 'function';
    this.webSocketFactory = hasFactoryArg ? arg1 : null;
    this.url = hasFactoryArg
      ? (typeof arg2 === 'string' && arg2.length ? arg2 : DEFAULT_URL)
      : (typeof arg1 === 'string' && arg1.length ? arg1 : DEFAULT_URL);
    const optionCandidate = hasFactoryArg ? arg3 : arg2;
    this.options = isPlainObject(optionCandidate) ? { ...optionCandidate } : {};
    this.socket = null;

    if (this.options.autoconnect !== false) {
      this.connect();
    }
  }

  connect() {
    if (this.socket) return;

    let socketInstance;
    try {
      const factory = this.webSocketFactory || defaultFactory;
      // Some callers pass a WebSocket *constructor* as the "factory".
      // The original rpc-websockets client instantiates it with `new`.
      // If we call it as a plain function, browsers throw:
      //   "WebSocket constructor: 'new' is required"
      try {
        socketInstance = factory(this.url, this.options);
      } catch (innerError) {
        const message = innerError instanceof Error ? innerError.message : String(innerError);
        if (typeof factory === 'function' && /'new' is required/i.test(message)) {
          socketInstance = new factory(this.url, this.options?.protocols);
        } else {
          throw innerError;
        }
      }
    } catch (error) {
      queueMicrotask(() => this.emit('error', error));
      return;
    }

    if (!socketInstance) {
      queueMicrotask(() => this.emit('open'));
      return;
    }

    attachEvent(socketInstance, 'open', (...args) => this.emit('open', ...args));
    attachEvent(socketInstance, 'close', (...args) => {
      this.socket = null;
      this.emit('close', ...args);
    });
    attachEvent(socketInstance, 'error', (err) => this.emit('error', err));
    attachEvent(socketInstance, 'message', (msg) => {
      const data = msg?.data ?? msg;
      this.emit('message', data);
    });

    this.socket = socketInstance;
  }

  close(code, reason) {
    if (this.socket && this.socket.close) {
      this.socket.close(code, reason);
    }
    this.socket = null;
    this.emit('close');
  }

  send(data) {
    if (this.socket && typeof this.socket.send === 'function') {
      this.socket.send(data);
    }
  }
}

module.exports = CommonClient;
module.exports.Client = CommonClient;
module.exports.CommonClient = CommonClient;
module.exports.WebSocket = WebSocketImpl;
module.exports.default = CommonClient;
