use axum::{Extension, Json, extract::{State, Query, Path}, http::StatusCode, response::IntoResponse};
use serde_json::{Value, json};
use std::collections::HashMap;
use chrono::Local;

use crate::{models::*, error::AppError, state::AppState};

// Helper function per verificare se un utente è nel team
async fn check_membership(user_id: i64, team_id: i64, pool: &sqlx::SqlitePool) -> Result<bool, AppError> {
    let exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM user_team WHERE id_user = ?1 AND id_team = ?2)")
        .bind(user_id).bind(team_id).fetch_one(pool).await?;
    Ok(exists)
}

// --- GETTERS ---
pub async fn get_teams(Extension(user): Extension<User>, State(state): State<AppState>) -> Result<Json<Vec<Team>>, AppError> {
    let rows = sqlx::query_as(r#"SELECT t.id, t.name FROM team t JOIN user_team ut ON ut.id_team = t.id WHERE ut.id_user = ?1"#)
        .bind(user.id).fetch_all(&state.pool).await?;
    Ok(Json(rows))
}

pub async fn get_list_invites(Extension(user): Extension<User>, State(state): State<AppState>) -> Result<Json<Vec<Team>>, AppError> {
    let rows = sqlx::query_as(r#"SELECT t.id, t.name FROM team t INNER JOIN invite i ON i.id_team = t.id WHERE i.id_user = ?1"#)
        .bind(user.id).fetch_all(&state.pool).await?;
    Ok(Json(rows))
}

pub async fn get_team_members(Extension(user): Extension<User>, State(state): State<AppState>, Path(team_id): Path<i64>) -> Result<impl IntoResponse, AppError> {
    if !check_membership(user.id, team_id, &state.pool).await? { return Err(AppError::Forbidden); }
    let members: Vec<MemberResponse> = sqlx::query_as("SELECT u.username FROM user u INNER JOIN user_team ut ON ut.id_user = u.id WHERE ut.id_team = ?1")
        .bind(team_id).fetch_all(&state.pool).await?;
    Ok(Json(members))
}

// --- AZIONI TEAM ---
pub async fn create_team(Extension(user): Extension<User>, State(state): State<AppState>, Json(body): Json<Value>) -> Result<impl IntoResponse, AppError> {
    let name = body.get("name").and_then(|v| v.as_str()).unwrap_or("");
    if name.trim().is_empty() { return Err(AppError::BadRequest("Nome gruppo richiesto.".into())); }

    let insert_res = sqlx::query("INSERT INTO team (name) VALUES (?1)").bind(name).execute(&state.pool).await?;
    let team_id = insert_res.last_insert_rowid();
    sqlx::query("INSERT INTO user_team (id_user, id_team) VALUES (?1, ?2)").bind(user.id).bind(team_id).execute(&state.pool).await?;

    Ok((StatusCode::CREATED, Json(json!({ "success": true, "message": "Gruppo creato!", "team": { "id": team_id, "name": name } }))))
}

pub async fn rename_team(Extension(user): Extension<User>, State(state): State<AppState>, Json(body): Json<Value>) -> Result<impl IntoResponse, AppError> {
    let team_id = body.get("team_id").and_then(|v| v.as_i64()).unwrap_or(0);
    let new_name = body.get("new_name").and_then(|v| v.as_str()).unwrap_or("");

    if team_id == 0 || new_name.trim().is_empty() { return Err(AppError::BadRequest("Dati invalidi.".into())); }
    if !check_membership(user.id, team_id, &state.pool).await? { return Err(AppError::Forbidden); }

    sqlx::query("UPDATE team SET name = ?1 WHERE id = ?2").bind(new_name).bind(team_id).execute(&state.pool).await?;
    Ok(Json(json!({ "success": true, "message": "Gruppo rinominato." })))
}

pub async fn leave_team(Extension(user): Extension<User>, State(state): State<AppState>, Json(body): Json<Value>) -> Result<impl IntoResponse, AppError> {
    let team_id = body.get("team_id").and_then(|v| v.as_i64()).unwrap_or(0);
    if team_id == 0 { return Err(AppError::BadRequest("ID Gruppo invalido.".into())); }

    sqlx::query("DELETE FROM user_team WHERE id_user = ?1 AND id_team = ?2").bind(user.id).bind(team_id).execute(&state.pool).await?;
    Ok(Json(json!({ "success": true, "message": "Hai abbandonato il gruppo." })))
}

// --- INVITI ---
pub async fn invite(Extension(user): Extension<User>, State(state): State<AppState>, Json(body): Json<Value>) -> Result<impl IntoResponse, AppError> {
    let username = body.get("username").and_then(|v| v.as_str()).unwrap_or("");
    let team_id = body.get("team_id").and_then(|v| v.as_i64()).unwrap_or(0);

    if username.is_empty() || team_id == 0 { return Err(AppError::BadRequest("Dati invito invalidi.".into())); }
    if !check_membership(user.id, team_id, &state.pool).await? { return Err(AppError::Forbidden); }

    let target_user_id: i64 = match sqlx::query_scalar("SELECT id FROM user WHERE username = ?1").bind(username).fetch_one(&state.pool).await {
        Ok(id) => id, Err(_) => return Err(AppError::UserNotFound),
    };

    if target_user_id == user.id { return Err(AppError::BadRequest("Non puoi autoinvitarti.".into())); }

    let already_in: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM user_team WHERE id_user = ?1 AND id_team = ?2)")
        .bind(target_user_id).bind(team_id).fetch_one(&state.pool).await?;
    if already_in { return Err(AppError::BadRequest("Utente già nel gruppo.".into())); }

    // Controllo se già invitato (se sì, ok, niente errore)
    let pending: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM invite WHERE id_user = ?1 AND id_team = ?2)")
        .bind(target_user_id).bind(team_id).fetch_one(&state.pool).await?;
    
    if !pending {
        sqlx::query("INSERT INTO invite (id_user, id_team) VALUES (?1, ?2)").bind(target_user_id).bind(team_id).execute(&state.pool).await?;
    }

    Ok(Json(json!({ "success": true, "message": "Invito inviato!" })))
}

