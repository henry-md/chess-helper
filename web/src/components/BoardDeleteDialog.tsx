import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StoredPgn } from "@/lib/types";
import useMutationPgns from "@/hooks/useMutationPgns";

type DeletePgnDialogProps = {
  pgn: StoredPgn;
  open: boolean;
  setDeleteDialogOpen: (open: boolean) => void;
};

const DeletePgnDialog = ({
  pgn,
  open,
  setDeleteDialogOpen,
}: DeletePgnDialogProps) => {
  const { deletePgn } = useMutationPgns();

  const handleDelete = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    await deletePgn(pgn._id);
    // triggerPgnsRefresh();
    setDeleteDialogOpen(false);
  };

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete your PGN
            and remove it from our servers.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setDeleteDialogOpen(false)}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete}>Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeletePgnDialog;
