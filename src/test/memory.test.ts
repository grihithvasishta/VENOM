import test from 'node:test';
import assert from 'node:assert';
import { VenomWorkingMemory } from '../memory/VenomWorkingMemory';
import { VenomProjectMemory } from '../memory/VenomProjectMemory';
import { VenomLearningMemory } from '../memory/VenomLearningMemory';
import { VenomKnowledgeGraph } from '../memory/VenomKnowledgeGraph';
import fs from 'fs';
import path from 'path';

test('VenomWorkingMemory Tests', (t) => {
    const dbPath = path.join(process.cwd(), 'test_working_memory.db');
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    
    const wm = new VenomWorkingMemory(dbPath);
    
    wm.addMessage({ role: 'user', content: 'hello' });
    wm.addMessage({ role: 'assistant', content: 'hi' });
    
    const ctx = wm.getRecentContext();
    assert.strictEqual(ctx.length, 2);
    assert.strictEqual(ctx[0].content, 'hello');
    assert.strictEqual(ctx[1].content, 'hi');
    
    wm.clear();
    assert.strictEqual(wm.getRecentContext().length, 0);
    
    wm.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
});

test('VenomProjectMemory Tests', (t) => {
    const dbPath = path.join(process.cwd(), 'test_project_memory.db');
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    
    const pm = new VenomProjectMemory(dbPath);
    
    pm.updateFileStructure('/src/index.ts', 'console.log("test");');
    pm.updateFileStructure('/src/index.ts', 'console.log("updated");'); // Test conflict resolution
    
    const content = pm.getFileStructure('/src/index.ts');
    assert.strictEqual(content, 'console.log("updated");');
    
    const missing = pm.getFileStructure('/does/not/exist.ts');
    assert.strictEqual(missing, null);
    
    pm.logArchitectureDecision('Use SQLite', 'Need fast local memory');
    // Basic coverage check for logArchitectureDecision
    
    pm.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
});

test('VenomLearningMemory Tests', (t) => {
    const dbPath = path.join(process.cwd(), 'test_learning_memory.db');
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    
    const lm = new VenomLearningMemory(dbPath);
    
    lm.recordPattern('system_preference', 'Always use double quotes');
    lm.recordPattern('system_preference', 'Prefer async/await');
    
    const patterns = lm.getPatterns('system_preference');
    assert.strictEqual(patterns.length, 2);
    assert.strictEqual(patterns[0], 'Prefer async/await'); // Checks DESC ordering
    
    const empty = lm.getPatterns('unknown');
    assert.strictEqual(empty.length, 0);
    
    lm.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
});

test('VenomKnowledgeGraph Tests', (t) => {
    const dbPath = path.join(process.cwd(), 'test_knowledge_graph.db');
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    
    const kg = new VenomKnowledgeGraph(dbPath);
    
    kg.addNode({ id: 'N1', type: 'Component', data: { name: 'Router' }});
    kg.addNode({ id: 'N2', type: 'Component', data: { name: 'Orchestrator' }});
    
    kg.addEdge({ source: 'N2', target: 'N1', relation: 'DEPENDS_ON' });
    
    const rels = kg.getRelatedNodes('N2');
    assert.strictEqual(rels.length, 1);
    assert.strictEqual(rels[0].id, 'N1');
    assert.strictEqual(rels[0].relation, 'DEPENDS_ON');
    assert.deepStrictEqual(rels[0].data, { name: 'Router' });
    
    const emptyRels = kg.getRelatedNodes('N1');
    assert.strictEqual(emptyRels.length, 0);
    
    kg.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
});
