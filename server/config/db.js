const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('./config');

let dbInstance = null;

function getDb(customPath = null) {
  if (customPath) {
    const dir = customPath !== ':memory:' ? path.dirname(customPath) : null;
    if (dir && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const db = new Database(customPath);
    db.pragma('foreign_keys = ON');
    if (customPath !== ':memory:') {
      db.pragma('journal_mode = WAL');
    }
    dbInstance = db;
    return dbInstance;
  }

  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = config.dbPath;
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  dbInstance = db;

  return dbInstance;
}

function setDb(db) {
  dbInstance = db;
}

function closeDb() {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch (e) {
      // ignore
    }
    dbInstance = null;
  }
}

module.exports = {
  getDb,
  setDb,
  closeDb,
};
