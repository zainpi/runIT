import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabase } from "./sqlite.mjs";

test("city migration preserves old Toronto games and gives each city one daily attempt", async () => {
  const dir = mkdtempSync(join(tmpdir(), "local-lore-cities-"));
  const path = join(dir, "legacy.sqlite");
  let db;
  try {
    const legacy = new DatabaseSync(path);
    legacy.exec(
      readFileSync(
        new URL("../../migrations/local-lore/0001_game.sql", import.meta.url),
        "utf8",
      ),
    );
    legacy
      .prepare("INSERT INTO ll_games VALUES(?,?,?,?,?,?,?)")
      .run(
        "old-game",
        "player",
        "old-key",
        "daily",
        3,
        "2026-09-11",
        Date.now(),
      );
    const result = JSON.stringify({
      score: 638,
      label: "Queen Street West × Spadina Avenue",
    });
    legacy
      .prepare("INSERT INTO ll_rounds VALUES(?,?,?,?,?,?)")
      .run("old-round", "old-game", 1, "osm-23922863", 0, result);
    legacy.close();
    db = createDatabase(path);
    assert.equal(
      (
        await db
          .prepare("SELECT city_id FROM ll_games WHERE id='old-game'")
          .first()
      ).city_id,
      "toronto",
    );
    assert.equal(
      (
        await db
          .prepare("SELECT result_json FROM ll_rounds WHERE id='old-round'")
          .first()
      ).result_json,
      result,
    );
    await db
      .prepare("INSERT INTO ll_games VALUES(?,?,?,?,?,?,?,?)")
      .bind(
        "new-game",
        "player",
        "new-key",
        "daily",
        3,
        "2026-09-11",
        Date.now(),
        "nyc",
      )
      .run();
    await assert.rejects(
      db
        .prepare("INSERT INTO ll_games VALUES(?,?,?,?,?,?,?,?)")
        .bind(
          "duplicate",
          "player",
          "other-key",
          "daily",
          3,
          "2026-09-11",
          Date.now(),
          "toronto",
        )
        .run(),
      /UNIQUE/,
    );
    db.close();
    db = createDatabase(path);
    assert.equal(
      (await db.prepare("SELECT count(*) AS count FROM ll_games").first())
        .count,
      2,
    );
  } finally {
    db?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
