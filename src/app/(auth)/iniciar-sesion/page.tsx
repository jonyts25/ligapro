import { SignInForm } from "@/components/auth/SignInForm";
import {
  AUTH_CALLBACK_ALLOWED_NEXT,
  AUTH_CALLBACK_ALLOWED_PREFIXES,
  getSafeInternalPath,
} from "@/lib/auth/validation";

type PageProps = {
  searchParams: Promise<{ next?: string; message?: string }>;
};

export default async function SignInPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const next =
    getSafeInternalPath(
      params.next,
      AUTH_CALLBACK_ALLOWED_NEXT,
      AUTH_CALLBACK_ALLOWED_PREFIXES
    ) ?? undefined;

  return <SignInForm next={next} message={params.message} />;
}
