import { Chessboard } from "react-chessboard";

interface BoardProps {
  currFen: string;
  onPieceDrop: (sourceSquare: string, targetSquare: string) => boolean;
  isWhite: boolean;
  moveAnimationDuration?: number;
}

const Board = ({ currFen, onPieceDrop, isWhite, moveAnimationDuration }: BoardProps) => {
  const darkSquareStyle = {
    background: 'var(--board-dark-square)',
  };
  const lightSquareStyle = {
    background: 'var(--board-light-square)',
  };
  const dropSquareStyle = {
    boxShadow:
      "inset 0 0 0 2px rgba(245, 255, 228, 0.9), inset 0 0 0 999px rgba(181, 212, 132, 0.42)",
    background:
      "radial-gradient(circle at 34% 28%, rgba(246, 255, 231, 0.7) 0%, rgba(184, 214, 138, 0.62) 56%, rgba(130, 167, 89, 0.7) 100%)",
  };
  const boardStyle = {
    borderRadius: '4px',
    background: 'var(--board-backdrop)',
    boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.04)',
  };

  return (
    <Chessboard
      id="BasicBoard"
      arePiecesDraggable={true}
      position={currFen}
      onPieceDrop={onPieceDrop}
      animationDuration={moveAnimationDuration}
      boardOrientation={isWhite ? 'white' : 'black'}
      customDarkSquareStyle={darkSquareStyle}
      customLightSquareStyle={lightSquareStyle}
      customDropSquareStyle={dropSquareStyle}
      customBoardStyle={boardStyle}
    />
  );
};

export default Board;
