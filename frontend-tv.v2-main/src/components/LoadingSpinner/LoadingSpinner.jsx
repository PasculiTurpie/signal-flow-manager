
const LoadingSpinner = () => (
  <div style={spinnerContainerStyle}>
    <div style={spinnerStyle}></div>
  </div>
);

const spinnerContainerStyle = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  height: "100vh",
};

const spinnerStyle = {
  width: "50px",
  height: "50px",
  border: "6px solid #ddd",
  borderTop: "6px solid #36d7b7",
  borderRadius: "50%",
  animation: "spin 1s linear infinite",
};

export default LoadingSpinner;
