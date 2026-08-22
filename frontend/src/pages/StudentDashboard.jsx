import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import styles from './Dashboard.module.css';

// Import student components
import StudentOverviewTab from '../components/student/StudentOverviewTab';
import StudentNotesTab from '../components/student/StudentNotesTab';
import StudentBooksTab from '../components/student/StudentBooksTab';
import StudentNoticesTab from '../components/student/StudentNoticesTab';
import StudentAttendanceTab from '../components/student/StudentAttendanceTab';
import StudentResultsTab from '../components/student/StudentResultsTab';
import StudentFeesTab from '../components/student/StudentFeesTab';
import StudentLiveClassTab from '../components/student/StudentLiveClassTab';
import StudentQuizzesTab from '../components/student/StudentQuizzesTab';

const StudentDashboard = () => {
    const { user, logout } = useAuth();
    const [activeTab, setActiveTab] = useState('overview');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const [unreadCount, setUnreadCount] = useState(0);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const profileMenuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
                setShowProfileMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Basic UI security for students
    useEffect(() => {
        const disableContextMenu = (e) => e.preventDefault();
        const disableShortcuts = (e) => {
            if (e.key === 'PrintScreen') e.preventDefault();
            if (e.ctrlKey && (e.key === 'p' || e.key === 's')) e.preventDefault();
        };

        if (import.meta.env.PROD) {
            window.addEventListener('contextmenu', disableContextMenu);
            window.addEventListener('keydown', disableShortcuts);
        }

        // Fetch unread notifications count
        const fetchUnread = async () => {
            try {
                const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/notifications/unread`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setUnreadCount(data.count);
                }
            } catch (err) {
                console.error(err);
            }
        };
        fetchUnread();

        return () => {
            if (import.meta.env.PROD) {
                window.removeEventListener('contextmenu', disableContextMenu);
                window.removeEventListener('keydown', disableShortcuts);
            }
        };
    }, []);

    return (
        <div className={styles.dashboardContainer}>
            {/* Dynamic Watermark to trace screenshots */}
            <div className={styles.watermark}>{user?.email}</div>

            {/* Mobile Overlay */}
            {isSidebarOpen && <div className={styles.overlay} onClick={() => setIsSidebarOpen(false)}></div>}

            <aside className={`glass-panel ${styles.sidebar} ${isSidebarOpen ? styles.sidebarOpen : ''}`}>
                <div className={styles.sidebarHeader}>
                    <div className={styles.logo}>{user?.email ? user.email.charAt(0).toUpperCase() : 'C'}</div>
                    <h2>Student Portal</h2>
                </div>
                <nav className={styles.nav}>
                    <button
                        className={`${styles.navItem} ${activeTab === 'overview' ? styles.activeTab : ''}`}
                        onClick={() => { setActiveTab('overview'); setIsSidebarOpen(false); }}
                    >Overview</button>
                    <button
                        className={`${styles.navItem} ${activeTab === 'notes' ? styles.activeTab : ''}`}
                        onClick={() => { setActiveTab('notes'); setIsSidebarOpen(false); }}
                    >Notes</button>
                    <button
                        className={`${styles.navItem} ${activeTab === 'books' ? styles.activeTab : ''}`}
                        onClick={() => { setActiveTab('books'); setIsSidebarOpen(false); }}
                    >Books</button>
                    <button
                        className={`${styles.navItem} ${activeTab === 'attendance' ? styles.activeTab : ''}`}
                        onClick={() => { setActiveTab('attendance'); setIsSidebarOpen(false); }}
                    >Attendance</button>
                    <button
                        className={`${styles.navItem} ${activeTab === 'results' ? styles.activeTab : ''}`}
                        onClick={() => { setActiveTab('results'); setIsSidebarOpen(false); }}
                    >Results</button>
                    <button
                        className={`${styles.navItem} ${activeTab === 'fees' ? styles.activeTab : ''}`}
                        onClick={() => { setActiveTab('fees'); setIsSidebarOpen(false); }}
                    >Fees</button>
                    <button
                        className={`${styles.navItem} ${activeTab === 'notices' ? styles.activeTab : ''}`}
                        onClick={() => { setActiveTab('notices'); setIsSidebarOpen(false); }}
                    >Notices</button>
                    <button
                        className={`${styles.navItem} ${activeTab === 'live' ? styles.activeTab : ''}`}
                        onClick={() => { setActiveTab('live'); setIsSidebarOpen(false); }}
                    >Live Class</button>
                    <button
                        className={`${styles.navItem} ${activeTab === 'quizzes' ? styles.activeTab : ''}`}
                        onClick={() => { setActiveTab('quizzes'); setIsSidebarOpen(false); }}
                    >Tests / Quizzes</button>
                </nav>
                <div className={styles.sidebarFooter}>
                    <p>{user?.email}</p>
                    <button onClick={logout} className={styles.logoutBtn}>Logout</button>
                </div>
            </aside>
            <main className={styles.mainContent}>
                <header className={styles.header}>
                    <button className={styles.hamburgerBtn} onClick={() => setIsSidebarOpen(true)}>☰</button>
                    <h1>Student Dashboard</h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginLeft: 'auto' }}>
                        <div 
                            style={{ position: 'relative', cursor: 'pointer' }} 
                            onClick={() => setActiveTab('notices')}
                            title="Notifications"
                        >
                            <span style={{ fontSize: '1.25rem' }}>🔔</span>
                            {unreadCount > 0 && (
                                <span style={{
                                    position: 'absolute', top: '-5px', right: '-5px',
                                    backgroundColor: '#ef4444', color: '#fff', fontSize: '0.65rem',
                                    fontWeight: 'bold', width: '16px', height: '16px',
                                    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    {unreadCount}
                                </span>
                            )}
                        </div>
                        <div style={{ position: 'relative' }} ref={profileMenuRef}>
                            <div 
                                style={{
                                    width: '36px', height: '36px', borderRadius: '50%',
                                    background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
                                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer'
                                }}
                                onClick={() => setShowProfileMenu(!showProfileMenu)}
                                title="My Profile"
                            >
                                {user?.email ? user.email.charAt(0).toUpperCase() : 'S'}
                            </div>
                            
                            {showProfileMenu && (
                                <div style={{
                                    position: 'absolute', top: '50px', right: '0', minWidth: '220px', maxWidth: '320px',
                                    background: '#ffffff', border: '1px solid var(--color-border)',
                                    borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', padding: '1rem',
                                    zIndex: 100
                                }}>
                                    <div style={{ paddingBottom: '0.75rem', borderBottom: '1px solid var(--color-border)', marginBottom: '0.75rem' }}>
                                        <p style={{ margin: 0, fontWeight: 'bold', color: 'var(--color-text-main)', wordBreak: 'break-all' }}>{user?.email}</p>
                                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Class: {user?.class_name}</p>
                                    </div>
                                    <button 
                                        onClick={logout} 
                                        style={{ width: '100%', padding: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer', textAlign: 'left' }}
                                    >
                                        Log out
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </header>
                <div className={styles.content}>
                    {activeTab === 'overview' && <StudentOverviewTab setActiveTab={setActiveTab} />}
                    {activeTab === 'notes' && <StudentNotesTab />}
                    {activeTab === 'books' && <StudentBooksTab />}
                    {activeTab === 'notices' && <StudentNoticesTab />}
                    {activeTab === 'attendance' && <StudentAttendanceTab />}
                    {activeTab === 'results' && <StudentResultsTab />}
                    {activeTab === 'fees' && <StudentFeesTab />}
                    {activeTab === 'live' && <StudentLiveClassTab />}
                    {activeTab === 'quizzes' && <StudentQuizzesTab />}
                </div>
            </main>
        </div>
    );
};

export default StudentDashboard;
