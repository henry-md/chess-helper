import { Chess } from "chess.js";
import { MoveNode } from "@/lib/types";

const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const RESULT_TOKENS = new Set(["1-0", "0-1", "1/2-1/2", "*"]);

const normalizeMoveText = (moveText: string): string => {
  return moveText
    .replace(/\{[^}]*\}/g, " ") // Block comments
    .replace(/;[^\n\r]*/g, " ") // Inline comments
    .replace(/\$\d+/g, " ") // NAGs ($1, $2, ...)
    .replace(/\d+\.(\.\.)?/g, " ") // Move numbers (1., 1..., 23.)
    .replace(/\(/g, " ( ")
    .replace(/\)/g, " ) ")
    .replace(/\s+/g, " ")
    .trim();
};

const sanitizeToken = (token: string): string => token.replace(/[!?]+$/g, "");

const tokenizeMoveText = (moveText: string): string[] => {
  const normalized = normalizeMoveText(moveText);
  if (!normalized) {
    return [];
  }

  return normalized
    .split(" ")
    .map(sanitizeToken)
    .filter((token) => token !== "" && !RESULT_TOKENS.has(token));
};

const parseMainlines = (
  tokens: string[],
  startIndex: number,
  seedLine: string[]
): [number, string[]] => {
  let index = startIndex;
  const currentLine = [...seedLine];
  const lines: string[] = [];

  while (index < tokens.length) {
    const token = tokens[index];

    if (token === "(") {
      // Variations branch from the position before the last played move.
      const variationSeed = currentLine.slice(0, Math.max(0, currentLine.length - 1));
      const [newIndex, variationLines] = parseMainlines(tokens, index + 1, variationSeed);
      lines.push(...variationLines);
      index = newIndex;
    } else if (token === ")") {
      lines.push(currentLine.join(" "));
      return [index, lines];
    } else {
      currentLine.push(token);
    }

    index++;
  }

  lines.push(currentLine.join(" "));
  return [index, lines];
};

// Turns nested PGN with variations into a list of linear SAN lines.
export const moveTextToMainlines = (moveText: string): string[] => {
  const tokens = tokenizeMoveText(moveText);
  if (tokens.length === 0) {
    return [];
  }

  const [, parsedLines] = parseMainlines(tokens, 0, []);
  return [...new Set(parsedLines.map((line) => line.trim()).filter(Boolean))];
};

/**
 * Converts linear SAN lines into a move tree.
 */
export const mainlinesToMoveTree = (mainlines: string[]): MoveNode => {
  const root: MoveNode = {
    move: "",
    moveNum: 0,
    isWhite: false,
    fen: INITIAL_FEN,
    children: [],
    parent: null,
    numLeafChildren: 0,
  };

  for (const line of mainlines) {
    const moves = line.split(/\s+/).filter(Boolean);
    if (moves.length === 0) {
      continue;
    }

    const chess = new Chess();
    let currentNode = root;
    let moveNum = 1;
    let isWhite = true;

    for (const san of moves) {
      const moveResult = chess.move(san);
      if (!moveResult) {
        break;
      }

      const existingChild = currentNode.children.find((child) => child.move === moveResult.san);
      if (existingChild) {
        currentNode = existingChild;
      } else {
        const nextNode: MoveNode = {
          move: moveResult.san,
          moveNum,
          isWhite,
          fen: chess.fen(),
          children: [],
          parent: currentNode,
          numLeafChildren: 0,
        };
        currentNode.children.push(nextNode);
        currentNode = nextNode;
      }

      if (!isWhite) {
        moveNum++;
      }
      isWhite = !isWhite;
    }
  }

  return root;
};

export const findNumMovesToFirstBranch = (moveText: string): number => {
  const tokens = tokenizeMoveText(moveText);
  let plyCount = 0;

  for (const token of tokens) {
    if (token === "(") {
      break;
    }
    if (token === ")") {
      continue;
    }
    plyCount++;
  }

  // Keep existing UX behavior: skip to one ply before the first branch move.
  return Math.max(0, plyCount - 1);
};

export const hashMoveNode = (moveNode: MoveNode): string => {
  return `${moveNode.fen}-${moveNode.moveNum}-${moveNode.move}-${moveNode.isWhite}`;
};
