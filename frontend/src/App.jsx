import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

import { useEffect, useState } from "react";
import { Container } from "react-bootstrap";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";

import ThemeContext from './ThemeContext';
import API from './API';

// Components
import NavHeader from "./components/NavHeader";
import { LoginForm } from './components/AuthComponents';
import RegisterForm from './components/RegisterForm'; 
import ChatPage from './components/ChatPage'; 
import NotFoundComponent from './components/NotFoundComponent';

function App() {
  const [theme, setTheme] = useState('dark');
  
  // Stato di login (verificato tramite chiamata API)
  const [loggedIn, setLoggedIn] = useState(false);
  const [loadingInfo, setLoadingInfo] = useState(true);

  // Controlliamo la sessione ogni volta che cambia la Location (cioè cambiamo pagina)
  // o almeno all'avvio.
  const location = useLocation();

  const toggleTheme = () => {
    setTheme(currTheme => currTheme === "light" ? "dark" : "light");
  }

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Chiamiamo una API leggera protetta per vedere se il cookie è valido
        await API.getTeams(); 
        setLoggedIn(true);
      } catch (err) {
        setLoggedIn(false);
      } finally {
        setLoadingInfo(false);
      }
    };
    checkAuth();
  }, [location.pathname]); // Riesegue il check se cambi pagina (es. dopo il login)

  // Funzione Logout
  const handleLogout = async () => {
    // Fai una chiamata fetch manuale per il logout al backend
    try {
        await fetch('http://localhost:3000/logout', { method: 'GET', credentials: 'include' });
    } catch(e) { console.log(e); }
    setLoggedIn(false);
    window.location.href = '/login'; // Hard refresh per pulire stati
  };

  if (loadingInfo) {
    return <div className="p-5 text-center">Caricamento Ruggine...</div>;
  }

  return (
    <ThemeContext.Provider value={theme}>
      <Routes>
        <Route path="/" element={
          <>
            {/* Passiamo loggedIn e logout a NavHeader se vuoi mostrare il bottone */}
            <NavHeader toggleTheme={toggleTheme} loggedIn={loggedIn} logout={handleLogout} />
            <Container fluid className="p-0">
              <Outlet />
            </Container>
          </>
        }>
          
          {/* Se vado su root: se loggato -> chat, se no -> login */}
          <Route index element={ loggedIn ? <Navigate to="/chat" /> : <Navigate to="/login" /> } />

          <Route path="/login" element={ loggedIn ? <Navigate to="/chat" /> : <LoginForm /> } />

          <Route path="/register" element={ loggedIn ? <Navigate to="/chat" /> : <RegisterForm /> } />

          <Route path="/chat" element={ 
             loggedIn ? <ChatPage /> : <Navigate to="/login" /> 
          } />

          <Route path="*" element={<NotFoundComponent />} />

        </Route>
      </Routes>
    </ThemeContext.Provider>
  );
}

export default App;