import { Button, Container, Row, Col, Navbar } from "react-bootstrap";
import { Link } from "react-router-dom";
import { useContext } from "react";

import ThemeContext from "../ThemeContext";

import "../stylesheets/NavHeader.css";

function NavHeader(props) {

    const theme = useContext(ThemeContext);
    
    return (
        <Navbar data-bs-theme="dark" className="py-3 border-bottom"> 
            <Container fluid>
                <Row className="w-100 mx-1 align-items-center"> 
                    
                    {/* LOGO */}
                    <Col className="col-3 d-flex align-items-center">
                        <Link to="/" className="navbar-brand d-flex align-items-center gap-2">
                            <span className="fs-2">🦀</span>
                            <span className="fs-4 fw-bold">Ruggine Chat</span> 
                        </Link>
                    </Col>
                    

                    <Col className="col-4"></Col>

                    <Col className="col-5 d-flex justify-content-end align-items-center gap-3">
                        
                        {/* Username */}
                        {props.loggedIn && props.user && (
                            <span className="text-white opacity-75 fw-semibold d-none d-md-block border-end pe-3">
                                Ciao, {props.user.username}
                            </span>
                        )}

                        {/* Cambio Tema */}
                        <Button variant="link" onClick={props.toggleTheme} className="text-white p-0">
                            <i className={`fs-4 ${theme === "light" ? "bi bi-sun" : "bi bi-moon-stars"}`}></i>
                        </Button>

                        {/* Se è loggato allora logout altrimmenti nulla */}
                        {props.loggedIn ? (
                            <Button variant="outline-light" className="d-flex align-items-center fw-semibold px-3 py-2" onClick={props.logout}>
                                Logout
                            </Button>
                        ) : null}
                    </Col>
                </Row>
            </Container>
        </Navbar>
    )
}

export default NavHeader;