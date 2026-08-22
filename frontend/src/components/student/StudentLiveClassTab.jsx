import React, { useState, useEffect } from 'react';
import styles from '../teacher/Tabs.module.css';

const StudentLiveClassTab = () => {
    const [isLive, setIsLive] = useState(false);
    const [link, setLink] = useState('');
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
        // Poll every 10 seconds to check if class started
        const interval = setInterval(fetchStatus, 10000);
        return () => clearInterval(interval);
    }, []);

    if (loading) return <div>Loading...</div>;

    return (
        <div className={`glass-panel animate-fade-in`} style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
            <h2 style={{ color: 'var(--color-primary)', marginBottom: '1.5rem' }}>Live Class</h2>
            
            {isLive ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }}>
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '1rem', borderRadius: '8px', fontWeight: 'bold', border: '1px solid #10b981', width: '100%' }}>
                        🔴 A Live Class is currently in progress!
                    </div>
                    
                    <a 
                        href={link} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className={styles.submitBtn} 
                        style={{ textDecoration: 'none', display: 'inline-block', padding: '1rem 2rem', fontSize: '1.2rem', background: 'var(--color-primary)' }}
                    >
                        Join Live Class
                    </a>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                        Clicking the button will open the meeting (Google Meet, Zoom, etc.) in a new tab.
                    </p>
                </div>
            ) : (
                <div style={{ padding: '3rem 1rem', color: 'var(--color-text-muted)' }}>
                    <p style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>No Live Class is currently running.</p>
                    <p style={{ fontSize: '0.9rem' }}>When the teacher starts a class, a join button will appear here automatically.</p>
                </div>
            )}
        </div>
    );
};

export default StudentLiveClassTab;
