(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Amc8ExamGeneratorCore = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function normalizeContest(contest) {
    return contest || "AMC 8";
  }

  function getEligibleProblems(problems, contest) {
    const selectedContest = normalizeContest(contest);
    return problems.filter((problem) => {
      return selectedContest === "all" || problem.contest === selectedContest;
    });
  }

  function getTopicDistribution(problems, contest) {
    const byTopic = new Map();
    getEligibleProblems(problems, contest).forEach((problem) => {
      byTopic.set(problem.topic, (byTopic.get(problem.topic) || 0) + 1);
    });

    const total = Array.from(byTopic.values()).reduce((sum, count) => sum + count, 0);
    return Array.from(byTopic.entries())
      .map(([topic, count]) => ({
        topic,
        count,
        percentage: total ? Number(((count / total) * 100).toFixed(1)) : 0
      }))
      .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic));
  }

  function allocateTopicCounts(distribution, size) {
    const usableSize = Math.max(0, Number.parseInt(size, 10) || 0);
    const total = distribution.reduce((sum, entry) => sum + entry.count, 0);
    if (!total || !usableSize) return [];

    const allocations = distribution.map((entry, index) => {
      const exact = (entry.count / total) * usableSize;
      return {
        index,
        topic: entry.topic,
        sourceCount: entry.count,
        exact,
        targetCount: Math.floor(exact)
      };
    });

    let remaining = usableSize - allocations.reduce((sum, entry) => sum + entry.targetCount, 0);
    allocations
      .slice()
      .sort((a, b) => (b.exact - b.targetCount) - (a.exact - a.targetCount) || b.sourceCount - a.sourceCount || a.index - b.index)
      .forEach((entry) => {
        if (remaining <= 0) return;
        entry.targetCount += 1;
        remaining -= 1;
      });

    return allocations
      .sort((a, b) => a.index - b.index)
      .filter((entry) => entry.targetCount > 0)
      .map((entry) => ({
        topic: entry.topic,
        targetCount: entry.targetCount,
        sourceCount: entry.sourceCount,
        targetPercentage: Number(((entry.targetCount / usableSize) * 100).toFixed(1))
      }));
  }

  function shuffle(items, random) {
    const copy = items.slice();
    const nextRandom = typeof random === "function" ? random : Math.random;
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const target = Math.floor(nextRandom() * (index + 1));
      const current = copy[index];
      copy[index] = copy[target];
      copy[target] = current;
    }
    return copy;
  }

  function takeUnused(candidates, usedIds, count, random) {
    const selected = [];
    const shuffled = shuffle(candidates, random);
    for (const problem of shuffled) {
      if (selected.length >= count) break;
      const uniqueKey = problem.url || problem.id;
      if (usedIds.has(uniqueKey)) continue;
      selected.push(problem);
      usedIds.add(uniqueKey);
    }
    return selected;
  }

  function problemKey(problem) {
    return problem.url || problem.id;
  }

  function countUniqueProblems(problems) {
    return new Set(problems.map(problemKey)).size;
  }

  function generateExam(problems, options) {
    const settings = options || {};
    const size = Math.max(1, Number.parseInt(settings.size, 10) || 25);
    const eligible = getEligibleProblems(problems, settings.contest);
    const totalAvailable = countUniqueProblems(eligible);
    const distribution = settings.distribution || getTopicDistribution(problems, settings.contest);
    const targetCounts = allocateTopicCounts(distribution, Math.min(size, totalAvailable));
    const usedIds = new Set();
    const selected = [];

    targetCounts.forEach((target) => {
      const candidates = eligible.filter((problem) => problem.topic === target.topic);
      selected.push(...takeUnused(candidates, usedIds, target.targetCount, settings.random));
    });

    if (selected.length < Math.min(size, totalAvailable)) {
      selected.push(...takeUnused(eligible, usedIds, Math.min(size, totalAvailable) - selected.length, settings.random));
    }

    const questions = shuffle(selected, settings.random).map((problem, index) => ({
      ...problem,
      examNumber: index + 1
    }));
    const actualByTopic = new Map();
    questions.forEach((problem) => {
      actualByTopic.set(problem.topic, (actualByTopic.get(problem.topic) || 0) + 1);
    });

    const summaryTopics = new Set([
      ...targetCounts.map((entry) => entry.topic),
      ...Array.from(actualByTopic.keys())
    ]);
    const summary = Array.from(summaryTopics).map((topic) => {
      const target = targetCounts.find((entry) => entry.topic === topic);
      const actualCount = actualByTopic.get(topic) || 0;
      return {
        topic,
        sourceCount: target ? target.sourceCount : distribution.find((entry) => entry.topic === topic)?.count || actualCount,
        targetCount: target ? target.targetCount : 0,
        actualCount,
        actualPercentage: questions.length ? Number(((actualCount / questions.length) * 100).toFixed(1)) : 0,
        targetPercentage: questions.length && target ? Number(((target.targetCount / questions.length) * 100).toFixed(1)) : 0
      };
    });

    return {
      questions,
      summary,
      totalAvailable,
      requestedSize: size
    };
  }

  return {
    allocateTopicCounts,
    generateExam,
    getEligibleProblems,
    getTopicDistribution
  };
});
