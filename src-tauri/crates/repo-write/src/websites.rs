use chrono::Utc;
use repo_core::websites::{
    list_websites, normalize_url, validate_name, WebsiteInput, WebsiteLibrary,
};
use repo_core::{RepoError, RepoResult};
use rusqlite::{params, Connection};
use std::collections::HashSet;

fn changed(n: usize) -> RepoResult<()> {
    if n == 0 {
        return Err(RepoError::Other(
            "记录不存在或状态已改变，请刷新后重试".into(),
        ));
    }
    Ok(())
}

pub fn save_website(conn: &Connection, input: WebsiteInput) -> RepoResult<()> {
    let name = validate_name(&input.name)?;
    let url = normalize_url(&input.url)?;
    if input.description.chars().count() > 2000 {
        return Err(RepoError::Other("说明不能超过 2000 个字符".into()));
    }
    match input.id {
        Some(id) => changed(conn.execute("UPDATE websites SET name=?2,url=?3,description=?4,group_id=?5,
            order_index=CASE WHEN group_id IS ?5 THEN order_index ELSE (SELECT COALESCE(MAX(order_index),-1)+1 FROM websites WHERE group_id IS ?5) END
            WHERE id=?1 AND deleted_at IS NULL", params![id,name,url,input.description.trim(),input.group_id])?),
        None => {
            conn.execute("INSERT INTO websites(id,name,url,description,group_id,order_index,created_at)
                VALUES(?1,?2,?3,?4,?5,(SELECT COALESCE(MAX(order_index),-1)+1 FROM websites WHERE group_id IS ?5),?6)",
                params![uuid::Uuid::new_v4().to_string(),name,url,input.description.trim(),input.group_id,Utc::now().to_rfc3339()])?;
            Ok(())
        }
    }
}
pub fn delete_website(conn: &Connection, id: &str) -> RepoResult<()> {
    changed(conn.execute(
        "UPDATE websites SET deleted_at=?2 WHERE id=?1 AND deleted_at IS NULL",
        params![id, Utc::now().to_rfc3339()],
    )?)
}
pub fn restore_website(conn: &Connection, id: &str) -> RepoResult<()> {
    changed(conn.execute(
        "UPDATE websites SET deleted_at=NULL WHERE id=?1 AND deleted_at IS NOT NULL",
        [id],
    )?)
}
pub fn save_website_group(conn: &Connection, id: Option<String>, name: &str) -> RepoResult<()> {
    let name = validate_name(name)?;
    let duplicate: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM website_groups WHERE name=?1 AND (?2 IS NULL OR id<>?2))",
        params![name, id],
        |r| r.get(0),
    )?;
    if duplicate {
        return Err(RepoError::Other("已存在同名分组".into()));
    }
    match id {
        Some(id) => changed(conn.execute(
            "UPDATE website_groups SET name=?2 WHERE id=?1",
            params![id, name],
        )?),
        None => {
            conn.execute("INSERT INTO website_groups(id,name,order_index) VALUES(?1,?2,(SELECT COALESCE(MAX(order_index),-1)+1 FROM website_groups))",params![uuid::Uuid::new_v4().to_string(),name])?;
            Ok(())
        }
    }
}
pub fn delete_website_group(conn: &Connection, id: &str) -> RepoResult<()> {
    let tx = conn.unchecked_transaction()?;
    // Keep sites (including trash) reachable; append to the ungrouped collection.
    let base: i64 = tx.query_row(
        "SELECT COALESCE(MAX(order_index),-1)+1 FROM websites WHERE group_id IS NULL",
        [],
        |r| r.get(0),
    )?;
    tx.execute(
        "UPDATE websites SET order_index=order_index+?2 WHERE group_id=?1",
        params![id, base],
    )?;
    changed(tx.execute("DELETE FROM website_groups WHERE id=?1", [id])?)?;
    tx.commit()?;
    Ok(())
}
fn validate_order(expected: &[String], ids: &[String]) -> RepoResult<()> {
    let actual: HashSet<_> = ids.iter().collect();
    if ids.len() != actual.len() || actual != expected.iter().collect() {
        return Err(RepoError::Other("列表已改变，请刷新后重新排序".into()));
    }
    Ok(())
}
pub fn reorder_websites(
    conn: &Connection,
    group_id: Option<String>,
    ids: &[String],
) -> RepoResult<()> {
    let tx = conn.unchecked_transaction()?;
    let expected = list_websites(&tx)?
        .websites
        .into_iter()
        .filter(|w| w.deleted_at.is_none() && w.group_id == group_id)
        .map(|w| w.id)
        .collect::<Vec<_>>();
    validate_order(&expected, ids)?;
    for (index, id) in ids.iter().enumerate() {
        tx.execute(
            "UPDATE websites SET order_index=?2 WHERE id=?1",
            params![id, index as i64],
        )?;
    }
    tx.commit()?;
    Ok(())
}
pub fn reorder_website_groups(conn: &Connection, ids: &[String]) -> RepoResult<()> {
    let tx = conn.unchecked_transaction()?;
    validate_order(
        &list_websites(&tx)?
            .groups
            .into_iter()
            .map(|g| g.id)
            .collect::<Vec<_>>(),
        ids,
    )?;
    for (index, id) in ids.iter().enumerate() {
        tx.execute(
            "UPDATE website_groups SET order_index=?2 WHERE id=?1",
            params![id, index as i64],
        )?;
    }
    tx.commit()?;
    Ok(())
}

