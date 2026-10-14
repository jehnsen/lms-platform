/**
 * Mock AI tutor. Replies are assembled from a small glossary and the current
 * lesson's content — no model is called. To go live, keep the
 * `streamTutorReply` signature and replace its body with a request to your
 * chat endpoint that yields text chunks as they arrive.
 */

export interface PracticeQuestion {
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
}

export interface TutorContext {
  courseTitle?: string;
  lessonTitle?: string;
  summary?: string;
  keyPoints?: string[];
  practice?: PracticeQuestion[];
}

export interface TutorTurn {
  role: "user" | "assistant";
  text: string;
}

interface GlossaryEntry {
  name: string;
  match: RegExp;
  simple: string;
  detail: string;
  example: string;
}

const GLOSSARY: GlossaryEntry[] = [
  {
    name: "Overfitting",
    match: /overfit/i,
    simple: "it's when a model memorises its training examples instead of learning the general pattern.",
    detail:
      "The tell-tale sign is a big gap: excellent results on training data, poor results on anything new. More data, a simpler model, or regularization all help.",
    example:
      "A student who memorises last year's exam answers scores 100% on that paper and fails when the questions change.",
  },
  {
    name: "Gradient descent",
    match: /gradient|descent/i,
    simple: "it's a way of improving a model by repeatedly taking small steps in whichever direction lowers the error.",
    detail:
      "The gradient tells you which way the loss rises fastest, so you step the opposite way. The learning rate sets how big each step is.",
    example:
      "Walking down a foggy hill by feeling the slope under your feet and always stepping downhill.",
  },
  {
    name: "Learning rate",
    match: /learning rate|step size/i,
    simple: "it's how big a step the model takes each time it updates itself.",
    detail:
      "Too large and training overshoots and bounces around; too small and it takes forever. It is usually the first setting worth tuning.",
    example:
      "Adjusting a shower tap: big turns swing between freezing and scalding, tiny turns take ages to get comfortable.",
  },
  {
    name: "Loss function",
    match: /\bloss\b/i,
    simple: "it's a score for how wrong the model's predictions are — lower is better.",
    detail:
      "Training is the process of changing the model's parameters to make this score as small as possible.",
    example: "In darts, the distance from the bullseye. Training is practising until that distance shrinks.",
  },
  {
    name: "Supervised learning",
    match: /supervised|label/i,
    simple: "it's learning from examples that come with the right answers attached.",
    detail:
      "If the answer is a category it's classification; if it's a number it's regression. Unsupervised learning, by contrast, has no answers and looks for structure.",
    example: "Flashcards with the answer on the back, versus sorting a pile of unlabelled photos into groups.",
  },
  {
    name: "Classification vs. regression",
    match: /classif|regress/i,
    simple: "classification predicts a category; regression predicts a number.",
    detail: "Both are supervised learning. Ask yourself: is the answer a label or a quantity?",
    example: "“Is this email spam?” is classification. “How many emails will arrive tomorrow?” is regression.",
  },
  {
    name: "Train, validation and test sets",
    match: /validation|test set|train(ing)? set|data split/i,
    simple: "they are three slices of your data, each with a different job.",
    detail:
      "You fit the model on the training set, make choices using the validation set, and use the test set once at the end for an honest score.",
    example: "Homework to learn, a mock exam to adjust your revision, and the real exam taken once.",
  },
  {
    name: "Semantic HTML",
    match: /semantic/i,
    simple: "it means choosing HTML elements for what the content is, not for how it looks.",
    detail:
      "Elements like nav, main, article and footer tell browsers, search engines and screen readers what each part of the page is for.",
    example: "Labelling moving boxes “kitchen” and “books” instead of leaving them all blank.",
  },
  {
    name: "The box model",
    match: /box model|padding|margin/i,
    simple: "every element is a box with four layers: content, padding, border and margin.",
    detail:
      "Padding is inside the border, margin is outside. With box-sizing: border-box, the width you set includes padding and border.",
    example: "A framed picture: the photo is content, the mount is padding, the frame is the border, and the gap to the next picture is margin.",
  },
  {
    name: "Flexbox",
    match: /flex|justify-content|align-items/i,
    simple: "it's a CSS layout mode for arranging items in a row or a column.",
    detail:
      "justify-content places items along the main axis; align-items places them on the cross axis. Changing flex-direction swaps which axis is which.",
    example: "Books on a shelf: you can push them left, spread them out, or centre them, and choose whether they stand at the top or bottom.",
  },
  {
    name: "Specificity",
    match: /specificity|cascade/i,
    simple: "it's the rule browsers use to decide which CSS declaration wins when several apply.",
    detail: "Inline styles beat IDs, IDs beat classes, classes beat element selectors. On a tie, the later rule wins.",
    example: "A specific instruction to one person outranks a general announcement to the whole room.",
  },
  {
    name: "Mitochondria",
    match: /mitochondri|atp/i,
    simple: "they are the parts of the cell that release usable energy from food.",
    detail: "They carry out aerobic respiration and produce ATP, the molecule cells spend as energy.",
    example: "A power station turning fuel into electricity the rest of the city can use.",
  },
  {
    name: "Osmosis and diffusion",
    match: /osmosis|diffusion|active transport/i,
    simple: "diffusion is particles spreading from crowded areas to less crowded ones; osmosis is the same thing for water across a membrane.",
    detail: "Both are passive. Active transport goes the other way, against the gradient, and costs the cell energy.",
    example: "A drop of food colouring spreading through a glass of water without stirring.",
  },
  {
    name: "DNA",
    match: /\bdna\b|base pair|gene\b/i,
    simple: "it's the molecule that stores a living thing's instructions, written in four chemical letters.",
    detail: "A pairs with T and C pairs with G. A gene is a stretch of DNA that codes for one protein.",
    example: "A recipe book: the letters are bases, a single recipe is a gene, and the dish is a protein.",
  },
  {
    name: "Mitosis",
    match: /mitosis|metaphase|prophase|anaphase|telophase/i,
    simple: "it's how one cell divides into two identical cells.",
    detail: "The stages are prophase, metaphase, anaphase and telophase — PMAT. In metaphase the chromosomes line up in the middle.",
    example: "Photocopying a document and then putting one copy in each of two folders.",
  },
  {
    name: "Compound interest",
    match: /compound|\binterest\b/i,
    simple: "it's earning interest on your interest, not just on what you first put in.",
    detail: "Because each year's growth is added to the balance, the growth itself speeds up over time. Starting early matters more than starting big.",
    example: "100 at 10% becomes 110, then 121, then 133.10 — each year's gain is larger than the last.",
  },
  {
    name: "Human acts and conscience",
    match: /human act|conscience|moral agent/i,
    simple: "a human act is something you do knowingly and freely, and conscience is your reason judging whether it is good or bad.",
    detail:
      "Only acts done with knowledge and free will can be called good or bad. Ignorance, fear, habit or force can lessen how responsible you are.",
    example: "Returning a lost wallet is a human act. Your heartbeat speeding up beforehand is not.",
  },
  {
    name: "Utilitarianism and Kant",
    match: /utilitarian|categorical imperative|\bkant\b|bentham/i,
    simple: "utilitarianism judges an act by its results for everyone; Kant judges it by whether its rule could be a law for all.",
    detail:
      "A utilitarian asks which choice brings the greatest good to the greatest number. Kant asks whether you could will your rule universally, and never lets you treat a person only as a means.",
    example: "Breaking a promise to help many people may look good to a utilitarian, but Kant asks what would happen to promising if everyone did it.",
  },
  {
    name: "Virtue ethics",
    match: /virtue|aristotle|eudaimonia|natural law/i,
    simple: "it asks what kind of person you should become, not just what act to do.",
    detail:
      "Aristotle describes a virtue as a habit of choosing the mean between two extremes. Aquinas adds natural law: reason can discover the basic goods that acts should serve.",
    example: "Courage sits between cowardice and recklessness: a student who speaks up politely about cheating is showing it.",
  },
  {
    name: "The Preventive System",
    match: /preventive|amorevolezza|loving-kindness|don bosco|salesian/i,
    simple: "it is Don Bosco's way of educating through reason, religion and loving-kindness, with the educator present among the young.",
    detail:
      "Instead of waiting to punish wrongdoing, the educator prevents it by being present, explaining rules and making sure the young know they are loved.",
    example: "A teacher who greets a struggling student at the door and agrees on a small plan is applying it.",
  },
  {
    name: "Measurement, assessment and evaluation",
    match: /measurement|formative|summative|learning target|bloom/i,
    simple: "measurement is a score, assessment is evidence of learning, and evaluation is the judgement made from it.",
    detail:
      "Formative assessment helps learning while it is happening; summative assessment reports it. Learning targets should use observable verbs from Bloom's revised taxonomy.",
    example: "34 out of 40 is a measurement. Deciding that the student has met the standard is evaluation.",
  },
  {
    name: "Table of specification and item analysis",
    match: /table of specification|\btos\b|item analysis|difficulty index|discrimination|validity|reliab/i,
    simple: "a table of specification is the blueprint of a test, and item analysis checks how each item performed afterwards.",
    detail:
      "Items per topic are proportional to teaching hours. Difficulty index is the proportion who got an item right; discrimination index is upper-group minus lower-group proportion correct.",
    example: "If 18 of 30 students answer an item correctly, its difficulty index is 0.60.",
  },
  {
    name: "Shop safety and 5S",
    match: /\bppe\b|jack stand|5s\b|seiri|shop safety|torque wrench/i,
    simple: "it is working safely in the shop: the right protective equipment, a vehicle on stands, and an orderly bay.",
    detail:
      "Never work under a vehicle held only by a jack. 5S stands for sort, set in order, shine, standardize and sustain. A torque wrench is for tightening to a specification in N·m.",
    example: "A tool board with a painted outline for each wrench is a 5S habit that also saves time.",
  },
  {
    name: "The four-stroke cycle",
    match: /four-stroke|intake|exhaust stroke|power stroke|compression stroke|crankshaft|camshaft|valve train|firing order|thermostat|viscosity/i,
    simple: "an engine makes power in four strokes: intake, compression, power and exhaust.",
    detail:
      "The crankshaft turns twice for each cycle and the camshaft once. Oil lubricates and carries heat away, and the thermostat holds coolant back until the engine warms up.",
    example: "Think of breathing in, squeezing, a push, and breathing out, repeated thousands of times a minute.",
  },
  {
    name: "Budgeting",
    match: /budget|50\/30\/20|needs and wants/i,
    simple: "it's deciding what your money will do before you spend it.",
    detail: "A common starting split is 50% needs, 30% wants and 20% savings. Pay savings first, then adjust monthly.",
    example: "Packing for a trip with a list instead of throwing things in a bag and hoping.",
  },
];

