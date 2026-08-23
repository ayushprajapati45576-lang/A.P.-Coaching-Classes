import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        // Check for token on mount
        const token = localStorage.getItem('token');
        if (token) {
            fetchUser(token);
        } else {
            setLoading(false);
        }
    }, []);

    const fetchUser = async (token) => {
        try {
            const res = await fetch((import.meta.env.VITE_BACKEND_URL || '') + '/api/me', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                const userData = await res.json();
                setUser(userData);
            } else {
                logout(); // Invalid token
            }
        } catch (err) {
            console.error("Auth check failed", err);
            logout();
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        const res = await fetch((import.meta.env.VITE_BACKEND_URL || '') + '/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (!res.ok) {
            let errorMsg = 'Login failed';
            try {
                const errorData = await res.json();
                errorMsg = errorData.error || errorMsg;
            } catch (e) {
                // If the response is not JSON (like a 404 or 405 HTML page from Vercel)
                errorMsg = `Server error: ${res.status} ${res.statusText}. Check your VITE_BACKEND_URL.`;
            }
            throw new Error(errorMsg);
        }

        const data = await res.json();
        localStorage.setItem('token', data.token);
        setUser({ id: data.id, email: data.email, role: data.role, class_name: data.class_name, full_name: data.full_name });
    };

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
        navigate('/');
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
