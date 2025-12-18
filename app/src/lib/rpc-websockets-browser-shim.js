/**
 * Shim for `rpc-websockets/dist/lib/client/websocket.browser`.
 * 
 * This replaces the original module that uses `new window.WebSocket()` which fails
 * in SSR/Node contexts. This shim safely uses the global WebSocket or falls back.
 * 
 * CRITICAL: This module must work when called BOTH with and without `new`:
 *   - new WebSocketShim(url) - called as constructor
 *   - WebSocketShim(url) - called as factory function
 */

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });

const { EventEmitter } = require('events');

// Safely get WebSocket - check multiple locations
function getWebSocketConstructor() {
  // Browser environment
  if (typeof window !== 'undefined' && window.WebSocket) {
    return window.WebSocket;
  }
  // Web Worker or other global context
  if (typeof globalThis !== 'undefined' && globalThis.WebSocket) {
    return globalThis.WebSocket;
  }
  // Direct global (some bundlers)
  if (typeof WebSocket !== 'undefined') {
    return WebSocket;
  }
  // Node.js - try to load 'ws' package
  try {
    return require('ws');
  } catch (e) {
    return null;
  }
}

/**
 * WebSocketBrowserImpl - matches the interface of the original rpc-websockets module
 */
class WebSocketBrowserImpl extends EventEmitter {
  constructor(address, options, protocols) {
    super();
    
    const WebSocketImpl = getWebSocketConstructor();
    
    if (!WebSocketImpl) {
      // No WebSocket available - emit error asynchronously
      console.warn('[rpc-websockets-shim] No WebSocket implementation available');
      setTimeout(() => {
        this.emit('error', new Error('WebSocket is not available in this environment'));
      }, 0);
      this.socket = null;
      return;
    }
    
    try {
      // Create the actual WebSocket
      // Note: browser WebSocket doesn't accept options object, only protocols
      this.socket = new WebSocketImpl(address, protocols);
      
      this.socket.onopen = () => this.emit('open');
      this.socket.onmessage = (event) => this.emit('message', event.data);
      this.socket.onerror = (error) => this.emit('error', error);
      this.socket.onclose = (event) => {
        this.emit('close', event.code, event.reason);
      };
    } catch (error) {
      console.error('[rpc-websockets-shim] Error creating WebSocket:', error);
      this.socket = null;
      setTimeout(() => this.emit('error', error), 0);
    }
  }
  
  /**
   * Sends data through a websocket connection
   */
  send(data, optionsOrCallback, callback) {
    const cb = callback || optionsOrCallback || (() => {});
    try {
      if (this.socket && this.socket.readyState === 1) { // OPEN
        this.socket.send(data);
        if (typeof cb === 'function') cb();
      } else {
        if (typeof cb === 'function') cb(new Error('WebSocket is not open'));
      }
    } catch (error) {
      if (typeof cb === 'function') cb(error);
    }
  }
  
  /**
   * Closes an underlying socket
   */
  close(code, reason) {
    if (this.socket) {
      this.socket.close(code, reason);
    }
  }
  
  /**
   * Add event listener (proxy to socket)
   */
  addEventListener(type, listener, options) {
    if (this.socket && this.socket.addEventListener) {
      this.socket.addEventListener(type, listener, options);
    }
  }
  
  /**
   * Get ready state
   */
  get readyState() {
    return this.socket ? this.socket.readyState : 3; // CLOSED
  }
}

/**
 * Universal WebSocket factory that works with or without 'new'
 * This is the magic that fixes "WebSocket constructor: 'new' is required"
 */
function WebSocketFactory(address, options, protocols) {
  // If called with 'new', 'this' will be an instance of WebSocketFactory
  // If called without 'new', 'this' will be undefined or global
  if (this instanceof WebSocketFactory) {
    // Called with 'new' - delegate to WebSocketBrowserImpl
    const instance = new WebSocketBrowserImpl(address, options, protocols);
    // Copy all properties to 'this' (though it's better to just return the instance)
    Object.assign(this, instance);
    Object.setPrototypeOf(this, Object.getPrototypeOf(instance));
    return this;
  } else {
    // Called without 'new' - return a new instance
    return new WebSocketBrowserImpl(address, options, protocols);
  }
}

// Make WebSocketFactory work like a class
WebSocketFactory.prototype = Object.create(WebSocketBrowserImpl.prototype);
WebSocketFactory.prototype.constructor = WebSocketFactory;

// Static properties
WebSocketFactory.CONNECTING = 0;
WebSocketFactory.OPEN = 1;
WebSocketFactory.CLOSING = 2;
WebSocketFactory.CLOSED = 3;

// Match original module's export structure
exports.default = WebSocketFactory;
// rpc-websockets expects a named export `w3cwebsocket`
exports.w3cwebsocket = WebSocketFactory;
exports.WebSocketBrowserImpl = WebSocketBrowserImpl;

// CommonJS default export pattern - use WebSocketFactory as the main export
module.exports = WebSocketFactory;
module.exports.default = WebSocketFactory;
module.exports.w3cwebsocket = WebSocketFactory;
module.exports.WebSocketBrowserImpl = WebSocketBrowserImpl;
