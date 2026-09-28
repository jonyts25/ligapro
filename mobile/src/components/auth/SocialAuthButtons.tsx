import * as AppleAuthentication from "expo-apple-authentication";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Button,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { getSupabase } from "@/lib/supabase/client";

WebBrowser.maybeCompleteAuthSession();

type SocialAuthButtonsProps = {
  onError: (message: string) => void;
  onSuccess?: () => void;
};

function googleClientIdsConfigured(): boolean {
  if (!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) {
    return false;
  }

  if (Platform.OS === "ios") {
    return Boolean(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID);
  }

  if (Platform.OS === "android") {
    return Boolean(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID);
  }

  return true;
}

function mapProviderError(provider: "google" | "apple", message: string): string {
  const lower = message.toLowerCase();
  if (
    provider === "apple" &&
    (lower.includes("provider") ||
      lower.includes("apple") ||
      lower.includes("not enabled") ||
      lower.includes("unsupported"))
  ) {
    return "Inicio con Apple aún no está disponible en el servidor. Usa correo o Google.";
  }
  return message;
}

export function SocialAuthButtons({
  onError,
  onSuccess,
}: SocialAuthButtonsProps) {
  const supabase = getSupabase();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  const googleConfigured = googleClientIdsConfigured();
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "",
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "",
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "",
  });

  useEffect(() => {
    if (!response) {
      return;
    }

    if (response.type === "success") {
      const idToken = response.params.id_token;
      if (!idToken) {
        onError("No recibimos un token válido de Google.");
        setGoogleLoading(false);
        return;
      }

      void supabase.auth
        .signInWithIdToken({ provider: "google", token: idToken })
        .then(({ error }) => {
          if (error) {
            onError(mapProviderError("google", error.message));
          } else {
            onSuccess?.();
          }
          setGoogleLoading(false);
        });
      return;
    }

    if (response.type === "error") {
      onError(
        response.error?.message ??
          "No pudimos continuar con Google. Inténtalo más tarde.",
      );
      setGoogleLoading(false);
      return;
    }

    if (response.type === "dismiss" || response.type === "cancel") {
      setGoogleLoading(false);
    }
  }, [response, supabase, onError, onSuccess]);

  async function handleGooglePress() {
    if (!googleConfigured) {
      onError(
        "Google no está configurado en esta build. Revisa EXPO_PUBLIC_GOOGLE_* en mobile/.env.",
      );
      return;
    }

    setGoogleLoading(true);
    try {
      await promptAsync();
    } catch {
      onError("No pudimos abrir el flujo de Google.");
      setGoogleLoading(false);
    }
  }

  async function handleApplePress() {
    setAppleLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        onError("No recibimos un token válido de Apple.");
        return;
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
      });

      if (error) {
        onError(mapProviderError("apple", error.message));
        return;
      }

      onSuccess?.();
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: string }).code)
          : "";
      if (code === "ERR_REQUEST_CANCELED") {
        return;
      }
      onError("No pudimos continuar con Apple. Inténtalo más tarde.");
    } finally {
      setAppleLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      {googleConfigured ? (
        googleLoading ? (
          <ActivityIndicator />
        ) : (
          <Button
            title="Continuar con Google"
            disabled={!request || googleLoading}
            onPress={() => void handleGooglePress()}
          />
        )
      ) : (
        <Text style={styles.hint}>
          Google OAuth requiere EXPO_PUBLIC_GOOGLE_* en mobile/.env.
        </Text>
      )}

      {Platform.OS === "ios" ? (
        appleLoading ? (
          <ActivityIndicator />
        ) : (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={8}
            style={styles.appleButton}
            onPress={() => void handleApplePress()}
          />
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  appleButton: {
    width: "100%",
    height: 44,
  },
  hint: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
  },
});
