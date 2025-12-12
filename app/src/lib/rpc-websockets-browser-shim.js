/**
 * Shim for `rpc-websockets/dist/lib/client/websocket.browser`.
 * Provides a minimal WebSocket factory that works in browsers and Node runtimes
 * used by Next.js without pulling the native `ws` dependency when unavailable.
 * 
 * This class can be called with `new` (as a constructor) or as a regular function.
 */

const { EventEmitter } = require('events');

let WebSocketImpl = typeof WebSocket !== 'undefined' ? WebSocket : null;
try {
  if (!WebSocketImpl) {
    // eslint-disable-next-line global-require
    WebSocketImpl = require('ws');
  }
} catch (err) {
  WebSocketImpl = null;
}

function normalizeUrl(address) {
  if (typeof address !== 'string') {
    throw new TypeError(`Invalid WebSocket URL: ${address}`);
  }

  let url = address.trim();
  if (/^https?:\/\//i.test(url)) {
    url = url.replace(/^http/i, 'ws');
  }

  if (!/^wss?:\/\//i.test(url)) {
    throw new TypeError(`Invalid WebSocket URL: ${address}`);
  }

  return url;
}

function createInMemorySocket() {
  const emitter = new EventEmitter();
  const shim = {
    readyState: 1,
    send: () => {},
    close: (code, reason) => {
      shim.readyState = 3;
      queueMicrotask(() => emitter.emit('close', { code, reason }));
    },
    addEventListener: emitter.on.bind(emitter),
    removeEventListener: emitter.off ? emitter.off.bind(emitter) : emitter.removeListener.bind(emitter),
  };

  queueMicrotask(() => emitter.emit('open'));
  emitter.on('message', () => {});

  return shim;
}

/**
 * WebSocket wrapper class that can be instantiated with `new`.
 * This fixes the "WebSocket constructor: 'new' is required" error.
 */
class WebSocketWrapper {
  constructor(address, protocols, options) {
    const url = normalizeUrl(address);

    if (!WebSocketImpl) {
      // Return in-memory socket for environments without WebSocket
      const socket = createInMemorySocket();
      Object.assign(this, socket);
      return;
    }

    // Create the actual WebSocket
    const socket = new WebSocketImpl(url, protocols);
    
    // Copy all properties and methods to this instance
    this.readyState = socket.readyState;
    this._socket = socket;
    
    // Proxy common properties
    Object.defineProperty(this, 'readyState', {
      get: () => socket.readyState,
    });
    Object.defineProperty(this, 'bufferedAmount', {
      get: () => socket.bufferedAmount || 0,
    });
    Object.defineProperty(this, 'extensions', {
      get: () => socket.extensions || '',
    });
    Object.defineProperty(this, 'protocol', {
      get: () => socket.protocol || '',
    });
    Object.defineProperty(this, 'url', {
      get: () => socket.url || url,
    });
    Object.defineProperty(this, 'binaryType', {
      get: () => socket.binaryType,
      set: (value) => { socket.binaryType = value; },
    });
    
    // Bind methods
    this.send = socket.send.bind(socket);
    this.close = socket.close.bind(socket);
    this.ping = socket.ping ? socket.ping.bind(socket) : () => {};
    this.pong = socket.pong ? socket.pong.bind(socket) : () => {};
    
    // Handle addEventListener - normalize for both browser and Node ws
    if (socket.addEventListener) {
      this.addEventListener = socket.addEventListener.bind(socket);
      this.removeEventListener = socket.removeEventListener.bind(socket);
    } else if (socket.on) {
      this.addEventListener = (event, handler) => {
        socket.on(event, (...args) => handler(...args));
      };
      this.removeEventListener = socket.off 
        ? socket.off.bind(socket) 
        : socket.removeListener.bind(socket);
    }
    
    // Event handler properties
    ['onopen', 'onclose', 'onerror', 'onmessage'].forEach(prop => {
      Object.defineProperty(this, prop, {
        get: () => socket[prop],
        set: (value) => { socket[prop] = value; },
      });
    });
  }
}

// Static constants
WebSocketWrapper.CONNECTING = 0;
WebSocketWrapper.OPEN = 1;
WebSocketWrapper.CLOSING = 2;
WebSocketWrapper.CLOSED = 3;

// Factory function for backward compatibility
function createWebSocket(address, options = {}, protocols) {
  try {
    return new WebSocketWrapper(address, protocols, options);
  } catch (error) {
    const emitter = new EventEmitter();
    queueMicrotask(() => emitter.emit('error', error));
    emitter.addEventListener = emitter.on.bind(emitter);
    emitter.removeEventListener = emitter.off ? emitter.off.bind(emitter) : emitter.removeListener.bind(emitter);
    emitter.send = () => {};
    emitter.close = () => {};
    return emitter;
  }
}

// Export the class as default (for `new` usage)
module.exports = WebSocketWrapper;
module.exports.default = WebSocketWrapper;
module.exports.WebSocket = WebSocketImpl;
module.exports.createWebSocket = createWebSocket;
