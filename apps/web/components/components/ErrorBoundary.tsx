'use client';

import { Component, type ReactNode } from 'react';
import { Empty } from './Empty';
import { ROUTES } from '@/config/routes';
import { Button } from '@/components/elements';

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="fatal">
        <Empty
          icon="alert"
          title="Something went wrong"
          body="Your data is safe in this browser. Reloading usually fixes this."
          action={
            <div className="row">
              <Button variant="primary" onClick={() => location.reload()}>
                Reload
              </Button>
              <Button
                onClick={() => {
                  location.assign(ROUTES.camp);
                }}
              >
                Back to dashboard
              </Button>
            </div>
          }
        />
        <pre className="muted small">{this.state.error.message}</pre>
      </div>
    );
  }
}
