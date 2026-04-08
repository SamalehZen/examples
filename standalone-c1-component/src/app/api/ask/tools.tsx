import { JSONSchema } from "openai/lib/jsonschema.mjs";
import { RunnableToolFunctionWithParse } from "openai/lib/RunnableFunction.mjs";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { tavily } from "@tavily/core";

let tavilyClient: ReturnType<typeof tavily>;
function getTavilyClient() {
  if (!tavilyClient) {
    tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY });
  }
  return tavilyClient;
}

export const tools: [
  RunnableToolFunctionWithParse<{
    searchQuery: string;
  }>,
] = [
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the web for a given query, will return details about anything including business",
      parse: (input) => {
        return JSON.parse(input) as { searchQuery: string };
      },
      parameters: zodToJsonSchema(
        z.object({
          searchQuery: z.string().describe("search query"),
        }),
      ) as JSONSchema,
      function: async ({ searchQuery }: { searchQuery: string }) => {
        const results = await getTavilyClient().search(searchQuery, {
          maxResults: 5,
        });

        return JSON.stringify(results);
      },
      strict: true,
    },
  },
];
