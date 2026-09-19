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
    const [activeClass, setActiveClass] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

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
            const studentsRes = await fetch((import.meta.env.VITE_BACKEND_URL || '') + '/api/students', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const studentsData = await studentsRes.json();
            if (!studentsRes.ok) throw new Error(studentsData.error);

            setStudents(studentsData.sort((a, b) => (a.full_name || '').trim().toLowerCase().localeCompare((b.full_name || '').trim().toLowerCase())));

            const attRes = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/attendance?date=${date}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
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
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
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
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
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
                method: 'PUT',
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
            const res = await fetch((import.meta.env.VITE_BACKEND_URL || '') + '/api/attendance', {
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

    const FolderCard = ({ title, count, onClick, color }) => (
        <div onClick={onClick} style={{
            background: `linear-gradient(135deg, var(--color-border) 0%, var(--color-surface-hover) 100%)`,
            border: `1px solid ${color}`,
            borderRadius: '12px',
            padding: '2rem',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.2s, box-shadow 0.2s',
            boxShadow: `0 4px 20px ${color}20`
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = `0 8px 25px ${color}40`; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 4px 20px ${color}20`; }}
        >
            <div style={{ fontSize: '4rem', marginBottom: '1rem', color: color }}>📁</div>
            <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--color-text-main)', fontSize: '1.5rem', fontWeight: '500' }}>{title}</h3>
            <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>{count} Students</p>
        </div>
    );

    const getFilteredStudents = () => {
        let filtered = students;
        
        if (activeClass) {
            filtered = filtered.filter(s => String(s.class_name) === activeClass);
        }
        
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(s => 
                (s.full_name && s.full_name.toLowerCase().includes(query)) ||
                (s.phone && s.phone.toLowerCase().includes(query)) ||
                (s.father_name && s.father_name.toLowerCase().includes(query))
            );
        }
        
        return filtered;
    };

    const class6Students = students.filter(s => String(s.class_name) === '6');
    const class7Students = students.filter(s => String(s.class_name) === '7');
    const class8Students = students.filter(s => String(s.class_name) === '8');
    const class9Students = students.filter(s => String(s.class_name) === '9');
    const class10Students = students.filter(s => String(s.class_name) === '10');
    const class11Students = students.filter(s => String(s.class_name) === '11');
    const class12Students = students.filter(s => String(s.class_name) === '12');
    const otherStudents = students.filter(s => !['6','7','8','9','10','11','12'].includes(String(s.class_name)));

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
        return Object.values(studentStats).sort((a, b) => (a.name || '').trim().toLowerCase().localeCompare((b.name || '').trim().toLowerCase()));
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

            {viewMode === 'mark' && (() => {
                const displayStudents = getFilteredStudents();
                return (
                <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                        <h2 style={{ color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                            {activeClass ? (
                                <>
                                    <button onClick={() => {setActiveClass(null); setSearchQuery('');}} style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '1.5rem', padding: 0 }}>←</button>
                                    Mark {['6', '7', '8', '9', '10', '11', '12'].includes(activeClass) ? `Class ${activeClass}` : 'General'} Attendance
                                </>
                            ) : 'Mark Attendance'}
                        </h2>
                        
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <input 
                                type="text" 
                                placeholder="Search by name, phone..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{ padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface-hover)', color: 'var(--color-text-main)', width: '250px' }}
                            />
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className={styles.fileInput}
                                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-main)', padding: '0.75rem 1rem' }}
                            />
                        </div>
                    </div>

                    {statusMsg.message && (
                        <div className={statusMsg.type === 'error' ? styles.errorMsg : styles.successMsg} style={{ marginBottom: '1rem' }}>
                            {statusMsg.message}
                        </div>
                    )}

                    {loading ? (
                        <p>Loading roster...</p>
                    ) : (
                        !activeClass && !searchQuery.trim() ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
                                <FolderCard title="Class 6" count={class6Students.length} onClick={() => setActiveClass('6')} color="#818cf8" />
                                <FolderCard title="Class 7" count={class7Students.length} onClick={() => setActiveClass('7')} color="#c084fc" />
                                <FolderCard title="Class 8" count={class8Students.length} onClick={() => setActiveClass('8')} color="#a78bfa" />
                                <FolderCard title="Class 9" count={class9Students.length} onClick={() => setActiveClass('9')} color="#fb923c" />
                                <FolderCard title="Class 10" count={class10Students.length} onClick={() => setActiveClass('10')} color="#60a5fa" />
                                <FolderCard title="Class 11" count={class11Students.length} onClick={() => setActiveClass('11')} color="#fcd34d" />
                                <FolderCard title="Class 12" count={class12Students.length} onClick={() => setActiveClass('12')} color="#34d399" />
                                <FolderCard title="General" count={otherStudents.length} onClick={() => setActiveClass('General')} color="#f472b6" />
                            </div>
                        ) : displayStudents.length === 0 ? (
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
                                            {displayStudents.map((s) => (
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
                    )
                    )}
                </>
                );
            })()}

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
