import { useContext } from "react";
import { Col, Image, Row } from "react-bootstrap";
import { Link } from "react-router-dom";
import ThemeContext from "../ThemeContext";

function NotFoundComponent() {

    const theme = useContext(ThemeContext);

    return (
        <div className={theme}>
            <Row>
                <Col md={6} className="mx-auto">
                    <Image src="/404NotFound.png" fluid></Image>
                </Col>
            </Row>
            <Row className="text-center">
                <Col as="h2" md={6} className="mx-auto">OPPS! Pagina non trovata</Col>
            </Row>
            <Row className="text-center">
                <Col as="p" md={6} className="mx-auto">
                    È possibile che tu abbia digitato l'URL in modo errato o che la pagina sia stata spostata o eliminata.
                </Col>
            </Row>
            <Row className="text-center">
                <Col as="p" md={6} className="mx-auto">
                    <Link to="/" className="btn btn-outline-secondary rounded-pill px-5">Ritorna all'homepage</Link>
                </Col>
            </Row>
        </div>
    )
}

export default NotFoundComponent;