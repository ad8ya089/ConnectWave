import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100vh', gap: '16px',
          background: 'var(--bg)', color: 'var(--text-1)', fontFamily: 'system-ui',
        }}>
          <div style={{ fontSize: '32px' }}>⚠️</div>
          <h2 style={{ margin: 0 }}>Something went wrong</h2>
          <p style={{ color: 'var(--text-3)', margin: 0 }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => { window.location.href = '/'; }}
            style={{
              background: 'var(--accent)', color: '#000', border: 'none',
              borderRadius: '8px', padding: '10px 20px', fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Back to Home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
