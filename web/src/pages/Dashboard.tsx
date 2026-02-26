import { ToastContainer, toast } from "react-toastify";
import Navbar from "../components/Navbar";
import BoardPreview from "../components/BoardPreview";
import { useStore } from "@nanostores/react";
import { useState } from "react";
import useQueryPgns from "@/hooks/useQueryPgns";
import AddPgnDialog from "@/components/BoardAddDialog";
import { StoredPgn } from "@/lib/types";
import { $isAuthenticated } from "@/store/auth";

const Dashboard = () => {
  const isAuthenticated = useStore($isAuthenticated);
  const { pgnArray }: { pgnArray: StoredPgn[] } = useQueryPgns();
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const handleNewStudy = async () => {
    if (!isAuthenticated) {
      toast.info("Please sign in to create a new study.");
      return;
    }
    setAddDialogOpen(true);
  }

  return (
    <>
      <Navbar />
      <div className="mx-auto max-w-[1280px] px-6 pb-12 pt-28">
        <h1 className="mx-auto mb-8 text-center text-3xl font-bold tracking-tight text-foreground">My Studies</h1>
        {pgnArray.length === 0 && (
          <p className="mb-8 text-center text-sm text-muted-foreground">You have no games yet.</p>
        )}
        <div className="mx-auto grid grid-cols-1 gap-16 sm:grid-cols-2 lg:grid-cols-3">
          {
            Array.isArray(pgnArray) && pgnArray.map((pgn: StoredPgn, index) => (
              <BoardPreview key={index} pgn={pgn} gameTitle={pgn.title} isWhite={index % 2 === 0} />
            ))
          }
          <div
            onClick={handleNewStudy}
            className={`cursor-pointer ${!isAuthenticated ? "opacity-60" : ""}`}
          >
            <p className="pb-2 text-center font-medium text-muted-foreground">New Study</p>
            <div className="group relative flex aspect-square w-full items-center justify-center rounded-xl border border-border/70 bg-card/55 shadow-[0_22px_42px_-30px_rgba(2,6,23,0.95)] backdrop-blur-sm transition-colors hover:border-[var(--highlight-ring)]">
              <div className="absolute inset-0 rounded-xl bg-primary/0 opacity-0 transition-opacity group-hover:opacity-100 group-hover:bg-primary/[0.08]"></div>
              <div className="flex h-[84px] w-[84px] items-center justify-center rounded-2xl border border-border/70 bg-accent/55">
                <div className="relative h-10 w-10" aria-hidden="true">
                  <span className="absolute left-1/2 top-1/2 h-[2px] w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground/80"></span>
                  <span className="absolute left-1/2 top-1/2 h-10 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground/80"></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ToastContainer />
      <AddPgnDialog open={addDialogOpen} setAddDialogOpen={setAddDialogOpen} />
    </>
  );
};

export default Dashboard;
