import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css'; //
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import { UserProvider } from "./components/context/UserContext.jsx";


createRoot(document.getElementById("root")).render(

    <StrictMode>
        <BrowserRouter>
            <UserProvider>
                <App />
            </UserProvider>
        </BrowserRouter>
    </StrictMode>
);
