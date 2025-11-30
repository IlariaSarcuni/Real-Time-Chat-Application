import { Container, Row, Col, Navbar } from "react-bootstrap";
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
                </Row>
            </Container>
        </Navbar>
    )


}

export default NavHeader;