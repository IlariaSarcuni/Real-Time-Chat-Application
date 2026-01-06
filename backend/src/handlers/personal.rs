use axum::{Extension, Json, extract::{State, Query, Path}, http::StatusCode, response::IntoResponse};
use serde_json::{Value, json};
use sqlx::{sqlite,Row};
use std::collections::{HashMap, HashSet};
use chrono::Local;
use colored::*;

use crate::{models::*, error::AppError, state::AppState};

// --- MESSAGGI ---
/* 
pub async fn get_list_privates(Extension(user): Extension<User>, State(state): State<AppState>)-> Result<impl IntoResponse, AppError>
{
    
    let rows: Vec<Chat> =sqlx::query_as("SELECT m.id,m.id_user1,m.id_user2,m.name1,m.name2,m.message,m.data,m.ora,m.type FROM personal_message m WHERE id_user1=?1 OR id_user2=?1")
    .bind(user.id).fetch_all(&state.pool).await?;

    /* 
    let result: Vec<(i32, i32, String, String)>= rows.into_iter().map(|row|{
        let id_user1:i32=row.get("id_user1");
        let id_user2:i32=row.get("id_user2");
        let data:String=row.get("data");
        let ora:String=row.get("ora");

        (id_user1,id_user2,data,ora)
    }).collect();
    */
    //println!("{:?}",result);
    //let result=serde_json::to_string_pretty(&rows).unwrap();
    Ok(Json(rows))

}
    */

pub async fn get_chat_messages(Extension(user): Extension<User>, State(state): State<AppState>,Json(body): Json<Value>)-> Result<impl IntoResponse, AppError>
{
    let chat_id = body.get("chat_id").and_then(|v| v.as_i64()).unwrap_or(0);    //to chat

    // INFO : name1 e name2 = from , to
    let rows: Vec<PrivateMessage> = sqlx::query_as("SELECT id_chat,message,data,ora,name1,name2,type FROM private_messages WHERE id_chat=?1")
    .bind(chat_id).fetch_all(&state.pool).await?;

    println!("{:?}",rows);
    Ok(Json(rows))

}

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

pub async fn create_chat(Extension(user): Extension<User>, State(state): State<AppState>, Json(body): Json<Value>) -> Result<impl IntoResponse, AppError> {
        //TODO: Controlla prima se è già stata creata (anche bidirezionale idutente = 2 e 1 o 1 e 2)
        
        
        let user_id = body.get("user_id").and_then(|v| v.as_i64()).unwrap_or(0);    //to user
        sqlx::query("INSERT INTO private_chats_assoc (id_user1,id_user2) VALUES(?1,?2)")
        .bind(user.id).bind(user_id).execute(&state.pool).await?;

         Ok(Json(json!({ "success": true, "message": "Chat creata." })))
}

pub async fn send_chat_message(Extension(user): Extension<User>, State(state): State<AppState>, Json(body): Json<Value>) -> Result<impl IntoResponse, AppError> 
{
    let chat_id = body.get("chat_id").and_then(|v| v.as_i64()).unwrap_or(0);    //to user
    let msg = body.get("message").and_then(|v| v.as_str()).unwrap_or("");
    let from = body.get("from").and_then(|v| v.as_str()).unwrap_or("");
    let to = body.get("to").and_then(|v| v.as_str()).unwrap_or("");

    if msg.trim().is_empty() { return Err(AppError::BadRequest("Messaggio non valido.".into())); }

    sqlx::query("INSERT INTO private_messages (id_chat,message,data,ora,name1,name2,type) VALUES (?1,?2,CURRENT_DATE, CURRENT_TIME,?3,?4, 'chat')")
        .bind(chat_id).bind(msg)
        .bind(from).bind(to)
        .execute(&state.pool).await?;

    Ok(Json(json!({ "success": true, "message": "Inviato." })))
}


/*
pub async fn send_message(Extension(user): Extension<User>, State(state): State<AppState>, Json(body): Json<Value>) -> Result<impl IntoResponse, AppError> {
    let user_id = body.get("user_id").and_then(|v| v.as_i64()).unwrap_or(0);    //to user
    let msg = body.get("message").and_then(|v| v.as_str()).unwrap_or("");

    if msg.trim().is_empty() { return Err(AppError::BadRequest("Messaggio non valido.".into())); }

    let user1:UserSql = sqlx::query_as("SELECT id,username,password FROM user WHERE id=?1").bind(user.id).fetch_one(&state.pool).await?;
    let user2:UserSql = sqlx::query_as("SELECT id,username,password FROM user WHERE id=?1").bind(user_id).fetch_one(&state.pool).await?;


    sqlx::query("INSERT INTO private_messages (id_chat,id_user1,id_user2,name1,name2,message,data,ora,type) VALUES (?1,?2,?3,?4,?5, CURRENT_DATE, CURRENT_TIME, 'chat')")
        .bind(user.id).bind(user_id)
        .bind(user1.username).bind(user2.username)
        .bind(msg).execute(&state.pool).await?;

    let msg_payload = json!({
        "username": user.username,
        "to": user_id,
        "message": msg,
        "ora": Local::now().format("%H:%M:%S").to_string(),
        "data": Local::now().format("%Y-%m-%d").to_string(),
        "type": "chat"
    });

    //TODO: Da sistemare
    /*
    if let Some(tx) = state.chat_rooms.get(&team_id) {
        let _ = tx.send(serde_json::to_string(&msg_payload).unwrap_or_default());
    }
    */

    Ok(Json(json!({ "success": true, "message": "Inviato." })))
}

    */