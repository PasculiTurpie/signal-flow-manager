import React from "react";
import { useNavigate } from "react-router-dom";

const NotFound = () => {
    const navigate = useNavigate();

    let err = new Error("Objeto no encontrado"); // crea un error estándar con el texto "Objeto no encontrado"
    err.name = "NotFoundError"; // cambia el nombre del error a "NotFoundError"
      // asegúrate de que el nuevo nombre se almacene dentro del objeto error

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white text-center px-4">
            {/* <img
                src="https://cdn-icons-png.flaticon.com/512/535/535234.png" 
                alt="TV Not Found"
                className="w-40 h-40 mb-6 opacity-80"
            /> */}
            <h1 className="text-5xl font-bold mb-4">
                404 - Página No Encontrada
            </h1>
            <p className="text-lg mb-6">
                La página que buscas no está disponible...
            </p>
            <button
                onClick={() => navigate("/")}
                className="text-white font-semibold py-2 px-6 rounded-lg shadow button btn-danger"
            >
                Volver al Inicio
            </button>
        </div>
    );
};

export default NotFound;
