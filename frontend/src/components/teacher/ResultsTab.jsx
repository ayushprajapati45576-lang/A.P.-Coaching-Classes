import React, { useState, useEffect } from 'react';
import styles from './Tabs.module.css';

const ResultsTab = () => {
    const [view, setView] = useState('list'); // 'list' or 'add'

    // List State
    const [results, setResults] = useState([]);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);

    // Form State
    const [formData, setFormData] = useState({ student_id: '', exam_name: '', marks_data: [{ subject: '', obtained_marks: '', total_marks: '' }], date: '', status: 'Pass' });
    const [status, setStatus] = useState({ type: '', message: '' });

    useEffect(() => {
        if (view === 'list') {
            fetchResults();
        } else if (view === 'add' && students.length === 0) {
            fetchStudents();
        }
    }, [view]);

    const fetchResults = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/results`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (res.ok) setResults(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchStudents = async () => {
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/students`, {
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
        if (!window.confirm("Delete this result?")) return;
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/results/${id}`, {
                method: `DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                setResults(results.filter(r => r.id !== id));
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus({ type: 'loading', message: 'Saving result...' });

        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/results`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(formData)
            });

            const data = await res.json();
            if (res.ok) {
                setStatus({ type: 'success', message: 'Result saved successfully!' });
                setFormData({ student_id: students[0]?.id || '', exam_name: '', marks_data: [{ subject: '', obtained_marks: '', total_marks: '' }], date: '', status: 'Pass' });
                setTimeout(() => setView('list'), 1500);
            } else {
                setStatus({ type: 'error', message: data.error || 'Failed to save result' });
            }
        } catch (err) {
            setStatus({ type: 'error', message: err.message });
        }
    };

    if (view === 'list') {
        return (
            <div className={`glass-panel animate-fade-in`} style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <h2 style={{ color: 'var(--color-primary)', margin: 0 }}>Manage Results</h2>
                    <button onClick={() => setView('add')} className={styles.submitBtn} style={{ margin: 0 }}>
                        + Add Result
                    </button>
                </div>

                {loading ? <p>Loading...</p> : results.length === 0 ? <p>No results found.</p> : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                    <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Student</th>
                                    <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Exam</th>
                                    <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Subjects</th>
                                    <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Total Score</th>
                                    <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Status</th>
                                    <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Date</th>
                                    <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.map((r) => {
                                    let total = 0;
                                    let obtained = 0;
                                    let subjectsList = '-';

                                    if (r.marks_data && Array.isArray(r.marks_data)) {
                                        total = r.marks_data.reduce((sum, item) => sum + Number(item.total_marks || 0), 0);
                                        obtained = r.marks_data.reduce((sum, item) => sum + Number(item.obtained_marks || 0), 0);
                                        subjectsList = r.marks_data.map(m => m.subject).join(', ') || '-';
                                    } else {
                                        // Fallback for old schema
                                        total = Number(r.total_marks || 0);
                                        obtained = Number(r.obtained_marks || 0);
                                        subjectsList = r.subject || '-';
                                    }

                                    const percentage = total ? ((obtained / total) * 100).toFixed(1) : 0;

                                    return (
                                        <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                            <td style={{ padding: '0.75rem' }}>{r.students?.full_name}</td>
                                            <td style={{ padding: '0.75rem' }}>{r.exam_name}</td>
                                            <td style={{ padding: '0.75rem' }}>{subjectsList.length > 30 ? subjectsList.substring(0, 30) + '...' : subjectsList}</td>
                                            <td style={{ padding: '0.75rem' }}>{obtained} / {total} ({percentage}%)</td>
                                            <td style={{ padding: '0.75rem' }}>
                                                <span style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.875rem', background: r.status === 'Fail' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)', color: r.status === 'Fail' ? '#ef4444' : '#22c55e' }}>
                                                    {r.status || 'Pass'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.75rem' }}>{new Date(r.date).toLocaleDateString()}</td>
                                            <td style={{ padding: '0.75rem' }}>
                                                <button onClick={() => handleDelete(r.id)} style={{ background: 'transparent', color: 'var(--color-danger)', border: 'none', cursor: 'pointer', padding: 0 }}>Delete</button>
                                            </td>
                                        </tr>
                                    );
                                })}
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
                <h2 style={{ margin: 0 }}>Add Exam Result</h2>
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
                    <label>Exam Name</label>
                    <input required type="text" value={formData.exam_name} onChange={e => setFormData({ ...formData, exam_name: e.target.value })} />
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-muted)' }}>Subjects & Marks</label>
                    {formData.marks_data.map((mark, index) => (
                        <div key={index} style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                            <div className={styles.inputGroup} style={{ flex: 2, marginBottom: 0 }}>
                                <input placeholder="Subject Name" required type="text" value={mark.subject} onChange={e => {
                                    const newData = [...formData.marks_data];
                                    newData[index].subject = e.target.value;
                                    setFormData({ ...formData, marks_data: newData });
                                }} />
                            </div>
                            <div className={styles.inputGroup} style={{ flex: 1, marginBottom: 0 }}>
                                <input placeholder="Obtained" required type="number" min="0" step="0.1" value={mark.obtained_marks} onChange={e => {
                                    const newData = [...formData.marks_data];
                                    newData[index].obtained_marks = e.target.value;
                                    setFormData({ ...formData, marks_data: newData });
                                }} />
                            </div>
                            <div className={styles.inputGroup} style={{ flex: 1, marginBottom: 0 }}>
                                <input placeholder="Total" required type="number" min="1" step="0.1" value={mark.total_marks} onChange={e => {
                                    const newData = [...formData.marks_data];
                                    newData[index].total_marks = e.target.value;
                                    setFormData({ ...formData, marks_data: newData });
                                }} />
                            </div>
                            {formData.marks_data.length > 1 && (
                                <button type="button" onClick={() => {
                                    const newData = formData.marks_data.filter((_, i) => i !== index);
                                    setFormData({ ...formData, marks_data: newData });
                                }} style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '4px', cursor: 'pointer', height: '100%' }}>
                                    X
                                </button>
                            )}
                        </div>
                    ))}
                    <button type="button" onClick={() => setFormData({ ...formData, marks_data: [...formData.marks_data, { subject: '', obtained_marks: '', total_marks: '' }] })} style={{ background: 'transparent', color: 'var(--color-primary)', border: '1px solid var(--color-primary)', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.875rem' }}>
                        + Add Another Subject
                    </button>
                </div>

                <div className={styles.inputGroup}>
                    <label>Exam Date</label>
                    <input required type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                </div>

                <div className={styles.inputGroup}>
                    <label>Status</label>
                    <select required value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                        <option value="Pass">Pass</option>
                        <option value="Fail">Fail</option>
                    </select>
                </div>

                {status.message && (
                    <div className={status.type === 'error' ? styles.errorMsg : styles.successMsg}>
                        {status.message}
                    </div>
                )}

                <button type="submit" disabled={status.type === 'loading'} className={styles.submitBtn}>
                    Save Result
                </button>
            </form>
        </div>
    );
};

export default ResultsTab;
