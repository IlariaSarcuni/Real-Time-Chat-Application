use serde::{Deserialize, Serialize};
use sqlx::{prelude::FromRow, SqlitePool};
use axum_session_auth::Authentication;
use async_trait::async_trait;

#[derive(Serialize, FromRow)]
pub struct Team {
    pub id: i64,
    pub name: String,
}

#[derive(Serialize, FromRow)]
pub struct PrivateAssoc{
    pub id: i64,
    pub id_user1: i64,
    pub id_user2: i64
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct ChatListRow {
    pub id: i64,
    pub other_username: String,
    pub other_user_id: i64,
}

#[derive(Serialize, FromRow,Debug)]
pub struct PrivateMessage{
    pub id_chat:i64,
    pub message:String,
    pub data:String,
    pub ora:String,
    pub name1:String,
    pub name2:String,
    #[sqlx(rename = "type")]
    #[serde(rename = "type")]
    pub msg_type:String,
}

#[derive(Serialize, FromRow)]
pub struct UnreadCount {
    pub id_team: i64,
    pub notification: i64,
}

#[derive(Serialize, FromRow)]
pub struct MessageResponse {
    pub username: String,
    pub message: String,
    pub ora: String,
    pub data: String,
    #[sqlx(rename = "type")]
    #[serde(rename = "type")]
    pub msg_type: String,   // to distinguish 'chat' from 'system' message
}

#[derive(Serialize, FromRow)]
pub struct MemberResponse {
    pub username: String,
}

#[derive(Serialize)]
pub struct UserInfo {
    pub id: i64,
    pub username: String,
}

#[derive(Deserialize)]
pub struct UserRequest {
    pub username: String,
    pub password: String,
}

#[derive(FromRow)]
pub struct UserSql {
    pub id: i32,
    pub username: String,
    pub password: String,
}

#[derive(Clone, Debug, Default)]
pub struct User {
    pub id: i64,
    pub anonymous: bool,
    pub username: String,
}

#[async_trait]
impl Authentication<User, i64, SqlitePool> for User {
    async fn load_user(userid: i64, pool: Option<&SqlitePool>) -> Result<User, anyhow::Error> {
        if userid == 1 {
            Ok(User { id: 1, anonymous: true, username: "guest".to_string() })
        } else {
            let u: UserSql = sqlx::query_as("SELECT * FROM user WHERE id = ?1")
                .bind(userid)
                .fetch_one(pool.unwrap())
                .await?;
            Ok(User { id: u.id as i64, anonymous: false, username: u.username })
        }
    }
    fn is_active(&self) -> bool { !self.anonymous }
    fn is_anonymous(&self) -> bool { self.anonymous }
    fn is_authenticated(&self) -> bool { !self.anonymous }
}