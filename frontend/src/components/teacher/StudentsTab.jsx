import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm, useAlert } from '../../contexts/ConfirmContext';
import styles from './Tabs.module.css';

const StudentsTab = () => {
    const { user } = useAuth();
    const confirm = useConfirm();
    const alert = useAlert();
    const [view, setView] = useState('list'); // 'list', 'add', or 'edit'
    const [editingId, setEditingId] = useState(null);

    // List State
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState([]);
    const [activeClass, setActiveClass] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'enrolled', 'leave'


    // Form State
    const [formData, setFormData] = useState({ email: '', password: '', fullName: '', fatherName: '', phone: '', class_name: '10', batch: 'Both' });
    const [status, setStatus] = useState({ type: '', message: '' });

    useEffect(() => {
        if (view === 'list') {
            fetchStudents();
        }
    }, [view]);

    const fetchStudents = async () => {
        setLoading(true);
        try {
            const res = await fetch((import.meta.env.VITE_BACKEND_URL || '') + '/api/students', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (res.ok) setStudents(data.sort((a, b) => (a.full_name || '').trim().toLowerCase().localeCompare((b.full_name || '').trim().toLowerCase())));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        const ok = await confirm({
            title: 'Delete Student?',
            message: 'Are you sure you want to delete this student? This action cannot be undone.',
            confirmText: 'Delete Student',
            cancelText: 'Cancel',
            isDanger: true
        });
        if (!ok) return;

        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/students/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });

            if (res.ok) {
                setStudents(students.filter(s => s.id !== id));
                setSelectedIds(selectedIds.filter(selId => selId !== id));
            } else {
                const data = await res.json();
                await alert({ title: 'Error', message: data.error || 'Failed to delete student', isDanger: true });
            }
        } catch (err) {
            console.error(err);
            await alert({ title: 'Error', message: 'Failed to delete student', isDanger: true });
        }
    };

    const handleApprove = async (id) => {
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/students/${id}/approve`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });

            if (res.ok) {
                setStudents(students.map(s => s.id === id ? { ...s, is_approved: 1 } : s));
            } else {
                const data = await res.json();
                await alert({ title: 'Error', message: data.error || 'Failed to approve student', isDanger: true });
            }
        } catch (err) {
            console.error(err);
            await alert({ title: 'Error', message: 'Failed to approve student', isDanger: true });
        }
    };

    const handleToggleStatus = async (id, newStatus, studentName) => {
        const isNowInactive = newStatus === 'inactive' || newStatus === 'leave';
        const confirmMsg = isNowInactive
            ? `Kya aap "${studentName}" ko 'Inactive' mark karna chahte hain?\n\n• Baccha active dashboard counts se hat jayega.\n• Bacche ka koi bhi purana data (attendance, fees, marks) delete nahi hoga aur bilkul safe rahega.\n• Baccha portal me login nahi kar payega jab tak inactive hai.\n• Aap ise baad me kabhi bhi wapas 'Active' kar sakte hain.`
            : `Kya aap "${studentName}" ko wapas 'Active' mark karna chahte hain?\n\n• Baccha active dashboard roster aur counts me shamil ho jayega.\n• Baccha portal login kar payega.`;
        
        const ok = await confirm({
            title: isNowInactive ? 'Mark Student Inactive?' : 'Mark Student Active?',
            message: confirmMsg,
            confirmText: isNowInactive ? 'Mark Inactive' : 'Mark Active',
            cancelText: 'Cancel',
            isDanger: isNowInactive
        });
        if (!ok) return;

        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/students/${id}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ status: newStatus })
            });

            const data = await res.json();
            if (res.ok) {
                setStudents(prev => prev.map(s => s.id === id ? { ...s, enrollment_status: newStatus } : s));
            } else {
                await alert({ title: 'Error', message: data.error || 'Failed to update student status', isDanger: true });
            }
        } catch (err) {
            console.error(err);
            await alert({ title: 'Error', message: 'Failed to update student status', isDanger: true });
        }
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) setSelectedIds(students.map(s => s.id));
        else setSelectedIds([]);
    };

    const handleSelectOne = (id) => {
        if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(i => i !== id));
        else setSelectedIds([...selectedIds, id]);
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        const ok = await confirm({
            title: 'Delete Selected Students?',
            message: `Are you sure you want to delete ${selectedIds.length} students? This cannot be undone.`,
            confirmText: `Delete ${selectedIds.length} Students`,
            cancelText: 'Cancel',
            isDanger: true
        });
        if (!ok) return;

        try {
            const res = await fetch((import.meta.env.VITE_BACKEND_URL || '') + '/api/students/bulk-delete', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}` 
                },
                body: JSON.stringify({ ids: selectedIds })
            });

            if (res.ok) {
                setStudents(students.filter(s => !selectedIds.includes(s.id)));
                setSelectedIds([]);
            } else {
                const data = await res.json();
                await alert({ title: 'Error', message: data.error || 'Failed to delete students', isDanger: true });
            }
        } catch (err) {
            console.error(err);
            await alert({ title: 'Error', message: 'Failed to delete students', isDanger: true });
        }
    };



    const handleSubmit = async (e) => {
        e.preventDefault();

        const cleanEmail = formData.email ? formData.email.trim().toLowerCase() : '';
        const duplicateStudent = cleanEmail 
            ? students.find(s => s.users?.email?.trim().toLowerCase() === cleanEmail && s.id !== editingId) 
            : null;

        if (duplicateStudent) {
            setStatus({ 
                type: 'error', 
                message: `⚠️ Warning: This email is already registered with student "${duplicateStudent.full_name}" (${duplicateStudent.class_name ? `Class ${duplicateStudent.class_name}` : 'General'}). Please use a different email.` 
            });
            return;
        }

        setStatus({ type: 'loading', message: editingId ? 'Updating student...' : 'Creating student...' });
        try {
            const url = editingId 
                ? `${import.meta.env.VITE_BACKEND_URL || ''}/api/students/${editingId}` 
                : `${import.meta.env.VITE_BACKEND_URL || ''}/api/students`;
            const method = editingId ? 'PUT' : 'POST';

            // For editing, only send password if it's provided
            const payload = { ...formData, email: cleanEmail };
            if (editingId && !payload.password) {
                delete payload.password;
            }

            const res = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (res.ok) {
                setStatus({ type: 'success', message: editingId ? 'Student updated successfully!' : 'Student created successfully!' });
                setFormData({ email: '', password: '', fullName: '', fatherName: '', phone: '', class_name: '10', batch: 'Both' });
                setEditingId(null);
                await fetchStudents();
                setTimeout(() => {
                    setView('list');
                    setStatus({ type: '', message: '' });
                }, 1500); // Go back to list
            } else {
                setStatus({ type: 'error', message: data.error || (editingId ? 'Failed to update student' : 'Failed to create student') });
            }
        } catch (err) {
            setStatus({ type: 'error', message: err.message });
        }
    };

    const handleEditClick = (student) => {
        setFormData({
            email: student.users?.email || '',
            password: '', // Leave blank for edit, only update if typed
            fullName: student.full_name || '',
            fatherName: student.father_name || '',
            phone: student.phone || '',
            class_name: student.class_name || 'General',
            batch: student.batch || 'Both'
        });
        setEditingId(student.id);
        setStatus({ type: '', message: '' });
        setView('edit');
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

    const class6Students = students.filter(s => String(s.class_name) === '6');
    const class7Students = students.filter(s => String(s.class_name) === '7');
    const class8Students = students.filter(s => String(s.class_name) === '8');
    const class9Students = students.filter(s => String(s.class_name) === '9');
    const class10Students = students.filter(s => String(s.class_name) === '10');
    const class11Students = students.filter(s => String(s.class_name) === '11');
    const class12Students = students.filter(s => String(s.class_name) === '12');
    const otherStudents = students.filter(s => !['6','7','8','9','10','11','12'].includes(String(s.class_name)));

    const currentClassStudents = activeClass
        ? (activeClass === 'General' ? otherStudents : students.filter(s => String(s.class_name) === String(activeClass)))
        : (searchQuery.trim() ? students.filter(s => {
            const q = searchQuery.toLowerCase();
            return (s.full_name && s.full_name.toLowerCase().includes(q)) ||
                   (s.phone && s.phone.toLowerCase().includes(q)) ||
                   (s.father_name && s.father_name.toLowerCase().includes(q)) ||
                   (s.users?.email && s.users.email.toLowerCase().includes(q));
        }) : students);

    const classActiveCount = currentClassStudents.filter(s => s.enrollment_status !== 'inactive' && s.enrollment_status !== 'leave').length;
    const classInactiveCount = currentClassStudents.filter(s => s.enrollment_status === 'inactive' || s.enrollment_status === 'leave').length;
    const classTotalCount = currentClassStudents.length;

    const getFilteredStudents = () => {
        let filtered = students;

        if (activeClass) {
            filtered = filtered.filter(s => activeClass === 'General'
                ? !['6','7','8','9','10','11','12'].includes(String(s.class_name))
                : String(s.class_name) === activeClass
            );
        }
        
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(s => 
                (s.full_name && s.full_name.toLowerCase().includes(query)) ||
                (s.phone && s.phone.toLowerCase().includes(query)) ||
                (s.father_name && s.father_name.toLowerCase().includes(query)) ||
                (s.users?.email && s.users.email.toLowerCase().includes(query))
            );
        }

        if (statusFilter === 'active') {
            filtered = filtered.filter(s => s.enrollment_status !== 'inactive' && s.enrollment_status !== 'leave');
        } else if (statusFilter === 'inactive') {
            filtered = filtered.filter(s => s.enrollment_status === 'inactive' || s.enrollment_status === 'leave');
        }
        
        return filtered;
    };

    if (view === 'list') {
        const displayStudents = getFilteredStudents();
        const isInsideFolderOrSearch = Boolean(activeClass || searchQuery.trim());

        return (
            <div className={`glass-panel animate-fade-in`} style={{ padding: '1.5rem', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h2 style={{ color: 'var(--color-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {activeClass ? (
                                <>
                                    <button onClick={() => { setActiveClass(null); setSearchQuery(''); setStatusFilter('all'); }} style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '1.5rem', padding: 0 }}>←</button>
                                    {['6', '7', '8', '9', '10', '11', '12'].includes(activeClass) ? `Class ${activeClass} Students` : 'General Students'}
                                </>
                            ) : 'Manage Students'}
                        </h2>
                        <p style={{ margin: '0.25rem 0 0 0', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                            {activeClass ? `Active & Inactive status for ${['6', '7', '8', '9', '10', '11', '12'].includes(activeClass) ? `Class ${activeClass}` : 'General'}` : 'Select a class folder to view and manage students.'}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <input 
                            type="text" 
                            placeholder="Search by name, phone, email..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ padding: '0.65rem 1rem', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface-hover)', color: 'var(--color-text-main)', width: '240px', fontSize: '0.9rem' }}
                        />
                        {selectedIds.length > 0 && (
                            <button onClick={handleBulkDelete} style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.65rem 1.25rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}>
                                Delete ({selectedIds.length})
                            </button>
                        )}
                        <button onClick={() => {
                            setFormData({ email: '', password: '', fullName: '', fatherName: '', phone: '', class_name: activeClass && ['6','7','8','9','10','11','12'].includes(activeClass) ? activeClass : '10' });
                            setEditingId(null);
                            setStatus({ type: '', message: '' });
                            setView('add');
                        }} className={styles.submitBtn} style={{ margin: 0 }}>
                            + Add Student
                        </button>
                    </div>
                </div>

                {/* Status Filter Segment: ONLY visible when inside a class folder or search view */}
                {isInsideFolderOrSearch && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center', background: 'var(--color-surface-hover)', padding: '0.35rem 0.6rem', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--color-text-muted)', marginRight: '0.25rem' }}>Status:</span>
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
                                fontSize: '0.82rem',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            All ({classTotalCount})
                        </button>
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
                                fontSize: '0.82rem',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            Active ({classActiveCount})
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
                                fontSize: '0.82rem',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            Inactive ({classInactiveCount})
                        </button>
                    </div>
                )}

                {loading ? <p>Loading...</p> : (
                    !isInsideFolderOrSearch ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                            <FolderCard title="Class 6" count={class6Students.length} onClick={() => { setActiveClass('6'); setStatusFilter('all'); }} color="#ec4899" emoji="📖" />
                            <FolderCard title="Class 7" count={class7Students.length} onClick={() => { setActiveClass('7'); setStatusFilter('all'); }} color="#8b5cf6" emoji="📙" />
                            <FolderCard title="Class 8" count={class8Students.length} onClick={() => { setActiveClass('8'); setStatusFilter('all'); }} color="#a78bfa" emoji="📐" />
                            <FolderCard title="Class 9" count={class9Students.length} onClick={() => { setActiveClass('9'); setStatusFilter('all'); }} color="#fb923c" emoji="🔬" />
                            <FolderCard title="Class 10" count={class10Students.length} onClick={() => { setActiveClass('10'); setStatusFilter('all'); }} color="#60a5fa" emoji="🎒" />
                            <FolderCard title="Class 11" count={class11Students.length} onClick={() => { setActiveClass('11'); setStatusFilter('all'); }} color="#fcd34d" emoji="🏫" />
                            <FolderCard title="Class 12" count={class12Students.length} onClick={() => { setActiveClass('12'); setStatusFilter('all'); }} color="#34d399" emoji="🎓" />
                            <FolderCard title="General" count={otherStudents.length} onClick={() => { setActiveClass('General'); setStatusFilter('all'); }} color="#f472b6" emoji="📚" />
                        </div>
                    ) : displayStudents.length === 0 ? <p>No students found.</p> : (
                        <div style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', boxSizing: 'border-box', WebkitOverflowScrolling: 'touch' }}>
                            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                        <th style={{ padding: '0.65rem 0.5rem', width: '38px' }}>
                                            <input 
                                                type="checkbox" 
                                                onChange={handleSelectAll} 
                                                checked={displayStudents.length > 0 && selectedIds.length === displayStudents.length}
                                                style={{ cursor: 'pointer' }}
                                            />
                                        </th>
                                        <th style={{ padding: '0.65rem 0.5rem', color: 'var(--color-text-muted)' }}>Name</th>
                                        <th style={{ padding: '0.65rem 0.5rem', color: 'var(--color-text-muted)' }}>Father's Name</th>
                                        {!activeClass && (
                                            <th style={{ padding: '0.65rem 0.5rem', color: 'var(--color-text-muted)' }}>Class</th>
                                        )}
                                        <th style={{ padding: '0.65rem 0.5rem', color: 'var(--color-text-muted)' }}>Batch</th>
                                        <th style={{ padding: '0.65rem 0.5rem', color: 'var(--color-text-muted)' }}>Email</th>
                                        <th style={{ padding: '0.65rem 0.5rem', color: 'var(--color-text-muted)' }}>Approval</th>
                                        <th style={{ padding: '0.65rem 0.5rem', color: 'var(--color-text-muted)' }}>Status</th>
                                        <th style={{ padding: '0.65rem 0.5rem', color: 'var(--color-text-muted)', textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayStudents.map((s) => {
                                    const isInactive = s.enrollment_status === 'inactive' || s.enrollment_status === 'leave';
                                    return (
                                    <tr key={s.id} style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: selectedIds.includes(s.id) ? 'rgba(59, 130, 246, 0.05)' : 'transparent' }}>
                                        <td style={{ padding: '0.65rem 0.5rem' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={selectedIds.includes(s.id)} 
                                                onChange={() => handleSelectOne(s.id)}
                                                style={{ cursor: 'pointer' }}
                                            />
                                        </td>
                                        <td style={{ padding: '0.65rem 0.5rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.85rem', flexShrink: 0 }}>
                                                    {s.full_name ? s.full_name.charAt(0).toUpperCase() : 'S'}
                                                </div>
                                                <span style={{ fontWeight: '500', color: 'var(--color-text-main)', whiteSpace: 'nowrap' }}>{s.full_name}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.65rem 0.5rem', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.father_name || '-'}>{s.father_name || '-'}</td>
                                        {!activeClass && (
                                            <td style={{ padding: '0.65rem 0.5rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{['8', '9', '10', '11', '12'].includes(s.class_name) ? `Class ${s.class_name}` : s.class_name}</td>
                                        )}
                                        <td style={{ padding: '0.65rem 0.5rem', whiteSpace: 'nowrap' }}>
                                            <span style={{
                                                padding: '0.18rem 0.45rem',
                                                borderRadius: '6px',
                                                fontSize: '0.72rem',
                                                fontWeight: '600',
                                                backgroundColor: s.batch === 'Morning' ? 'rgba(245, 158, 11, 0.15)' : s.batch === 'Evening' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                                                color: s.batch === 'Morning' ? '#f59e0b' : s.batch === 'Evening' ? '#818cf8' : '#3b82f6',
                                                border: s.batch === 'Morning' ? '1px solid rgba(245, 158, 11, 0.3)' : s.batch === 'Evening' ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid rgba(59, 130, 246, 0.3)',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '3px'
                                            }}>
                                                {s.batch === 'Morning' ? 'Morning' : s.batch === 'Evening' ? 'Evening' : 'Both'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.65rem 0.5rem', maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem' }} title={s.users?.email || ''}>{s.users?.email}</td>

                                        <td style={{ padding: '0.65rem 0.5rem', whiteSpace: 'nowrap' }}>
                                            <span style={{ 
                                                padding: '0.2rem 0.45rem', 
                                                borderRadius: '12px', 
                                                fontSize: '0.72rem', 
                                                fontWeight: 'bold',
                                                backgroundColor: s.is_approved ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                                color: s.is_approved ? '#10b981' : '#f59e0b'
                                            }}>
                                                {s.is_approved ? 'Approved' : 'Pending'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.65rem 0.5rem', whiteSpace: 'nowrap' }}>
                                            <span style={{ 
                                                padding: '0.2rem 0.55rem', 
                                                borderRadius: '12px', 
                                                fontSize: '0.72rem', 
                                                fontWeight: '700',
                                                backgroundColor: isInactive ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                                color: isInactive ? '#ef4444' : '#10b981',
                                                border: isInactive ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '3px'
                                            }}>
                                                {isInactive ? 'Inactive' : 'Active'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right' }}>
                                            <div style={{ display: 'inline-flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.35rem', flexWrap: 'nowrap' }}>
                                                {isInactive ? (
                                                    <button
                                                        onClick={() => handleToggleStatus(s.id, 'active', s.full_name)}
                                                        title="Student ko Active mark karein"
                                                        style={{
                                                            background: 'rgba(16, 185, 129, 0.15)',
                                                            color: '#10b981',
                                                            border: '1px solid rgba(16, 185, 129, 0.4)',
                                                            padding: '0.22rem 0.6rem',
                                                            borderRadius: '4px',
                                                            cursor: 'pointer',
                                                            fontSize: '0.78rem',
                                                            fontWeight: '600',
                                                            whiteSpace: 'nowrap'
                                                        }}
                                                    >
                                                        Active
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleToggleStatus(s.id, 'inactive', s.full_name)}
                                                        title="Student ko Inactive mark karein (Data safe rahega)"
                                                        style={{
                                                            background: 'rgba(239, 68, 68, 0.15)',
                                                            color: '#ef4444',
                                                            border: '1px solid rgba(239, 68, 68, 0.4)',
                                                            padding: '0.22rem 0.6rem',
                                                            borderRadius: '4px',
                                                            cursor: 'pointer',
                                                            fontSize: '0.78rem',
                                                            fontWeight: '600',
                                                            whiteSpace: 'nowrap'
                                                        }}
                                                    >
                                                        Inactive
                                                    </button>
                                                )}
                                                {!s.is_approved && (
                                                    <button
                                                        onClick={() => handleApprove(s.id)}
                                                        style={{
                                                            background: 'rgba(16, 185, 129, 0.2)',
                                                            color: '#10b981',
                                                            border: '1px solid rgba(16, 185, 129, 0.3)',
                                                            padding: '0.22rem 0.55rem',
                                                            borderRadius: '4px',
                                                            cursor: 'pointer',
                                                            fontSize: '0.78rem',
                                                            whiteSpace: 'nowrap'
                                                        }}
                                                    >
                                                        Approve
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleEditClick(s)}
                                                    style={{
                                                        background: 'rgba(59, 130, 246, 0.2)',
                                                        color: '#3b82f6',
                                                        border: '1px solid rgba(59, 130, 246, 0.3)',
                                                        padding: '0.22rem 0.55rem',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        fontSize: '0.78rem',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(s.id)}
                                                    style={{
                                                        background: 'rgba(239, 68, 68, 0.2)',
                                                        color: '#ef4444',
                                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                                        padding: '0.22rem 0.55rem',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        fontSize: '0.78rem',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                                })}
                            </tbody>
                        </table>
                    </div>
                    )
                )}
            </div>
        );
    }

    const cleanInputEmail = formData.email ? formData.email.trim().toLowerCase() : '';
    const duplicateStudent = cleanInputEmail
        ? students.find(s => s.users?.email?.trim().toLowerCase() === cleanInputEmail && s.id !== editingId)
        : null;

    return (
        <div className={`glass-panel ${styles.tabContainer} animate-fade-in`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ margin: 0 }}>{editingId ? 'Edit Student' : 'Add New Student'}</h2>
                <button onClick={() => { setView('list'); setStatus({ type: '', message: '' }); }} className={styles.logoutBtn} style={{ background: 'transparent', color: 'var(--color-text-muted)', border: 'none' }}>Cancel</button>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.inputGroup}>
                    <label>Full Name</label>
                    <input required type="text" value={formData.fullName} onChange={e => setFormData({ ...formData, fullName: e.target.value })} />
                </div>
                <div className={styles.inputGroup}>
                    <label>Father's Name</label>
                    <input required type="text" value={formData.fatherName} onChange={e => setFormData({ ...formData, fatherName: e.target.value })} />
                </div>
                <div className={styles.inputGroup}>
                    <label>Class</label>
                    <select value={formData.class_name} onChange={e => setFormData({ ...formData, class_name: e.target.value })} className={styles.selectInput}>
                        <option value="6">Class 6</option>
                        <option value="7">Class 7</option>
                        <option value="8">Class 8</option>
                        <option value="9">Class 9</option>
                        <option value="10">Class 10</option>
                        <option value="11">Class 11</option>
                        <option value="12">Class 12</option>
                        <option value="General">General / Other</option>
                    </select>
                </div>
                <div className={styles.inputGroup}>
                    <label>Batch (बैच)</label>
                    <select value={formData.batch || 'Both'} onChange={e => setFormData({ ...formData, batch: e.target.value })} className={styles.selectInput}>
                        <option value="Morning">Morning Batch (सुबह)</option>
                        <option value="Evening">Evening Batch (शाम)</option>
                        <option value="Both">Both Batches (सुबह और शाम दोनों)</option>
                    </select>
                </div>
                <div className={styles.inputGroup}>
                    <label>Email</label>
                    <input 
                        required 
                        type="email" 
                        value={formData.email} 
                        onChange={e => {
                            setFormData({ ...formData, email: e.target.value });
                            if (status.type === 'error') setStatus({ type: '', message: '' });
                        }} 
                        style={duplicateStudent ? { borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.05)' } : {}}
                    />
                    {duplicateStudent && (
                        <div style={{
                            marginTop: '0.4rem',
                            padding: '0.6rem 0.8rem',
                            backgroundColor: 'rgba(239, 68, 68, 0.12)',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            borderRadius: '6px',
                            color: '#ef4444',
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontWeight: '500'
                        }}>
                            <span>⚠️</span>
                            <span>
                                <strong>Email Already Exists:</strong> This email is already registered with student "{duplicateStudent.full_name}" ({duplicateStudent.class_name ? `Class ${duplicateStudent.class_name}` : 'General'}).
                            </span>
                        </div>
                    )}
                </div>
                <div className={styles.inputGroup}>
                    <label>Password {editingId && <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>(leave blank to keep current)</span>}</label>
                    <input required={!editingId} type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                </div>
                <div className={styles.inputGroup}>
                    <label>Phone Number (Optional)</label>
                    <input type="text" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                </div>

                {status.message && (
                    <div className={status.type === 'error' ? styles.errorMsg : styles.successMsg}>
                        {status.message}
                    </div>
                )}

                <button 
                    type="submit" 
                    disabled={status.type === 'loading' || Boolean(duplicateStudent)} 
                    className={styles.submitBtn}
                    style={duplicateStudent ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                >
                    {status.type === 'loading' 
                        ? (editingId ? 'Updating Student...' : 'Creating Student...') 
                        : (editingId ? 'Update Student' : 'Create Student Account')}
                </button>
            </form>
        </div>
    );
};

export default StudentsTab;
