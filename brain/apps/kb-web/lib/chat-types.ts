export interface UIMessage {
  id: string;
  role: "user" | "assistant";
  text?: string;
  streaming?: boolean;
  error?: string;
}

export interface SSEEvent {
  type: "text_delta" | "tool_start" | "tool_done" | "done" | "error";
  text?: string;
  name?: string;
  id?: string;
  isError?: boolean;
  message?: string;
}
