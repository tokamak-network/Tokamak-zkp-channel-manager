'use client';

import React, { ErrorInfo, ReactNode } from 'react';
import { Card } from './card';
import { Button } from './button';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo });
    
    // Log error details
    console.error('Error caught by boundary:', error);
    console.error('Error info:', errorInfo);
    
    // Call onError callback if provided
    this.props.onError?.(error, errorInfo);
    
    // Report error to monitoring service
    this.reportError(error, errorInfo);
  }

  reportError(error: Error, errorInfo: ErrorInfo) {
    // In a real app, this would send to error monitoring service
    const errorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent
    };

    // For now, just store in localStorage for debugging
    try {
      const existingReports = JSON.parse(localStorage.getItem('error-reports') || '[]');
      existingReports.push(errorReport);
      // Keep only last 10 reports
      localStorage.setItem('error-reports', JSON.stringify(existingReports.slice(-10)));
    } catch (e) {
      console.error('Failed to store error report:', e);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-[#0a1930] flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full p-8 bg-gradient-to-b from-[#1a2347] to-[#0a1930] border-red-500/50">
            <div className="text-center">
              {/* Error Icon */}
              <div className="w-20 h-20 bg-red-500/20 border-2 border-red-500/50 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-10 h-10 text-red-400" />
              </div>

              {/* Error Title */}
              <h1 className="text-2xl font-bold text-white mb-2">
                Something went wrong
              </h1>
              <p className="text-gray-400 mb-6">
                We encountered an unexpected error. Don't worry, your data is safe.
              </p>

              {/* Error Details (in development) */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <Card className="p-4 mb-6 bg-red-900/20 border-red-500/30 text-left">
                  <h3 className="text-sm font-medium text-red-400 mb-2 flex items-center gap-2">
                    <Bug className="w-4 h-4" />
                    Error Details (Development Only)
                  </h3>
                  <pre className="text-xs text-red-300 overflow-auto max-h-40">
                    {this.state.error.stack}
                  </pre>
                  {this.state.errorInfo && (
                    <pre className="text-xs text-red-300/70 mt-2 overflow-auto max-h-32">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </Card>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  onClick={this.handleRetry}
                  className="bg-[#028bee] hover:bg-[#0277d4]"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
                <Button
                  variant="outline"
                  onClick={this.handleReload}
                  className="border-[#4fc3f7]/30 hover:border-[#4fc3f7]"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reload Page
                </Button>
                <Button
                  variant="ghost"
                  onClick={this.handleGoHome}
                  className="text-gray-400 hover:text-white"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Go Home
                </Button>
              </div>

              {/* Help Text */}
              <div className="mt-8 pt-6 border-t border-gray-700">
                <p className="text-sm text-gray-500">
                  If this problem persists, please try refreshing the page or contact support.
                </p>
              </div>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Functional error boundary hook for function components
export function useErrorHandler() {
  return (error: Error, errorInfo?: ErrorInfo) => {
    console.error('Error caught:', error);
    
    // Report to error service
    const errorReport = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      url: window.location.href
    };

    try {
      const existingReports = JSON.parse(localStorage.getItem('error-reports') || '[]');
      existingReports.push(errorReport);
      localStorage.setItem('error-reports', JSON.stringify(existingReports.slice(-10)));
    } catch (e) {
      console.error('Failed to store error report:', e);
    }
  };
}