import React, { useState, useEffect } from 'react';
import styles from './Tabs.module.css';

const AttendanceTab = () => {
    const [viewMode, setViewMode] = useState('mark'); // 'mark' or 'report'
    
    // Mark Attendance state
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [students, setStudents] = useState([]);
    const [attendance, setAttendance] = useState({}); // student_id -> status ('present', 'absent', 'late')
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [statusMsg, setStatusMsg] = useState({ type: '', message: '' });

    // Report state
    const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [reportData, setReportData] = useState([]);
    const [reportLoading, setReportLoading] = useState(false);

    // Edit History state
    const [editingStudent, setEditingStudent] = useState(null); // { id, name }
    const [studentHistory, setStudentHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyMsg, setHistoryMsg] = useState({ type: '', message: '' });

    useEffect(() => {
        if (viewMode === 'mark') {
            fetchData();
        } else if (viewMode === 'report' && !editingStudent) {
            fetchReportData();
        }
    }, [date, viewMode, reportMonth]);

    const fetchData = async () => {
        setLoading(true);
        setStatusMsg({ type: '', message: '' });
        try {
            const studentsRes = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/students`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const studentsData = await studentsRes.json();
            if (!studentsRes.ok) throw new Error(studentsData.error);

            setStudents(studentsData);

            const attRes = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/attendance?date=${date}`, {
                headers: { `Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const attData = await attRes.json();

            const attMap = {};
            if (attRes.ok && attData.length > 0) {
                attData.forEach(record => {
                    attMap[record.student_id] = record.status;
                });
            } else {
                studentsData.forEach(s => {
                    attMap[s.id] = 'present';
                });
            }
            setAttendance(attMap);
        } catch (err) {
            setStatusMsg({ type: 'error', message: err.message });
        } finally {
            setLoading(false);
        }
    };

    const fetchReportData = async () => {
        setReportLoading(true);
        try {
            const [year, month] = reportMonth.split('-');
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/attendance/report?month=${month}&year=${year}`, {
                headers: { `Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (res.ok) {
                setReportData(data);
            } else {
                throw new Error(data.error);
            }
        } catch (err) {
            setStatusMsg({ type: 'error', message: err.message });
        } finally {
            setReportLoading(false);
        }
    };

    const fetchStudentHistory = async (studentId, studentName) => {
        setEditingStudent({ id: studentId, name: studentName });
        setHistoryLoading(true);
        setHistoryMsg({ type: '', message: '' });
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/attendance/student/${studentId}`, {
                headers: { `Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (res.ok) {
                setStudentHistory(data);
            } else {
                throw new Error(data.error);
            }
        } catch (err) {
            setHistoryMsg({ type: 'error', message: err.message });
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleUpdateHistoryRecord = async (recordId, newStatus) => {
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/attendance/${recordId}`, {
                method: `PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) {
                setStudentHistory(prev => prev.map(r => r.id === recordId ? { ...r, status: newStatus } : r));
                setHistoryMsg({ type: 'success', message: 'Record updated successfully!' });
                setTimeout(() => setHistoryMsg({ type: '', message: '' }), 3000);
            } else {
                const data = await res.json();
                throw new Error(data.error || 'Failed to update record');
            }
        } catch (err) {
            setHistoryMsg({ type: 'error', message: err.message });
        }
    };

    const handleStatusChange = (studentId, newStatus) => {
        setAttendance(prev => ({
            ...prev,
            [studentId]: newStatus
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        setStatusMsg({ type: 'loading', message: 'Saving attendance...' });

        const records = students.map(s => ({
            student_id: s.id,
            status: attendance[s.id] || 'present'
        }));

        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/attendance`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ date, records })
            });
            const data = await res.json();
            if (res.ok) {
                setStatusMsg({ type: 'success', message: 'Attendance saved successfully!' });
            } else {
                throw new Error(data.error || 'Failed to save attendance');
            }
        } catch (err) {
            setStatusMsg({ type: 'error', message: err.message });
        } finally {
            setSaving(false);
        }
    };

    const processReport = () => {
        const studentStats = {};
        reportData.forEach(record => {
            if (!studentStats[record.student_id]) {
                studentStats[record.student_id] = {
                    student_id: record.student_id,
                    name: record.full_name,
                    present: 0,
                    absent: 0,
                    late: 0,
                    total: 0
                };
            }
            studentStats[record.student_id][record.status]++;
            studentStats[record.student_id].total++;
        });
        return Object.values(studentStats);
    };

    const stats = processReport();

    return (
        <div className={`glass-panel animate-fade-in`} style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                <button 
                    onClick={() => { setViewMode('mark'); setEditingStudent(null); }}
                    style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '4px',
                        border: 'none',
                        background: viewMode === 'mark' ? 'var(--color-primary)' : 'var(--color-surface)',
                        color: viewMode === 'mark' ? '#fff' : 'var(--color-text-main)',
                        cursor: 'pointer',
                        fontWeight: '600',
                        transition: 'all 0.2s'
                    }}
                >
                    Mark Attendance
                </button>
                <button 
                    onClick={() => setViewMode('report')}
                    style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '4px',
                        border: 'none',
                        background: viewMode === 'report' ? 'var(--color-primary)' : 'var(--color-surface)',
                        color: viewMode === 'report' ? '#fff' : 'var(--color-text-main)',
                        cursor: 'pointer',
                        fontWeight: '600',
                        transition: 'all 0.2s'
                    }}
                >
                    View Report
                </button>
            </div>

            {viewMode === 'mark' && (
                <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                        <h2 style={{ color: 'var(--color-primary)' }}>Mark Attendance</h2>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className={styles.fileInput}
                            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'var(--color-text-main)' }}
                        />
                    </div>

                    {statusMsg.message && (
                        <div className={statusMsg.type === 'error' ? styles.errorMsg : styles.successMsg} style={{ marginBottom: '1rem' }}>
                            {statusMsg.message}
                        </div>
                    )}

                    {loading ? (
                        <p>Loading roster...</p>
                    ) : students.length === 0 ? (
                        <p style={{ color: 'var(--color-text-muted)' }}>No students found to mark attendance.</p>
                    ) : (
                        <>
                            <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
                                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                            <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Student Name</th>
                                            <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>Present</th>
                                            <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>Absent</th>
                                            <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>Late</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {students.map((s) => (
                                            <tr key={s.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                                <td style={{ padding: '0.75rem' }}>{s.full_name}</td>
                                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                                    <input
                                                        type="radio"
                                                        name={`status_${s.id}`}
                                                        checked={attendance[s.id] === 'present'}
                                                        onChange={() => handleStatusChange(s.id, 'present')}
                                                    />
                                                </td>
                                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                                    <input
                                                        type="radio"
                                                        name={`status_${s.id}`}
                                                        checked={attendance[s.id] === 'absent'}
                                                        onChange={() => handleStatusChange(s.id, 'absent')}
                                                    />
                                                </td>
                                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                                    <input
                                                        type="radio"
                                                        name={`status_${s.id}`}
                                                        checked={attendance[s.id] === 'late'}
                                                        onChange={() => handleStatusChange(s.id, 'late')}
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className={styles.submitBtn}
                                style={{ width: '100%' }}
                            >
                                {saving ? 'Saving...' : 'Save Attendance'}
                            </button>
                        </>
                    )}
                </>
            )}

            {viewMode === 'report' && (
                <div className="animate-fade-in">
                    {editingStudent ? (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                                <button 
                                    onClick={() => { setEditingStudent(null); fetchReportData(); }} 
                                    style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '1.2rem', padding: '0' }}
                                >
                                    &larr; Back
                                </button>
                                <h2 style={{ color: 'var(--color-primary)', margin: 0 }}>History: {editingStudent.name}</h2>
                            </div>

                            {historyMsg.message && (
                                <div className={historyMsg.type === 'error' ? styles.errorMsg : styles.successMsg} style={{ marginBottom: '1rem' }}>
                                    {historyMsg.message}
                                </div>
                            )}

                            {historyLoading ? (
                                <p>Loading history...</p>
                            ) : studentHistory.length === 0 ? (
                                <p style={{ color: 'var(--color-text-muted)' }}>No attendance records found.</p>
                            ) : (
                                <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
                                    <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                                <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Date</th>
                                                <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Status</th>
                                                <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>Change To</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {studentHistory.map(record => (
                                                <tr key={record.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                                    <td style={{ padding: '0.75rem' }}>{record.date}</td>
                                                    <td style={{ 
                                                        padding: '0.75rem', 
                                                        color: record.status === 'present' ? '#4caf50' : record.status === 'absent' ? '#f44336' : '#ff9800',
                                                        textTransform: 'capitalize',
                                                        fontWeight: 'bold'
                                                    }}>
                                                        {record.status}
                                                    </td>
                                                    <td style={{ padding: '0.75rem', textAlign: 'center', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                                        {record.status !== 'present' && (
                                                            <button onClick={() => handleUpdateHistoryRecord(record.id, 'present')} style={{ padding: '0.3rem 0.6rem', background: '#4caf5022', color: '#4caf50', border: '1px solid #4caf50', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>Present</button>
                                                        )}
                                                        {record.status !== 'absent' && (
                                                            <button onClick={() => handleUpdateHistoryRecord(record.id, 'absent')} style={{ padding: '0.3rem 0.6rem', background: '#f4433622', color: '#f44336', border: '1px solid #f44336', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>Absent</button>
                                                        )}
                                                        {record.status !== 'late' && (
                                                            <button onClick={() => handleUpdateHistoryRecord(record.id, 'late')} style={{ padding: '0.3rem 0.6rem', background: '#ff980022', color: '#ff9800', border: '1px solid #ff9800', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>Late</button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                                <h2 style={{ color: 'var(--color-primary)', margin: 0 }}>Monthly Attendance Report</h2>
                                <input
                                    type="month"
                                    value={reportMonth}
                                    onChange={(e) => setReportMonth(e.target.value)}
                                    className={styles.fileInput}
                                    style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'var(--color-text-main)' }}
                                />
                            </div>

                            {reportLoading ? (
                                <p>Loading report...</p>
                            ) : stats.length === 0 ? (
                                <p style={{ color: 'var(--color-text-muted)' }}>No attendance records found for this month.</p>
                            ) : (
                                <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
                                    <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                                <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Student Name</th>
                                                <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>Total Classes</th>
                                                <th style={{ padding: '0.75rem', color: '#4caf50', textAlign: 'center' }}>Present</th>
                                                <th style={{ padding: '0.75rem', color: '#f44336', textAlign: 'center' }}>Absent</th>
                                                <th style={{ padding: '0.75rem', color: '#ff9800', textAlign: 'center' }}>Late</th>
                                                <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {stats.map((s, index) => (
                                                <tr key={index} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                                    <td style={{ padding: '0.75rem' }}>{s.name}</td>
                                                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>{s.total}</td>
                                                    <td style={{ padding: '0.75rem', textAlign: 'center', color: '#4caf50' }}>{s.present}</td>
                                                    <td style={{ padding: '0.75rem', textAlign: 'center', color: '#f44336' }}>{s.absent}</td>
                                                    <td style={{ padding: '0.75rem', textAlign: 'center', color: '#ff9800' }}>{s.late}</td>
                                                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                                        <button 
                                                            onClick={() => fetchStudentHistory(s.student_id, s.name)}
                                                            style={{ 
                                                                background: 'transparent', 
                                                                color: 'var(--color-primary)', 
                                                                border: '1px solid var(--color-primary)', 
                                                                padding: '0.3rem 0.8rem', 
                                                                borderRadius: '4px', 
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s'
                                                            }}
                                                            onMouseOver={(e) => {
                                                                e.target.style.background = 'var(--color-primary)';
                                                                e.target.style.color = '#fff';
                                                            }}
                                                            onMouseOut={(e) => {
                                                                e.target.style.background = 'transparent';
                                                                e.target.style.color = 'var(--color-primary)';
                                                            }}
                                                        >
                                                            Edit
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default AttendanceTab;
