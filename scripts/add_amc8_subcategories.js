const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const htmlPath = path.join(rootDir, "amc8_aops_topic_sets.html");
const dataPath = path.join(rootDir, "amc8_exam_generator_data.js");
const problems = require(dataPath);

const TAXONOMY = {
  "3D Geometry Problems": [
    "Cross-sections and spatial geometry"
  ],
  "Introductory Algebra Problems": [
    "Arithmetic and numerical expressions",
    "Fractions, decimals, and percents",
    "Ratios, rates, and proportions",
    "Equations and unknowns",
    "Sequences and patterns",
    "Exponents, roots, and scientific notation",
    "Averages and data analysis",
    "Measurement and unit conversion",
    "Applied word problems"
  ],
  "Introductory Combinatorics Problems": [
    "Fundamental counting principle",
    "Permutations and arrangements",
    "Combinations and selections",
    "Casework and systematic listing",
    "Inclusion-exclusion and overlap",
    "Paths and grid counting",
    "Coloring and tiling",
    "Pigeonhole and extremal reasoning"
  ],
  "Introductory Geometry Problems": [
    "Lines, angles, and constructions",
    "Triangles",
    "Quadrilaterals and polygons",
    "Circles",
    "Area, perimeter, and composite figures",
    "Similarity, congruence, and scaling",
    "Pythagorean theorem and distance",
    "Coordinate geometry and transformations"
  ],
  "Introductory Logic Problems": [
    "Interpreting graphs and timelines",
    "Spatial deduction",
    "Calendar and cyclic reasoning",
    "Ordering and constraint puzzles",
    "Spatial case counting"
  ],
  "Introductory Number Theory Problems": [
    "Divisibility, factors, and primes",
    "GCD and LCM",
    "Remainders and modular arithmetic",
    "Digits and place value",
    "Integer representations and equations",
    "Perfect squares and integer powers",
    "Consecutive integers and integer sums"
  ],
  "Introductory Probability Problems": [
    "Single-event probability",
    "Multi-stage and independent events",
    "Complement and case counting",
    "Conditional and set probability",
    "Probability with spatial patterns"
  ],
  "Logic Problems": [
    "Conditional statements and counterexamples",
    "Implication chains",
    "Ordering with true and false clues",
    "Ranking and deduction"
  ]
};

