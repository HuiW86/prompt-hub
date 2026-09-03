use chrono::{DateTime, Utc};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use crate::error::RepoResult;
use crate::repo::parse_ts;

// ADR-028 P0: the read side of the trash. `deleted_at` turns every asset table
// into two views of one table — the list reads (alive) and this one (trashed).
// Building both from the same rows is why restore keeps the id, the creation
// time, the sort position and the usage history without any bookkeeping.

/// Which asset table a trash entry came from. Kept as a closed set on both sides
/// of the IPC boundary (`AssetKind` in `src/ipc/index.ts`); the wire form is the
/// snake_case discriminant, matching `UsageTargetType`'s convention.
#[derive(Debug, Serialize, Deserialize, Copy, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AssetKind {
    Modifier,
    Macro,
    AlignmentPhrase,
    Composition,
    Phrase,
    Scene,
    SubStage,
}

impl AssetKind {
    /// The SQL table this kind lives in. Used to build statements by string
    /// interpolation, so the value must stay a `&'static str` from this closed
    /// set — never anything derived from a caller's input.
    pub fn table(self) -> &'static str {
        match self {
            AssetKind::Modifier => "modifiers",
            AssetKind::Macro => "macros",
            AssetKind::AlignmentPhrase => "alignment_phrases",
            AssetKind::Composition => "compositions",
            AssetKind::Phrase => "phrases",
            AssetKind::Scene => "scenes",
            AssetKind::SubStage => "sub_stages",
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            AssetKind::Modifier => "modifier",
            AssetKind::Macro => "macro",
            AssetKind::AlignmentPhrase => "alignment_phrase",
            AssetKind::Composition => "composition",
            AssetKind::Phrase => "phrase",
            AssetKind::Scene => "scene",
            AssetKind::SubStage => "sub_stage",
        }
    }

    #[allow(clippy::should_implement_trait)]
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "modifier" => Some(AssetKind::Modifier),
            "macro" => Some(AssetKind::Macro),
            "alignment_phrase" => Some(AssetKind::AlignmentPhrase),
            "composition" => Some(AssetKind::Composition),
            "phrase" => Some(AssetKind::Phrase),
            "scene" => Some(AssetKind::Scene),
            "sub_stage" => Some(AssetKind::SubStage),
            _ => None,
        }
    }

    pub const ALL: [AssetKind; 7] = [
        AssetKind::Modifier,
        AssetKind::Macro,
        AssetKind::AlignmentPhrase,
        AssetKind::Composition,
        AssetKind::Phrase,
        AssetKind::Scene,
        AssetKind::SubStage,
    ];
}

/// One row in the trash. `label` is the asset's `name` — enough to recognise it
/// in the list; the body is deliberately not carried, because the trash view is
/// for identifying what to restore, not for reading deleted content.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TrashEntry {
    pub kind: AssetKind,
    pub id: String,
    pub label: String,
    pub deleted_at: DateTime<Utc>,
}

/// Every soft-deleted row across the seven asset tables, newest deletion first.
/// Unbounded by design: ADR-028 sub-decision 4 keeps the trash until the user
/// empties it, and the count is what tells them it is time to.
pub fn list_trash(conn: &Connection) -> RepoResult<Vec<TrashEntry>> {
    // soft-delete-gate: exempt — this IS the trash view; it selects exactly the
    // rows every other read hides (`deleted_at IS NOT NULL`).
    let mut stmt = conn.prepare(
        "SELECT 'modifier' AS kind, id, name AS label, deleted_at
           FROM modifiers          WHERE deleted_at IS NOT NULL
         UNION ALL
         SELECT 'macro', id, name, deleted_at
           FROM macros             WHERE deleted_at IS NOT NULL
         UNION ALL
         SELECT 'alignment_phrase', id, name, deleted_at
           FROM alignment_phrases  WHERE deleted_at IS NOT NULL
         UNION ALL
         SELECT 'composition', id, name, deleted_at
           FROM compositions       WHERE deleted_at IS NOT NULL
         UNION ALL
         SELECT 'phrase', id, name, deleted_at
           FROM phrases            WHERE deleted_at IS NOT NULL
         UNION ALL
         SELECT 'scene', id, name, deleted_at
           FROM scenes             WHERE deleted_at IS NOT NULL
         UNION ALL
         SELECT 'sub_stage', id, name, deleted_at
           FROM sub_stages         WHERE deleted_at IS NOT NULL
         ORDER BY deleted_at DESC, kind ASC, id ASC",
    )?;
    let raw = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>("kind")?,
            row.get::<_, String>("id")?,
            row.get::<_, String>("label")?,
            row.get::<_, String>("deleted_at")?,
        ))
    })?;
    let mut out = Vec::new();
    for r in raw {
        let (kind, id, label, deleted) = r?;
        let kind = AssetKind::from_str(&kind).ok_or_else(|| {
            crate::error::RepoError::Other(format!("unknown trash asset kind `{kind}`"))
        })?;
        out.push(TrashEntry {
            kind,
            id,
            label,
            deleted_at: parse_ts(deleted)?,
        });
    }
    Ok(out)
}
