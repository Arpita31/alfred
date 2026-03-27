"""
Rule-based nutrition engine for Alfred Pennyworth.

Processing pipeline:
  1. Clean & tokenise free text
  2. Try direct dish-template lookup
  3. Try ingredient parsing (qty + unit + ingredient + cooking method)
  4. Fuzzy-match each ingredient token against INGREDIENT_DB
  5. Convert units → grams via UNIT_TO_GRAMS + per-ingredient overrides
  6. Apply cooking-method calorie multiplier
  7. Sum macros; scale by servings
  8. Score confidence; fall back to category averages if confidence < 0.4
  9. Return NutritionResult with per-ingredient breakdown

LLM is NOT called here — use as optional fallback in the endpoint layer.
"""
from __future__ import annotations

import re
import math
from dataclasses import dataclass, field
from typing import Optional


# ─────────────────────────────────────────────────────────────────────────────
# 1.  INGREDIENT DATABASE  (per 100 g or 100 ml for liquids)
#     Keys are lowercase, canonical.  Values: cal, pro, carb, fat, fiber (g)
# ─────────────────────────────────────────────────────────────────────────────

INGREDIENT_DB: dict[str, dict[str, float]] = {
    # ── Proteins ──────────────────────────────────────────────────────────────
    "chicken breast":       {"cal": 165, "pro": 31.0, "carb": 0.0, "fat": 3.6,  "fiber": 0.0},
    "chicken thigh":        {"cal": 209, "pro": 26.0, "carb": 0.0, "fat": 11.0, "fiber": 0.0},
    "chicken":              {"cal": 185, "pro": 28.0, "carb": 0.0, "fat": 7.4,  "fiber": 0.0},
    "ground beef":          {"cal": 254, "pro": 26.0, "carb": 0.0, "fat": 17.0, "fiber": 0.0},
    "beef":                 {"cal": 250, "pro": 26.0, "carb": 0.0, "fat": 16.0, "fiber": 0.0},
    "steak":                {"cal": 242, "pro": 28.0, "carb": 0.0, "fat": 14.0, "fiber": 0.0},
    "pork":                 {"cal": 242, "pro": 27.0, "carb": 0.0, "fat": 14.0, "fiber": 0.0},
    "bacon":                {"cal": 417, "pro": 37.0, "carb": 1.4, "fat": 28.0, "fiber": 0.0},
    "salmon":               {"cal": 208, "pro": 20.0, "carb": 0.0, "fat": 13.0, "fiber": 0.0},
    "tuna":                 {"cal": 132, "pro": 28.0, "carb": 0.0, "fat": 1.3,  "fiber": 0.0},
    "tilapia":              {"cal": 96,  "pro": 20.0, "carb": 0.0, "fat": 1.7,  "fiber": 0.0},
    "shrimp":               {"cal": 99,  "pro": 24.0, "carb": 0.3, "fat": 0.3,  "fiber": 0.0},
    "fish":                 {"cal": 120, "pro": 22.0, "carb": 0.0, "fat": 3.0,  "fiber": 0.0},
    "egg":                  {"cal": 155, "pro": 13.0, "carb": 1.1, "fat": 11.0, "fiber": 0.0},
    "eggs":                 {"cal": 155, "pro": 13.0, "carb": 1.1, "fat": 11.0, "fiber": 0.0},
    "tofu":                 {"cal": 76,  "pro": 8.0,  "carb": 1.9, "fat": 4.8,  "fiber": 0.3},
    "tempeh":               {"cal": 193, "pro": 19.0, "carb": 9.0, "fat": 11.0, "fiber": 0.0},
    "lentils":              {"cal": 116, "pro": 9.0,  "carb": 20.0,"fat": 0.4,  "fiber": 7.9},
    "chickpeas":            {"cal": 164, "pro": 8.9,  "carb": 27.0,"fat": 2.6,  "fiber": 7.6},
    "black beans":          {"cal": 132, "pro": 8.9,  "carb": 24.0,"fat": 0.5,  "fiber": 8.7},
    "kidney beans":         {"cal": 127, "pro": 8.7,  "carb": 22.8,"fat": 0.5,  "fiber": 6.4},
    "edamame":              {"cal": 122, "pro": 11.0, "carb": 8.9, "fat": 5.2,  "fiber": 5.2},

    # ── Grains & Carbs ────────────────────────────────────────────────────────
    "white rice":           {"cal": 130, "pro": 2.7,  "carb": 28.0,"fat": 0.3,  "fiber": 0.4},
    "brown rice":           {"cal": 123, "pro": 2.6,  "carb": 26.0,"fat": 0.9,  "fiber": 1.8},
    "rice":                 {"cal": 130, "pro": 2.7,  "carb": 28.0,"fat": 0.3,  "fiber": 0.4},
    "pasta":                {"cal": 131, "pro": 5.0,  "carb": 25.0,"fat": 1.1,  "fiber": 1.8},
    "spaghetti":            {"cal": 131, "pro": 5.0,  "carb": 25.0,"fat": 1.1,  "fiber": 1.8},
    "noodles":              {"cal": 138, "pro": 4.5,  "carb": 25.0,"fat": 2.2,  "fiber": 1.0},
    "bread":                {"cal": 265, "pro": 9.0,  "carb": 49.0,"fat": 3.2,  "fiber": 2.7},
    "white bread":          {"cal": 265, "pro": 9.0,  "carb": 49.0,"fat": 3.2,  "fiber": 2.7},
    "whole wheat bread":    {"cal": 247, "pro": 13.0, "carb": 41.0,"fat": 3.4,  "fiber": 6.0},
    "tortilla":             {"cal": 218, "pro": 5.7,  "carb": 38.0,"fat": 5.2,  "fiber": 2.7},
    "naan":                 {"cal": 317, "pro": 9.0,  "carb": 55.0,"fat": 7.0,  "fiber": 2.1},
    "roti":                 {"cal": 297, "pro": 9.0,  "carb": 55.0,"fat": 5.0,  "fiber": 3.5},
    "oats":                 {"cal": 389, "pro": 17.0, "carb": 66.0,"fat": 7.0,  "fiber": 10.6},
    "oatmeal":              {"cal": 71,  "pro": 2.5,  "carb": 12.0,"fat": 1.4,  "fiber": 1.7},
    "quinoa":               {"cal": 120, "pro": 4.4,  "carb": 22.0,"fat": 1.9,  "fiber": 2.8},
    "flour":                {"cal": 364, "pro": 10.0, "carb": 76.0,"fat": 1.0,  "fiber": 2.7},
    "potato":               {"cal": 77,  "pro": 2.0,  "carb": 17.0,"fat": 0.1,  "fiber": 2.2},
    "sweet potato":         {"cal": 86,  "pro": 1.6,  "carb": 20.0,"fat": 0.1,  "fiber": 3.0},
    "corn":                 {"cal": 86,  "pro": 3.3,  "carb": 19.0,"fat": 1.4,  "fiber": 2.7},
    "couscous":             {"cal": 112, "pro": 3.8,  "carb": 23.0,"fat": 0.2,  "fiber": 1.4},

    # ── Dairy ─────────────────────────────────────────────────────────────────
    "whole milk":           {"cal": 61,  "pro": 3.2,  "carb": 4.8, "fat": 3.3,  "fiber": 0.0},
    "skim milk":            {"cal": 35,  "pro": 3.4,  "carb": 5.0, "fat": 0.1,  "fiber": 0.0},
    "milk":                 {"cal": 61,  "pro": 3.2,  "carb": 4.8, "fat": 3.3,  "fiber": 0.0},
    "cheddar cheese":       {"cal": 402, "pro": 25.0, "carb": 1.3, "fat": 33.0, "fiber": 0.0},
    "mozzarella":           {"cal": 280, "pro": 28.0, "carb": 3.1, "fat": 17.0, "fiber": 0.0},
    "cheese":               {"cal": 371, "pro": 23.0, "carb": 1.3, "fat": 30.0, "fiber": 0.0},
    "plain yogurt":         {"cal": 59,  "pro": 3.5,  "carb": 4.7, "fat": 3.3,  "fiber": 0.0},
    "greek yogurt":         {"cal": 59,  "pro": 10.0, "carb": 3.6, "fat": 0.4,  "fiber": 0.0},
    "yogurt":               {"cal": 59,  "pro": 3.5,  "carb": 4.7, "fat": 3.3,  "fiber": 0.0},
    "butter":               {"cal": 717, "pro": 0.9,  "carb": 0.1, "fat": 81.0, "fiber": 0.0},
    "ghee":                 {"cal": 900, "pro": 0.0,  "carb": 0.0, "fat": 100.0,"fiber": 0.0},
    "cream":                {"cal": 340, "pro": 2.1,  "carb": 2.8, "fat": 36.0, "fiber": 0.0},
    "cream cheese":         {"cal": 342, "pro": 6.0,  "carb": 4.1, "fat": 34.0, "fiber": 0.0},

    # ── Vegetables ────────────────────────────────────────────────────────────
    "broccoli":             {"cal": 34,  "pro": 2.8,  "carb": 7.0, "fat": 0.4,  "fiber": 2.6},
    "spinach":              {"cal": 23,  "pro": 2.9,  "carb": 3.6, "fat": 0.4,  "fiber": 2.2},
    "kale":                 {"cal": 35,  "pro": 2.9,  "carb": 4.4, "fat": 1.5,  "fiber": 4.1},
    "carrot":               {"cal": 41,  "pro": 0.9,  "carb": 10.0,"fat": 0.2,  "fiber": 2.8},
    "tomato":               {"cal": 18,  "pro": 0.9,  "carb": 3.9, "fat": 0.2,  "fiber": 1.2},
    "onion":                {"cal": 40,  "pro": 1.1,  "carb": 9.3, "fat": 0.1,  "fiber": 1.7},
    "garlic":               {"cal": 149, "pro": 6.4,  "carb": 33.0,"fat": 0.5,  "fiber": 2.1},
    "bell pepper":          {"cal": 31,  "pro": 1.0,  "carb": 6.0, "fat": 0.3,  "fiber": 2.1},
    "pepper":               {"cal": 31,  "pro": 1.0,  "carb": 6.0, "fat": 0.3,  "fiber": 2.1},
    "cucumber":             {"cal": 15,  "pro": 0.7,  "carb": 3.6, "fat": 0.1,  "fiber": 0.5},
    "lettuce":              {"cal": 15,  "pro": 1.4,  "carb": 2.9, "fat": 0.2,  "fiber": 1.3},
    "cabbage":              {"cal": 25,  "pro": 1.3,  "carb": 5.8, "fat": 0.1,  "fiber": 2.5},
    "cauliflower":          {"cal": 25,  "pro": 1.9,  "carb": 5.0, "fat": 0.3,  "fiber": 2.0},
    "mushroom":             {"cal": 22,  "pro": 3.1,  "carb": 3.3, "fat": 0.3,  "fiber": 1.0},
    "mushrooms":            {"cal": 22,  "pro": 3.1,  "carb": 3.3, "fat": 0.3,  "fiber": 1.0},
    "zucchini":             {"cal": 17,  "pro": 1.2,  "carb": 3.1, "fat": 0.3,  "fiber": 1.0},
    "eggplant":             {"cal": 25,  "pro": 1.0,  "carb": 6.0, "fat": 0.2,  "fiber": 3.0},
    "peas":                 {"cal": 81,  "pro": 5.4,  "carb": 14.0,"fat": 0.4,  "fiber": 5.1},
    "green beans":          {"cal": 31,  "pro": 1.8,  "carb": 7.0, "fat": 0.1,  "fiber": 2.7},
    "celery":               {"cal": 16,  "pro": 0.7,  "carb": 3.0, "fat": 0.2,  "fiber": 1.6},
    "avocado":              {"cal": 160, "pro": 2.0,  "carb": 9.0, "fat": 15.0, "fiber": 7.0},
    "corn":                 {"cal": 86,  "pro": 3.3,  "carb": 19.0,"fat": 1.4,  "fiber": 2.7},

    # ── Fruits ────────────────────────────────────────────────────────────────
    "apple":                {"cal": 52,  "pro": 0.3,  "carb": 14.0,"fat": 0.2,  "fiber": 2.4},
    "banana":               {"cal": 89,  "pro": 1.1,  "carb": 23.0,"fat": 0.3,  "fiber": 2.6},
    "orange":               {"cal": 47,  "pro": 0.9,  "carb": 12.0,"fat": 0.1,  "fiber": 2.4},
    "mango":                {"cal": 60,  "pro": 0.8,  "carb": 15.0,"fat": 0.4,  "fiber": 1.6},
    "strawberry":           {"cal": 32,  "pro": 0.7,  "carb": 7.7, "fat": 0.3,  "fiber": 2.0},
    "strawberries":         {"cal": 32,  "pro": 0.7,  "carb": 7.7, "fat": 0.3,  "fiber": 2.0},
    "blueberry":            {"cal": 57,  "pro": 0.7,  "carb": 14.0,"fat": 0.3,  "fiber": 2.4},
    "blueberries":          {"cal": 57,  "pro": 0.7,  "carb": 14.0,"fat": 0.3,  "fiber": 2.4},
    "grapes":               {"cal": 69,  "pro": 0.7,  "carb": 18.0,"fat": 0.2,  "fiber": 0.9},
    "watermelon":           {"cal": 30,  "pro": 0.6,  "carb": 8.0, "fat": 0.2,  "fiber": 0.4},
    "pineapple":            {"cal": 50,  "pro": 0.5,  "carb": 13.0,"fat": 0.1,  "fiber": 1.4},

    # ── Fats & Oils ───────────────────────────────────────────────────────────
    "olive oil":            {"cal": 884, "pro": 0.0,  "carb": 0.0, "fat": 100.0,"fiber": 0.0},
    "vegetable oil":        {"cal": 884, "pro": 0.0,  "carb": 0.0, "fat": 100.0,"fiber": 0.0},
    "coconut oil":          {"cal": 862, "pro": 0.0,  "carb": 0.0, "fat": 100.0,"fiber": 0.0},
    "oil":                  {"cal": 884, "pro": 0.0,  "carb": 0.0, "fat": 100.0,"fiber": 0.0},
    "peanut butter":        {"cal": 588, "pro": 25.0, "carb": 20.0,"fat": 50.0, "fiber": 6.0},
    "almond butter":        {"cal": 614, "pro": 21.0, "carb": 19.0,"fat": 56.0, "fiber": 7.0},
    "almonds":              {"cal": 579, "pro": 21.0, "carb": 22.0,"fat": 50.0, "fiber": 12.5},
    "cashews":              {"cal": 553, "pro": 18.0, "carb": 30.0,"fat": 44.0, "fiber": 3.3},
    "walnuts":              {"cal": 654, "pro": 15.0, "carb": 14.0,"fat": 65.0, "fiber": 6.7},
    "nuts":                 {"cal": 607, "pro": 18.0, "carb": 21.0,"fat": 54.0, "fiber": 7.0},
    "chia seeds":           {"cal": 486, "pro": 17.0, "carb": 42.0,"fat": 31.0, "fiber": 34.4},
    "sunflower seeds":      {"cal": 584, "pro": 21.0, "carb": 20.0,"fat": 51.0, "fiber": 8.6},

    # ── Sauces & Condiments ───────────────────────────────────────────────────
    "soy sauce":            {"cal": 53,  "pro": 8.1,  "carb": 4.9, "fat": 0.6,  "fiber": 0.8},
    "ketchup":              {"cal": 101, "pro": 1.3,  "carb": 25.0,"fat": 0.1,  "fiber": 0.3},
    "mayonnaise":           {"cal": 680, "pro": 1.0,  "carb": 0.6, "fat": 75.0, "fiber": 0.0},
    "hummus":               {"cal": 166, "pro": 7.9,  "carb": 14.0,"fat": 9.6,  "fiber": 6.0},
    "salsa":                {"cal": 36,  "pro": 1.6,  "carb": 7.0, "fat": 0.2,  "fiber": 1.4},
    "hot sauce":            {"cal": 11,  "pro": 0.5,  "carb": 2.0, "fat": 0.1,  "fiber": 0.0},
    "tomato sauce":         {"cal": 29,  "pro": 1.5,  "carb": 6.0, "fat": 0.2,  "fiber": 1.2},
    "curry paste":          {"cal": 142, "pro": 3.5,  "carb": 10.0,"fat": 10.0, "fiber": 2.0},

    # ── Sweeteners ────────────────────────────────────────────────────────────
    "sugar":                {"cal": 387, "pro": 0.0,  "carb": 100.0,"fat": 0.0, "fiber": 0.0},
    "honey":                {"cal": 304, "pro": 0.3,  "carb": 82.0,"fat": 0.0,  "fiber": 0.2},
    "maple syrup":          {"cal": 260, "pro": 0.0,  "carb": 67.0,"fat": 0.1,  "fiber": 0.0},

    # ── Beverages (per 100 ml) ────────────────────────────────────────────────
    "coffee":               {"cal": 1,   "pro": 0.1,  "carb": 0.0, "fat": 0.0,  "fiber": 0.0},
    "green tea":            {"cal": 1,   "pro": 0.2,  "carb": 0.0, "fat": 0.0,  "fiber": 0.0},
    "orange juice":         {"cal": 45,  "pro": 0.7,  "carb": 10.0,"fat": 0.2,  "fiber": 0.2},
    "apple juice":          {"cal": 46,  "pro": 0.1,  "carb": 11.0,"fat": 0.1,  "fiber": 0.2},
}


