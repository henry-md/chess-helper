import { useEffect, useState } from "react";
import { OFFSET_OF_CELEBRATION_BETWEEN_LINES } from "@/constants";

type LineTransitionCelebrationProps = {
  isVisible: boolean;
};

const BURST_PARTICLE_COUNT = 24;
const BURST_COLORS = ["#91aa86", "#6e8a64", "#7b838f", "#5d6673", "#d8d5cd", "#b4bfad"];

const LineTransitionCelebration = ({ isVisible }: LineTransitionCelebrationProps) => {
  const [showBurst, setShowBurst] = useState(false);

  useEffect(() => {
    if (!isVisible) {
      setShowBurst(false);
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setShowBurst(true);
    }, OFFSET_OF_CELEBRATION_BETWEEN_LINES);

    return () => {
      window.clearTimeout(timeoutId);
      setShowBurst(false);
    };
  }, [isVisible]);

  if (!showBurst) {
    return null;
  }

  return (
    <div className="line-transition-layer line-transition-burst pointer-events-none absolute inset-0" aria-hidden="true">
      {Array.from({ length: BURST_PARTICLE_COUNT }, (_, index) => {
        const angle = (Math.PI * 2 * index) / BURST_PARTICLE_COUNT;
        const distance = 72 + (index % 6) * 12;
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;
        const color = BURST_COLORS[index % BURST_COLORS.length];
        const delay = (index % 8) * 18;
        const duration = 420 + (index % 5) * 36;
        const size = 6 + (index % 3) * 2;

        return (
          <span
            key={index}
            className="line-transition-confetti"
            style={{
              backgroundColor: color,
              width: `${size}px`,
              height: `${size * 1.45}px`,
              animationDelay: `${delay}ms`,
              animationDuration: `${duration}ms`,
              ["--tx" as string]: `${x}px`,
              ["--ty" as string]: `${y}px`,
              ["--rot" as string]: `${(index % 2 === 0 ? 1 : -1) * (260 + (index % 5) * 70)}deg`,
            }}
          />
        );
      })}
    </div>
  );
};

export default LineTransitionCelebration;
