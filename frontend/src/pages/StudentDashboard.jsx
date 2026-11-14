import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { useAuth } from '../contexts/AuthContext';
import styles from './Dashboard.module.css';
import { ChevronLeft, ChevronRight, Menu, X, Loader2 } from 'lucide-react';

// Lazily load student components for rapid dashboard loading & small initial bundle
const StudentOverviewTab = lazy(() => import('../components/student/StudentOverviewTab'));
const StudentNotesTab = lazy(() => import('../components/student/StudentNotesTab'));
const StudentBooksTab = lazy(() => import('../components/student/StudentBooksTab'));
const StudentNoticesTab = lazy(() => import('../components/student/StudentNoticesTab'));
const StudentAttendanceTab = lazy(() => import('../components/student/StudentAttendanceTab'));
const StudentResultsTab = lazy(() => import('../components/student/StudentResultsTab'));
const StudentFeesTab = lazy(() => import('../components/student/StudentFeesTab'));
const StudentLiveClassTab = lazy(() => import('../components/student/StudentLiveClassTab'));
const StudentQuizzesTab = lazy(() => import('../components/student/StudentQuizzesTab'));

const TabLoader = () => (
    <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '260px',
        width: '100%',
        color: '#E08A00',
        gap: '10px',
        fontSize: '0.92rem',
        fontWeight: '600'
    }}>
        <Loader2 size={24} className="animate-spin" />
        <span>Loading Tab...</span>
    </div>
);

