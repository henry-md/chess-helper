import { Chessboard } from "react-chessboard";
import { CSSProperties } from "react";

interface BoardProps {
  currFen: string;
  onPieceDrop: (sourceSquare: string, targetSquare: string) => boolean;
  isWhite: boolean;
  highlightSquareStyles?: Record<string, CSSProperties>;
}

const Board = ({ currFen, onPieceDrop, isWhite, highlightSquareStyles }: BoardProps) => {
  return (
    <Chessboard
      id="BasicBoard"
      arePiecesDraggable={true}
      position={currFen}
      onPieceDrop={onPieceDrop}
      customSquareStyles={highlightSquareStyles}
      boardOrientation={isWhite ? 'white' : 'black'}
      customDarkSquareStyle={{ backgroundColor: 'var(--board-dark)' }}
      customLightSquareStyle={{ backgroundColor: 'var(--board-light)' }}
      customBoardStyle={{
        borderRadius: '4px',
        // boxShadow: '0 2px 10px rgba(0, 0, 0, 0.5)'
      }}
    />
  );
};

export default Board;
