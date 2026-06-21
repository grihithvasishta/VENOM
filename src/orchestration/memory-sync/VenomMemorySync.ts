import { VenomWorkingMemory } from '../../memory/VenomWorkingMemory';
import { VenomProjectMemory } from '../../memory/VenomProjectMemory';
import { VenomLearningMemory } from '../../memory/VenomLearningMemory';
import { VenomKnowledgeGraph } from '../../memory/VenomKnowledgeGraph';

export class VenomMemorySync {
    constructor(
        private workingMemory: VenomWorkingMemory,
        private projectMemory: VenomProjectMemory,
        private learningMemory: VenomLearningMemory,
        private knowledgeGraph: VenomKnowledgeGraph
    ) {}

    syncWorkingContext(role: 'user' | 'assistant' | 'system', content: string) {
        this.workingMemory.addMessage({ role, content });
    }

    syncProjectFile(filepath: string, content: string) {
        this.projectMemory.updateFileStructure(filepath, content);
    }
}
