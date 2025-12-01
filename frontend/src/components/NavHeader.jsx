import { Button, Container, Row, Col, Navbar } from "react-bootstrap";
import { Link } from "react-router-dom";
import { useContext } from "react";

import ThemeContext from "../ThemeContext";

import "../stylesheets/NavHeader.css";

function NavHeader(props) {

    const theme = useContext(ThemeContext);
    
    return (
        <Navbar data-bs-theme="dark">
            <Container fluid>
                <Row className="w-100 mx-1">
                    <Col className="col-2 d-flex align-items-center">
                        <Link to="/" className="navbar-brand">
                            <i className="bi bi-chat-dots"></i>{' '}
                            <span>Ruggine Chat </span>
                        </Link>
                    </Col>
                    <Col className="col-6"></Col>
                    <Col className="col-4 d-flex justify-content-end align-items-center">
                        <Button variant="link" className="mx-5" onClick={props.toggleTheme}>
                            <i className={theme === "light" ? "bi bi-sun": "bi bi-moon-stars"}></i>
                        </Button>
                        {props.loggedIn ? <>
                            <Button variant="outline-light" className="d-flex align-items-center" onClick={props.logout}>
                                <i className="bi bi-box-arrow-right me-1"></i> Logout
                            </Button>
                        </> : 
                        <Link to="/login" className="btn btn-outline-light">Accedi</Link>}
                    </Col>
                </Row>
            </Container>
        </Navbar>
    )


}

export default NavHeader;