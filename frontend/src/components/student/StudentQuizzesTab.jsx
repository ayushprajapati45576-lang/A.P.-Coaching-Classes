import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import styles from '../teacher/Tabs.module.css';

const StudentQuizzesTab = () => {
    const { user } = useAuth();
    const [view, setView] = useState('list'); // 'list', 'take', 'results'
    const [quizzes, setQuizzes] = useState([]);
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);

    const [activeQuiz, setActiveQuiz] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({});
    const [submitStatus, setSubmitStatus] = useState('');

    useEffect(() => {
        if (view === 'list') {
            fetchData();
        }
    }, [view]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [qRes, rRes] = await Promise.all([
                fetch('/api/quizzes', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }),
                fetch('/api/student/quiz-results', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
            ]);
            
            if (qRes.ok) setQuizzes(await qRes.json());
            if (rRes.ok) setResults(await rRes.json());
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleStartQuiz = async (quiz) => {
        try {
            const res = await fetch(`/api/quizzes/${quiz.id}/questions`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (res.ok) {
                setQuestions(data);
                setActiveQuiz(quiz);
                setAnswers({});
                setSubmitStatus('');
                setView('take');
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleAnswerChange = (questionId, option) => {
        setAnswers({ ...answers, [questionId]: option });
    };

    const handleSubmitQuiz = async (e) => {
        e.preventDefault();
        
        // Confirm if not all answered
        if (Object.keys(answers).length < questions.length) {
            if (!window.confirm('You have not answered all questions. Submit anyway?')) return;
        }

        setSubmitStatus('Submitting...');
        try {
            const res = await fetch(`/api/quizzes/${activeQuiz.id}/submit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ answers })
            });
            const data = await res.json();
            
            if (res.ok) {
                setSubmitStatus(`Scored: ${data.score} / ${data.total_marks}`);
                setTimeout(() => setView('list'), 3000);
            } else {
                setSubmitStatus(data.error || 'Failed to submit');
            }
        } catch (err) {
            setSubmitStatus('Error submitting quiz');
        }
    };

    if (view === 'take') {
        return (
            <div className={`glass-panel ${styles.tabContainer} animate-fade-in`} style={{ maxWidth: '800px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem' }}>
                    <h2 style={{ margin: 0, color: 'var(--color-primary)' }}>{activeQuiz.title}</h2>
                    <button onClick={() => setView('list')} style={{ background: 'transparent', color: 'var(--color-text-muted)', border: 'none', cursor: 'pointer' }}>Cancel / Exit</button>
                </div>

                <form onSubmit={handleSubmitQuiz}>
                    {questions.map((q, index) => (
                        <div key={q.id} style={{ background: 'var(--color-bg-secondary)', padding: '1.5rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                            <p style={{ fontWeight: '500', marginBottom: '1rem', color: 'var(--color-text-main)' }}>
                                {index + 1}. {q.question}
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {['A', 'B', 'C', 'D'].map(opt => (
                                    <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', background: 'var(--color-bg-primary)', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                                        <input 
                                            type="radio" 
                                            name={`q_${q.id}`} 
                                            value={opt} 
                                            checked={answers[q.id] === opt}
                                            onChange={() => handleAnswerChange(q.id, opt)}
                                            style={{ cursor: 'pointer' }}
                                        />
                                        <span>{q[`option_${opt.toLowerCase()}`]}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem' }}>
                        <span style={{ fontWeight: 'bold', color: submitStatus.startsWith('Scored') ? '#10b981' : 'var(--color-text-main)' }}>
                            {submitStatus}
                        </span>
                        <button type="submit" className={styles.submitBtn} disabled={!!submitStatus}>
                            Submit Quiz
                        </button>
                    </div>
                </form>
            </div>
        );
    }

    return (
        <div className={`glass-panel animate-fade-in`} style={{ padding: '1.5rem' }}>
            <h2 style={{ color: 'var(--color-primary)', margin: '0 0 1.5rem 0' }}>Available Quizzes</h2>
            
            {loading ? <p>Loading...</p> : quizzes.length === 0 ? <p>No quizzes available right now.</p> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
                    {quizzes.map((q) => {
                        const isTaken = results.some(r => r.quiz_id === q.id);
                        return (
                            <div key={q.id} className={styles.card} style={{ padding: '1.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--color-text-main)' }}>{q.title}</h3>
                                </div>
                                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
                                    Added on {new Date(q.created_at).toLocaleDateString()}
                                </p>
                                {isTaken ? (
                                    <button disabled style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-muted)', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', width: '100%' }}>
                                        Completed
                                    </button>
                                ) : (
                                    <button 
                                        onClick={() => handleStartQuiz(q)}
                                        style={{ background: 'var(--color-primary)', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', width: '100%', fontWeight: '500' }}
                                    >
                                        Start Quiz
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            <h2 style={{ color: 'var(--color-primary)', margin: '0 0 1.5rem 0' }}>My Results</h2>
            {results.length === 0 ? <p>You haven't completed any quizzes yet.</p> : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Quiz</th>
                                <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Score</th>
                                <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Percentage</th>
                                <th style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>Date Taken</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.map((r) => {
                                const percentage = (r.score / r.total_marks) * 100;
                                const isPass = percentage >= 40;
                                return (
                                    <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                        <td style={{ padding: '0.75rem', fontWeight: '500' }}>{r.title}</td>
                                        <td style={{ padding: '0.75rem' }}>{r.score} / {r.total_marks}</td>
                                        <td style={{ padding: '0.75rem', color: isPass ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                                            {percentage.toFixed(0)}%
                                        </td>
                                        <td style={{ padding: '0.75rem' }}>{new Date(r.taken_at).toLocaleString()}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default StudentQuizzesTab;
