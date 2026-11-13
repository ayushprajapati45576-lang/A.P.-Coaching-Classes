import React, { useState, useEffect } from 'react';
import styles from './Tabs.module.css';

const OverviewTab = () => {
    const [students, setStudents] = useState([]);
    const [stats, setStats] = useState({ totalStudents: 0, presentToday: 0, latestExamAverage: 'N/A' });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeClass, setActiveClass] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('active'); // 'active', 'inactive', 'all'

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

    const FolderCard = ({ title, count, onClick, color, emoji = '📁' }) => (
        <div onClick={onClick} style={{
            background: `linear-gradient(135deg, var(--color-border) 0%, var(--color-surface-hover) 100%)`,
            border: `1px solid ${color}`,
            borderRadius: '12px',
            padding: '1.75rem 1.25rem',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.2s, box-shadow 0.2s',
            boxShadow: `0 4px 20px ${color}15`,
            position: 'relative'
        }}
        onMouseEnter={(e) => { 
            e.currentTarget.style.transform = 'translateY(-5px)'; 
            e.currentTarget.style.boxShadow = `0 8px 25px ${color}35`; 
        }}
        onMouseLeave={(e) => { 
            e.currentTarget.style.transform = 'translateY(0)'; 
            e.currentTarget.style.boxShadow = `0 4px 20px ${color}15`; 
        }}
        >
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>{emoji}</div>
            <h3 style={{ margin: '0 0 0.4rem 0', color: 'var(--color-text-main)', fontSize: '1.25rem', fontWeight: '600', textAlign: 'center' }}>
                {title}
            </h3>
            {count !== undefined && (
                <span style={{ 
                    fontSize: '0.85rem', 
                    color: count > 0 ? '#10b981' : 'var(--color-text-muted)',
                    fontWeight: count > 0 ? '600' : '400',
                    background: count > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    padding: '2px 10px',
                    borderRadius: '12px'
                }}>
                    {count} {count === 1 ? 'Student' : 'Students'}
                </span>
            )}
        </div>
    );

    const activeStudents = students.filter(s => s.enrollment_status !== 'inactive' && s.enrollment_status !== 'leave');
    const inactiveStudents = students.filter(s => s.enrollment_status === 'inactive' || s.enrollment_status === 'leave');

    const morningActiveCount = stats.totalMorning !== undefined 
        ? stats.totalMorning 
        : activeStudents.filter(s => s.batch === 'Morning' || s.batch === 'Both' || !s.batch).length;

    const eveningActiveCount = stats.totalEvening !== undefined 
        ? stats.totalEvening 
        : activeStudents.filter(s => s.batch === 'Evening' || s.batch === 'Both').length;

    const getFilteredStudents = () => {
        let filtered = students;

        if (statusFilter === 'active') {
            filtered = filtered.filter(s => s.enrollment_status !== 'inactive' && s.enrollment_status !== 'leave');
        } else if (statusFilter === 'inactive') {
            filtered = filtered.filter(s => s.enrollment_status === 'inactive' || s.enrollment_status === 'leave');
        }
        
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

    const getFolderCount = (classNum) => {
        let classList = students.filter(s => String(s.class_name) === String(classNum));
        if (statusFilter === 'active') classList = classList.filter(s => s.enrollment_status !== 'inactive' && s.enrollment_status !== 'leave');
        else if (statusFilter === 'inactive') classList = classList.filter(s => s.enrollment_status === 'inactive' || s.enrollment_status === 'leave');
        return classList.length;
    };

    const getOtherCount = () => {
        let list = students.filter(s => !['6','7','8','9','10','11','12'].includes(String(s.class_name)));
        if (statusFilter === 'active') list = list.filter(s => s.enrollment_status !== 'inactive' && s.enrollment_status !== 'leave');
        else if (statusFilter === 'inactive') list = list.filter(s => s.enrollment_status === 'inactive' || s.enrollment_status === 'leave');
        return list.length;
    };

    return (
        <div className={`animate-fade-in`}>
            <h2 style={{ color: 'var(--color-primary)', marginBottom: '1rem' }}>Student Analysis Overview</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ background: 'linear-gradient(135deg, #FF9A44, #FC6076)', padding: '1.5rem', textAlign: 'center', borderRadius: '16px', boxShadow: '0 10px 20px rgba(252, 96, 118, 0.3)', color: '#fff', border: 'none' }}>
                    <h3 style={{ fontSize: '2.5rem', color: '#ffffff', fontWeight: '700', marginBottom: '0.25rem' }}>{activeStudents.length}</h3>
                    <p style={{ color: 'rgba(255,255,255,0.95)', fontWeight: '600', margin: 0 }}>Total Active Students</p>
                    {inactiveStudents.length > 0 && (
                        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem', marginTop: '4px', marginBottom: 0 }}>
                            +{inactiveStudents.length} Inactive (Data Safe)
                        </p>
                    )}
                </div>
                <div style={{ 
                    background: 'linear-gradient(135deg, #43CBFF, #005BEA)', 
                    padding: '1.25rem 1rem', 
                    borderRadius: '16px', 
                    boxShadow: '0 10px 20px rgba(0, 91, 234, 0.3)', 
                    color: '#fff', 
                    border: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', width: '100%', gap: '0.5rem' }}>
                        {/* Morning Part */}
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(255,255,255,0.9)', marginBottom: '0.2rem' }}>
                                🌅 Morning
                            </div>
                            <h3 style={{ fontSize: '1.75rem', color: '#ffffff', fontWeight: '800', margin: '0 0 0.1rem 0', lineHeight: 1.1 }}>
                                {stats.presentMorning ?? 0}
                                <span style={{ fontSize: '0.95rem', fontWeight: '500', opacity: 0.85 }}> / {morningActiveCount}</span>
                            </h3>
                        </div>

                        {/* Divider Line */}
                        <div style={{ width: '1px', height: '48px', backgroundColor: 'rgba(255, 255, 255, 0.35)', borderRadius: '1px' }}></div>

                        {/* Evening Part */}
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(255,255,255,0.9)', marginBottom: '0.2rem' }}>
                                🌆 Evening
                            </div>
                            <h3 style={{ fontSize: '1.75rem', color: '#ffffff', fontWeight: '800', margin: '0 0 0.1rem 0', lineHeight: 1.1 }}>
                                {stats.presentEvening ?? 0}
                                <span style={{ fontSize: '0.95rem', fontWeight: '500', opacity: 0.85 }}> / {eveningActiveCount}</span>
                            </h3>
                        </div>
                    </div>

                    <p style={{ color: 'rgba(255,255,255,0.95)', fontWeight: '600', margin: '0.6rem 0 0 0', textAlign: 'center', fontSize: '0.9rem' }}>
                        Present Today (Attendance)
                    </p>
                </div>
                <div style={{ background: 'linear-gradient(135deg, #B14BF4, #4D15F2)', padding: '1.5rem', textAlign: 'center', borderRadius: '16px', boxShadow: '0 10px 20px rgba(77, 21, 242, 0.3)', color: '#fff', border: 'none' }}>
                    <h3 style={{ fontSize: '2.5rem', color: '#ffffff', fontWeight: '700', marginBottom: '0.25rem' }}>{stats.latestExamAverage}</h3>
                    <p style={{ color: 'rgba(255,255,255,0.95)', fontWeight: '600', margin: 0 }}>Latest Exam Average</p>
                </div>
            </div>

            <div className={`glass-panel`} style={{ padding: '1.5rem', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
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
                        style={{ padding: '0.65rem 1rem', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface-hover)', color: 'var(--color-text-main)', width: '260px' }}
                    />
                </div>

                {/* Status Filter Toggle */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center', background: 'var(--color-surface-hover)', padding: '0.35rem 0.6rem', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--color-text-muted)', marginRight: '0.25rem' }}>Show:</span>
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
                            fontSize: '0.82rem'
                        }}
                    >
                        Active ({activeStudents.length})
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
                            fontSize: '0.82rem'
                        }}
                    >
                        Inactive ({inactiveStudents.length})
                    </button>
                    <button
                        onClick={() => setStatusFilter('all')}
                        type="button"
                        style={{
                            background: statusFilter === 'all' ? 'var(--color-primary)' : 'transparent',
                            color: statusFilter === 'all' ? '#ffffff' : 'var(--color-text-main)',
                            border: statusFilter === 'all' ? 'none' : '1px solid transparent',
                            padding: '0.3rem 0.8rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '0.82rem'
                        }}
                    >
                        All ({students.length})
                    </button>
                </div>

                {loading ? (
                    <p>Loading data...</p>
                ) : error ? (
                    <p className={styles.errorMsg}>{error}</p>
                ) : (
                    !activeClass && !searchQuery.trim() ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                            <FolderCard title="Class 6" count={getFolderCount('6')} onClick={() => setActiveClass('6')} color="#ec4899" emoji="📖" />
                            <FolderCard title="Class 7" count={getFolderCount('7')} onClick={() => setActiveClass('7')} color="#8b5cf6" emoji="📙" />
                            <FolderCard title="Class 8" count={getFolderCount('8')} onClick={() => setActiveClass('8')} color="#a78bfa" emoji="📐" />
                            <FolderCard title="Class 9" count={getFolderCount('9')} onClick={() => setActiveClass('9')} color="#fb923c" emoji="🔬" />
                            <FolderCard title="Class 10" count={getFolderCount('10')} onClick={() => setActiveClass('10')} color="#60a5fa" emoji="🎒" />
                            <FolderCard title="Class 11" count={getFolderCount('11')} onClick={() => setActiveClass('11')} color="#fcd34d" emoji="🏫" />
                            <FolderCard title="Class 12" count={getFolderCount('12')} onClick={() => setActiveClass('12')} color="#34d399" emoji="🎓" />
                            <FolderCard title="General" count={getOtherCount()} onClick={() => setActiveClass('General')} color="#f472b6" emoji="📚" />
                        </div>
                    ) : getFilteredStudents().length === 0 ? (
                        <p style={{ color: 'var(--color-text-muted)' }}>No students found.</p>
                    ) : (
                        <div style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', boxSizing: 'border-box', WebkitOverflowScrolling: 'touch' }}>
                            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                        <th style={{ padding: '0.65rem 0.5rem', color: 'var(--color-text-muted)' }}>Name</th>
                                        <th style={{ padding: '0.65rem 0.5rem', color: 'var(--color-text-muted)' }}>Status</th>
                                        <th style={{ padding: '0.65rem 0.5rem', color: 'var(--color-text-muted)' }}>Class</th>
                                        <th style={{ padding: '0.65rem 0.5rem', color: 'var(--color-text-muted)' }}>Email</th>
                                        <th style={{ padding: '0.65rem 0.5rem', color: 'var(--color-text-muted)' }}>Phone</th>
                                        <th style={{ padding: '0.65rem 0.5rem', color: 'var(--color-text-muted)' }}>Enrolled Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {getFilteredStudents().map((s) => {
                                        const isInactive = s.enrollment_status === 'inactive' || s.enrollment_status === 'leave';
                                        return (
                                        <tr key={s.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                            <td style={{ padding: '0.65rem 0.5rem', fontWeight: '500', whiteSpace: 'nowrap' }}>{s.full_name}</td>
                                            <td style={{ padding: '0.65rem 0.5rem', whiteSpace: 'nowrap' }}>
                                                <span style={{
                                                    fontSize: '0.74rem',
                                                    fontWeight: '700',
                                                    padding: '2px 8px',
                                                    borderRadius: '12px',
                                                    backgroundColor: isInactive ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                                    color: isInactive ? '#ef4444' : '#10b981',
                                                    border: isInactive ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)'
                                                }}>
                                                    {isInactive ? 'Inactive' : 'Active'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.65rem 0.5rem', whiteSpace: 'nowrap' }}>{['6','7','8','9','10','11','12'].includes(String(s.class_name)) ? `Class ${s.class_name}` : s.class_name || '-'}</td>
                                            <td style={{ padding: '0.65rem 0.5rem', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.users?.email || ''}>{s.users?.email || 'N/A'}</td>
                                            <td style={{ padding: '0.65rem 0.5rem', whiteSpace: 'nowrap' }}>{s.phone || 'N/A'}</td>
                                            <td style={{ padding: '0.65rem 0.5rem', whiteSpace: 'nowrap' }}>{s.enrollment_date ? new Date(s.enrollment_date).toLocaleDateString() : '-'}</td>
                                        </tr>
                                    );
                                    })}
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
