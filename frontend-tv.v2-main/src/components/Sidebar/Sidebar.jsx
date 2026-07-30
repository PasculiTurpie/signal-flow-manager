import React, { useContext } from 'react';
import './Sidebar.css';
import { Link } from 'react-router-dom';
import { UserContext } from '../context/UserContext';
import { clearLocalStorage } from '../../utils/localStorageUtils';



const Sidebar = () => {
  const { user } = useContext(UserContext);

  const handleCreateTopologyClick = () => {
    const cleaned = clearLocalStorage();
    if (cleaned) {
      console.info("localStorage limpiado desde el sidebar");
    }
  };


  return (
    <div className="sidebar">
      {user?.profilePicture && (
        <img
          src={user?.profilePicture}
          alt="Profile"
          className="sidebar__profile-pic"
        />
      )}
      <p className="profile">
        Bienvenido<br />
        <strong>{user?.username || "Anónimo"}</strong>
      </p>

      <hr className="sidebar__line" />

      <ul className="sidebar__list">
        <li>
          <Link to="/">Inicio</Link>
        </li>
        <hr />
        <p className="nodo">
          Origen
        </p>
        <li>
          <Link to="/satelite">Satélite</Link>
        </li>
        {/* <li>
          <Link to="/str">STR</Link>
        </li>
        <li>
          <Link to="/str">Fibra</Link>
        </li> */}
        <hr />
        <p className="nodo">
          Equipos
        </p>
        <li>
          <Link to="/equipment">Equipos</Link>
        </li>
        <li>
          <Link to="/register-type-equitment">Tipo Equipo</Link>
        </li>
        <li>
          <Link to="/ird">Encoder Ird</Link>
        </li>
        <hr />
        <p className="nodo">
          Canal
        </p>
        <li>
          <Link to="/channel">Señal</Link>
        </li>
        <li>
          <Link to="/contact">Contacto proveedor</Link>
        </li>
        <li>
          <Link to="/signal-contact">Asignar contacto</Link>
        </li>
        <hr />
        <p className="nodo">
          Topología de Señal
        </p>
        <li>
          <Link to="/channel-form" onClick={handleCreateTopologyClick}>Crear topología</Link>
        </li>
        <hr />
        <p className="nodo">
          Auditoría
        </p>
        <li>
          <Link to="/audit-logs">Logs</Link>
        </li>
        <li>
          <Link to="/massive-loading ">Carga Masiva IRD's</Link>
        </li>
        <hr />
        <li>
          <Link to="/registrar-user">Usuarios</Link>
        </li>
      </ul>
      
   
    </div>
  );
};

export default Sidebar;

