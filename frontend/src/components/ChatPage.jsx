import { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Form, Button, ListGroup, Modal, Badge, Alert } from 'react-bootstrap';
import API from '../API';

function ChatPage() {
    // Dati
    const [teams, setTeams] = useState([]); 
    const [invites, setInvites] = useState([]); // <--- Stato per gli inviti
    const [currentTeam, setCurrentTeam] = useState(null);
    const [messages, setMessages] = useState([]);
    
    // Input
    const [newMessage, setNewMessage] = useState("");
    
    // UI e Errori
    const [errorMsg, setErrorMsg] = useState("");
    
    // Modali
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newTeamName, setNewTeamName] = useState("");
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteUsername, setInviteUsername] = useState("");

    // 1. Caricamento iniziale (Gruppi + Inviti)
    const refreshAllData = useCallback(() => {
        API.getTeams()
            .then(ts => setTeams(ts))
            .catch(err => console.error("Errore team:", err));

        API.getInvites()
            .then(inv => setInvites(inv))
            .catch(err => console.error("Errore inviti:", err));
    }, []);

    useEffect(() => {
        refreshAllData();
    }, [refreshAllData]);

    // 2. Polling messaggi (Ogni 2 sec) + Refresh inviti/gruppi (Ogni 5 sec)
    useEffect(() => {
        // Polling Messaggi (solo se c'è un team selezionato)
        let msgInterval = null;
        if (currentTeam) {
            const fetchMsgs = () => {
                API.getMessages(currentTeam.name)
                    .then(msgs => setMessages(msgs))
                    .catch(err => console.error(err));
            };
            fetchMsgs(); // Chiamata immediata
            msgInterval = setInterval(fetchMsgs, 2000);
        }

        // Polling background per nuovi inviti o gruppi (ogni 5 secondi)
        const dataInterval = setInterval(() => {
            refreshAllData();
        }, 5000);

        return () => {
            if (msgInterval) clearInterval(msgInterval);
            clearInterval(dataInterval);
        };
    }, [currentTeam, refreshAllData]);

    // --- HANDLERS ---

    const handleSend = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !currentTeam) return;
        try {
            await API.sendMessage(currentTeam.name, newMessage);
            setNewMessage(""); 
            // Aggiorna subito i messaggi senza aspettare il polling
            const msgs = await API.getMessages(currentTeam.name);
            setMessages(msgs);
        } catch (err) {
            setErrorMsg("Impossibile inviare il messaggio");
            setTimeout(() => setErrorMsg(""), 3000);
        }
    };

    const handleCreateTeam = async () => {
        try {
            await API.createTeam(newTeamName);
            setShowCreateModal(false);
            setNewTeamName("");
            refreshAllData(); // Ricarica liste
        } catch (err) {
            alert("Errore creazione gruppo: " + err.message);
        }
    };

    const handleInvite = async () => {
        try {
            await API.inviteUser(inviteUsername, currentTeam.name);
            setShowInviteModal(false);
            setInviteUsername("");
            alert("Invito inviato con successo!");
        } catch (err) {
            alert("Errore invio invito: Utente non trovato o errore server.");
        }
    };

    const handleAcceptInvite = async (teamName) => {
        try {
            await API.acceptInvite(teamName);
            refreshAllData(); // Ricarica per spostare il team da inviti a lista gruppi
        } catch (err) {
            alert("Impossibile accettare l'invito.");
        }
    }

    return (
        <Container fluid className="vh-100 d-flex flex-column p-0">
            {/* Header semplificato integrato */}
            <Row className="bg-primary text-white p-3 m-0 shadow-sm align-items-center">
                <Col>
                    <h4 className="m-0 fw-bold"><i className="bi bi-chat-square-quote-fill"></i> Ruggine Chat</h4>
                </Col>
            </Row>

            <Row className="flex-grow-1 m-0" style={{overflow: 'hidden'}}>
                {/* SIDEBAR SINISTRA */}
                <Col md={3} lg={2} className="border-end bg-light d-flex flex-column h-100 p-0">
                    
                    {/* Sezione Inviti (Visibile solo se ce ne sono) */}
                    {invites.length > 0 && (
                        <div className="p-3 bg-warning bg-opacity-25 border-bottom">
                            <small className="text-uppercase fw-bold text-muted" style={{fontSize:'0.7rem'}}>Inviti in attesa</small>
                            <ListGroup variant="flush" className="mt-2 bg-transparent">
                                {invites.map(inv => (
                                    <ListGroup.Item key={inv.id} className="d-flex justify-content-between align-items-center bg-white rounded mb-1 p-2 border shadow-sm">
                                        <span className="fw-bold text-truncate" style={{maxWidth: '100px'}}>{inv.name}</span>
                                        <Button size="sm" variant="success" onClick={() => handleAcceptInvite(inv.name)} title="Accetta">
                                            <i className="bi bi-check-lg"></i>
                                        </Button>
                                    </ListGroup.Item>
                                ))}
                            </ListGroup>
                        </div>
                    )}

                    {/* Sezione Gruppi */}
                    <div className="p-3 d-flex justify-content-between align-items-center">
                        <h6 className="m-0 fw-bold text-uppercase text-muted">I tuoi Gruppi</h6>
                        <Button variant="outline-primary" size="sm" onClick={() => setShowCreateModal(true)}>
                            <i className="bi bi-plus-lg"></i>
                        </Button>
                    </div>
                    
                    <ListGroup variant="flush" className="flex-grow-1 overflow-auto">
                        {teams.map(team => (
                            <ListGroup.Item 
                                key={team.id} 
                                action 
                                active={currentTeam && currentTeam.id === team.id}
                                onClick={() => setCurrentTeam(team)}
                                className="border-0 py-3"
                            >
                                <i className="bi bi-hash me-2 opacity-50"></i>
                                {team.name}
                            </ListGroup.Item>
                        ))}
                        {teams.length === 0 && <div className="text-center text-muted mt-4 small">Nessun gruppo attivo</div>}
                    </ListGroup>
                </Col>

                {/* AREA CHAT CENTRALE */}
                <Col md={9} lg={10} className="d-flex flex-column p-0 h-100 bg-white position-relative">
                    {errorMsg && (
                        <Alert variant="danger" className="position-absolute w-100 start-0 top-0 m-0 rounded-0" style={{zIndex: 10}} onClose={() => setErrorMsg("")} dismissible>
                            {errorMsg}
                        </Alert>
                    )}

                    {currentTeam ? (
                        <>
                            {/* Header Chat */}
                            <div className="p-3 border-bottom bg-white d-flex justify-content-between align-items-center shadow-sm" style={{height: '60px'}}>
                                <h5 className="m-0 fw-bold">
                                    <span className="text-muted">#</span> {currentTeam.name}
                                </h5>
                                <Button variant="outline-secondary" size="sm" onClick={() => setShowInviteModal(true)}>
                                    <i className="bi bi-person-plus-fill me-1"></i> Invita
                                </Button>
                            </div>

                            {/* Lista Messaggi */}
                            <div className="flex-grow-1 p-4" style={{overflowY: 'auto', background: '#f0f2f5'}}>
                                {messages.length === 0 && (
                                    <div className="text-center text-muted mt-5">
                                        <i className="bi bi-chat-dots display-4"></i>
                                        <p className="mt-2">Nessun messaggio qui. Scrivi il primo!</p>
                                    </div>
                                )}
                                {messages.map((msg, idx) => (
                                    <div key={idx} className="mb-3 d-flex flex-column">
                                        <div className="bg-white p-3 rounded-3 shadow-sm border" style={{maxWidth: '85%', width: 'fit-content'}}>
                                            <div className="d-flex justify-content-between align-items-baseline mb-1 gap-3">
                                                <span className="fw-bold text-primary small">{msg.username}</span>
                                                <span className="text-muted small" style={{fontSize: '0.7rem'}}>{msg.ora}</span>
                                            </div>
                                            <div className="text-break">{msg.message}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Input Area */}
                            <div className="p-3 bg-light border-top">
                                <Form onSubmit={handleSend}>
                                    <Row className="g-2">
                                        <Col>
                                            <Form.Control 
                                                type="text" 
                                                placeholder={`Scrivi in #${currentTeam.name}...`} 
                                                value={newMessage}
                                                onChange={(e) => setNewMessage(e.target.value)}
                                                autoComplete="off"
                                                className="rounded-pill py-2 px-3"
                                            />
                                        </Col>
                                        <Col xs="auto">
                                            <Button type="submit" variant="primary" className="rounded-circle p-2 px-3" disabled={!newMessage.trim()}>
                                                <i className="bi bi-send-fill"></i>
                                            </Button>
                                        </Col>
                                    </Row>
                                </Form>
                            </div>
                        </>
                    ) : (
                        <div className="h-100 d-flex flex-column align-items-center justify-content-center text-muted bg-light">
                            <div className="display-1 opacity-25 mb-3">🦀</div>
                            <h4>Benvenuto su Ruggine Chat</h4>
                            <p>Seleziona un gruppo a sinistra per iniziare a messaggiare.</p>
                        </div>
                    )}
                </Col>
            </Row>

            {/* --- MODALI --- */}
            
            {/* Crea Gruppo */}
            <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)} centered>
                <Modal.Header closeButton className="border-0 pb-0">
                    <Modal.Title>Nuovo Gruppo</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form.Control 
                        type="text" 
                        placeholder="Nome del gruppo..." 
                        value={newTeamName} 
                        onChange={(e) => setNewTeamName(e.target.value)} 
                        autoFocus
                    />
                </Modal.Body>
                <Modal.Footer className="border-0 pt-0">
                    <Button variant="link" className="text-decoration-none text-secondary" onClick={() => setShowCreateModal(false)}>Annulla</Button>
                    <Button variant="primary" onClick={handleCreateTeam} disabled={!newTeamName.trim()}>Crea</Button>
                </Modal.Footer>
            </Modal>

            {/* Invita Utente */}
            <Modal show={showInviteModal} onHide={() => setShowInviteModal(false)} centered>
                <Modal.Header closeButton className="border-0 pb-0">
                    <Modal.Title>Invita Persona</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p className="text-muted small">Stai invitando in: <strong>{currentTeam?.name}</strong></p>
                    <Form.Control 
                        type="text" 
                        placeholder="Username esatto..."
                        value={inviteUsername} 
                        onChange={(e) => setInviteUsername(e.target.value)} 
                        autoFocus
                    />
                </Modal.Body>
                <Modal.Footer className="border-0 pt-0">
                    <Button variant="link" className="text-decoration-none text-secondary" onClick={() => setShowInviteModal(false)}>Annulla</Button>
                    <Button variant="success" onClick={handleInvite} disabled={!inviteUsername.trim()}>Invia Invito</Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
}

export default ChatPage;