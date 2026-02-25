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
import useMutationPgns from "@/hooks/useMutationPgns";

type AddPgnDialogProps = {
  open: boolean;
  setAddDialogOpen: (open: boolean) => void;
};

const AddPgnDialog = ({ open, setAddDialogOpen }: AddPgnDialogProps) => {
  const [title, setTitle] = useState("");
  const [moveText, setMoveText] = useState("");
  const [notes, setNotes] = useState("");
  const { createPgn } = useMutationPgns();

  // Reset values when dialog is closed
  useEffect(() => {
    if (!open) {
      setTitle("");
      setMoveText("");
      setNotes("");
    }
  }, [open]);

  const handleSave = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (title.length === 0 || moveText.length === 0) {
      toast.error("Sorry! Title and PGN cannot be empty 😕");
    } else {
      await createPgn({ title, moveText, notes });
      // triggerPgnsRefresh();
      setAddDialogOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setAddDialogOpen}>
      <DialogContent>
        <form className="grid w-full gap-1.5 p-1 pr-3">
          <DialogTitle>Add PGN</DialogTitle>
          <DialogDescription>
            Add the title, PGN, and notes of your study here.
          </DialogDescription>
          <div className="grid items-center grid-cols-4 gap-8 my-4">
            <Label htmlFor="title" className="text-sm text-right">
              Title
            </Label>
            <Input
              id="title"
              value={title}
              className="col-span-3"
              onChange={(e) => setTitle(e.target.value)}
            />
            <Label htmlFor="pgn" className="text-sm text-right">
              PGN
            </Label>
            <Input
              id="pgn"
              value={moveText}
              className="col-span-3"
              onChange={(e) => setMoveText(e.target.value)}
            />
            <Label htmlFor="notes" className="text-sm text-right">
              Notes
            </Label>
            <Input
              id="notes"
              value={notes}
              className="col-span-3"
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3">
            <DialogClose asChild>
              <Button
                onClick={() => setAddDialogOpen(false)}
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

export default AddPgnDialog;
