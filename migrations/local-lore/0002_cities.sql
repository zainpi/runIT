-- Existing saved games remain Toronto games. Keep all rounds and scores.
ALTER TABLE ll_games ADD COLUMN city_id TEXT NOT NULL DEFAULT 'toronto';
DROP INDEX idx_ll_daily_attempt;
CREATE UNIQUE INDEX idx_ll_daily_attempt
  ON ll_games(guest_id, city_id, day_key) WHERE mode='daily';
