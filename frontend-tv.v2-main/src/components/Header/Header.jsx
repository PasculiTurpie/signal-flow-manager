import React from "react";
import "./Header.css";
import Logo from "../../../public/images/layout_set_logo.png";
import Search from "../Search/Search";



const Header = () => {
    
    return (
        <>
            <div className="line-orange"></div>
            <div className="header">
            
                <div className="logo">
                    <img
                        className="header__logo"
                        src={Logo}
                        alt="Logo Telsur"
                    />
                </div>
                <div className="titulo">
                    <h1 className="header__titulo">
                        Sistema de gestión de señales
                    </h1>
                </div>
                <div className="search">
                    <Search />
                </div>
               
            </div>
        </>
    );
};

export default Header;
