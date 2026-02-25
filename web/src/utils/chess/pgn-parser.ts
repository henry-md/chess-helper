import { Chess } from "chess.js";
import { MoveNode } from "@/lib/types";

const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const RESULT_TOKENS = new Set(["1-0", "0-1", "1/2-1/2", "*"]);
const MOVE_NUMBER_TOKEN_REGEX = /^\d+\.(?:\.\.)?$/;
const BLOCK_COMMENT_TOKEN_REGEX = /^\{[^}]*\}$/;
const INLINE_COMMENT_TOKEN_REGEX = /^;[^\n\r]*$/;
const NAG_TOKEN_REGEX = /^\$\d+$/;
const PGN_DISPLAY_TOKEN_REGEX =
  /\s+|\{[^}]*\}|;[^\n\r]*|\$\d+|\d+\.(?:\.\.)?|1-0|0-1|1\/2-1\/2|\*|\(|\)|[^\s(){};]+/g;

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

export const toPgnMoveOccurrenceKey = (positionKey: string, san: string): string =>
  `${positionKey}|${san}`;

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

type PgnDisplayLexToken = {
  text: string;
  isWhitespace: boolean;
  isOpenParen: boolean;
  isCloseParen: boolean;
  san?: string;
  positionKey?: string;
  occurrenceKey?: string;
};

const lexPgnDisplayTokens = (moveText: string): PgnDisplayLexToken[] => {
  const matches = moveText.match(PGN_DISPLAY_TOKEN_REGEX) ?? [];
  return matches.map((token) => {
    const isWhitespace = /^\s+$/.test(token);
    if (isWhitespace) {
      return {
        text: token,
        isWhitespace: true,
        isOpenParen: false,
        isCloseParen: false,
      };
    }

    if (token === "(") {
      return {
        text: token,
        isWhitespace: false,
        isOpenParen: true,
        isCloseParen: false,
      };
    }

    if (token === ")") {
      return {
        text: token,
        isWhitespace: false,
        isOpenParen: false,
        isCloseParen: true,
      };
    }

    if (
      BLOCK_COMMENT_TOKEN_REGEX.test(token) ||
      INLINE_COMMENT_TOKEN_REGEX.test(token) ||
      NAG_TOKEN_REGEX.test(token) ||
      MOVE_NUMBER_TOKEN_REGEX.test(token) ||
      RESULT_TOKENS.has(token)
    ) {
      return {
        text: token,
        isWhitespace: false,
        isOpenParen: false,
        isCloseParen: false,
      };
    }

    const san = sanitizeToken(token);
    return {
      text: token,
      isWhitespace: false,
      isOpenParen: false,
      isCloseParen: false,
      san: san.length > 0 ? san : undefined,
    };
  });
};

const annotateDisplayTokenPositions = (
  tokens: PgnDisplayLexToken[],
  startIndex: number,
  seedMoves: string[]
): number => {
  let index = startIndex;
  const currentLineMoves = [...seedMoves];

  while (index < tokens.length) {
    const token = tokens[index];

    if (token.isOpenParen) {
      const variationSeed = currentLineMoves.slice(0, Math.max(0, currentLineMoves.length - 1));
      index = annotateDisplayTokenPositions(tokens, index + 1, variationSeed);
    } else if (token.isCloseParen) {
      return index;
    } else if (token.san) {
      const positionKey = `${currentLineMoves.length}|${currentLineMoves.join(" ")}`;
      const occurrenceKey = toPgnMoveOccurrenceKey(positionKey, token.san);
      token.positionKey = positionKey;
      token.occurrenceKey = occurrenceKey;
      currentLineMoves.push(token.san);
    }

    index += 1;
  }

  return index;
};

export type PgnDisplayToken = {
  key: string;
  text: string;
  isWhitespace: boolean;
  occurrenceKey: string | null;
};

export const moveTextToDisplayTokens = (moveText: string): PgnDisplayToken[] => {
  const lexTokens = lexPgnDisplayTokens(moveText);
  if (lexTokens.length === 0) {
    return [];
  }

  annotateDisplayTokenPositions(lexTokens, 0, []);

  return lexTokens.map((token, index) => ({
    key: `${index}-${token.text}`,
    text: token.text,
    isWhitespace: token.isWhitespace,
    occurrenceKey: token.occurrenceKey ?? null,
  }));
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
