use crate::{RepoError, RepoResult};
use chrono::{DateTime, Utc};
use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WebsiteGroup {
    pub id: String,
    pub name: String,
    pub order_index: i64,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Website {
    pub id: String,
    pub name: String,
    pub url: String,
    pub description: String,
    pub group_id: Option<String>,
    pub order_index: i64,
    pub created_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct WebsiteLibrary {
    pub groups: Vec<WebsiteGroup>,
    pub websites: Vec<Website>,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebsiteInput {
    pub id: Option<String>,
    pub name: String,
    pub url: String,
    pub description: String,
    pub group_id: Option<String>,
}

pub fn validate_name(name: &str) -> RepoResult<&str> {
    let name = name.trim();
    if name.is_empty() || name.chars().count() > 120 {
        return Err(RepoError::Other("名称须为 1–120 个字符".into()));
    }
    Ok(name)
}
pub fn normalize_url(raw: &str) -> RepoResult<String> {
    let raw = raw.trim();
    let invalid =
        || RepoError::Other("请输入有效的 http:// 或 https:// 网址（不含账号密码）".into());
    if raw.len() > 8192 || raw.chars().any(char::is_control) {
        return Err(invalid());
    }
    let url = url::Url::parse(raw).map_err(|_| invalid())?;
    if !matches!(url.scheme(), "http" | "https")
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err(invalid());
    }
    Ok(url.into())
}

/// Includes deleted rows so recovery remains reachable after the toast expires.
pub fn list_websites(conn: &Connection) -> RepoResult<WebsiteLibrary> {
    let groups = conn
        .prepare("SELECT id,name,order_index FROM website_groups ORDER BY order_index,id")?
        .query_map([], |r| {
            Ok(WebsiteGroup {
                id: r.get(0)?,
                name: r.get(1)?,
                order_index: r.get(2)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    let raw = conn.prepare("SELECT id,name,url,description,group_id,order_index,created_at,deleted_at FROM websites ORDER BY order_index,id")?
        .query_map([], |r| Ok((Website { id:r.get(0)?, name:r.get(1)?, url:r.get(2)?, description:r.get(3)?, group_id:r.get(4)?, order_index:r.get(5)?, created_at:Utc::now(), deleted_at:None }, r.get::<_,String>(6)?, r.get::<_,Option<String>>(7)?)))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    let websites = raw
        .into_iter()
        .map(|(mut w, created, deleted)| {
            w.created_at = crate::repo::parse_ts(created)?;
            w.deleted_at = crate::repo::parse_ts_opt(deleted)?;
            Ok(w)
        })
        .collect::<RepoResult<Vec<_>>>()?;
    Ok(WebsiteLibrary { groups, websites })
}

pub fn website_url(conn: &Connection, id: &str) -> RepoResult<String> {
    let raw: Option<String> = conn
        .query_row(
            "SELECT url FROM websites WHERE id=?1 AND deleted_at IS NULL",
            [id],
            |r| r.get(0),
        )
        .optional()?;
    normalize_url(&raw.ok_or_else(|| RepoError::Other("网站不存在或已删除".into()))?)
}
