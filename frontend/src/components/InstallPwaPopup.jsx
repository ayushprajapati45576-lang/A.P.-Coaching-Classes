import React, { useState, useEffect } from 'react';

const InstallPwaPopup = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    // Explicitly block iOS / iPhone - do not show install prompt on iOS devices
    const isIos = () => {
      if (typeof window === 'undefined') return false;
      const userAgent = window.navigator.userAgent.toLowerCase();
      return /iphone|ipad|ipod/.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    };

    if (isIos()) {
      return; // Do nothing on iOS
    }

    const handleBeforeInstallPrompt = (e) => {
      // Prevent the default mini-infobar
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Show install popup for Android / supported devices
      setTimeout(() => setShowPopup(true), 2000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // If the app is already installed, hide popup
    window.addEventListener('appinstalled', () => {
      setShowPopup(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Show the native install prompt on Android
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    await deferredPrompt.userChoice;
    
    // Clear prompt and close popup
    setDeferredPrompt(null);
    setShowPopup(false);
  };

  const handleClose = () => {
    setShowPopup(false);
  };

  if (!showPopup) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.popup} className="glass-panel animate-fade-in">
        <button style={styles.closeBtn} onClick={handleClose} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 13L13 1M1 1L13 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div style={styles.content}>
          <img src="/logo.jpeg" alt="App Logo" style={styles.logo} />
          <div>
            <h3 style={styles.title}>Install A.P COACHING CLASSES</h3>
            <p style={styles.text}>Install our app on your Android device for quick access and a better experience!</p>
          </div>
        </div>
        <div style={styles.actions}>
          <button style={styles.installBtn} onClick={handleInstallClick}>
            Install App
          </button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    bottom: '20px',
    left: '0',
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '0 20px',
  },
  popup: {
    backgroundColor: '#1B2240',
    color: '#ffffff',
    padding: '20px',
    borderRadius: '16px',
    maxWidth: '400px',
    width: '100%',
    position: 'relative',
    boxShadow: '0 12px 30px rgba(27, 34, 64, 0.25)',
    border: '1px solid rgba(255,255,255,0.15)',
  },
  closeBtn: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    background: 'transparent',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '16px',
  },
  logo: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    objectFit: 'cover',
  },
  title: {
    margin: '0 0 4px 0',
    fontSize: '1rem',
    fontWeight: '600',
  },
  text: {
    margin: 0,
    fontSize: '0.85rem',
    color: '#cbd5e1',
    lineHeight: '1.4',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  installBtn: {
    backgroundColor: 'var(--color-primary, #ff7b00)',
    color: '#ffffff',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '0.9rem',
    cursor: 'pointer',
    width: '100%',
    transition: 'background-color 0.2s',
  },
};

export default InstallPwaPopup;
