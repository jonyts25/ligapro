import { Image, StyleSheet, Text, View } from "react-native";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return name.trim().slice(0, 2).toUpperCase() || "?";
}

type PlayerAvatarBadgeProps = {
  name: string;
  photoUrl?: string | null;
  size?: number;
};

export function PlayerAvatarBadge({
  name,
  photoUrl,
  size = 44,
}: PlayerAvatarBadgeProps) {
  return (
    <View style={[styles.crest, { width: size, height: size, borderRadius: size / 2 }]}>
      {photoUrl ? (
        <Image source={{ uri: photoUrl }} style={styles.image} />
      ) : (
        <Text style={styles.initials}>{initials(name)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  crest: {
    overflow: "hidden",
    backgroundColor: "#eee",
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  initials: {
    fontSize: 14,
    fontWeight: "700",
    color: "#555",
  },
});
