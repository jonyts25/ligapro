import { UpdatePasswordForm } from "@/components/auth/UpdatePasswordForm";
import { createClient } from "@/lib/supabase/server";

export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sessionValid = Boolean(data?.claims?.sub);

  return <UpdatePasswordForm sessionValid={sessionValid} />;
}
