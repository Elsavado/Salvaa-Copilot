import Anthropic from '@anthropic-ai/sdk';

export class ClaudeService {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string = 'claude-haiku-4-5-20251001') {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  /**
   * Universal streaming method for interview responses.
   */
  async streamResponse(
    systemPrompt: string,
    userContent: string,
    onToken: (token: string) => void
  ): Promise<void> {
    const stream = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
      stream: true,
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        onToken(chunk.delta.text);
      }
    }
  }

  // --- Prompt Templates ---

  getInterviewSystemPrompt(cvData: string, preflightData: string): string {
    return `You are Salvaaa Copilot, an elite technical interview assistant. 
Candidate Background: ${cvData || 'None'}
Company/Role Details: ${preflightData || 'None'}

CRITICAL DIRECTIONS:
1. Provide highly practical, scannable, structural bullet points or short code blocks.
2. Keep text to the absolute minimum required to be helpful under pressure.
3. Ignore casual filler speech or irrelevant fragments in the transcript.`;
  }

  getCodingSystemPrompt(cvData: string, language: string): string {
    return `You are a software engineer in a technical interview. CV: ${cvData}.
Solve coding questions with:
1. Brief approach explanation.
2. Clean, commented code in ${language}.
3. Time/space complexity analysis.
Keep it thorough but concise.`;
  }

  getBehavioralSystemPrompt(cvData: string): string {
    return `You are the candidate. CV: ${cvData}.
Answer behavioral questions using the STAR method (Situation, Task, Action, Result). 
Be authentic, conversational, and use specific examples from the CV.`;
  }
}
