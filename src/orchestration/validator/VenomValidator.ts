import { VenomAgentRegistry } from '../../agents/VenomAgentRegistry';

export class VenomValidator {
    constructor(private registry: VenomAgentRegistry) {}

    async validate(result: string, requirements: string): Promise<{ isValid: boolean, feedback?: string }> {
        const validator = this.registry.getAgent('MultiPurposeAgent');
        if (!validator) throw new Error('Validator Agent not found');

        const prompt = `Validate the following result against the requirements.\nRequirements: ${requirements}\nResult: ${result}\nOutput ONLY 'VALID' or 'INVALID: <reason>'`;
        const validation = await validator.execute(prompt);
        const normalizedValidation = validation.trim();

        if (normalizedValidation === 'VALID') {
            return { isValid: true };
        }

        if (normalizedValidation.startsWith('INVALID:')) {
            return { isValid: false, feedback: normalizedValidation.replace('INVALID:', '').trim() };
        }

        return {
            isValid: false,
            feedback: `Validator returned an unsupported response: ${normalizedValidation}`
        };
    }
}
