import { renderLigaProIcon } from "@/lib/branding/icon-image";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return renderLigaProIcon({ size: 32 });
}
