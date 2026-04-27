import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCcw, Home } from "lucide-react";
import { Button } from "./ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
          <div className="w-20 h-20 bg-destructive/10 rounded-3xl flex items-center justify-center mb-6">
            <AlertTriangle className="h-10 w-10 text-destructive" />
          </div>
          <h1 className="text-2xl font-black text-foreground mb-2">Ops! Algo deu errado.</h1>
          <p className="text-muted-foreground max-w-sm mb-8">
            Ocorreu um erro inesperado que impediu o carregamento da página.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
            <Button 
              onClick={this.handleReset}
              className="flex-1 font-bold h-12 rounded-xl"
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Tentar Novamente
            </Button>
            <Button 
              onClick={this.handleGoHome}
              variant="outline"
              className="flex-1 font-bold h-12 rounded-xl"
            >
              <Home className="mr-2 h-4 w-4" />
              Ir para Início
            </Button>
          </div>

          {process.env.NODE_ENV === "development" && (
            <pre className="mt-8 p-4 bg-muted rounded-lg text-left text-xs overflow-auto max-w-full">
              {this.state.error?.toString()}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;