use axum::{
    extract::{ws::{Message, WebSocket, WebSocketUpgrade}, Path, State},
    response::IntoResponse,
    Extension, http::{StatusCode, Uri},
};
use futures_util::{sink::SinkExt, stream::StreamExt};
use tokio::sync::broadcast;
use serde_json::json;

use crate::{models::User, state::AppState};

pub async fn websocket_handler(ws: WebSocketUpgrade, Extension(user): Extension<User>, State(state): State<AppState>, uri: Uri, Path(id): Path<i64>) -> impl IntoResponse {

    let path = uri.path();  

    if path.contains("/ws/team") {
        let is_member = sqlx::query_scalar::<_, i64>("SELECT id_user FROM user_team WHERE id_user = ?1 AND id_team = ?2")
        .bind(user.id).bind(id)
        .fetch_one(&state.pool)
        .await;

        if is_member.is_err() {
            return (StatusCode::FORBIDDEN, "Accesso negato: Non sei membro del gruppo").into_response();
        }
    } else {
        let is_participant = sqlx::query_scalar::<_, i64>("SELECT id FROM private_chats_assoc WHERE id = ?1 AND (id_user1 = ?2 OR id_user2 = ?2)")
            .bind(id).bind(user.id)
            .fetch_one(&state.pool)
            .await;

        if is_participant.is_err() { 
            return (StatusCode::FORBIDDEN, "Accesso negato: Non sei partecipante di questa chat").into_response();
        }
    }

    ws.on_upgrade(move |socket| handle_socket(socket, state, id))
}

async fn handle_socket(socket: WebSocket, state: AppState, room_id: i64) {

    let tx = state.chat_rooms
        .entry(room_id)
        .or_insert_with(|| broadcast::channel(100).0)
        .clone();
    let mut rx = tx.subscribe();
    let (mut sender, mut receiver) = socket.split();

    let mut send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if sender.send(Message::Text(msg.into())).await.is_err() {
                break;
            }
        }
    });

    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            if let Message::Close(_) = msg {
                break;
            }
        }
    });

    tokio::select! {
        _ = &mut send_task => recv_task.abort(),
        _ = &mut recv_task => send_task.abort(),
    }

}

async fn notify_presence(state: &AppState, user: &User, is_online: bool) {

    let event_type = if is_online { "online" } else { "offline" };
    let payload = json!({
        "type": event_type,
        "user_id": user.id,
        "username": user.username
    }).to_string();

    // All teams the user belongs to
    let teams = sqlx::query_scalar::<_, i64>(
        "SELECT id_team FROM user_team WHERE id_user = ?"
    )
    .bind(user.id)
    .fetch_all(&state.pool)
    .await.unwrap_or_default();

    // All private chats of the user
    let privates = sqlx::query_scalar::<_, i64>(
        "SELECT id FROM private_chats_assoc WHERE id_user1 = ? OR id_user2 = ?"
    )
    .bind(user.id).bind(user.id)
    .fetch_all(&state.pool)
    .await.unwrap_or_default();

    // Notify all active channels
    for id in teams.into_iter().chain(privates.into_iter()) {
        if let Some(tx) = state.chat_rooms.get(&id) {
            let _ = tx.send(payload.clone());
        }
    }

}

// Track global user presence. Online as soon as the app is opened. Offline when it is closed
pub async fn global_presence_handler(ws: WebSocketUpgrade, Extension(user): Extension<User>, State(state): State<AppState>) -> impl IntoResponse {
    
    ws.on_upgrade(move |socket| async move {
        
        state.presence_map.insert(user.id, std::time::Instant::now());
        notify_presence(&state, &user, true).await;

        let (mut _sender, mut receiver) = socket.split();
        
        while let Some(Ok(_)) = receiver.next().await {}

        state.presence_map.remove(&user.id);
        notify_presence(&state, &user, false).await;
    })
}