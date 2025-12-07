/**
 * Recipe Generator - generate and store AI-created recipes.
 *
 * Design goals:
 * - Capture user prompts and preferences.
 * - Store generated recipes separately from Meal Planner app.
 * - Ingredients + steps per recipe for clean UI.
 */

import { defineTable, column, NOW } from "astro:db";

export const RecipeIdeaSessions = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    userId: column.text(),

    title: column.text({ optional: true }),         // "High-protein breakfast ideas"
    prompt: column.text({ optional: true }),
    cuisinePreference: column.text({ optional: true }),
    dietaryPreference: column.text({ optional: true }), // "vegan", "vegetarian", "keto"
    servingCount: column.number({ optional: true }),

    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const GeneratedRecipes = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    sessionId: column.text({
      references: () => RecipeIdeaSessions.columns.id,
      optional: true,
    }),
    userId: column.text(),

    title: column.text(),                           // "Spicy Paneer Wrap"
    description: column.text({ optional: true }),
    cuisine: column.text({ optional: true }),
    mealType: column.text({ optional: true }),      // "breakfast", "lunch", etc.
    tags: column.text({ optional: true }),

    servings: column.number({ optional: true }),
    prepTimeMinutes: column.number({ optional: true }),
    cookTimeMinutes: column.number({ optional: true }),

    notes: column.text({ optional: true }),
    isFavorite: column.boolean({ default: false }),

    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const GeneratedRecipeIngredients = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    recipeId: column.text({
      references: () => GeneratedRecipes.columns.id,
    }),

    orderIndex: column.number({ optional: true }),
    name: column.text(),                            // "Onion", "Olive oil"
    quantity: column.text({ optional: true }),      // free-text "2", "1/2 cup"
    notes: column.text({ optional: true }),         // "finely chopped"

    createdAt: column.date({ default: NOW }),
  },
});

export const GeneratedRecipeSteps = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    recipeId: column.text({
      references: () => GeneratedRecipes.columns.id,
    }),

    orderIndex: column.number(),                    // 1, 2, 3...
    instruction: column.text(),                     // step text
    tip: column.text({ optional: true }),           // optional hints

    createdAt: column.date({ default: NOW }),
  },
});

export const tables = {
  RecipeIdeaSessions,
  GeneratedRecipes,
  GeneratedRecipeIngredients,
  GeneratedRecipeSteps,
} as const;
