import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import styles from './Tabs.module.css';

const StudentsTab = () => {
    const { user } = useAuth();
    const [view, setView] = useState('list'); // 'list', 'add', or 'edit'
    const [editingId, setEditingId] = useState(null);

    // List State
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState([]);
    const [visiblePasswords, setVisiblePasswords] = useState({});

    // Form State
    const [formData, setFormData] = useState({ email: '', password: '', fullName: '', fatherName: '', phone: '', class_name: '10' });
    const [status, setStatus] = useState({ type: '', message: '' });

    useEffect(() => {
        if (view === 'list') {
            fetchStudents();
        }
    }, [view]);

    const fetchStudents = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/students', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (res.ok) setStudents(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this student?')) return;

        try {
            const res = await fetch(`/api/students/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });

            if (res.ok) {
                setStudents(students.filter(s => s.id !== id));
                setSelectedIds(selectedIds.filter(selId => selId !== id));
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to delete student');
            }
        } catch (err) {
            console.error(err);
            alert('Failed to delete student');
        }
    };

    const handleApprove = async (id) => {
        try {
            const res = await fetch(`/api/students/${id}/approve`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });

            if (res.ok) {
                setStudents(students.map(s => s.id === id ? { ...s, is_approved: 1 } : s));
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to approve student');
            }
        } catch (err) {
            console.error(err);
            alert('Failed to approve student');
        }
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) setSelectedIds(students.map(s => s.id));
        else setSelectedIds([]);
    };

    const handleSelectOne = (id) => {
        if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(i => i !== id));
        else setSelectedIds([...selectedIds, id]);
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} students?`)) return;

        try {
            const res = await fetch('/api/students/bulk-delete', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}` 
                },
                body: JSON.stringify({ ids: selectedIds })
            });

            if (res.ok) {
                setStudents(students.filter(s => !selectedIds.includes(s.id)));
                setSelectedIds([]);
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to delete students');
            }
        } catch (err) {
            console.error(err);
            alert('Failed to delete students');
        }
    };

    const togglePasswordVisibility = (id) => {
        setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus({ type: 'loading', message: editingId ? 'Updating student...' : 'Creating student...' });
        try {
            const url = editingId ? `/api/students/${editingId}` : '/api/students';
            const method = editingId ? 'PUT' : 'POST';

            // For editing, only send password if it's provided
            const payload = { ...formData };
            if (editingId && !payload.password) {
                delete payload.password;
            }

            const res = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (res.ok) {
                setStatus({ type: 'success', message: editingId ? 'Student updated successfully!' : 'Student created successfully!' });
                setFormData({ email: '', password: '', fullName: '', phone: '', class_name: '10' });
                setEditingId(null);
                setTimeout(() => setView('list'), 1500); // Go back to list
            } else {
                setStatus({ type: 'error', message: data.error || (editingId ? 'Failed to update student' : 'Failed to create student') });
            }
        } catch (err) {
            setStatus({ type: 'error', message: err.message });
        }
    };

    const handleEditClick = (student) => {
        setFormData({
            email: student.users?.email || '',
            password: '', // Leave blank for edit, only update if typed
            fullName: student.full_name || '',
            fatherName: student.father_name || '',
            phone: student.phone || '',
            class_name: student.class_name || 'General'
        });
        setEditingId(student.id);
        setStatus({ type: '', message: '' });
        setView('edit');
    };

    if (view === 'list') {
        return (
            <div className={`glass-panel animate-fade-in`} style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <h2 style={{ color: 'var(--color-primary)', margin: 0 }}>Manage Students</h2>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        {selectedIds.length > 0 && (
                            <button onClick={handleBulkDelete} style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.75rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}>
                                Delete Selected ({selectedIds.length})
                            </button>
                        )}
                        <button onClick={() => {
                            setFormData({ email: '', password: '', fullName: '', phone: '', class_name: '10' });
                            setEditingId(null);
                            setStatus({ type: '', message: '' });
                            setView('add');
                        }} className={styles.submitBtn} style={{ margin: 0 }}>
                            + Add Student
                        </button>
                    </div>
                </div>

                {loading ? <p>Loading...</p> : students.length === 0 ? <p>No students found.</p> : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                    <th style={{ padding: '0.75rem', width: '40px' }}>
                                        <input 
                                            type="checkbox" 
                                            onChange={handleSelectAll} 
                                            checked={students.length > 0 && selectedIds.length === students.length}
                                            style={{ cursor: 'pointer' }}
                                        />
                                    </th>
                                    <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Name</th>
                                    <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Father's Name</th>
                                    <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Class</th>
                                    <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Email</th>
                                    <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Password</th>
                                    <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Status</th>
                                    <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.map((s) => (
                                    <tr key={s.id} style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: selectedIds.includes(s.id) ? 'rgba(59, 130, 246, 0.05)' : 'transparent' }}>
                                        <td style={{ padding: '0.75rem' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={selectedIds.includes(s.id)} 
                                                onChange={() => handleSelectOne(s.id)}
                                                style={{ cursor: 'pointer' }}
                                            />
                                        </td>
                                        <td style={{ padding: '0.75rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.9rem', flexShrink: 0 }}>
                                                    {s.full_name ? s.full_name.charAt(0).toUpperCase() : 'S'}
                                                </div>
                                                <span style={{ fontWeight: '500', color: 'var(--color-text-main)' }}>{s.full_name}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.75rem' }}>{s.father_name || '-'}</td>
                                        <td style={{ padding: '0.75rem' }}>{['8', '9', '10', '12'].includes(s.class_name) ? `Class ${s.class_name}` : s.class_name}</td>
                                        <td style={{ padding: '0.75rem' }}>{s.users?.email}</td>
                                        <td style={{ padding: '0.75rem', color: 'var(--color-text-main)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span style={{ display: 'inline-block', width: '80px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {visiblePasswords[s.id] ? (s.plain_password || '********') : '••••••••'}
                                                </span>
                                                <button 
                                                    onClick={() => togglePasswordVisibility(s.id)}
                                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: 0 }}
                                                    title={visiblePasswords[s.id] ? "Hide Password" : "Show Password"}
                                                >
                                                    {visiblePasswords[s.id] ? '🙈' : '👁️'}
                                                </button>
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.75rem' }}>
                                            <span style={{ 
                                                padding: '0.25rem 0.5rem', 
                                                borderRadius: '12px', 
                                                fontSize: '0.75rem', 
                                                fontWeight: 'bold',
                                                backgroundColor: s.is_approved ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                                color: s.is_approved ? '#10b981' : '#f59e0b'
                                            }}>
                                                {s.is_approved ? 'Approved' : 'Pending'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem', flexWrap: 'nowrap' }}>
                                                {!s.is_approved && (
                                                    <button
                                                        onClick={() => handleApprove(s.id)}
                                                        style={{
                                                            background: 'rgba(16, 185, 129, 0.2)',
                                                            color: '#10b981',
                                                            border: '1px solid rgba(16, 185, 129, 0.3)',
                                                            padding: '0.25rem 0.75rem',
                                                            borderRadius: '4px',
                                                            cursor: 'pointer',
                                                            fontSize: '0.875rem',
                                                            whiteSpace: 'nowrap'
                                                        }}
                                                    >
                                                        Approve
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleEditClick(s)}
                                                    style={{
                                                        background: 'rgba(59, 130, 246, 0.2)',
                                                        color: '#3b82f6',
                                                        border: '1px solid rgba(59, 130, 246, 0.3)',
                                                        padding: '0.25rem 0.75rem',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        fontSize: '0.875rem',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(s.id)}
                                                    style={{
                                                        background: 'rgba(239, 68, 68, 0.2)',
                                                        color: '#ef4444',
                                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                                        padding: '0.25rem 0.75rem',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        fontSize: '0.875rem',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                >
                                                    Delete
                                                </button>
                                            </div>
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
                <h2 style={{ margin: 0 }}>{editingId ? 'Edit Student' : 'Add New Student'}</h2>
                <button onClick={() => setView('list')} className={styles.logoutBtn} style={{ background: 'transparent', color: 'var(--color-text-muted)', border: 'none' }}>Cancel</button>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.inputGroup}>
                    <label>Full Name</label>
                    <input required type="text" value={formData.fullName} onChange={e => setFormData({ ...formData, fullName: e.target.value })} />
                </div>
                <div className={styles.inputGroup}>
                    <label>Father's Name</label>
                    <input required type="text" value={formData.fatherName} onChange={e => setFormData({ ...formData, fatherName: e.target.value })} />
                </div>
                <div className={styles.inputGroup}>
                    <label>Class</label>
                    <select value={formData.class_name} onChange={e => setFormData({ ...formData, class_name: e.target.value })} className={styles.selectInput}>
                        <option value="8">Class 8</option>
                        <option value="9">Class 9</option>
                        <option value="10">Class 10</option>
                        <option value="12">Class 12</option>
                        <option value="General">General / Other</option>
                    </select>
                </div>
                <div className={styles.inputGroup}>
                    <label>Email</label>
                    <input required type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                </div>
                <div className={styles.inputGroup}>
                    <label>Password {editingId && <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>(leave blank to keep current)</span>}</label>
                    <input required={!editingId} type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                </div>
                <div className={styles.inputGroup}>
                    <label>Phone Number (Optional)</label>
                    <input type="text" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                </div>

                {status.message && (
                    <div className={status.type === 'error' ? styles.errorMsg : styles.successMsg}>
                        {status.message}
                    </div>
                )}

                <button type="submit" disabled={status.type === 'loading'} className={styles.submitBtn}>
                    {editingId ? 'Update Student' : 'Create Student Account'}
                </button>
            </form>
        </div>
    );
};

export default StudentsTab;
