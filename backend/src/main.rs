use axum::{
    Extension, Json, Router, 
    extract::{Request, State, Query, 
     ws::{Message, WebSocket, WebSocketUpgrade}, 
         Path}, 
    http::{HeaderValue, Method, StatusCode, header::{AUTHORIZATION, CONTENT_TYPE}}, 
    middleware::{Next, from_fn}, 
    response::IntoResponse, 
    routing::{get, post}};
use axum_session::{Key, SessionConfig, SessionLayer, SessionStore};
use axum_session_auth::{AuthConfig, AuthSession, AuthSessionLayer, Authentication};
use axum_session_sqlx::SessionSqlitePool;
use serde::{Deserialize,Serialize};
use serde_json::{Value, json};
use sqlx::{prelude::FromRow, Executor, Pool, Sqlite, SqlitePool};
use async_trait::async_trait;
use std::collections::HashMap;

use colored::*;
use tower_http::cors::{CorsLayer};

use std::sync::Arc;
use dashmap::DashMap;
use tokio::sync::broadcast;
use futures_util::{sink::SinkExt, stream::StreamExt};
use chrono::Local;
use sysinfo::{System};
use std::io::Write;
use std::fs::OpenOptions;

#[derive(Serialize, sqlx::FromRow)]
struct Team { id: i64, name: String }

#[derive(Serialize, sqlx::FromRow)]
struct MessageResponse { username: String, message: String, ora: String, data: String }

#[derive(Serialize)]
struct UserInfo { id: i64, username: String }

type ChatRooms = Arc<DashMap<i64, broadcast::Sender<String>>>;

#[tokio::main]
async fn main() {
  let pool = db().await;
  let session_store = session(pool.clone()).await;
  let chat_rooms: ChatRooms = Arc::new(DashMap::new());

    tokio::spawn(async { cpu_logger_task().await; });
  
  let app = app(pool, session_store, chat_rooms);
  let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
  print!("{}","Listening on : ".to_string().cyan());
  println!("{}",listener.local_addr().unwrap().to_string().green());
  axum::serve(listener, app).await.unwrap()
}

async fn cpu_logger_task() {
    let mut sys = System::new_all();
    let mut log_file = OpenOptions::new().create(true).append(true).open("cpu_log.txt").expect("Err log file");
    println!("{}", "Avvio logger CPU...".yellow());
    tokio::time::sleep(std::time::Duration::from_millis(500)).await;
    loop {
        tokio::time::sleep(std::time::Duration::from_secs(120)).await;
        sys.refresh_cpu(); 
        let log_entry = format!("[{}] - CPU: {:.2}%\n", Local::now().to_rfc3339(), sys.global_cpu_info().cpu_usage());
        let _ = log_file.write_all(log_entry.as_bytes());
    }
}

async fn db() -> Pool<Sqlite> {
  let pool = sqlx::sqlite::SqlitePool::connect("sqlite://db.sqlite").await.unwrap();

  // MODIFICA: Nessun utente guest creato in automatico
  pool.execute("CREATE TABLE IF NOT EXISTS user (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT)").await.unwrap();
  
  pool.execute("CREATE TABLE IF NOT EXISTS team(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)").await.unwrap(); 
  pool.execute("CREATE TABLE IF NOT EXISTS user_team(id_user INTEGER NOT NULL, id_team INTEGER NOT NULL)").await.unwrap();
  pool.execute("CREATE TABLE IF NOT EXISTS invite(id_user INTEGER NOT NULL, id_team INTEGER NOT NULL)").await.unwrap();
  pool.execute("CREATE TABLE IF NOT EXISTS message(id_message INTEGER PRIMARY KEY AUTOINCREMENT, id_user INTEGER NOT NULL, id_team INTEGER NOT NULL, message TEXT, data DATE, ora TIME)").await.unwrap();

  pool
}

