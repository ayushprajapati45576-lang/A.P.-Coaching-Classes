import React, { useState, useEffect } from 'react';
import styles from '../teacher/Tabs.module.css';

const StudentResultsTab = () => {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchResults();
    }, []);

    const fetchResults = async () => {
        try {
            const res = await fetch((import.meta.env.VITE_BACKEND_URL || '') + '/api/student/results', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (res.ok) setResults(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`glass-panel animate-fade-in`} style={{ padding: '1.5rem' }}>
            <h2 style={{ color: 'var(--color-primary)', marginBottom: '1.5rem', margin: 0 }}>My Exam Results</h2>
            
            {loading ? <p>Loading...</p> : results.length === 0 ? <p>No exam results published yet.</p> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 350px), 1fr))', gap: '1.5rem' }}>
                    {results.map(r => {
                        let total = 0;
                        let obtained = 0;
                        let subjects = [];
                        
                        if (r.marks_data && Array.isArray(r.marks_data)) {
                            total = r.marks_data.reduce((sum, item) => sum + Number(item.total_marks || 0), 0);
                            obtained = r.marks_data.reduce((sum, item) => sum + Number(item.obtained_marks || 0), 0);
                            subjects = r.marks_data;
                        } else {
                            // Fallback for old schema
                            total = Number(r.total_marks || 0);
                            obtained = Number(r.obtained_marks || 0);
                            subjects = [{ subject: r.subject || '-', obtained_marks: obtained, total_marks: total }];
                        }

                        const percentage = total ? ((obtained / total) * 100).toFixed(1) : 0;
                        const isPass = r.status === 'Pass' || (r.status === undefined && percentage >= 40); // Use explicit status if available

                        return (
                            <div key={r.id} style={{ background: 'var(--color-surface-hover)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                                    <h3 style={{ margin: 0, color: 'var(--color-text-main)' }}>{r.exam_name}</h3>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Date: {new Date(r.date).toLocaleDateString()}</div>
                                </div>
                                
                                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', marginBottom: '1.5rem' }}>
                                    <thead>
                                        <tr style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', borderBottom: '1px solid var(--color-border)' }}>
                                            <th style={{ padding: '0.5rem 0' }}>Subject</th>
                                            <th style={{ padding: '0.5rem 0', textAlign: 'right' }}>Obtained</th>
                                            <th style={{ padding: '0.5rem 0', textAlign: 'right' }}>Total</th>
                                            <th style={{ padding: '0.5rem 0', textAlign: 'right' }}>%</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {subjects.map((s, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid var(--color-surface-hover)' }}>
                                                <td style={{ padding: '0.75rem 0' }}>{s.subject}</td>
                                                <td style={{ padding: '0.75rem 0', textAlign: 'right' }}>{s.obtained_marks}</td>
                                                <td style={{ padding: '0.75rem 0', textAlign: 'right' }}>{s.total_marks}</td>
                                                <td style={{ padding: '0.75rem 0', textAlign: 'right' }}>
                                                    {s.total_marks ? ((Number(s.obtained_marks)/Number(s.total_marks))*100).toFixed(1) : 0}%
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '4px' }}>
                                    <div>
                                        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Status / Total</div>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.9rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: r.status === 'Fail' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)', color: r.status === 'Fail' ? '#ef4444' : '#22c55e' }}>{r.status || 'Pass'}</span>
                                            <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{obtained} / {total}</span>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Final Percentage</div>
                                        <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: isPass ? '#10b981' : 'var(--color-danger)' }}>
                                            {percentage}%
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default StudentResultsTab;
