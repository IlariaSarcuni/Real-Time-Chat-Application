import { Button, Container, Row, Col, Navbar } from "react-bootstrap";
import { Link } from "react-router-dom";
import { useContext } from "react";

import ThemeContext from "../ThemeContext";

import "../stylesheets/NavHeader.css";

function NavHeader(props) {

    const theme = useContext(ThemeContext);
    
    return (
        <Navbar data-bs-theme="dark" className="py-3 border-bottom"> {/* Aggiunto py-3 per ingrandirla */}
            <Container fluid>
                <Row className="w-100 mx-1 align-items-center"> {/* Aggiunto align-items-center */}
                    
                    {/* LOGO */}
                    <Col className="col-3 d-flex align-items-center">
                        <Link to="/" className="navbar-brand d-flex align-items-center gap-2">
                            <i className="bi bi-chat-dots fs-3"></i> {/* Icona un po' più grande */}
                            <span className="fs-4 fw-bold">Ruggine Chat</span> {/* Testo un po' più grande */}
                        </Link>
                    </Col>
                    
                    {/* SPAZIO VUOTO CENTRALE */}
                    <Col className="col-4"></Col>
                    
                    {/* SEZIONE DESTRA */}
                    <Col className="col-5 d-flex justify-content-end align-items-center gap-3">
                        
                        {/* Username (Nuova Aggiunta) */}
                        {props.loggedIn && props.user && (
                            <span className="text-white opacity-75 fw-semibold d-none d-md-block border-end pe-3">
                                Ciao, {props.user.username}
                            </span>
                        )}

                        {/* Cambio Tema */}
                        <Button variant="link" onClick={props.toggleTheme} className="text-white p-0">
                            <i className={`fs-4 ${theme === "light" ? "bi bi-sun" : "bi bi-moon-stars"}`}></i>
                        </Button>

                        {/* Logout / Accedi */}
                        {props.loggedIn ? (
                            <Button variant="outline-light" className="d-flex align-items-center fw-semibold px-3 py-2" onClick={props.logout}>
                                <i className="bi bi-box-arrow-right me-2"></i> Logout
                            </Button>
                        ) : (
                            <Link to="/login" className="btn btn-outline-light px-4 py-2 fw-bold">Accedi</Link>
                        )}
                    </Col>
                </Row>
            </Container>
        </Navbar>
    )
}

export default NavHeader;