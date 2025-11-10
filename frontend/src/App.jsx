import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

import { Button, Container } from "react-bootstrap";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";

import { useState } from "react";

import ThemeContext from './ThemeContext';
import NavHeader from "./components/NavHeader"
import { LoginForm } from './components/AuthComponents';
import NotFoundComponent from './components/NotFoundComponent';

function App() {

  // state for theme
  const [theme, setTheme] = useState('light');

  // state for handling logger user
  const [user, setUser] = useState(null);
  const [loggedIn, setLoggedIn] = useState(false);

  const toggleTheme = () => {
    setTheme(currTheme => currTheme === "light" ? "dark" : "light");
  }

  return (
    <>
      <ThemeContext.Provider value={theme}>
        <Routes>
          <Route path="/" element={<>
            <NavHeader></NavHeader>
            <Container fluid className="p-0">
              <Outlet />
            </Container>
          </>}>
            <Route index element={<LoginForm></LoginForm>} />  {/* TODO: must be change */}
            <Route path="/login" element={<LoginForm></LoginForm>} />
            {/* <Route path="/register" element={} />
            <Route path="/allusers" element={} />
            <Route path="/chat" element={} /> */ }
            <Route path="*" element={<NotFoundComponent />} />
          </Route>
        </Routes> {/* close Routes */}
      </ThemeContext.Provider>
    </>
  )
}

export default App
