import { Link, Route, Routes } from 'react-router-dom';
import JobsListPage from './pages/JobsListPage';
import JobDetailPage from './pages/JobDetailPage';

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="app-title">
          LinkedIn CV Agent
        </Link>
        <span className="app-subtitle">Herramienta interna de candidaturas</span>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<JobsListPage />} />
          <Route path="/jobs/:id" element={<JobDetailPage />} />
        </Routes>
      </main>
    </div>
  );
}
