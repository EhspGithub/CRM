// SQLite schema of Nasim Rahayi.
//
// Every "store" of the original app (patients, visits, ...) is one table. The complete record is kept as
// JSON in `data` (so no field the UI writes is ever lost), and the fields the app searches, joins or
// sorts on are also kept in real, indexed columns (patient_id, code, national_id, date, ...).
// Columns are derived from the record on every write, so they can never drift from `data`.

const str = (v) => (v === undefined || v === null || v === "" ? null : String(v));
const int = (v) => {
  const n = parseInt(String(v ?? "").trim(), 10);
  return Number.isFinite(n) ? n : null;
};

const patientRef = { patient_id: (r) => str(r.patientId) };
const dated = { date: (r) => str(r.date) };

/** store name (as used by the UI) -> table + extra indexed columns */
export const STORES = {
  patients: {
    table: "patients",
    columns: {
      code: (r) => int(r.code),
      national_id: (r) => str(r.nationalId),
      full_name: (r) => str(r.fullName || [r.name, r.lastname].filter(Boolean).join(" ")),
      status: (r) => str(r.status),
      current_drug: (r) => str(r.currentDrug),
    },
  },
  visits: { table: "visits", columns: { ...patientRef, ...dated } },
  contactLogs: { table: "contact_logs", columns: { ...patientRef, ...dated } },
  insuranceHistory: { table: "insurance_history", columns: { ...patientRef, ...dated } },
  auditLogs: { table: "audit_logs", columns: { ...patientRef, ...dated, field_name: (r) => str(r.fieldName) } },
  patientReviews: { table: "patient_reviews", columns: { ...patientRef, ...dated } },
  backupHistory: { table: "backup_history", columns: { ...dated, kind: (r) => str(r.type) } },
  mergeConflictLog: { table: "merge_conflict_log", columns: { store_key: (r) => str(r.storeKey), record_id: (r) => str(r.recordId) } },
  opiumMembers: { table: "opium_members", columns: { ...patientRef, active: (r) => (r.active ? 1 : 0) } },
  opiumPlans: { table: "opium_plans", columns: { ...patientRef } },
  opiumDeliveries: { table: "opium_deliveries", columns: { ...patientRef, ...dated, status: (r) => str(r.status) } },
  opiumPeriods: { table: "opium_periods", columns: { start_date: (r) => str(r.startDate) } },
  settings: { table: "settings", columns: {} },
  staff: { table: "staff", columns: {} },
};

const INDEXES = {
  patients: ["code", "national_id", "status"],
  visits: ["patient_id", "date"],
  contact_logs: ["patient_id"],
  insurance_history: ["patient_id"],
  audit_logs: ["patient_id"],
  patient_reviews: ["patient_id", "date"],
  opium_members: ["patient_id"],
  opium_plans: ["patient_id"],
  opium_deliveries: ["patient_id", "date"],
};

function tableDdl({ table, columns }) {
  const extra = Object.keys(columns).map((c) => `  ${c} ${c === "code" || c === "active" ? "INTEGER" : "TEXT"},`);
  return [
    `CREATE TABLE IF NOT EXISTS ${table} (`,
    "  id TEXT PRIMARY KEY NOT NULL,",
    ...extra,
    "  data TEXT NOT NULL CHECK (json_valid(data)),",
    "  updated_at INTEGER NOT NULL",
    ") WITHOUT ROWID",
  ].join("\n");
}

// Rows are read back ORDER BY id, which is exactly the order the original IndexedDB version returned
// them in (IndexedDB getAll() is sorted by key), so the UI behaves identically.

/**
 * Ordered migrations; index i brings the database to user_version i + 1. Never edit a shipped
 * migration — append a new one.
 */
export const MIGRATIONS = [
  [
    ...Object.values(STORES).map(tableDdl),
    ...Object.entries(INDEXES).flatMap(([table, cols]) =>
      cols.map((c) => `CREATE INDEX IF NOT EXISTS idx_${table}_${c} ON ${table}(${c})`),
    ),
  ],
];

export const SCHEMA_VERSION = MIGRATIONS.length;
