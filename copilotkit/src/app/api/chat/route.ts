import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import OpenAI from "openai";

import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export const POST = async (req: NextRequest) => {
  const openai = new OpenAI({
    baseURL: "https://api.thesys.dev/v1/embed",
    apiKey: process.env.THESYS_API_KEY,
  });
  const serviceAdapter = new OpenAIAdapter({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    openai: openai as any,
    model: "c1/anthropic/claude-sonnet-4.6/v-20260331",
  });
  const runtime = new CopilotRuntime();

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: "/api/chat",
  });

  return handleRequest(req);
};
