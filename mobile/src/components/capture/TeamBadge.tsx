import { Image, Pressable, StyleSheet, Text, View } from "react-native";

type TeamBadgeProps = {
  name: string;
  logoUrl?: string | null;
  selected?: boolean;
  onPress?: () => void;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return name.trim().slice(0, 2).toUpperCase() || "?";
}

export function TeamBadge({
  name,
  logoUrl,
  selected = false,
  onPress,
}: TeamBadgeProps) {
  const content = (
    <>
      <View style={styles.crest}>
        {logoUrl ? (
          <Image source={{ uri: logoUrl }} style={styles.image} />
        ) : (
          <Text style={styles.initials}>{initials(name)}</Text>
        )}
      </View>
      <Text style={styles.name}>{name}</Text>
    </>
  );

  if (!onPress) {
    return (
      <View style={[styles.row, selected && styles.selected]}>{content}</View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, selected && styles.selected]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    backgroundColor: "#fff",
  },
  selected: {
    borderColor: "#111",
    backgroundColor: "#f5f5f5",
  },
  crest: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
  },
});
