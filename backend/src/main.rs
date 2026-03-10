mod ws;
mod error;
mod state;
mod tasks;
mod models;
mod handlers;

use axum::{
    Router, 
    middleware::from_fn, 
    response::IntoResponse, 
    routing::{get, post}, 
    http::{Method, header::{AUTHORIZATION, CONTENT_TYPE}}
};
use axum_session::{Key, SessionConfig, SessionLayer, SessionStore};
use axum_session_auth::{AuthConfig, AuthSession, AuthSessionLayer};
use axum_session_sqlx::SessionSqlitePool; 
use tower_http::cors::{CorsLayer, AllowOrigin};
use sqlx::SqlitePool;
use colored::*;

use crate::{
    state::AppState,
    models::User,
    handlers::{auth as h_auth, team as h_team,personal as h_personal, presence as h_presence},
    ws::{websocket_handler, global_presence_handler},
};

#[tokio::main]
async fn main() {

    // 1. Database connection
    let pool = SqlitePool::connect("sqlite://db.sqlite").await.expect("\nERRORE: db.sqlite non trovato.\n");
    
    // 2. Initialize state (database, chat, online users, presence map)
    let state = AppState::new(pool.clone());
    
    // 3. Config Session (id expires session)
    let session_config = SessionConfig::default().with_table_name("session_table")
        .with_key(Key::generate()).with_cookie_same_site(axum_session::SameSite::Lax);
    let session_store = SessionStore::<SessionSqlitePool>::new(Some(pool.clone().into()), session_config).await.unwrap();
    let auth_config = AuthConfig::<i64>::default().with_anonymous_user_id(Some(1));

    // 4. Background cpu task
    tokio::spawn(tasks::cpu_logger_task());

    // 5. CORS
    let cors = CorsLayer::new()
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_credentials(true)
        .allow_headers([CONTENT_TYPE, AUTHORIZATION])
        .allow_origin(AllowOrigin::mirror_request());

    // 6. Routing System
    let app = Router::new()
        .route("/", get(|| async { "Backend Online" }))
        // Authetication
        .route("/register", post(h_auth::register))
        .route("/login", post(h_auth::login))
        .route("/logout", get(h_auth::log_out))
        .route("/me", get(h_auth::get_me).route_layer(from_fn(auth_middleware)))

        // Private Chat
        .route("/create/private", post(h_personal::create_chat).route_layer(from_fn(auth_middleware)))
        .route("/delete/private/{chat_id}",post(h_personal::delete_chat).route_layer(from_fn(auth_middleware)))
        .route("/list/private", get(h_personal::get_chat_list).route_layer(from_fn(auth_middleware)))
        .route("/chat/messages/{chat_id}", get(h_personal::get_chat_messages).route_layer(from_fn(auth_middleware)))
        .route("/chat/send", post(h_personal::send_chat_message).route_layer(from_fn(auth_middleware)))
        .route("/private/{chat_id}/online", get(h_personal::get_private_online).route_layer(from_fn(auth_middleware)))
        // Private Chat Notifications
        .route("/private-unread-notifications", get(h_personal::get_unread_notifications).route_layer(from_fn(auth_middleware)))
        .route("/mark-read-private/{chat_id}", post(h_personal::mark_as_read).route_layer(from_fn(auth_middleware)))

        // Team Routes
        .route("/list/teams", get(h_team::get_teams).route_layer(from_fn(auth_middleware)))
        .route("/list/invites", get(h_team::get_list_invites).route_layer(from_fn(auth_middleware)))
        .route("/create", post(h_team::create_team).route_layer(from_fn(auth_middleware)))
        .route("/rename", post(h_team::rename_team).route_layer(from_fn(auth_middleware)))
        .route("/leave", post(h_team::leave_team).route_layer(from_fn(auth_middleware)))
        .route("/team/{team_id}/members", get(h_team::get_team_members).route_layer(from_fn(auth_middleware)))
        .route("/team/{team_id}/online", get(h_team::get_online_members).route_layer(from_fn(auth_middleware)))
        // Invites & Messages
        .route("/invite", post(h_team::invite).route_layer(from_fn(auth_middleware)))
        .route("/accept", post(h_team::accept).route_layer(from_fn(auth_middleware)))
        .route("/decline", post(h_team::decline).route_layer(from_fn(auth_middleware)))
        .route("/send", post(h_team::send_message).route_layer(from_fn(auth_middleware)))
        .route("/messages", get(h_team::get_messages).route_layer(from_fn(auth_middleware)))
        // Notifications
        .route("/unread-notifications", get(h_team::get_unread_notifications).route_layer(from_fn(auth_middleware)))
        .route("/mark-read/{team_id}", post(h_team::mark_as_read).route_layer(from_fn(auth_middleware)))

        // Presence (global)
        .route("/presence/user/{id}", get(h_presence::is_online).route_layer(from_fn(auth_middleware)))
        // WebSocket
        .route("/ws/team/{id}", get(websocket_handler).route_layer(from_fn(auth_middleware)))
        .route("/ws/private/{id}", get(websocket_handler).route_layer(from_fn(auth_middleware)))
        .route("/ws/global", get(global_presence_handler).route_layer(from_fn(auth_middleware)))

        // Layers
        .layer(AuthSessionLayer::<User, i64, SessionSqlitePool, SqlitePool>::new(Some(pool.clone())).with_config(auth_config))
        .layer(SessionLayer::new(session_store))
        .layer(cors)
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    println!("{} {}", "In ascolto su:".cyan(), listener.local_addr().unwrap().to_string().green());
    axum::serve(listener, app).await.unwrap();
}

// Authentication middleware for protected routes
async fn auth_middleware(auth: AuthSession<User, i64, SessionSqlitePool, SqlitePool>, 
    mut req: axum::extract::Request, next: axum::middleware::Next) -> impl IntoResponse { 

    if auth.is_authenticated() {
        req.extensions_mut().insert(auth.current_user.unwrap().clone());
        next.run(req).await
    } else {
        (axum::http::StatusCode::UNAUTHORIZED, "Non autorizzato").into_response()
    }

}