# ─────────────────────────────────────────────────────────────────────────────
# 2.  UNIT CONVERSION TABLE  → grams (or ml, treated equally)
# ─────────────────────────────────────────────────────────────────────────────

UNIT_TO_GRAMS: dict[str, float] = {
    "g": 1.0,  "gram": 1.0, "grams": 1.0,
    "kg": 1000.0,
    "ml": 1.0, "milliliter": 1.0, "milliliters": 1.0,
    "l": 1000.0, "liter": 1000.0, "liters": 1000.0,
    "oz": 28.35,
    "lb": 453.6, "lbs": 453.6, "pound": 453.6, "pounds": 453.6,
    "cup": 240.0,  # liquid default; overridden per ingredient below
    "cups": 240.0,
    "tbsp": 15.0, "tablespoon": 15.0, "tablespoons": 15.0,
    "tsp": 5.0, "teaspoon": 5.0, "teaspoons": 5.0,
    "handful": 30.0,
    "slice": 30.0, "slices": 30.0,
    "piece": 100.0, "pieces": 100.0,
    "serving": 150.0, "servings": 150.0,
    "portion": 150.0,
    "bowl": 300.0,
    "plate": 350.0,
    "scoop": 30.0,
}

# Per-ingredient cup/piece sizes that override the generic defaults
INGREDIENT_UNIT_OVERRIDES: dict[str, dict[str, float]] = {
    "rice":         {"cup": 185.0,  "tbsp": 12.0},
    "white rice":   {"cup": 185.0,  "tbsp": 12.0},
    "brown rice":   {"cup": 195.0,  "tbsp": 12.0},
    "flour":        {"cup": 120.0,  "tbsp": 8.0},
    "oats":         {"cup": 90.0,   "tbsp": 6.0},
    "oatmeal":      {"cup": 90.0},
    "pasta":        {"cup": 75.0},
    "spaghetti":    {"cup": 75.0},
    "butter":       {"tbsp": 14.0, "tsp": 4.7},
    "ghee":         {"tbsp": 14.0, "tsp": 4.7},
    "oil":          {"tbsp": 14.0, "tsp": 4.7, "cup": 218.0},
    "olive oil":    {"tbsp": 14.0, "tsp": 4.7, "cup": 218.0},
    "vegetable oil":{"tbsp": 14.0, "tsp": 4.7, "cup": 218.0},
    "honey":        {"tbsp": 21.0, "tsp": 7.0},
    "sugar":        {"cup": 200.0, "tbsp": 12.0, "tsp": 4.2},
    "milk":         {"cup": 244.0},
    "yogurt":       {"cup": 245.0},
    "peanut butter":{"tbsp": 16.0},
    "almond butter":{"tbsp": 16.0},
    "soy sauce":    {"tbsp": 18.0, "tsp": 6.0},
    "egg":          {"piece": 50.0},
    "eggs":         {"piece": 50.0},
    "bread":        {"slice": 30.0},
    "apple":        {"piece": 182.0},
    "banana":       {"piece": 118.0},
    "orange":       {"piece": 131.0},
    "potato":       {"piece": 150.0},
    "sweet potato": {"piece": 130.0},
    "chicken breast":{"piece": 174.0},
    "chicken":      {"piece": 174.0},
    "tomato":       {"piece": 123.0},
    "avocado":      {"piece": 150.0},
    "hummus":       {"tbsp": 30.0, "cup": 240.0},
    "cheese":       {"slice": 28.0, "cup": 113.0},
    "mozzarella":   {"cup": 113.0},
    "cheddar cheese":{"slice": 28.0},
    "cream cheese": {"tbsp": 14.5},
    "nuts":         {"cup": 145.0, "handful": 28.0},
    "almonds":      {"cup": 143.0, "handful": 23.0},
    "cashews":      {"cup": 130.0},
    "walnuts":      {"cup": 117.0},
    "chia seeds":   {"tbsp": 11.0, "tsp": 3.7},
    # Small-serving condiments/sweeteners — default "serving" = realistic splash/spoon
    "honey":        {"serving": 20.0,  "tbsp": 21.0, "tsp": 7.0},
    "maple syrup":  {"serving": 20.0,  "tbsp": 20.0, "tsp": 6.7},
    "sugar":        {"serving": 10.0,  "cup": 200.0, "tbsp": 12.0, "tsp": 4.2},
    "butter":       {"serving": 14.0,  "tbsp": 14.0, "tsp": 4.7},
    "ghee":         {"serving": 14.0,  "tbsp": 14.0, "tsp": 4.7},
    "oil":          {"serving": 14.0,  "tbsp": 14.0, "tsp": 4.7, "cup": 218.0},
    "olive oil":    {"serving": 14.0,  "tbsp": 14.0, "tsp": 4.7, "cup": 218.0},
    "vegetable oil":{"serving": 14.0,  "tbsp": 14.0, "tsp": 4.7, "cup": 218.0},
    "soy sauce":    {"serving": 15.0,  "tbsp": 18.0, "tsp": 6.0},
    "ketchup":      {"serving": 17.0,  "tbsp": 17.0},
    "mayonnaise":   {"serving": 14.0,  "tbsp": 14.0},
    "hot sauce":    {"serving": 5.0,   "tsp": 5.0},
    "tomato sauce": {"serving": 60.0,  "cup": 240.0},
    "curry paste":  {"serving": 25.0,  "tbsp": 22.0},
    "salsa":        {"serving": 30.0,  "tbsp": 16.0},
    "hummus":       {"serving": 60.0,  "tbsp": 30.0, "cup": 240.0},
    "cream cheese": {"serving": 28.0,  "tbsp": 14.5},
    "cream":        {"serving": 30.0,  "tbsp": 15.0, "cup": 240.0},
}


