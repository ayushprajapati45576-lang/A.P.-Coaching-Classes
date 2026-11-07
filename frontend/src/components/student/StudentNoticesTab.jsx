import React, { useState, useEffect } from 'react';
import styles from '../teacher/Tabs.module.css';

const StudentNoticesTab = () => {
    const [notices, setNotices] = useState([]);
    const [loading, setLoading] = useState(true);

    const getBackendUrl = () => {
        if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
            return 'http://localhost:5000';
        }
        return import.meta.env.VITE_BACKEND_URL || '';
    };

    useEffect(() => {
        fetchNotices();
        localStorage.setItem('last_seen_notice_time', new Date().toISOString());
    }, []);

    const fetchNotices = async () => {
        try {
            const res = await fetch(getBackendUrl() + '/api/notices', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (res.ok) setNotices(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`glass-panel animate-fade-in`} style={{ padding: '1.5rem' }}>
            <h2 style={{ color: 'var(--color-primary)', marginBottom: '1.5rem', margin: 0 }}>Notice Board</h2>
            
            {loading ? <p>Loading...</p> : notices.length === 0 ? <p>No announcements yet.</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {notices.map((n) => (
                        <div key={n.id} style={{ background: 'var(--color-surface-hover)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                <h3 style={{ margin: 0, color: 'var(--color-text-main)' }}>{n.title}</h3>
                                <span style={{ fontSize: '0.85rem', color: 'var(--color-primary)' }}>
                                    {new Date(n.created_at).toLocaleDateString()}
                                </span>
                            </div>
                            <p style={{ margin: 0, color: 'var(--color-text-muted)', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{n.content}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default StudentNoticesTab;
