import { ImageResponse } from "next/og";

type IconOptions = {
  size: number;
  maskable?: boolean;
};

export function renderLigaProIcon({ size, maskable = false }: IconOptions) {
  const padding = maskable ? Math.round(size * 0.2) : Math.round(size * 0.12);
  const innerSize = size - padding * 2;
  const fontSize = Math.round(innerSize * 0.38);
  const radius = maskable ? 0 : Math.round(size * 0.18);

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: maskable ? "#14b8a6" : "#070b14",
          borderRadius: radius,
        }}
      >
        <div
          style={{
            width: innerSize,
            height: innerSize,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: maskable ? 0 : Math.round(innerSize * 0.22),
            background: "#14b8a6",
            color: "#042f2e",
            fontSize,
            fontWeight: 700,
            letterSpacing: -1,
          }}
        >
          LP
        </div>
      </div>
    ),
    { width: size, height: size }
  );
}
