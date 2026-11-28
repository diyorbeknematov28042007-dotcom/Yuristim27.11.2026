import { AppError } from "@yuristim/errors";

export type YuristimModel = "Lite" | "Pro";
export type ProviderName = "google" | "openai";

export type AIMessage = { role: "user" | "assistant"; content: string };

export type GenerationRequest = {
  modelId: string;
  systemPrompt: string;
  messages: readonly AIMessage[];
  maxOutputTokens: number;
  signal: AbortSignal;
};

export type GenerationResult = {
  text: string;
  providerResponseId: string | null;
  inputUnits: number;
  outputUnits: number;
};

export type StreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "usage"; inputUnits: number; outputUnits: number; providerResponseId: string | null }
  | { type: "completed" };

export interface AIProviderAdapter {
  readonly provider: ProviderName;
  generate(request: GenerationRequest): Promise<GenerationResult>;
  stream(request: GenerationRequest): Promise<ReadableStream<Uint8Array>>;
}

const providerError = (provider: ProviderName, status?: number): AppError => {
  if (status === 429) return new AppError("RATE_LIMITED", `${provider} provider rate limited`);
  return new AppError("SERVICE_UNAVAILABLE", `${provider} provider is unavailable`);
};

const limitedText = (value: unknown): string =>
  typeof value === "string" && value.length <= 100_000 ? value : "";

const usageNumber = (value: unknown): number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;

const fetchProvider = async (
  url: string,
  init: RequestInit,
  provider: ProviderName,
): Promise<Response> => {
  try {
    const response = await fetch(url, init);
    if (!response.ok) throw providerError(provider, response.status);
    return response;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (init.signal?.aborted === true) {
      throw new AppError("SERVICE_UNAVAILABLE", `${provider} request was cancelled`);
    }
    throw providerError(provider);
  }
};

type GoogleInteraction = {
  id?: unknown;
  steps?: Array<{ type?: unknown; content?: Array<{ type?: unknown; text?: unknown }> }>;
  usage?: {
    input_tokens?: unknown;
    output_tokens?: unknown;
    total_tokens?: unknown;
    inputTokenCount?: unknown;
    outputTokenCount?: unknown;
  };
};

const googleText = (body: GoogleInteraction): string => {
  return (body.steps ?? [])
    .filter((step) => step.type === "model_output")
    .flatMap((step) => step.content ?? [])
    .filter((content) => content.type === "text")
    .map((content) => limitedText(content.text))
    .filter(Boolean)
    .join("");
};

export class GeminiInteractionsAdapter implements AIProviderAdapter {
  readonly provider = "google" as const;

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = "https://generativelanguage.googleapis.com/v1beta",
  ) {
    if (apiKey.length < 16)
      throw new AppError("SERVICE_UNAVAILABLE", "Lite provider is not configured");
  }

  private requestBody(request: GenerationRequest, stream: boolean): string {
    return JSON.stringify({
      model: request.modelId,
      system_instruction: request.systemPrompt,
      input: request.messages.map((message) => ({
        type: message.role === "user" ? "user_input" : "model_output",
        content: [{ type: "text", text: message.content }],
      })),
      generation_config: { max_output_tokens: request.maxOutputTokens },
      stream,
      store: false,
    });
  }

  async generate(request: GenerationRequest): Promise<GenerationResult> {
    const response = await fetchProvider(
      `${this.baseUrl}/interactions`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
        body: this.requestBody(request, false),
        signal: request.signal,
      },
      this.provider,
    );
    const body = (await response.json()) as GoogleInteraction;
    const text = googleText(body);
    if (text.length === 0) throw providerError(this.provider);
    const inputUnits = usageNumber(body.usage?.input_tokens ?? body.usage?.inputTokenCount);
    const outputUnits = usageNumber(body.usage?.output_tokens ?? body.usage?.outputTokenCount);
    const totalUnits = usageNumber(body.usage?.total_tokens);
    return {
      text,
      providerResponseId: limitedText(body.id) || null,
      inputUnits: inputUnits + outputUnits > 0 ? inputUnits : totalUnits,
      outputUnits,
    };
  }

  async stream(request: GenerationRequest): Promise<ReadableStream<Uint8Array>> {
    const response = await fetchProvider(
      `${this.baseUrl}/interactions`,
      {
        method: "POST",
        headers: {
          accept: "text/event-stream",
          "content-type": "application/json",
          "x-goog-api-key": this.apiKey,
        },
        body: this.requestBody(request, true),
        signal: request.signal,
      },
      this.provider,
    );
    if (response.body === null) throw providerError(this.provider);
    return response.body;
  }
}

type OpenAIResponse = {
  id?: unknown;
  output_text?: unknown;
  output?: Array<{ content?: Array<{ type?: unknown; text?: unknown }> }>;
  usage?: { input_tokens?: unknown; output_tokens?: unknown };
};

