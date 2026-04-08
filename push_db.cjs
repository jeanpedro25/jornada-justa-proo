const { Client } = require('pg');
const fs = require('fs');

const client = new Client({
  connectionString: "postgresql://postgres:Jean99533713*@db.kbqhlkkcjsjohwdcygvn.supabase.co:5432/postgres",
});

async function run() {
  try {
    await client.connect();
    const sql = fs.readFileSync('migrations_all.sql', 'utf8');
    await client.query(sql);
    console.log("Migration successful");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

run();
