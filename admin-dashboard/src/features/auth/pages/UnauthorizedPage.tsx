import { Link } from 'react-router-dom';

export function UnauthorizedPage() {
  return (
    <div style={{ textAlign: 'center', padding: '4rem', color: '#f1f5f9' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>403 — Access Denied</h1>
      <p style={{ marginBottom: '2rem', color: '#94a3b8' }}>
        You do not have permission to view this page.
      </p>
      <Link to="/" style={{ color: '#6366f1' }}>Go back home</Link>
    </div>
  );
}
