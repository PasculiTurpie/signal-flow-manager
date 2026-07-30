import React from "react";
import Swal from "sweetalert2";

/**
 * Error Boundary para capturar errores en React Flow y otros componentes
 * Previene que errores de renderizado rompan toda la aplicación
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error) {
    // Actualiza el estado para mostrar fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    const errorCount = this.state.errorCount + 1;

    // Log del error
    console.error("Error capturado por Error Boundary:", error, errorInfo);

    this.setState({
      error,
      errorInfo,
      errorCount,
    });

    // Mostrar notificación al usuario
    Swal.fire({
      icon: "error",
      title: "Error inesperado",
      text: error?.message || "Ha ocurrido un error. Por favor recarga la página.",
      footer: this.props.showDetails ? (
        <details style={{ textAlign: "left", fontSize: "0.85em" }}>
          <summary>Detalles técnicos</summary>
          <pre style={{ marginTop: "10px", fontSize: "0.75em" }}>
            {error?.stack}
          </pre>
        </details>
      ) : null,
      confirmButtonText: "Recargar página",
      showCancelButton: true,
      cancelButtonText: "Continuar de todas formas",
    }).then((result) => {
      if (result.isConfirmed) {
        window.location.reload();
      }
    });

    // Si hay múltiples errores seguidos, puede indicar un problema grave
    if (errorCount >= 3) {
      console.error("Múltiples errores detectados. Considere recargar la página.");
    }

    // Reportar a servicio de monitoreo si está configurado
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Renderizar UI de fallback
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            padding: "40px",
            textAlign: "center",
            backgroundColor: "#f8f9fa",
            borderRadius: "8px",
            margin: "20px",
          }}
        >
          <div style={{ marginBottom: "20px" }}>
            <svg
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#dc3545"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>

          <h2 style={{ color: "#dc3545", marginBottom: "10px" }}>
            Algo salió mal
          </h2>

          <p style={{ color: "#6c757d", marginBottom: "20px" }}>
            {this.state.error?.message || "Ha ocurrido un error inesperado"}
          </p>

          <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
            <button
              onClick={this.handleReset}
              style={{
                padding: "10px 20px",
                backgroundColor: "#007bff",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              Intentar de nuevo
            </button>

            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "10px 20px",
                backgroundColor: "#6c757d",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              Recargar página
            </button>
          </div>

          {this.props.showDetails && this.state.errorInfo && (
            <details
              style={{
                marginTop: "20px",
                textAlign: "left",
                backgroundColor: "white",
                padding: "15px",
                borderRadius: "4px",
                maxWidth: "600px",
                margin: "20px auto",
              }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  fontWeight: "bold",
                  marginBottom: "10px",
                }}
              >
                Detalles técnicos
              </summary>
              <pre
                style={{
                  fontSize: "12px",
                  overflow: "auto",
                  backgroundColor: "#f8f9fa",
                  padding: "10px",
                  borderRadius: "4px",
                }}
              >
                {this.state.error?.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
