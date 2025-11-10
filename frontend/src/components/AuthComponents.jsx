import { Alert, Button, Card, Form, Row, Col } from "react-bootstrap";
import LineSeparator from "./utilities/LineSeparator";
import ThemeContext from "../ThemeContext";
import "../stylesheets/AuthComponents.css";

import API from "../API.js";
import { useContext, useState } from "react";
import { useNavigate, Link } from "react-router-dom";

function LoginForm(props) {

    // state
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [show, setShow] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    // theme context
    const theme = useContext(ThemeContext);

    const navigate = useNavigate();

    const handleSubmit = async (event) => {
        event.preventDefault();
        setErrorMessage('');
        setLoading(true);   // Accesso in corso...

        try {
            const credentials = { username, password }
            await API.logIn(credentials);
            navigate('/chat');
        } catch (error) {
            setErrorMessage(error.message || 'Errore in fase di login');
            setShow(true);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className={theme}>
            <Row className="justify-content-center align-items-center min-vh-100">
                <Col xs={12} sm={10} md={8} lg={5}>
                    <Card className="login-card shadow-lg">
                        <Card.Title>
                            <h3>Login</h3>
                            <p>Effettua il login per accedere a Ruggine</p>
                        </Card.Title>
                        <Card.Body className="pt-0">
                            <Form onSubmit={handleSubmit}>
                                <Alert dismissible show={show} onClose={() => setShow(false)} variant="danger">{errorMessage}</Alert>
                                <Form.Group className="mb-3" controlId="formBasicEmail">    {/* instead of id and for. Web accessibility */}
                                    <Form.Label className="fw-semibold">Email<span className="mandatory">*</span></Form.Label>
                                    <Form.Control type="email" placeholder="Inserisci la tua email" value={username}
                                        onChange={event => setUsername(event.target.value)} required={true} />
                                </Form.Group>
                                <Form.Group className="mb-3" controlId="formBasicPassword">
                                    <Form.Label className="fw-semibold">Password<span className="mandatory">*</span></Form.Label>
                                    <Form.Control type="password" placeholder="Inserisci la tua password" value={password}
                                        onChange={event => setPassword(event.target.value)} required={true} />
                                </Form.Group>
                                <Button type="submit" variant="success" disabled={loading} className="mt-3 login-button">
                                    {loading ? 'Accesso in corso...' : 'Accedi'}
                                </Button>
                                <LineSeparator>or</LineSeparator>
                                <Link className={`btn ${theme === "light" ? "btn-outline-secondary" : "btn-secondary"} registration-button`} to={"/register"}>Registrati</Link>
                            </Form>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </div>
    )
}

function LogoutButton(props) {
    return (
      <Button variant='outline-light'>Logout</Button>
    )
  }

export { LoginForm, LogoutButton };