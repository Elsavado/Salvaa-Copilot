import { useSettingsStore } from '../stores/settingsStore';

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ClaudeResponse {
  content: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export class ClaudeClient {
  private apiKey: string;
  private model: string;
  private baseUrl = 'https://api.anthropic.com/v1/messages';

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async sendMessage(
    messages: ClaudeMessage[],
    systemPrompt?: string
  ): Promise<ClaudeResponse> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 4096,
          system: systemPrompt,
          messages: messages
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Claude API error: ${response.status} - ${errorData}`);
      }

      const data = await response.json();
      
      return {
        content: data.content[0].text,
        model: data.model,
        usage: {
          inputTokens: data.usage?.input_tokens || 0,
          outputTokens: data.usage?.output_tokens || 0
        }
      };
    } catch (error) {
      console.error('Claude API call failed:', error);
      throw error;
    }
  }

  async generateAnswer(
    question: string,
    cvData: string,
    jobDescription?: string,
    context?: string
  ): Promise<string> {
    const systemPrompt = `You are the candidate in a job interview. Here is their CV/resume:

${cvData}

${jobDescription ? `The job description is:
${jobDescription}` : ''}

${context ? `Additional context:
${context}` : ''}

Answer interview questions as the candidate would, in first person, using their real experience from the CV. Be conversational, concise, and natural. Do not mention being an AI. Use specific examples from the candidate's background.`;

    const response = await this.sendMessage([
      {
        role: 'user',
        content: `The interviewer just asked: "${question}"

Answer as the candidate would, in first person, using their real experience. Be conversational, concise, and natural.`
      }
    ], systemPrompt);

    return response.content;
  }

  async generateCodingAnswer(
    question: string,
    language: string,
    cvData: string
  ): Promise<string> {
    const systemPrompt = `You are a software engineer in a technical interview. Here is their CV/resume:

${cvData}

Answer coding questions with:
1. Brief explanation of approach
2. Clean, well-commented code in ${language}
3. Time and space complexity analysis
4. Alternative approaches if relevant

Be thorough but concise.`;

    const response = await this.sendMessage([
      {
        role: 'user',
        content: `Solve this coding problem in ${language}:

${question}

Provide the solution with explanation, code, and complexity analysis.`
      }
    ], systemPrompt);

    return response.content;
  }

  async generateBehavioralAnswer(
    question: string,
    cvData: string
  ): Promise<string> {
    const systemPrompt = `You are the candidate in a behavioral interview. Here is their CV/resume:

${cvData}

Answer behavioral questions using the STAR method (Situation, Task, Action, Result) with specific examples from the candidate's experience. Be authentic and conversational.`;

    const response = await this.sendMessage([
      {
        role: 'user',
        content: `Answer this behavioral interview question using the STAR method:

"${question}"

Use specific examples from the candidate's experience.`
      }
    ], systemPrompt);

    return response.content;
  }
}

export const createClaudeClient = (): ClaudeClient | null => {
  const settings = useSettingsStore.getState().settings;
  
  if (!settings.anthropicApiKey) {
    console.error('Anthropic API key not configured');
    return null;
  }

  return new ClaudeClient(settings.anthropicApiKey, settings.aiModel);
};
