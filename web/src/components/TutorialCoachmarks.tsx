import { RefObject, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

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
        title: "What is a PGN?",
        body: "PGN is a text format for moves. Example: Nf3 means knight to f3, O-O means castle. Parentheses mark alternate branches.",
        target: "pgn",
      },
      {
        title: "How This Trainer Works",
        body: "You play your side from a PGN line, and the app plays the opponent. The goal is to cover every variation, not just one path.",
        target: "board",
      },
      {
        title: "Choose Your Perspective",
        body: "Set white or black depending on which side you want to train. This changes which decisions are tested as your moves.",
        target: "color",
      },
      {
        title: "Skip To The First Branch",
        body: "Skip to first branch jumps through common opening moves so practice focuses on decision points, where memory usually breaks.",
        target: "skip",
      },
      {
        title: "Focused Recall",
        body: "Use Hint if needed, but try to answer cold first. That gives better signal on what lines need deeper repetition.",
        target: "hint",
      },
      {
        title: "Message Box",
        body: "Text box to surface messages, and explain why you can or can't do something.",
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
  const [isWhatIsAppPopupOpen, setIsWhatIsAppPopupOpen] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [targetRadius, setTargetRadius] = useState(12);

  const activeStep = steps[stepIdx];

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const updateRect = () => {
      if (!activeStep.target) {
        setTargetRect(null);
        setTargetRadius(12);
        return;
      }

      const node = targets[activeStep.target].current;
      if (!node) {
        setTargetRect(null);
        setTargetRadius(12);
        return;
      }

      const computedStyles = window.getComputedStyle(node);
      const parsedRadius = parseFloat(computedStyles.borderTopLeftRadius) || 0;
      setTargetRect(node.getBoundingClientRect());
      setTargetRadius(parsedRadius);
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

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const isCompactViewport = viewportWidth < 768;
  const cardWidth = Math.max(160, Math.min(CARD_WIDTH, viewportWidth - 24));
  const estimatedCardHeight = isCompactViewport ? 292 : 210;
  const maxTooltipLeft = Math.max(12, viewportWidth - cardWidth - 12);
  const hasTarget = Boolean(targetRect);
  const tooltipTop = isCompactViewport
    ? Math.max(12, viewportHeight - estimatedCardHeight - 12)
    : hasTarget
      ? clamp(
          (targetRect?.top ?? 0) + (targetRect?.height ?? 0) / 2 - 90,
          12,
          viewportHeight - estimatedCardHeight - 12
        )
      : clamp(viewportHeight * 0.18, 12, viewportHeight - estimatedCardHeight - 12);

  const rightPreferredLeft = (targetRect?.left ?? 0) + (targetRect?.width ?? 0) + HORIZONTAL_GAP;
  const canPlaceRight = rightPreferredLeft + cardWidth + 12 <= viewportWidth;
  const leftPreferredLeft = (targetRect?.left ?? 0) - cardWidth - HORIZONTAL_GAP;
  const tooltipLeft = isCompactViewport
    ? clamp(viewportWidth * 0.5 - cardWidth * 0.5, 12, maxTooltipLeft)
    : hasTarget
      ? canPlaceRight
        ? rightPreferredLeft
        : clamp(leftPreferredLeft, 12, maxTooltipLeft)
      : clamp(viewportWidth * 0.5 - cardWidth * 0.5, 12, maxTooltipLeft);

  const overlay = (
    <>
      {hasTarget && (
        <div
          className="tutorial-highlight"
          style={{
            top: Math.max(targetRect?.top ?? 0, 0),
            left: Math.max(targetRect?.left ?? 0, 0),
            width: targetRect?.width ?? 0,
            height: targetRect?.height ?? 0,
            borderRadius: targetRadius,
          }}
        />
      )}

      <div className="tutorial-tooltip-card" style={{ top: tooltipTop, left: tooltipLeft, width: cardWidth }}>
        <p className="tutorial-tooltip-title">{activeStep.title}</p>
        <p className="tutorial-tooltip-body">{activeStep.body}</p>
        {stepIdx === 0 && (
          <button
            type="button"
            className="tutorial-what-app-btn"
            onClick={() => setIsWhatIsAppPopupOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={isWhatIsAppPopupOpen}
          >
            <span className="tutorial-what-app-icon" aria-hidden="true">
              ?
            </span>
            What what tf is this app?
          </button>
        )}

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

      {isWhatIsAppPopupOpen && (
        <div className="tutorial-help-popup-layer" role="presentation">
          <div className="tutorial-help-popup-card" role="dialog" aria-modal="true" aria-label="What this app is">
            <p className="tutorial-help-popup-title">Wait what tf is this app?</p>
            <p className="tutorial-help-popup-body">
              This app helps people practice chess opening theory.
            </p>
            <p className="tutorial-help-popup-body">
              As you get better at chess, opening theory becomes more and more important. The most cited quota suggests advanced players spend 25% of their time on openings, 25% on endgames, and 50% on tactics. As important as openings are, studying them is logistically difficult.
            </p>
            <p className="tutorial-help-popup-body">  
               PGN (Portable Game Notation) is the standard way to record chess moves and variations. PGN files are easy to create on desktop apps like Stockfish or Chessbase. However, quizzing yourself on that pgn notation remains difficult. This app is meant as a tool to help people practice those PGN documents they've already created, to help solidify the chess opening theory they've decided on learning.
            </p>
            <button type="button" className="tutorial-help-popup-btn" onClick={() => setIsWhatIsAppPopupOpen(false)}>
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );

  if (typeof document === "undefined") {
    return overlay;
  }

  return createPortal(overlay, document.body);
};

export default TutorialCoachmarks;
