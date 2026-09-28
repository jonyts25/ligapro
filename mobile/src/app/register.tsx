import { Redirect, router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Button,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { SocialAuthButtons } from "@/components/auth/SocialAuthButtons";
import { useAuth } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export default function RegisterScreen() {
  const { session, loading, signUp } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isSupabaseConfigured()) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>
          Copia mobile/.env.example a mobile/.env con las credenciales de
          ligapro-dev.
        </Text>
      </View>
    );
  }

  if (!loading && session) {
    return <Redirect href="/" />;
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    if (!displayName.trim()) {
      setError("El nombre es obligatorio.");
      setSubmitting(false);
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      setSubmitting(false);
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      setSubmitting(false);
      return;
    }

    const result = await signUp(email, password, displayName);
    setSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.hasSession) {
      router.replace("/");
      return;
    }

    setSuccess(
      "Cuenta creada. Si el proyecto requiere confirmación de correo, revisa tu bandeja antes de entrar.",
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Crear cuenta</Text>
      <Text style={styles.subtitle}>Regístrate en ligapro-dev</Text>

      <TextInput
        autoCapitalize="words"
        placeholder="Nombre"
        style={styles.input}
        value={displayName}
        onChangeText={setDisplayName}
      />
      <TextInput
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="Correo"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        autoCapitalize="none"
        autoComplete="password-new"
        placeholder="Contraseña"
        secureTextEntry
        style={styles.input}
        value={password}
        onChangeText={setPassword}
      />
      <TextInput
        autoCapitalize="none"
        autoComplete="password-new"
        placeholder="Confirmar contraseña"
        secureTextEntry
        style={styles.input}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}

      {submitting ? (
        <ActivityIndicator />
      ) : (
        <Button title="Registrarme" onPress={handleSubmit} />
      )}

      <SocialAuthButtons
        onError={setError}
        onSuccess={() => router.replace("/")}
      />

      <Pressable onPress={() => router.push("/login")}>
        <Text style={styles.link}>¿Ya tienes cuenta? Inicia sesión</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  error: {
    color: "#b42318",
    textAlign: "center",
  },
  success: {
    color: "#027a48",
    textAlign: "center",
  },
  link: {
    textAlign: "center",
    color: "#175cd3",
    marginTop: 8,
  },
});
