//! Panorama layout (I-02, M-01): which column each item sits in and which of
//! the nine pin slots it holds. View state, not an asset — see migration 0016.

use rusqlite::{Connection, Row};
use serde::{Deserialize, Serialize};

use crate::{RepoError, RepoResult};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum PanoramaAssetKind {
    Macro,
    Phrase,
    AlignmentPhrase,
    Modifier,
    Composition,
}

impl PanoramaAssetKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Macro => "macro",
            Self::Phrase => "phrase",
            Self::AlignmentPhrase => "alignment_phrase",
            Self::Modifier => "modifier",
            Self::Composition => "composition",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        Some(match s {
            "macro" => Self::Macro,
            "phrase" => Self::Phrase,
            "alignment_phrase" => Self::AlignmentPhrase,
            "modifier" => Self::Modifier,
            "composition" => Self::Composition,
            _ => return None,
        })
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum PanoramaGroupId {
    Align,
    Diverge,
    Converge,
    Execute,
    Polish,
    Retain,
    Cue,
    Tool,
}

impl PanoramaGroupId {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Align => "align",
            Self::Diverge => "diverge",
            Self::Converge => "converge",
            Self::Execute => "execute",
            Self::Polish => "polish",
            Self::Retain => "retain",
            Self::Cue => "cue",
            Self::Tool => "tool",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        Some(match s {
            "align" => Self::Align,
            "diverge" => Self::Diverge,
            "converge" => Self::Converge,
            "execute" => Self::Execute,
            "polish" => Self::Polish,
            "retain" => Self::Retain,
            "cue" => Self::Cue,
            "tool" => Self::Tool,
            _ => return None,
        })
    }
}

/// One row of `panorama_placements`. `group_id: None` means "use the default
/// column rule"; `pin_slot: None` means "holds no pin slot". A row with both
/// `None` is never stored — writing it deletes the row.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PanoramaPlacement {
    pub asset_kind: PanoramaAssetKind,
    pub asset_id: String,
    pub group_id: Option<PanoramaGroupId>,
    pub pin_slot: Option<u8>,
}

pub const PIN_SLOT_MIN: u8 = 1;
pub const PIN_SLOT_MAX: u8 = 9;

pub fn validate_pin_slot(slot: Option<u8>) -> RepoResult<()> {
    match slot {
        Some(s) if !(PIN_SLOT_MIN..=PIN_SLOT_MAX).contains(&s) => {
            Err(RepoError::Other(format!("常用位须为 1–9，收到 {s}")))
        }
        _ => Ok(()),
    }
}

fn placement_from_row(
    row: &Row<'_>,
) -> rusqlite::Result<(String, String, Option<String>, Option<i64>)> {
    Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
}

fn hydrate(raw: (String, String, Option<String>, Option<i64>)) -> RepoResult<PanoramaPlacement> {
    let (kind, asset_id, group, slot) = raw;
    let asset_kind = PanoramaAssetKind::parse(&kind).ok_or_else(|| {
        RepoError::Other(format!(
            "panorama_placements.asset_kind holds unknown value `{kind}`"
        ))
    })?;
    let group_id = match group {
        Some(g) => Some(PanoramaGroupId::parse(&g).ok_or_else(|| {
            RepoError::Other(format!(
                "panorama_placements.group_id holds unknown value `{g}`"
            ))
        })?),
        None => None,
    };
    let pin_slot = match slot {
        Some(s) => Some(u8::try_from(s).map_err(|_| {
            RepoError::Other(format!("panorama_placements.pin_slot out of range: {s}"))
        })?),
        None => None,
    };
    Ok(PanoramaPlacement {
        asset_kind,
        asset_id,
        group_id,
        pin_slot,
    })
}

/// Placements whose asset is still alive. A trashed asset keeps its row (so a
/// restore brings its position back) but the row is not listed while trashed.
pub fn list_panorama_placements(conn: &Connection) -> RepoResult<Vec<PanoramaPlacement>> {
    let mut stmt = conn.prepare(
        "SELECT p.asset_kind, p.asset_id, p.group_id, p.pin_slot
         FROM panorama_placements p
         WHERE (p.asset_kind = 'macro' AND EXISTS (
                  SELECT 1 FROM macros a WHERE a.id = p.asset_id AND a.deleted_at IS NULL))
            OR (p.asset_kind = 'phrase' AND EXISTS (
                  SELECT 1 FROM phrases a WHERE a.id = p.asset_id AND a.deleted_at IS NULL))
            OR (p.asset_kind = 'alignment_phrase' AND EXISTS (
                  SELECT 1 FROM alignment_phrases a WHERE a.id = p.asset_id AND a.deleted_at IS NULL))
            OR (p.asset_kind = 'modifier' AND EXISTS (
                  SELECT 1 FROM modifiers a WHERE a.id = p.asset_id AND a.deleted_at IS NULL))
            OR (p.asset_kind = 'composition' AND EXISTS (
                  SELECT 1 FROM compositions a WHERE a.id = p.asset_id AND a.deleted_at IS NULL))
         ORDER BY p.asset_kind ASC, p.asset_id ASC",
    )?;
    let raw = stmt
        .query_map([], placement_from_row)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    raw.into_iter().map(hydrate).collect()
}

/// Every stored row, unfiltered, for the full-fidelity export. Rows of trashed
/// assets travel with the export the same way the trashed assets themselves do
/// (ADR-028 sub-decision 6); rows that point at nothing are dropped on import.
/// Reads only `panorama_placements`, so the seventh gate has nothing to check.
pub fn export_panorama_placements(conn: &Connection) -> RepoResult<Vec<PanoramaPlacement>> {
    let mut stmt = conn.prepare(
        "SELECT asset_kind, asset_id, group_id, pin_slot
         FROM panorama_placements
         ORDER BY asset_kind ASC, asset_id ASC",
    )?;
    let raw = stmt
        .query_map([], placement_from_row)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    raw.into_iter().map(hydrate).collect()
}
