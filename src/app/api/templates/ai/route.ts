import { handleAiRequest } from "@/lib/templates/ai-service";

export async function POST(request: Request) { return handleAiRequest(request); }
