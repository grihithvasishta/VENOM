import { DatabaseSync } from 'node:sqlite';
import { VenomMessage } from '../shared/types';
import path from 'path';

export class VenomWorkingMemory {
    private db: DatabaseSync;

    constructor(dbPath: string = path.join(process.cwd(), 'venom_working_memory.db')) {
        this.db = new DatabaseSync(dbPath);
        this.init();
    }

    private init() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS working_context (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }

    addMessage(msg: VenomMessage) {
        const stmt = this.db.prepare('INSERT INTO working_context (role, content) VALUES (?, ?)');
        stmt.run(msg.role, msg.content);
    }

    getRecentContext(limit: number = 20): VenomMessage[] {
        const stmt = this.db.prepare('SELECT role, content FROM working_context ORDER BY id DESC LIMIT ?');
        const rows = stmt.all(limit) as any[];
        return rows.reverse().map(row => ({ role: row.role as any, content: row.content }));
    }

    clear() {
        this.db.exec('DELETE FROM working_context');
    }

    close() {
        this.db.close();
    }
}