const openAIText = (body: OpenAIResponse): string => {
  const direct = limitedText(body.output_text);
  if (direct) return direct;
  return (body.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text")
    .map((item) => limitedText(item.text))
    .join("");
};

export class OpenAIResponsesAdapter implements AIProviderAdapter {
  readonly provider = "openai" as const;

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = "https://api.openai.com/v1",
  ) {
    if (apiKey.length < 16)
      throw new AppError("SERVICE_UNAVAILABLE", "Pro provider is not configured");
  }

  private requestBody(request: GenerationRequest, stream: boolean): string {
    return JSON.stringify({
      model: request.modelId,
      instructions: request.systemPrompt,
      input: request.messages.map((message) => ({ role: message.role, content: message.content })),
      max_output_tokens: request.maxOutputTokens,
      stream,
      store: false,
    });
  }

  async generate(request: GenerationRequest): Promise<GenerationResult> {
    const response = await fetchProvider(
      `${this.baseUrl}/responses`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
        },
        body: this.requestBody(request, false),
        signal: request.signal,
      },
      this.provider,
    );
    const body = (await response.json()) as OpenAIResponse;
    const text = openAIText(body);
    if (text.length === 0) throw providerError(this.provider);
    return {
      text,
      providerResponseId: limitedText(body.id) || null,
      inputUnits: usageNumber(body.usage?.input_tokens),
      outputUnits: usageNumber(body.usage?.output_tokens),
    };
  }

  async stream(request: GenerationRequest): Promise<ReadableStream<Uint8Array>> {
    const response = await fetchProvider(
      `${this.baseUrl}/responses`,
      {
        method: "POST",
        headers: {
          accept: "text/event-stream",
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
        },
        body: this.requestBody(request, true),
        signal: request.signal,
      },
      this.provider,
    );
    if (response.body === null) throw providerError(this.provider);
    return response.body;
  }
}

export const createProviderAdapter = (input: {
  provider: ProviderName;
  googleApiKey?: string;
  openAIApiKey?: string;
  googleBaseUrl?: string;
  openAIBaseUrl?: string;
}): AIProviderAdapter => {
  if (input.provider === "google") {
    return new GeminiInteractionsAdapter(input.googleApiKey ?? "", input.googleBaseUrl);
  }
  return new OpenAIResponsesAdapter(input.openAIApiKey ?? "", input.openAIBaseUrl);
};

export const safetyNotice =
  "Bu javob Stage 08 rasmiy huquqiy manba tekshiruvidan o'tmagan. Muhim qaror oldidan rasmiy manbani tekshiring yoki yurist bilan maslahatlashing.";

export const assertSafeUserContent = (content: string): void => {
  if (content.includes("\u0000")) throw new AppError("VALIDATION_ERROR", "Invalid message content");
  const normalized = content.normalize("NFKC").toLowerCase();
  const highRisk = [
    "reveal system prompt",
    "print system prompt",
    "ignore all previous instructions",
    "maxfiy api kalit",
    "boshqa foydalanuvchi ma'lumot",
  ];
  if (highRisk.some((pattern) => normalized.includes(pattern))) {
    throw new AppError("FORBIDDEN", "Unsafe instruction was blocked");
  }
};

export const sseFrame = (event: string, data: unknown): Uint8Array =>
  new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

export const parseProviderSseEvent = (provider: ProviderName, data: string): StreamEvent | null => {
  if (data === "[DONE]") return { type: "completed" };
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(data) as Record<string, unknown>;
  } catch {
    throw new AppError("SERVICE_UNAVAILABLE", `${provider} returned an invalid stream event`);
  }
  const type =
    typeof body.event_type === "string"
      ? body.event_type
      : typeof body.type === "string"
        ? body.type
        : "";
  if (provider === "google") {
    if (type === "step.delta") {
      const delta = body.delta as Record<string, unknown> | undefined;
      const text = limitedText(delta?.text ?? body.text);
      return text ? { type: "text_delta", text } : null;
    }
    if (type === "interaction.completed") {
      const interaction = (body.interaction ?? body) as GoogleInteraction;
      const inputUnits = usageNumber(
        interaction.usage?.input_tokens ?? interaction.usage?.inputTokenCount,
      );
      const outputUnits = usageNumber(
        interaction.usage?.output_tokens ?? interaction.usage?.outputTokenCount,
      );
      const totalUnits = usageNumber(interaction.usage?.total_tokens);
      return {
        type: "usage",
        inputUnits: inputUnits + outputUnits > 0 ? inputUnits : totalUnits,
        outputUnits,
        providerResponseId: limitedText(interaction.id) || null,
      };
    }
  } else {
    if (type === "response.output_text.delta") {
      const text = limitedText(body.delta);
      return text ? { type: "text_delta", text } : null;
    }
    if (type === "response.completed") {
      const response = (body.response ?? body) as OpenAIResponse;
      return {
        type: "usage",
        inputUnits: usageNumber(response.usage?.input_tokens),
        outputUnits: usageNumber(response.usage?.output_tokens),
        providerResponseId: limitedText(response.id) || null,
      };
    }
  }
  if (type === "error" || type.endsWith(".failed")) throw providerError(provider);
  return null;
};
