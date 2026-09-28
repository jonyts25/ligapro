import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { AuthProvider } from "@/lib/auth/session";

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="index" options={{ title: "Inicio" }} />
        <Stack.Screen name="login" options={{ title: "Iniciar sesión" }} />
        <Stack.Screen name="register" options={{ title: "Registro" }} />
        <Stack.Screen
          name="mis-partidos"
          options={{ title: "Mis partidos" }}
        />
        <Stack.Screen
          name="eliminar-cuenta"
          options={{ title: "Eliminar cuenta" }}
        />
        <Stack.Screen
          name="partidos/[matchId]/index"
          options={{ title: "Captura" }}
        />
      </Stack>
    </AuthProvider>
  );
}
