import React, { useState, useEffect } from 'react';

const InstallPwaPopup = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPopup, setShowPopup] = useState(false);
  const [isIosPrompt, setIsIosPrompt] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      // Add a slight delay so it doesn't pop up instantly on fast load
      setTimeout(() => setShowPopup(true), 2000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // If the app is already installed, we shouldn't show it
    window.addEventListener('appinstalled', () => {
      setShowPopup(false);
      setDeferredPrompt(null);
    });

    // iOS Detection
    const isIos = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      return /iphone|ipad|ipod/.test(userAgent);
    };
    
    // Check if already installed on iOS
    const isInStandaloneMode = () => ('standalone' in window.navigator) && (window.navigator.standalone);

    if (isIos() && !isInStandaloneMode()) {
      setIsIosPrompt(true);
      setTimeout(() => setShowPopup(true), 2000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    // We no longer need the prompt. Clear it up.
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
            <p style={styles.text}>Install our app on your device for quick access and a better experience!</p>
          </div>
        </div>
        <div style={styles.actions}>
          {isIosPrompt ? (
            <div style={styles.iosInstruction}>
              Tap the <strong>Share</strong> icon <span style={{ fontSize: '20px', verticalAlign: 'middle' }}>⍐</span> below and select <strong>Add to Home Screen</strong> <span style={{ fontSize: '20px', verticalAlign: 'middle' }}>➕</span>.
            </div>
          ) : (
            <button style={styles.installBtn} onClick={handleInstallClick}>
              Install App
            </button>
          )}
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
    backgroundColor: '#0A2342', // Matching theme color
    color: '#ffffff',
    padding: '20px',
    borderRadius: '16px',
    maxWidth: '400px',
    width: '100%',
    position: 'relative',
    boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  closeBtn: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    background: 'rgba(255, 255, 255, 0.1)',
    border: 'none',
    color: '#ffffff',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: '0',
    transition: 'background 0.2s',
    zIndex: 10,
  },
  content: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    marginBottom: '15px',
  },
  logo: {
    width: '50px',
    height: '50px',
    borderRadius: '10px',
    objectFit: 'cover',
  },
  title: {
    margin: '0 0 5px 0',
    fontSize: '16px',
    fontWeight: '600',
  },
  text: {
    margin: '0',
    fontSize: '13px',
    color: 'rgba(255,255,255,0.8)',
    lineHeight: '1.4',
  },
  actions: {
    display: 'flex',
    justifyContent: 'stretch',
  },
  installBtn: {
    flex: 1,
    padding: '10px',
    backgroundColor: '#FF7B00', // Primary color
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  iosInstruction: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: '12px',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#ffffff',
    lineHeight: '1.5',
    textAlign: 'center',
    width: '100%',
  }
};

export default InstallPwaPopup;
