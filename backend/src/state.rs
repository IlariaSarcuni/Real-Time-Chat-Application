use sqlx::SqlitePool;
use std::sync::Arc;
use std::time::Instant;
use dashmap::DashMap;
use tokio::sync::broadcast;
use std::collections::HashSet;

pub type ChatRooms = Arc<DashMap<i64, broadcast::Sender<String>>>;
pub type OnlineUsers = Arc<DashMap<i64, Arc<tokio::sync::Mutex<HashSet<i64>>>>>;
pub type PresenceMap = Arc<DashMap<i64, Instant>>;

#[derive(Clone)]
pub struct AppState {
    pub pool: SqlitePool,
    pub chat_rooms: ChatRooms,
    pub online_users: OnlineUsers,
    pub presence_map: PresenceMap,
}

impl AppState {
    pub fn new(pool: SqlitePool) -> Self {
        Self {
            pool,
            chat_rooms: Arc::new(DashMap::new()),
            online_users: Arc::new(DashMap::new()),
            presence_map: Arc::new(DashMap::new()),
        }
    }
}