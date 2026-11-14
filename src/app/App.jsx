import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '../features/auth/context/AuthContext';
import { useAuth } from '../features/auth/hooks/useAuth';
import PublicLayout from '../layouts/PublicLayout';
import InternalLayout from '../layouts/InternalLayout';

import Home from '../features/landing/pages/Home';
import Login from '../features/auth/pages/Login';

const AboutIKU = lazy(() => import('../features/landing/pages/AboutIKU'));
const StrategicFramework = lazy(() => import('../features/landing/pages/StrategicFramework'));
const Guide = lazy(() => import('../features/landing/pages/Guide'));
const Glossary = lazy(() => import('../features/landing/pages/Glossary'));
const Documents = lazy(() => import('../features/landing/pages/Documents'));
const FAQ = lazy(() => import('../features/landing/pages/FAQ'));
const IKUList = lazy(() => import('../features/iku/pages/IKUList'));

const Dashboard = lazy(() => import('../features/internal/pages/Dashboard'));
const Users = lazy(() => import('../features/internal/pages/Users'));
const TeamPIC = lazy(() => import('../features/internal/pages/TeamPIC'));
const Profile = lazy(() => import('../features/internal/pages/Profile'));
const AdminPRPDashboard = lazy(() => import('../features/internal/pages/AdminPRPDashboard'));
const PRPGovernance = lazy(() => import('../features/internal/pages/PRPGovernance'));
const IKUSubmissions = lazy(() => import('../features/iku/pages/IKUSubmissions'));

function RouteLoadingFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: '45vh',
        display: 'grid',
        placeItems: 'center',
        padding: '2rem',
        color: '#475569',
        fontFamily: 'var(--ent-mono, monospace)',
        fontSize: '0.78rem',
        letterSpacing: '0.08em',
      }}
    >
      Memuat modul ruang kerja...
    </div>
  );
}

function IkuSubmissionOnly() {
  const { currentUser } = useAuth();
  return currentUser?.status !== 'Nonaktif' && ['iku_only', 'dual', 'superadmin_prp'].includes(currentUser?.role)
    ? <IKUSubmissions /> : <Navigate to={currentUser ? '/internal/profile' : '/login'} replace />;
}

function AdminOnlyUsers() {
  const { currentUser } = useAuth();
  return currentUser?.role === 'superadmin_prp' && currentUser?.status !== 'Nonaktif' ? <Users /> : <Navigate to="/internal/profile" replace />;
}

function SuperadminOnly({ children }) {
  const { currentUser } = useAuth();
  return currentUser?.role === 'superadmin_prp' && currentUser?.status !== 'Nonaktif' ? children : <Navigate to="/internal/profile" replace />;
}

function InternalIndex() {
  const { currentUser, activeContext } = useAuth();
  if (currentUser?.role === 'superadmin_prp' && activeContext === 'prp') {
    return <Navigate to="/internal/admin" replace />;
  }
  return <Dashboard />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<PublicLayout />}>
              <Route index element={<Home />} />
              <Route path="about" element={<AboutIKU />} />
              <Route path="framework" element={<StrategicFramework />} />
              <Route path="guide" element={<Guide />} />
              <Route path="glossary" element={<Glossary />} />
              <Route path="documents" element={<Documents />} />
              <Route path="faq" element={<FAQ />} />
              <Route path="iku-list" element={<IKUList />} />
            </Route>

            <Route path="/login" element={<Login />} />

            {/* Internal Routes */}
            <Route path="/internal" element={<InternalLayout />}>
              <Route index element={<InternalIndex />} />
              <Route path="iku-submissions" element={<IkuSubmissionOnly />} />
              <Route path="admin" element={<SuperadminOnly><AdminPRPDashboard /></SuperadminOnly>} />
              <Route path="admin/governance" element={<SuperadminOnly><PRPGovernance /></SuperadminOnly>} />
              <Route path="users" element={<AdminOnlyUsers />} />
              <Route path="team" element={<TeamPIC />} />
              <Route path="documents" element={<Documents />} />
              <Route path="profile" element={<Profile />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
