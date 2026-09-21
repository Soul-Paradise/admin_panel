import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { AccessProvider } from './contexts/AccessContext';
import { useAuth } from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import PageLoader from './components/PageLoader';
import SectionRoute from './components/SectionRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import UserDetail from './pages/UserDetail';
import Agents from './pages/Agents';
import Commissions from './pages/Commissions';
import Coupons from './pages/Coupons';
import Offers from './pages/Offers';
import Reviews from './pages/Reviews';
import Utilities from './pages/Utilities';
import UserAccess from './pages/UserAccess';
import AuditLogs from './pages/AuditLogs';

function LoginRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Login />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AccessProvider>
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              {/* Each section is wrapped in SectionRoute so that deep-linking to a
                  page you have no grant for is refused by the router, not just
                  hidden from the sidebar. */}
              <Route
                index
                element={
                  <SectionRoute page="DASHBOARD">
                    <Dashboard />
                  </SectionRoute>
                }
              />
              <Route
                path="users"
                element={
                  <SectionRoute page="USERS">
                    <Users />
                  </SectionRoute>
                }
              />
              <Route
                path="users/:id"
                element={
                  <SectionRoute page="USERS">
                    <UserDetail />
                  </SectionRoute>
                }
              />
              <Route
                path="partners"
                element={
                  <SectionRoute page="BOOKING_PARTNERS">
                    <Agents />
                  </SectionRoute>
                }
              />
              <Route
                path="commissions"
                element={
                  <SectionRoute page="COMMISSION">
                    <Commissions />
                  </SectionRoute>
                }
              />
              <Route
                path="coupons"
                element={
                  <SectionRoute page="COUPONS">
                    <Coupons />
                  </SectionRoute>
                }
              />
              <Route
                path="offers"
                element={
                  <SectionRoute page="OFFERS">
                    <Offers />
                  </SectionRoute>
                }
              />
              <Route
                path="reviews"
                element={
                  <SectionRoute page="REVIEWS">
                    <Reviews />
                  </SectionRoute>
                }
              />
              <Route
                path="utilities"
                element={
                  <SectionRoute page="UTILITIES">
                    <Utilities />
                  </SectionRoute>
                }
              />
              <Route
                path="user-access"
                element={
                  <SectionRoute page="USER_ACCESS">
                    <UserAccess />
                  </SectionRoute>
                }
              />
              <Route
                path="audit-logs"
                element={
                  <SectionRoute page="AUDIT_LOGS">
                    <AuditLogs />
                  </SectionRoute>
                }
              />

              {/* /agents was the old Booking Partners path; keep old links working. */}
              <Route path="agents" element={<Navigate to="/partners" replace />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AccessProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
