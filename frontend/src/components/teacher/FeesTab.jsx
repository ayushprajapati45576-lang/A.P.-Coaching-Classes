import React, { useState, useEffect, useMemo } from 'react';
import styles from './Tabs.module.css';
import FeeReceiptModal from '../common/FeeReceiptModal';
import { Printer } from 'lucide-react';

// Safe fetch helper to completely prevent SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
const safeFetchJson = async (url, options = {}) => {
    try {
        const res = await fetch(url, options);
        const contentType = res.headers.get('content-type') || '';
        let data = null;
        if (contentType.includes('application/json')) {
            try {
                data = await res.json();
            } catch (e) {
                console.error('Failed to parse JSON:', e);
            }
        } else {
            const text = await res.text();
            console.warn(`Non-JSON response from ${url} (status ${res.status}):`, text.slice(0, 120));
        }
        return { ok: res.ok, status: res.status, data };
    } catch (err) {
        console.error(`Network error requesting ${url}:`, err);
        return { ok: false, status: 0, error: err.message, data: null };
    }
};

// Smart backend URL: auto-detects localhost to prevent calling old production Vercel
const getBackendUrl = () => {
    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        return 'http://localhost:5000';
    }
    return import.meta.env.VITE_BACKEND_URL || '';
};

const FeesTab = () => {
    const [selectedClass, setSelectedClass] = useState('10'); // Default Class 10
    const [students, setStudents] = useState([]);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);

    // Track expanded records per student
    const [expandedStudentIds, setExpandedStudentIds] = useState({});

    // Active inline form: null | { type: 'set_fees' | 'edit_fees' | 'add_payment' | 'edit_payment', studentId, payment? }
    const [activeForm, setActiveForm] = useState(null);
    const [formState, setFormState] = useState({});
    const [formError, setFormError] = useState('');
    const [formLoading, setFormLoading] = useState(false);

    // Selected receipt for printing modal
    const [selectedReceipt, setSelectedReceipt] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            await Promise.all([fetchStudents(), fetchPayments()]);
        } finally {
            setLoading(false);
        }
    };

    const fetchStudents = async () => {
        const { ok, data } = await safeFetchJson(getBackendUrl() + '/api/students', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (ok && Array.isArray(data)) {
            const sorted = data.sort((a, b) => 
                (a.full_name || '').trim().toLowerCase().localeCompare((b.full_name || '').trim().toLowerCase())
            );
            setStudents(sorted);
        }
    };

    const fetchPayments = async () => {
        const { ok, data } = await safeFetchJson(getBackendUrl() + '/api/payments', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (ok && Array.isArray(data)) {
            setPayments(data);
        } else {
            // If payments endpoint not yet deployed or available, default to empty list
            setPayments([]);
        }
    };

    // Helper: Local Today's Date String YYYY-MM-DD
    const getTodayString = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Helper: Format Money in Indian Style (₹1,00,000)
    const formatCurrency = (val) => {
        const num = Number(val) || 0;
        return '₹' + num.toLocaleString('en-IN');
    };

    // Helper: Format Date (e.g. "5 Oct 2026")
    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const datePart = String(dateStr).slice(0, 10);
        const parts = datePart.split('-');
        if (parts.length === 3) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2], 10);
            const d = new Date(year, month, day);
            if (!isNaN(d.getTime())) {
                return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            }
        }
        return datePart;
    };

    // Group payments by student_id
    const studentPaymentsMap = useMemo(() => {
        const map = {};
        payments.forEach(p => {
            const sid = p.student_id;
            if (!map[sid]) map[sid] = [];
            map[sid].push(p);
        });
        return map;
    }, [payments]);

    // Filter students belonging to the selected class
    const classStudents = useMemo(() => {
        return students
            .filter(s => String(s.class_name || s.class || '').trim() === String(selectedClass))
            .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
    }, [students, selectedClass]);

    // Total remaining for the selected class (students who have fees set)
    const classTotalRemaining = useMemo(() => {
        return classStudents.reduce((acc, s) => {
            const total = Number(s.total_fees) || 0;
            if (total <= 0) return acc;
            const sPayments = studentPaymentsMap[s.id] || [];
            const paid = sPayments.reduce((sum, p) => sum + Number(p.amount), 0);
            const remaining = Math.max(0, total - paid);
            return acc + remaining;
        }, 0);
    }, [classStudents, studentPaymentsMap]);

    // Toggle view records
    const toggleRecords = (studentId) => {
        setExpandedStudentIds(prev => ({
            ...prev,
            [studentId]: !prev[studentId]
        }));
    };

    // -------------------------------------------------------------------------
    // FORM TRIGGERS
    // -------------------------------------------------------------------------

    // Open "Set fees" or "Edit total" form
    const handleOpenFeesForm = (student) => {
        const isFirstTime = !student.total_fees || Number(student.total_fees) <= 0;
        setFormError('');
        setFormState({
            total_fees: student.total_fees ? String(student.total_fees) : '',
            fees_start_date: student.fees_start_date ? String(student.fees_start_date).slice(0, 10) : getTodayString(),
            fees_due_date: student.fees_due_date ? String(student.fees_due_date).slice(0, 10) : '',
            paid_now: '',
            paid_date: getTodayString()
        });
        setActiveForm({
            type: isFirstTime ? 'set_fees' : 'edit_fees',
            studentId: student.id
        });
    };

    // Open "+ Add payment" form
    const handleOpenAddPayment = (student) => {
        setFormError('');
        setFormState({
            amount: '',
            payment_date: getTodayString(),
            fees_due_date: student.fees_due_date ? String(student.fees_due_date).slice(0, 10) : ''
        });
        setActiveForm({
            type: 'add_payment',
            studentId: student.id
        });
    };

    // Open "Edit payment" form
    const handleOpenEditPayment = (student, payment) => {
        setFormError('');
        setFormState({
            amount: String(payment.amount),
            payment_date: payment.payment_date ? String(payment.payment_date).slice(0, 10) : getTodayString(),
            fees_due_date: student.fees_due_date ? String(student.fees_due_date).slice(0, 10) : ''
        });
        setActiveForm({
            type: 'edit_payment',
            studentId: student.id,
            payment
        });
    };

    const handleCancelForm = () => {
        setActiveForm(null);
        setFormState({});
        setFormError('');
    };

    // Print receipt for single payment
    const handlePrintPaymentReceipt = (student, payment) => {
        const studentPayments = (studentPaymentsMap[student.id] || [])
            .sort((a, b) => new Date(a.payment_date) - new Date(b.payment_date));
        const totalPaid = studentPayments.reduce((sum, p) => sum + Number(p.amount), 0);
        const totalFees = Number(student.total_fees) || 0;
        const remainingFees = Math.max(0, totalFees - totalPaid);

        setSelectedReceipt({
            receiptNo: `APC-${payment.id ? String(payment.id).slice(0, 8).toUpperCase() : Math.floor(100000 + Math.random() * 900000)}`,
            date: payment.payment_date,
            studentName: student.full_name,
            fatherName: student.father_name,
            className: student.class_name || selectedClass,
            phone: student.phone,
            email: student.users?.email,
            currentPaid: Number(payment.amount),
            totalFees,
            totalPaid,
            remainingFees,
            dueDate: student.fees_due_date,
            paymentMode: 'Cash / Online UPI'
        });
    };

    // Print consolidated fee statement receipt
    const handlePrintConsolidatedReceipt = (student, studentPayments) => {
        const totalPaid = (studentPayments || []).reduce((sum, p) => sum + Number(p.amount), 0);
        const totalFees = Number(student.total_fees) || 0;
        const remainingFees = Math.max(0, totalFees - totalPaid);
        const latestDate = studentPayments && studentPayments.length > 0 ? studentPayments[0].payment_date : getTodayString();

        setSelectedReceipt({
            receiptNo: `APC-STMT-${student.id ? String(student.id).slice(0, 8).toUpperCase() : Date.now().toString().slice(-6)}`,
            date: latestDate,
            studentName: student.full_name,
            fatherName: student.father_name,
            className: student.class_name || selectedClass,
            phone: student.phone,
            email: student.users?.email,
            currentPaid: totalPaid,
            totalFees,
            totalPaid,
            remainingFees,
            dueDate: student.fees_due_date,
            paymentMode: 'Consolidated Fee Record',
            isStatement: true,
            paymentsList: studentPayments || []
        });
    };

    // -------------------------------------------------------------------------
    // FORM SUBMISSIONS
    // -------------------------------------------------------------------------

    // Submit Set Fees / Edit Total
    const handleSaveFees = async (e, student, alreadyPaid) => {
        e.preventDefault();
        setFormError('');

        const isFirstTime = activeForm.type === 'set_fees';
        const numTotal = Number(formState.total_fees);

        if (!numTotal || numTotal <= 0) {
            setFormError('Total fees must be greater than 0');
            return;
        }
        if (!formState.fees_start_date) {
            setFormError('Fees start date is required');
            return;
        }

        const paidNow = isFirstTime && Number(formState.paid_now) > 0 ? Number(formState.paid_now) : 0;
        if (isFirstTime && paidNow > numTotal) {
            setFormError('Paid amount cannot be more than total fees');
            return;
        }
        if (isFirstTime && paidNow > 0 && !formState.paid_date) {
            setFormError('Paid date is required when initial payment is entered');
            return;
        }

        const effectivePaid = alreadyPaid + paidNow;
        if (numTotal < effectivePaid) {
            setFormError(`Total fees cannot be less than already paid (${formatCurrency(effectivePaid)})`);
            return;
        }

        const remaining = numTotal - effectivePaid;
        if (remaining > 0 && !formState.fees_due_date) {
            setFormError('Due date is required for remaining fees');
            return;
        }

        setFormLoading(true);
        try {
            const body = {
                total_fees: numTotal,
                fees_start_date: formState.fees_start_date.slice(0, 10),
                fees_due_date: remaining > 0 ? formState.fees_due_date.slice(0, 10) : null
            };

            if (isFirstTime && paidNow > 0) {
                body.initial_payment = {
                    amount: paidNow,
                    payment_date: formState.paid_date.slice(0, 10)
                };
            }

            const { ok, status, data, error } = await safeFetchJson(`${getBackendUrl()}/api/students/${student.id}/fees`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(body)
            });

            if (ok) {
                await Promise.all([fetchStudents(), fetchPayments()]);
                setActiveForm(null);
                setExpandedStudentIds(prev => ({ ...prev, [student.id]: true }));
            } else {
                setFormError(data?.error || error || (status === 404 ? 'Backend route not found (404). Please ensure the backend is running and up-to-date.' : 'Failed to update fees'));
            }
        } catch (err) {
            setFormError(err.message || 'Network error');
        } finally {
            setFormLoading(false);
        }
    };

    // Submit Add or Edit Payment
    const handleSavePayment = async (e, student, allowedMax) => {
        e.preventDefault();
        setFormError('');

        const numAmount = Number(formState.amount);
        if (!numAmount || numAmount <= 0) {
            setFormError('Amount must be greater than 0');
            return;
        }
        if (numAmount > allowedMax) {
            setFormError(`Amount cannot be more than remaining (${formatCurrency(allowedMax)})`);
            return;
        }
        if (!formState.payment_date) {
            setFormError('Payment date is required');
            return;
        }

        const remainingAfterPayment = allowedMax - numAmount;
        if (remainingAfterPayment > 0 && !formState.fees_due_date && !student.fees_due_date) {
            setFormError('Due date is required for remaining fees');
            return;
        }

        setFormLoading(true);
        try {
            const isEdit = activeForm.type === 'edit_payment';
            const url = isEdit 
                ? `${getBackendUrl()}/api/payments/${activeForm.payment.id}`
                : `${getBackendUrl()}/api/payments`;
            const method = isEdit ? 'PUT' : 'POST';

            const body = {
                amount: numAmount,
                payment_date: formState.payment_date.slice(0, 10),
                fees_due_date: remainingAfterPayment > 0 && formState.fees_due_date ? formState.fees_due_date.slice(0, 10) : null
            };

            if (!isEdit) {
                body.student_id = student.id;
            }

            const { ok, status, data, error } = await safeFetchJson(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(body)
            });

            if (ok) {
                await Promise.all([fetchStudents(), fetchPayments()]);
                setActiveForm(null);
                setExpandedStudentIds(prev => ({ ...prev, [student.id]: true }));
            } else {
                setFormError(data?.error || error || (status === 404 ? 'Backend route not found (404). Please ensure the backend is running and up-to-date.' : 'Failed to save payment'));
            }
        } catch (err) {
            setFormError(err.message || 'Network error');
        } finally {
            setFormLoading(false);
        }
    };

    // Delete Payment
    const handleDeletePayment = async (paymentId) => {
        if (!window.confirm("Delete this payment?")) return;
        try {
            const { ok, status, data, error } = await safeFetchJson(`${getBackendUrl()}/api/payments/${paymentId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (ok) {
                setPayments(prev => prev.filter(p => p.id !== paymentId));
                fetchStudents();
            } else {
                alert(data?.error || error || `Failed to delete payment (${status})`);
            }
        } catch (err) {
            console.error(err);
            alert('Failed to delete payment');
        }
    };

    const classList = ['6', '7', '8', '9', '10', '11', '12'];
    const today = getTodayString();

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Header Title */}
            <div>
                <h2 style={{ color: 'var(--color-primary)', margin: '0 0 0.25rem 0' }}>Class-wise Student Fees</h2>
                <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                    Set individual student fees and record payments directly as money arrives.
                </p>
            </div>

            {/* A) Class Selector Buttons */}
            <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
                {classList.map(cls => {
                    const isSelected = selectedClass === cls;
                    return (
                        <button
                            key={cls}
                            onClick={() => {
                                setSelectedClass(cls);
                                setActiveForm(null);
                            }}
                            style={{
                                padding: '0.55rem 1.25rem',
                                borderRadius: '8px',
                                border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                                background: isSelected ? 'var(--color-primary)' : 'var(--color-surface)',
                                color: isSelected ? '#ffffff' : 'var(--color-text-main)',
                                fontWeight: isSelected ? '700' : '500',
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                transition: 'all 0.2s ease',
                                boxShadow: isSelected ? '0 2px 8px rgba(59, 130, 246, 0.3)' : 'none'
                            }}
                        >
                            Class {cls}
                        </button>
                    );
                })}
            </div>

            {/* Summary Line under class buttons */}
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', fontWeight: '500', margin: '-0.25rem 0 0.25rem 0' }}>
                Class {selectedClass} · {classStudents.length} students · Total remaining: {formatCurrency(classTotalRemaining)}
            </div>

            {/* Student Cards List */}
            {loading ? (
                <div className="glass-panel" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    Loading students and payments...
                </div>
            ) : classStudents.length === 0 ? (
                <div className="glass-panel" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    No students in this class
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {classStudents.map(student => {
                        const totalFees = Number(student.total_fees) || 0;
                        const hasFeesSet = totalFees > 0;
                        const studentPayments = (studentPaymentsMap[student.id] || [])
                            .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));
                        const paidFees = studentPayments.reduce((sum, p) => sum + Number(p.amount), 0);
                        const remainingFees = Math.max(0, totalFees - paidFees);
                        const pctPaid = totalFees > 0 ? Math.min(100, Math.round((paidFees / totalFees) * 100)) : 0;
                        const isExpanded = Boolean(expandedStudentIds[student.id]);

                        const isOverdue = remainingFees > 0 && student.fees_due_date && String(student.fees_due_date).slice(0, 10) < today;

                        // Status Tag
                        let statusTag = { label: 'PENDING', bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' };
                        if (remainingFees === 0) {
                            statusTag = { label: 'FULLY PAID', bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: 'rgba(16, 185, 129, 0.3)' };
                        } else if (isOverdue) {
                            statusTag = { label: 'OVERDUE', bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' };
                        }

                        // Dates
                        const latestPayment = studentPayments.length > 0 ? studentPayments[0] : null;
                        const latestPaymentDate = latestPayment ? latestPayment.payment_date : null;

                        const isFormOpen = activeForm && activeForm.studentId === student.id;

                        return (
                            <div
                                key={student.id}
                                className="glass-panel"
                                style={{
                                    padding: '1.25rem',
                                    borderRadius: '12px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.85rem',
                                    background: 'var(--color-surface)',
                                    border: '1px solid var(--color-border)'
                                }}
                            >
                                {/* Card Header: Student Name on Left, Status Tag on Right */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <div style={{
                                            width: '36px',
                                            height: '36px',
                                            borderRadius: '50%',
                                            background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
                                            color: '#fff',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontWeight: 'bold',
                                            fontSize: '0.95rem',
                                            flexShrink: 0
                                        }}>
                                            {student.full_name ? student.full_name.charAt(0).toUpperCase() : 'S'}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: '600', color: 'var(--color-text-main)', fontSize: '1.05rem' }}>
                                                {student.full_name ?? 'Unknown'}
                                            </div>
                                            {student.users?.email && (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                                    {student.users.email}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {hasFeesSet && (
                                        <span style={{
                                            padding: '4px 10px',
                                            borderRadius: '12px',
                                            fontSize: '0.75rem',
                                            fontWeight: '700',
                                            letterSpacing: '0.5px',
                                            background: statusTag.bg,
                                            color: statusTag.color,
                                            border: `1px solid ${statusTag.border}`
                                        }}>
                                            {statusTag.label}
                                        </span>
                                    )}
                                </div>

                                {/* B) STATE 1: Fees NOT Set */}
                                {!hasFeesSet ? (
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '0.85rem 1rem',
                                        borderRadius: '8px',
                                        background: 'var(--color-surface-hover)',
                                        border: '1px solid var(--color-border)',
                                        flexWrap: 'wrap',
                                        gap: '0.75rem'
                                    }}>
                                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>
                                            Fees abhi set nahi hui
                                        </span>
                                        {!isFormOpen && (
                                            <button
                                                onClick={() => handleOpenFeesForm(student)}
                                                className={styles.submitBtn}
                                                style={{ margin: 0, padding: '0.45rem 1.15rem', fontSize: '0.85rem' }}
                                            >
                                                Set fees
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    /* C) STATE 2: Fees Set */
                                    <>
                                        {/* Three Columns Grid */}
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                                            gap: '1rem',
                                            padding: '0.75rem 0',
                                            borderTop: '1px solid var(--color-border)',
                                            borderBottom: '1px solid var(--color-border)'
                                        }}>
                                            {/* Column 1: Total Fees */}
                                            <div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>
                                                    Total Fees
                                                </div>
                                                <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--color-text-main)' }}>
                                                    {formatCurrency(totalFees)}
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                                    Shuru: {student.fees_start_date ? formatDate(student.fees_start_date) : '-'}
                                                </div>
                                            </div>

                                            {/* Column 2: Paid Fees */}
                                            <div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>
                                                    Paid Fees
                                                </div>
                                                <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#10b981' }}>
                                                    {formatCurrency(paidFees)}
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                                    Last paid: {latestPaymentDate ? formatDate(latestPaymentDate) : 'Abhi tak nahi'}
                                                </div>
                                            </div>

                                            {/* Column 3: Remaining Fees */}
                                            <div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>
                                                    Remaining Fees
                                                </div>
                                                <div style={{ fontSize: '1.25rem', fontWeight: '700', color: remainingFees > 0 ? '#ef4444' : 'var(--color-text-main)' }}>
                                                    {formatCurrency(remainingFees)}
                                                </div>
                                                <div style={{ fontSize: '0.8rem', marginTop: '2px' }}>
                                                    {remainingFees === 0 ? (
                                                        <span style={{ color: '#10b981', fontWeight: '600' }}>Sab clear</span>
                                                    ) : isOverdue ? (
                                                        <span style={{ color: '#ef4444', fontWeight: '600' }}>
                                                            Due thi: {formatDate(student.fees_due_date)}
                                                        </span>
                                                    ) : student.fees_due_date ? (
                                                        <span style={{ color: 'var(--color-text-muted)' }}>
                                                            Next due: {formatDate(student.fees_due_date)}
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                                                            Due date not set
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Thin Progress Bar */}
                                        <div>
                                            <div style={{
                                                width: '100%',
                                                height: '6px',
                                                borderRadius: '3px',
                                                background: 'var(--color-border)',
                                                overflow: 'hidden'
                                            }}>
                                                <div style={{
                                                    width: `${pctPaid}%`,
                                                    height: '100%',
                                                    borderRadius: '3px',
                                                    background: pctPaid === 100 ? '#10b981' : 'var(--color-primary)',
                                                    transition: 'width 0.3s ease'
                                                }} />
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', textAlign: 'right' }}>
                                                {pctPaid}% paid
                                            </div>
                                        </div>

                                        {/* Bottom Action Row */}
                                        {!isFormOpen && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', paddingTop: '0.25rem' }}>
                                                <button
                                                    onClick={() => toggleRecords(student.id)}
                                                    style={{
                                                        background: 'transparent',
                                                        border: 'none',
                                                        color: 'var(--color-primary)',
                                                        cursor: 'pointer',
                                                        fontSize: '0.85rem',
                                                        fontWeight: '600',
                                                        padding: '4px 0',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}
                                                >
                                                    {isExpanded ? `▲ Hide records (${studentPayments.length})` : `▼ View records (${studentPayments.length})`}
                                                </button>

                                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                                    {studentPayments.length > 0 && (
                                                        <button
                                                            onClick={() => handlePrintConsolidatedReceipt(student, studentPayments)}
                                                            style={{
                                                                background: 'rgba(224, 138, 0, 0.12)',
                                                                border: '1px solid rgba(224, 138, 0, 0.3)',
                                                                color: 'var(--color-primary, #E08A00)',
                                                                padding: '0.35rem 0.85rem',
                                                                borderRadius: '6px',
                                                                fontSize: '0.85rem',
                                                                fontWeight: '600',
                                                                cursor: 'pointer',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '4px'
                                                            }}
                                                            title="Print consolidated fee receipt / statement"
                                                        >
                                                            <Printer size={14} /> Receipt Statement
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleOpenFeesForm(student)}
                                                        style={{
                                                            background: 'rgba(148, 163, 184, 0.15)',
                                                            border: '1px solid var(--color-border)',
                                                            color: 'var(--color-text-main)',
                                                            padding: '0.35rem 0.85rem',
                                                            borderRadius: '6px',
                                                            fontSize: '0.85rem',
                                                            fontWeight: '500',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        Edit total
                                                    </button>
                                                    {remainingFees > 0 && (
                                                        <button
                                                            onClick={() => handleOpenAddPayment(student)}
                                                            style={{
                                                                background: 'rgba(59, 130, 246, 0.15)',
                                                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                                                color: 'var(--color-primary)',
                                                                padding: '0.35rem 0.85rem',
                                                                borderRadius: '6px',
                                                                fontSize: '0.85rem',
                                                                fontWeight: '500',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            + Add payment
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* D) INLINE FORM: "Set fees" / "Edit total" */}
                                {isFormOpen && (activeForm.type === 'set_fees' || activeForm.type === 'edit_fees') && (() => {
                                    const isFirstTime = activeForm.type === 'set_fees';
                                    const liveTotal = Number(formState.total_fees) || 0;
                                    const livePaid = isFirstTime ? (Number(formState.paid_now) || 0) : paidFees;
                                    const liveRemaining = Math.max(0, liveTotal - livePaid);

                                    return (
                                        <div style={{
                                            marginTop: '0.5rem',
                                            padding: '1rem',
                                            borderRadius: '8px',
                                            background: 'var(--color-surface-hover)',
                                            border: '1px solid var(--color-border)'
                                        }}>
                                            <h4 style={{ margin: '0 0 0.75rem 0', color: 'var(--color-text-main)' }}>
                                                {isFirstTime ? 'Set Student Fees' : 'Edit Total Fees & Due Date'}
                                            </h4>

                                            <form onSubmit={(e) => handleSaveFees(e, student, paidFees)} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                {/* Live Summary Line */}
                                                <div style={{
                                                    padding: '0.5rem 0.75rem',
                                                    background: 'var(--color-surface)',
                                                    borderRadius: '6px',
                                                    fontSize: '0.85rem',
                                                    fontWeight: '600',
                                                    color: 'var(--color-text-main)',
                                                    border: '1px solid var(--color-border)'
                                                }}>
                                                    Total {formatCurrency(liveTotal)} · Paid {formatCurrency(livePaid)} · Remaining {formatCurrency(liveRemaining)}
                                                </div>

                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                                                    <div className={styles.inputGroup}>
                                                        <label>Total Fees (कुल फीस) *</label>
                                                        <input
                                                            required
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            placeholder="e.g. 5000"
                                                            value={formState.total_fees}
                                                            onChange={e => setFormState({ ...formState, total_fees: e.target.value })}
                                                        />
                                                    </div>

                                                    <div className={styles.inputGroup}>
                                                        <label>Fees Start Date (शुरू तिथि) *</label>
                                                        <input
                                                            required
                                                            type="date"
                                                            value={formState.fees_start_date}
                                                            onChange={e => setFormState({ ...formState, fees_start_date: e.target.value })}
                                                        />
                                                    </div>
                                                </div>

                                                {/* First Time Set: Optional Initial Payment */}
                                                {isFirstTime && (
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                                                        <div className={styles.inputGroup}>
                                                            <label>Paid now (optional)</label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                placeholder="e.g. 500"
                                                                value={formState.paid_now}
                                                                onChange={e => setFormState({ ...formState, paid_now: e.target.value })}
                                                            />
                                                        </div>

                                                        {Number(formState.paid_now) > 0 && (
                                                            <div className={styles.inputGroup}>
                                                                <label>Paid Date *</label>
                                                                <input
                                                                    required
                                                                    type="date"
                                                                    value={formState.paid_date}
                                                                    onChange={e => setFormState({ ...formState, paid_date: e.target.value })}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Due date: hidden if remaining is 0 or less */}
                                                {liveRemaining > 0 && (
                                                    <div className={styles.inputGroup}>
                                                        <label>Baaki fees ki due date *</label>
                                                        <input
                                                            required
                                                            type="date"
                                                            value={formState.fees_due_date}
                                                            onChange={e => setFormState({ ...formState, fees_due_date: e.target.value })}
                                                        />
                                                    </div>
                                                )}

                                                {formError && (
                                                    <div className={styles.errorMsg} style={{ fontSize: '0.85rem', padding: '0.4rem 0.6rem' }}>
                                                        {formError}
                                                    </div>
                                                )}

                                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                                                    <button
                                                        type="submit"
                                                        disabled={formLoading}
                                                        className={styles.submitBtn}
                                                        style={{ margin: 0, padding: '0.4rem 1.25rem', fontSize: '0.85rem' }}
                                                    >
                                                        {formLoading ? 'Saving...' : 'Save'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={handleCancelForm}
                                                        style={{
                                                            background: 'transparent',
                                                            border: '1px solid var(--color-border)',
                                                            color: 'var(--color-text-muted)',
                                                            padding: '0.4rem 1rem',
                                                            borderRadius: '8px',
                                                            cursor: 'pointer',
                                                            fontSize: '0.85rem'
                                                        }}
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </form>
                                        </div>
                                    );
                                })()}

                                {/* E) INLINE FORM: "+ Add payment" / Payment Edit */}
                                {isFormOpen && (activeForm.type === 'add_payment' || activeForm.type === 'edit_payment') && (() => {
                                    const isEdit = activeForm.type === 'edit_payment';
                                    const allowedMax = isEdit
                                        ? Math.max(0, totalFees - (paidFees - Number(activeForm.payment.amount)))
                                        : remainingFees;
                                    const liveAmount = Number(formState.amount) || 0;
                                    const remainingAfter = Math.max(0, allowedMax - liveAmount);

                                    return (
                                        <div style={{
                                            marginTop: '0.5rem',
                                            padding: '1rem',
                                            borderRadius: '8px',
                                            background: 'var(--color-surface-hover)',
                                            border: '1px solid var(--color-border)'
                                        }}>
                                            <h4 style={{ margin: '0 0 0.75rem 0', color: 'var(--color-text-main)' }}>
                                                {isEdit ? 'Edit Payment Record' : 'Record New Payment'}
                                            </h4>

                                            <form onSubmit={(e) => handleSavePayment(e, student, allowedMax)} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                {/* Live summary line */}
                                                <div style={{
                                                    padding: '0.5rem 0.75rem',
                                                    background: 'var(--color-surface)',
                                                    borderRadius: '6px',
                                                    fontSize: '0.85rem',
                                                    fontWeight: '600',
                                                    color: 'var(--color-text-main)',
                                                    border: '1px solid var(--color-border)'
                                                }}>
                                                    Is payment ke baad remaining: {formatCurrency(remainingAfter)}
                                                </div>

                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                                                    <div className={styles.inputGroup}>
                                                        <label>Amount received (जमा राशि) *</label>
                                                        <input
                                                            required
                                                            type="number"
                                                            min="0.01"
                                                            step="0.01"
                                                            placeholder={`Max ${allowedMax}`}
                                                            value={formState.amount}
                                                            onChange={e => setFormState({ ...formState, amount: e.target.value })}
                                                        />
                                                    </div>

                                                    <div className={styles.inputGroup}>
                                                        <label>Payment date (भुगतान तिथि) *</label>
                                                        <input
                                                            required
                                                            type="date"
                                                            value={formState.payment_date}
                                                            onChange={e => setFormState({ ...formState, payment_date: e.target.value })}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Due Date: hide when remainingAfter becomes 0 */}
                                                {remainingAfter > 0 && (
                                                    <div className={styles.inputGroup}>
                                                        <label>Baaki fees ki due date *</label>
                                                        <input
                                                            required
                                                            type="date"
                                                            value={formState.fees_due_date}
                                                            onChange={e => setFormState({ ...formState, fees_due_date: e.target.value })}
                                                        />
                                                    </div>
                                                )}

                                                {formError && (
                                                    <div className={styles.errorMsg} style={{ fontSize: '0.85rem', padding: '0.4rem 0.6rem' }}>
                                                        {formError}
                                                    </div>
                                                )}

                                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                                                    <button
                                                        type="submit"
                                                        disabled={formLoading}
                                                        className={styles.submitBtn}
                                                        style={{ margin: 0, padding: '0.4rem 1.25rem', fontSize: '0.85rem' }}
                                                    >
                                                        {formLoading ? 'Saving...' : (isEdit ? 'Update Payment' : 'Save Payment')}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={handleCancelForm}
                                                        style={{
                                                            background: 'transparent',
                                                            border: '1px solid var(--color-border)',
                                                            color: 'var(--color-text-muted)',
                                                            padding: '0.4rem 1rem',
                                                            borderRadius: '8px',
                                                            cursor: 'pointer',
                                                            fontSize: '0.85rem'
                                                        }}
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </form>
                                        </div>
                                    );
                                })()}

                                {/* View Records Expanded Table */}
                                {hasFeesSet && isExpanded && (
                                    <div style={{
                                        marginTop: '0.5rem',
                                        padding: '0.75rem',
                                        borderRadius: '8px',
                                        background: 'var(--color-surface-hover)',
                                        border: '1px solid var(--color-border)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.5rem'
                                    }}>
                                        {studentPayments.length === 0 ? (
                                            <div style={{ textAlign: 'center', padding: '0.75rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                                                Abhi tak koi payment nahi aayi.
                                            </div>
                                        ) : (
                                            studentPayments.map(p => (
                                                <div
                                                    key={p.id}
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        flexWrap: 'wrap',
                                                        gap: '0.75rem',
                                                        padding: '0.6rem 0.75rem',
                                                        borderRadius: '6px',
                                                        background: 'var(--color-surface)',
                                                        border: '1px solid var(--color-border)'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
                                                        <span style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--color-text-main)' }}>
                                                            {formatCurrency(p.amount)}
                                                        </span>
                                                        <span style={{
                                                            fontSize: '0.7rem',
                                                            fontWeight: '700',
                                                            padding: '2px 8px',
                                                            borderRadius: '10px',
                                                            background: 'rgba(16, 185, 129, 0.15)',
                                                            color: '#10b981'
                                                        }}>
                                                            PAID
                                                        </span>
                                                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                                            Paid date: {formatDate(p.payment_date)}
                                                        </span>
                                                    </div>

                                                    <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
                                                        <button
                                                            onClick={() => handlePrintPaymentReceipt(student, p)}
                                                            style={{
                                                                background: 'rgba(31, 127, 209, 0.12)',
                                                                border: '1px solid rgba(31, 127, 209, 0.3)',
                                                                color: 'var(--color-secondary, #1F7FD1)',
                                                                padding: '0.25rem 0.65rem',
                                                                borderRadius: '6px',
                                                                fontSize: '0.8rem',
                                                                fontWeight: '600',
                                                                cursor: 'pointer',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '4px'
                                                            }}
                                                            title="Print receipt for this payment"
                                                        >
                                                            <Printer size={13} /> Receipt
                                                        </button>
                                                        <button
                                                            onClick={() => handleOpenEditPayment(student, p)}
                                                            style={{
                                                                background: 'transparent',
                                                                border: 'none',
                                                                color: 'var(--color-primary)',
                                                                cursor: 'pointer',
                                                                fontSize: '0.85rem',
                                                                fontWeight: '600'
                                                            }}
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeletePayment(p.id)}
                                                            style={{
                                                                background: 'transparent',
                                                                border: 'none',
                                                                color: 'var(--color-danger)',
                                                                cursor: 'pointer',
                                                                fontSize: '0.85rem',
                                                                fontWeight: '600'
                                                            }}
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Fee Receipt Printable Modal */}
            <FeeReceiptModal
                isOpen={Boolean(selectedReceipt)}
                onClose={() => setSelectedReceipt(null)}
                receipt={selectedReceipt}
            />
        </div>
    );
};

export default FeesTab;
