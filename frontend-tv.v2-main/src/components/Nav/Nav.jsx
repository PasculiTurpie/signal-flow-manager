import { useContext } from "react";
import { UserContext } from "../context/UserContext";
import { Link, useNavigate } from "react-router-dom";
import "./Nav.css";
import api from "../../utils/api"; // 👈 importante: usamos api.logout()
import Swal from "sweetalert2";

const Nav = () => {
    const { isAuth, setIsAuth, setUser } = useContext(UserContext);
    const navigate = useNavigate();

    const onLogout = async () => {
        try {
            await api.logout(); // limpia cookies en backend
            Swal.fire({ icon: "success", title: "Usuario deslogueado", timer: 1200, showConfirmButton: false });

        } finally {
            setIsAuth(false);
            setUser(null);
            navigate("/auth/login");
        }
    };

    return (
        <div className="nav">
            <ul className="nav__menu-list">
                <li className="nav__links">
                    <Link className="nav__links-text" to="/">
                        Inicio
                    </Link>
                </li>
                <li className="nav__links">
                    <Link className="nav__links-text" to="/titans">
                        Titans
                    </Link>
                </li>
                

                {/* Si quieres un botón para revalidar manualmente en debug:
        <li className="nav__links">
          <button className="nav__links-text" onClick={refreshAuth}>Revalidar</button>
        </li>
        */}

                {isAuth ? (
                    <li className="nav__links">
                        <button className="nav__links-text" onClick={onLogout}>
                            Cerrar sesión
                        </button>
                    </li>
                ) : (
                    <li className="nav__links">
                        <Link className="nav__links-text" to="/auth/login">
                            Admin
                        </Link>
                    </li>
                )}
            </ul>
        </div>
    );
};

export default Nav;
