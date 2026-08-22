import React, { useState, useEffect } from 'react';
import styles from './Tabs.module.css';

const NoticesTab = () => {
    const [view, setView] = useState('list'); // 'list' or 'add'

    // List State
    const [notices, setNotices] = useState([]);
    const [loading, setLoading] = useState(true);

    // Form State
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [status, setStatus] = useState({ type: '', message: '' });

    useEffect(() => {
        if (view === 'list') {
            fetchNotices();
        }
    }, [view]);

    const fetchNotices = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/notices`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (res.ok) setNotices(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this?')) return;
        if (!window.confirm("Are you sure you want to delete this notice?")) return;
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/notices/${id}`, {
                method: `DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                setNotices(notices.filter(n => n.id !== id));
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus({ type: 'loading', message: 'Posting notice...' });

        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/notices`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ title, content })
            });

            const data = await res.json();
            if (res.ok) {
                setStatus({ type: 'success', message: 'Notice posted successfully!' });
                setTitle('');
                setContent('');
                setTimeout(() => setView('list'), 1500);
            } else {
                setStatus({ type: 'error', message: data.error || 'Failed to post notice' });
            }
        } catch (err) {
            setStatus({ type: 'error', message: err.message });
        }
    };

    if (view === 'list') {
        return (
            <div className={`glass-panel animate-fade-in`} style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <h2 style={{ color: 'var(--color-primary)', margin: 0 }}>Notice Board</h2>
                    <button onClick={() => setView('add')} className={styles.submitBtn} style={{ margin: 0 }}>
                        + Create Notice
                    </button>
                </div>

                {loading ? <p>Loading...</p> : notices.length === 0 ? <p>No notices found.</p> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {notices.map((n) => (
                            <div key={n.id} style={{ background: 'var(--color-surface-hover)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                    <h3 style={{ margin: 0, color: 'var(--color-text-main)' }}>{n.title}</h3>
                                    <div>
                                        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginRight: '1rem' }}>
                                            {new Date(n.created_at).toLocaleDateString()}
                                        </span>
                                        <button onClick={() => handleDelete(n.id)} style={{ background: 'transparent', color: 'var(--color-danger)', border: 'none', cursor: 'pointer', padding: 0 }}>Delete</button>
                                    </div>
                                </div>
                                <p style={{ margin: 0, color: 'var(--color-text-muted)', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{n.content}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className={`glass-panel ${styles.tabContainer} animate-fade-in`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ margin: 0 }}>Create New Notice</h2>
                <button onClick={() => setView('list')} className={styles.logoutBtn} style={{ background: 'transparent', color: 'var(--color-text-muted)', border: 'none' }}>Cancel</button>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.inputGroup}>
                    <label>Notice Title</label>
                    <input required type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Important Schedule Change" />
                </div>
                <div className={styles.inputGroup}>
                    <label>Announcement Details</label>
                    <textarea required value={content} onChange={e => setContent(e.target.value)} rows="5" placeholder="Write your announcement here..."></textarea>
                </div>

                {status.message && (
                    <div className={status.type === 'error' ? styles.errorMsg : styles.successMsg}>
                        {status.message}
                    </div>
                )}

                <button type="submit" disabled={status.type === 'loading'} className={styles.submitBtn}>
                    Post Announcement
                </button>
            </form>
        </div>
    );
};

export default NoticesTab;
