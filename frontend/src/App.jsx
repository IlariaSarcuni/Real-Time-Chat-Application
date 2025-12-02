import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

import { useEffect, useState } from "react";
import { Container } from "react-bootstrap";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";

import ThemeContext from './ThemeContext';
import API from './API';

// Componenti
import NavHeader from "./components/NavHeader";
import { LoginForm } from './components/AuthComponents';
import RegisterForm from './components/RegisterForm'; 
import ChatPage from './components/ChatPage'; 
import NotFoundComponent from './components/NotFoundComponent';

function App() {
  // Imposto 'dark' come default
  const [theme, setTheme] = useState('dark');
  
  const [loggedIn, setLoggedIn] = useState(false);
  const [user, setUser] = useState(null); 
  const [loadingInfo, setLoadingInfo] = useState(true);

  const location = useLocation();

  const toggleTheme = () => {
    setTheme(currTheme => currTheme === "light" ? "dark" : "light");
  }

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userInfo = await API.getUserInfo(); 
        setUser(userInfo);
        setLoggedIn(true);
      } catch { 
        // CORREZIONE LINTER: Rimosso (err) inutilizzato
        setLoggedIn(false);
        setUser(null);
      } finally {
        setLoadingInfo(false);
      }
    };
    checkAuth();
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
        await fetch('http://localhost:3000/logout', { method: 'GET', credentials: 'include' });
    } catch(e) { console.log(e); }
    setLoggedIn(false);
    setUser(null);
    window.location.href = '/login';
  };

  if (loadingInfo) {
    return <div className="p-5 text-center">Caricamento Ruggine...</div>;
  }

  return (
    <ThemeContext.Provider value={theme}>
      {/* LAYOUT FIX:
          1. 'height: 100vh' -> Occupa tutta l'altezza della finestra.
          2. 'd-flex flex-column' -> Organizza i figli (Navbar e Container) in colonna.
          3. 'data-bs-theme' -> Applica il tema globale.
      */}
      <div 
        data-bs-theme={theme} 
        className="d-flex flex-column" 
        style={{ height: '100vh', backgroundColor: 'var(--bs-body-bg)' }}
      >
        <Routes>
          <Route path="/" element={
            <>
              {/* Navbar fissa in alto */}
              <NavHeader toggleTheme={toggleTheme} loggedIn={loggedIn} logout={handleLogout} user={user} />
              
              {/* CONTAINER FLEX:
                  'flex-grow-1' -> Si espande per occupare tutto lo spazio rimanente sotto la Navbar.
                  'overflow: hidden' -> Impedisce lo scroll della pagina intera (lo scroll lo gestisce la ChatPage).
                  'position-relative' -> Utile per posizionamenti assoluti interni.
              */}
              <Container fluid className="p-0 flex-grow-1 position-relative" style={{ overflow: 'hidden' }}>
                <Outlet />
              </Container>
            </>
          }>
            
            <Route index element={ loggedIn ? <Navigate to="/chat" /> : <Navigate to="/login" /> } />

            <Route path="/login" element={ loggedIn ? <Navigate to="/chat" /> : <LoginForm /> } />

            <Route path="/register" element={ loggedIn ? <Navigate to="/chat" /> : <RegisterForm /> } />

            <Route path="/chat" element={ 
               loggedIn ? <ChatPage user={user} /> : <Navigate to="/login" /> 
            } />

            <Route path="*" element={<NotFoundComponent />} />

          </Route>
        </Routes>
      </div>
    </ThemeContext.Provider>
  );
}

export default App;