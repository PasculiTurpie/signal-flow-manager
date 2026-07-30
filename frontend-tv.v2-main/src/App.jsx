import { Route, Routes } from "react-router-dom";
import "./App.css";
import "./styles.css";
import ProtectedRoute from "./components/ProtectedRoute/ProtectedRoute";

import Home from "./pages/Home/Home";
import Layout from "./Layout/Layout";
import NotFound from "./pages/NotFound/NotFound";

import SatelliteForm from "./pages/Satellite/SatelliteForm";
import { SatelliteList } from "./pages/Satellite/SatelliteList";

import IrdForm from "./pages/Ird/IrdForm";
import IrdListar from "./pages/Ird/IrdListar";

import RegisterUser from "./pages/User/RegisterUser";
import ListarUsers from "./pages/User/ListarUsers";

import Login from "./pages/Login/Login";
import DetailCard from "./components/DatailCard/DetailCard";

import NodoListar from "./components/Nodo/NodoListar";

import Channel from "./pages/Channel.jsx/Channel";
import ChannelList from "./pages/Channel.jsx/ChannelList";

import Equipment from "./pages/Equipment/Equipment";
import ListEquipment from "./pages/Equipment/ListEquipment";

import Contacto from "./pages/Contacto/Contacto";
import ContactoList from "./pages/Contacto/ContactoList";

import SignalContact from "./pages/SignalContact/SignalContact";
import ScrollToTop from "./components/ScrollToTop/ScrollToTop";

import SearchFilter from "./components/SearchFilter/SearchFilter";

/* import ChannelDiagram from "./pages/ChannelDiagram/ChannelDiagram";*/
import ChannelForm from "./pages/ChannelDiagram/ChannelForm";
import ChannelListDiagram from "./pages/ChannelDiagram/ChannelListDiagram"; 

import AuditLogPage from "./pages/Audit/AuditLogPage";
import 'sweetalert2/dist/sweetalert2.min.css';

// 🔔 Hook de aviso + auto-refresh con cookies (sin localStorage)
import useSessionRefresher from "./hooks/useSessionRefresher";
import BulkIrdUploader from "./components/BulkIrdUploader/BulkIrdUploader";

import ServicesMultiHost from "./components/ServicesMultiHost/ServicesMultiHost";
import TipoEquipoForm from "./pages/Tipo-Equipo/TipoEquipoForm";
import TipoEquipoList from "./pages/Tipo-Equipo/TipoEquipoList";
import { DiagramFlow } from "./pages/DiagramFlow/DiagramFlow";
import FlowBuilder from "./pages/FlowBuilder/FlowBuilder.jsx";


const App = () => {
    useSessionRefresher();

    return (
        <>
            <ScrollToTop />
            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route index element={<Home />} />
                    <Route path='/titans' element={<ServicesMultiHost />} />
                    <Route path="/auth/login" element={<Login />} />
                    <Route path="/search" element={<SearchFilter />} />
                    <Route path="/signal/:id" element={<DetailCard />} />

                    <Route element={<ProtectedRoute />}>
                        <Route path="/auth/logout" element={<Login />} />

                        <Route path="/satelite" element={<SatelliteForm />} />
                        <Route path="/listar-satelite" element={<SatelliteList />} />

                        <Route path="/ird" element={<IrdForm />} />
                        <Route path="/listar-ird" element={<IrdListar />} />

                        <Route path="/registrar-user" element={<RegisterUser />} />
                        <Route path="/listar-user" element={<ListarUsers />} />

                        <Route path="/channel-form" element={<ChannelForm />} />

                        <Route path="/nodo-listar" element={<NodoListar />} />
                        <Route path="/channel" element={<Channel />} />
                        <Route path="/channel-list" element={<ChannelList />} />

                        <Route path="/channel_diagram-list" element={<ChannelListDiagram />} />
                        {/* Crear */}
                        <Route path="/channels/new" element={<ChannelForm />} />
                        {/* Editar */}
                        <Route path="/channels/:id/edit" element={<ChannelForm />} />

                        <Route path="/equipment" element={<Equipment />} />
                        <Route path="/register-type-equitment" element={<TipoEquipoForm />} />
                        <Route path="/list-type-equitment" element={<TipoEquipoList />} />
                        <Route path="/equipment-list" element={<ListEquipment />} />

                        <Route path="/contact" element={<Contacto />} />
                        <Route path="/contact-list" element={<ContactoList />} />

                        <Route path="/signal-contact" element={<SignalContact />} />

                        <Route path="/audit-logs" element={<AuditLogPage />} />
                        <Route path="/massive-loading" element={<BulkIrdUploader />} />
                        <Route path="/flows/workspace" element={<FlowBuilder />} />
                    </Route>
                    <Route path="/channels/:id" element={<DiagramFlow />} />
                </Route>

                <Route path="*" element={<NotFound />} />
            </Routes>
        </>
    );
};

export default App;