const StudentDashboard = () => {
    const { user, logout } = useAuth();
    const [activeTab, setActiveTab] = useState(() => {
        const hash = window.location.hash.replace('#', '');
        return hash || 'overview';
    });
    
    useEffect(() => {
        window.location.hash = activeTab;
    }, [activeTab]);

    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash.replace('#', '');
            if (hash) setActiveTab(hash);
        };
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false); // For Mobile
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false); // For Desktop
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const [unreadCount, setUnreadCount] = useState(0);
    const [activeToast, setActiveToast] = useState(null);
    const [notificationPermission, setNotificationPermission] = useState(
        typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied'
    );
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const profileMenuRef = useRef(null);

    const playNotificationSound = () => {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, ctx.currentTime);
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.35);
        } catch (e) {}
    };

    const triggerSystemNotification = (notice) => {
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
                const notif = new Notification(`A.P. Coaching: ${notice.title}`, {
                    body: notice.content ? notice.content.substring(0, 100) : 'Tap to read new announcement',
                    icon: '/logo.jpeg',
                    badge: '/logo.jpeg',
                    tag: notice.id
                });
                notif.onclick = () => {
                    window.focus();
                    setActiveTab('notices');
                };
            } catch (e) {
                console.warn('System notification error:', e);
            }
        }
    };

    const requestNotificationPermission = async () => {
        if (!('Notification' in window)) return;
        try {
            const perm = await Notification.requestPermission();
            setNotificationPermission(perm);
            if (perm === 'granted') {
                playNotificationSound();
            }
        } catch (e) {}
    };

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

        return () => {
            if (import.meta.env.PROD) {
                window.removeEventListener('contextmenu', disableContextMenu);
                window.removeEventListener('keydown', disableShortcuts);
            }
        };
    }, []);

    // Real-time periodic notification check
    useEffect(() => {
        let isMounted = true;

        const checkNotifications = async () => {
            try {
                const lastSeen = localStorage.getItem('last_seen_notice_time') || '';
                const query = lastSeen ? `?lastSeen=${encodeURIComponent(lastSeen)}` : '';
                const backendUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                    ? 'http://localhost:5000'
                    : (import.meta.env.VITE_BACKEND_URL || '');

                const res = await fetch(backendUrl + '/api/notifications/unread' + query, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });

                if (res.ok && isMounted) {
                    const data = await res.json();
                    setUnreadCount(data.count || 0);

                    if (data.latestNotice) {
                        const lastNotifiedId = localStorage.getItem('last_notified_notice_id');
                        if (data.latestNotice.id !== lastNotifiedId) {
                            localStorage.setItem('last_notified_notice_id', data.latestNotice.id);
                            setActiveToast(data.latestNotice);
                            playNotificationSound();
                            triggerSystemNotification(data.latestNotice);
                        }
                    }
                }
            } catch (err) {
                // Ignore transient errors
            }
        };

        checkNotifications();
        const interval = setInterval(() => {
            if (!document.hidden) checkNotifications();
        }, 15000); // Check every 15 seconds when tab is active

        const handleVisibilityChange = () => {
            if (!document.hidden) checkNotifications();
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            isMounted = false;
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    // Auto-dismiss in-app toast after 8 seconds
    useEffect(() => {
        if (activeToast) {
            const timer = setTimeout(() => setActiveToast(null), 8000);
            return () => clearTimeout(timer);
        }
    }, [activeToast]);

    return (
        <div className={styles.dashboardContainer}>
            {/* Real-time Notification Toast Banner */}
            {activeToast && (
                <div className={styles.notificationToast}>
                    <div className={styles.toastIcon}>📢</div>
                    <div className={styles.toastBody}>
                        <div className={styles.toastTitle}>{activeToast.title}</div>
                        <div className={styles.toastContent}>{activeToast.content}</div>
                        <div className={styles.toastActions}>
                            <button 
                                onClick={() => { 
                                    setActiveTab('notices'); 
                                    setUnreadCount(0);
                                    localStorage.setItem('last_seen_notice_time', new Date().toISOString());
                                    setActiveToast(null); 
                                }} 
                                className={styles.toastViewBtn}
                            >
                                View Notice
                            </button>
                            <button 
                                onClick={() => setActiveToast(null)} 
                                className={styles.toastCloseBtn} 
                                aria-label="Close"
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Dynamic Watermark to trace screenshots */}
            <div className={styles.watermark}>{user?.email}</div>

            {/* Mobile Overlay */}
            {isSidebarOpen && <div className={styles.overlay} onClick={() => setIsSidebarOpen(false)}></div>}

            <aside className={`glass-panel ${styles.sidebar} ${isSidebarOpen ? styles.sidebarOpen : ''} ${isSidebarCollapsed ? styles.sidebarCollapsed : ''}`}>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button className={styles.hamburgerBtn} onClick={() => {
                            if (window.innerWidth <= 768) {
                                setIsSidebarOpen(true);
                            } else {
                                setIsSidebarCollapsed(!isSidebarCollapsed);
                            }
                        }}>
                            {isMobile ? <Menu size={24} /> : (isSidebarCollapsed ? <Menu size={24} /> : <X size={24} />)}
                        </button>
                        <h2 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {activeTab.charAt(0).toUpperCase() + activeTab.slice(1).replace('-', ' ')}
                        </h2>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: 'auto' }}>
                        {notificationPermission === 'default' && (
                            <button 
                                onClick={requestNotificationPermission}
                                className={styles.enableNotifBtn}
                                title="Click to get notifications when your teacher posts updates"
                            >
                                <span>🔔</span>
                                <span style={{ display: isMobile ? 'none' : 'inline' }}>Enable Alerts</span>
                            </button>
                        )}
                        <div 
                            style={{ position: 'relative', cursor: 'pointer' }} 
                            onClick={() => {
                                setActiveTab('notices');
                                setUnreadCount(0);
                                localStorage.setItem('last_seen_notice_time', new Date().toISOString());
                                setActiveToast(null);
                            }}
                            title="Notifications"
                        >
                            <span style={{ fontSize: '1.3rem' }}>🔔</span>
                            {unreadCount > 0 && (
                                <span style={{
                                    position: 'absolute', top: '-5px', right: '-5px',
                                    backgroundColor: '#ef4444', color: '#fff', fontSize: '0.65rem',
                                    fontWeight: 'bold', width: '18px', height: '18px',
                                    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)'
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
                    <Suspense fallback={<TabLoader />}>
                        {activeTab === 'overview' && <StudentOverviewTab setActiveTab={setActiveTab} />}
                        {activeTab === 'notes' && <StudentNotesTab />}
                        {activeTab === 'books' && <StudentBooksTab />}
                        {activeTab === 'notices' && <StudentNoticesTab />}
                        {activeTab === 'attendance' && <StudentAttendanceTab />}
                        {activeTab === 'results' && <StudentResultsTab />}
                        {activeTab === 'fees' && <StudentFeesTab />}
                        {activeTab === 'live' && <StudentLiveClassTab />}
                        {activeTab === 'quizzes' && <StudentQuizzesTab />}
                    </Suspense>
                </div>
            </main>
        </div>
    );
};

export default StudentDashboard;
