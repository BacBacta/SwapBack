'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface MobileWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPhantom: () => void;
  onSelectSolflare: () => void;
}

export function MobileWalletModal({ 
  isOpen, 
  onClose, 
  onSelectPhantom, 
  onSelectSolflare 
}: MobileWalletModalProps) {
  const portalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Create a dedicated portal container
    if (!portalRef.current) {
      const portalDiv = document.createElement('div');
      portalDiv.id = 'mobile-wallet-modal-portal';
      document.body.appendChild(portalDiv);
      portalRef.current = portalDiv;
    }

    return () => {
      // Cleanup on unmount
      if (portalRef.current && portalRef.current.parentNode) {
        portalRef.current.parentNode.removeChild(portalRef.current);
        portalRef.current = null;
      }
    };
  }, []);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = `-${window.scrollY}px`;
    } else {
      const scrollY = document.body.style.top;
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0', 10) * -1);
      }
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
    };
  }, [isOpen]);

  if (!isOpen || !portalRef.current) return null;

  const modalContent = (
    <div
      id="wallet-modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: '0px',
        left: '0px',
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.97)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2147483647, // Maximum z-index value
        padding: '20px',
        boxSizing: 'border-box',
        touchAction: 'none',
      }}
    >
      <div
        id="wallet-modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#0d0d1a',
          borderRadius: '20px',
          border: '2px solid #10b981',
          width: '100%',
          maxWidth: '320px',
          boxShadow: '0 0 60px rgba(16, 185, 129, 0.3)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ 
          padding: '20px', 
          borderBottom: '1px solid #1f2937',
          position: 'relative',
        }}>
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '15px',
              right: '15px',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: 'white',
              fontSize: '18px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
          <h2 style={{ 
            color: 'white', 
            fontSize: '20px', 
            fontWeight: 'bold',
            textAlign: 'center',
            margin: 0,
          }}>
            Connect Wallet
          </h2>
          <p style={{ 
            color: '#9ca3af', 
            fontSize: '13px',
            textAlign: 'center',
            marginTop: '6px',
            marginBottom: 0,
          }}>
            Select your Solana wallet
          </p>
        </div>

        {/* Wallet Buttons */}
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Phantom */}
          <button
            onClick={onSelectPhantom}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              width: '100%',
              padding: '14px 16px',
              borderRadius: '14px',
              border: 'none',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              color: 'white',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '600',
              boxShadow: '0 4px 20px rgba(139, 92, 246, 0.4)',
            }}
          >
            <span style={{ fontSize: '26px' }}>👻</span>
            <span style={{ flex: 1, textAlign: 'left' }}>Phantom</span>
            <span style={{ fontSize: '18px' }}>→</span>
          </button>

          {/* Solflare */}
          <button
            onClick={onSelectSolflare}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              width: '100%',
              padding: '14px 16px',
              borderRadius: '14px',
              border: 'none',
              background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
              color: 'white',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '600',
              boxShadow: '0 4px 20px rgba(249, 115, 22, 0.4)',
            }}
          >
            <span style={{ fontSize: '26px' }}>🔥</span>
            <span style={{ flex: 1, textAlign: 'left' }}>Solflare</span>
            <span style={{ fontSize: '18px' }}>→</span>
          </button>
        </div>

        {/* Info */}
        <div style={{ padding: '0 16px 16px' }}>
          <div style={{
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '10px',
            padding: '10px 12px',
          }}>
            <p style={{ 
              color: '#10b981', 
              fontSize: '11px', 
              textAlign: 'center',
              margin: 0,
            }}>
              💡 The wallet app will open automatically
            </p>
          </div>
        </div>

        {/* Cancel */}
        <div style={{ padding: '0 16px 16px' }}>
          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: 'rgba(255,255,255,0.05)',
              color: '#9ca3af',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, portalRef.current);
}
