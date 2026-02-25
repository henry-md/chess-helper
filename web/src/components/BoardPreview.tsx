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

  const handleEdit = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setEditDialogOpen(true);
  }

  const handleDelete = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setDeleteDialogOpen(true);
  }

  return (
    <a href={`/game/${pgn._id}`} target="_self" className="cursor-pointer">
      <p className="pb-2 text-center">{pgn.title}</p>
      <div className="relative">
        {/* Edit and Delete buttons */}
        <div className="absolute top-[5px] right-[-35px] z-50 flex flex-col gap-4">
          <button 
            onClick={handleEdit}
            className="icon-btn text-white bg-gray-900 rounded-[100%] w-[30px] h-[30px] flex items-center justify-center">
              <FontAwesomeIcon className="w-[14px] h-[14px]" icon={faPenToSquare} />
          </button>
          <button 
            onClick={handleDelete}
            className="icon-btn text-white bg-gray-900 rounded-[100%] w-[30px] h-[30px] flex items-center justify-center">
              <FontAwesomeIcon className="w-[14px] h-[14px]" icon={faTrash} />
          </button>
        </div>

        {/* Board */}
        <div className="relative rounded-md group">
          <div className="absolute inset-0 z-50 transition-opacity bg-black rounded-md opacity-0 group-hover:opacity-10"></div>
          <Chessboard
            id="BasicBoard"
            arePiecesDraggable={false}
            position={pgn.gameMetadata?.fenBeforeFirstBranch ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'}
            boardOrientation={pgn.gameSettings?.isPlayingWhite ?? true ? 'white' : 'black'}
            customDarkSquareStyle={{ backgroundColor: 'var(--board-dark)' }}
            customLightSquareStyle={{ backgroundColor: 'var(--board-light)' }}
            customBoardStyle={{
              borderRadius: '4px',
              // boxShadow: '0 2px 10px rgba(0, 0, 0, 0.5)'
            }}
          />
        </div>
      </div>
      <EditPgnDialog pgn={pgn} open={editDialogOpen} setEditDialogOpen={setEditDialogOpen} />
      <DeletePgnDialog pgn={pgn} open={deleteDialogOpen} setDeleteDialogOpen={setDeleteDialogOpen} />
    </a>
  )
};

export default BoardPreview;