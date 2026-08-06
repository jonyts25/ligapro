import { renderPlatformIcon } from "@/lib/branding/icon-image";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return renderPlatformIcon({ size: 180 });
}
