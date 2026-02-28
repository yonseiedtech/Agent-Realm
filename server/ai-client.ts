import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI, type Part, type FunctionDeclaration, SchemaType } from "@google/generative-ai";
import { storage } from "./storage";

// ─── Types ───────────────────────────────────────────────────────

export type Provider = "anthropic" | "openai" | "google";

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  model: string;
  maxTokens: number;
  temperature: number;
  system: string;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
}

export interface ToolCall {
  id: string;
  name: string;
  input: any;
}

export interface ChatResponse {
  content: string;
  stopReason: "end_turn" | "tool_use";
  toolCalls?: ToolCall[];
}

// ─── Provider Detection ──────────────────────────────────────────

export function getProvider(model: string): Provider {
  if (model.startsWith("gpt-") || model.startsWith("o1") || model.startsWith("o3") || model.startsWith("o4")) return "openai";
  if (model.startsWith("gemini-")) return "google";
  return "anthropic";
}

// ─── Client Factories ────────────────────────────────────────────

async function getAnthropicClient(): Promise<Anthropic> {
  const customApiKey = await storage.getSetting("custom_api_key");
  const customBaseUrl = await storage.getSetting("custom_base_url");
  const apiKey = customApiKey || process.env.ANTHROPIC_API_KEY;
  const baseURL = customBaseUrl || undefined;
  if (!apiKey) throw new Error("Anthropic API 키가 설정되지 않았습니다. 글로벌 설정에서 API 키를 입력해주세요.");
  return new Anthropic({ apiKey, baseURL });
}

async function getOpenAIClient(): Promise<OpenAI> {
  const apiKey = await storage.getSetting("openai_api_key");
  if (!apiKey) throw new Error("OpenAI API 키가 설정되지 않았습니다. 글로벌 설정에서 API 키를 입력해주세요.");
  return new OpenAI({ apiKey });
}

async function getGoogleClient(): Promise<GoogleGenerativeAI> {
  const apiKey = await storage.getSetting("google_api_key");
  if (!apiKey) throw new Error("Google Gemini API 키가 설정되지 않았습니다. 글로벌 설정에서 API 키를 입력해주세요.");
  return new GoogleGenerativeAI(apiKey);
}

// ─── Tool Format Converters ──────────────────────────────────────

function toOpenAITools(tools: ToolDefinition[]): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return tools.map(t => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: t.input_schema.type,
        properties: t.input_schema.properties,
        required: t.input_schema.required || [],
      },
    },
  }));
}

function convertSchemaType(type: string): SchemaType {
  switch (type) {
    case "string": return SchemaType.STRING;
    case "number": return SchemaType.NUMBER;
    case "integer": return SchemaType.INTEGER;
    case "boolean": return SchemaType.BOOLEAN;
    case "array": return SchemaType.ARRAY;
    case "object": return SchemaType.OBJECT;
    default: return SchemaType.STRING;
  }
}

function convertProperties(properties: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(properties)) {
    const prop: any = {
      type: convertSchemaType(value.type || "string"),
    };
    if (value.description) prop.description = value.description;
    if (value.enum) prop.enum = value.enum;
    result[key] = prop;
  }
  return result;
}

function toGeminiFunctionDeclarations(tools: ToolDefinition[]): FunctionDeclaration[] {
  return tools.map(t => ({
    name: t.name,
    description: t.description,
    parameters: {
      type: SchemaType.OBJECT,
      properties: convertProperties(t.input_schema.properties),
      required: t.input_schema.required || [],
    },
  }));
}

// ─── Anthropic Implementation ────────────────────────────────────

async function chatAnthropic(req: ChatRequest): Promise<ChatResponse> {
  const client = await getAnthropicClient();

  const anthropicTools: Anthropic.Tool[] | undefined = req.tools?.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: {
      type: "object" as const,
      properties: t.input_schema.properties,
      required: t.input_schema.required || [],
    },
  }));

  const response = await client.messages.create({
    model: req.model,
    max_tokens: req.maxTokens,
    temperature: req.temperature,
    system: req.system,
    tools: anthropicTools,
    messages: req.messages.map(m => ({ role: m.role, content: m.content })),
  });

  const textBlocks = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text");
  const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");

  return {
    content: textBlocks.map(b => b.text).join(""),
    stopReason: response.stop_reason === "tool_use" ? "tool_use" : "end_turn",
    toolCalls: toolUseBlocks.length > 0
      ? toolUseBlocks.map(b => ({ id: b.id, name: b.name, input: b.input }))
      : undefined,
  };
}

