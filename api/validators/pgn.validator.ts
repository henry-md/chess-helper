import Joi from "joi";

export const createPgnSchema = Joi.object({
  title: Joi.string().required().trim().min(1).max(100),
  moveText: Joi.string().required().trim(),
  notes: Joi.string().allow("").trim().default(""),
  isPublic: Joi.boolean().default(false),
  gameSettings: Joi.object({
    isPlayingWhite: Joi.boolean().default(true),
    isSkipping: Joi.boolean().default(false),
  }),
});

export const updatePgnSchema = Joi.object({
  title: Joi.string().trim().min(1).max(100),
  moveText: Joi.string().trim(),
  notes: Joi.string().allow("").trim(),
  isPublic: Joi.boolean(),
  gameProgress: Joi.object({
    visitedNodeHashes: Joi.array().items(Joi.string()),
  }),
  gameSettings: Joi.object({
    isPlayingWhite: Joi.boolean(),
    isSkipping: Joi.boolean(),
  }),
}).min(1); // Require at least one field to be present

export const pgnIdSchema = Joi.object({
  id: Joi.string().required().hex().length(24), // MongoDB ObjectId validation
});
