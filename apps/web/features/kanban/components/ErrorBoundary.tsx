import { Component, type ReactNode } from 'react';
import { Empty } from './ui';

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="fatal"><Empty icon="alert" title="Something went wrong" body="Your data is safe in this browser. Reloading usually fixes this."
        action={<div className="row"><button className="btn btn-primary" onClick={() => location.reload()}>Reload</button>
          <button className="btn" onClick={() => { location.hash = '#/dashboard'; this.setState({ error: null }); }}>Back to dashboard</button></div>} />
        <pre className="muted small">{this.state.error.message}</pre></div>
    );
  }
}
