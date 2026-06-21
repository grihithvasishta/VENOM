import { DatabaseSync } from 'node:sqlite';
import path from 'path';

export class VenomLearningMemory {
    private db: DatabaseSync;

    constructor(dbPath: string = path.join(process.cwd(), 'venom_learning_memory.db')) {
        this.db = new DatabaseSync(dbPath);
        this.init();
    }

    private init() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS learned_patterns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pattern_type TEXT NOT NULL,
                pattern_data TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }

    recordPattern(type: string, data: string) {
        const stmt = this.db.prepare('INSERT INTO learned_patterns (pattern_type, pattern_data) VALUES (?, ?)');
        stmt.run(type, data);
    }

    getPatterns(type: string): string[] {
        const stmt = this.db.prepare('SELECT pattern_data FROM learned_patterns WHERE pattern_type = ? ORDER BY id DESC');
        const rows = stmt.all(type) as any[];
        return rows.map(r => r.pattern_data);
    }

    close() {
        this.db.close();
    }
}