/// Called inside the existing whole-backup transaction; never commits independently.
pub fn replace_library(conn: &Connection, library: &WebsiteLibrary) -> RepoResult<()> {
    conn.execute("DELETE FROM websites", [])?;
    conn.execute("DELETE FROM website_groups", [])?;
    for g in &library.groups {
        conn.execute(
            "INSERT INTO website_groups(id,name,order_index) VALUES(?1,?2,?3)",
            params![g.id, validate_name(&g.name)?, g.order_index],
        )?;
    }
    for w in &library.websites {
        if w.description.chars().count() > 2000 {
            return Err(RepoError::Other("说明不能超过 2000 个字符".into()));
        }
        conn.execute("INSERT INTO websites(id,name,url,description,group_id,order_index,created_at,deleted_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8)",
            params![w.id,validate_name(&w.name)?,normalize_url(&w.url)?,w.description,w.group_id,w.order_index,w.created_at.to_rfc3339(),w.deleted_at.map(|d|d.to_rfc3339())])?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use repo_core::db;
    use repo_core::websites::{website_url, WebsiteInput};
    use serde_json::{json, Value};

    fn conn() -> (tempfile::TempDir, Connection) {
        let dir = tempfile::tempdir().unwrap();
        let c = db::open_and_migrate(&dir.path().join("test.db")).unwrap();
        (dir, c)
    }
    fn add(conn: &Connection, name: &str, group_id: Option<String>) {
        save_website(
            conn,
            WebsiteInput {
                id: None,
                name: name.into(),
                url: format!("https://example.com/{name}"),
                description: "说明".into(),
                group_id,
            },
        )
        .unwrap();
    }
    #[test]
    fn websites_are_independent_ordered_and_recoverable() {
        let (_dir, c) = conn();
        save_website_group(&c, None, "工作").unwrap();
        let group = list_websites(&c).unwrap().groups[0].id.clone();
        add(&c, "A", Some(group.clone()));
        add(&c, "B", Some(group.clone()));
        add(&c, "C", None);
        let sites = list_websites(&c).unwrap().websites;
        let a = sites.iter().find(|w| w.name == "A").unwrap().id.clone();
        let b = sites.iter().find(|w| w.name == "B").unwrap().id.clone();
        reorder_websites(&c, Some(group.clone()), &[b.clone(), a.clone()]).unwrap();
        assert!(reorder_websites(&c, Some(group.clone()), std::slice::from_ref(&a)).is_err());
        assert!(reorder_websites(&c, Some(group.clone()), &[a.clone(), a.clone()]).is_err());
        assert_eq!(
            list_websites(&c)
                .unwrap()
                .websites
                .iter()
                .filter(|w| w.group_id.as_deref() == Some(&group))
                .map(|w| w.name.as_str())
                .collect::<Vec<_>>(),
            vec!["B", "A"]
        );
        delete_website(&c, &a).unwrap();
        assert!(website_url(&c, &a).is_err(), "deleted links cannot open");
        delete_website_group(&c, &group).unwrap();
        let moved = list_websites(&c).unwrap().websites;
        assert!(moved.iter().all(|w| w.group_id.is_none()));
        restore_website(&c, &a).unwrap();
        assert_eq!(website_url(&c, &a).unwrap(), "https://example.com/A");
    }
    #[test]
    fn rejects_non_web_schemes_credentials_and_control_characters() {
        for bad in [
            "javascript:alert(1)",
            "file:///tmp/a",
            "https://u:p@example.com",
            "https://example.com/\nX",
            "https://",
        ] {
            assert!(normalize_url(bad).is_err(), "accepted {bad:?}");
        }
        assert!(normalize_url("https://example.com/path").is_ok());
    }

    #[test]
    fn moving_sites_and_groups_persists_order_and_membership() {
        let (_dir, c) = conn();
        save_website_group(&c, None, "工作").unwrap();
        save_website_group(&c, None, "学习").unwrap();
        let groups = list_websites(&c).unwrap().groups;
        let work = groups[0].id.clone();
        let learn = groups[1].id.clone();
        reorder_website_groups(&c, &[learn.clone(), work.clone()]).unwrap();
        assert_eq!(list_websites(&c).unwrap().groups[0].name, "学习");
        add(&c, "Docs", Some(work));
        let site = list_websites(&c).unwrap().websites[0].clone();
        save_website(
            &c,
            WebsiteInput {
                id: Some(site.id.clone()),
                name: "Docs".into(),
                url: site.url,
                description: "移动后可打开".into(),
                group_id: Some(learn.clone()),
            },
        )
        .unwrap();
        let after_move = list_websites(&c).unwrap();
        let moved = &after_move.websites[0];
        assert_eq!(moved.group_id.as_ref(), Some(&learn));
        assert_eq!(moved.description, "移动后可打开");
        assert!(save_website(
            &c,
            WebsiteInput {
                id: Some(site.id),
                name: "Docs".into(),
                url: "https://example.com".into(),
                description: String::new(),
                group_id: Some("missing".into()),
            }
        )
        .is_err());
        assert_eq!(
            list_websites(&c).unwrap().websites[0].group_id.as_ref(),
            Some(&learn)
        );
    }
    #[test]
    fn old_export_preserves_links_empty_export_clears_and_invalid_rolls_back() {
        let (_dir, c) = conn();
        add(&c, "Existing", None);
        let original = repo_core::export_json(&c).unwrap();
        let mut bundle: Value = serde_json::from_str(&original).unwrap();
        bundle.as_object_mut().unwrap().remove("website_library");
        bundle["schema_version"] = json!("1.3");
        let summary = crate::import::import_json(&c, &bundle.to_string()).unwrap();
        assert_eq!(summary.websites, None);
        assert_eq!(list_websites(&c).unwrap().websites.len(), 1);
        bundle["website_library"] = Value::Null;
        assert!(crate::import::import_json(&c, &bundle.to_string()).is_err());
        assert_eq!(list_websites(&c).unwrap().websites.len(), 1);
        bundle["website_library"] = json!({"groups":[],"websites":[]});
        let summary = crate::import::import_json(&c, &bundle.to_string()).unwrap();
        assert_eq!(summary.websites, Some(0));
        assert!(list_websites(&c).unwrap().websites.is_empty());
        crate::import::import_json(&c, &original).unwrap();
        let mut invalid: Value = serde_json::from_str(&original).unwrap();
        invalid["website_library"]["websites"][0]["url"] = json!("javascript:alert(1)");
        invalid["macros"] = json!([]);
        assert!(crate::import::import_json(&c, &invalid.to_string()).is_err());
        assert_eq!(
            list_websites(&c).unwrap().websites.len(),
            1,
            "failed replacement rolled back"
        );
        assert_eq!(
            repo_core::repo::list_macros(&c).unwrap().len(),
            4,
            "unrelated asset wipe rolled back"
        );
    }
}
