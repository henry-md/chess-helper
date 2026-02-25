import { RefObject, useEffect, useMemo, useState } from "react";

type TutorialTargetKey = "board" | "pgn" | "color" | "skip" | "hint" | "status";

type TutorialTargets = Record<TutorialTargetKey, RefObject<HTMLElement>>;

type TutorialCoachmarksProps = {
  targets: TutorialTargets;
  onComplete?: () => void;
};

type TutorialStep = {
  title: string;
  body: string;
  target: TutorialTargetKey | null;
};

const CARD_WIDTH = 320;
const HORIZONTAL_GAP = 14;

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

const TutorialCoachmarks = ({ targets, onComplete }: TutorialCoachmarksProps) => {
  const steps: TutorialStep[] = useMemo(
    () => [
      {
        title: "How This Trainer Works",
        body: "You play your side from a PGN line, and the app plays the opponent. The goal is to cover every variation, not just one path.",
        target: "board",
      },
      {
        title: "PGN In Plain Terms",
        body: "PGN is a text format for moves. Example: Nf3 means knight to f3, O-O means castle. Parentheses mark alternate branches.",
        target: "pgn",
      },
      {
        title: "Choose Your Perspective",
        body: "Set white or black depending on which side you want to train. This changes which decisions are tested as your moves.",
        target: "color",
      },
      {
        title: "Skip The Trunk",
        body: "Skip to first branch jumps through common opening moves so practice focuses on decision points, where memory usually breaks.",
        target: "skip",
      },
      {
        title: "Focused Recall",
        body: "Use Hint if needed, but try to answer cold first. That gives better signal on what lines need deeper repetition.",
        target: "hint",
      },
      {
        title: "Branch Coverage Rule",
        body: "At a branching position, any PGN move is accepted. Repeating the same move at that branch is blocked until other options are covered.",
        target: "status",
      },
      // {
      //   title: "For Friends And Recruiters",
      //   body: "This demo showcases PGN parsing, branch-state tracking, clear UI feedback for edge cases, and... tutorials.",
      //   target: null,
      // },
    ],
    []
  );

  const [stepIdx, setStepIdx] = useState(0);
  const [isOpen, setIsOpen] = useState(true);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const activeStep = steps[stepIdx];

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const updateRect = () => {
      if (!activeStep.target) {
        setTargetRect(null);
        return;
      }

      const node = targets[activeStep.target].current;
      setTargetRect(node ? node.getBoundingClientRect() : null);
    };

    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [activeStep.target, isOpen, targets]);

  if (!isOpen) return null;

  const hasTarget = Boolean(targetRect);
  const tooltipTop = hasTarget
    ? clamp((targetRect?.top ?? 0) + (targetRect?.height ?? 0) / 2 - 90, 12, window.innerHeight - 210)
    : clamp(window.innerHeight * 0.18, 12, window.innerHeight - 210);

  const rightPreferredLeft = (targetRect?.left ?? 0) + (targetRect?.width ?? 0) + HORIZONTAL_GAP;
  const canPlaceRight = rightPreferredLeft + CARD_WIDTH + 12 <= window.innerWidth;
  const leftPreferredLeft = (targetRect?.left ?? 0) - CARD_WIDTH - HORIZONTAL_GAP;
  const tooltipLeft = hasTarget
    ? canPlaceRight
      ? rightPreferredLeft
      : clamp(leftPreferredLeft, 12, window.innerWidth - CARD_WIDTH - 12)
    : clamp(window.innerWidth * 0.5 - CARD_WIDTH * 0.5, 12, window.innerWidth - CARD_WIDTH - 12);

  return (
    <>
      {hasTarget && (
        <div
          className="tutorial-highlight"
          style={{
            top: Math.max((targetRect?.top ?? 0) - 8, 0),
            left: Math.max((targetRect?.left ?? 0) - 8, 0),
            width: (targetRect?.width ?? 0) + 16,
            height: (targetRect?.height ?? 0) + 16,
          }}
        />
      )}

      <div className="tutorial-tooltip-card" style={{ top: tooltipTop, left: tooltipLeft, width: CARD_WIDTH }}>
        <p className="tutorial-tooltip-title">{activeStep.title}</p>
        <p className="tutorial-tooltip-body">{activeStep.body}</p>

        <div className="tutorial-tooltip-footer">
          <span className="tutorial-tooltip-step">
            {stepIdx + 1}/{steps.length}
          </span>
          <div className="tutorial-tooltip-actions">
            <button
              className="tutorial-ghost-btn"
              onClick={() => {
                setIsOpen(false);
                onComplete?.();
              }}
            >
              Hide
            </button>
            <button
              className="tutorial-ghost-btn"
              disabled={stepIdx === 0}
              onClick={() => setStepIdx((prev) => Math.max(0, prev - 1))}
            >
              Back
            </button>
            <button
              className="tutorial-solid-btn"
              onClick={() => {
                if (stepIdx === steps.length - 1) {
                  setIsOpen(false);
                  onComplete?.();
                  return;
                }
                setStepIdx((prev) => Math.min(steps.length - 1, prev + 1));
              }}
            >
              {stepIdx === steps.length - 1 ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default TutorialCoachmarks;
