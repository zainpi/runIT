// Local development/test adapter. Production uses Cloudflare D1 directly.
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
export function createDatabase(path = ":memory:") {
  const sqlite = new DatabaseSync(path);
  sqlite.exec("PRAGMA foreign_keys=ON");
  if (
    !sqlite
      .prepare("SELECT name FROM sqlite_master WHERE name='ll_games'")
      .get()
  )
    sqlite.exec(
      readFileSync(
        new URL("../../migrations/local-lore/0001_game.sql", import.meta.url),
        "utf8",
      ),
    );
  const db = {
    prepare(sql) {
      let args = [];
      const stmt = {
        bind(...values) {
          args = values;
          return stmt;
        },
        async first() {
          return sqlite.prepare(sql).get(...args) || null;
        },
        async all() {
          return { results: sqlite.prepare(sql).all(...args) };
        },
        async run() {
          return sqlite.prepare(sql).run(...args);
        },
      };
      return stmt;
    },
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const result = [];
        for (const stmt of statements) result.push(await stmt.run());
        sqlite.exec("COMMIT");
        return result;
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    },
    close() {
      sqlite.close();
    },
  };
  return db;
}