# ─────────────────────────────────────────────────────────────────────────────
# 3.  DISH TEMPLATES  → (ingredient_key, grams_per_serving)
#     Represent a typical single serving of each dish.
# ─────────────────────────────────────────────────────────────────────────────

DISH_TEMPLATES: dict[str, list[tuple[str, float]]] = {
    # ── Asian ─────────────────────────────────────────────────────────────────
    "fried rice": [
        ("rice", 175), ("egg", 50), ("peas", 40), ("carrot", 30),
        ("soy sauce", 15), ("vegetable oil", 10), ("onion", 30),
    ],
    "chicken fried rice": [
        ("rice", 175), ("chicken", 80), ("egg", 50), ("peas", 30),
        ("soy sauce", 15), ("vegetable oil", 10), ("onion", 25),
    ],
    "egg fried rice": [
        ("rice", 175), ("egg", 100), ("peas", 30),
        ("soy sauce", 10), ("vegetable oil", 10), ("onion", 20),
    ],
    "nasi goreng": [
        ("rice", 175), ("egg", 50), ("chicken", 60),
        ("soy sauce", 18), ("vegetable oil", 12), ("onion", 30), ("garlic", 5),
    ],
    "chicken rice": [
        ("rice", 180), ("chicken breast", 120),
        ("soy sauce", 10), ("garlic", 5), ("ginger", 5),
    ],
    "ramen": [
        ("noodles", 85), ("chicken", 80), ("egg", 50), ("mushrooms", 40),
        ("soy sauce", 20), ("broccoli", 40), ("onion", 20),
    ],
    "pad thai": [
        ("noodles", 100), ("shrimp", 80), ("egg", 50), ("peas", 30),
        ("peanut butter", 20), ("soy sauce", 15), ("vegetable oil", 10),
    ],
    "stir fry": [
        ("chicken", 120), ("broccoli", 80), ("bell pepper", 60),
        ("mushrooms", 50), ("soy sauce", 20), ("vegetable oil", 12),
    ],
    "chicken stir fry": [
        ("chicken", 130), ("broccoli", 80), ("bell pepper", 60),
        ("mushrooms", 50), ("soy sauce", 20), ("vegetable oil", 12),
    ],
    "beef stir fry": [
        ("beef", 130), ("broccoli", 80), ("bell pepper", 60),
        ("soy sauce", 22), ("vegetable oil", 12),
    ],
    "pho": [
        ("noodles", 100), ("beef", 80), ("onion", 30), ("mushrooms", 30),
        ("soy sauce", 15),
    ],
    "dumplings": [
        ("flour", 80), ("pork", 80), ("cabbage", 50),
        ("soy sauce", 15), ("garlic", 5),
    ],
    "spring rolls": [
        ("rice", 40), ("pork", 50), ("cabbage", 60),
        ("carrot", 30), ("vegetable oil", 15),
    ],
    "sushi": [
        ("rice", 120), ("salmon", 50), ("avocado", 30),
        ("soy sauce", 10), ("nori", 5),
    ],
    "sashimi": [
        ("salmon", 100), ("tuna", 50), ("soy sauce", 15),
    ],
    "miso soup": [
        ("tofu", 80), ("mushrooms", 30), ("soy sauce", 20), ("onion", 20),
    ],
    "gyoza": [
        ("flour", 60), ("pork", 80), ("cabbage", 40), ("vegetable oil", 12),
    ],

    # ── Indian ────────────────────────────────────────────────────────────────
    "butter chicken": [
        ("chicken", 150), ("cream", 60), ("tomato sauce", 80),
        ("butter", 20), ("garlic", 8), ("onion", 40),
    ],
    "chicken curry": [
        ("chicken", 150), ("tomato", 100), ("onion", 50),
        ("curry paste", 25), ("coconut oil", 10), ("garlic", 8),
    ],
    "dal": [
        ("lentils", 120), ("onion", 40), ("tomato", 80),
        ("garlic", 8), ("vegetable oil", 10),
    ],
    "biryani": [
        ("rice", 180), ("chicken", 120), ("onion", 50),
        ("tomato", 40), ("ghee", 15), ("garlic", 8),
    ],
    "chicken biryani": [
        ("rice", 180), ("chicken", 130), ("onion", 50),
        ("tomato", 40), ("ghee", 15), ("garlic", 8),
    ],
    "palak paneer": [
        ("spinach", 150), ("cheese", 80), ("onion", 50),
        ("tomato", 50), ("cream", 30), ("ghee", 12),
    ],
    "samosa": [
        ("flour", 60), ("potato", 100), ("peas", 40), ("vegetable oil", 15),
    ],
    "chana masala": [
        ("chickpeas", 150), ("tomato", 100), ("onion", 50),
        ("garlic", 8), ("vegetable oil", 12),
    ],

    # ── Western ───────────────────────────────────────────────────────────────
    "burger": [
        ("ground beef", 150), ("bread", 60), ("lettuce", 20),
        ("tomato", 40), ("ketchup", 15), ("mayonnaise", 10),
    ],
    "cheeseburger": [
        ("ground beef", 150), ("bread", 60), ("cheddar cheese", 28),
        ("lettuce", 20), ("tomato", 40), ("ketchup", 15),
    ],
    "pizza": [
        ("flour", 130), ("tomato sauce", 60), ("mozzarella", 80),
        ("olive oil", 10),
    ],
    "margherita pizza": [
        ("flour", 130), ("tomato sauce", 60), ("mozzarella", 90), ("olive oil", 10),
    ],
    "pasta bolognese": [
        ("pasta", 100), ("ground beef", 100), ("tomato sauce", 80),
        ("onion", 40), ("olive oil", 10),
    ],
    "spaghetti bolognese": [
        ("spaghetti", 100), ("ground beef", 100), ("tomato sauce", 80),
        ("onion", 40), ("olive oil", 10),
    ],
    "mac and cheese": [
        ("pasta", 100), ("cheddar cheese", 80), ("milk", 80),
        ("butter", 15), ("flour", 10),
    ],
    "grilled chicken": [
        ("chicken breast", 180), ("olive oil", 10), ("garlic", 5),
    ],
    "chicken sandwich": [
        ("chicken breast", 130), ("bread", 60), ("lettuce", 20),
        ("tomato", 40), ("mayonnaise", 15),
    ],
    "blt": [
        ("bacon", 50), ("lettuce", 20), ("tomato", 40),
        ("bread", 60), ("mayonnaise", 15),
    ],
    "steak": [
        ("steak", 200), ("butter", 14), ("garlic", 5),
    ],
    "fish and chips": [
        ("fish", 150), ("potato", 200), ("vegetable oil", 20), ("flour", 30),
    ],
    "caesar salad": [
        ("lettuce", 150), ("chicken breast", 100), ("cheddar cheese", 30),
        ("mayonnaise", 30), ("bread", 20),
    ],
    "greek salad": [
        ("tomato", 100), ("cucumber", 80), ("cheese", 60),
        ("onion", 30), ("olive oil", 15),
    ],
    "garden salad": [
        ("lettuce", 120), ("tomato", 80), ("cucumber", 60),
        ("onion", 20), ("olive oil", 10),
    ],

    # ── Mexican ───────────────────────────────────────────────────────────────
    "tacos": [
        ("tortilla", 60), ("ground beef", 80), ("lettuce", 20),
        ("tomato", 40), ("cheddar cheese", 30), ("salsa", 30),
    ],
    "burrito": [
        ("tortilla", 80), ("rice", 100), ("black beans", 80),
        ("ground beef", 100), ("cheddar cheese", 40), ("salsa", 30),
    ],
    "quesadilla": [
        ("tortilla", 80), ("cheddar cheese", 80), ("chicken", 80),
        ("vegetable oil", 8),
    ],
    "nachos": [
        ("corn", 100), ("cheddar cheese", 80), ("salsa", 40),
        ("sour cream", 30), ("avocado", 50),
    ],
    "guacamole": [
        ("avocado", 150), ("tomato", 40), ("onion", 20), ("lime", 10),
    ],

    # ── Breakfast ─────────────────────────────────────────────────────────────
    "oatmeal": [
        ("oats", 80), ("milk", 200), ("banana", 60), ("honey", 15),
    ],
    "scrambled eggs": [
        ("eggs", 150), ("butter", 10), ("milk", 30),
    ],
    "fried eggs": [
        ("eggs", 150), ("butter", 12),
    ],
    "boiled eggs": [
        ("eggs", 150),
    ],
    "eggs on toast": [
        ("eggs", 100), ("bread", 60), ("butter", 7),
    ],
    "avocado toast": [
        ("bread", 60), ("avocado", 100), ("eggs", 50), ("olive oil", 5),
    ],
    "pancakes": [
        ("flour", 100), ("egg", 50), ("milk", 120),
        ("butter", 15), ("sugar", 10), ("maple syrup", 30),
    ],
    "french toast": [
        ("bread", 90), ("egg", 100), ("milk", 60),
        ("butter", 12), ("maple syrup", 25),
    ],
    "granola": [
        ("oats", 100), ("honey", 20), ("almonds", 30),
        ("sunflower seeds", 15), ("vegetable oil", 10),
    ],
    "smoothie bowl": [
        ("banana", 100), ("strawberries", 80), ("blueberries", 60),
        ("greek yogurt", 100), ("honey", 10),
    ],

    # ── Soups & Stews ─────────────────────────────────────────────────────────
    "chicken soup": [
        ("chicken", 100), ("carrot", 60), ("celery", 40),
        ("onion", 40), ("noodles", 50),
    ],
    "tomato soup": [
        ("tomato", 200), ("cream", 40), ("onion", 40), ("butter", 10),
    ],
    "lentil soup": [
        ("lentils", 120), ("tomato", 80), ("onion", 50),
        ("carrot", 50), ("vegetable oil", 10),
    ],
    "vegetable soup": [
        ("carrot", 60), ("celery", 40), ("onion", 40),
        ("potato", 80), ("tomato", 60),
    ],
    "minestrone": [
        ("pasta", 50), ("tomato", 80), ("onion", 40),
        ("carrot", 50), ("kidney beans", 60), ("vegetable oil", 10),
    ],

    # ── Snacks ────────────────────────────────────────────────────────────────
    "fruit salad": [
        ("apple", 80), ("mango", 70), ("grapes", 60),
        ("strawberries", 60), ("banana", 50),
    ],
    "peanut butter toast": [
        ("bread", 60), ("peanut butter", 32),
    ],
    "yogurt with fruit": [
        ("greek yogurt", 200), ("strawberries", 80), ("honey", 10),
    ],
    "trail mix": [
        ("almonds", 30), ("cashews", 20), ("walnuts", 20), ("raisins", 20),
    ],
    "hummus and vegetables": [
        ("hummus", 80), ("carrot", 80), ("cucumber", 60), ("bell pepper", 60),
    ],
    "cheese and crackers": [
        ("cheddar cheese", 60), ("bread", 50),
    ],
}

