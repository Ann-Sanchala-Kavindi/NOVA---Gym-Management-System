function classifyFeedback(message = '') {
  const text = String(message || '').toLowerCase();

  const positiveWords = [
    'good',
    'great',
    'excellent',
    'love',
    'amazing',
    'awesome',
    'happy',
    'clean',
    'helpful',
    'best',
  ];

  const negativeWords = [
    'bad',
    'worst',
    'dirty',
    'late',
    'issue',
    'problem',
    'poor',
    'broken',
    'slow',
    'rude',
    'unhappy',
  ];

  let positive = 0;
  let negative = 0;

  positiveWords.forEach((w) => {
    if (text.includes(w)) positive += 1;
  });

  negativeWords.forEach((w) => {
    if (text.includes(w)) negative += 1;
  });

  if (positive > negative) {
    return {
      category: 'positive',
      summaryHint: 'Positive feedback: member appreciated service or facilities.',
    };
  }

  if (negative > positive) {
    return {
      category: 'negative',
      summaryHint: 'Negative feedback: member reported issue requiring action.',
    };
  }

  return {
    category: 'normal',
    summaryHint: 'Neutral feedback: informational member comment.',
  };
}

function summarizeFeedback(feedbackItems = []) {
  const totals = {
    normal: 0,
    negative: 0,
    positive: 0,
  };

  feedbackItems.forEach((item) => {
    if (item.category && totals[item.category] !== undefined) {
      totals[item.category] += 1;
    }
  });

  const topCategory = Object.entries(totals).sort((a, b) => b[1] - a[1])[0]?.[0] || 'normal';

  return {
    total: feedbackItems.length,
    totals,
    summary: `Most feedback is ${topCategory}. Total submissions: ${feedbackItems.length}.`,
  };
}

module.exports = {
  classifyFeedback,
  summarizeFeedback,
};
