import React, { useState, useEffect, useMemo } from 'react';
import styles from '../teacher/Tabs.module.css';
import { Calendar, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

// Smart backend URL: auto-detects localhost to prevent calling old production Vercel
const getBackendUrl = () => {
    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        return 'http://localhost:5000';
    }
    return import.meta.env.VITE_BACKEND_URL || '';
};

const StudentFeesTab = () => {
    const [fees, setFees] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchFees();
    }, []);

    const fetchFees = async () => {
        try {
            const res = await fetch(getBackendUrl() + '/api/student/fees', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const contentType = res.headers.get('content-type') || '';
            if (res.ok && contentType.includes('application/json')) {
                const data = await res.json();
                setFees(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const isOverdue = (dueDate, status, dueAmount) => {
        if (!dueDate) return false;
        if (status === 'paid' || Number(dueAmount) <= 0) return false;
        const today = new Date().toISOString().split('T')[0];
        const due = new Date(dueDate).toISOString().split('T')[0];
        return due < today;
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return '-';
            return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch {
            return '-';
        }
    };

    const stats = useMemo(() => {
        let totalAssigned = 0;
        let totalPaid = 0;
        let totalDue = 0;
        let nextDueDate = null;

        fees.forEach(f => {
            const total = Number(f.amount) || 0;
            const due = f.due_amount !== undefined && f.due_amount !== null 
                ? Number(f.due_amount) 
                : (f.status === 'paid' ? 0 : total);
            const paid = f.paid_amount !== undefined && f.paid_amount !== null 
                ? Number(f.paid_amount) 
                : (f.status === 'paid' ? total : Math.max(0, total - due));

            totalAssigned += total;
            totalPaid += paid;
            totalDue += due;

            if (due > 0 && f.due_date) {
                if (!nextDueDate || new Date(f.due_date) < new Date(nextDueDate)) {
                    nextDueDate = f.due_date;
                }
            }
        });

        return { totalAssigned, totalPaid, totalDue, nextDueDate };
    }, [fees]);

    return (
        <div className={`animate-fade-in`} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
                <h2 style={{ color: 'var(--color-primary)', margin: '0 0 0.25rem 0' }}>Fee Details & Due Status</h2>
                <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                    View your fee history, payments made, pending due fees, and upcoming due dates.
                </p>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', padding: '1.25rem', borderRadius: '14px', color: '#fff', boxShadow: '0 8px 16px rgba(59, 130, 246, 0.25)' }}>
                    <span style={{ fontSize: '0.85rem', opacity: 0.9, fontWeight: '500' }}>Total Fee</span>
                    <h3 style={{ fontSize: '1.8rem', margin: '0.25rem 0 0 0', fontWeight: '700' }}>₹{stats.totalAssigned.toLocaleString('en-IN')}</h3>
                </div>
                <div style={{ background: 'linear-gradient(135deg, #10b981, #059669)', padding: '1.25rem', borderRadius: '14px', color: '#fff', boxShadow: '0 8px 16px rgba(16, 185, 129, 0.25)' }}>
                    <span style={{ fontSize: '0.85rem', opacity: 0.9, fontWeight: '500' }}>Fee Paid (जमा राशि)</span>
                    <h3 style={{ fontSize: '1.8rem', margin: '0.25rem 0 0 0', fontWeight: '700' }}>₹{stats.totalPaid.toLocaleString('en-IN')}</h3>
                </div>
                <div style={{
                    background: stats.totalDue > 0 ? 'linear-gradient(135deg, #f97316, #ea580c)' : 'linear-gradient(135deg, #10b981, #059669)',
                    padding: '1.25rem',
                    borderRadius: '14px',
                    color: '#fff',
                    boxShadow: stats.totalDue > 0 ? '0 8px 16px rgba(249, 115, 22, 0.25)' : '0 8px 16px rgba(16, 185, 129, 0.25)'
                }}>
                    <span style={{ fontSize: '0.85rem', opacity: 0.9, fontWeight: '500' }}>Due Fees (बाकी फीस)</span>
                    <h3 style={{ fontSize: '1.8rem', margin: '0.25rem 0 0 0', fontWeight: '700' }}>₹{stats.totalDue.toLocaleString('en-IN')}</h3>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', opacity: 0.85 }}>
                        {stats.totalDue > 0 ? 'Payment required' : 'All dues cleared!'}
                    </p>
                </div>
                <div style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', padding: '1.25rem', borderRadius: '14px', color: '#fff', boxShadow: '0 8px 16px rgba(139, 92, 246, 0.25)' }}>
                    <span style={{ fontSize: '0.85rem', opacity: 0.9, fontWeight: '500' }}>Upcoming Due Date</span>
                    <h3 style={{ fontSize: '1.4rem', margin: '0.4rem 0 0 0', fontWeight: '700' }}>{stats.nextDueDate ? formatDate(stats.nextDueDate) : 'None'}</h3>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', opacity: 0.85 }}>
                        {stats.nextDueDate ? 'Last date for pending fee' : 'No pending dues'}
                    </p>
                </div>
            </div>

            {/* Fees Table */}
            <div className={`glass-panel`} style={{ padding: '1.5rem' }}>
                <h3 style={{ color: 'var(--color-text-main)', margin: '0 0 1rem 0', fontSize: '1.15rem' }}>Fee Records History</h3>

                {loading ? (
                    <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>Loading fee details...</p>
                ) : fees.length === 0 ? (
                    <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>No fee records found for your account.</p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', minWidth: '600px' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                                    <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>TOTAL FEE</th>
                                    <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>PAID AMOUNT</th>
                                    <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>DUE FEES</th>
                                    <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>DUE DATE</th>
                                    <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>STATUS</th>
                                    <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>PAID DATE</th>
                                </tr>
                            </thead>
                            <tbody>
                                {fees.map((f) => {
                                    const total = Number(f.amount) || 0;
                                    const due = f.due_amount !== undefined && f.due_amount !== null 
                                        ? Number(f.due_amount) 
                                        : (f.status === 'paid' ? 0 : total);
                                    const paid = f.paid_amount !== undefined && f.paid_amount !== null 
                                        ? Number(f.paid_amount) 
                                        : (f.status === 'paid' ? total : Math.max(0, total - due));
                                    const overdue = isOverdue(f.due_date, f.status, due);

                                    return (
                                        <tr key={f.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                            <td style={{ padding: '0.75rem', fontSize: '1rem', fontWeight: '600' }}>
                                                ₹{total.toLocaleString('en-IN')}
                                            </td>
                                            <td style={{ padding: '0.75rem', color: '#10b981', fontWeight: '500' }}>
                                                ₹{paid.toLocaleString('en-IN')}
                                            </td>
                                            <td style={{ padding: '0.75rem' }}>
                                                {due > 0 ? (
                                                    <span style={{
                                                        padding: '4px 8px',
                                                        borderRadius: '6px',
                                                        fontSize: '0.85rem',
                                                        fontWeight: '700',
                                                        background: overdue ? 'rgba(239, 68, 68, 0.15)' : 'rgba(249, 115, 22, 0.15)',
                                                        color: overdue ? '#ef4444' : '#f97316'
                                                    }}>
                                                        ₹{due.toLocaleString('en-IN')} Due
                                                    </span>
                                                ) : (
                                                    <span style={{
                                                        padding: '4px 8px',
                                                        borderRadius: '6px',
                                                        fontSize: '0.85rem',
                                                        fontWeight: '600',
                                                        background: 'rgba(16, 185, 129, 0.15)',
                                                        color: '#10b981'
                                                    }}>
                                                        ₹0 (Cleared)
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ padding: '0.75rem' }}>
                                                {due > 0 ? (
                                                    <div>
                                                        <span style={{ color: overdue ? '#ef4444' : 'inherit', fontWeight: overdue ? '600' : 'normal' }}>
                                                            {formatDate(f.due_date)}
                                                        </span>
                                                        {overdue && (
                                                            <div style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 'bold' }}>
                                                                ⚠️ Overdue
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span style={{ color: 'var(--color-text-muted)' }}>-</span>
                                                )}
                                            </td>
                                            <td style={{ padding: '0.75rem' }}>
                                                {due === 0 || f.status === 'paid' ? (
                                                    <span style={{
                                                        padding: '4px 8px',
                                                        borderRadius: '4px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 'bold',
                                                        background: 'rgba(16, 185, 129, 0.15)',
                                                        color: '#10b981'
                                                    }}>
                                                        PAID
                                                    </span>
                                                ) : overdue ? (
                                                    <span style={{
                                                        padding: '4px 8px',
                                                        borderRadius: '4px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 'bold',
                                                        background: 'rgba(239, 68, 68, 0.15)',
                                                        color: '#ef4444'
                                                    }}>
                                                        OVERDUE
                                                    </span>
                                                ) : (
                                                    <span style={{
                                                        padding: '4px 8px',
                                                        borderRadius: '4px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 'bold',
                                                        background: 'rgba(245, 158, 11, 0.15)',
                                                        color: '#f59e0b'
                                                    }}>
                                                        PENDING
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>
                                                {f.paid_date ? formatDate(f.paid_date) : '-'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StudentFeesTab;
