import { DatabaseSync } from 'node:sqlite';
import path from 'path';

export interface GraphNode {
    id: string;
    type: string;
    data: any;
}

export interface GraphEdge {
    source: string;
    target: string;
    relation: string;
}

export class VenomKnowledgeGraph {
    private db: DatabaseSync;

    constructor(dbPath: string = path.join(process.cwd(), 'venom_knowledge_graph.db')) {
        this.db = new DatabaseSync(dbPath);
        this.init();
    }

    private init() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS nodes (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                data TEXT
            );
            CREATE TABLE IF NOT EXISTS edges (
                source TEXT,
                target TEXT,
                relation TEXT,
                PRIMARY KEY (source, target, relation),
                FOREIGN KEY(source) REFERENCES nodes(id),
                FOREIGN KEY(target) REFERENCES nodes(id)
            );
        `);
    }

    addNode(node: GraphNode) {
        const stmt = this.db.prepare('INSERT OR REPLACE INTO nodes (id, type, data) VALUES (?, ?, ?)');
        stmt.run(node.id, node.type, JSON.stringify(node.data));
    }

    addEdge(edge: GraphEdge) {
        const stmt = this.db.prepare('INSERT OR REPLACE INTO edges (source, target, relation) VALUES (?, ?, ?)');
        stmt.run(edge.source, edge.target, edge.relation);
    }

    getRelatedNodes(nodeId: string): any[] {
        const stmt = this.db.prepare(`
            SELECT n.id, n.type, n.data, e.relation 
            FROM nodes n
            JOIN edges e ON n.id = e.target
            WHERE e.source = ?
        `);
        const rows = stmt.all(nodeId) as any[];
        return rows.map(r => ({
            id: r.id,
            type: r.type,
            data: JSON.parse(r.data),
            relation: r.relation
        }));
    }

    close() {
        this.db.close();
    }
}
