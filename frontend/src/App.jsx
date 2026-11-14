import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ConfirmProvider } from './contexts/ConfirmContext';
import InstallPwaPopup from './components/InstallPwaPopup';

const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const TeacherDashboard = lazy(() => import('./pages/TeacherDashboard'));
const StudentDashboard = lazy(() => import('./pages/StudentDashboard'));

const PageLoader = () => (
  <div style={{
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0B0F19',
    color: '#ffffff',
    gap: '14px',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  }}>
    <div style={{
      width: '42px',
      height: '42px',
      border: '3.5px solid rgba(224, 138, 0, 0.25)',
      borderTopColor: '#E08A00',
      borderRadius: '50%',
      animation: 'apc-spin 0.75s linear infinite'
    }}></div>
    <style>{`@keyframes apc-spin { to { transform: rotate(360deg); } }`}</style>
    <div style={{ fontSize: '0.88rem', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.5px' }}>
      Loading A.P. Coaching Classes...
    </div>
  </div>
);

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />; // Or some unauthorized page
  }

  return children;
};

const AppRoutes = () => {
  const { user } = useAuth();

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={
          user ? (
            user.role === 'teacher' ? <Navigate to="/teacher" replace /> : <Navigate to="/student" replace />
          ) : (
            <Home />
          )
        } />

        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />

        <Route path="/teacher/*" element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <TeacherDashboard />
          </ProtectedRoute>
        } />

        <Route path="/student/*" element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentDashboard />
          </ProtectedRoute>
        } />
      </Routes>
    </Suspense>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <ConfirmProvider>
          <AppRoutes />
          <InstallPwaPopup />
        </ConfirmProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
