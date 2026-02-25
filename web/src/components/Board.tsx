import { Chessboard } from "react-chessboard";

interface BoardProps {
  currFen: string;
  onPieceDrop: (sourceSquare: string, targetSquare: string) => boolean;
  isWhite: boolean;
  moveAnimationDuration?: number;
}

const Board = ({ currFen, onPieceDrop, isWhite, moveAnimationDuration }: BoardProps) => {
  return (
    <Chessboard
      id="BasicBoard"
      arePiecesDraggable={true}
      position={currFen}
      onPieceDrop={onPieceDrop}
      animationDuration={moveAnimationDuration}
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