function plainText(html = "") {
  return html
    .replace(/<img\b[^>]*alt="([^"]*)"[^>]*>/gi, (image, alt) => {
      if (/^\s*\[asy\]/i.test(alt)) return " [diagram] ";
      if (/\\(?:textbf|text|mathrm)\s*\{?\s*\(A\)/i.test(alt)) return " ";
      return ` ${alt} `;
    })
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function matches(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function classifyAlgebra(text) {
  if (matches(text, [
    /average|arithmetic mean|\bmean\b|\bmedian\b|\bmode\b|bar graph|line graph|pie chart|histogram|frequency table|data set|table shows|graph shows/
  ])) return "Averages and data analysis";
  if (matches(text, [
    /square root|cube root|\bsqrt\b|\\sqrt|scientific notation|\bexponent|raised to|\bpower\b|\^\{|\^\d|10\^|perfect square/
  ])) return "Exponents, roots, and scientific notation";
  if (matches(text, [
    /sequence|pattern|next (number|term|figure)|\bterm\b|nth|consecutive|fibonacci|repeating|stair-step|row \$?\d|arithmetic progression/
  ])) return "Sequences and patterns";
  if (matches(text, [
    /percent|percentage|%|discount|sales tax|interest|profit|loss|markup|increase by|decrease by/
  ])) return "Fractions, decimals, and percents";
  if (matches(text, [
    /\bfraction\b|decimal|reciprocal|numerator|denominator|mixed number|\\frac|\d+\.\d+/
  ])) return "Fractions, decimals, and percents";
  if (matches(text, [
    /\bratio\b|\brate\b|\bproportion|proportional|\bspeed\b|miles per|kilometers per|per hour|per minute|unit rate|map scale|recipe|mixture|combined rate/
  ])) return "Ratios, rates, and proportions";
  if (matches(text, [
    /solve for|value of [a-z]\b|what is [a-z]\??|if [a-z] ?=|equation|expression|unknown|variable|satisf(?:y|ies)|\\begin\{cases\}|system of/
  ])) return "Equations and unknowns";
  if (matches(text, [
    /convert|conversion|how many (feet|inches|yards|miles|centimeters|meters|kilometers|ounces|pounds|grams|kilograms|minutes|hours|seconds)|\b(feet|inches|yards|miles|centimeters|meters|kilometers|ounces|pounds|grams|kilograms) (long|wide|high|deep)|unit square|unit cube/
  ])) return "Measurement and unit conversion";
  if (matches(text, [
    /cost|price|dollar|cent|salary|money|buys|sells|purchase|age|years old|travel|journey|train|car |bicycle|walks|runs|work together|job|tank|faucet|population|students|teachers|tickets|books|pages|apples|cookies|candy/
  ])) return "Applied word problems";
  return "Arithmetic and numerical expressions";
}

function classifyCombinatorics(text) {
  if (matches(text, [
    /at least one|both|neither|either|overlap|intersection|union|inclusion|how many .* (also|both)/
  ])) return "Inclusion-exclusion and overlap";
  if (matches(text, [
    /path|route|from .* to|grid|lattice|shortest way|moves? (only )?(right|up|down)|street|roads?/
  ])) return "Paths and grid counting";
  if (matches(text, [
    /color|colour|paint|tile|tiling|checkerboard|shad|black and white|beads?/
  ])) return "Coloring and tiling";
  if (matches(text, [
    /pigeonhole|must (have|contain|share)|guarantee|at least two|minimum number.*ensure|largest possible.*without/
  ])) return "Pigeonhole and extremal reasoning";
  if (matches(text, [
    /arrang|order|line up|seating|seat |permutation|different (orders|ways to order)|rank|schedule|around a (circle|table)|anagram/
  ])) return "Permutations and arrangements";
  if (matches(text, [
    /choose|select|committee|team|group of|pair of|handshake|combination|subset|drawn from|different sets|pick/
  ])) return "Combinations and selections";
  if (matches(text, [
    /digit|password|code|license|outfit|menu|coin|spinner|die |dice|product rule|each of|one from each/
  ])) return "Fundamental counting principle";
  return "Casework and systematic listing";
}

function classifyGeometry(text) {
  if (matches(text, [
    /coordinate|x-axis|y-axis|origin|ordered pair|\([a-z0-9-]+,[a-z0-9-]+\)|reflect|reflection|rotate|rotation|translate|translation|symmetr|transformation|slope/
  ])) return "Coordinate geometry and transformations";
  if (matches(text, [
    /pythag|hypotenuse|right triangle|diagonal.*(length|long)|distance between|straight-line distance|\b3-4-5\b/
  ])) return "Pythagorean theorem and distance";
  if (matches(text, [
    /similar|congruent|scale factor|scaled|proportional sides|same shape|dilation/
  ])) return "Similarity, congruence, and scaling";
  if (matches(text, [
    /circle|radius|diameter|circumference|arc|sector|semicircle|tangent|chord|\bpi\b|\\pi/
  ])) return "Circles";
  if (matches(text, [
    /triangle|triangular|isosceles|equilateral|scalene|centroid|altitude|median of|angle bisector/
  ])) return "Triangles";
  if (matches(text, [
    /quadrilateral|rectangle|square|parallelogram|trapezoid|rhombus|kite|polygon|pentagon|hexagon|octagon|regular [a-z]+gon/
  ])) return "Quadrilaterals and polygons";
  if (matches(text, [
    /area|perimeter|shaded|unshaded|region|composite|border|surrounds|lawn|floor|carpet/
  ])) return "Area, perimeter, and composite figures";
  return "Lines, angles, and constructions";
}

function classifyNumberTheory(text) {
  if (matches(text, [
    /remainder|modulo|mod |congruent|last digit|units digit|ones digit|cyclic/
  ])) return "Remainders and modular arithmetic";
  if (matches(text, [
    /greatest common|gcf|gcd|least common|lcm|common multiple|common factor/
  ])) return "GCD and LCM";
  if (matches(text, [
    /digit|place value|hundreds|tens digit|thousands digit|decimal representation|numeral|palindrome|revers(?:e|ed).*number/
  ])) return "Digits and place value";
  if (matches(text, [
    /perfect square|square number|perfect cube|integer power|power of|exponent|\bsqrt\b|\\sqrt/
  ])) return "Perfect squares and integer powers";
  if (matches(text, [
    /consecutive|sum of.*integers|sum of.*numbers|triangular number|arithmetic sequence|arithmetic progression/
  ])) return "Consecutive integers and integer sums";
  if (matches(text, [
    /ways? (can|to).*write|represented|positive integer solutions?|integer solutions?|ordered pairs?.*integer|sum of.*(squares|primes)|difference of|product of.*integers/
  ])) return "Integer representations and equations";
  return "Divisibility, factors, and primes";
}

const EXACT = {
  "2019 AMC 8 Problem 5": "Interpreting graphs and timelines",
  "2019 AMC 8 Problem 12": "Spatial deduction",
  "2019 AMC 8 Problem 14": "Calendar and cyclic reasoning",
  "2020 AMC 8 Problem 6": "Ordering and constraint puzzles",
  "2020 AMC 8 Problem 9": "Spatial case counting",
  "1990 AJHSME Problem 14": "Single-event probability",
  "1991 AJHSME Problem 22": "Multi-stage and independent events",
  "2002 AMC 8 Problem 12": "Complement and case counting",
  "2014 AMC 8 Problem 18": "Complement and case counting",
  "2016 AMC 8 Problem 13": "Complement and case counting",
  "2019 AMC 8 Problem 15": "Conditional and set probability",
  "2019 AMC 8 Problem 18": "Multi-stage and independent events",
  "2022 AMC 8 Problem 12": "Multi-stage and independent events",
  "2023 AMC 8 Problem 23": "Probability with spatial patterns",
  "1985 AJHSME Problem 25": "Conditional statements and counterexamples",
  "1986 AJHSME Problem 22": "Implication chains",
  "1987 AJHSME Problem 17": "Ordering with true and false clues",
  "2001 AMC 8 Problem 20": "Ranking and deduction"
};

function classify(problem) {
  if (problem.topic === "3D Geometry Problems") return "Cross-sections and spatial geometry";
  if (EXACT[problem.title] && TAXONOMY[problem.topic].includes(EXACT[problem.title])) return EXACT[problem.title];
  const text = plainText(problem.questionHtml);
  if (problem.topic === "Introductory Algebra Problems") return classifyAlgebra(text);
  if (problem.topic === "Introductory Combinatorics Problems") return classifyCombinatorics(text);
  if (problem.topic === "Introductory Geometry Problems") return classifyGeometry(text);
  if (problem.topic === "Introductory Number Theory Problems") return classifyNumberTheory(text);
  throw new Error(`No subcategory rule for ${problem.topic}: ${problem.title}`);
}

function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function examUrl(topic, subcategory) {
  const params = new URLSearchParams({ topic, subcategory, contest: "all" });
  return `amc8_generated_exam.html?${params.toString()}`;
}

const problemsByUrl = new Map(problems.map((problem) => [problem.url, problem]));
const assignments = new Map();
problems.forEach((problem) => {
  const subcategory = classify(problem);
  if (!TAXONOMY[problem.topic].includes(subcategory)) {
    throw new Error(`Invalid subcategory ${subcategory} for ${problem.title}`);
  }
  assignments.set(`${problem.topic}\n${problem.url}`, subcategory);
  problem.subcategory = subcategory;
});

let html = fs.readFileSync(htmlPath, "utf8");
const sectionPattern = /(<section class="topic-section"[^>]*data-topic="([^"]+)"[^>]*>)([\s\S]*?)(?=\n<section class="topic-section"|\n<div class="quick-category-jump")/g;
let sectionCount = 0;
let itemCount = 0;

html = html.replace(sectionPattern, (whole, opening, topic, body) => {
  const decodedTopic = topic.replace(/&amp;/g, "&").replace(/&quot;/g, "\"");
  const headerMatch = body.match(/^([\s\S]*?<\/div><\/div>)/);
  if (!headerMatch) throw new Error(`Could not find header for ${decodedTopic}`);

  const groups = new Map(TAXONOMY[decodedTopic].map((name) => [name, []]));
  const itemPattern = /<li\s+data-contest="([^"]+)"(?:\s+data-subcategory="[^"]*")?>(<a\s+data-question-link\s+href="([^"]+)">[^<]+<\/a>)<\/li>/g;
  let itemMatch;
  while ((itemMatch = itemPattern.exec(body))) {
    const contest = itemMatch[1];
    const url = itemMatch[3].replace(/&amp;/g, "&");
    const problem = problemsByUrl.get(url);
    if (!problem) throw new Error(`No cached problem found for ${url}`);
    const subcategory = assignments.get(`${decodedTopic}\n${url}`);
    if (!subcategory) throw new Error(`No assignment found for ${decodedTopic}: ${url}`);
    groups.get(subcategory).push(`<li data-contest="${escapeAttribute(contest)}" data-subcategory="${escapeAttribute(subcategory)}">${itemMatch[2]}</li>`);
    itemCount += 1;
  }

  const renderedGroups = Array.from(groups.entries())
    .filter(([, items]) => items.length)
    .map(([subcategory, items]) => [
      `<section class="subcategory-section" data-subcategory-section data-subcategory="${escapeAttribute(subcategory)}">`,
      '<div class="subcategory-header">',
      `<h3>${subcategory} <span class="count" data-subcategory-count>(${items.length})</span></h3>`,
      `<a class="subcategory-exam-link" data-subcategory-exam href="${escapeAttribute(examUrl(decodedTopic, subcategory))}">Generate subcategory exam</a>`,
      "</div>",
      '<ol class="grid">',
      ...items,
      "</ol>",
      "</section>"
    ].join("\n"))
    .join("\n");

  sectionCount += 1;
  return `${opening}${headerMatch[1]}\n<div class="subcategory-list">\n${renderedGroups}\n</div>\n</section>`;
});

if (sectionCount !== Object.keys(TAXONOMY).length || itemCount !== problems.length) {
  throw new Error(`Expected ${Object.keys(TAXONOMY).length} sections and ${problems.length} items; found ${sectionCount} sections and ${itemCount} items`);
}

const dataOutput = `(function (root, problems) {
  if (typeof module === "object" && module.exports) {
    module.exports = problems;
  } else {
    root.AMC8_EXAM_PROBLEMS = problems;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, ${JSON.stringify(problems, null, 2)});
`;

fs.writeFileSync(htmlPath, html);
fs.writeFileSync(dataPath, dataOutput);

const distribution = {};
problems.forEach((problem) => {
  distribution[problem.topic] ||= {};
  distribution[problem.topic][problem.subcategory] = (distribution[problem.topic][problem.subcategory] || 0) + 1;
});

console.log(`Assigned ${problems.length} problems to ${Object.values(TAXONOMY).flat().length} subcategories.`);
console.log(JSON.stringify(distribution, null, 2));
