import React, { useState, useEffect } from 'react';
import styles from './Tabs.module.css';

const FeesTab = () => {
    const [view, setView] = useState('list');

    // List State
    const [fees, setFees] = useState([]);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);

    // Form State
    const [formData, setFormData] = useState({ student_id: '', amount: '', status: 'pending', due_date: '', paid_date: '' });
    const [statusMsg, setStatusMsg] = useState({ type: '', message: '' });
    const [editId, setEditId] = useState(null);

    useEffect(() => {
        if (view === 'list') {
            fetchFees();
        } else if (view === 'add' && students.length === 0) {
            fetchStudents();
        }
    }, [view]);

    const fetchFees = async () => {
        setLoading(true);
        try {
            const res = await fetch((import.meta.env.VITE_BACKEND_URL || '') + '/api/fees', {
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

    const fetchStudents = async () => {
        try {
            const res = await fetch((import.meta.env.VITE_BACKEND_URL || '') + '/api/students', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (res.ok) {
                setStudents(data);
                if (data.length > 0) setFormData(prev => ({ ...prev, student_id: data[0].id }));
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this?')) return;
        if (!window.confirm("Delete this fee record?")) return;
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/fees/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                setFees(fees.filter(f => f.id !== id));
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleEdit = (fee) => {
        setEditId(fee.id);
        setFormData({
            student_id: fee.student_id,
            amount: fee.amount,
            status: fee.status,
            due_date: fee.due_date ? new Date(fee.due_date).toISOString().split('T')[0] : '',
            paid_date: fee.paid_date ? new Date(fee.paid_date).toISOString().split('T')[0] : ''
        });
        setView('add');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatusMsg({ type: 'loading', message: 'Saving fee record...' });

        // formatting date string handling if paid_date is empty
        const submissionData = { ...formData };
        if (submissionData.status === 'pending') {
            submissionData.paid_date = null;
        }

        try {
            const url = editId ? `/api/fees/${editId}` : '/api/fees';
            const method = editId ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(submissionData)
            });

            const data = await res.json();
            if (res.ok) {
                setStatusMsg({ type: 'success', message: editId ? 'Fee record updated successfully!' : 'Fee record saved successfully!' });
                setFormData({ student_id: students[0]?.id || '', amount: '', status: 'pending', due_date: '', paid_date: '' });
                setEditId(null);
                setTimeout(() => setView('list'), 1500);
            } else {
                setStatusMsg({ type: 'error', message: data.error || 'Failed to save fee record' });
            }
        } catch (err) {
            setStatusMsg({ type: 'error', message: err.message });
        }
    };

    if (view === 'list') {
        return (
            <div className={`glass-panel animate-fade-in`} style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <h2 style={{ color: 'var(--color-primary)', margin: 0 }}>Manage Fees</h2>
                    <button onClick={() => { setEditId(null); setFormData({ student_id: students[0]?.id || '', amount: '', status: 'pending', due_date: '', paid_date: '' }); setView('add'); }} className={styles.submitBtn} style={{ margin: 0 }}>
                        + Add Fee Record
                    </button>
                </div>

                {loading ? <p>Loading...</p> : fees.length === 0 ? <p>No fee records found.</p> : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                    <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Student</th>
                                    <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Amount</th>
                                    <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Status</th>
                                    <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Due Date</th>
                                    <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {fees.map((f) => (
                                    <tr key={f.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                        <td style={{ padding: '0.75rem' }}>{f.students?.full_name}</td>
                                        <td style={{ padding: '0.75rem' }}>₹{f.amount}</td>
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
                                        <td style={{ padding: '0.75rem' }}>{new Date(f.due_date).toLocaleDateString()}</td>
                                        <td style={{ padding: '0.75rem', display: 'flex', gap: '0.75rem' }}>
                                            <button onClick={() => handleEdit(f)} style={{ background: 'transparent', color: 'var(--color-primary)', border: 'none', cursor: 'pointer', padding: 0 }}>Edit</button>
                                            <button onClick={() => handleDelete(f.id)} style={{ background: 'transparent', color: 'var(--color-danger)', border: 'none', cursor: 'pointer', padding: 0 }}>Delete</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className={`glass-panel ${styles.tabContainer} animate-fade-in`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ margin: 0 }}>{editId ? 'Edit Fee Record' : 'Add Fee Record'}</h2>
                <button onClick={() => setView('list')} className={styles.logoutBtn} style={{ background: 'transparent', color: 'var(--color-text-muted)', border: 'none' }}>Cancel</button>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.inputGroup}>
                    <label>Select Student</label>
                    <select required value={formData.student_id} onChange={e => setFormData({ ...formData, student_id: e.target.value })}>
                        {students.map(s => (
                            <option key={s.id} value={s.id}>{s.full_name} ({s.users?.email})</option>
                        ))}
                    </select>
                </div>
                <div className={styles.inputGroup}>
                    <label>Amount (e.g. 500.00)</label>
                    <input required type="number" min="0" step="0.01" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} />
                </div>
                <div className={styles.inputGroup}>
                    <label>Status</label>
                    <select required value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                        <option value="pending">Pending</option>
                        <option value="paid">Paid</option>
                    </select>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <div className={styles.inputGroup} style={{ flex: 1 }}>
                        <label>Due Date</label>
                        <input required type="date" value={formData.due_date} onChange={e => setFormData({ ...formData, due_date: e.target.value })} />
                    </div>
                    {formData.status === 'paid' && (
                        <div className={styles.inputGroup} style={{ flex: 1 }}>
                            <label>Paid Date</label>
                            <input required type="date" value={formData.paid_date} onChange={e => setFormData({ ...formData, paid_date: e.target.value })} />
                        </div>
                    )}
                </div>

                {statusMsg.message && (
                    <div className={statusMsg.type === 'error' ? styles.errorMsg : styles.successMsg}>
                        {statusMsg.message}
                    </div>
                )}

                <button type="submit" disabled={statusMsg.type === 'loading'} className={styles.submitBtn}>
                    {editId ? 'Update Fee Record' : 'Save Fee Record'}
                </button>
            </form>
        </div>
    );
};

export default FeesTab;
