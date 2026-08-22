import React, { useState, useEffect } from 'react';
import styles from '../teacher/Tabs.module.css';

const StudentFeesTab = () => {
    const [fees, setFees] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchFees();
    }, []);

    const fetchFees = async () => {
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/student/fees`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (res.ok) setFees(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`glass-panel animate-fade-in`} style={{ padding: '1.5rem' }}>
            <h2 style={{ color: 'var(--color-primary)', marginBottom: '1.5rem', margin: 0 }}>Fee Records</h2>
            
            {loading ? <p>Loading...</p> : fees.length === 0 ? <p>No fee records found.</p> : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Amount</th>
                                <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Due Date</th>
                                <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Status</th>
                                <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Paid Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {fees.map((f) => (
                                <tr key={f.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                    <td style={{ padding: '0.75rem', fontSize: '1.1rem', fontWeight: 'bold' }}>₹{f.amount}</td>
                                    <td style={{ padding: '0.75rem' }}>{new Date(f.due_date).toLocaleDateString()}</td>
                                    <td style={{ padding: '0.75rem' }}>
                                        <span style={{ 
                                            padding: '4px 8px', 
                                            borderRadius: '4px', 
                                            fontSize: '0.8rem', 
                                            background: f.status === 'paid' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                            color: f.status === 'paid' ? '#10b981' : 'var(--color-danger)'
                                        }}>
                                            {f.status.toUpperCase()}
                                        </span>
                                    </td>
                                    <td style={{ padding: '0.75rem' }}>{f.paid_date ? new Date(f.paid_date).toLocaleDateString() : '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default StudentFeesTab;
