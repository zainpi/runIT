import { Pool, PoolClient } from "pg";
import { DomainError } from "./model";
let pool: Pool | undefined;
export function postgres() {
  if (!process.env.NEUTRONIUM_DATABASE_URL)
    throw new DomainError(
      "Configure NEUTRONIUM_DATABASE_URL and apply the PostgreSQL migrations.",
      503,
    );
  return (pool ||= new Pool({
    connectionString: process.env.NEUTRONIUM_DATABASE_URL,
    max: 10,
    connectionTimeoutMillis: 5000,
    statement_timeout: 15000,
  }));
}
// A checked-out connection is scoped before any tenant SQL and scrubbed before reuse.
// Runtime RLS denies company rows when the context is absent.
export async function tenantConnection(orgId: string): Promise<PoolClient> {
  if (!/^[0-9a-f-]{36}$/i.test(orgId))
    throw new DomainError("Invalid company.", 400);
  const client = await postgres().connect();
  try {
    await client.query("select set_config('neutronium.tenant_id',$1,false)", [
      orgId,
    ]);
  } catch (e) {
    client.release(true);
    throw e;
  }
  const release = client.release.bind(client);
  client.release = () => {
    void client.query("rollback; reset neutronium.tenant_id").then(
      () => release(),
      () => release(true),
    );
  };
  return client;
}
export async function tenantQuery(
  orgId: string,
  sql: string,
  values?: unknown[],
) {
  const client = await tenantConnection(orgId);
  try {
    return await client.query(sql, values);
  } finally {
    client.release();
  }
}
const tables: Record<string, string[]> = {
  neutronium_organizations: ["id"],
  neutronium_memberships: ["organization_id", "user_id"],
  neutronium_platform_members: ["user_id"],
  neutronium_platform_scopes: ["user_id", "organization_id"],
  neutronium_credentials: ["organization_id", "provider"],
  neutronium_oauth_states: ["id"],
};
const identifier = (s: string) => {
  if (!/^[a-z_]+$/.test(s)) throw new Error("Invalid SQL identifier");
  return `"${s}"`;
};
// Small server-only query adapter. Identifiers are validated; every value is bound.
class Query implements PromiseLike<{ data: any; error: unknown }> {
  private columns = "*";
  private filters: string[] = [];
  private values: unknown[] = [];
  private action = "select";
  private record: Record<string, unknown> = {};
  private sorting = "";
  private count = 500;
  private single = false;
  private orgId?: string;
  constructor(private table: string) {
    if (!tables[table]) throw new Error("Unknown table");
  }
  select(columns = "*") {
    this.columns =
      columns === "*" ? "*" : columns.split(",").map(identifier).join(",");
    return this;
  }
  eq(column: string, value: unknown) {
    return this.filter(column, "=", value);
  }
  in(column: string, values: string[]) {
    this.values.push(values);
    this.filters.push(`${identifier(column)} = ANY($${this.values.length})`);
    return this;
  }
  gt(column: string, value: unknown) {
    return this.filter(column, ">", value);
  }
  private filter(column: string, op: string, value: unknown) {
    if (
      op === "=" &&
      (column === "organization_id" ||
        (this.table === "neutronium_organizations" && column === "id"))
    )
      this.orgId = String(value);
    this.values.push(value);
    this.filters.push(`${identifier(column)} ${op} $${this.values.length}`);
    return this;
  }
  order(column: string) {
    this.sorting = ` order by ${identifier(column)}`;
    return this;
  }
  limit(n: number) {
    if (!Number.isInteger(n) || n < 1 || n > 500)
      throw new Error("Invalid limit");
    this.count = n;
    return this;
  }
  maybeSingle() {
    this.single = true;
    return this;
  }
  delete() {
    this.action = "delete";
    return this;
  }
  insert(record: Record<string, unknown>) {
    this.action = "insert";
    this.record = record;
    return this;
  }
  upsert(record: Record<string, unknown>) {
    this.action = "upsert";
    this.record = record;
    return this;
  }
  private async execute() {
    try {
      const table = identifier(this.table);
      const where = this.filters.length
        ? ` where ${this.filters.join(" and ")}`
        : "";
      let sql: string;
      if (this.action === "select")
        sql = `select ${this.columns} from ${table}${where}${this.sorting} limit ${this.count}`;
      else if (this.action === "delete") {
        if (!where) throw new Error("Unfiltered delete denied");
        sql = `delete from ${table}${where} returning ${this.columns}`;
      } else {
        const keys = Object.keys(this.record);
        this.values = keys.map((k) =>
          typeof this.record[k] === "object"
            ? JSON.stringify(this.record[k])
            : this.record[k],
        );
        sql = `insert into ${table} (${keys.map(identifier)}) values (${keys.map((_, i) => `$${i + 1}`)})`;
        if (this.action === "upsert") {
          const updates = keys.filter((k) => !tables[this.table].includes(k));
          sql += ` on conflict (${tables[this.table].map(identifier)}) do update set ${updates.map((k) => `${identifier(k)}=excluded.${identifier(k)}`).join(",")}`;
        }
        sql += ` returning ${this.columns}`;
      }
      const scope =
        this.orgId || (this.record.organization_id as string | undefined);
      const { rows } = scope
        ? await tenantQuery(scope, sql, this.values)
        : await postgres().query(sql, this.values);
      if (this.single && rows.length > 1)
        throw new Error("Expected at most one row");
      return { data: this.single ? rows[0] || null : rows, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }
  then<TResult1 = { data: any; error: unknown }, TResult2 = never>(
    onfulfilled?:
      | ((value: {
          data: any;
          error: unknown;
        }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}
const functions: Record<string, string[]> = {
  neutronium_load: ["p_org"],
  neutronium_create: ["p_state", "p_owner"],
  neutronium_save: ["p_org", "p_revision", "p_state"],
  neutronium_rate_limit: ["p_key", "p_limit", "p_seconds"],
};
export function database() {
  return {
    from: (table: string) => new Query(table),
    async rpc(name: string, args: Record<string, unknown>) {
      if (!functions[name]) throw new Error("Unknown database function");
      try {
        const values = functions[name].map((k) =>
          typeof args[k] === "object" ? JSON.stringify(args[k]) : args[k],
        );
        const scope =
          args.p_org || (args.p_state as { id?: string } | undefined)?.id;
        const sql = `select ${identifier(name)}(${values.map((_, i) => `$${i + 1}`)}) as result`;
        const { rows } = scope
          ? await tenantQuery(String(scope), sql, values)
          : await postgres().query(sql, values);
        return { data: rows[0].result, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
  };
}
