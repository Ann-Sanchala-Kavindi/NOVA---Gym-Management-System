/**
 * seed-plans.js
 * Seeds the Exercise and Food libraries with starter data.
 *
 * Usage:
 *   node seed-plans.js
 *
 * Run from: integrated-gym-system/backend/
 */

require("dotenv").config();
const mongoose = require("mongoose");
const Exercise = require("./src/models/Exercise");
const Food = require("./src/models/Food");

const EXERCISES = [
  // Chest
  { name: "Barbell Bench Press", category: "Strength", equipment: "Barbell", muscleGroup: "Chest", difficulty: "Intermediate", defaultSets: 4, defaultReps: "8-10", defaultRestSeconds: 90, instructions: "Lie flat on bench, grip barbell slightly wider than shoulder-width. Lower to chest and press up." },
  { name: "Dumbbell Flyes", category: "Strength", equipment: "Dumbbell", muscleGroup: "Chest", difficulty: "Beginner", defaultSets: 3, defaultReps: "12-15", defaultRestSeconds: 60 },
  { name: "Push-Ups", category: "Bodyweight", equipment: "None", muscleGroup: "Chest", difficulty: "Beginner", defaultSets: 3, defaultReps: "15-20", defaultRestSeconds: 45, instructions: "Keep body straight, lower chest to floor, push back up." },
  // Back
  { name: "Pull-Ups", category: "Bodyweight", equipment: "Pull-Up Bar", muscleGroup: "Back", difficulty: "Intermediate", defaultSets: 3, defaultReps: "6-10", defaultRestSeconds: 90 },
  { name: "Barbell Deadlift", category: "Strength", equipment: "Barbell", muscleGroup: "Back", difficulty: "Advanced", defaultSets: 4, defaultReps: "5-6", defaultRestSeconds: 120, instructions: "Hinge at hips, maintain neutral spine, drive through heels to stand." },
  { name: "Seated Cable Row", category: "Strength", equipment: "Cable Machine", muscleGroup: "Back", difficulty: "Beginner", defaultSets: 3, defaultReps: "10-12", defaultRestSeconds: 60 },
  // Legs
  { name: "Barbell Squat", category: "Strength", equipment: "Barbell", muscleGroup: "Legs", difficulty: "Intermediate", defaultSets: 4, defaultReps: "8-10", defaultRestSeconds: 120, instructions: "Bar on traps, squat to parallel, drive through heels to stand." },
  { name: "Leg Press", category: "Strength", equipment: "Leg Press Machine", muscleGroup: "Legs", difficulty: "Beginner", defaultSets: 3, defaultReps: "12-15", defaultRestSeconds: 90 },
  { name: "Romanian Deadlift", category: "Strength", equipment: "Barbell", muscleGroup: "Legs", difficulty: "Intermediate", defaultSets: 3, defaultReps: "10-12", defaultRestSeconds: 90 },
  { name: "Walking Lunges", category: "Bodyweight", equipment: "None", muscleGroup: "Legs", difficulty: "Beginner", defaultSets: 3, defaultReps: "12 each", defaultRestSeconds: 60 },
  // Shoulders
  { name: "Overhead Press", category: "Strength", equipment: "Barbell", muscleGroup: "Shoulders", difficulty: "Intermediate", defaultSets: 4, defaultReps: "8-10", defaultRestSeconds: 90 },
  { name: "Lateral Raises", category: "Strength", equipment: "Dumbbell", muscleGroup: "Shoulders", difficulty: "Beginner", defaultSets: 3, defaultReps: "12-15", defaultRestSeconds: 60 },
  // Arms
  { name: "Barbell Bicep Curl", category: "Strength", equipment: "Barbell", muscleGroup: "Arms", difficulty: "Beginner", defaultSets: 3, defaultReps: "10-12", defaultRestSeconds: 60 },
  { name: "Tricep Dips", category: "Bodyweight", equipment: "Dip Bar", muscleGroup: "Arms", difficulty: "Intermediate", defaultSets: 3, defaultReps: "10-15", defaultRestSeconds: 60 },
  { name: "Hammer Curls", category: "Strength", equipment: "Dumbbell", muscleGroup: "Arms", difficulty: "Beginner", defaultSets: 3, defaultReps: "10-12", defaultRestSeconds: 60 },
  // Core
  { name: "Plank", category: "Bodyweight", equipment: "None", muscleGroup: "Core", difficulty: "Beginner", defaultSets: 3, defaultReps: "30-60s", defaultRestSeconds: 45, instructions: "Hold forearm plank, keep hips level, breathe steadily." },
  { name: "Cable Crunches", category: "Strength", equipment: "Cable Machine", muscleGroup: "Core", difficulty: "Beginner", defaultSets: 3, defaultReps: "15-20", defaultRestSeconds: 45 },
  { name: "Russian Twists", category: "Bodyweight", equipment: "None", muscleGroup: "Core", difficulty: "Beginner", defaultSets: 3, defaultReps: "20 total", defaultRestSeconds: 45 },
  // Cardio
  { name: "Treadmill Run", category: "Cardio", equipment: "Treadmill", muscleGroup: "Full Body", difficulty: "Beginner", defaultSets: 1, defaultReps: "20-30 min", defaultRestSeconds: 0 },
  { name: "Rowing Machine", category: "Cardio", equipment: "Rowing Machine", muscleGroup: "Full Body", difficulty: "Beginner", defaultSets: 1, defaultReps: "15-20 min", defaultRestSeconds: 0 },
  { name: "Jump Rope", category: "Cardio", equipment: "Jump Rope", muscleGroup: "Full Body", difficulty: "Beginner", defaultSets: 3, defaultReps: "3 min", defaultRestSeconds: 60 },
];

