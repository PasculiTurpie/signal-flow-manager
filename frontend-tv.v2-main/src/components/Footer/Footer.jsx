import React from 'react'
import './Footer.css'
const Footer = () => {
  const to_day = new Date();
  const year = to_day.getFullYear();
  return (
    <div className="footer">
      <p className='footer__paragraph'>
        &copy; {year} Desarrollado por Jorge R. Sepúlveda Turpie - Cristián Escobar Chanqueo | Para el área de Operaciones Televisión.
      </p>
    </div>
  )
}

export default Footer