const LETTERS = ["A", "B", "C", "D", "E", "F"];
const PRACTICE_MARKER = "Practice question";

function findEntry(text: string) {
  return GLOSSARY.find((entry) => entry.match.test(text));
}

function bullets(lines: string[]) {
  return lines.map((line) => `- ${line}`).join("\n");
}

function formatPractice(question: PracticeQuestion) {
  const options = question.options.map((option, index) => `${LETTERS[index]}. ${option}`);
  return `**${PRACTICE_MARKER}**\n\n${question.prompt}\n\n${options.join("\n")}\n\nReply with a letter and I'll tell you how you did.`;
}

/** If the tutor's last message was a practice question, find which one. */
function openPractice(context: TutorContext, history: TutorTurn[]) {
  const lastAssistant = [...history].reverse().find((turn) => turn.role === "assistant");
  if (!lastAssistant?.text.includes(PRACTICE_MARKER)) return undefined;
  return context.practice?.find((question) => lastAssistant.text.includes(question.prompt));
}

function readChoice(text: string, question: PracticeQuestion) {
  const letter = text.trim().match(/^\(?([a-f])\)?[.)]?(\s|$)/i)?.[1];
  if (letter) {
    const index = LETTERS.indexOf(letter.toUpperCase());
    return index < question.options.length ? index : undefined;
  }
  const byText = question.options.findIndex((option) =>
    text.toLowerCase().includes(option.toLowerCase()),
  );
  return byText === -1 ? undefined : byText;
}

