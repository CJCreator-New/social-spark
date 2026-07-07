interface SkeletonListProps {
  rows?: number;
}

export function SkeletonList({ rows = 5 }: SkeletonListProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          style={{
            background: "var(--color-surface-muted)",
            border: "1px solid var(--color-border)",
            borderRadius: 12,
            padding: "18px 20px",
            display: "flex",
            gap: 14,
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              background:
                "linear-gradient(90deg, var(--color-primary-xlight), var(--color-primary-light), var(--color-primary-xlight))",
              animation: "ssPulse 1.3s ease-in-out infinite",
              flexShrink: 0,
              marginTop: 2,
            }}
          />
          <div style={{ flex: 1 }}>
            <div
              style={{
                height: 18,
                width: "55%",
                borderRadius: 6,
                background:
                  "linear-gradient(90deg, var(--color-surface-hover), var(--color-primary-xlight), var(--color-surface-hover))",
                animation: "ssPulse 1.3s ease-in-out infinite",
                marginBottom: 10,
              }}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <div
                style={{
                  height: 16,
                  width: 72,
                  borderRadius: 999,
                  background: "var(--color-surface-hover)",
                  animation: "ssPulse 1.3s ease-in-out infinite",
                }}
              />
              <div
                style={{
                  height: 16,
                  width: 92,
                  borderRadius: 999,
                  background: "var(--color-surface-hover)",
                  animation: "ssPulse 1.3s ease-in-out infinite",
                }}
              />
              <div
                style={{
                  height: 16,
                  width: 64,
                  borderRadius: 999,
                  background: "var(--color-surface-hover)",
                  animation: "ssPulse 1.3s ease-in-out infinite",
                }}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <div
              style={{
                width: 56,
                height: 26,
                borderRadius: 6,
                background: "var(--color-surface-hover)",
                animation: "ssPulse 1.3s ease-in-out infinite",
              }}
            />
            <div
              style={{
                width: 68,
                height: 26,
                borderRadius: 6,
                background: "var(--color-surface-hover)",
                animation: "ssPulse 1.3s ease-in-out infinite",
              }}
            />
          </div>
        </div>
      ))}
      <style>{`@keyframes ssPulse { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }`}</style>
    </div>
  );
}