const FOODS = [
  // Proteins
  { name: "Grilled Chicken Breast", category: "Protein", servingText: "150g", calories: 248, protein: 46, carbs: 0, fat: 5 },
  { name: "Boiled Eggs", category: "Protein", servingText: "2 large", calories: 155, protein: 13, carbs: 1, fat: 11 },
  { name: "Canned Tuna", category: "Protein", servingText: "100g", calories: 116, protein: 26, carbs: 0, fat: 1 },
  { name: "Greek Yogurt", category: "Dairy", servingText: "200g", calories: 130, protein: 17, carbs: 9, fat: 0 },
  { name: "Whey Protein Shake", category: "Supplement", servingText: "1 scoop (30g)", calories: 120, protein: 25, carbs: 3, fat: 2 },
  { name: "Salmon Fillet", category: "Protein", servingText: "150g", calories: 280, protein: 39, carbs: 0, fat: 13 },
  { name: "Cottage Cheese", category: "Dairy", servingText: "200g", calories: 163, protein: 28, carbs: 6, fat: 2 },
  // Carbs
  { name: "Brown Rice", category: "Carbs", servingText: "1 cup cooked (195g)", calories: 216, protein: 5, carbs: 45, fat: 2 },
  { name: "Oatmeal", category: "Carbs", servingText: "1 cup cooked (234g)", calories: 166, protein: 6, carbs: 28, fat: 4 },
  { name: "Whole Wheat Bread", category: "Carbs", servingText: "2 slices", calories: 138, protein: 7, carbs: 24, fat: 2 },
  { name: "Sweet Potato", category: "Carbs", servingText: "1 medium (130g)", calories: 112, protein: 2, carbs: 26, fat: 0 },
  { name: "Banana", category: "Fruit", servingText: "1 medium", calories: 89, protein: 1, carbs: 23, fat: 0 },
  { name: "White Rice", category: "Carbs", servingText: "1 cup cooked (186g)", calories: 242, protein: 4, carbs: 53, fat: 0 },
  // Vegetables
  { name: "Broccoli", category: "Vegetables", servingText: "1 cup (91g)", calories: 31, protein: 3, carbs: 6, fat: 0 },
  { name: "Spinach", category: "Vegetables", servingText: "100g", calories: 23, protein: 3, carbs: 4, fat: 0 },
  { name: "Mixed Salad", category: "Vegetables", servingText: "2 cups", calories: 20, protein: 2, carbs: 4, fat: 0 },
  { name: "Cucumber", category: "Vegetables", servingText: "1 medium", calories: 16, protein: 1, carbs: 4, fat: 0 },
  // Fats
  { name: "Avocado", category: "Fats", servingText: "1/2 medium", calories: 120, protein: 2, carbs: 6, fat: 11 },
  { name: "Olive Oil", category: "Fats", servingText: "1 tbsp", calories: 119, protein: 0, carbs: 0, fat: 14 },
  { name: "Almonds", category: "Nuts", servingText: "30g", calories: 173, protein: 6, carbs: 6, fat: 15 },
  { name: "Peanut Butter", category: "Nuts", servingText: "2 tbsp (32g)", calories: 188, protein: 8, carbs: 6, fat: 16 },
  // Drinks / Other
  { name: "Whole Milk", category: "Dairy", servingText: "250ml", calories: 149, protein: 8, carbs: 12, fat: 8 },
  { name: "Orange Juice", category: "Drinks", servingText: "250ml", calories: 112, protein: 2, carbs: 26, fat: 0 },
  { name: "Protein Bar", category: "Supplement", servingText: "1 bar (60g)", calories: 220, protein: 20, carbs: 22, fat: 7 },
];

async function seed() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error("MONGO_URI missing in .env");
    process.exit(1);
  }

  console.log("Connecting to MongoDB…");
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
  console.log("Connected.");

  // Exercises
  const existingEx = await Exercise.countDocuments({ isCustom: false });
  if (existingEx === 0) {
    await Exercise.insertMany(EXERCISES.map((e) => ({ ...e, isCustom: false })));
    console.log(`✅ Seeded ${EXERCISES.length} exercises.`);
  } else {
    console.log(`⏩ Exercises already seeded (${existingEx} found). Skipping.`);
  }

  // Foods
  const existingFood = await Food.countDocuments({ isCustom: false });
  if (existingFood === 0) {
    await Food.insertMany(FOODS.map((f) => ({ ...f, isCustom: false })));
    console.log(`✅ Seeded ${FOODS.length} foods.`);
  } else {
    console.log(`⏩ Foods already seeded (${existingFood} found). Skipping.`);
  }

  await mongoose.connection.close();
  console.log("Done. Connection closed.");
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
