import React, { useState, useEffect } from 'react';

const InstallPwaPopup = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPopup, setShowPopup] = useState(false);

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
        <button style={styles.closeBtn} onClick={handleClose}>×</button>
        <div style={styles.content}>
          <img src="/logo.jpeg" alt="App Logo" style={styles.logo} />
          <div>
            <h3 style={styles.title}>Install A.P Coaching</h3>
            <p style={styles.text}>Install our app on your device for quick access and a better experience!</p>
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
    top: '10px',
    right: '15px',
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.5)',
    fontSize: '24px',
    cursor: 'pointer',
    padding: '0',
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
  }
};

export default InstallPwaPopup;
