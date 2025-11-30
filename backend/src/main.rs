use axum::{
  Extension, Json, Router, 
  extract::{Request, State, Query}, // AGGIUNTO Query
  http::{HeaderValue, Method, StatusCode, header::{AUTHORIZATION, CONTENT_TYPE}}, 
  middleware::{Next, ResponseAxumBody, from_fn}, 
  response::IntoResponse, 
  routing::{get, post}};
use axum_session::{Key, SessionConfig, SessionLayer, SessionStore};
use axum_session_auth::{AuthConfig, AuthSession, AuthSessionLayer, Authentication};
use axum_session_sqlx::SessionSqlitePool;
use serde::{Deserialize,Serialize};
use serde_json::{Value, json};
use sqlx::{prelude::FromRow, Executor, Pool, Sqlite, SqlitePool};
use  async_trait::async_trait;
use std::collections::HashMap; // AGGIUNTO HashMap

use colored::*;
use tower_http::cors::{Any, CorsLayer};

//Struct 
#[derive(Serialize, sqlx::FromRow)]
struct Team {
    id: i64,
    name: String,
}

// AGGIUNTA QUESTA STRUCT MANCANTE
#[derive(Serialize, sqlx::FromRow)]
struct MessageResponse {
    username: String,
    message: String,
    ora: String, 
}

#[tokio::main]
async fn main() {
  let pool = db().await;
  let session_store = session(pool.clone()).await;
  let app = app(pool, session_store);

  let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
  print!("{}","Listening on : ".to_string().cyan());
  println!("{}",listener.local_addr().unwrap().to_string().green());

  axum::serve(listener, app).await.unwrap()
}

