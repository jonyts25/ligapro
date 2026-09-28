import { Redirect, router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Button,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { deleteOwnAccount } from "@/lib/auth/delete-account-api";
import { useAuth } from "@/lib/auth/session";

const CONFIRMATION_TEXT = "ELIMINAR";

export default function EliminarCuentaScreen() {
  const { session, loading, signOut } = useAuth();
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loading && !session) {
    return <Redirect href="/login" />;
  }

  async function handleDelete() {
    if (!session?.access_token) {
      setError("Sesión inválida. Vuelve a iniciar sesión.");
      return;
    }

    if (confirmation.trim() !== CONFIRMATION_TEXT) {
      setError(`Escribe ${CONFIRMATION_TEXT} para confirmar.`);
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await deleteOwnAccount(session.access_token);
    setSubmitting(false);

    if (result.ok) {
      await signOut();
      router.replace("/login");
      return;
    }

    if (
      result.status === 409 &&
      result.blockingOrganizationNames &&
      result.blockingOrganizationNames.length > 0
    ) {
      setError(
        `${result.message}\n\nOrganizaciones bloqueantes: ${result.blockingOrganizationNames.join(", ")}.\n\nTransfiere la propiedad o agrega otro dueño antes de eliminar tu cuenta.`,
      );
      return;
    }

    setError(result.message);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Eliminar cuenta</Text>
      <Text style={styles.body}>
        Esta acción es permanente. Tu perfil de autenticación se borrará. Los
        registros de jugador vinculados quedarán en la organización sin tu
        perfil asociado.
      </Text>
      <Text style={styles.body}>
        Si eres el único dueño de una organización, no podrás eliminar la cuenta
        hasta transferir la propiedad o agregar otro dueño.
      </Text>

      <Text style={styles.label}>
        Escribe {CONFIRMATION_TEXT} para confirmar
      </Text>
      <TextInput
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder={CONFIRMATION_TEXT}
        style={styles.input}
        value={confirmation}
        onChangeText={setConfirmation}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {submitting ? (
        <ActivityIndicator />
      ) : (
        <Button
          color="#b42318"
          title="Eliminar mi cuenta"
          onPress={() => void handleDelete()}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 12,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
  },
  body: {
    fontSize: 14,
    color: "#444",
    lineHeight: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    marginTop: 8,
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
    lineHeight: 20,
  },
});
