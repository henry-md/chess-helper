import { faPenToSquare } from '@fortawesome/free-solid-svg-icons';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Chessboard } from "react-chessboard";
import EditPgnDialog from './BoardEditDialog';
import DeletePgnDialog from './BoardDeleteDialog';
import { useState } from 'react';
import { StoredPgn } from '@/lib/types';

interface BoardPreviewProps {
  pgn: StoredPgn;
  gameTitle: string;
  isWhite: boolean;
}

const BoardPreview = ({ pgn, gameTitle, isWhite }: BoardPreviewProps) => {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const darkSquareStyle = {
    backgroundColor: 'var(--board-dark-overlay)',
  };
  const boardStyle = {
    borderRadius: '4px',
    background: 'var(--board-backdrop)',
    boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.04)',
  };

  const handleEdit = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setEditDialogOpen(true);
  }

  const handleDelete = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setDeleteDialogOpen(true);
  }

  return (
    <a href={`/game/${pgn._id}`} target="_self" className="block cursor-pointer transition-transform duration-200 hover:-translate-y-0.5">
      <p className="pb-2 text-center font-medium text-foreground">{pgn.title}</p>
      <div className="relative">
        {/* Edit and Delete buttons */}
        <div className="absolute top-[5px] right-[-35px] z-50 flex flex-col gap-4">
          <button 
            onClick={handleEdit}
            className="icon-btn flex h-[30px] w-[30px] items-center justify-center rounded-[100%]">
              <FontAwesomeIcon className="w-[14px] h-[14px]" icon={faPenToSquare} />
          </button>
          <button 
            onClick={handleDelete}
            className="icon-btn flex h-[30px] w-[30px] items-center justify-center rounded-[100%]">
              <FontAwesomeIcon className="w-[14px] h-[14px]" icon={faTrash} />
          </button>
        </div>

        {/* Board */}
        <div className="group relative overflow-hidden rounded-lg border border-border/70 bg-card/55 p-1 shadow-[0_22px_42px_-30px_rgba(2,6,23,0.95)]">
          <div className="absolute inset-0 z-50 rounded-lg bg-primary/[0.06] opacity-0 transition-opacity group-hover:opacity-100"></div>
          <Chessboard
            id="BasicBoard"
            arePiecesDraggable={false}
            position={pgn.gameMetadata?.fenBeforeFirstBranch ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'}
            boardOrientation={pgn.gameSettings?.isPlayingWhite ?? true ? 'white' : 'black'}
            customDarkSquareStyle={darkSquareStyle}
            customLightSquareStyle={{ backgroundColor: 'var(--board-light)' }}
            customBoardStyle={boardStyle}
          />
        </div>
      </div>
      <EditPgnDialog pgn={pgn} open={editDialogOpen} setEditDialogOpen={setEditDialogOpen} />
      <DeletePgnDialog pgn={pgn} open={deleteDialogOpen} setDeleteDialogOpen={setDeleteDialogOpen} />
    </a>
  )
};

export default BoardPreview;
