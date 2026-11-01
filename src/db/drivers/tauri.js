// Native driver: forwards SQL to the Rust side (rusqlite, one connection, file in the app data folder).
// Rust owns transactions for batch() and reports whether a transaction is already open.
import { invoke } from "@tauri-apps/api/core";

export function createTauriDriver() {
  return {
    kind: "tauri",
    execute(sql, params = []) {
      return invoke("db_execute", { sql, params });
    },
    select(sql, params = []) {
      return invoke("db_select", { sql, params });
    },
    batch(statements) {
      return invoke("db_batch", { statements: statements.map((s) => ({ sql: s.sql, params: s.params || [] })) });
    },
    info() {
      return invoke("db_info");
    },
    // rolls back a transaction left open if the previous UI session was reloaded/crashed mid-transaction
    recover() {
      return invoke("db_recover");
    },
  };
}
