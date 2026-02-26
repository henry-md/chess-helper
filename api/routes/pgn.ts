import { Pgn } from "../models/Pgn";
import { authGuard } from "../middleware/auth-guard";
import { Router } from "express";
import logger from "../utils/logger";
import { validate } from "../middleware/validate";
import {
  createPgnSchema,
  updatePgnSchema,
  pgnIdSchema,
} from "../validators/pgn.validator";
import { RequestHandler } from "express";
import { getFenBeforeFirstBranch } from "../utils/pgn-parser";
import { flatten } from 'flat';
import { IPgnDocument } from "../models/Pgn";

const pgnRouter = Router();
const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const normalizePgnDocument = (pgn: IPgnDocument) => {
  const pgnObject = pgn.toObject();
  return {
    ...pgnObject,
    gameProgress: {
      visitedNodeHashes: pgnObject.gameProgress?.visitedNodeHashes ?? [],
    },
    gameSettings: {
      isPlayingWhite: pgnObject.gameSettings?.isPlayingWhite ?? true,
      isSkipping: pgnObject.gameSettings?.isSkipping ?? false,
    },
    gameMetadata: {
      fenBeforeFirstBranch: pgnObject.gameMetadata?.fenBeforeFirstBranch ?? START_FEN,
    },
  };
};

pgnRouter.get("/test-pgn", async (req, res) => {
  res.status(200).json({ message: "Hello Pgn", success: true });
});

pgnRouter.get(
  "/pgn/:id",
  authGuard,
  validate(pgnIdSchema, "params"),
  (async (req, res) => {
    const { id } = req.params;
    const pgn = await Pgn.findById(id);
    if (!pgn) {
      return res.status(404).json({ message: "PGN not found", success: false });
    } else if (pgn.userId !== String(req.user?._id)) {
      return res.status(403).json({
        message: "You are not authorized to access this PGN",
        success: false,
      });
    }
    res.status(200).json({ pgn: normalizePgnDocument(pgn), success: true });
  }) as RequestHandler
);

pgnRouter.get("/pgns", authGuard, async (req, res) => {
  try {
    const pgns = await Pgn.find({ userId: req.user?._id });
    logger.debug(`Found ${pgns.length} PGNs for user ${req.user?.username || "Unknown"}`);
    res.status(200).json({ pgns: pgns.map(normalizePgnDocument), success: true });
  } catch (error) {
    logger.error(`Error fetching PGNs for user ${req.user?.username || "Unknown"}: ${error}`);
    res.status(500).json({ message: "Error fetching PGNs", success: false });
  }
});

pgnRouter.post(
  "/pgn",
  authGuard,
  validate(createPgnSchema),
  (async (req, res) => {
    try {
      const { title, moveText, notes, isPublic = false } = req.body;
      logger.debug(
        `[pgnRouter] Creating PGN ${title} with ${moveText} and ${notes} and ${isPublic}`
      );

      // check if title already exists
      const existingPgns = await Pgn.find({ userId: req.user?._id });
      if (existingPgns.some((pgn) => pgn.title === title)) {
        return res
          .status(400)
          .json({ message: "Title already exists", success: false });
      }

      // Get FEN before first branch
      const fenBeforeFirstBranch = getFenBeforeFirstBranch(moveText);

      // Add PGN to database
      const newPgn = new Pgn({
        userId: req.user?._id,
        title,
        moveText,
        notes,
        isPublic,
        gameProgress: {
          visitedNodeHashes: [],
        },
        gameSettings: {
          isPlayingWhite: true,
          isSkipping: false,
        },
        gameMetadata: {
          fenBeforeFirstBranch,
        },
      });
      await newPgn.save();

      logger.debug(`[pgnRouter] PGN ${title} created successfully`);
      // Return success message
      res.status(201).json({
        message: "PGN added successfully",
        success: true,
        pgn: normalizePgnDocument(newPgn),
      });
    } catch (error) {
      logger.error(`Error adding PGN: ${error}`);
      res.status(500).json({ message: "Error adding PGN", success: false });
    }
  }) as RequestHandler
);

pgnRouter.patch(
  "/pgn/:id",
  authGuard,
  validate(pgnIdSchema, "params"),
  validate(updatePgnSchema),
  (async (req, res) => {
    logger.debug(
      `[pgnRouter] Patching PGN ${req.params.id} with ${JSON.stringify(
        req.body
      )}`
    );
    try {
      const { id } = req.params;

      // Check if PGN exists & user has access rights
      const pgn = await Pgn.findById(id);
      if (!pgn) {
        return res
          .status(404)
          .json({ message: "PGN not found", success: false });
      } else if (pgn.userId !== String(req.user?._id)) {
        return res.status(403).json({
          message: "You are not authorized to update this PGN",
          success: false,
        });
      }

      // Reevaluate fenBeforeFirstBranch
      if (req.body.moveText) {
        req.body.gameMetadata = {
          ...req.body.gameMetadata,
          fenBeforeFirstBranch: getFenBeforeFirstBranch(req.body.moveText)
        };
      }

      // Update PGN (flatten to allow partial nested updates)
      const update: Record<string, any> = flatten(req.body);
      const updatedPgn: IPgnDocument | null = await Pgn.findByIdAndUpdate(
        id,
        { $set: update },
        {
          new: true,
        }
      );

      // Return message
      if (!updatedPgn) {
        return res.status(404).json({ message: "PGN update failed", success: false });
      }
      res.status(200).json({
        message: "PGN updated successfully",
        success: true,
        pgn: normalizePgnDocument(updatedPgn),
      });
    } catch (error) {
      res.status(500).json({ message: "Error updating PGN", success: false });
    }
  }) as RequestHandler
);

pgnRouter.delete(
  "/pgn/:id",
  authGuard,
  validate(pgnIdSchema, "params"),
  (async (req, res) => {
    try {
      const { id } = req.params;
      const pgn = await Pgn.findByIdAndDelete(id);
      res
        .status(200)
        .json({ message: "PGN deleted successfully", success: true, pgn });
    } catch (error) {
      res.status(500).json({ message: "Error deleting PGN", success: false });
    }
  }) as RequestHandler
);

export default pgnRouter;
