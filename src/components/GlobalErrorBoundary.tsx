'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * Global Error Boundary for the entire application
 * Catches errors that escape component-level boundaries
 */
export class GlobalErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): State {
        return {
            hasError: true,
            error,
            errorInfo: null,
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Log error to console
        console.error('Global Error Boundary caught error:', error, errorInfo);

        // Update state with error details
        this.setState({
            error,
            errorInfo,
        });

        // Call optional error handler
        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }

        // Log to error tracking service
        if (typeof window !== 'undefined' && (window as any).errorTracker) {
            (window as any).errorTracker.captureException(error, {
                extra: {
                    componentStack: errorInfo.componentStack ?? undefined,
                },
            });
        }
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                    <div className="max-w-2xl w-full bg-slate-900 border border-red-500/50 rounded-2xl p-8">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-white">Something Went Wrong</h1>
                                <p className="text-slate-400">The application encountered an unexpected error</p>
                            </div>
                        </div>

                        <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 mb-6">
                            <p className="text-sm font-mono text-red-400 mb-2">
                                {this.state.error?.toString()}
                            </p>
                            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                                <details className="mt-4">
                                    <summary className="text-sm text-slate-500 cursor-pointer hover:text-slate-400">
                                        Show error details
                                    </summary>
                                    <pre className="mt-2 text-xs text-slate-500 overflow-auto max-h-64">
                                        {this.state.errorInfo.componentStack}
                                    </pre>
                                </details>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={this.handleReset}
                                className="flex-1 px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition-colors"
                            >
                                Try Again
                            </button>
                            <button
                                onClick={this.handleReload}
                                className="flex-1 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg transition-colors"
                            >
                                Reload Page
                            </button>
                        </div>

                        <div className="mt-6 text-center">
                            <p className="text-sm text-slate-500">
                                If this problem persists, please contact{' '}
                                <a href="mailto:support@alphaclone.systems" className="text-teal-400 hover:underline">
                                    support@alphaclone.systems
                                </a>
                            </p>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

/**
 * Component-level Error Boundary
 * Use this to wrap individual features/sections
 */
interface ComponentErrorBoundaryProps {
    children: ReactNode;
    componentName: string;
    fallback?: ReactNode;
}

interface ComponentErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

export class ComponentErrorBoundary extends Component<
    ComponentErrorBoundaryProps,
    ComponentErrorBoundaryState
> {
    constructor(props: ComponentErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
        };
    }

    static getDerivedStateFromError(error: Error): ComponentErrorBoundaryState {
        return {
            hasError: true,
            error,
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error(`Error in ${this.props.componentName}:`, error, errorInfo);

        // Log to error tracking
        if (typeof window !== 'undefined' && (window as any).errorTracker) {
            (window as any).errorTracker.captureException(error, {
                tags: {
                    component: this.props.componentName,
                },
                extra: {
                    componentStack: errorInfo.componentStack,
                },
            });
        }
    }

    handleRetry = () => {
        this.setState({
            hasError: false,
            error: null,
        });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="bg-slate-900 border border-red-500/30 rounded-xl p-6 my-4">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-white mb-1">
                                {this.props.componentName} Error
                            </h3>
                            <p className="text-sm text-slate-400 mb-4">
                                This component encountered an error and couldn't load properly.
                            </p>
                            <button
                                onClick={this.handleRetry}
                                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                                Reload Component
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
