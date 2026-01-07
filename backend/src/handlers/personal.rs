use axum::{Extension, Json, extract::{State, Path}, response::IntoResponse};
use serde_json::{Value, json};

use crate::{models::*, error::AppError, state::AppState};

// --- LIST PRIVATE CHATS ---
pub async fn get_chat_list(Extension(user): Extension<User>, State(state): State<AppState>)-> Result<impl IntoResponse, AppError>
{
    let rows: Vec<ChatListRow> = sqlx::query_as("SELECT c.id,
        CASE 
            WHEN c.id_user1 = ?1 THEN u2.username ELSE u1.username 
        END as other_username,
        CASE 
            WHEN c.id_user1 = ?1 THEN c.id_user2 ELSE c.id_user1
        END as other_user_id
        FROM private_chats_assoc c
        JOIN user u1 ON c.id_user1 = u1.id
        JOIN user u2 ON c.id_user2 = u2.id
        WHERE c.id_user1 = ?1 OR c.id_user2 = ?1")
        .bind(user.id)
        .fetch_all(&state.pool)
        .await?;
    
    Ok(Json(rows))
}

// --- NEW PRIVATE CHAT ---
pub async fn create_chat(Extension(user): Extension<User>, State(state): State<AppState>, Json(body): Json<Value>) -> Result<impl IntoResponse, AppError> {
    
    // 1. Check if existed username
    let target_username = body.get("username").and_then(|v| v.as_str()).ok_or(AppError::BadRequest("Username non trovato".into()))?;
    // 2. If it exists, search id target user
    let target_user: UserSql = sqlx::query_as("SELECT id, username, password FROM user WHERE username = ?1")
        .bind(target_username).fetch_optional(&state.pool)
        .await?.ok_or(AppError::UserNotFound)?;
    // 3. Create chat with yourself
    if target_user.id as i64 == user.id {
        return Err(AppError::BadRequest("Non puoi creare una chat con te stesso".into()));
    }
    // 4. Verify if already exists a chat between these two users
    let existing_chat = sqlx::query_scalar::<_, i64>(
        "SELECT id FROM private_chat_assoc WHERE (id_user1 = ?1 AND id_user2 = ?2) OR (id_user1 = ?2 AND id_user2 = ?1)")
        .bind(user.id)
        .bind(target_user.id)
        .fetch_optional(&state.pool)
        .await?;
    if let Some(id) = existing_chat {
        return Ok(Json(json!({ "id": id, "message": "Chat esistente" })));
    }
    // 5. Create new chat
    let result = sqlx::query("INSERT INTO private_chats_assoc (id_user1, id_user2) VALUES(?1, ?2)")
    .bind(user.id).bind(target_user.id).execute(&state.pool).await?;

     Ok(Json(json!({ "id": result.last_insert_rowid(), "success": true, "message": "Chat creata." })))
}

// --- CHAT MESSAGES ---
pub async fn get_chat_messages(Extension(user): Extension<User>, State(state): State<AppState>, Path(chat_id): Path<i64>)-> Result<impl IntoResponse, AppError>
{
    let is_participant = sqlx::query_scalar::<_, i64>(
        "SELECT id FROM private_chats_assoc WHERE id = ?1 AND (id_user1 = ?2 OR id_user2 = ?2)"
    ).bind(chat_id).bind(user.id).fetch_optional(&state.pool).await?;

    if is_participant.is_none() {
        return Err(AppError::Forbidden);
    }

    // INFO: name1 and name2 are respectively from and to
    let rows: Vec<PrivateMessage> = sqlx::query_as("SELECT id_chat, message, data, ora, name1, name2, type FROM private_messages WHERE id_chat = ?1 ORDER BY id ASC")
    .bind(chat_id).fetch_all(&state.pool).await?;

    Ok(Json(rows))
}

// --- SEND CHAT MESSAGE ---
pub async fn send_chat_message(Extension(user): Extension<User>, State(state): State<AppState>, Json(body): Json<Value>) -> Result<impl IntoResponse, AppError> 
{
    let chat_id = body.get("chat_id").and_then(|v| v.as_i64()).ok_or(AppError::BadRequest("ID chat mancante".into()))?;
    let message = body.get("message").and_then(|v| v.as_str()).unwrap_or("");

    if message.trim().is_empty() {
        return Err(AppError::BadRequest("Impossibile inviare un messaggio vuoto".into()));
    }

    // Retrieve chat info (two users)
    let chat_info: PrivateAssoc = sqlx::query_as(
        "SELECT id, id_user1, id_user2 FROM private_chats_assoc WHERE id = ?1"
    )
    .bind(chat_id)
    .fetch_one(&state.pool)
    .await?;

    let user1: UserSql = sqlx::query_as("SELECT id, username, password FROM user WHERE id = ?1").bind(chat_info.id_user1).fetch_one(&state.pool).await?;
    let user2: UserSql = sqlx::query_as("SELECT id, username, password FROM user WHERE id = ?1").bind(chat_info.id_user2).fetch_one(&state.pool).await?;

    // Insert new chat message
    sqlx::query(
        r#"
        INSERT INTO private_messages (id_chat, message, data, ora, name1, name2, type) 
        VALUES (?1, ?2, CURRENT_DATE, CURRENT_TIME, ?3, ?4, 'chat')
        "#
    )
    .bind(chat_id)
    .bind(message)
    .bind(&user1.username)
    .bind(&user2.username)
    .execute(&state.pool)
    .await?;

    // Notify via WebSocket
    let message_payload = json!({
        "type": "chat",
        "username": user.username,
        "message": message,
        "chat_id": chat_id
    }).to_string();

    if let Some(tx) = state.chat_rooms.get(&chat_id) {
        let _ = tx.send(message_payload);
    }

    Ok(Json(json!({ "status": "success" })))
}