import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import styles from './Dashboard.module.css';
import { ChevronLeft, ChevronRight, Menu } from 'lucide-react';

import OverviewTab from '../components/teacher/OverviewTab';
import StudentsTab from '../components/teacher/StudentsTab';
import NotesTab from '../components/teacher/NotesTab';
import BooksTab from '../components/teacher/BooksTab';
import AttendanceTab from '../components/teacher/AttendanceTab';
import NoticesTab from '../components/teacher/NoticesTab';
import LiveClassTab from '../components/teacher/LiveClassTab';
import ResultsTab from '../components/teacher/ResultsTab';
import FeesTab from '../components/teacher/FeesTab';
import QuizzesTab from '../components/teacher/QuizzesTab';

const TeacherDashboard = () => {
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
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    const renderTabContent = () => {
        switch (activeTab) {
            case 'overview':
                return <OverviewTab />;
            case 'students':
                return <StudentsTab />;
            case 'notes':
                return <NotesTab />;
            case 'books':
                return <BooksTab />;
            case 'attendance':
                return <AttendanceTab />;
            case 'results':
                return <ResultsTab />;
            case 'fees':
                return <FeesTab />;
            case 'notices':
                return <NoticesTab />;
            case 'live':
                return <LiveClassTab />;
            case 'quizzes':
                return <QuizzesTab />;
            default:
                return <StudentsTab />;
        }
    };

    return (
        <div className={styles.dashboardContainer}>
            {/* Mobile Overlay */}
            {isSidebarOpen && <div className={styles.overlay} onClick={() => setIsSidebarOpen(false)}></div>}

            <aside className={`glass-panel ${styles.sidebar} ${isSidebarOpen ? styles.sidebarOpen : ''} ${isSidebarCollapsed ? styles.sidebarCollapsed : ''}`}>
                <div className={styles.sidebarHeader}>
                    <div className={styles.logo}>{user?.email ? user.email.charAt(0).toUpperCase() : 'C'}</div>
                    <h2>Teacher Panel</h2>
                </div>
                <nav className={styles.nav}>
                    <button
                        className={`${styles.navItem} ${activeTab === 'overview' ? styles.activeTab : ''}`}
                        onClick={() => { setActiveTab('overview'); setIsSidebarOpen(false); }}
                    >Overview</button>
                    <button
                        className={`${styles.navItem} ${activeTab === 'students' ? styles.activeTab : ''}`}
                        onClick={() => { setActiveTab('students'); setIsSidebarOpen(false); }}
                    >Students</button>
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
                    >Quizzes</button>
                </nav>
                <div className={styles.sidebarFooter}>
                    <p style={{ fontWeight: '500', marginBottom: '0.25rem' }}>
                        {user?.email === 'prajapatianil1975@gmail.com' ? 'Anil Kumar Prajapati' : 
                         user?.email === 'teacher@coaching.com' ? 'Admin / Principal' : 
                         user?.email}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem', wordBreak: 'break-all' }}>
                        {user?.email}
                    </p>
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
                            {isSidebarCollapsed ? <ChevronRight size={24} /> : <ChevronLeft size={24} />}
                        </button>
                        <h2 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {activeTab.charAt(0).toUpperCase() + activeTab.slice(1).replace('-', ' ')}
                        </h2>
                    </div>
                </header>
                <div className={styles.content}>
                    {renderTabContent()}
                </div>
            </main>
        </div>
    );
};

export default TeacherDashboard;