pub async fn accept(Extension(user): Extension<User>, State(state): State<AppState>, Json(body): Json<Value>) -> Result<impl IntoResponse, AppError> {
    let team_id = body.get("team_id").and_then(|v| v.as_i64()).unwrap_or(0);
    if team_id == 0 { return Err(AppError::BadRequest("ID Gruppo mancante.".into())); }

    let mut tx = state.pool.begin().await?;
    sqlx::query("INSERT INTO user_team (id_user, id_team) VALUES (?1, ?2)").bind(user.id).bind(team_id).execute(&mut *tx).await?;
    sqlx::query("DELETE FROM invite WHERE id_user = ?1 AND id_team = ?2").bind(user.id).bind(team_id).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(json!({ "success": true, "message": "Invito accettato!" })))
}

pub async fn decline(Extension(user): Extension<User>, State(state): State<AppState>, Json(body): Json<Value>) -> Result<impl IntoResponse, AppError> {
    let team_id = body.get("team_id").and_then(|v| v.as_i64()).unwrap_or(0);
    if team_id == 0 { return Err(AppError::BadRequest("ID Gruppo mancante.".into())); }

    sqlx::query("DELETE FROM invite WHERE id_user = ?1 AND id_team = ?2").bind(user.id).bind(team_id).execute(&state.pool).await?;
    Ok(Json(json!({ "success": true, "message": "Invito rifiutato." })))
}

// --- MESSAGGI ---
pub async fn get_messages(Extension(user): Extension<User>, State(state): State<AppState>, Query(params): Query<HashMap<String, String>>) -> Result<impl IntoResponse, AppError> {
    let team_id = params.get("team_id").and_then(|v| v.parse::<i64>().ok()).unwrap_or(0);
    if team_id == 0 { return Err(AppError::BadRequest("ID Gruppo mancante.".into())); }

    if !check_membership(user.id, team_id, &state.pool).await? { return Err(AppError::Forbidden); }

    let rows: Vec<MessageResponse> = sqlx::query_as(r#"SELECT u.username, m.message, m.ora, m.data FROM message m JOIN user u ON m.id_user = u.id WHERE m.id_team = ?1 ORDER BY m.data ASC, m.ora ASC"#)
        .bind(team_id).fetch_all(&state.pool).await?;
    Ok(Json(rows))
}

pub async fn send_message(Extension(user): Extension<User>, State(state): State<AppState>, Json(body): Json<Value>) -> Result<impl IntoResponse, AppError> {
    let team_id = body.get("team_id").and_then(|v| v.as_i64()).unwrap_or(0);
    let msg = body.get("message").and_then(|v| v.as_str()).unwrap_or("");

    if team_id == 0 || msg.trim().is_empty() { return Err(AppError::BadRequest("Messaggio non valido.".into())); }
    if !check_membership(user.id, team_id, &state.pool).await? { return Err(AppError::Forbidden); }

    sqlx::query("INSERT INTO message (id_user,id_team,message,data,ora) VALUES (?1,?2,?3, CURRENT_DATE, CURRENT_TIME)")
        .bind(user.id).bind(team_id).bind(msg).execute(&state.pool).await?;

    let msg_payload = json!({
        "username": user.username,
        "message": msg,
        "ora": Local::now().format("%H:%M:%S").to_string(),
        "data": Local::now().format("%Y-%m-%d").to_string() 
    });

    if let Some(tx) = state.chat_rooms.get(&team_id) {
        let _ = tx.send(serde_json::to_string(&msg_payload).unwrap_or_default());
    }

    Ok(Json(json!({ "success": true, "message": "Inviato." })))
}