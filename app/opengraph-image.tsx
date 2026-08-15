import { ImageResponse } from "next/og";

export const alt = "Authentic Resell Inner Circle application";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "62px 70px",
          background:
            "radial-gradient(circle at 80% 15%, rgba(57,255,20,0.18), transparent 32%), linear-gradient(145deg, #151716 0%, #050505 74%)",
          color: "white",
          fontFamily: "Arial, sans-serif"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#39ff14",
              color: "#051005",
              fontSize: 19,
              fontWeight: 800
            }}
          >
            AR
          </div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>Authentic Resell</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ color: "#39ff14", fontSize: 18, fontWeight: 700, letterSpacing: 3 }}>
            INNER CIRCLE APPLICATION
          </div>
          <div style={{ maxWidth: 980, fontSize: 68, fontWeight: 800, lineHeight: 1.02, letterSpacing: -3 }}>
            Build a more structured reselling operation.
          </div>
          <div style={{ color: "#bdc3be", fontSize: 25 }}>
            A short application, followed by a focused conversation.
          </div>
        </div>
      </div>
    ),
    size
  );
}
