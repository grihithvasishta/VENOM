import { DatabaseSync } from 'node:sqlite';
import path from 'path';

export class VenomProjectMemory {
    private db: DatabaseSync;

    constructor(dbPath: string = path.join(process.cwd(), 'venom_project_memory.db')) {
        this.db = new DatabaseSync(dbPath);
        this.init();
    }

    private init() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS file_structures (
                path TEXT PRIMARY KEY,
                content TEXT,
                last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS architecture_decisions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                decision TEXT NOT NULL,
                context TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
    }

    updateFileStructure(filePath: string, content: string) {
        const stmt = this.db.prepare(`
            INSERT INTO file_structures (path, content, last_updated) 
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(path) DO UPDATE SET content=excluded.content, last_updated=CURRENT_TIMESTAMP
        `);
        stmt.run(filePath, content);
    }

    getFileStructure(filePath: string): string | null {
        const stmt = this.db.prepare('SELECT content FROM file_structures WHERE path = ?');
        const row = stmt.get(filePath) as any;
        return row ? row.content : null;
    }

    logArchitectureDecision(decision: string, context: string) {
        const stmt = this.db.prepare('INSERT INTO architecture_decisions (decision, context) VALUES (?, ?)');
        stmt.run(decision, context);
    }

    close() {
        this.db.close();
    }
}
