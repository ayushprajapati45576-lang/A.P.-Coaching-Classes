import React, { useState, useEffect } from 'react';
import styles from '../teacher/Tabs.module.css';

const StudentAttendanceTab = () => {
    const [attendance, setAttendance] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAttendance();
    }, []);

    const fetchAttendance = async () => {
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/student/attendance`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (res.ok) setAttendance(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const getStatusStyle = (status) => {
        switch(status?.toLowerCase()) {
            case 'present': return { background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' };
            case 'absent': return { background: 'rgba(239, 68, 68, 0.2)', color: 'var(--color-danger)' };
            case 'late': return { background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' };
            default: return {};
        }
    };

    return (
        <div className={`glass-panel animate-fade-in`} style={{ padding: '1.5rem' }}>
            <h2 style={{ color: 'var(--color-primary)', marginBottom: '1.5rem', margin: 0 }}>My Attendance Record</h2>
            
            {loading ? <p>Loading...</p> : attendance.length === 0 ? <p>No attendance records found.</p> : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Date</th>
                                <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {attendance.map((a) => (
                                <tr key={a.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                    <td style={{ padding: '0.75rem' }}>{new Date(a.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td>
                                    <td style={{ padding: '0.75rem' }}>
                                        <span style={{ 
                                            padding: '4px 8px', 
                                            borderRadius: '4px', 
                                            fontSize: '0.8rem',
                                            textTransform: 'uppercase',
                                            ...getStatusStyle(a.status)
                                        }}>
                                            {a.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default StudentAttendanceTab;