async fn session(pool: Pool<Sqlite>) -> SessionStore<SessionSqlitePool> {
  let config = SessionConfig::default().with_table_name("session_table").with_key(Key::generate());
  SessionStore::<SessionSqlitePool>::new(Some(pool.clone().into()), config).await.unwrap()
}

fn app(pool: Pool<Sqlite>, session_store : SessionStore<SessionSqlitePool>, chat_rooms: ChatRooms) -> Router {
    let config = AuthConfig::<i64>::default().with_anonymous_user_id(Some(1));
    let cors_layer=CorsLayer::new().allow_methods([Method::GET, Method::POST, Method::OPTIONS]).allow_credentials(true).allow_headers([CONTENT_TYPE,AUTHORIZATION]).allow_origin("http://localhost:4000".parse::<HeaderValue>().unwrap());
  
  Router::new()
    .route("/", get(|| async {"Hello world!"}))
    .route("/register", post(register))
    .route("/login", post(login))
    .route("/logout", get(log_out))
    .route("/me", get(get_me).route_layer(from_fn(auth)))
    .route("/list/teams",get(get_teams).route_layer(from_fn(auth)))
    .route("/list/invites",get(get_list_invites).route_layer(from_fn(auth)))
    .route("/create",post(create_team).route_layer(from_fn(auth)))
    .route("/invite",post(invite).route_layer(from_fn(auth)))
    .route("/accept",post(accept).route_layer(from_fn(auth)))
    .route("/leave", post(leave_team).route_layer(from_fn(auth)))
    .route("/send",post(send_message).route_layer(from_fn(auth)))
    .route("/messages", get(get_messages).route_layer(from_fn(auth))) 
    .route("/protected", get(protected).route_layer(from_fn(auth)))
    .route("/ws/team/{team_id}", get(websocket_handler).route_layer(from_fn(auth)))
    .layer(AuthSessionLayer::<User, i64, SessionSqlitePool, SqlitePool>::new(Some(pool.clone())).with_config(config))
    .layer(SessionLayer::new(session_store))
    .layer(cors_layer)
    .layer(Extension(chat_rooms))
    .with_state(pool) 
}

// HANDLERS

async fn get_me(Extension(user): Extension<User>) -> impl IntoResponse {
    (StatusCode::OK, Json(UserInfo { id: user.id, username: user.username }))
}

async fn register(State(pool): State<Pool<Sqlite>>, Json(user): Json<UserRequest>) -> impl IntoResponse {
  let rows : Vec<UserSql> = sqlx::query_as("SELECT * FROM user WHERE username = ?1").bind(&user.username).fetch_all(&pool).await.unwrap();
  if rows.len() != 0 {
    return (StatusCode::BAD_REQUEST, "Username already taken!").into_response();
  } 
  
  let hash_password = bcrypt::hash(user.password, 10).unwrap();
  let res = sqlx::query("INSERT INTO user (username, password) VALUES (?1, ?2)").bind(&user.username).bind(&hash_password).execute(&pool).await;
  
  match res {
      Ok(_) => (StatusCode::OK, "Register successful!").into_response(),
      Err(_) => (StatusCode::BAD_REQUEST, "Username already taken (DB)!").into_response()
  }
}

async fn login(auth: AuthSession<User, i64, SessionSqlitePool, SqlitePool>, State(pool): State<Pool<Sqlite>>, Json(user): Json<UserRequest>) -> impl IntoResponse {
  let rows: Vec<UserSql> = sqlx::query_as("SELECT * FROM user WHERE username = ?1").bind(&user.username).fetch_all(&pool).await.unwrap();
  if rows.len() == 0 {
    (StatusCode::BAD_REQUEST, "Username not registered").into_response()
  } else {
      let is_valid = bcrypt::verify(user.password, &rows[0].password).unwrap();
      if is_valid {
        auth.login_user(rows[0].id as i64);
        (StatusCode::OK, Json(json!({ "success": true, "message": "Login successful!" }))).into_response()
      } else {
        (StatusCode::UNAUTHORIZED, Json(json!({ "success": false, "message": "Login error!" }))).into_response()
      }
  }
}

