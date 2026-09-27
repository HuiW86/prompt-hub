CREATE TABLE website_groups (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL CHECK(length(trim(name)) > 0),
  order_index INTEGER NOT NULL CHECK(order_index >= 0),
  UNIQUE(name)
);
CREATE TABLE websites (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL CHECK(length(trim(name)) > 0),
  url TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  group_id TEXT REFERENCES website_groups(id) ON DELETE SET NULL,
  order_index INTEGER NOT NULL CHECK(order_index >= 0),
  created_at TEXT NOT NULL,
  deleted_at TEXT
);
