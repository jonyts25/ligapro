import { SignUpForm } from "@/components/auth/SignUpForm";
import {
  AUTH_CALLBACK_ALLOWED_NEXT,
  AUTH_CALLBACK_ALLOWED_PREFIXES,
  getSafeInternalPath,
} from "@/lib/auth/validation";

type PageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function SignUpPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const next =
    getSafeInternalPath(
      params.next,
      AUTH_CALLBACK_ALLOWED_NEXT,
      AUTH_CALLBACK_ALLOWED_PREFIXES
    ) ?? undefined;

  return <SignUpForm next={next} />;
}
