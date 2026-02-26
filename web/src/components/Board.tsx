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
    boxShadow: "none",
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
