import { useMemo } from "react";

type LessonCompleteCelebrationProps = {
  isCompleted: boolean;
  showAnimation: boolean;
  onPlayAgain?: () => void;
};

const CONFETTI_COLORS = [
  "#a3e635",
  "#34d399",
  "#22d3ee",
  "#60a5fa",
  "#d4d4d8",
  "#86efac",
];

const CONFETTI_COUNT = 42;

const LessonCompleteCelebration = ({
  isCompleted,
  showAnimation,
  onPlayAgain,
}: LessonCompleteCelebrationProps) => {
  const pieces = useMemo(() => {
    return Array.from({ length: CONFETTI_COUNT }, (_, index) => {
      const leftPercent = (index * 19) % 100;
      const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
      const delayMs = (index % 12) * 45;
      const durationMs = 1500 + (index % 7) * 130;
      const driftPx = -70 + (index * 29) % 140;
      const rotationDeg = (index * 47) % 360;
      const rounded = index % 3 === 0;

      return {
        id: index,
        color,
        leftPercent,
        delayMs,
        durationMs,
        driftPx,
        rotationDeg,
        rounded,
      };
    });
  }, []);

  if (!isCompleted && !showAnimation) {
    return null;
  }

  return (
    <div className="lesson-celebration-layer pointer-events-none absolute inset-0 overflow-hidden">
      {showAnimation &&
        pieces.map((piece) => (
          <span
            key={piece.id}
            className="lesson-confetti-piece"
            style={{
              left: `${piece.leftPercent}%`,
              backgroundColor: piece.color,
              borderRadius: piece.rounded ? "999px" : "2px",
              animationDelay: `${piece.delayMs}ms`,
              animationDuration: `${piece.durationMs}ms`,
              transform: `translate3d(0,-20px,0) rotate(${piece.rotationDeg}deg)`,
              ["--drift" as string]: `${piece.driftPx}px`,
            }}
          />
        ))}

      {isCompleted && (
        <div className="lesson-complete-banner pointer-events-auto">
          <p className="lesson-complete-title">Lesson Complete</p>
          <p className="lesson-complete-subtitle">Every line in this PGN has been covered.</p>
          {onPlayAgain && (
            <button type="button" className="lesson-complete-restart-btn" onClick={onPlayAgain}>
              Play again
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default LessonCompleteCelebration;