// ─── OpenAI Implementation ───────────────────────────────────────

async function chatOpenAI(req: ChatRequest): Promise<ChatResponse> {
  const client = await getOpenAIClient();

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: req.system },
    ...req.messages.map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
    model: req.model,
    max_tokens: req.maxTokens,
    temperature: req.temperature,
    messages,
  };

  if (req.tools && req.tools.length > 0) {
    params.tools = toOpenAITools(req.tools);
  }

  const response = await client.chat.completions.create(params);
  const choice = response.choices[0];
  const message = choice.message;

  const toolCalls = message.tool_calls
    ?.filter((tc: any) => tc.type === "function")
    ?.map((tc: any) => ({
      id: tc.id,
      name: tc.function.name,
      input: JSON.parse(tc.function.arguments),
    }));

  return {
    content: message.content || "",
    stopReason: choice.finish_reason === "tool_calls" ? "tool_use" : "end_turn",
    toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
  };
}

// ─── Google Gemini Implementation ────────────────────────────────

async function chatGoogle(req: ChatRequest): Promise<ChatResponse> {
  const client = await getGoogleClient();
  const model = client.getGenerativeModel({
    model: req.model,
    systemInstruction: req.system,
    generationConfig: {
      maxOutputTokens: req.maxTokens,
      temperature: req.temperature,
    },
    tools: req.tools && req.tools.length > 0
      ? [{ functionDeclarations: toGeminiFunctionDeclarations(req.tools) }]
      : undefined,
  });

  // Build conversation history for Gemini format
  const geminiHistory: Array<{ role: "user" | "model"; parts: Part[] }> = [];
  for (const msg of req.messages.slice(0, -1)) {
    geminiHistory.push({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    });
  }

  const lastMessage = req.messages[req.messages.length - 1];
  const chat = model.startChat({ history: geminiHistory });
  const result = await chat.sendMessage(lastMessage.content);
  const response = result.response;

  const parts = response.candidates?.[0]?.content?.parts || [];
  let text = "";
  const toolCalls: ToolCall[] = [];

  for (const part of parts) {
    if (part.text) {
      text += part.text;
    }
    if (part.functionCall) {
      toolCalls.push({
        id: `gemini_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: part.functionCall.name,
        input: part.functionCall.args || {},
      });
    }
  }

  return {
    content: text,
    stopReason: toolCalls.length > 0 ? "tool_use" : "end_turn",
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
  };
}

// ─── Unified Entry Point ─────────────────────────────────────────

export async function chatCompletion(req: ChatRequest): Promise<ChatResponse> {
  const provider = getProvider(req.model);
  switch (provider) {
    case "anthropic": return chatAnthropic(req);
    case "openai":    return chatOpenAI(req);
    case "google":    return chatGoogle(req);
  }
}

// ─── Tool result continuation (for tool use loops) ───────────────

export interface ToolResultContinuation {
  model: string;
  maxTokens: number;
  temperature: number;
  system: string;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  toolResults: Array<{ toolCallId: string; name: string; result: string }>;
  previousResponse: ChatResponse;
}

export async function continueWithToolResults(req: ToolResultContinuation): Promise<ChatResponse> {
  const provider = getProvider(req.model);

  switch (provider) {
    case "anthropic":
      return continueAnthropic(req);
    case "openai":
      return continueOpenAI(req);
    case "google":
      return continueGoogle(req);
  }
}

async function continueAnthropic(req: ToolResultContinuation): Promise<ChatResponse> {
  const client = await getAnthropicClient();
  const anthropicTools: Anthropic.Tool[] | undefined = req.tools?.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: {
      type: "object" as const,
      properties: t.input_schema.properties,
      required: t.input_schema.required || [],
    },
  }));

  // Reconstruct Anthropic-style content blocks for the assistant message
  const assistantContentBlocks: any[] = [];
  if (req.previousResponse.content) {
    assistantContentBlocks.push({ type: "text", text: req.previousResponse.content });
  }
  if (req.previousResponse.toolCalls) {
    for (const tc of req.previousResponse.toolCalls) {
      assistantContentBlocks.push({
        type: "tool_use",
        id: tc.id,
        name: tc.name,
        input: tc.input,
      });
    }
  }

  const toolResultBlocks: Anthropic.ToolResultBlockParam[] = req.toolResults.map(tr => ({
    type: "tool_result" as const,
    tool_use_id: tr.toolCallId,
    content: tr.result,
  }));

  const messages: Anthropic.MessageParam[] = [
    ...req.messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "assistant" as const, content: assistantContentBlocks },
    { role: "user" as const, content: toolResultBlocks },
  ];

  const response = await client.messages.create({
    model: req.model,
    max_tokens: req.maxTokens,
    temperature: req.temperature,
    system: req.system,
    tools: anthropicTools,
    messages,
  });

  const textBlocks = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text");
  const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");

  return {
    content: textBlocks.map(b => b.text).join(""),
    stopReason: response.stop_reason === "tool_use" ? "tool_use" : "end_turn",
    toolCalls: toolUseBlocks.length > 0
      ? toolUseBlocks.map(b => ({ id: b.id, name: b.name, input: b.input }))
      : undefined,
  };
}

async function continueOpenAI(req: ToolResultContinuation): Promise<ChatResponse> {
  const client = await getOpenAIClient();

  // Build assistant message with tool calls
  const assistantToolCalls = (req.previousResponse.toolCalls || []).map(tc => ({
    id: tc.id,
    type: "function" as const,
    function: { name: tc.name, arguments: JSON.stringify(tc.input) },
  })) as any;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: req.system },
    ...req.messages.map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    {
      role: "assistant" as const,
      content: req.previousResponse.content || null,
      tool_calls: assistantToolCalls,
    },
    ...req.toolResults.map(tr => ({
      role: "tool" as const,
      tool_call_id: tr.toolCallId,
      content: tr.result,
    })),
  ];

  const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
    model: req.model,
    max_tokens: req.maxTokens,
    temperature: req.temperature,
    messages,
  };

  if (req.tools && req.tools.length > 0) {
    params.tools = toOpenAITools(req.tools);
  }

  const response = await client.chat.completions.create(params);
  const choice = response.choices[0];
  const message = choice.message;

  const toolCalls = message.tool_calls
    ?.filter((tc: any) => tc.type === "function")
    ?.map((tc: any) => ({
      id: tc.id,
      name: tc.function.name,
      input: JSON.parse(tc.function.arguments),
    }));

  return {
    content: message.content || "",
    stopReason: choice.finish_reason === "tool_calls" ? "tool_use" : "end_turn",
    toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
  };
}

async function continueGoogle(req: ToolResultContinuation): Promise<ChatResponse> {
  const client = await getGoogleClient();
  const model = client.getGenerativeModel({
    model: req.model,
    systemInstruction: req.system,
    generationConfig: {
      maxOutputTokens: req.maxTokens,
      temperature: req.temperature,
    },
    tools: req.tools && req.tools.length > 0
      ? [{ functionDeclarations: toGeminiFunctionDeclarations(req.tools) }]
      : undefined,
  });

  // Build history including previous messages + model response + function results
  const geminiHistory: Array<{ role: "user" | "model"; parts: Part[] }> = [];
  for (const msg of req.messages) {
    geminiHistory.push({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    });
  }

  // Add model's previous response with function calls
  const modelParts: Part[] = [];
  if (req.previousResponse.content) {
    modelParts.push({ text: req.previousResponse.content });
  }
  if (req.previousResponse.toolCalls) {
    for (const tc of req.previousResponse.toolCalls) {
      modelParts.push({
        functionCall: { name: tc.name, args: tc.input },
      });
    }
  }
  geminiHistory.push({ role: "model", parts: modelParts });

  // Send function responses
  const functionResponseParts: Part[] = req.toolResults.map(tr => ({
    functionResponse: {
      name: tr.name,
      response: { result: tr.result },
    },
  }));

  const chat = model.startChat({ history: geminiHistory });
  const result = await chat.sendMessage(functionResponseParts);
  const response = result.response;

  const parts = response.candidates?.[0]?.content?.parts || [];
  let text = "";
  const toolCalls: ToolCall[] = [];

  for (const part of parts) {
    if (part.text) {
      text += part.text;
    }
    if (part.functionCall) {
      toolCalls.push({
        id: `gemini_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: part.functionCall.name,
        input: part.functionCall.args || {},
      });
    }
  }

  return {
    content: text,
    stopReason: toolCalls.length > 0 ? "tool_use" : "end_turn",
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
  };
}
