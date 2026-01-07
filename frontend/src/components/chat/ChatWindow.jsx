import { useContext, useEffect, useRef, useState } from 'react';
import { getColorFromUsername, formatDateLabel } from '../../utils/chatUtils';
import { Alert, Badge, Button, Col, Dropdown, Form, Row } from 'react-bootstrap';

import "../../stylesheets/ChatPage.css";
import Picker from "emoji-picker-react";
import ThemeContext from '../../contexts/ThemeContext';

function ChatWindow({ activeRoom, messages, user, errorMsg, setErrorMsg, newMessage, setNewMessage, onlineMembers, 
    onSend, onLeave, onShowMembers, onShowInvite, onShowRename }) 
    {
    const theme = useContext(ThemeContext);
    const messagesEndRef = useRef(null);

    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const onEmojiClick = (emojiSelector) => {
        setNewMessage(prevMsg => prevMsg + emojiSelector.emoji);
        setShowEmojiPicker(false);  // close picker after selection
    }

    const isTeam = activeRoom.type === 'team';
    const displayName = isTeam 
        ? (activeRoom.data?.name || "Gruppo")
        : (activeRoom.data?.other_username || `Utente ${activeRoom.id}`);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Stili
    const chatBg = theme === 'dark' ? '#212529' : '#e5ddd5';
    const headerClass = theme === 'dark' ? 'bg-dark border-secondary text-white' : 'bg-white text-dark';

    return (
        <Col md={9} lg={10} className="d-flex flex-column p-0 h-100 position-relative" style={{ backgroundColor: chatBg }}>
            {errorMsg && <Alert variant="danger" className="position-absolute w-100 top-0 m-0 rounded-0" style={{ zIndex: 10 }} onClose={() => setErrorMsg("")} dismissible>{errorMsg}</Alert>}

            {/* HEADER */}
            <div className={`p-3 border-bottom d-flex justify-content-between align-items-center shadow-sm ${headerClass}`} style={{ height: '70px' }}>
                {/* 1. Group icon and info */}
                <div className="d-flex align-items-center me-auto">
                    {/* 1.1 Icon */}
                    <div className="text-white rounded-circle d-flex justify-content-center align-items-center me-3"
                        style={{ width: '40px', height: '40px', backgroundColor: getColorFromUsername(displayName, theme) }}>
                        {displayName.charAt(0).toUpperCase()}
                    </div>
                    {/* 1.2 Members online */}
                    <div className="d-flex flex-column">
                        <div className="fw-bold">{displayName}</div>
                        <div className="d-flex align-items-center" style={{ fontSize: '0.8rem', color: '#6c757d' }}>
                            <span className="rounded-circle me-1" style={{ width: '8px', height: '8px', backgroundColor: onlineMembers.length > 0 ? '#28a745' : '#6c757d' }}></span>
                            <span className={onlineMembers.length > 0 ? "text-success" : "text-muted"}>
                                {isTeam ? (`${onlineMembers.length} ${onlineMembers.length === 1 ? 'membro online' : 'membri online'}`) : 
                                    (onlineMembers.includes(activeRoom.data?.other_username) ? 'online' : 'offline') }
                            </span>
                        </div>
                    </div>
                </div>
                {/* 2. Team buttons */}
                {isTeam && (
                    <div className="ms-auto d-flex gap-2">
                        {/* 2.1 Show Members */}
                        <Button variant="light" onClick={onShowMembers} title="Vedi Membri" style={{ width: '45px', height: '45px' }}
                            className={`p-1 group-actions-header d-flex align-items-center justify-content-center ${theme === 'dark' ? 'text-light' : 'text-muted'} rounded`}>
                            <i className="bi bi-people-fill"></i>
                        </Button>
                        {/* 2.2 Invite, Rename and Leave */}
                        <Dropdown align="end">
                            <Dropdown.Toggle variant="light" id="group-actions-dropdown" style={{ width: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            className={`p-1 group-actions-header ${theme === 'dark' ? 'text-light' : 'text-muted'} rounded`}>
                                <i className="bi bi-three-dots-vertical fs-6"></i>
                            </Dropdown.Toggle>
                            <Dropdown.Menu variant={theme}>
                                <Dropdown.Item onClick={onShowInvite}>
                                    <i className="bi bi-person-plus-fill me-2"></i> Invita Utente
                                </Dropdown.Item>
                                <Dropdown.Item onClick={onShowRename}>
                                    <i className="bi bi-pencil-square me-2"></i> Rinomina Gruppo
                                </Dropdown.Item>
                                <Dropdown.Divider />
                                <Dropdown.Item onClick={onLeave} className="text-danger">
                                    <i className="bi bi-box-arrow-right me-2"></i> Abbandona Gruppo
                                </Dropdown.Item>
                            </Dropdown.Menu>
                        </Dropdown>
                    </div>  
                )}  
            </div>

            {/* MESSAGGES */}
            <div className="flex-grow-1 position-relative">
                <div className="position-absolute top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center" style={{ zIndex: 0, pointerEvents: 'none' }}>
                    <div style={{ fontSize: '15rem', opacity: '0.1', filter: theme === 'dark' ? 'invert(1)' : 'grayscale(100%)' }}>🦀</div>
                </div>
                <div className="position-absolute top-0 start-0 w-100 h-100 p-4" style={{ overflowY: 'auto', zIndex: 1 }}>
                    {messages.map((msg, idx) => {
                        const prevMsg = messages[idx-1];
                        const isSystemMessage = msg.type === "system";
                        const showDate = (!prevMsg || msg.data !== prevMsg.data)

                        const dateSeparator = showDate ? (
                            <div className="d-flex justify-content-center my-3">
                                <Badge bg={theme === 'dark' ? 'dark' : 'secondary'} className="opacity-75 fw-normal px-3 py-1 rounded-pill border">{formatDateLabel(msg.data)}</Badge>
                            </div>
                        ) : null;

                        if (isSystemMessage) { 
                            return (
                                <div key={idx} className="d-flex flex-column">
                                    {dateSeparator}
                                    <div className="d-flex justify-content-center my-1">
                                        <span className={`small text-center px-2 py-1 rounded ${theme === 'dark' ? 'text-white opacity-75' : 'text-muted'}`} 
                                            style={{ backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }}>
                                            {msg.message}
                                        </span>
                                    </div>
                                </div>
                            );
                        }

                        const senderName = msg.username || msg.name1;
                        const isMine = user && senderName === user.username;
                        const userColor = getColorFromUsername(msg.username, theme);
                        let bubbleClass = isMine ? "bg-success text-white" : (theme === 'dark' ? "bg-secondary text-white" : "bg-white text-dark");

                        return (
                            <div key={idx} className="d-flex flex-column">
                                {dateSeparator}
                                <div className={`mb-2 d-flex flex-column ${isMine ? 'align-items-end' : 'align-items-start'}`}>
                                    <div className={`p-2 px-3 rounded-3 shadow-sm border ${bubbleClass}`}
                                        style={{ maxWidth: '75%', minWidth: '120px', position: 'relative', border: theme === 'dark' ? '1px solid #444' : '' }}>
                                        
                                        {/* MODIFICA QUI: Mostra il nome solo se è un gruppo (isTeam) e non è il mio messaggio */}
                                        {isTeam && !isMine && (
                                            <div className="fw-bold small mb-1" style={{ color: userColor }}>
                                                ~ {senderName}
                                            </div>
                                        )}

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
                {showEmojiPicker && (
                    <div style={{ position: "absolute", bottom: "100px", right: "15px", zIndex: 1000}}>
                        <Picker onEmojiClick={onEmojiClick} theme={theme}/>
                    </div>
                )}
                <Form onSubmit={onSend}>
                    <Row className="g-2">
                        <Col xs="auto" className="position-relative">
                            <Button variant="light" className={`rounded-circle p-2 px-3 group-actions-header ${theme === 'dark' ? 'text-light' : 'text-muted'}`}
                                onClick={() => setShowEmojiPicker(prev => !prev)} title="Seleziona emoji">
                                    <i className='bi bi-emoji-smile'></i>
                            </Button>
                        </Col>
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

export {ChatWindow};