async fn log_out(auth: AuthSession<User, i64, SessionSqlitePool, SqlitePool>) -> impl IntoResponse {
  auth.logout_user();
  (StatusCode::OK, "Log out successful!").into_response()
}

async fn get_list_invites(Extension(user): Extension<User>,State(pool): State<SqlitePool>) -> impl IntoResponse {
  let rows: Vec<Team> = sqlx::query_as(r#"SELECT t.id, t.name FROM team t INNER JOIN invite i ON i.id_team = t.id WHERE i.id_user = ?1"#).bind(user.id).fetch_all(&pool).await.unwrap();
  (StatusCode::OK, Json(rows))
}

async fn get_teams(Extension(user): Extension<User>,State(pool): State<SqlitePool>) -> impl IntoResponse {
  let rows: Vec<Team> = sqlx::query_as(r#"SELECT t.id, t.name FROM team t INNER JOIN user_team ut ON ut.id_team = t.id WHERE ut.id_user = ?1"#).bind(user.id).fetch_all(&pool).await.unwrap();
  (StatusCode::OK, Json(rows))
}

async fn get_messages(Extension(user): Extension<User>, State(pool): State<SqlitePool>, Query(params): Query<HashMap<String, String>>) -> impl IntoResponse {
    let team_name = params.get("teamname").cloned().unwrap_or_default();
    if team_name.is_empty() { return (StatusCode::BAD_REQUEST, "Missing teamname").into_response(); }
    // Usiamo team_id dalla query (passato come teamname per compatibilità o cambiamo logica)
    // Qui manteniamo la logica ID per supportare nomi duplicati
    let team_id = params.get("team_id").and_then(|v| v.parse::<i64>().ok()).unwrap_or(0);
    
    if team_id == 0 { return (StatusCode::BAD_REQUEST, "Invalid Team ID").into_response(); }

    let sql = r#"SELECT u.username, m.message, m.ora, m.data FROM message m JOIN user u ON m.id_user = u.id JOIN team t ON m.id_team = t.id JOIN user_team ut ON ut.id_team = t.id WHERE m.id_team = ?1 AND ut.id_user = ?2 ORDER BY m.data ASC, m.ora ASC"#;
    let rows: Vec<MessageResponse> = sqlx::query_as(sql).bind(team_id).bind(user.id).fetch_all(&pool).await.unwrap_or(vec![]);
    (StatusCode::OK, Json(rows)).into_response()
}

pub async fn create_team(Extension(user): Extension<User>, State(pool): State<SqlitePool>, Json(body): Json<Value>) -> impl IntoResponse {
    let name = body.get("name").and_then(|v| v.as_str()).unwrap_or("");
    if name.trim().is_empty() { return (StatusCode::BAD_REQUEST, "Il nome del gruppo non può essere vuoto").into_response(); }

    let insert_res = sqlx::query("INSERT INTO team (name) VALUES (?1)").bind(name).execute(&pool).await;
    if let Err(e) = insert_res { return (StatusCode::INTERNAL_SERVER_ERROR, format!("DB Error: {}", e)).into_response(); }
    
    let team_id=insert_res.unwrap().last_insert_rowid();
    let link_res = sqlx::query("INSERT INTO user_team (id_user, id_team) VALUES (?1, ?2)").bind(user.id).bind(team_id).execute(&pool).await;
    if let Err(_) = link_res { return (StatusCode::INTERNAL_SERVER_ERROR, "Error linking user").into_response(); }

    (StatusCode::CREATED, Json(json!({ "ok": true, "team": { "id": team_id, "name": name } }))).into_response()
}

async fn leave_team(Extension(user): Extension<User>, State(pool): State<SqlitePool>, Json(body): Json<Value>) -> impl IntoResponse {
    let team_id = body.get("team_id").and_then(|v| v.as_i64()).unwrap_or(0);
    if team_id == 0 { return (StatusCode::BAD_REQUEST, "Invalid Team ID").into_response(); }

    match sqlx::query("DELETE FROM user_team WHERE id_user = ?1 AND id_team = ?2").bind(user.id).bind(team_id).execute(&pool).await {
        Ok(_) => (StatusCode::OK, "Gruppo abbandonato").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

async fn send_message(Extension(user): Extension<User>, State(pool): State<SqlitePool>, Extension(chat_rooms): Extension<ChatRooms>, Json(body): Json<Value>) -> impl IntoResponse{
    let user_id=user.id;
    let team_id = body.get("team_id").and_then(|v| v.as_i64()).unwrap_or(0);
    let msg = body.get("message").and_then(|v| v.as_str()).unwrap_or("");

    if team_id == 0 { return (StatusCode::BAD_REQUEST, "Invalid Team ID").into_response(); }

    match sqlx::query_scalar::<_,i64>("SELECT id_user FROM user_team WHERE id_user = ?1 AND id_team=?2").bind(user_id).bind(team_id).fetch_one(&pool).await {
        Ok(_)=> {}, Err(_) => return (StatusCode::UNAUTHORIZED, "User not in team").into_response(),
    };

    let result = sqlx::query("INSERT INTO message (id_user,id_team,message,data,ora) VALUES (?1,?2,?3, CURRENT_DATE, CURRENT_TIME)").bind(user_id).bind(team_id).bind(msg).execute(&pool).await; 
    match result {
        Ok(_) => {
            let msg_payload = json!({
                "username": user.username,
                "message": msg,
                "ora": Local::now().format("%H:%M:%S").to_string(),
                "data": Local::now().format("%Y-%m-%d").to_string() 
            });
            let _ = chat_rooms.get(&team_id).map(|tx| tx.send(serde_json::to_string(&msg_payload).unwrap_or_default()));
            (StatusCode::OK, "Inviato").into_response()
        },
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

async fn accept(Extension(user): Extension<User>, State(pool): State<SqlitePool>, Json(body): Json<Value>) -> impl IntoResponse{
    let user_id = user.id;
    let team_id = body.get("team_id").and_then(|v| v.as_i64()).unwrap_or(0);
    if team_id == 0 { return (StatusCode::BAD_REQUEST, "Invalid Team ID").into_response(); }

    let mut tx = match pool.begin().await { Ok(tx) => tx, Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Transaction Error").into_response(), };
    if let Err(_) = sqlx::query("INSERT INTO user_team (id_user, id_team) VALUES (?1, ?2)").bind(user_id).bind(team_id).execute(&mut *tx).await {
        return (StatusCode::INTERNAL_SERVER_ERROR, "Errore inserimento").into_response();
    }
    if let Err(_) = sqlx::query("DELETE FROM invite WHERE id_user = ?1 AND id_team = ?2").bind(user_id).bind(team_id).execute(&mut *tx).await {
        return (StatusCode::INTERNAL_SERVER_ERROR, "Errore rimozione invito").into_response();
    }
    match tx.commit().await { Ok(_) => (StatusCode::OK, "Accettato").into_response(), Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Commit fail").into_response(), }
}

async fn invite(Extension(_user): Extension<User>, State(pool): State<SqlitePool>, Json(body): Json<Value>) -> impl IntoResponse {
    let username: &str = body.get("username").and_then(|v| v.as_str()).unwrap_or("");
    let team_id = body.get("team_id").and_then(|v| v.as_i64()).unwrap_or(0);

    if username.is_empty() || team_id == 0 { return (StatusCode::BAD_REQUEST, "Invalid payload").into_response(); }
    
    let user_id: i64 = match sqlx::query_scalar("SELECT id FROM user WHERE username = ?1").bind(username).fetch_one(&pool).await {
        Ok(id) => id, Err(_) => return (StatusCode::NOT_FOUND, "User not found").into_response(),
    };
    // Verifica esistenza team per ID
    let exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM team WHERE id = ?1)").bind(team_id).fetch_one(&pool).await.unwrap_or(false);
    if !exists { return (StatusCode::NOT_FOUND, "Team not found").into_response(); }

    match sqlx::query("INSERT INTO invite (id_user, id_team) VALUES (?1, ?2)").bind(user_id).bind(team_id).execute(&pool).await {
        Ok(_) => (StatusCode::OK, "Inserito").into_response(), Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Errore").into_response(),
    }
}

async fn protected(Extension(user): Extension<User>) -> impl IntoResponse {
    (StatusCode::OK, format!("Hello {}, id: {}", user.username, user.id)).into_response()
}

async fn auth(auth: AuthSession<User, i64, SessionSqlitePool, SqlitePool>, mut req: Request, next: Next) -> impl IntoResponse {
    if auth.is_authenticated() {
        req.extensions_mut().insert(auth.current_user.unwrap().clone());
        next.run(req).await
    } else {
        (StatusCode::UNAUTHORIZED, "Unauthorized").into_response()
    }
}

async fn websocket_handler(ws: WebSocketUpgrade, Extension(user): Extension<User>, Extension(chat_rooms): Extension<ChatRooms>, State(pool): State<SqlitePool>, Path(team_id): Path<i64>) -> impl IntoResponse {
    if let Err(_) = sqlx::query_scalar::<_,i64>("SELECT id_user FROM user_team WHERE id_user = ?1 AND id_team = ?2").bind(user.id).bind(team_id).fetch_one(&pool).await {
        return (StatusCode::FORBIDDEN, "Forbidden").into_response();
    }
    println!("{} {} connected to team {}", "[INFO]".cyan(), user.username, team_id);
    ws.on_upgrade(move |socket| handle_socket(socket, user, chat_rooms, team_id))
}

async fn handle_socket(socket: WebSocket, user: User, chat_rooms: ChatRooms, team_id: i64) {
    let tx = chat_rooms.entry(team_id).or_insert_with(|| broadcast::channel(100).0).clone(); 
    let mut rx = tx.subscribe(); 
    let (mut sender, mut receiver) = socket.split();
    let mut send_task = tokio::spawn(async move {
        loop {
            match rx.recv().await {
                Ok(msg) => if sender.send(Message::Text(msg.into())).await.is_err() { break; },
                Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => {},
                Err(_) => break,
            }
        }
    });
    let mut recv_task = tokio::spawn(async move { while let Some(Ok(Message::Close(_))) = receiver.next().await { break; } });
    tokio::select! { _ = &mut send_task => recv_task.abort(), _ = &mut recv_task => send_task.abort(), }
    println!("{} Disconnected {}", "[INFO]".cyan(), user.username);
}

#[derive(Deserialize)] struct UserRequest { username: String, password: String }
#[derive(Clone)] pub struct User { pub id : i64, pub anonymous: bool, pub username: String }
#[async_trait] impl Authentication<User, i64, SqlitePool> for User {
    async fn load_user(userid:i64,pool:Option< &SqlitePool>) -> Result<User, anyhow::Error> {
        if userid == 1 { Ok(User { id: 1, anonymous: true, username: "guest".to_string() }) } 
        else {
            let u: UserSql = sqlx::query_as("SELECT * FROM user WHERE id = ?1").bind(&userid).fetch_one(pool.unwrap()).await?;
            Ok(User { id: u.id as i64, anonymous: false, username: u.username })
        }
    }
    fn is_active(&self) -> bool { !self.anonymous }
    fn is_anonymous(&self) -> bool { self.anonymous }
    fn is_authenticated(&self) -> bool { !self.anonymous }
}
#[derive(FromRow)] struct UserSql { id: i32, username: String, password: String }