async fn db() -> Pool<Sqlite> {
  let pool = sqlx::sqlite::SqlitePool::connect("sqlite://db.sqlite").await.unwrap();

  pool.execute("
    CREATE TABLE IF NOT EXISTS user (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      password TEXT
    )
  ").await.unwrap();

  let rows: Vec<UserSql> = sqlx::query_as("SELECT * FROM user WHERE id = ?1").bind(&1).fetch_all(&pool).await.unwrap();

  if rows.len() == 0 {
    sqlx::query("INSERT INTO user (username, password) VALUES (?1, ?2)").bind(&"guest").bind(&"guest").execute(&pool).await.unwrap();
  };

  //ALTRE TABELLE
  pool.execute("
    CREATE TABLE IF NOT EXISTS team(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT
    )
  ").await.unwrap();       

  pool.execute("
    CREATE TABLE IF NOT EXISTS user_team(
        id_user INTEGER NOT NULL,
        id_team INTEGER NOT NULL
    )
  ").await.unwrap();

  pool.execute("
    CREATE TABLE IF NOT EXISTS invite(
        id_user INTEGER NOT NULL,
        id_team INTEGER NOT NULL
    )
  ").await.unwrap();

  pool.execute("
    CREATE TABLE IF NOT EXISTS message(
        id_message INTEGER PRIMARY KEY AUTOINCREMENT,
        id_user INTEGER NOT NULL,
        id_team INTEGER NOT NULL,
        message TEXT ,
        data DATE ,
        ora TIME 
    )
  ").await.unwrap();

  pool
}

async fn session(pool: Pool<Sqlite>) -> SessionStore<SessionSqlitePool> {
  let config = SessionConfig::default().with_table_name("session_table").with_key(Key::generate());
  let session_store = SessionStore::<SessionSqlitePool>::new(Some(pool.clone().into()), config).await.unwrap();
  session_store
}

//        ROUTES ENDPOINT

fn app(pool: Pool<Sqlite>, session_store : SessionStore<SessionSqlitePool>) -> Router {
  let config = AuthConfig::<i64>::default().with_anonymous_user_id(Some(1));
  let cors_layer=CorsLayer::new().allow_methods([Method::GET, Method::POST, Method::OPTIONS])
  .allow_credentials(true)
  .allow_headers([CONTENT_TYPE,AUTHORIZATION]).allow_origin("http://localhost:4000"
  .parse::<HeaderValue>().unwrap());
  
  Router::new()
    .route("/", get(|| async {"Hello world!"}))
    .route("/register", post(register))
    .route("/login", post(login))
    .route("/logout", get(log_out))
    .route("/list/teams",get(get_teams).route_layer(from_fn(auth)))
    .route("/list/invites",get(get_list_invites).route_layer(from_fn(auth)))
    .route("/create",post(create_team).route_layer(from_fn(auth)))
    .route("/invite",post(invite).route_layer(from_fn(auth)))
    .route("/accept",post(accept).route_layer(from_fn(auth)))
    .route("/send",post(send_message).route_layer(from_fn(auth)))
    .route("/messages", get(get_messages).route_layer(from_fn(auth))) // AGGIUNTO QUESTA ROTTA
    .route("/protected", get(protected).route_layer(from_fn(auth)))
    .layer(AuthSessionLayer::<User, i64, SessionSqlitePool, SqlitePool>::new(Some(pool.clone())).with_config(config))
    .layer(SessionLayer::new(session_store))
    .layer(cors_layer)
    .with_state(pool)
}

async fn register(State(pool): State<Pool<Sqlite>>, Json(user): Json<UserRequest>) -> impl IntoResponse {
  let rows : Vec<UserSql> = sqlx::query_as("SELECT * FROM user WHERE username = ?1").bind(&user.username).fetch_all(&pool).await.unwrap();

  if rows.len() != 0 {
    let msg = format!("Username : {} is already taken!", user.username);
    (StatusCode::BAD_REQUEST, msg).into_response()
  } else {
      let hash_password = bcrypt::hash(user.password, 10).unwrap();
      sqlx::query("INSERT INTO user (username, password) VALUES (?1, ?2)").bind(&user.username).bind(&hash_password).execute(&pool).await.unwrap();
      (StatusCode::OK, "Register successful!").into_response()
  }
}

async fn login(auth: AuthSession<User, i64, SessionSqlitePool, SqlitePool>, State(pool): State<Pool<Sqlite>>, Json(user): Json<UserRequest>) -> impl IntoResponse {
  let rows: Vec<UserSql> = sqlx::query_as("SELECT * FROM user WHERE username = ?1").bind(&user.username).fetch_all(&pool).await.unwrap();
  if rows.len() == 0 {
    let msg = format!("Username : {} is not registered", user.username);
    (StatusCode::BAD_REQUEST, msg).into_response()
  } else {
      let is_valid = bcrypt::verify(user.password, &rows[0].password).unwrap();
      if is_valid {
        auth.login_user(rows[0].id as i64);
        let resp = json!({
            "success": true,
            "message": "Login successful!"
        });
        (StatusCode::OK, Json(resp)).into_response()
      } else {
        let resp = json!({
            "success": false,
            "message": "Login error!"
        });
        (StatusCode::UNAUTHORIZED, Json(resp)).into_response()
      }
  }
}

async fn log_out(auth: AuthSession<User, i64, SessionSqlitePool, SqlitePool>) -> impl IntoResponse {
  auth.logout_user();
  (StatusCode::OK, "Log out successful!").into_response()
}

async fn get_list_invites(Extension(user): Extension<User>,State(pool): State<SqlitePool>) -> impl IntoResponse {
  let rows: Vec<Team> = sqlx::query_as(
        r#"
        SELECT t.id, t.name
        FROM team t
        INNER JOIN invite i ON i.id_team = t.id
        WHERE i.id_user = ?1
        "#
    )
    .bind(user.id)
    .fetch_all(&pool)
    .await.unwrap();

    let teams = serde_json::to_string_pretty(&rows).unwrap();
    (StatusCode::OK, teams)
}

async fn get_teams(Extension(user): Extension<User>,State(pool): State<SqlitePool>) -> impl IntoResponse {
  let rows: Vec<Team> = sqlx::query_as(
        r#"
        SELECT t.id, t.name
        FROM team t
        INNER JOIN user_team ut ON ut.id_team = t.id
        WHERE ut.id_user = ?1
        "#
    )
    .bind(user.id)
    .fetch_all(&pool)
    .await.unwrap();

    let teams = serde_json::to_string_pretty(&rows).unwrap();
    (StatusCode::OK, teams)
}

// AGGIUNTA FUNZIONE GET_MESSAGES MANCANTE
async fn get_messages(
    Extension(user): Extension<User>,
    State(pool): State<SqlitePool>,
    Query(params): Query<HashMap<String, String>>
) -> impl IntoResponse {
    let team_name = params.get("teamname").cloned().unwrap_or_default();

    if team_name.is_empty() {
        return (StatusCode::BAD_REQUEST, "Missing teamname").into_response();
    }

    let sql = r#"
        SELECT u.username, m.message, m.ora
        FROM message m
        JOIN user u ON m.id_user = u.id
        JOIN team t ON m.id_team = t.id
        JOIN user_team ut ON ut.id_team = t.id 
        WHERE t.name = ?1 AND ut.id_user = ?2
        ORDER BY m.data ASC, m.ora ASC
    "#;

    let rows: Vec<MessageResponse> = sqlx::query_as(sql)
        .bind(team_name)
        .bind(user.id) 
        .fetch_all(&pool)
        .await
        .unwrap_or(vec![]);

    (StatusCode::OK, Json(rows)).into_response()
}

pub async fn create_team(
    Extension(user): Extension<User>,    
    State(pool): State<SqlitePool>,     
    Json(body): Json<Value>     
) -> impl IntoResponse {
    let name =  body.get("name").and_then(|v| v.as_str());

    let insert_res = sqlx::query("INSERT INTO team (name) VALUES (?1)")
    .bind(name)
    .execute(&pool)
    .await;
  
    if let Err(e) = insert_res {
        let err = json!({ "error": format!("Failed to create team: {}", e), "ok": false });
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(err)).into_response();
    }
    let team_id=insert_res.unwrap().last_insert_rowid();
    
    let link_res = sqlx::query("INSERT INTO user_team (id_user, id_team) VALUES (?1, ?2)")
    .bind(user.id).bind(team_id)
    .execute(&pool)
    .await;

    if let Err(e) = link_res {
        let err = json!({ "error": format!("Failed to link user to team: {}", e), "ok": false });
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(err)).into_response();
    }

    let ok = json!({
        "ok": true,
        "team": {
            "id": team_id,
            "name": name
        }
    });

    (StatusCode::CREATED, Json(ok)).into_response()
}


async fn send_message(
    Extension(user): Extension<User>,    
    State(pool): State<SqlitePool>,     
    Json(body): Json<Value>  
) -> impl IntoResponse{

  let user_id=user.id;
  let teamname = body.get("teamname").and_then(|v| v.as_str()).unwrap_or("");
  let msg = body.get("message").and_then(|v| v.as_str()).unwrap_or("");

  let team_id:i64 = match sqlx::query_scalar("SELECT id FROM team WHERE name = ?1")
    .bind(teamname)
    .fetch_one(&pool)
    .await
    {
      Ok(id)=>id,
      Err(_) => return (StatusCode::NOT_FOUND, "Team not found").into_response(),
    };
    
    let _userin: i64 = match sqlx::query_scalar::<_,i64>("SELECT id_user FROM user_team WHERE id_user = ?1 AND id_team=?2")
    .bind(user_id).bind(team_id)
    .fetch_one(&pool)
    .await
    {
      Ok(id)=>id,
      Err(sqlx::Error::RowNotFound) => {
        return (StatusCode::UNAUTHORIZED, "User not in team").into_response();
    }
      Err(e) => {
        eprintln!("Database error: {:?}", e);
        return (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response();
      }
    };

   // CORRETTO: Uso CURRENT_DATE e CURRENT_TIME invece di ?4 e ?5
   let result = sqlx::query(
        "INSERT INTO message (id_user,id_team,message,data,ora) VALUES (?1,?2,?3, CURRENT_DATE, CURRENT_TIME)"
    )
    .bind(user_id)
    .bind(team_id)
    .bind(msg)
    .execute(&pool)
    .await; 

   match result {
       Ok(_) => (StatusCode::OK, "Messaggio inviato con successo").into_response(),
       Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
   }
}

// CORRETTO CON TRANSAZIONE
async fn accept(
    Extension(user): Extension<User>,    
    State(pool): State<SqlitePool>,     
    Json(body): Json<Value>  
) -> impl IntoResponse{

    let user_id = user.id;
    let teamname = body.get("teamname").and_then(|v| v.as_str()).unwrap_or("");
    let team_id:i64 = match sqlx::query_scalar("SELECT id FROM team WHERE name = ?1")
    .bind(teamname)
    .fetch_one(&pool)
    .await
    {
      Ok(id)=>id,
      Err(_) => return (StatusCode::NOT_FOUND, "Team not found").into_response(),
    };

    // INIZIO TRANSAZIONE
    let mut tx = match pool.begin().await {
        Ok(tx) => tx,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Transaction Error").into_response(),
    };

    if let Err(_) = sqlx::query("INSERT INTO user_team (id_user, id_team) VALUES (?1, ?2)")
        .bind(user_id).bind(team_id)
        .execute(&mut *tx)
        .await 
    {
        return (StatusCode::INTERNAL_SERVER_ERROR, "Errore inserimento team").into_response();
    }

    if let Err(_) = sqlx::query("DELETE FROM invite WHERE id_user = ?1 AND id_team = ?2")
        .bind(user_id).bind(team_id)
        .execute(&mut *tx)
        .await 
    {
        return (StatusCode::INTERNAL_SERVER_ERROR, "Errore rimozione invito").into_response();
    }

    match tx.commit().await {
        Ok(_) => (StatusCode::OK, "Invito accettato con successo").into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Errore commit").into_response(),
    }
}

async fn invite(
    Extension(_user): Extension<User>,    
    State(pool): State<SqlitePool>,     
    Json(body): Json<Value>  
) -> impl IntoResponse {
    let username: &str = body.get("username").and_then(|v| v.as_str()).unwrap_or("");
    let teamname = body.get("teamname").and_then(|v| v.as_str()).unwrap_or("");

    if username.is_empty() || teamname.is_empty() {
        return (StatusCode::BAD_REQUEST, "Invalid payload").into_response();
    }
    let user_id: i64 = match sqlx::query_scalar("SELECT id FROM user WHERE username = ?1")
        .bind(username)
        .fetch_one(&pool)
        .await
    {
        Ok(id) => id,
        Err(_) => return (StatusCode::NOT_FOUND, "User not found").into_response(),
    };
    let team_id: i64 = match sqlx::query_scalar("SELECT id FROM team WHERE name = ?1")
        .bind(teamname)
        .fetch_one(&pool)
        .await
    {
        Ok(id) => id,
        Err(_) => return (StatusCode::NOT_FOUND, "Team not found").into_response(),
    };

    let result = sqlx::query("INSERT INTO invite (id_user, id_team) VALUES (?1, ?2)")
    .bind(user_id).bind(team_id)
    .execute(&pool)
    .await; 

   match result {
       Ok(_) => (StatusCode::OK, "inserito").into_response(),
       Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Errore").into_response(),
   }
}

async fn protected(Extension(user): Extension<User>) -> impl IntoResponse {
  let msg = format!("Hello , {} , your id is {}", user.username, user.id);
  (StatusCode::OK, msg).into_response()
}

async fn auth(auth: AuthSession<User, i64, SessionSqlitePool, SqlitePool>, mut req: Request, next: Next) -> impl IntoResponse {
  if auth.is_authenticated() {
    let user = auth.current_user.unwrap().clone();
    req.extensions_mut().insert(user);
    next.run(req).await
  } else {
      (StatusCode::UNAUTHORIZED, "Guest, you are unauthorized!").into_response()
  }
}

#[derive(Deserialize)]
struct UserRequest {
  username: String,
  password: String
}

#[derive(Clone)]
pub struct User {
  pub id : i64,
  pub anonymous: bool,
  pub username: String
}

#[async_trait]
impl Authentication<User, i64, SqlitePool> for  User {
    async fn load_user(userid:i64,pool:Option< &SqlitePool>) -> Result<User, anyhow::Error> {
        if userid == 1 {
          Ok(User { id: userid, anonymous: true, username: "guest".to_string() })
        } else {
            let user: UserSql = sqlx::query_as("SELECT * FROM user WHERE id = ?1").bind(&userid).fetch_one(pool.unwrap()).await.unwrap();
            Ok(User { id: user.id as i64, anonymous: false, username: user.username })
        }
    }
    fn is_active(&self) -> bool { !self.anonymous }
    fn is_anonymous(&self) -> bool { self.anonymous }
    fn is_authenticated(&self) -> bool { !self.anonymous }
}

#[derive(FromRow)]
struct UserSql {
  id: i32,
  username: String,
  password: String
}