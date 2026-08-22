import React, { useState, useEffect } from 'react';
import styles from './Tabs.module.css';

const LiveClassTab = () => {
    const [isLive, setIsLive] = useState(false);
    const [link, setLink] = useState('');
    const [statusMsg, setStatusMsg] = useState({ type: '', message: '' });
    const [loading, setLoading] = useState(true);

    const fetchStatus = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/live-class`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setIsLive(data.isActive);
                if (data.link) setLink(data.link);
            }
        } catch (err) {
            console.error("Failed to fetch live class status", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
    }, []);

    const updateStatus = async (active) => {
        if (active && !link.trim()) {
            setStatusMsg({ type: 'error', message: 'Please enter a valid meeting link (Google Meet, Zoom, etc.)' });
            return;
        }

        try {
            setStatusMsg({ type: '', message: '' });
            const token = localStorage.getItem('token');
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/live-class`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ isActive: active, link: active ? link : '' })
            });

            if (res.ok) {
                setIsLive(active);
                if (!active) setLink('');
                setStatusMsg({ type: 'success', message: active ? 'Live class started successfully!' : 'Live class ended.' });
            } else {
                throw new Error('Failed to update status');
            }
        } catch (err) {
            setStatusMsg({ type: 'error', message: err.message });
        }
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div className={`glass-panel animate-fade-in`} style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ color: 'var(--color-primary)', marginBottom: '1.5rem', textAlign: 'center' }}>Manage Live Class</h2>
            
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem', textAlign: 'center' }}>
                Start a live class by pasting your Google Meet, Zoom, or MS Teams link below. Students will be notified and can join directly from their dashboard.
            </p>

            {statusMsg.message && (
                <div className={statusMsg.type === 'error' ? styles.errorMsg : styles.successMsg} style={{ marginBottom: '1.5rem' }}>
                    {statusMsg.message}
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <label style={{ fontWeight: 'bold' }}>Meeting Link</label>
                <input 
                    type="url" 
                    placeholder="https://meet.google.com/abc-defg-hij" 
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    className={styles.inputField}
                    disabled={isLive}
                />

                {!isLive ? (
                    <button onClick={() => updateStatus(true)} className={styles.submitBtn} style={{ marginTop: '1rem' }}>
                        ▶ Start Live Class
                    </button>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                        <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '1rem', borderRadius: '8px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #10b981' }}>
                            🔴 Class is Currently LIVE
                        </div>
                        <a href={link} target="_blank" rel="noopener noreferrer" className={styles.secondaryCta} style={{ textAlign: 'center', textDecoration: 'none', display: 'block', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--color-primary)', color: 'var(--color-primary)' }}>
                            Open Meeting in New Tab
                        </a>
                        <button onClick={() => updateStatus(false)} className={styles.submitBtn} style={{ background: 'var(--color-danger)' }}>
                            ■ End Live Class
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LiveClassTab;
