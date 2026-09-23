import { handleIconRequest } from "@/lib/templates/icon-service";

export async function POST(request: Request) { return handleIconRequest(request); }
