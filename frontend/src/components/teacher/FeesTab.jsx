import React, { useState, useEffect, useMemo } from 'react';
import styles from './Tabs.module.css';
import FeeReceiptModal from '../common/FeeReceiptModal';
import { Printer, Search, X } from 'lucide-react';

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
    const [statusFilter, setStatusFilter] = useState('active'); // 'active', 'inactive', 'all'
    const [searchQuery, setSearchQuery] = useState('');
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

    const MONTH_NAMES = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const getMonthNameString = (dateObj) => {
        const d = dateObj ? new Date(dateObj) : new Date();
        if (isNaN(d.getTime())) return '';
        return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
    };

    const getRecentMonthOptions = () => {
        const list = [];
        const now = new Date();
        for (let i = -3; i <= 6; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
            list.push(`${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`);
        }
        return list;
    };

    // Helper: Compute exact same day of next month (with month-end clamping)
    const getNextMonthSameDate = (dateInput) => {
        try {
            if (!dateInput) return '';
            const dateStr = String(dateInput).slice(0, 10);
            const parts = dateStr.split('-');
            if (parts.length !== 3) return '';
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1; // 0-indexed
            const day = parseInt(parts[2], 10);

            let nextYear = year;
            let nextMonth = month + 1;
            if (nextMonth > 11) {
                nextMonth = 0;
                nextYear += 1;
            }

            const daysInNextMonth = new Date(nextYear, nextMonth + 1, 0).getDate();
            const clampedDay = Math.min(day, daysInNextMonth);

            const yyyy = nextYear;
            const mm = String(nextMonth + 1).padStart(2, '0');
            const dd = String(clampedDay).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        } catch {
            return '';
        }
    };

    // Helper: Normalize class name for strict matching (e.g. 'Class 10' -> '10', '10' -> '10', 'General' -> 'General')
    const normalizeClass = (cls) => {
        if (!cls) return 'General';
        const s = String(cls).trim().toLowerCase();
        const match = s.match(/\b(6|7|8|9|10|11|12)\b/);
        if (match) return match[1];
        if (s.includes('gen') || s === 'other') return 'General';
        return String(cls).trim();
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

    // All students strictly belonging to the selected class (before status & search filter)
    const classStudents = useMemo(() => {
        return students.filter(s => {
            if (selectedClass === 'All') return true;
            return normalizeClass(s.class_name || s.class) === normalizeClass(selectedClass);
        });
    }, [students, selectedClass]);

    const classActiveCount = useMemo(() => {
        return classStudents.filter(s => s.enrollment_status !== 'inactive' && s.enrollment_status !== 'leave').length;
    }, [classStudents]);

    const classInactiveCount = useMemo(() => {
        return classStudents.filter(s => s.enrollment_status === 'inactive' || s.enrollment_status === 'leave').length;
    }, [classStudents]);

    const classTotalCount = classStudents.length;

    // Filter students belonging to the selected class, status filter, and search query
    const filteredStudents = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return classStudents
            .filter(s => {
                const isInactive = s.enrollment_status === 'inactive' || s.enrollment_status === 'leave';
                if (statusFilter === 'active' && isInactive) return false;
                if (statusFilter === 'inactive' && !isInactive) return false;

                if (!q) return true;

                const name = (s.full_name || '').toLowerCase();
                const father = (s.father_name || '').toLowerCase();
                const phone = (s.phone || '').toLowerCase();
                const roll = (s.roll_no || s.roll_number || '').toString().toLowerCase();
                const email = (s.users?.email || '').toLowerCase();
                const sClass = String(s.class_name || s.class || '').toLowerCase();

                return name.includes(q) || 
                       father.includes(q) || 
                       phone.includes(q) || 
                       roll.includes(q) || 
                       email.includes(q) ||
                       sClass.includes(q);
            })
            .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
    }, [classStudents, statusFilter, searchQuery]);

    // Count matches in other classes when a search query is active
    const otherClassMatchesCount = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q || selectedClass === 'All') return 0;
        return students.filter(s => {
            const matchesSelectedClass = normalizeClass(s.class_name || s.class) === normalizeClass(selectedClass);
            if (matchesSelectedClass) return false;

            const isInactive = s.enrollment_status === 'inactive' || s.enrollment_status === 'leave';
            if (statusFilter === 'active' && isInactive) return false;
            if (statusFilter === 'inactive' && !isInactive) return false;

            const name = (s.full_name || '').toLowerCase();
            const father = (s.father_name || '').toLowerCase();
            const phone = (s.phone || '').toLowerCase();
            const roll = (s.roll_no || s.roll_number || '').toString().toLowerCase();
            const email = (s.users?.email || '').toLowerCase();

            return name.includes(q) || father.includes(q) || phone.includes(q) || roll.includes(q) || email.includes(q);
        }).length;
    }, [students, selectedClass, statusFilter, searchQuery]);

    // Total remaining for the displayed filtered students
    // Inactive students' fees are not counted unless explicitly on the 'inactive' filter
    const totalRemaining = useMemo(() => {
        return filteredStudents.reduce((acc, s) => {
            const isInactive = s.enrollment_status === 'inactive' || s.enrollment_status === 'leave';
            // Do not count inactive student's fees when on 'all' filter
            if (statusFilter === 'all' && isInactive) return acc;

            const total = Number(s.total_fees) || 0;
            if (total <= 0) return acc;
            const sPayments = studentPaymentsMap[s.id] || [];
            const paid = sPayments.reduce((sum, p) => sum + Number(p.amount), 0);
            const remaining = Math.max(0, total - paid);
            return acc + remaining;
        }, 0);
    }, [filteredStudents, studentPaymentsMap, statusFilter]);

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
        const currentFeeType = student.fee_type === 'Monthly' ? 'Monthly' : 'Yearly';
        const startDate = student.fees_start_date ? String(student.fees_start_date).slice(0, 10) : getTodayString();
        const initialDueDate = student.fees_due_date 
            ? String(student.fees_due_date).slice(0, 10) 
            : (currentFeeType === 'Monthly' ? getNextMonthSameDate(startDate) : '');

        setFormError('');
        setFormState({
            fee_type: currentFeeType,
            total_fees: student.total_fees ? String(student.total_fees) : '',
            monthly_amount: student.monthly_amount ? String(student.monthly_amount) : (currentFeeType === 'Monthly' && student.total_fees ? String(student.total_fees) : ''),
            fees_start_date: startDate,
            fees_due_date: initialDueDate,
            paid_now: '',
            paid_date: getTodayString(),
            month_for: getMonthNameString(new Date())
        });
        setActiveForm({
            type: isFirstTime ? 'set_fees' : 'edit_fees',
            studentId: student.id
        });
    };

    // Open "+ Add payment" form
    const handleOpenAddPayment = (student) => {
        const isMonthly = student.fee_type === 'Monthly';
        const defaultAmount = isMonthly && (student.monthly_amount || student.total_fees) 
            ? String(student.monthly_amount || student.total_fees) 
            : '';
        const todayStr = getTodayString();
        // Automatically default next due date to next month's same date for monthly students
        const autoDueDate = isMonthly ? getNextMonthSameDate(todayStr) : (student.fees_due_date ? String(student.fees_due_date).slice(0, 10) : '');

        setFormError('');
        setFormState({
            fee_type: isMonthly ? 'Monthly' : 'Yearly',
            amount: defaultAmount,
            payment_date: todayStr,
            fees_due_date: autoDueDate,
            month_for: getMonthNameString(new Date())
        });
        setActiveForm({
            type: 'add_payment',
            studentId: student.id
        });
    };

    // Open "Edit payment" form
    const handleOpenEditPayment = (student, payment) => {
        const isMonthly = student.fee_type === 'Monthly' || payment.fee_type === 'Monthly';
        const payDate = payment.payment_date ? String(payment.payment_date).slice(0, 10) : getTodayString();
        const autoDueDate = isMonthly 
            ? (student.fees_due_date ? String(student.fees_due_date).slice(0, 10) : getNextMonthSameDate(payDate)) 
            : (student.fees_due_date ? String(student.fees_due_date).slice(0, 10) : '');

        setFormError('');
        setFormState({
            fee_type: isMonthly ? 'Monthly' : 'Yearly',
            amount: String(payment.amount),
            payment_date: payDate,
            fees_due_date: autoDueDate,
            month_for: payment.month_for || getMonthNameString(new Date(payment.payment_date))
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
        const isMonthly = student.fee_type === 'Monthly' || payment.fee_type === 'Monthly';
        const studentPayments = (studentPaymentsMap[student.id] || [])
            .sort((a, b) => new Date(a.payment_date) - new Date(b.payment_date));
        const totalPaid = studentPayments.reduce((sum, p) => sum + Number(p.amount), 0);
        const totalFees = Number(student.total_fees) || 0;
        const remainingFees = isMonthly ? 0 : Math.max(0, totalFees - totalPaid);

        setSelectedReceipt({
            receiptNo: `APC-${payment.id ? String(payment.id).slice(0, 8).toUpperCase() : Math.floor(100000 + Math.random() * 900000)}`,
            date: payment.payment_date,
            studentName: student.full_name,
            fatherName: student.father_name,
            className: student.class_name || selectedClass,
            phone: student.phone,
            email: student.users?.email,
            currentPaid: Number(payment.amount),
            totalFees: isMonthly ? (student.monthly_amount || totalFees) : totalFees,
            totalPaid,
            remainingFees,
            dueDate: student.fees_due_date,
            paymentMode: 'Cash / Online UPI',
            fee_type: isMonthly ? 'Monthly' : 'Yearly',
            month_for: payment.month_for || null,
            monthly_amount: student.monthly_amount || totalFees
        });
    };

    // Print consolidated fee statement receipt
    const handlePrintConsolidatedReceipt = (student, studentPayments) => {
        const isMonthly = student.fee_type === 'Monthly';
        const totalPaid = (studentPayments || []).reduce((sum, p) => sum + Number(p.amount), 0);
        const totalFees = Number(student.total_fees) || 0;
        const remainingFees = isMonthly ? 0 : Math.max(0, totalFees - totalPaid);
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
            totalFees: isMonthly ? (student.monthly_amount || totalFees) : totalFees,
            totalPaid,
            remainingFees,
            dueDate: student.fees_due_date,
            paymentMode: 'Consolidated Fee Record',
            isStatement: true,
            fee_type: isMonthly ? 'Monthly' : 'Yearly',
            monthly_amount: student.monthly_amount || totalFees,
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
        const feeType = formState.fee_type || 'Yearly';

        if (!formState.fees_start_date) {
            setFormError('Fees start date is required');
            return;
        }

        // --- Monthly Fee Submission ---
        if (feeType === 'Monthly') {
            const numMonthly = Number(formState.monthly_amount);
            if (!numMonthly || numMonthly <= 0) {
                setFormError('Monthly fee amount must be greater than 0');
                return;
            }

            const paidNow = isFirstTime && Number(formState.paid_now) > 0 ? Number(formState.paid_now) : 0;
            if (isFirstTime && paidNow > 0 && !formState.paid_date) {
                setFormError('Paid date is required when initial payment is entered');
                return;
            }

            setFormLoading(true);
            try {
                const autoMonthlyDue = formState.fees_due_date 
                    ? formState.fees_due_date.slice(0, 10) 
                    : getNextMonthSameDate((isFirstTime && paidNow > 0 && formState.paid_date) ? formState.paid_date : formState.fees_start_date);

                const body = {
                    fee_type: 'Monthly',
                    monthly_amount: numMonthly,
                    fees_start_date: formState.fees_start_date.slice(0, 10),
                    fees_due_date: autoMonthlyDue || null
                };

                if (isFirstTime && paidNow > 0) {
                    body.initial_payment = {
                        amount: paidNow,
                        payment_date: formState.paid_date.slice(0, 10),
                        month_for: formState.month_for || null
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
                    setFormError(data?.error || error || 'Failed to update fees');
                }
            } catch (err) {
                setFormError(err.message || 'Network error');
            } finally {
                setFormLoading(false);
            }
            return;
        }

        // --- Yearly Fee Submission ---
        const numTotal = Number(formState.total_fees);
        if (!numTotal || numTotal <= 0) {
            setFormError('Total fees must be greater than 0');
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
                fee_type: 'Yearly',
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

        const isMonthly = student.fee_type === 'Monthly';
        const numAmount = Number(formState.amount);
        if (!numAmount || numAmount <= 0) {
            setFormError('Amount must be greater than 0');
            return;
        }

        if (!isMonthly && numAmount > allowedMax) {
            setFormError(`Amount cannot be more than remaining (${formatCurrency(allowedMax)})`);
            return;
        }
        if (!formState.payment_date) {
            setFormError('Payment date is required');
            return;
        }

        const remainingAfterPayment = isMonthly ? 0 : (allowedMax - numAmount);
        if (!isMonthly && remainingAfterPayment > 0 && !formState.fees_due_date && !student.fees_due_date) {
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

            const autoPaymentDue = formState.fees_due_date 
                ? formState.fees_due_date.slice(0, 10) 
                : (isMonthly ? getNextMonthSameDate(formState.payment_date) : null);

            const body = {
                amount: numAmount,
                payment_date: formState.payment_date.slice(0, 10),
                fees_due_date: autoPaymentDue ? autoPaymentDue.slice(0, 10) : null,
                fee_type: isMonthly ? 'Monthly' : 'Yearly',
                month_for: isMonthly ? (formState.month_for || null) : null
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

    const classList = ['All', '6', '7', '8', '9', '10', '11', '12', 'General'];
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

            {/* Student Search and Filters Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* Search Bar Input */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    position: 'relative',
                    width: '100%',
                    maxWidth: '560px'
                }}>
                    <Search 
                        size={18} 
                        style={{
                            position: 'absolute',
                            left: '12px',
                            color: 'var(--color-text-muted)',
                            pointerEvents: 'none'
                        }} 
                    />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search student by name, father name, phone, class..."
                        style={{
                            width: '100%',
                            padding: '0.62rem 2.2rem 0.62rem 2.4rem',
                            borderRadius: '10px',
                            border: '1.5px solid var(--color-border)',
                            background: 'var(--color-surface)',
                            color: 'var(--color-text-main)',
                            fontSize: '0.92rem',
                            outline: 'none',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                            transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
                        }}
                        onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
                        onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            title="Clear search"
                            type="button"
                            style={{
                                position: 'absolute',
                                right: '10px',
                                background: 'none',
                                border: 'none',
                                color: 'var(--color-text-muted)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                padding: '4px'
                            }}
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>

                {/* Class Selector Buttons */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', paddingBottom: '0.25rem' }}>
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
                                    padding: '0.5rem 1.15rem',
                                    borderRadius: '8px',
                                    border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                                    background: isSelected ? 'var(--color-primary)' : 'var(--color-surface)',
                                    color: isSelected ? '#ffffff' : 'var(--color-text-main)',
                                    fontWeight: isSelected ? '700' : '500',
                                    fontSize: '0.88rem',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    transition: 'all 0.2s ease',
                                    boxShadow: isSelected ? '0 2px 8px rgba(224, 138, 0, 0.25)' : 'none'
                                }}
                            >
                                {cls === 'All' ? 'All Classes' : cls === 'General' ? 'General' : `Class ${cls}`}
                            </button>
                        );
                    })}
                </div>

                {/* Status Filter Segment (Active / Inactive / All) */}
                <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    background: 'var(--color-surface-hover)',
                    padding: '0.35rem 0.6rem',
                    borderRadius: '10px',
                    border: '1px solid var(--color-border)',
                    alignSelf: 'flex-start'
                }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--color-text-muted)', marginRight: '0.25rem' }}>
                        Status:
                    </span>
                    <button
                        onClick={() => setStatusFilter('active')}
                        type="button"
                        style={{
                            background: statusFilter === 'active' ? '#10b981' : 'transparent',
                            color: statusFilter === 'active' ? '#ffffff' : '#10b981',
                            border: statusFilter === 'active' ? 'none' : '1px solid rgba(16, 185, 129, 0.3)',
                            padding: '0.3rem 0.8rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '0.82rem',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        Active ({classActiveCount})
                    </button>
                    <button
                        onClick={() => setStatusFilter('inactive')}
                        type="button"
                        style={{
                            background: statusFilter === 'inactive' ? '#ef4444' : 'transparent',
                            color: statusFilter === 'inactive' ? '#ffffff' : '#ef4444',
                            border: statusFilter === 'inactive' ? 'none' : '1px solid rgba(239, 68, 68, 0.3)',
                            padding: '0.3rem 0.8rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '0.82rem',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        Inactive ({classInactiveCount})
                    </button>
                    <button
                        onClick={() => setStatusFilter('all')}
                        type="button"
                        style={{
                            background: statusFilter === 'all' ? 'var(--color-primary)' : 'transparent',
                            color: statusFilter === 'all' ? '#ffffff' : 'var(--color-text-main)',
                            border: statusFilter === 'all' ? 'none' : '1px solid var(--color-border)',
                            padding: '0.3rem 0.8rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '0.82rem',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        All ({classTotalCount})
                    </button>
                </div>

                {/* Other Classes Match Hint */}
                {otherClassMatchesCount > 0 && (
                    <div style={{
                        background: 'rgba(224, 138, 0, 0.1)',
                        border: '1px solid rgba(224, 138, 0, 0.25)',
                        padding: '0.45rem 0.85rem',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        color: 'var(--color-text-main)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '0.5rem'
                    }}>
                        <span>
                            🔍 <strong>{otherClassMatchesCount}</strong> student{otherClassMatchesCount > 1 ? 's' : ''} found in other classes matching "<strong>{searchQuery}</strong>".
                        </span>
                        <button
                            onClick={() => setSelectedClass('All')}
                            type="button"
                            style={{
                                background: 'var(--color-primary)',
                                color: '#fff',
                                border: 'none',
                                padding: '0.25rem 0.65rem',
                                borderRadius: '6px',
                                fontSize: '0.8rem',
                                fontWeight: '600',
                                cursor: 'pointer'
                            }}
                        >
                            View in All Classes
                        </button>
                    </div>
                )}

                {/* Summary Line under class buttons */}
                <div style={{ color: 'var(--color-text-muted)', fontSize: '0.92rem', fontWeight: '500' }}>
                    {selectedClass === 'All' ? 'All Classes' : selectedClass === 'General' ? 'General' : `Class ${selectedClass}`} · {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''} {statusFilter === 'active' ? '(Active)' : statusFilter === 'inactive' ? '(Inactive)' : ''} {searchQuery ? `matching "${searchQuery}"` : ''} · Total remaining: {formatCurrency(totalRemaining)}
                </div>
            </div>

            {/* Student Cards List */}
            {loading ? (
                <div className="glass-panel" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    Loading students and payments...
                </div>
            ) : filteredStudents.length === 0 ? (
                <div className="glass-panel" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <div>
                        {searchQuery 
                            ? `No students found matching "${searchQuery}" in ${selectedClass === 'All' ? 'any class' : selectedClass === 'General' ? 'General' : `Class ${selectedClass}`}.`
                            : `No ${statusFilter !== 'all' ? statusFilter : ''} students in ${selectedClass === 'All' ? 'the institute' : selectedClass === 'General' ? 'General' : `Class ${selectedClass}`}`
                        }
                    </div>
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            type="button"
                            style={{
                                background: 'var(--color-primary)',
                                color: '#fff',
                                border: 'none',
                                padding: '0.35rem 0.85rem',
                                borderRadius: '6px',
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                cursor: 'pointer'
                            }}
                        >
                            Clear Search Filter
                        </button>
                    )}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {filteredStudents.map(student => {
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
                                            <div style={{ fontWeight: '600', color: 'var(--color-text-main)', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                <span>{student.full_name ?? 'Unknown'}</span>
                                                {(student.enrollment_status === 'inactive' || student.enrollment_status === 'leave') && (
                                                    <span style={{
                                                        fontSize: '0.72rem',
                                                        padding: '2px 8px',
                                                        borderRadius: '99px',
                                                        background: 'rgba(239, 68, 68, 0.15)',
                                                        border: '1px solid rgba(239, 68, 68, 0.35)',
                                                        color: '#ef4444',
                                                        fontWeight: '700'
                                                    }}>
                                                        Inactive
                                                    </span>
                                                )}
                                                {hasFeesSet && (
                                                    <span style={{
                                                        fontSize: '0.72rem',
                                                        padding: '2px 8px',
                                                        borderRadius: '6px',
                                                        background: student.fee_type === 'Monthly' ? 'rgba(37, 99, 235, 0.12)' : 'rgba(224, 138, 0, 0.12)',
                                                        border: student.fee_type === 'Monthly' ? '1px solid rgba(37, 99, 235, 0.3)' : '1px solid rgba(224, 138, 0, 0.3)',
                                                        color: student.fee_type === 'Monthly' ? '#2563eb' : 'var(--color-primary, #E08A00)',
                                                        fontWeight: '700'
                                                    }}>
                                                        {student.fee_type === 'Monthly' ? '📅 Monthly' : '🎓 Yearly'}
                                                    </span>
                                                )}
                                                {(selectedClass === 'All' || searchQuery) && (
                                                    <span style={{
                                                        fontSize: '0.72rem',
                                                        padding: '2px 8px',
                                                        borderRadius: '6px',
                                                        background: 'rgba(31, 127, 209, 0.1)',
                                                        border: '1px solid rgba(31, 127, 209, 0.25)',
                                                        color: 'var(--color-secondary, #1F7FD1)',
                                                        fontWeight: '700'
                                                    }}>
                                                        Class {student.class_name || student.class || '-'}
                                                    </span>
                                                )}
                                                {student.father_name && (
                                                    <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: '400' }}>
                                                        (S/O {student.father_name})
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px', flexWrap: 'wrap' }}>
                                                {student.phone && <span>📞 {student.phone}</span>}
                                                {student.users?.email && <span>✉️ {student.users.email}</span>}
                                            </div>
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
                                        {student.fee_type === 'Monthly' ? (
                                            /* Monthly Fee View */
                                            <>
                                                <div style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                                                    gap: '1rem',
                                                    padding: '0.75rem 0',
                                                    borderTop: '1px solid var(--color-border)',
                                                    borderBottom: '1px solid var(--color-border)'
                                                }}>
                                                    {/* Column 1: Monthly Fee Rate */}
                                                    <div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>
                                                            Monthly Rate (मासिक दर)
                                                        </div>
                                                        <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#2563eb' }}>
                                                            {formatCurrency(student.monthly_amount || student.total_fees)} <span style={{ fontSize: '0.8rem', fontWeight: '500' }}>/ mo</span>
                                                        </div>
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                                            Shuru: {student.fees_start_date ? formatDate(student.fees_start_date) : '-'}
                                                        </div>
                                                    </div>

                                                    {/* Column 2: Total Received */}
                                                    <div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>
                                                            Total Received (कुल जमा)
                                                        </div>
                                                        <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#10b981' }}>
                                                            {formatCurrency(paidFees)}
                                                        </div>
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                                            Last paid: {latestPaymentDate ? formatDate(latestPaymentDate) : 'Abhi tak nahi'}
                                                        </div>
                                                    </div>

                                                    {/* Column 3: Next Due Date */}
                                                    <div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>
                                                            Next Due Date (अगली तारीख)
                                                        </div>
                                                        <div style={{ fontSize: '1.25rem', fontWeight: '700', color: isOverdue ? '#ef4444' : 'var(--color-text-main)' }}>
                                                            {student.fees_due_date ? formatDate(student.fees_due_date) : 'Schedule nahi hai'}
                                                        </div>
                                                        <div style={{ fontSize: '0.8rem', marginTop: '2px' }}>
                                                            {isOverdue ? (
                                                                <span style={{ color: '#ef4444', fontWeight: '600' }}>
                                                                    ⚠️ Due thi: {formatDate(student.fees_due_date)}
                                                                </span>
                                                            ) : (
                                                                <span style={{ color: 'var(--color-text-muted)' }}>
                                                                    {studentPayments.length} month payment{studentPayments.length !== 1 ? 's' : ''} recorded
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.2rem 0' }}>
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#2563eb', fontWeight: '600' }}>
                                                        📅 Monthly Fee Plan (मासिक फीस रिकॉर्ड)
                                                    </span>
                                                    <span style={{ color: '#10b981', fontWeight: '600' }}>
                                                        {studentPayments.length} Payment{studentPayments.length !== 1 ? 's' : ''} Done
                                                    </span>
                                                </div>
                                            </>
                                        ) : (
                                            /* Yearly Fee View */
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
                                            </>
                                        )}

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
                                                        {student.fee_type === 'Monthly' ? 'Edit Fee Rate' : 'Edit total'}
                                                    </button>
                                                    {(student.fee_type === 'Monthly' || remainingFees > 0) && (
                                                        <button
                                                            onClick={() => handleOpenAddPayment(student)}
                                                            style={{
                                                                background: student.fee_type === 'Monthly' ? 'rgba(37, 99, 235, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                                                                border: student.fee_type === 'Monthly' ? '1px solid rgba(37, 99, 235, 0.35)' : '1px solid rgba(59, 130, 246, 0.3)',
                                                                color: student.fee_type === 'Monthly' ? '#2563eb' : 'var(--color-primary)',
                                                                padding: '0.35rem 0.85rem',
                                                                borderRadius: '6px',
                                                                fontSize: '0.85rem',
                                                                fontWeight: '600',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            {student.fee_type === 'Monthly' ? '+ Add monthly payment' : '+ Add payment'}
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
                                    const isMonthly = formState.fee_type === 'Monthly';
                                    const liveTotal = Number(formState.total_fees) || 0;
                                    const liveMonthly = Number(formState.monthly_amount) || 0;
                                    const livePaid = isFirstTime ? (Number(formState.paid_now) || 0) : paidFees;
                                    const liveRemaining = isMonthly ? 0 : Math.max(0, liveTotal - livePaid);

                                    return (
                                        <div style={{
                                            marginTop: '0.5rem',
                                            padding: '1rem',
                                            borderRadius: '8px',
                                            background: 'var(--color-surface-hover)',
                                            border: '1px solid var(--color-border)'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                                <h4 style={{ margin: 0, color: 'var(--color-text-main)' }}>
                                                    {isFirstTime ? 'Set Student Fees' : 'Edit Fees & Due Date'}
                                                </h4>

                                                {/* Mode Toggle: Monthly vs Yearly */}
                                                <div style={{ display: 'inline-flex', gap: '4px', background: 'var(--color-surface)', padding: '3px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormState(prev => {
                                                            const refDate = (Number(prev.paid_now) > 0 && prev.paid_date) ? prev.paid_date : (prev.fees_start_date || getTodayString());
                                                            return {
                                                                ...prev,
                                                                fee_type: 'Monthly',
                                                                fees_due_date: getNextMonthSameDate(refDate)
                                                            };
                                                        })}
                                                        style={{
                                                            padding: '0.35rem 0.85rem',
                                                            borderRadius: '6px',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            fontSize: '0.8rem',
                                                            fontWeight: '700',
                                                            background: isMonthly ? '#2563eb' : 'transparent',
                                                            color: isMonthly ? '#ffffff' : 'var(--color-text-main)',
                                                            boxShadow: isMonthly ? '0 2px 6px rgba(37, 99, 235, 0.25)' : 'none',
                                                            transition: 'all 0.15s ease'
                                                        }}
                                                    >
                                                        📅 Monthly (मासिक)
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormState(prev => ({ ...prev, fee_type: 'Yearly' }))}
                                                        style={{
                                                            padding: '0.35rem 0.85rem',
                                                            borderRadius: '6px',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            fontSize: '0.8rem',
                                                            fontWeight: '700',
                                                            background: !isMonthly ? 'var(--color-primary, #E08A00)' : 'transparent',
                                                            color: !isMonthly ? '#ffffff' : 'var(--color-text-main)',
                                                            boxShadow: !isMonthly ? '0 2px 6px rgba(224, 138, 0, 0.25)' : 'none',
                                                            transition: 'all 0.15s ease'
                                                        }}
                                                    >
                                                        🎓 Yearly (वार्षिक)
                                                    </button>
                                                </div>
                                            </div>

                                            <form onSubmit={(e) => handleSaveFees(e, student, paidFees)} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                {/* Live Summary Line */}
                                                <div style={{
                                                    padding: '0.5rem 0.75rem',
                                                    background: 'var(--color-surface)',
                                                    borderRadius: '6px',
                                                    fontSize: '0.85rem',
                                                    fontWeight: '600',
                                                    color: isMonthly ? '#2563eb' : 'var(--color-text-main)',
                                                    border: isMonthly ? '1px solid rgba(37, 99, 235, 0.25)' : '1px solid var(--color-border)'
                                                }}>
                                                    {isMonthly ? (
                                                        <span>Plan: <strong>Monthly Fees (मासिक)</strong> · Rate: {formatCurrency(liveMonthly)} / month {isFirstTime && Number(formState.paid_now) > 0 ? `· Initial payment: ${formatCurrency(formState.paid_now)}` : ''}</span>
                                                    ) : (
                                                        <span>Plan: <strong>Yearly Course Fees (वार्षिक)</strong> · Total {formatCurrency(liveTotal)} · Paid {formatCurrency(livePaid)} · Remaining {formatCurrency(liveRemaining)}</span>
                                                    )}
                                                </div>

                                                {isMonthly ? (
                                                    /* Monthly Form Fields */
                                                    <>
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                                                            <div className={styles.inputGroup}>
                                                                <label>Monthly Fee Rate (मासिक फीस प्रति माह) *</label>
                                                                <input
                                                                    required
                                                                    type="number"
                                                                    min="0"
                                                                    step="0.01"
                                                                    placeholder="e.g. 800"
                                                                    value={formState.monthly_amount || ''}
                                                                    onChange={e => setFormState({ ...formState, monthly_amount: e.target.value })}
                                                                />
                                                            </div>

                                                            <div className={styles.inputGroup}>
                                                                <label>Fees Start Date (शुरू माह / तिथि) *</label>
                                                                <input
                                                                    required
                                                                    type="date"
                                                                    value={formState.fees_start_date}
                                                                    onChange={e => {
                                                                        const val = e.target.value;
                                                                        setFormState(prev => {
                                                                            const isPaid = Number(prev.paid_now) > 0 && prev.paid_date;
                                                                            const refDate = isPaid ? prev.paid_date : val;
                                                                            return {
                                                                                ...prev,
                                                                                fees_start_date: val,
                                                                                fees_due_date: getNextMonthSameDate(refDate),
                                                                                month_for: prev.month_for || getMonthNameString(val)
                                                                            };
                                                                        });
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>

                                                        {isFirstTime && (
                                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                                                                <div className={styles.inputGroup}>
                                                                    <label>Paid this month now? (optional)</label>
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        step="0.01"
                                                                        placeholder={formState.monthly_amount ? `e.g. ${formState.monthly_amount}` : 'e.g. 800'}
                                                                        value={formState.paid_now}
                                                                        onChange={e => {
                                                                            const val = e.target.value;
                                                                            setFormState(prev => {
                                                                                const hasPayment = Number(val) > 0;
                                                                                const refDate = (hasPayment && prev.paid_date) ? prev.paid_date : (prev.fees_start_date || getTodayString());
                                                                                return {
                                                                                    ...prev,
                                                                                    paid_now: val,
                                                                                    fees_due_date: getNextMonthSameDate(refDate)
                                                                                };
                                                                            });
                                                                        }}
                                                                    />
                                                                </div>

                                                                {Number(formState.paid_now) > 0 && (
                                                                    <>
                                                                        <div className={styles.inputGroup}>
                                                                            <label>Paid Date (फीस जमा करने की तिथि) *</label>
                                                                            <input
                                                                                required
                                                                                type="date"
                                                                                value={formState.paid_date}
                                                                                onChange={e => {
                                                                                    const val = e.target.value;
                                                                                    setFormState(prev => ({
                                                                                        ...prev,
                                                                                        paid_date: val,
                                                                                        fees_due_date: getNextMonthSameDate(val),
                                                                                        month_for: getMonthNameString(val)
                                                                                    }));
                                                                                }}
                                                                            />
                                                                        </div>
                                                                        <div className={styles.inputGroup}>
                                                                            <label>Fee for Month</label>
                                                                            <input
                                                                                type="text"
                                                                                list="month-list-set"
                                                                                placeholder="e.g. April 2026"
                                                                                value={formState.month_for || ''}
                                                                                onChange={e => setFormState({ ...formState, month_for: e.target.value })}
                                                                            />
                                                                            <datalist id="month-list-set">
                                                                                {getRecentMonthOptions().map(m => (
                                                                                    <option key={m} value={m} />
                                                                                ))}
                                                                            </datalist>
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>
                                                        )}

                                                        <div className={styles.inputGroup}>
                                                            <label>Next Due Date (अगली माह की देय तिथि - ऑटो सेट)</label>
                                                            <input
                                                                type="date"
                                                                value={formState.fees_due_date || ''}
                                                                onChange={e => setFormState({ ...formState, fees_due_date: e.target.value })}
                                                            />
                                                        </div>
                                                    </>
                                                ) : (
                                                    /* Yearly Form Fields */
                                                    <>
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
                                                    </>
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
                                    const isMonthly = student.fee_type === 'Monthly';
                                    const allowedMax = isEdit
                                        ? Math.max(0, totalFees - (paidFees - Number(activeForm.payment.amount)))
                                        : remainingFees;
                                    const liveAmount = Number(formState.amount) || 0;
                                    const remainingAfter = isMonthly ? 0 : Math.max(0, allowedMax - liveAmount);

                                    return (
                                        <div style={{
                                            marginTop: '0.5rem',
                                            padding: '1rem',
                                            borderRadius: '8px',
                                            background: 'var(--color-surface-hover)',
                                            border: '1px solid var(--color-border)'
                                        }}>
                                            <h4 style={{ margin: '0 0 0.75rem 0', color: 'var(--color-text-main)' }}>
                                                {isEdit ? 'Edit Payment Record' : (isMonthly ? 'Record Monthly Fee Payment' : 'Record New Payment')}
                                            </h4>

                                            <form onSubmit={(e) => handleSavePayment(e, student, allowedMax)} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                {/* Live summary line */}
                                                <div style={{
                                                    padding: '0.5rem 0.75rem',
                                                    background: 'var(--color-surface)',
                                                    borderRadius: '6px',
                                                    fontSize: '0.85rem',
                                                    fontWeight: '600',
                                                    color: isMonthly ? '#2563eb' : 'var(--color-text-main)',
                                                    border: '1px solid var(--color-border)'
                                                }}>
                                                    {isMonthly ? (
                                                        <span>Monthly Payment · Recording: {formatCurrency(liveAmount)} {formState.month_for ? `for ${formState.month_for}` : ''}</span>
                                                    ) : (
                                                        <span>Is payment ke baad remaining: {formatCurrency(remainingAfter)}</span>
                                                    )}
                                                </div>

                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                                                    <div className={styles.inputGroup}>
                                                        <label>Amount received (जमा राशि) *</label>
                                                        <input
                                                            required
                                                            type="number"
                                                            min="0.01"
                                                            step="0.01"
                                                            placeholder={isMonthly && student.monthly_amount ? `Rate: ₹${student.monthly_amount}` : (isMonthly ? 'e.g. 800' : `Max ${allowedMax}`)}
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
                                                            onChange={e => {
                                                                const val = e.target.value;
                                                                setFormState(prev => ({
                                                                    ...prev,
                                                                    payment_date: val,
                                                                    fees_due_date: isMonthly ? getNextMonthSameDate(val) : prev.fees_due_date,
                                                                    month_for: isMonthly ? getMonthNameString(val) : prev.month_for
                                                                }));
                                                            }}
                                                        />
                                                    </div>

                                                    {isMonthly && (
                                                        <div className={styles.inputGroup}>
                                                            <label>Payment for Month (किस माह की फीस)</label>
                                                            <input
                                                                type="text"
                                                                list="month-list-pay"
                                                                placeholder="e.g. April 2026"
                                                                value={formState.month_for || ''}
                                                                onChange={e => setFormState({ ...formState, month_for: e.target.value })}
                                                            />
                                                            <datalist id="month-list-pay">
                                                                {getRecentMonthOptions().map(m => (
                                                                    <option key={m} value={m} />
                                                                ))}
                                                            </datalist>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Due Date: for monthly or if remaining > 0 */}
                                                {(isMonthly || remainingAfter > 0) && (
                                                    <div className={styles.inputGroup}>
                                                        <label>{isMonthly ? 'Next Due Date (अगली माह की देय तिथि - ऑटो सेट)' : 'Baaki fees ki due date *'}</label>
                                                        <input
                                                            required={!isMonthly}
                                                            type="date"
                                                            value={formState.fees_due_date || ''}
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
                                                        {p.month_for && (
                                                            <span style={{
                                                                fontSize: '0.75rem',
                                                                fontWeight: '600',
                                                                padding: '2px 8px',
                                                                borderRadius: '6px',
                                                                background: 'rgba(37, 99, 235, 0.1)',
                                                                color: '#2563eb'
                                                            }}>
                                                                {p.month_for}
                                                            </span>
                                                        )}
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
