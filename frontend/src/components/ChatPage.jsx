import { useState, useEffect, useCallback, useRef } from 'react';
import { Container, Row, Col, Form, Button, ListGroup, Modal, Alert, Badge } from 'react-bootstrap';
import API from '../API';
import dayjs from 'dayjs';

function ChatPage({ user }) {
    // DEBUG: Controlla nella console del browser se vedi il tuo username
    console.log("[DEBUG] Utente loggato:", user);

    const [teams, setTeams] = useState([]); 
    const [invites, setInvites] = useState([]); 
    const [currentTeam, setCurrentTeam] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [errorMsg, setErrorMsg] = useState("");
    
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newTeamName, setNewTeamName] = useState("");
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteUsername, setInviteUsername] = useState("");
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); };

    const refreshAllData = useCallback(() => {
        API.getTeams().then(ts => setTeams(Array.isArray(ts) ? ts : [])).catch(e => console.error(e));
        API.getInvites().then(inv => setInvites(Array.isArray(inv) ? inv : [])).catch(e => console.error(e));
    }, []);

    useEffect(() => {
        refreshAllData();
        const interval = setInterval(refreshAllData, 5000);
        return () => clearInterval(interval);
    }, [refreshAllData]);

    useEffect(() => {
        if (!currentTeam) return;
        API.getMessages(currentTeam.id).then(setMessages).catch(console.error);
        
        const ws = new WebSocket(`ws://localhost:3000/ws/team/${currentTeam.id}`);
        ws.onmessage = (e) => {
            try { setMessages(prev => [...prev, JSON.parse(e.data)]); } catch (err) { console.error(err); }
        };
        return () => { if (ws.readyState === 1) ws.close(); };
    }, [currentTeam]);

    useEffect(() => scrollToBottom(), [messages]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !currentTeam) return;
        try {
            await API.sendMessage(currentTeam.id, newMessage); // Usa ID
            setNewMessage("");
        } catch (err) { console.error(err); setErrorMsg("Errore invio"); setTimeout(() => setErrorMsg(""), 3000); }
    };

    const handleCreateTeam = async () => {
        try {
            await API.createTeam(newTeamName);
            setShowCreateModal(false); setNewTeamName(""); refreshAllData();
        } catch (err) { alert(err.message); }
    };

    const handleInvite = async () => {
        try {
            await API.inviteUser(inviteUsername, currentTeam.id); // Usa ID
            setShowInviteModal(false); setInviteUsername(""); alert("Invito inviato");
        } catch (err) { alert(err.message); }
    };

    const handleAcceptInvite = async (teamId) => {
        try { await API.acceptInvite(teamId); refreshAllData(); } catch (err) { console.error(err); }
    };

    const handleLeaveTeam = async () => {
        if (!currentTeam || !window.confirm("Sicuro di voler abbandonare il gruppo?")) return;
        try { await API.leaveTeam(currentTeam.id); setCurrentTeam(null); setMessages([]); refreshAllData(); } 
        catch (err) { console.error(err); alert("Impossibile abbandonare."); }
    };

    const formatDateLabel = (d) => {
        const date = dayjs(d), today = dayjs(), yest = dayjs().subtract(1, 'day');
        if (date.isSame(today, 'day')) return "Oggi";
        if (date.isSame(yest, 'day')) return "Ieri";
        return date.format('DD/MM/YYYY');
    };

    return (
        <Container fluid className="d-flex flex-column p-0" style={{ height: 'calc(100vh - 60px)' }}>
            <Row className="flex-grow-1 m-0" style={{overflow: 'hidden'}}>
                <Col md={3} lg={2} className="border-end bg-light d-flex flex-column h-100 p-0">
                    {invites.length > 0 && (
                        <div className="p-3 bg-warning bg-opacity-25 border-bottom">
                            <small className="fw-bold text-muted">INVITI</small>
                            <ListGroup variant="flush" className="mt-2 bg-transparent">
                                {invites.map(inv => (
                                    <ListGroup.Item key={inv.id} className="d-flex justify-content-between align-items-center bg-white rounded mb-1 p-2 border shadow-sm">
                                        <span className="text-truncate" style={{maxWidth: '100px'}}>{inv.name}</span>
                                        <Button size="sm" variant="success" onClick={() => handleAcceptInvite(inv.id)}><i className="bi bi-check-lg"></i></Button>
                                    </ListGroup.Item>
                                ))}
                            </ListGroup>
                        </div>
                    )}
                    <div className="p-3 d-flex justify-content-between align-items-center">
                        <h6 className="m-0 fw-bold text-muted">GRUPPI</h6>
                        <Button variant="outline-primary" size="sm" onClick={() => setShowCreateModal(true)}><i className="bi bi-plus-lg"></i></Button>
                    </div>
                    <div className="flex-grow-1 overflow-auto">
                        <ListGroup variant="flush">
                            {teams.map(team => (
                                <ListGroup.Item key={team.id} action active={currentTeam?.id === team.id} onClick={() => setCurrentTeam(team)} className="border-0 py-3">
                                    <i className="bi bi-hash opacity-50"></i> {team.name}
                                </ListGroup.Item>
                            ))}
                        </ListGroup>
                    </div>
                </Col>

                <Col md={9} lg={10} className="d-flex flex-column p-0 h-100 bg-white position-relative">
                    {errorMsg && <Alert variant="danger" className="position-absolute w-100 top-0 m-0 rounded-0" style={{zIndex: 10}} onClose={() => setErrorMsg("")} dismissible>{errorMsg}</Alert>}
                    
                    {currentTeam ? (
                        <>
                            <div className="p-3 border-bottom bg-white d-flex justify-content-between align-items-center shadow-sm" style={{height: '70px'}}>
                                <h4 className="m-0 fw-bold text-dark">
                                    <span className="text-primary opacity-50">#</span> {currentTeam.name}
                                </h4>
                                <div className="d-flex gap-2">
                                    <Button variant="primary" className="d-flex align-items-center gap-2 shadow-sm px-3 fw-semibold" onClick={() => setShowInviteModal(true)}>
                                        <i className="bi bi-person-plus-fill fs-5"></i> <span className="d-none d-md-inline">Invita</span>
                                    </Button>
                                    <Button variant="danger" className="d-flex align-items-center gap-2 shadow-sm px-3 fw-semibold" onClick={handleLeaveTeam}>
                                        <i className="bi bi-box-arrow-right fs-5"></i> <span className="d-none d-md-inline">Abbandona</span>
                                    </Button>
                                </div>
                            </div>

                            <div className="flex-grow-1 p-4 position-relative" style={{overflowY: 'auto', background: '#e5ddd5', zIndex: 1}}>
                                <div className="position-absolute top-50 start-50 translate-middle" style={{ fontSize: '15rem', opacity: '0.1', zIndex: -1, userSelect: 'none', filter: 'grayscale(100%)' }}>
                                    🦀
                                </div>

                                {messages.map((msg, idx) => {
                                    const prevMsg = messages[idx - 1];
                                    const showDate = !prevMsg || msg.data !== prevMsg.data;
                                    // Controllo se il messaggio è mio
                                    const isMine = user && msg.username === user.username;

                                    return (
                                        <div key={idx} className="d-flex flex-column">
                                            {showDate && (
                                                <div className="d-flex justify-content-center my-3">
                                                    <Badge bg="secondary" className="opacity-75 fw-normal px-3 py-1 rounded-pill">{formatDateLabel(msg.data)}</Badge>
                                                </div>
                                            )}
                                            
                                            {/* CLASSE DINAMICA: isMine ? destra : sinistra */}
                                            <div className={`mb-2 d-flex flex-column ${isMine ? 'align-items-start' : 'align-items-end'}`}>
                                                <div className={`p-2 px-3 rounded-3 shadow-sm border ${isMine ? 'bg-success text-white' : 'bg-white text-dark'}`} 
                                                     style={{maxWidth: '75%', minWidth: '120px', position: 'relative'}}>
                                                    
                                                    {/* Mostra nome solo se NON è mio */}
                                                    {!isMine && <div className="fw-bold small text-primary mb-1">{msg.username}</div>}
                                                    
                                                    <div style={{paddingRight: '45px', wordWrap: 'break-word'}}>{msg.message}</div>
                                                    
                                                    <div className={`small position-absolute bottom-0 end-0 pe-2 pb-1 ${isMine ? 'text-light opacity-75' : 'text-muted'}`} style={{fontSize: '0.65rem'}}>
                                                        {msg.ora?.substring(0, 5)}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>

                            <div className="p-3 bg-light border-top">
                                <Form onSubmit={handleSend}>
                                    <Row className="g-2">
                                        <Col><Form.Control type="text" placeholder="Scrivi..." value={newMessage} onChange={(e) => setNewMessage(e.target.value)} className="rounded-pill py-2 px-3" /></Col>
                                        <Col xs="auto"><Button type="submit" variant="primary" className="rounded-circle p-2 px-3"><i className="bi bi-send-fill"></i></Button></Col>
                                    </Row>
                                </Form>
                            </div>
                        </>
                    ) : (
                        <div className="h-100 d-flex flex-column align-items-center justify-content-center text-muted bg-light">
                            <div className="display-1 opacity-25 mb-3">🦀</div>
                            <h4>Benvenuto su Ruggine Chat</h4>
                            <p>Seleziona un gruppo.</p>
                        </div>
                    )}
                </Col>
            </Row>

            <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)} centered>
                <Modal.Header closeButton><Modal.Title>Nuovo Gruppo</Modal.Title></Modal.Header>
                <Modal.Body><Form.Control type="text" placeholder="Nome..." value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} autoFocus /></Modal.Body>
                <Modal.Footer><Button variant="primary" onClick={handleCreateTeam} disabled={!newTeamName.trim()}>Crea</Button></Modal.Footer>
            </Modal>

            <Modal show={showInviteModal} onHide={() => setShowInviteModal(false)} centered>
                <Modal.Header closeButton><Modal.Title>Invita</Modal.Title></Modal.Header>
                <Modal.Body><Form.Control type="text" placeholder="Username..." value={inviteUsername} onChange={(e) => setInviteUsername(e.target.value)} autoFocus /></Modal.Body>
                <Modal.Footer><Button variant="success" onClick={handleInvite} disabled={!inviteUsername.trim()}>Invia</Button></Modal.Footer>
            </Modal>
        </Container>
    );
}

export default ChatPage;