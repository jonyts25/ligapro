import { ConfigContext, ExpoConfig } from "expo/config";

const GOOGLE_IOS_CLIENT_SUFFIX = ".apps.googleusercontent.com";
const GOOGLE_IOS_CLIENT_PLACEHOLDER =
  "your-ios-client-id.apps.googleusercontent.com";

/**
 * Google's iOS OAuth client publishes a URL scheme equal to the client ID
 * with its dot-delimited fields reversed
 * (`123-abc.apps.googleusercontent.com` → `com.googleusercontent.apps.123-abc`).
 * Expo's `ios.scheme` must match `^[a-z][a-z0-9+.-]*$`.
 */
function googleIosReversedClientId(
  clientId: string | undefined,
): string | undefined {
  const value = clientId?.trim();
  if (!value || value === GOOGLE_IOS_CLIENT_PLACEHOLDER) {
    return undefined;
  }
  if (!value.endsWith(GOOGLE_IOS_CLIENT_SUFFIX)) {
    return undefined;
  }

  const reversed = value.split(".").reverse().join(".");
  if (!/^[a-z][a-z0-9+.-]*$/.test(reversed)) {
    return undefined;
  }
  return reversed;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const iosReversedClientId = googleIosReversedClientId(
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  );

  // `ios.scheme` replaces the root `scheme` on iOS (it does not merge),
  // so "ligera" has to be listed here or ligera:// stops opening the app.
  // SDK 57 `expo-auth-session` Google redirects standalone/bare builds to
  // `${Application.applicationId}:/oauthredirect`. The reversed client ID is
  // the scheme Google documents for the iOS OAuth client.
  const iosSchemes = [
    ...new Set(
      ["ligera", iosReversedClientId, "mx.ligera.app"].filter(
        (scheme): scheme is string => Boolean(scheme),
      ),
    ),
  ];

  return {
    ...config,
    name: "Ligera",
    slug: "ligera",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "ligera",
    userInterfaceStyle: "automatic",
    ios: {
      icon: "./assets/expo.icon",
      bundleIdentifier: "mx.ligera.app",
      usesAppleSignIn: true,
      scheme: iosSchemes,
    },
    android: {
      package: "mx.ligera.app",
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png",
      },
      predictiveBackGestureEnabled: false,
    },
    web: {
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          backgroundColor: "#208AEF",
          image: "./assets/images/splash-icon.png",
          imageWidth: 76,
        },
      ],
      "expo-secure-store",
      "expo-apple-authentication",
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
  };
};
