import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import styles from '../teacher/Tabs.module.css';
import FeeReceiptModal from '../common/FeeReceiptModal';
import { Calendar, AlertCircle, CheckCircle2, Clock, Printer } from 'lucide-react';

// Smart backend URL: auto-detects localhost to prevent calling old production Vercel
const getBackendUrl = () => {
    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        return 'http://localhost:5000';
    }
    return import.meta.env.VITE_BACKEND_URL || '';
};

const StudentFeesTab = () => {
    const { user } = useAuth();
    const [fees, setFees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedReceipt, setSelectedReceipt] = useState(null);

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

    const handlePrintRecordReceipt = (f) => {
        const studentInfo = f.student_info || user || {};
        const total = Number(f.amount) || stats.totalAssigned || 0;
        const paidNow = Number(f.paid_amount) || (f.status === 'paid' ? total : 0);
        const due = f.due_amount !== undefined && f.due_amount !== null 
            ? Number(f.due_amount) 
            : (f.status === 'paid' ? 0 : Math.max(0, total - paidNow));

        setSelectedReceipt({
            receiptNo: `APC-REC-${f.id ? String(f.id).slice(0, 8).toUpperCase() : Date.now().toString().slice(-6)}`,
            date: f.paid_date || new Date().toISOString(),
            studentName: studentInfo.full_name || user?.full_name || 'Student',
            fatherName: studentInfo.father_name || user?.father_name || '-',
            className: studentInfo.class_name || user?.class_name || '-',
            phone: studentInfo.phone || user?.phone || '-',
            email: user?.email || '',
            currentPaid: paidNow,
            totalFees: total,
            totalPaid: stats.totalPaid,
            remainingFees: due,
            dueDate: f.due_date,
            paymentMode: 'Cash / Online UPI'
        });
    };

    const handlePrintSummaryReceipt = () => {
        const studentInfo = (fees.length > 0 && fees[0].student_info) ? fees[0].student_info : (user || {});
        const paidFeesList = fees.filter(f => Number(f.paid_amount) > 0 || f.status === 'paid').map(f => ({
            id: f.id,
            payment_date: f.paid_date || f.created_at,
            amount: Number(f.paid_amount) || Number(f.amount) || 0
        }));

        setSelectedReceipt({
            receiptNo: `APC-SUMMARY-${Date.now().toString().slice(-6)}`,
            date: new Date().toISOString(),
            studentName: studentInfo.full_name || user?.full_name || 'Student',
            fatherName: studentInfo.father_name || user?.father_name || '-',
            className: studentInfo.class_name || user?.class_name || '-',
            phone: studentInfo.phone || user?.phone || '-',
            email: user?.email || '',
            currentPaid: stats.totalPaid,
            totalFees: stats.totalAssigned,
            totalPaid: stats.totalPaid,
            remainingFees: stats.totalDue,
            dueDate: stats.nextDueDate,
            paymentMode: 'Consolidated Fee Summary',
            isStatement: true,
            paymentsList: paidFeesList
        });
    };

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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <h3 style={{ color: 'var(--color-text-main)', margin: 0, fontSize: '1.15rem' }}>Fee Records History</h3>
                    {stats.totalPaid > 0 && (
                        <button
                            onClick={handlePrintSummaryReceipt}
                            style={{
                                background: 'linear-gradient(135deg, var(--color-primary, #E08A00), var(--color-secondary, #1F7FD1))',
                                color: '#ffffff',
                                border: 'none',
                                padding: '0.45rem 1rem',
                                borderRadius: '8px',
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: '0 2px 8px rgba(31, 127, 209, 0.25)'
                            }}
                        >
                            <Printer size={15} /> Print Fee Summary (रसीद)
                        </button>
                    )}
                </div>

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
                                    <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>RECEIPT</th>
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
                                            <td style={{ padding: '0.75rem' }}>
                                                {(paid > 0 || f.status === 'paid') ? (
                                                    <button
                                                        onClick={() => handlePrintRecordReceipt(f)}
                                                        style={{
                                                            background: 'rgba(31, 127, 209, 0.12)',
                                                            border: '1px solid rgba(31, 127, 209, 0.3)',
                                                            color: 'var(--color-secondary, #1F7FD1)',
                                                            padding: '0.3rem 0.75rem',
                                                            borderRadius: '6px',
                                                            fontSize: '0.8rem',
                                                            fontWeight: '600',
                                                            cursor: 'pointer',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '4px'
                                                        }}
                                                        title="Print Fee Receipt"
                                                    >
                                                        <Printer size={13} /> Print Receipt
                                                    </button>
                                                ) : (
                                                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>-</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Fee Receipt Printable Modal */}
            <FeeReceiptModal
                isOpen={Boolean(selectedReceipt)}
                onClose={() => setSelectedReceipt(null)}
                receipt={selectedReceipt}
            />
        </div>
    );
};

export default StudentFeesTab;
