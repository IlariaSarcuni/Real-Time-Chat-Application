import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

import { useEffect, useState } from "react";
import { Container } from "react-bootstrap";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";

// --- CAMBIAMENTO 1: Contexts ---
import ThemeContext from './contexts/ThemeContext'; 

// API è rimasto nella root, quindi questo va bene
import API from './API';

// --- CAMBIAMENTO 2: Componenti Common ---
import NavHeader from "./components/common/NavHeader";
import NotFoundComponent from './components/common/NotFoundComponent';

// --- CAMBIAMENTO 3: Componenti Auth ---
import { LoginForm } from './components/auth/AuthComponents';
import RegisterForm from './components/auth/RegisterForm'; 

// --- CAMBIAMENTO 4: Componenti Chat ---
import ChatPage from './components/chat/ChatPage'; 

function App() {
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('app-theme');
    return savedTheme ? savedTheme : 'light';
  });
  
  const [loggedIn, setLoggedIn] = useState(false);
  const [user, setUser] = useState(null); 
  const [loadingInfo, setLoadingInfo] = useState(true);

  const location = useLocation();

  useEffect(() => {
    localStorage.setItem('app-theme', theme);
  }, [theme]);

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
      await API.logOut();
    } catch(e) { console.log(e); }

    setLoggedIn(false);
    setUser(null);
    window.location.href = '/login';
  };

  // Global presence heartbeat while logged in
  useEffect(() => {
    let timer;
    const beat = async () => {
      try { await API.heartbeatPresence(); } catch { /* noop */ }
    };
    if (loggedIn) {
      beat();
      timer = setInterval(beat, 30000); // every 30s
    }
    return () => { if (timer) clearInterval(timer); };
  }, [loggedIn]);

  if (loadingInfo) {
    return <div className="p-5 text-center">Caricamento Ruggine...</div>;
  }

  return (
    <ThemeContext.Provider value={theme}>
      <div 
        data-bs-theme={theme} 
        className="d-flex flex-column" 
        style={{ height: '100vh', backgroundColor: 'var(--bs-body-bg)' }}
      >
        <Routes>
          <Route path="/" element={
            <>
              <NavHeader toggleTheme={toggleTheme} loggedIn={loggedIn} logout={handleLogout} user={user} />            
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