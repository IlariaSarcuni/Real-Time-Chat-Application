import { useState, useContext } from "react";
import { Form, Button, Alert, Row, Col, Card, Spinner } from "react-bootstrap";
import { useNavigate, Link } from "react-router-dom";

import LineSeparator from "../common/LineSeparator";
import API from "../../API";
import ThemeContext from "../../contexts/ThemeContext";

function RegisterForm() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    const [show, setShow] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const navigate = useNavigate();
    const theme = useContext(ThemeContext);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setErrorMessage('');
        
        if (username.trim().length < 3) {
            setErrorMessage("L'username deve essere di almeno 3 caratteri.");
            setShow(true);
            return;
        }
        if (password.length < 8) {
            setErrorMessage("La password deve essere di almeno 8 caratteri.");
            setShow(true);
            return;
        }
        if (password !== confirmPassword) {
            setErrorMessage("Le password non coincidono.");
            setShow(true);
            return;
        }

        setLoading(true);

        try {
            await API.register({ username, password });
            alert("Registrazione avvenuta con successo! Ora puoi accedere.");
            navigate('/login');
        } catch (error) {
            setErrorMessage(error.message);
            setShow(true);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={theme}>
            <Row className="justify-content-center align-items-center min-vh-100">
                <Col xs={12} sm={10} md={8} lg={5}>
                    <Card className="auth-card">
                        <Card.Title className="card-title">
                            <h3>Registrati a Ruggine</h3>
                        </Card.Title>
                        <Card.Body className="p-5">
                            <Form onSubmit={handleSubmit}>
                                <Alert dismissible show={show} onClose={() => setShow(false)} variant="danger">{errorMessage}</Alert>
                                <Form.Group className="mb-3">
                                    <Form.Label className="fw-semibold">Username<span className="mandatory">*</span></Form.Label>
                                    <Form.Control 
                                        type="text" 
                                        placeholder="Scegli un username" 
                                        value={username}
                                        onChange={ev => setUsername(ev.target.value)}
                                        required 
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label className="fw-semibold">Password<span className="mandatory">*</span></Form.Label>
                                    <div className="password-input-wrapper">
                                        <Form.Control 
                                            type={showPassword ? "text" : "password"} 
                                            placeholder="Password (min 8 caratteri)" 
                                            value={password}
                                            onChange={ev => setPassword(ev.target.value)}
                                            required 
                                        />
                                        <button
                                            type="button"
                                            className="password-toggle-btn"
                                            onClick={() => setShowPassword(!showPassword)}
                                            aria-label={showPassword ? "Nascondi password" : "Mostra password"}
                                        >
                                            <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} style={{ fontSize: '20px' }}></i>
                                        </button>
                                    </div>
                                </Form.Group>

                                <Form.Group className="mb-4">
                                    <Form.Label className="fw-semibold">Conferma Password<span className="mandatory">*</span></Form.Label>
                                    <div className="password-input-wrapper">
                                        <Form.Control 
                                            type={showConfirmPassword ? "text" : "password"} 
                                            placeholder="Ripeti la password" 
                                            value={confirmPassword}
                                            onChange={ev => setConfirmPassword(ev.target.value)}
                                            required 
                                        />
                                        <button
                                            type="button"
                                            className="password-toggle-btn"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            aria-label={showConfirmPassword ? "Nascondi password" : "Mostra password"}
                                        >
                                            <i className={`bi ${showConfirmPassword ? 'bi-eye-slash' : 'bi-eye'}`} style={{ fontSize: '20px' }}></i>
                                        </button>
                                    </div>
                                </Form.Group>

                                <div className="d-grid gap-2">
                                    <Button className="mt-3 login-button" size="lg" type="submit" disabled={loading}>
                                        {loading ? (<>
                                            <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2"/> 
                                            {'Registrazione in corso...'} </>) : 'Crea Account'}
                                    </Button>
                                    <LineSeparator>oppure</LineSeparator>
                                    <Link className="btn btn-lg registration-button" to={"/login"}>Accedi</Link>
                                </div>
                            </Form>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </div>
    );
}

export default RegisterForm;