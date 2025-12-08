import type { ActionAPIContext } from "astro:actions";
import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import { randomUUID } from "node:crypto";
import {
  RecipeIdeaSessions,
  GeneratedRecipes,
  GeneratedRecipeIngredients,
  GeneratedRecipeSteps,
  db,
  eq,
  and,
} from "astro:db";

function requireUser(context: ActionAPIContext) {
  const locals = context.locals as App.Locals | undefined;
  const user = locals?.user;

  if (!user) {
    throw new ActionError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action.",
    });
  }

  return user;
}

const recipeSessionSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  prompt: z.string().optional(),
  cuisinePreference: z.string().optional(),
  dietaryPreference: z.string().optional(),
  servingCount: z.number().int().positive().optional(),
});

const ingredientSchema = z.object({
  id: z.string().optional(),
  orderIndex: z.number().int().nonnegative().optional(),
  name: z.string().min(1),
  quantity: z.string().optional(),
  notes: z.string().optional(),
});

const stepSchema = z.object({
  id: z.string().optional(),
  orderIndex: z.number().int().min(1),
  instruction: z.string().min(1),
  tip: z.string().optional(),
});

export const server = {
  createRecipeIdeaSession: defineAction({
    input: recipeSessionSchema.omit({ id: true }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const now = new Date();
      const id = randomUUID();

      await db.insert(RecipeIdeaSessions).values({
        id,
        userId: user.id,
        title: input.title,
        prompt: input.prompt,
        cuisinePreference: input.cuisinePreference,
        dietaryPreference: input.dietaryPreference,
        servingCount: input.servingCount,
        createdAt: now,
        updatedAt: now,
      });

      return {
        success: true,
        data: { id },
      };
    },
  }),

  updateRecipeIdeaSession: defineAction({
    input: recipeSessionSchema,
    handler: async (input, context) => {
      const user = requireUser(context);
      const now = new Date();

      const existing = await db
        .select()
        .from(RecipeIdeaSessions)
        .where(
          and(
            eq(RecipeIdeaSessions.id, input.id),
            eq(RecipeIdeaSessions.userId, user.id)
          )
        );

      if (existing.length === 0) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Recipe idea session not found.",
        });
      }

      const updateData: Partial<typeof RecipeIdeaSessions.$inferInsert> = {
        updatedAt: now,
      };

      if (input.title !== undefined) updateData.title = input.title;
      if (input.prompt !== undefined) updateData.prompt = input.prompt;
      if (input.cuisinePreference !== undefined)
        updateData.cuisinePreference = input.cuisinePreference;
      if (input.dietaryPreference !== undefined)
        updateData.dietaryPreference = input.dietaryPreference;
      if (input.servingCount !== undefined)
        updateData.servingCount = input.servingCount;

      await db
        .update(RecipeIdeaSessions)
        .set(updateData)
        .where(
          and(
            eq(RecipeIdeaSessions.id, input.id),
            eq(RecipeIdeaSessions.userId, user.id)
          )
        );

      return {
        success: true,
        data: { id: input.id },
      };
    },
  }),

  listRecipeIdeaSessions: defineAction({
    input: z.object({
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().positive().max(100).default(20),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const offset = (input.page - 1) * input.pageSize;

      const items = await db
        .select()
        .from(RecipeIdeaSessions)
        .where(eq(RecipeIdeaSessions.userId, user.id))
        .orderBy(RecipeIdeaSessions.createdAt)
        .limit(input.pageSize)
        .offset(offset);

      return {
        success: true,
        data: {
          items,
          total: items.length,
          page: input.page,
          pageSize: input.pageSize,
        },
      };
    },
  }),

  upsertGeneratedRecipe: defineAction({
    input: z.object({
      id: z.string().optional(),
      sessionId: z.string().optional(),
      title: z.string().min(1),
      description: z.string().optional(),
      cuisine: z.string().optional(),
      mealType: z.string().optional(),
      tags: z.string().optional(),
      servings: z.number().int().positive().optional(),
      prepTimeMinutes: z.number().int().nonnegative().optional(),
      cookTimeMinutes: z.number().int().nonnegative().optional(),
      notes: z.string().optional(),
      isFavorite: z.boolean().optional(),
      ingredients: z.array(ingredientSchema).optional(),
      steps: z.array(stepSchema).optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const now = new Date();

      if (input.sessionId) {
        const session = await db
          .select()
          .from(RecipeIdeaSessions)
          .where(
            and(
              eq(RecipeIdeaSessions.id, input.sessionId),
              eq(RecipeIdeaSessions.userId, user.id)
            )
          );

        if (session.length === 0) {
          throw new ActionError({
            code: "NOT_FOUND",
            message: "Linked recipe idea session not found.",
          });
        }
      }

      const recipeId = input.id ?? randomUUID();

      if (input.id) {
        const existing = await db
          .select()
          .from(GeneratedRecipes)
          .where(
            and(
              eq(GeneratedRecipes.id, input.id),
              eq(GeneratedRecipes.userId, user.id)
            )
          );

        if (existing.length === 0) {
          throw new ActionError({
            code: "NOT_FOUND",
            message: "Generated recipe not found.",
          });
        }

        const updateData: Partial<typeof GeneratedRecipes.$inferInsert> = {
          updatedAt: now,
        };

        if (input.sessionId !== undefined) updateData.sessionId = input.sessionId;
        updateData.title = input.title;
        updateData.description = input.description;
        updateData.cuisine = input.cuisine;
        updateData.mealType = input.mealType;
        updateData.tags = input.tags;
        updateData.servings = input.servings;
        updateData.prepTimeMinutes = input.prepTimeMinutes;
        updateData.cookTimeMinutes = input.cookTimeMinutes;
        updateData.notes = input.notes;
        if (input.isFavorite !== undefined) updateData.isFavorite = input.isFavorite;

        await db
          .update(GeneratedRecipes)
          .set(updateData)
          .where(
            and(
              eq(GeneratedRecipes.id, recipeId),
              eq(GeneratedRecipes.userId, user.id)
            )
          );
      } else {
        await db.insert(GeneratedRecipes).values({
          id: recipeId,
          sessionId: input.sessionId,
          userId: user.id,
          title: input.title,
          description: input.description,
          cuisine: input.cuisine,
          mealType: input.mealType,
          tags: input.tags,
          servings: input.servings,
          prepTimeMinutes: input.prepTimeMinutes,
          cookTimeMinutes: input.cookTimeMinutes,
          notes: input.notes,
          isFavorite: input.isFavorite ?? false,
          createdAt: now,
          updatedAt: now,
        });
      }

      if (input.ingredients) {
        await db
          .delete(GeneratedRecipeIngredients)
          .where(eq(GeneratedRecipeIngredients.recipeId, recipeId));

        if (input.ingredients.length > 0) {
          await db.insert(GeneratedRecipeIngredients).values(
            input.ingredients.map((ingredient) => ({
              id: ingredient.id ?? randomUUID(),
              recipeId,
              orderIndex: ingredient.orderIndex,
              name: ingredient.name,
              quantity: ingredient.quantity,
              notes: ingredient.notes,
              createdAt: now,
            }))
          );
        }
      }

      if (input.steps) {
        await db
          .delete(GeneratedRecipeSteps)
          .where(eq(GeneratedRecipeSteps.recipeId, recipeId));

        if (input.steps.length > 0) {
          await db.insert(GeneratedRecipeSteps).values(
            input.steps.map((step) => ({
              id: step.id ?? randomUUID(),
              recipeId,
              orderIndex: step.orderIndex,
              instruction: step.instruction,
              tip: step.tip,
              createdAt: now,
            }))
          );
        }
      }

      return {
        success: true,
        data: { id: recipeId },
      };
    },
  }),

  listGeneratedRecipes: defineAction({
    input: z.object({
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().positive().max(100).default(20),
      sessionId: z.string().optional(),
      favoritesOnly: z.boolean().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const offset = (input.page - 1) * input.pageSize;

      let filters = eq(GeneratedRecipes.userId, user.id);

      if (input.sessionId) {
        filters = and(filters, eq(GeneratedRecipes.sessionId, input.sessionId));
      }

      if (input.favoritesOnly) {
        filters = and(filters, eq(GeneratedRecipes.isFavorite, true));
      }

      const items = await db
        .select()
        .from(GeneratedRecipes)
        .where(filters)
        .orderBy(GeneratedRecipes.createdAt)
        .limit(input.pageSize)
        .offset(offset);

      return {
        success: true,
        data: {
          items,
          total: items.length,
          page: input.page,
          pageSize: input.pageSize,
        },
      };
    },
  }),
};
