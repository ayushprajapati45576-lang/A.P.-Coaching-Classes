import React, { useState, useEffect } from 'react';
import styles from './Tabs.module.css';

const OverviewTab = () => {
    const [students, setStudents] = useState([]);
    const [stats, setStats] = useState({ totalStudents: 0, presentToday: 0, latestExamAverage: 'N/A' });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const todayDate = new Date().toISOString().split('T')[0];
            const [studentsRes, statsRes] = await Promise.all([
                fetch((import.meta.env.VITE_BACKEND_URL || '') + '/api/students', { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/dashboard/stats?date=${todayDate}`, { headers: { 'Authorization': `Bearer ${token}` } })
            ]);

            const studentsData = await studentsRes.json();
            const statsData = await statsRes.json();

            if (studentsRes.ok) setStudents(studentsData.sort((a, b) => (a.full_name || '').trim().toLowerCase().localeCompare((b.full_name || '').trim().toLowerCase())));
            if (statsRes.ok) setStats(statsData);

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`animate-fade-in`}>
            <h2 style={{ color: 'var(--color-primary)', marginBottom: '1rem' }}>Student Analysis Overview</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ background: 'linear-gradient(135deg, #FF9A44, #FC6076)', padding: '1.5rem', textAlign: 'center', borderRadius: '16px', boxShadow: '0 10px 20px rgba(252, 96, 118, 0.3)', color: '#fff', border: 'none' }}>
                    <h3 style={{ fontSize: '2.5rem', color: '#ffffff', fontWeight: '700', marginBottom: '0.5rem' }}>{students.length}</h3>
                    <p style={{ color: 'rgba(255,255,255,0.9)', fontWeight: '500' }}>Total Enrolled Students</p>
                </div>
                <div style={{ background: 'linear-gradient(135deg, #43CBFF, #005BEA)', padding: '1.5rem', textAlign: 'center', borderRadius: '16px', boxShadow: '0 10px 20px rgba(0, 91, 234, 0.3)', color: '#fff', border: 'none' }}>
                    <h3 style={{ fontSize: '2.5rem', color: '#ffffff', fontWeight: '700', marginBottom: '0.5rem' }}>{stats.presentToday} / {students.length}</h3>
                    <p style={{ color: 'rgba(255,255,255,0.9)', fontWeight: '500' }}>Present Today</p>
                </div>
                <div style={{ background: 'linear-gradient(135deg, #B14BF4, #4D15F2)', padding: '1.5rem', textAlign: 'center', borderRadius: '16px', boxShadow: '0 10px 20px rgba(77, 21, 242, 0.3)', color: '#fff', border: 'none' }}>
                    <h3 style={{ fontSize: '2.5rem', color: '#ffffff', fontWeight: '700', marginBottom: '0.5rem' }}>{stats.latestExamAverage}</h3>
                    <p style={{ color: 'rgba(255,255,255,0.9)', fontWeight: '500' }}>Latest Exam Average</p>
                </div>
            </div>

            <div className={`glass-panel`} style={{ padding: '1.5rem' }}>
                <h3 style={{ marginBottom: '1rem', color: 'var(--color-text-main)' }}>Student Roster</h3>
                {loading ? (
                    <p>Loading data...</p>
                ) : error ? (
                    <p className={styles.errorMsg}>{error}</p>
                ) : students.length === 0 ? (
                    <p style={{ color: 'var(--color-text-muted)' }}>No students enrolled yet. Add students from the Students tab.</p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                    <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Name</th>
                                    <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Email</th>
                                    <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Phone</th>
                                    <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Enrolled Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.map((s) => (
                                    <tr key={s.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                        <td style={{ padding: '0.75rem' }}>{s.full_name}</td>
                                        <td style={{ padding: '0.75rem' }}>{s.users.email}</td>
                                        <td style={{ padding: '0.75rem' }}>{s.phone || 'N/A'}</td>
                                        <td style={{ padding: '0.75rem' }}>{new Date(s.enrollment_date).toLocaleDateString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OverviewTab;
