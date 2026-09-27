import { useEffect, useRef, useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";

type MatchStopwatchProps = {
  halfDurationMinutes: number;
  onMinuteChange: (minute: number) => void;
};

export function MatchStopwatch({
  halfDurationMinutes,
  onMinuteChange,
}: MatchStopwatchProps) {
  const [half, setHalf] = useState<1 | 2>(1);
  const [running, setRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const halfSeconds = halfDurationMinutes * 60;
  const displaySeconds = Math.min(elapsedSeconds, halfSeconds);
  const minute = Math.floor(displaySeconds / 60);

  useEffect(() => {
    onMinuteChange(half === 1 ? minute : halfDurationMinutes + minute);
  }, [half, minute, halfDurationMinutes, onMinuteChange]);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [running]);

  function toggleRunning() {
    setRunning((prev) => !prev);
  }

  function switchHalf(next: 1 | 2) {
    setHalf(next);
    setElapsedSeconds(0);
    setRunning(false);
  }

  const mm = String(Math.floor(displaySeconds / 60)).padStart(2, "0");
  const ss = String(displaySeconds % 60).padStart(2, "0");

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Cronómetro (solo en el teléfono)</Text>
      <Text style={styles.clock}>
        {half === 1 ? "1er tiempo" : "2do tiempo"} · {mm}:{ss}
      </Text>
      <View style={styles.row}>
        <Button
          title={running ? "Pausar" : "Iniciar"}
          onPress={toggleRunning}
        />
        <Button title="1er tiempo" onPress={() => switchHalf(1)} />
        <Button title="2do tiempo" onPress={() => switchHalf(2)} />
      </View>
      <Text style={styles.hint}>
        Minuto sugerido para eventos: {half === 1 ? minute : halfDurationMinutes + minute}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
  },
  clock: {
    fontSize: 28,
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  hint: {
    fontSize: 13,
    color: "#666",
  },
});
