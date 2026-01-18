import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
// import * as Sentry from '@sentry/react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree
 * and displays a fallback UI instead of crashing the whole app
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Log error to console in development
        console.error('Error caught by boundary:', error, errorInfo);

        this.setState({
            error,
            errorInfo,
        });

        // Send to Sentry error tracking
        // Sentry.captureException(error, {
        //     contexts: {
        //         react: {
        //             componentStack: errorInfo.componentStack,
        //         },
        //     },
        //     tags: {
        //         errorBoundary: true,
        //     },
        // });
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    override render() {
        if (this.state.hasError) {
            // Custom fallback UI
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default fallback UI
            return (
                <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                    <div className="max-w-md w-full glass-card p-8 rounded-2xl border border-slate-800">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-red-500/10 rounded-xl">
                                <AlertCircle className="w-8 h-8 text-red-400" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white">Something went wrong</h2>
                                <p className="text-sm text-slate-400">An unexpected error occurred</p>
                            </div>
                        </div>

                        {this.state.error && (
                            <div className="mb-6 p-4 bg-slate-900 rounded-lg border border-slate-800">
                                <p className="text-sm font-mono text-red-300 mb-2">
                                    {this.state.error.message}
                                </p>
                                {process.env.NODE_ENV !== 'production' && this.state.errorInfo && (
                                    <details className="mt-2">
                                        <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-400">
                                            Stack trace
                                        </summary>
                                        <pre className="text-xs text-slate-600 mt-2 overflow-auto max-h-40">
                                            {this.state.errorInfo.componentStack}
                                        </pre>
                                    </details>
                                )}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => window.location.reload()}
                                className="flex-1 px-4 py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Reload Page
                            </button>
                            <button
                                onClick={this.handleReset}
                                className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
                            >
                                Try Again
                            </button>
                        </div>

                        <p className="text-xs text-slate-500 text-center mt-4">
                            If this problem persists, please contact support
                        </p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

/**
 * Hook-based error boundary wrapper for functional components
 */
export function withErrorBoundary<P extends object>(
    Component: React.ComponentType<P>,
    fallback?: ReactNode
) {
    return function WithErrorBoundary(props: P) {
        return (
            <ErrorBoundary fallback={fallback}>
                <Component {...props} />
            </ErrorBoundary>
        );
    };
}
