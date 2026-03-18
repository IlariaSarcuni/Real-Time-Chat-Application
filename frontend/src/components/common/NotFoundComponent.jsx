import { useContext } from "react";
import { Col, Image, Row } from "react-bootstrap";
import { Link } from "react-router-dom";
import ThemeContext from "../../contexts/ThemeContext";

function NotFoundComponent() {

    const theme = useContext(ThemeContext);

    const linkColor = theme === 'dark' ? 'text-white' : 'text-primary';
    const textColor = theme === 'dark' ? 'text-white' : 'text-dark';

    return (
        <div 
            className={`${theme} d-flex flex-column justify-content-center align-items-center`} 
            style={{ minHeight: "100vh" }}
        >
            <Row className="w-100">
                <Col md={8} lg={6} className="mx-auto text-center">
                    <Image src="/404NotFound.png" fluid style={{ maxHeight: "350px" }}></Image>
                </Col>
            </Row>
            
            <Row className={`text-center mt-4 w-100 ${textColor}`}>
                <Col as="h2" md={8} lg={6} className="mx-auto fw-bold">Opsss! Pagina non trovata.</Col>
            </Row>
            
            <Row className="text-center mt-3 w-100">
                <Col as="p" md={8} lg={6} className="mx-auto">
                    <Link 
                        to="/" 
                        className={`text-decoration-underline ${linkColor}`}
                        style={{ fontSize: '1.2rem' }}>
                        Ritorna all'homepage
                    </Link>
                </Col>
            </Row>
        </div>
    )
}

export default NotFoundComponent;