function lessonRecap(context: TutorContext) {
  if (!context.keyPoints?.length) return undefined;
  const heading = context.lessonTitle
    ? `Here are the main ideas from **${context.lessonTitle}**:`
    : "Here are the main ideas:";
  return `${heading}\n\n${bullets(context.keyPoints)}`;
}

export function composeTutorReply(
  question: string,
  context: TutorContext = {},
  history: TutorTurn[] = [],
): string {
  const text = question.trim();
  const lessonEntry = findEntry(`${context.lessonTitle ?? ""} ${context.summary ?? ""}`);
  const entry = findEntry(text);

  // 1. The learner is answering a practice question the tutor just asked.
  const open = openPractice(context, history);
  if (open) {
    const choice = readChoice(text, open);
    if (choice !== undefined) {
      return choice === open.answer
        ? `**Correct.** ${open.explanation}\n\nWant another question, or shall we go deeper on why the other options are wrong?`
        : `Not quite — you chose ${LETTERS[choice]}, and the answer is **${LETTERS[open.answer]}. ${open.options[open.answer]}**.\n\n${open.explanation}\n\nIt's a common mix-up. Want me to explain it a different way?`;
    }
  }

  // 2. Asking for graded answers: coach instead of handing them over.
  if (/(give|tell|show|what('?s| is| are)).{0,24}\banswers?\b.{0,24}(quiz|test|exam|assessment)|cheat/i.test(text)) {
    return "I can't hand over answers to graded quizzes — but I can make sure you're ready for them.\n\nTell me which question is giving you trouble (in your own words) and I'll walk through the idea behind it, or say **quiz me** and I'll give you a practice question that doesn't count.";
  }

  // 3. Practice questions.
  if (/quiz me|test me|practice question|ask me (a|another) question|another (one|question)/i.test(text)) {
    const pool = context.practice ?? [];
    if (pool.length === 0) {
      return "Happy to! Open a video lesson and ask me there — I build practice questions from the lesson you're watching.\n\nIn the meantime, try explaining the last thing you studied in two sentences. If you get stuck, that's the part to review.";
    }
    const asked = history.filter(
      (turn) => turn.role === "assistant" && turn.text.includes(PRACTICE_MARKER),
    ).length;
    return formatPractice(pool[asked % pool.length]);
  }

  // 4. Summaries.
  if (/summar|recap|tl;?dr|key (points|ideas|takeaways)|main (idea|point)/i.test(text)) {
    const recap = lessonRecap(context);
    if (recap) {
      return `${recap}\n\nIf one of those feels shaky, tell me which and I'll unpack it.`;
    }
    return "I can summarise any lesson you have open. From here, tell me the topic — for example “summarise overfitting” — and I'll give you the short version.";
  }

  // 5. A concept we know, optionally simplified or with an example.
  const wantsSimple = /simpl|eli5|like i'?m|plain|easy|confus|don'?t (get|understand)|lost/i.test(text);
  const wantsExample = /example|analogy|real[- ]world|everyday/i.test(text);
  const concept = entry ?? ((wantsSimple || wantsExample) ? lessonEntry : undefined);
  if (concept) {
    if (wantsExample && !wantsSimple) {
      return `Here's an everyday way to picture **${concept.name.toLowerCase()}**:\n\n${concept.example}\n\nThe link: ${concept.simple}\n\nDoes that click? I can give you a practice question to check.`;
    }
    if (wantsSimple) {
      return `No problem — let's strip it right back.\n\n**${concept.name}**: ${concept.simple}\n\nPicture this: ${concept.example}\n\nOnce that feels comfortable, the fuller version is: ${concept.detail}`;
    }
    return `**${concept.name}** — ${concept.simple}\n\n${concept.detail}\n\n**Example:** ${concept.example}\n\nWant me to quiz you on this, or explain it another way?`;
  }

  // 6. Study advice.
  if (/study|revise|revision|prepare|exam|remember|memor/i.test(text)) {
    return `A routine that works for most learners:\n\n${bullets([
      "**Watch actively.** Answer every in-video checkpoint before continuing — getting one wrong is useful information.",
      "**Recall, don't re-read.** After a lesson, close it and write the key points from memory.",
      "**Space it out.** Three 20-minute sessions across a week beat one long one.",
      "**Test early.** Take the unit quiz as soon as you finish; you can retake it and your best score counts.",
    ])}\n\nTell me what you're preparing for and I'll suggest where to start.`;
  }

  // 7. Small talk.
  if (/^(hi|hello|hey|yo|good (morning|afternoon|evening))\b/i.test(text)) {
    const about = context.lessonTitle ? ` You're on **${context.lessonTitle}**.` : "";
    return `Hi! I'm your AI tutor.${about} Ask me to explain a concept, give an example, summarise the lesson, or quiz you.`;
  }
  if (/thank|thanks|cheers|got it|makes sense/i.test(text)) {
    return "Glad that helped. When you're ready, say **quiz me** and we'll check it's stuck.";
  }

  // 8. Fallback: stay anchored to the lesson rather than inventing an answer.
  const recap = lessonRecap(context);
  if (recap) {
    return `Good question. Let me tie it back to what this lesson covers.\n\n${recap}\n\nWhich of these is closest to what you're asking? I can explain it more simply, give an example, or quiz you on it.`;
  }
  return `I can help with concepts from your courses. Try one of these:\n\n${bullets([
    "“Explain overfitting simply”",
    "“Give me an example of compound interest”",
    "“What's the difference between classification and regression?”",
    "“How should I study for a quiz?”",
  ])}`;
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Yields the reply a few words at a time, the way a streamed model response arrives. */
export async function* streamTutorReply(
  question: string,
  context: TutorContext = {},
  history: TutorTurn[] = [],
): AsyncGenerator<string> {
  const reply = composeTutorReply(question, context, history);
  await wait(550);
  const tokens = reply.match(/\S+\s*/g) ?? [reply];
  for (let index = 0; index < tokens.length; index += 3) {
    yield tokens.slice(index, index + 3).join("");
    await wait(28);
  }
}
