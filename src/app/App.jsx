import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '../features/auth/context/AuthContext';
import { useAuth } from '../features/auth/context/AuthContext';
import PublicLayout from '../layouts/PublicLayout';
import InternalLayout from '../layouts/InternalLayout';

import Home from '../features/landing/pages/Home';
import AboutIKU from '../features/landing/pages/AboutIKU';
import StrategicFramework from '../features/landing/pages/StrategicFramework';
import Guide from '../features/landing/pages/Guide';
import Glossary from '../features/landing/pages/Glossary';
import Documents from '../features/landing/pages/Documents';
import FAQ from '../features/landing/pages/FAQ';
import IKUList from '../features/iku/pages/IKUList';
import Login from '../features/auth/pages/Login';

import Dashboard from '../features/internal/pages/Dashboard';
import Users from '../features/internal/pages/Users';
import TeamPIC from '../features/internal/pages/TeamPIC';
import Profile from '../features/internal/pages/Profile';
import AdminPRPDashboard from '../features/internal/pages/AdminPRPDashboard';
import PRPGovernance from '../features/internal/pages/PRPGovernance';

function AdminOnlyUsers() {
  const { currentUser } = useAuth();
  return currentUser?.role === 'superadmin_prp' ? <Users /> : <Navigate to="/internal/profile" replace />;
}

function SuperadminOnly({ children }) {
  const { currentUser } = useAuth();
  return currentUser?.role === 'superadmin_prp' ? children : <Navigate to="/internal/profile" replace />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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
            <Route path="admin" element={<SuperadminOnly><AdminPRPDashboard /></SuperadminOnly>} />
            <Route path="admin/governance" element={<SuperadminOnly><PRPGovernance /></SuperadminOnly>} />
            <Route path="users" element={<AdminOnlyUsers />} />
            <Route path="team" element={<TeamPIC />} />
            <Route path="documents" element={<Documents />} />
            <Route path="profile" element={<Profile />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

function InternalIndex() {
  const { currentUser, activeContext } = useAuth();
  if (currentUser?.role === 'superadmin_prp' && activeContext === 'prp') {
    return <Navigate to="/internal/admin" replace />;
  }
  return <Dashboard />;
}

export default App;
