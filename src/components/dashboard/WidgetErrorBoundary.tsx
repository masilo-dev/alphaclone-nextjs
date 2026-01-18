import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Card } from '../ui/UIComponents';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    title?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * WidgetErrorBoundary
 * A smaller, less intrusive error boundary for individual dashboard widgets.
 * Prevents one crashing widget from taking down the entire dashboard.
 */
export class WidgetErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error(`❌ Widget Error (${this.props.title || 'Unknown'}):`, {
            error,
            message: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
            isError310: error.message?.includes('310') || error.message?.includes('re-render'),
        });

        // Extra logging for Error 310 debugging
        if (error.message?.includes('310') || error.message?.includes('re-render')) {
            console.error('🔴 REACT ERROR 310 DETECTED - Check circuit breaker logs above');
        }
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    override render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;

            return (
                <Card className="h-full min-h-[200px] flex flex-col items-center justify-center p-6 border-red-500/20 bg-red-500/5">
                    <div className="p-3 bg-red-500/10 rounded-full mb-4">
                        <AlertCircle className="w-6 h-6 text-red-400" />
                    </div>
                    <h3 className="text-white font-medium mb-2">
                        {this.props.title ? `${this.props.title} failed` : 'Widget failed to load'}
                    </h3>
                    <p className="text-sm text-slate-400 text-center mb-2 max-w-md">
                        {this.state.error?.message || 'An unexpected error occurred'}
                    </p>
                    {(this.state.error?.message?.includes('310') || this.state.error?.message?.includes('re-render')) && (
                        <p className="text-xs text-yellow-400 text-center mb-4 max-w-md">
                            💡 Try: Hard refresh (Ctrl+Shift+R) to clear cache
                        </p>
                    )}
                    <button
                        onClick={this.handleRetry}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs rounded transition-colors"
                    >
                        <RefreshCw className="w-3 h-3" />
                        Retry
                    </button>
                </Card>
            );
        }

        return this.props.children;
    }
}