# Aliases — alternative names that map to a canonical template key
DISH_ALIASES: dict[str, str] = {
    "nasi goreng": "nasi goreng",
    "nasi": "fried rice",
    "mee goreng": "stir fry",
    "laksa": "ramen",
    "poke bowl": "sushi",
    "grain bowl": "chicken rice",
    "wrap": "chicken sandwich",
    "sandwich": "chicken sandwich",
    "salad": "garden salad",
    "chicken salad": "caesar salad",
    "soup": "chicken soup",
    "congee": "chicken rice",
    "porridge": "oatmeal",
    "cereal": "oatmeal",
    "oats": "oatmeal",
    "toast": "avocado toast",
    "curry": "chicken curry",
    "stew": "chicken soup",
    "pasta": "pasta bolognese",
    "noodle soup": "ramen",
    "noodle": "ramen",
    "fried noodle": "pad thai",
    "rice bowl": "chicken rice",
    "burrito bowl": "burrito",
    "taco bowl": "tacos",
    "fish taco": "tacos",
}


# ─────────────────────────────────────────────────────────────────────────────
# 4.  COOKING METHOD MULTIPLIERS
#     Applied to calorie total only (fat is the main driver of difference).
# ─────────────────────────────────────────────────────────────────────────────

COOKING_MULTIPLIERS: dict[str, float] = {
    "fried":      1.30,
    "deep fried": 1.45,
    "deep-fried": 1.45,
    "stir fried": 1.20,
    "stir-fried": 1.20,
    "pan fried":  1.20,
    "sauteed":    1.10,
    "sautéed":    1.10,
    "roasted":    1.05,
    "baked":      1.00,
    "grilled":    0.95,
    "steamed":    0.90,
    "boiled":     0.90,
    "poached":    0.88,
    "raw":        0.85,
}


