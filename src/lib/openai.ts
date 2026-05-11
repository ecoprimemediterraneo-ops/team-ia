import OpenAI from "openai";

let _client: OpenAI | null = null;
export const openai = new Proxy({} as OpenAI, {
  get(_, prop) {
    if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    // @ts-expect-error proxy passthrough
    return _client[prop];
  },
});
