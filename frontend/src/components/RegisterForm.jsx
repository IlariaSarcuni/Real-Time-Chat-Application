import { useState, useContext } from "react";
import { Form, Button, Alert, Row, Col, Card } from "react-bootstrap";
import { useNavigate, Link } from "react-router-dom";
import API from "../API";
import ThemeContext from "../ThemeContext";

function RegisterForm() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    const [show, setShow] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();
    const theme = useContext(ThemeContext);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setErrorMessage('');
        
        // Validazione base
        if (username.trim().length < 3) {
            setErrorMessage("L'username deve essere di almeno 3 caratteri.");
            setShow(true);
            return;
        }
        if (password.length < 6) {
            setErrorMessage("La password deve essere di almeno 6 caratteri.");
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
            // Se va a buon fine, vai al login (o fai login automatico)
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
                    <Card className="shadow-lg border-0">
                        <Card.Body className="p-5">
                            <div className="text-center mb-4">
                                <h2 className="fw-bold text-primary">Registrati</h2>
                                <p className="text-muted">Crea il tuo account per Ruggine Chat</p>
                            </div>

                            <Alert dismissible show={show} onClose={() => setShow(false)} variant="danger">
                                {errorMessage}
                            </Alert>

                            <Form onSubmit={handleSubmit}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Username</Form.Label>
                                    <Form.Control 
                                        type="text" 
                                        placeholder="Scegli un username" 
                                        value={username}
                                        onChange={ev => setUsername(ev.target.value)}
                                        required 
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Password</Form.Label>
                                    <Form.Control 
                                        type="password" 
                                        placeholder="Password (min 6 caratteri)" 
                                        value={password}
                                        onChange={ev => setPassword(ev.target.value)}
                                        required 
                                    />
                                </Form.Group>

                                <Form.Group className="mb-4">
                                    <Form.Label>Conferma Password</Form.Label>
                                    <Form.Control 
                                        type="password" 
                                        placeholder="Ripeti la password" 
                                        value={confirmPassword}
                                        onChange={ev => setConfirmPassword(ev.target.value)}
                                        required 
                                    />
                                </Form.Group>

                                <div className="d-grid gap-2">
                                    <Button variant="primary" size="lg" type="submit" disabled={loading}>
                                        {loading ? 'Registrazione...' : 'Crea Account'}
                                    </Button>
                                </div>
                            </Form>

                            <div className="text-center mt-4">
                                <span className="text-muted">Hai già un account? </span>
                                <Link to="/login" className="fw-bold text-decoration-none">Accedi qui</Link>
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </div>
    );
}

export default RegisterForm;