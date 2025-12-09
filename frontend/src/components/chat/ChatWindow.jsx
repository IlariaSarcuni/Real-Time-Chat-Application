import { useContext, useRef, useEffect } from 'react';
import { Col, Row, Form, Button, Alert, Badge } from 'react-bootstrap';
import ThemeContext from '../../contexts/ThemeContext';
import { getColorFromUsername, formatDateLabel } from '../../utils/chatUtils';

function ChatWindow({ 
    currentTeam, messages, user, errorMsg, setErrorMsg, 
    newMessage, setNewMessage, onSend, 
    onLeave, onShowMembers, onShowInvite, onShowRename 
}) {
    const theme = useContext(ThemeContext);
    const messagesEndRef = useRef(null);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Stili
    const chatBg = theme === 'dark' ? '#212529' : '#e5ddd5';
    const headerClass = theme === 'dark' ? 'bg-dark border-secondary text-white' : 'bg-white text-dark';

    // Se nessun team è selezionato
    if (!currentTeam) {
        return (
            <Col md={9} lg={10} className="d-flex flex-column p-0 h-100 align-items-center justify-content-center" 
                 style={{ backgroundColor: chatBg, color: theme === 'dark' ? '#f8f9fa' : '#6c757d' }}>
                <div className="display-1 opacity-25 mb-3">🦀</div>
                <h4>Benvenuto su Ruggine Chat</h4>
            </Col>
        );
    }

    return (
        <Col md={9} lg={10} className="d-flex flex-column p-0 h-100 position-relative" style={{ backgroundColor: chatBg }}>
            {errorMsg && <Alert variant="danger" className="position-absolute w-100 top-0 m-0 rounded-0" style={{ zIndex: 10 }} onClose={() => setErrorMsg("")} dismissible>{errorMsg}</Alert>}

            {/* HEADER */}
            <div className={`p-3 border-bottom d-flex justify-content-between align-items-center shadow-sm ${headerClass}`} style={{ height: '70px' }}>
                <h4 className="m-0 fw-bold d-flex align-items-center gap-2">
                    <span><span className="text-primary opacity-50">#</span> {currentTeam.name}</span>
                    <Button variant="link" className={`p-0 text-decoration-none ${theme === 'dark' ? 'text-secondary' : 'text-muted'}`} onClick={onShowRename}>
                        <i className="bi bi-pencil-square fs-6"></i>
                    </Button>
                </h4>
                <div className="d-flex gap-2">
                    <Button variant="secondary" onClick={onShowMembers} style={{ width: '45px', height: '45px' }}><i className="bi bi-people-fill"></i></Button>
                    <Button variant="primary" onClick={onShowInvite} style={{ width: '45px', height: '45px' }}><i className="bi bi-person-plus-fill"></i></Button>
                    <Button variant="danger" onClick={onLeave} style={{ width: '45px', height: '45px' }}><i className="bi bi-box-arrow-right"></i></Button>
                </div>
            </div>

            {/* MESSAGGI */}
            <div className="flex-grow-1 position-relative">
                <div className="position-absolute top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center" style={{ zIndex: 0, pointerEvents: 'none' }}>
                    <div style={{ fontSize: '15rem', opacity: '0.1', filter: theme === 'dark' ? 'invert(1)' : 'grayscale(100%)' }}>🦀</div>
                </div>
                <div className="position-absolute top-0 start-0 w-100 h-100 p-4" style={{ overflowY: 'auto', zIndex: 1 }}>
                    {messages.map((msg, idx) => {
                        const prevMsg = messages[idx - 1];
                        const showDate = !prevMsg || msg.data !== prevMsg.data;
                        const isMine = user && msg.username === user.username;
                        const userColor = getColorFromUsername(msg.username);
                        let bubbleClass = isMine ? "bg-success text-white" : (theme === 'dark' ? "bg-secondary text-white" : "bg-white text-dark");

                        return (
                            <div key={idx} className="d-flex flex-column">
                                {showDate && (
                                    <div className="d-flex justify-content-center my-3">
                                        <Badge bg={theme === 'dark' ? 'dark' : 'secondary'} className="opacity-75 fw-normal px-3 py-1 rounded-pill border">{formatDateLabel(msg.data)}</Badge>
                                    </div>
                                )}
                                <div className={`mb-2 d-flex flex-column ${isMine ? 'align-items-end' : 'align-items-start'}`}>
                                    <div className={`p-2 px-3 rounded-3 shadow-sm border ${bubbleClass}`}
                                        style={{ maxWidth: '75%', minWidth: '120px', position: 'relative', border: theme === 'dark' ? '1px solid #444' : '' }}>
                                        {!isMine && <div className="fw-bold small mb-1" style={{ color: userColor }}>{msg.username}</div>}
                                        <div style={{ paddingRight: '45px', wordWrap: 'break-word' }}>{msg.message}</div>
                                        <div className={`small position-absolute bottom-0 end-0 pe-2 pb-1 ${isMine || theme === 'dark' ? 'text-light opacity-75' : 'text-muted'}`} style={{ fontSize: '0.65rem' }}>
                                            {msg.ora?.substring(0, 5)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* INPUT */}
            <div className={`p-3 border-top ${theme === 'dark' ? 'bg-dark border-secondary' : 'bg-light'}`}>
                <Form onSubmit={onSend}>
                    <Row className="g-2">
                        <Col>
                            <Form.Control type="text" placeholder="Scrivi..." value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
                                className="rounded-pill py-2 px-3"
                                style={{ backgroundColor: theme === 'dark' ? '#343a40' : '#fff', color: theme === 'dark' ? '#fff' : '#000', border: theme === 'dark' ? '1px solid #555' : '' }} />
                        </Col>
                        <Col xs="auto"><Button type="submit" variant="primary" className="rounded-circle p-2 px-3"><i className="bi bi-send-fill"></i></Button></Col>
                    </Row>
                </Form>
            </div>
        </Col>
    );
}

export default ChatWindow;