import { NavLink } from 'react-router-dom';
const link = ({ isActive }) => ({ marginRight: 12, fontWeight: isActive ? '700' : '400' });
export default function NavBar() {
return (
<nav style={{ padding: 12, borderBottom: '1px solid #ddd' }}>
<NavLink to="/" style={link}>Home</NavLink>
<NavLink to="/Simulacion" style={link}>Simulacion</NavLink>
<NavLink to="/Solicitud" style={link}>Solicitud</NavLink>
<NavLink to="/PagarCuota" style={link}>Pagar cuota</NavLink>
<NavLink to="/items" style={link}>Items</NavLink>
</nav>
);
}

