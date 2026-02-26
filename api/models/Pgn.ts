import mongoose, { Document, Types } from "mongoose";

/* Should match web/src/lib/types.ts */
export interface IPgn {
  userId: string;
  title: string;
  moveText: string;
  notes: string;
  isPublic: boolean;
  gameProgress: {
    visitedNodeHashes: string[];
  };
  gameSettings: {
    isPlayingWhite: boolean;
    isSkipping: boolean;
  };
  gameMetadata: {
    fenBeforeFirstBranch: string;
  };
}

// Document adds properties like _id, createdAt, etc.
export interface IPgnDocument extends IPgn, Document {
  _id: Types.ObjectId;
  createdAt: Date;
}

// Put pgnSchema inside userSchema to avoid an O(n) lookup
const pgnSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
  },
  moveText: {
    type: String,
    required: true,
  },
  notes: {
    type: String,
    default: "",
    required: false,
  },
  isPublic: {
    type: Boolean,
    default: false,
  },
  gameProgress: {
    visitedNodeHashes: {
      type: [String],
      default: [],
    },
  },
  gameSettings: {
    isPlayingWhite: {
      type: Boolean,
      default: true,
    },
    isSkipping: {
      type: Boolean,
      default: false,
    },
  },
  gameMetadata: {
    fenBeforeFirstBranch: {
      type: String,
      default: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const Pgn = mongoose.model<IPgnDocument>("Pgn", pgnSchema);
