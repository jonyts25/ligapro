import { renderLigaProIcon } from "@/lib/branding/icon-image";

export const runtime = "edge";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const maskable = searchParams.get("maskable") === "1";

  return renderLigaProIcon({ size: 512, maskable });
}
