/* eslint-disable */
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { StoredPgn } from "@/lib/types";
import useMutationPgns from "@/hooks/useMutationPgns";
// import { triggerPgnsRefresh } from "@/store/pgn";
import logger from "@/utils/logger";

type EditPgnDialogProps = {
  pgn: StoredPgn;
  open: boolean;
  setEditDialogOpen: (open: boolean) => void;
};

const EditPgnDialog = ({ pgn, open, setEditDialogOpen }: EditPgnDialogProps) => {
  const [title, setTitle] = useState(pgn.title);
  const [moveText, setMoveText] = useState(pgn.moveText);
  const [notes, setNotes] = useState(pgn.notes);
  const { updatePgnContent } = useMutationPgns();

  // Reset values when dialog is closed
  useEffect(() => {
    if (!open) {
      setTitle(pgn.title);
      setMoveText(pgn.moveText);
      setNotes(pgn.notes);
    }
  }, [open, pgn]);

  const handleSave = async (e: React.MouseEvent<HTMLButtonElement>) => {
    logger.debug(`[handleSave] Saving PGN ${pgn._id} with title ${title} and pgn ${moveText} and notes ${notes}`);
    e.preventDefault();
    if (title.length === 0 || moveText.length === 0) {
      toast.error("Sorry! Title and PGN cannot be empty 😕");
    } else {
      await updatePgnContent(pgn._id, { title, moveText, notes });
      // triggerPgnsRefresh();
      setEditDialogOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setEditDialogOpen}>
      <DialogContent className="w-[calc(100%-1rem)] max-h-[90vh] overflow-y-auto sm:w-full">
        <form className="grid w-full gap-1.5 p-1 sm:pr-3">
          <DialogTitle>Edit PGN</DialogTitle>
          <DialogDescription>
            Edit the title, PGN, and notes of your study here.
          </DialogDescription>
          <div className="my-4 grid gap-4 sm:grid-cols-4 sm:items-center sm:gap-8">
            <Label htmlFor="title" className="text-sm text-left sm:text-right">
              Title
            </Label>
            <Input
              id="title"
              value={title}
              className="sm:col-span-3"
              onChange={(e) => setTitle(e.target.value)}
            />
            <Label htmlFor="pgn" className="text-sm text-left sm:text-right">
              PGN
            </Label>
            <Input
              id="pgn"
              value={moveText}
              className="sm:col-span-3"
              onChange={(e) => setMoveText(e.target.value)}
            />
            <Label htmlFor="notes" className="text-sm text-left sm:text-right">
              Notes
            </Label>
            <Input
              id="notes"
              value={notes}
              className="sm:col-span-3"
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row">
            <DialogClose asChild>
              <Button
                onClick={() => setEditDialogOpen(false)}
                type="button"
                variant={"secondary"}
              >
                Cancel
              </Button>
            </DialogClose>
            <Button onClick={handleSave} type="submit">
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditPgnDialog;
