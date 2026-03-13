import { Alert, Button, Card, Form, Row, Col, Spinner } from "react-bootstrap";
import { useContext, useState } from "react";
import { useNavigate, Link } from "react-router-dom";

import LineSeparator from "../common/LineSeparator";
import ThemeContext from "../../contexts/ThemeContext";
import "../../stylesheets/AuthComponents.css";
import API from "../../API.js";

function LoginForm() {

    // state
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [show, setShow] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // theme context
    const theme = useContext(ThemeContext);

    const navigate = useNavigate();

    const handleSubmit = async (event) => {
        event.preventDefault();
        setErrorMessage('');
        setLoading(true);   

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
                    <Card className="auth-card">
                        <Card.Title className="card-title">
                            <h3>Accedi a Ruggine</h3>
                        </Card.Title>
                        <Card.Body className="pt-0">
                            <Form onSubmit={handleSubmit}>
                                <Alert dismissible show={show} onClose={() => setShow(false)} variant="danger">{errorMessage}</Alert>
                                <Form.Group className="mb-3" controlId="formBasicUsername">   
                                    <Form.Label className="fw-semibold">Username<span className="mandatory">*</span></Form.Label>
                                    <Form.Control type="text" placeholder="Inserisci il tuo username" value={username}
                                        onChange={event => setUsername(event.target.value)} required={true} />
                                </Form.Group>
                                <Form.Group className="mb-3" controlId="formBasicPassword">
                                    <Form.Label className="fw-semibold">Password<span className="mandatory">*</span></Form.Label>
                                    <div className="password-input-wrapper">
                                        <Form.Control 
                                            type={showPassword ? "text" : "password"} 
                                            placeholder="Inserisci la tua password" 
                                            value={password}
                                            onChange={event => setPassword(event.target.value)} 
                                            required={true} 
                                        />
                                        <button
                                            type="button"
                                            className="password-toggle-btn"
                                            onClick={() => setShowPassword(!showPassword)}
                                            aria-label={showPassword ? "Nascondi password" : "Mostra password"}
                                        >
                                            {showPassword ? (
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                                                    <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/>
                                                    <path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829z"/>
                                                    <path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12-.708.708z"/>
                                                </svg>
                                            ) : (
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                                                    <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/>
                                                    <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/>
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                </Form.Group>
                                <Button type="submit" size="lg" disabled={loading} className="mt-3 login-button">
                                    {loading ? (<>
                                        <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2"/> 
                                        {'Accesso in corso...'} </>) : 'Accedi'}
                                </Button>
                                <LineSeparator>oppure</LineSeparator>
                                <Link className="btn btn-lg registration-button" to={"/register"}>Registrati</Link>
                            </Form>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </div>
    )
}

function LogoutButton() {
    return (
      <Button variant='outline-light'>Logout</Button>
    )
  }

export { LoginForm, LogoutButton };