const randomCode = (length = 6) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const generateWorkoutPlanCode = () => {
  return `WP-${randomCode(6)}`;
};

const generateMealPlanCode = () => {
  return `MP-${randomCode(6)}`;
};

module.exports = {
  generateWorkoutPlanCode,
  generateMealPlanCode,
};