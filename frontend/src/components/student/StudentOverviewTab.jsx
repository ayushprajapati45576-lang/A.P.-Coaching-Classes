import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import styles from '../teacher/Tabs.module.css';

const StudentOverviewTab = ({ setActiveTab }) => {
    const { user } = useAuth();
    const [notices, setNotices] = useState([]);
    const [attendance, setAttendance] = useState({ present: 0, total: 0 });
    const [fees, setFees] = useState({ pendingAmount: 0 });
    const [latestResult, setLatestResult] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            setLoading(true);
            try {
                const token = localStorage.getItem('token');
                const headers = { 'Authorization': `Bearer ${token}` };

                // Fetch Notices
                const noticesRes = await fetch((import.meta.env.VITE_BACKEND_URL || '') + '/api/notices', { headers });
                if (noticesRes.ok) {
                    const noticesData = await noticesRes.json();
                    setNotices(noticesData.slice(0, 3)); // Only top 3
                }

                // Fetch Attendance
                const attRes = await fetch((import.meta.env.VITE_BACKEND_URL || '') + '/api/student/attendance', { headers });
                if (attRes.ok) {
                    const attData = await attRes.json();
                    const total = attData.length;
                    const present = attData.filter(a => a.status === 'present').length;
                    setAttendance({ present, total });
                }

                // Fetch Fees
                const feesRes = await fetch((import.meta.env.VITE_BACKEND_URL || '') + '/api/student/fees', { headers });
                if (feesRes.ok) {
                    const feesData = await feesRes.json();
                    const pending = feesData.filter(f => f.status === 'pending' || f.status === 'overdue');
                    const totalPending = pending.reduce((acc, curr) => acc + Number(curr.amount), 0);
                    setFees({ pendingAmount: totalPending });
                }

                // Fetch Results
                const resRes = await fetch((import.meta.env.VITE_BACKEND_URL || '') + '/api/student/results', { headers });
                if (resRes.ok) {
                    const resData = await resRes.json();
                    if (resData.length > 0) {
                        setLatestResult(resData[0]); // Most recent
                    }
                }
            } catch (err) {
                console.error("Error fetching overview data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    const calculateResultScore = (res) => {
        if (!res) return "N/A";
        if (res.total_marks > 0) {
            return `${((res.obtained_marks / res.total_marks) * 100).toFixed(1)}%`;
        }
        if (res.marks_data && res.marks_data.length > 0) {
            const total = res.marks_data.reduce((acc, curr) => acc + (curr.total || 0), 0);
            const obtained = res.marks_data.reduce((acc, curr) => acc + (curr.obtained || 0), 0);
            if (total > 0) return `${((obtained / total) * 100).toFixed(1)}%`;
        }
        return "N/A";
    };

    if (loading) {
        return (
            <div className={`glass-panel animate-fade-in`} style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <div className={styles.loader} style={{ margin: '0 auto 1rem' }}></div>
                <p>Loading Dashboard...</p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* Welcome Banner */}
            <div className="glass-panel" style={{ padding: '2rem', background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))', border: 'none', color: 'white', borderRadius: '12px' }}>
                <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem' }}>Welcome Back, {user?.full_name || (user?.email && user.email.split('@')[0])}! 👋</h1>
                <p style={{ margin: 0, opacity: 0.9 }}>Here is an overview of your current progress and recent updates.</p>
            </div>

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                <div style={{ background: 'linear-gradient(135deg, #43CBFF, #005BEA)', padding: '1.5rem', borderRadius: '16px', color: '#fff', boxShadow: '0 10px 20px rgba(0, 91, 234, 0.3)', border: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <h3 style={{ margin: 0, color: 'rgba(255,255,255,0.9)', fontSize: '1.1rem', fontWeight: '500' }}>Attendance</h3>
                    <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#ffffff' }}>
                        {attendance.total > 0 ? `${Math.round((attendance.present / attendance.total) * 100)}%` : 'No Data'}
                    </div>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)' }}>
                        {attendance.present} / {attendance.total} classes attended
                    </p>
                </div>

                <div style={{ background: 'linear-gradient(135deg, #B14BF4, #4D15F2)', padding: '1.5rem', borderRadius: '16px', color: '#fff', boxShadow: '0 10px 20px rgba(77, 21, 242, 0.3)', border: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <h3 style={{ margin: 0, color: 'rgba(255,255,255,0.9)', fontSize: '1.1rem', fontWeight: '500' }}>Latest Result</h3>
                    <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#ffffff' }}>
                        {calculateResultScore(latestResult)}
                    </div>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)' }}>
                        {latestResult ? latestResult.exam_name : 'No exams taken yet'}
                    </p>
                </div>

                <div style={{ background: fees.pendingAmount > 0 ? 'linear-gradient(135deg, #FF9A44, #FC6076)' : 'linear-gradient(135deg, #10b981, #059669)', padding: '1.5rem', borderRadius: '16px', color: '#fff', boxShadow: fees.pendingAmount > 0 ? '0 10px 20px rgba(252, 96, 118, 0.3)' : '0 10px 20px rgba(16, 185, 129, 0.3)', border: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <h3 style={{ margin: 0, color: 'rgba(255,255,255,0.9)', fontSize: '1.1rem', fontWeight: '500' }}>Pending Fees</h3>
                    <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#ffffff' }}>
                        ₹{fees.pendingAmount}
                    </div>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)' }}>
                        {fees.pendingAmount > 0 ? 'Action required' : 'All cleared'}
                    </p>
                </div>
            </div>

            {/* Lower Section: Notices & Quick Links */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                
                {/* Recent Announcements */}
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h2 style={{ margin: 0, color: 'var(--color-text-main)', fontSize: '1.25rem' }}>Recent Announcements</h2>
                        <button onClick={() => setActiveTab('notices')} style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', cursor: 'pointer' }}>View All →</button>
                    </div>
                    
                    {notices.length === 0 ? (
                        <p style={{ color: 'var(--color-text-muted)' }}>No new announcements.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {notices.map(n => (
                                <div key={n.id} style={{ background: 'var(--color-surface-hover)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                                    <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--color-text-main)' }}>{n.title}</h4>
                                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.content}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Quick Actions */}
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                    <h2 style={{ margin: '0 0 1rem 0', color: 'var(--color-text-main)', fontSize: '1.25rem' }}>Quick Actions</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <button onClick={() => setActiveTab('live')} className={styles.submitBtn} style={{ margin: 0, padding: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                            🔴 Join Live Class
                        </button>
                        <button onClick={() => setActiveTab('notes')} className={styles.submitBtn} style={{ margin: 0, padding: '1rem', background: 'var(--color-secondary)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                            📚 Browse Study Notes
                        </button>
                        <button onClick={() => setActiveTab('results')} className={styles.submitBtn} style={{ margin: 0, padding: '1rem', background: '#ff4d4d', color: 'var(--color-text-main)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                            📊 View Detailed Results
                        </button>
                    </div>
                </div>

            </div>

        </div>
    );
};

export default StudentOverviewTab;