# ─────────────────────────────────────────────────────────────────────────────
# 5.  CATEGORY FALLBACKS  (cal, pro, carb, fat, fiber) per typical serving
#     Used when confidence is too low to trust parsed result.
# ─────────────────────────────────────────────────────────────────────────────

CATEGORY_FALLBACKS: dict[str, tuple[float, float, float, float, float]] = {
    "curry":         (450, 28, 40, 18, 4),
    "stew":          (380, 25, 30, 14, 4),
    "soup":          (200, 12, 22, 6,  3),
    "salad":         (180, 10, 14, 10, 4),
    "sandwich":      (380, 22, 42, 14, 3),
    "burger":        (550, 30, 42, 28, 2),
    "pizza":         (500, 22, 58, 18, 3),
    "pasta":         (480, 20, 68, 12, 4),
    "rice bowl":     (480, 22, 70, 10, 3),
    "noodle":        (420, 18, 60, 10, 2),
    "stir fry":      (380, 28, 30, 14, 4),
    "sushi":         (350, 20, 52, 6,  2),
    "tacos":         (430, 22, 44, 18, 3),
    "breakfast":     (380, 18, 36, 18, 2),
    "smoothie":      (280, 8,  48, 6,  4),
    "snack":         (200, 6,  24, 9,  2),
    "dessert":       (380, 5,  56, 14, 1),
    "drink":         (120, 1,  28, 0,  0),
    "default":       (400, 20, 45, 14, 3),
}

CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "curry":   ["curry", "masala", "tikka", "korma", "vindaloo"],
    "stew":    ["stew", "casserole", "braised", "slow cooked"],
    "soup":    ["soup", "broth", "bisque", "chowder", "pho", "ramen"],
    "salad":   ["salad"],
    "sandwich":["sandwich", "sub", "wrap", "roll", "baguette", "hoagie"],
    "burger":  ["burger", "patty", "bun"],
    "pizza":   ["pizza", "calzone"],
    "pasta":   ["pasta", "spaghetti", "lasagna", "fettuccine", "tagliatelle", "penne"],
    "rice bowl":["rice", "biryani", "pilaf", "congee", "porridge"],
    "noodle":  ["noodle", "ramen", "pho", "pad thai", "lo mein", "udon", "soba"],
    "stir fry":["stir fry", "stir-fry", "wok"],
    "sushi":   ["sushi", "sashimi", "maki", "roll", "poke"],
    "tacos":   ["taco", "burrito", "quesadilla", "nacho", "enchilada"],
    "breakfast":["oatmeal", "pancake", "waffle", "french toast", "cereal", "granola",
                 "egg", "eggs", "omelette", "omelet", "scrambled", "benedict"],
    "smoothie":["smoothie", "shake", "blend", "juice"],
    "dessert": ["cake", "cookie", "brownie", "ice cream", "pudding", "donut",
                "pie", "pastry", "muffin", "waffle"],
    "drink":   ["coffee", "tea", "latte", "cappuccino", "espresso", "milk"],
}


# ─────────────────────────────────────────────────────────────────────────────
# 6.  PARSE HELPERS
# ─────────────────────────────────────────────────────────────────────────────

# Regex to capture  <quantity> <unit?> <ingredient>
_QTY_UNIT_RE = re.compile(
    r"(?P<qty>\d+\.?\d*(?:/\d+)?)"            # number or fraction (e.g. 1/2)
    r"\s*"
    r"(?P<unit>g|kg|ml|l|oz|lb|lbs|cup|cups|tbsp|tablespoon|tablespoons"
    r"|tsp|teaspoon|teaspoons|piece|pieces|slice|slices|handful|"
    r"serving|servings|portion|bowl|plate|scoop)?"
    r"\s+(?:of\s+)?"                           # optional "of"
    r"(?P<ingredient>[a-z][a-z\s\-']*)",
    re.IGNORECASE,
)

_SPLIT_RE = re.compile(r"[,;]|\band\b|\bwith\b|\bplus\b|\bthen\b", re.IGNORECASE)


def _parse_fraction(s: str) -> float:
    """Convert '1/2' → 0.5, '1.5' → 1.5."""
    if "/" in s:
        a, b = s.split("/", 1)
        return float(a) / float(b) if float(b) else 1.0
    return float(s)


def _resolve_grams(qty: float, unit: str, ingredient_key: str) -> float:
    unit = unit.lower().strip()
    overrides = INGREDIENT_UNIT_OVERRIDES.get(ingredient_key, {})
    # For unspecified "serving", prefer per-ingredient override.
    # If none exists but a "piece" override does, use that (e.g. banana, apple, egg).
    if unit == "serving" and "serving" not in overrides and "piece" in overrides:
        g_per_unit = overrides["piece"]
    else:
        g_per_unit = overrides.get(unit) or UNIT_TO_GRAMS.get(unit) or 100.0
    return qty * g_per_unit


