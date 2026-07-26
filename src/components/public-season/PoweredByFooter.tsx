import Link from "next/link";
import {
  PLATFORM_HOME_URL,
  PLATFORM_NAME,
} from "@/lib/platform/config";

export function PoweredByFooter() {
  return (
    <footer className="mt-10 border-t border-border pt-4 text-center text-xs text-muted">
      Powered by{" "}
      <Link
        href={PLATFORM_HOME_URL}
        className="text-text-secondary underline-offset-2 hover:underline"
      >
        {PLATFORM_NAME}
      </Link>
    </footer>
  );
}
