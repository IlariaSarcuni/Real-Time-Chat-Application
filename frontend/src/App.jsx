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

  // Global presence
  useEffect(() => {
    let socket;
    if (loggedIn) {
      const { hostname, protocol } = window.location;
      const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
      const wsPort = '3000';
      
      socket = new WebSocket(`${wsProtocol}//${hostname}:${wsPort}/ws/global`);

      socket.onopen = () => console.log("Presenza globale attiva");
      socket.onclose = () => console.log("Presenza globale chiusa");
    }

  return () => {
    if (socket) socket.close();
  };
}, [loggedIn]);

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