def _clean_text(text: str) -> str:
    text = text.lower().strip()
    # Remove parenthetical notes
    text = re.sub(r"\([^)]*\)", " ", text)
    # Normalise dashes/hyphens in compound nouns
    text = re.sub(r"(?<=[a-z])-(?=[a-z])", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text


# ─────────────────────────────────────────────────────────────────────────────
# 7.  FUZZY MATCHING  (no external dependencies — character bigram similarity)
# ─────────────────────────────────────────────────────────────────────────────

def _bigrams(s: str) -> set[str]:
    s = s.lower().strip()
    return {s[i:i+2] for i in range(len(s) - 1)} if len(s) > 1 else {s}


def _dice(a: str, b: str) -> float:
    bg_a = _bigrams(a)
    bg_b = _bigrams(b)
    if not bg_a or not bg_b:
        return 0.0
    return 2 * len(bg_a & bg_b) / (len(bg_a) + len(bg_b))


def fuzzy_match(name: str, threshold: float = 0.45) -> Optional[str]:
    """Return best-matching key from INGREDIENT_DB, or None if below threshold."""
    name = name.lower().strip()
    if name in INGREDIENT_DB:
        return name
    best_key, best_score = None, 0.0
    for key in INGREDIENT_DB:
        # Substring shortcut — fast path
        if name in key or key in name:
            # Prefer shorter, more specific keys
            score = 0.75 + 0.25 * (min(len(name), len(key)) / max(len(name), len(key)))
        else:
            score = _dice(name, key)
        if score > best_score:
            best_score, best_key = score, key
    return best_key if best_score >= threshold else None


# ─────────────────────────────────────────────────────────────────────────────
# 8.  INGREDIENT PARSER
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class ParsedIngredient:
    name: str             # raw token
    matched_key: Optional[str]
    amount_g: float
    confidence: float     # 0–1 for this single ingredient


def parse_ingredients(text: str) -> list[ParsedIngredient]:
    """Parse free-text description into a list of resolved ingredients."""
    text = _clean_text(text)
    tokens = [t.strip() for t in _SPLIT_RE.split(text) if t.strip()]
    results: list[ParsedIngredient] = []

    for token in tokens:
        m = _QTY_UNIT_RE.search(token)
        if m:
            qty_str  = m.group("qty")
            unit_str = m.group("unit") or "g"  # default to grams
            ing_str  = m.group("ingredient").strip()
            qty = _parse_fraction(qty_str)
        else:
            # No qty/unit — treat whole token as ingredient name, assume 1 serving
            ing_str  = token
            qty, unit_str = 1.0, "serving"

        # Strip trailing filler words
        ing_str = re.sub(r"\b(fresh|raw|cooked|hot|cold|dried|frozen|sliced|"
                         r"diced|chopped|minced|boiled|fried|grilled|steamed|"
                         r"baked|roasted|whole|organic|extra|large|small|medium)\b",
                         "", ing_str).strip()

        if len(ing_str) < 2:
            continue

        matched = fuzzy_match(ing_str)
        amount  = _resolve_grams(qty, unit_str, matched or ing_str) if matched else 0.0
        conf    = 0.9 if ing_str in INGREDIENT_DB else (0.65 if matched else 0.15)

        results.append(ParsedIngredient(
            name=ing_str,
            matched_key=matched,
            amount_g=amount,
            confidence=conf,
        ))

    return results


# ─────────────────────────────────────────────────────────────────────────────
# 9.  COOKING METHOD & DISH DETECTION
# ─────────────────────────────────────────────────────────────────────────────

def _detect_cooking_method(text: str) -> float:
    """Return calorie multiplier based on cooking method keywords."""
    text = text.lower()
    for phrase, mult in sorted(COOKING_MULTIPLIERS.items(), key=lambda kv: -len(kv[0])):
        if phrase in text:
            return mult
    return 1.0


def _detect_dish(text: str) -> Optional[str]:
    """Return best dish template key if description matches a known dish."""
    text = _clean_text(text)
    # Direct template key lookup first — longest match wins (more specific)
    matches = [(key, len(key)) for key in DISH_TEMPLATES if key in text]
    if matches:
        return max(matches, key=lambda x: x[1])[0]
    # Alias lookup as fallback — longest alias first to prefer specific over generic
    for alias, canonical in sorted(DISH_ALIASES.items(), key=lambda kv: -len(kv[0])):
        if alias in text and canonical in DISH_TEMPLATES:
            return canonical
    return None


def _detect_category(text: str) -> str:
    text = text.lower()
    for cat, keywords in CATEGORY_KEYWORDS.items():
        if any(kw in text for kw in keywords):
            return cat
    return "default"


# ─────────────────────────────────────────────────────────────────────────────
# 10.  MACRO CALCULATOR
# ─────────────────────────────────────────────────────────────────────────────

def _calc_from_ingredients(
    ingredients: list[tuple[str, float]],  # (ingredient_key, grams)
    cooking_mult: float = 1.0,
) -> tuple[float, float, float, float, float]:
    """Return (cal, pro, carb, fat, fiber) for ingredient list."""
    cal = pro = carb = fat = fiber = 0.0
    for key, grams in ingredients:
        info = INGREDIENT_DB.get(key)
        if not info:
            continue
        f = grams / 100.0
        cal   += info["cal"]   * f
        pro   += info["pro"]   * f
        carb  += info["carb"]  * f
        fat   += info["fat"]   * f
        fiber += info["fiber"] * f
    return (
        round(cal * cooking_mult, 1),
        round(pro, 1),
        round(carb, 1),
        round(fat, 1),
        round(fiber, 1),
    )


# ─────────────────────────────────────────────────────────────────────────────
# 11.  CONFIDENCE SCORING
# ─────────────────────────────────────────────────────────────────────────────

def _score_confidence(parsed: list[ParsedIngredient]) -> float:
    """Rule-based confidence from parse quality."""
    if not parsed:
        return 0.0
    # Proportion of tokens that matched
    matched = sum(1 for p in parsed if p.matched_key)
    match_rate = matched / len(parsed)
    # Average per-token confidence
    avg_conf = sum(p.confidence for p in parsed) / len(parsed)
    # Boost if quantities were explicitly given
    qty_bonus = 0.1 if any(p.amount_g > 0 and p.confidence >= 0.6 for p in parsed) else 0.0
    return min(1.0, round(match_rate * avg_conf + qty_bonus, 3))


# ─────────────────────────────────────────────────────────────────────────────
# 12.  MAIN ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class NutritionResult:
    calories:  float
    protein_g: float
    carbs_g:   float
    fat_g:     float
    fiber_g:   float
    confidence: float           # 0–1  (≥0.7 = reliable, <0.4 = fallback used)
    method:    str              # "template" | "parsed" | "fallback" | "hybrid"
    ingredients: list[ParsedIngredient] = field(default_factory=list)
    dish_matched: Optional[str] = None


def estimate_nutrition(description: str, servings: float = 1.0) -> NutritionResult:
    """
    Estimate nutrition for a meal description.

    Priority order:
      1. Dish template match  → high confidence
      2. Ingredient parsing   → medium confidence
      3. Category fallback    → low confidence
    """
    if not description or not description.strip():
        fb = CATEGORY_FALLBACKS["default"]
        return NutritionResult(*[v * servings for v in fb],
                               confidence=0.1, method="fallback")

    text = _clean_text(description)
    cooking_mult = _detect_cooking_method(text)

    # ── Path 1: dish template ────────────────────────────────────────────────
    dish_key = _detect_dish(text)
    if dish_key:
        template = DISH_TEMPLATES[dish_key]
        cal, pro, carb, fat, fiber = _calc_from_ingredients(template, cooking_mult)
        # Scale to servings
        return NutritionResult(
            calories   = round(cal   * servings, 1),
            protein_g  = round(pro   * servings, 1),
            carbs_g    = round(carb  * servings, 1),
            fat_g      = round(fat   * servings, 1),
            fiber_g    = round(fiber * servings, 1),
            confidence = 0.82,
            method     = "template",
            dish_matched = dish_key,
        )

    # ── Path 2: ingredient parsing ───────────────────────────────────────────
    parsed = parse_ingredients(text)
    if parsed:
        resolved = [(p.matched_key, p.amount_g) for p in parsed if p.matched_key]
        if resolved:
            cal, pro, carb, fat, fiber = _calc_from_ingredients(resolved, cooking_mult)
            conf = _score_confidence(parsed)
            if conf >= 0.35:
                return NutritionResult(
                    calories   = round(cal   * servings, 1),
                    protein_g  = round(pro   * servings, 1),
                    carbs_g    = round(carb  * servings, 1),
                    fat_g      = round(fat   * servings, 1),
                    fiber_g    = round(fiber * servings, 1),
                    confidence = conf,
                    method     = "parsed",
                    ingredients = parsed,
                )

    # ── Path 3: category fallback ────────────────────────────────────────────
    category = _detect_category(text)
    fb = CATEGORY_FALLBACKS.get(category, CATEGORY_FALLBACKS["default"])
    return NutritionResult(
        calories   = round(fb[0] * servings, 1),
        protein_g  = round(fb[1] * servings, 1),
        carbs_g    = round(fb[2] * servings, 1),
        fat_g      = round(fb[3] * servings, 1),
        fiber_g    = round(fb[4] * servings, 1),
        confidence = 0.25,
        method     = "fallback",
        ingredients = parsed,
    )


# ─────────────────────────────────────────────────────────────────────────────
# 13.  SMART SUGGESTIONS  (history-based)
# ─────────────────────────────────────────────────────────────────────────────

def suggest_dishes(history: list[str], limit: int = 5) -> list[str]:
    """
    Rank dish suggestions by:
      1. Frequency in user history
      2. Most common dishes globally (fallback)
    """
    freq: dict[str, int] = {}
    for desc in history:
        text = _clean_text(desc)
        for key in DISH_TEMPLATES:
            if key in text:
                freq[key] = freq.get(key, 0) + 1
        for alias, canonical in DISH_ALIASES.items():
            if alias in text and canonical in DISH_TEMPLATES:
                freq[canonical] = freq.get(canonical, 0) + 1

    # Default popularity ranking (most common globally)
    DEFAULT_POPULAR = [
        "chicken rice", "fried rice", "pasta bolognese", "grilled chicken",
        "scrambled eggs", "oatmeal", "chicken stir fry", "caesar salad",
        "eggs on toast", "chicken soup",
    ]

    seen: set[str] = set()
    result: list[str] = []

    # History-driven suggestions first
    for dish in sorted(freq, key=lambda k: -freq[k]):
        if dish not in seen:
            result.append(dish)
            seen.add(dish)
        if len(result) == limit:
            return result

    # Fill remainder with popular defaults
    for dish in DEFAULT_POPULAR:
        if dish not in seen:
            result.append(dish)
            seen.add(dish)
        if len(result) == limit:
            return result

    return result


# ─────────────────────────────────────────────────────────────────────────────
# 14.  GPT FALLBACK  (called only when rule-based confidence < 0.35)
# ─────────────────────────────────────────────────────────────────────────────

_GPT_SYSTEM = """\
You are a precise nutrition database. Given a meal description, return its
nutritional content as JSON. Base values on standard nutritional references
(USDA / typical restaurant portions). Be conservative, not generous.

Respond ONLY with valid JSON matching this schema exactly:
{
  "calories":  <number, kcal for 1 serving>,
  "protein_g": <number>,
  "carbs_g":   <number>,
  "fat_g":     <number>,
  "fiber_g":   <number>,
  "dish_name": "<canonical dish name>",
  "ingredients": [
    {"name": "<ingredient name>", "amount_g": <number>}
  ]
}"""


async def _gpt_nutrition(description: str) -> Optional[NutritionResult]:
    """
    Ask GPT-4o-mini for nutrition of an unknown dish (1 serving).
    Returns None if the API key is missing or the call fails.
    """
    import json as _json
    try:
        from openai import AsyncOpenAI
        from app.core.config import settings
        from app.core.logging import logger
    except ImportError:
        return None

    if not getattr(settings, "OPENAI_API_KEY", None):
        return None

    try:
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        resp = await client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": _GPT_SYSTEM},
                {"role": "user",   "content": f'Meal: "{description}"'},
            ],
            max_tokens=400,
            temperature=0.1,
        )
        data = _json.loads(resp.choices[0].message.content)

        ingredients = [
            ParsedIngredient(
                name=ing.get("name", ""),
                matched_key=fuzzy_match(ing.get("name", "")),
                amount_g=float(ing.get("amount_g", 100)),
                confidence=0.5,
            )
            for ing in data.get("ingredients", [])
        ]

        return NutritionResult(
            calories     = round(float(data.get("calories",  0)), 1),
            protein_g    = round(float(data.get("protein_g", 0)), 1),
            carbs_g      = round(float(data.get("carbs_g",   0)), 1),
            fat_g        = round(float(data.get("fat_g",     0)), 1),
            fiber_g      = round(float(data.get("fiber_g",   0)), 1),
            confidence   = 0.65,
            method       = "ai",
            dish_matched = data.get("dish_name"),
            ingredients  = ingredients,
        )
    except Exception as exc:
        try:
            logger.warning(f"GPT nutrition fallback failed: {exc}")
        except Exception:
            pass
        return None


