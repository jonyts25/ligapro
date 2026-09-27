import { StyleSheet, Text, View } from "react-native";

import { isSupabaseConfigured } from "@/lib/supabase/client";

export default function HomeScreen() {
  const configured = isSupabaseConfigured();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ligera — app móvil (PoC)</Text>
      <Text style={styles.subtitle}>
        Arquitectura 0.6 · expo-router · Supabase
      </Text>
      <Text style={configured ? styles.ok : styles.warn}>
        Supabase: {configured ? "variables configuradas" : "copia .env.example → .env"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  ok: {
    fontSize: 14,
    color: "#1a7f37",
  },
  warn: {
    fontSize: 14,
    color: "#9a6700",
  },
});
