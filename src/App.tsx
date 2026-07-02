import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider } from './context/AuthProvider';
import { useAuth } from './context/AuthContext';
import { LoginPage } from './pages/auth/LoginPage';
import { MinistrySelector } from './pages/dashboard/MinistrySelector';
import { Dashboard } from './pages/dashboard/Dashboard';
import { SongList } from './pages/library/SongList';
import { SongDetail } from './pages/library/SongDetail';
import { NewSong } from './pages/library/NewSong';
import { ModoOperador } from './pages/performance/ModoOperador';
import { ModoLetra } from './pages/performance/ModoLetra';
import { ModoCifra } from './pages/performance/ModoCifra';
import { ModoTV } from './pages/performance/ModoTV';
import { SessionEnd } from './pages/performance/SessionEnd';
import { StudyMode } from './pages/study/StudyMode';
import { ScheduleDashboard } from './pages/admin/ScheduleDashboard';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!user.ministries?.length) {
    return <Navigate to="/select-ministry" replace />;
  }

  return <>{children}</>;
}

function ModoOperadorRoute() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuth();
  return <ModoOperador sessionId={sessionId || ''} ministryId={user?.ministries?.[0]?.ministryId || ''} />;
}

function ModoLetraRoute() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuth();
  return <ModoLetra sessionId={sessionId || ''} ministryId={user?.ministries?.[0]?.ministryId || ''} />;
}

function ModoCifraRoute() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuth();
  return <ModoCifra sessionId={sessionId || ''} ministryId={user?.ministries?.[0]?.ministryId || ''} />;
}

function ModoTVRoute() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuth();
  return <ModoTV sessionId={sessionId || ''} ministryId={user?.ministries?.[0]?.ministryId || ''} />;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={<LoginPage onLoginSuccess={() => window.location.href = '/dashboard'} />}
      />
      <Route
        path="/select-ministry"
        element={
          <ProtectedRoute>
            <MinistrySelector onSelect={() => window.location.href = '/dashboard'} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard userName={user?.name || ''} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/library"
        element={
          <ProtectedRoute>
            <SongList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/library/new"
        element={
          <ProtectedRoute>
            <NewSong />
          </ProtectedRoute>
        }
      />
      <Route
        path="/library/:id"
        element={
          <ProtectedRoute>
            <SongDetail />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/session/:sessionId/operador"
        element={
          <ProtectedRoute>
            <ModoOperadorRoute />
          </ProtectedRoute>
        }
      />
      <Route
        path="/session/:sessionId/letra"
        element={
          <ProtectedRoute>
            <ModoLetraRoute />
          </ProtectedRoute>
        }
      />
      <Route
        path="/session/:sessionId/cifra"
        element={
          <ProtectedRoute>
            <ModoCifraRoute />
          </ProtectedRoute>
        }
      />
      <Route
        path="/session/:sessionId/tv"
        element={
          <ProtectedRoute>
            <ModoTVRoute />
          </ProtectedRoute>
        }
      />
      <Route path="/session/end" element={<SessionEnd />} />
      <Route
        path="/library/:songId/study"
        element={
          <ProtectedRoute>
            <StudyMode />
          </ProtectedRoute>
        }
      />
      <Route
        path="/schedules"
        element={
          <ProtectedRoute>
            <ScheduleDashboard />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;