async def estimate_nutrition_async(
    description: str,
    servings: float = 1.0,
) -> NutritionResult:
    """
    Async entry point used by the meals endpoint.
    Runs the rule-based engine first; falls back to GPT only when
    confidence is too low (method == 'fallback').
    """
    result = estimate_nutrition(description, servings=1.0)

    if result.method == "fallback":
        gpt = await _gpt_nutrition(description)
        if gpt:
            return NutritionResult(
                calories     = round(gpt.calories   * servings, 1),
                protein_g    = round(gpt.protein_g  * servings, 1),
                carbs_g      = round(gpt.carbs_g    * servings, 1),
                fat_g        = round(gpt.fat_g      * servings, 1),
                fiber_g      = round(gpt.fiber_g    * servings, 1),
                confidence   = gpt.confidence,
                method       = gpt.method,
                dish_matched = gpt.dish_matched,
                ingredients  = gpt.ingredients,
            )

    # Rule-based path — apply servings scaling
    # (estimate_nutrition was called with servings=1.0 above)
    return NutritionResult(
        calories     = round(result.calories   * servings, 1),
        protein_g    = round(result.protein_g  * servings, 1),
        carbs_g      = round(result.carbs_g    * servings, 1),
        fat_g        = round(result.fat_g      * servings, 1),
        fiber_g      = round(result.fiber_g    * servings, 1),
        confidence   = result.confidence,
        method       = result.method,
        dish_matched = result.dish_matched,
        ingredients  = result.ingredients,
    )
