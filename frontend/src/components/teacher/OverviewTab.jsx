import React, { useState, useEffect } from 'react';
import styles from './Tabs.module.css';

const OverviewTab = () => {
    const [students, setStudents] = useState([]);
    const [stats, setStats] = useState({ totalStudents: 0, presentToday: 0, latestExamAverage: 'N/A' });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeClass, setActiveClass] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

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
                (s.users && s.users.email && s.users.email.toLowerCase().includes(query))
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <h3 style={{ color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                        {activeClass ? (
                            <>
                                <button onClick={() => {setActiveClass(null); setSearchQuery('');}} style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '1.5rem', padding: 0 }}>←</button>
                                {['6', '7', '8', '9', '10', '11', '12'].includes(activeClass) ? `Class ${activeClass} ` : 'General '} Roster
                            </>
                        ) : 'Student Roster'}
                    </h3>
                    
                    <input 
                        type="text" 
                        placeholder="Search by name, email, phone..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface-hover)', color: 'var(--color-text-main)', width: '300px' }}
                    />
                </div>

                {loading ? (
                    <p>Loading data...</p>
                ) : error ? (
                    <p className={styles.errorMsg}>{error}</p>
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
                    ) : getFilteredStudents().length === 0 ? (
                        <p style={{ color: 'var(--color-text-muted)' }}>No students found.</p>
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
                                    {getFilteredStudents().map((s) => (
                                        <tr key={s.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                            <td style={{ padding: '0.75rem' }}>{s.full_name}</td>
                                            <td style={{ padding: '0.75rem' }}>{s.users?.email || 'N/A'}</td>
                                            <td style={{ padding: '0.75rem' }}>{s.phone || 'N/A'}</td>
                                            <td style={{ padding: '0.75rem' }}>{new Date(s.enrollment_date).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                )}
            </div>
        </div>
    );
};

export default OverviewTab;
