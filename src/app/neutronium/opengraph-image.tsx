import { ImageResponse } from "next/og";

export const alt =
  "Neutronium — People, access, and onboarding in one place";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function NeutroniumOgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#08111f",
          color: "#f3f7ff",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              "radial-gradient(55% 80% at 78% 46%, #263d76 0%, #122344 46%, #08111f 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: -110,
            top: -190,
            width: 560,
            height: 560,
            borderRadius: 280,
            border: "1px solid #7994d833",
            background: "#6b8cff0d",
          }}
        />

        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            padding: "66px 72px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 46,
                height: 46,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 14,
                background: "linear-gradient(135deg, #8eaaff, #536fe8)",
                color: "#071126",
                fontSize: 24,
                fontWeight: 700,
              }}
            >
              n.
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 30,
                fontWeight: 700,
                letterSpacing: -1,
              }}
            >
              neutronium
              <span style={{ color: "#8ee7c9" }}>.</span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: 560,
              gap: 17,
            }}
          >
            <div
              style={{
                display: "flex",
                color: "#a9c0e8",
                fontSize: 19,
                fontWeight: 600,
                letterSpacing: 3,
              }}
            >
              IT OPERATIONS, SIMPLIFIED
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                fontSize: 57,
                fontWeight: 700,
                lineHeight: 1.05,
                letterSpacing: -2,
              }}
            >
              <span>People, access,</span>
              <span>and onboarding</span>
              <span>in one place</span>
            </div>
            <div
              style={{
                display: "flex",
                color: "#aab9ce",
                fontSize: 22,
                lineHeight: 1.35,
              }}
            >
              A calmer way to manage employee access from first day to last.
            </div>
          </div>

          <div style={{ display: "flex", color: "#7186a8", fontSize: 18 }}>
            neutronium.runsit.ca
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            top: 128,
            right: 68,
            width: 468,
            height: 334,
            display: "flex",
            flexDirection: "column",
            padding: 22,
            border: "1px solid #b6caff4d",
            borderRadius: 24,
            background: "#eaf1ffeb",
            boxShadow: "0 24px 60px #02061166",
            color: "#1b2d52",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingBottom: 18,
              borderBottom: "1px solid #9eb2d666",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 9,
                  background: "#637ee8",
                }}
              />
              <div style={{ display: "flex", fontSize: 17, fontWeight: 700 }}>
                Access overview
              </div>
            </div>
            <div style={{ display: "flex", color: "#6c83a7", fontSize: 13 }}>
              Today
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 14,
              marginTop: 20,
            }}
          >
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: 16,
                borderRadius: 16,
                background: "#d8e3ff",
              }}
            >
              <div style={{ display: "flex", color: "#647da8", fontSize: 13 }}>
                Onboarding
              </div>
              <div style={{ display: "flex", fontSize: 29, fontWeight: 700 }}>
                12
              </div>
              <div style={{ display: "flex", color: "#506899", fontSize: 12 }}>
                active people
              </div>
            </div>
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: 16,
                borderRadius: 16,
                background: "#d8f2e9",
              }}
            >
              <div style={{ display: "flex", color: "#4e8978", fontSize: 13 }}>
                Access checks
              </div>
              <div style={{ display: "flex", fontSize: 29, fontWeight: 700 }}>
                08
              </div>
              <div style={{ display: "flex", color: "#4e8978", fontSize: 12 }}>
                ready to review
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginTop: 18,
              padding: "13px 15px",
              borderRadius: 14,
              background: "#ffffffaa",
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 10,
                background: "#536fe8",
                color: "white",
                fontSize: 17,
                fontWeight: 700,
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 7,
                  borderLeft: "3px solid #ffffff",
                  borderBottom: "3px solid #ffffff",
                  transform: "rotate(-45deg)",
                }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ display: "flex", fontSize: 14, fontWeight: 700 }}>
                New starter ready
              </div>
              <div style={{ display: "flex", color: "#6c83a7", fontSize: 12 }}>
                Workspace and access confirmed
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
