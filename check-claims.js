const Database = require('better-sqlite3');
const db = new Database('data/bot.db');

// Xóa tất cả pending + expired (cleanup DB bị corrupt)
const deleted = db.prepare(
  "DELETE FROM df_claim_sessions WHERE status IN ('pending', 'expired')"
).run();
console.log(`Deleted ${deleted.changes} expired/pending claims`);

// Kiểm tra còn lại
const remaining = db.prepare(
  "SELECT code, discord_user_id, status FROM df_claim_sessions"
).all();
console.log(`Remaining: ${remaining.length} consumed claims`);

db.close();
