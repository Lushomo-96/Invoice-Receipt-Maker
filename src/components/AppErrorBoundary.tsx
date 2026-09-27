import React from 'react';
import {FiAlertTriangle, FiArrowLeft, FiRefreshCw} from 'react-icons/fi';

interface AppErrorBoundaryState {
  hasError: boolean;
}

export default class AppErrorBoundary extends React.Component<React.PropsWithChildren, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {hasError: false};

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return {hasError: true};
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Invoice & Receipt Maker encountered an unrecoverable UI error.', error, info);
  }

  private reload = () => window.location.reload();

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#f7f8fc] px-4 py-10">
        <section className="w-full max-w-lg rounded-3xl border border-rose-100 bg-white p-6 shadow-medium sm:p-8" role="alert" aria-live="assertive">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600" aria-hidden="true"><FiAlertTriangle className="h-6 w-6" /></div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-rose-600">Application error</p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-[-0.02em] text-slate-950">This screen could not be displayed.</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Your saved records remain in this browser. Reload the app before making further changes. If the problem continues, keep your latest JSON backup available for recovery.
          </p>
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={this.reload} className="ui-primary-button"><FiRefreshCw /> Reload application</button>
            <button type="button" onClick={() => window.history.back()} className="ui-secondary-button"><FiArrowLeft /> Go back</button>
          </div>
        </section>
      </main>
    );
  }
}
