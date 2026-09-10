CREATE TABLE ll_games (
  id TEXT PRIMARY KEY,
  guest_id TEXT NOT NULL,
  start_key TEXT NOT NULL,
  mode TEXT NOT NULL CHECK(mode IN ('daily','around','landmark')),
  radius INTEGER NOT NULL CHECK(radius IN (1,3,5,10)),
  day_key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(guest_id, start_key)
);
CREATE INDEX idx_ll_games_guest_created ON ll_games(guest_id, created_at DESC);
CREATE UNIQUE INDEX idx_ll_daily_attempt ON ll_games(guest_id,day_key) WHERE mode='daily';
CREATE TABLE ll_rounds (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES ll_games(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  target_id TEXT NOT NULL,
  clue_used INTEGER NOT NULL DEFAULT 0,
  result_json TEXT,
  UNIQUE(game_id,ordinal)
);
CREATE TABLE ll_panoramas (
  target_id TEXT PRIMARY KEY,
  pano_id TEXT NOT NULL,
  checked_at INTEGER NOT NULL
);
CREATE TABLE ll_usage (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX idx_ll_usage_expires ON ll_usage(expires_at);
