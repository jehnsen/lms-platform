import type { Course, CourseModule, Lesson, VideoKey } from "@/lib/types";

/**
 * Placeholder clips streamed from the W3C media server. Every video lesson
 * plays one of these until real uploads are wired to a backend; captions and
 * checkpoints are positioned as fractions of the clip so any video can be
 * swapped in.
 */
export const SAMPLE_VIDEOS: Record<VideoKey, string> = {
  sintel: "https://media.w3.org/2010/05/sintel/trailer.mp4",
  bunny: "https://media.w3.org/2010/05/bunny/trailer.mp4",
};

export const courses: Course[] = [
  {
    id: "ml-foundations",
    thumbnail: "/thumbnails/course-ml-foundations.jpg",
    title: "Machine Learning Foundations",
    tagline: "Understand how machines learn from data — no PhD required.",
    description:
      "A first course in machine learning for curious beginners. You will build intuition for how models learn from examples, why they sometimes fail, and how to tell a good model from a lucky one.",
    subject: "Computer Science",
    level: "Beginner",
    instructor: "Dr. Amara Okafor",
    accent: "#17346b",
    learners: 12840,
    rating: 4.8,
    modules: [
      {
        id: "ml-m1",
        title: "What is machine learning?",
        quizId: "ml-quiz-1",
        lessons: [
          {
            id: "ml-learning-from-data",
            thumbnail: "/thumbnails/ml-learning-from-data.jpg",
            title: "Learning from data",
            type: "video",
            video: "sintel",
            minutes: 9,
            summary:
              "Traditional programs follow rules a person wrote. Machine learning flips that around: we show the computer examples and let it work out the rules itself.",
            keyPoints: [
              "A model is a function whose behaviour is set by numbers called parameters.",
              "Training means adjusting those parameters so predictions match known examples.",
              "More data helps only if it is relevant and representative.",
            ],
            transcript: [
              "Welcome. In this lesson we ask a simple question: how can a computer learn?",
              "In ordinary programming, a person writes the rules and the computer follows them.",
              "Machine learning turns that around. We give the computer examples, and it finds the rules.",
              "Think of teaching a child what a cat is. You don't list rules — you point at cats.",
              "A model is just a function with adjustable numbers inside it, called parameters.",
              "Training nudges those parameters until the model's guesses match the examples.",
              "The quality of what it learns depends on the quality of the examples you show it.",
              "Next, we'll look at the two main ways of setting up a learning problem.",
            ],
            checkpoints: [
              {
                id: "cp-ml-1a",
                position: 0.42,
                prompt:
                  "What is the key difference between traditional programming and machine learning?",
                options: [
                  "ML programs run faster than hand-written ones",
                  "In ML the rules are learned from examples rather than written by hand",
                  "ML does not need any data",
                  "Traditional programs cannot make predictions",
                ],
                answer: 1,
                explanation:
                  "In machine learning we supply examples and the algorithm infers the rules, instead of a programmer writing each rule explicitly.",
              },
              {
                id: "cp-ml-1b",
                position: 0.8,
                prompt: "What does “training” a model actually change?",
                options: [
                  "The training data",
                  "The programming language",
                  "The model's parameters",
                  "The question being asked",
                ],
                answer: 2,
                explanation:
                  "Training adjusts the model's parameters so that its outputs get closer to the known answers.",
              },
            ],
          },
          {
            id: "ml-supervised-unsupervised",
            thumbnail: "/thumbnails/ml-supervised-unsupervised.jpg",
            title: "Supervised vs. unsupervised learning",
            type: "video",
            video: "bunny",
            minutes: 11,
            summary:
              "Supervised learning uses labelled examples to predict an answer. Unsupervised learning has no labels and looks for structure instead.",
            keyPoints: [
              "Supervised learning: inputs paired with correct answers (labels).",
              "Classification predicts a category; regression predicts a number.",
              "Unsupervised learning finds groups or patterns without labels.",
            ],
            transcript: [
              "There are two big families of machine learning problems.",
              "In supervised learning, every example comes with the right answer, called a label.",
              "Predicting a category, like spam or not spam, is called classification.",
              "Predicting a number, like tomorrow's temperature, is called regression.",
              "In unsupervised learning there are no labels. The model looks for structure by itself.",
              "Grouping similar customers together is a classic example, known as clustering.",
            ],
            checkpoints: [
              {
                id: "cp-ml-2a",
                position: 0.55,
                prompt:
                  "You want to predict the selling price of a house from its size and location. What kind of problem is this?",
                options: ["Clustering", "Classification", "Regression", "Unsupervised learning"],
                answer: 2,
                explanation:
                  "The target is a number (the price), and we have labelled past sales to learn from — that is supervised regression.",
              },
            ],
          },
          {
            id: "ml-short-history",
            thumbnail: "/thumbnails/ml-short-history.jpg",
            title: "A short history of machine learning",
            type: "reading",
            minutes: 6,
            summary:
              "From the perceptron in the 1950s to today's large models: the same core idea, with far more data and compute.",
            keyPoints: [
              "The perceptron (1958) was an early model that learned from examples.",
              "Progress stalled twice in so-called “AI winters” when expectations outran results.",
              "Data, compute and better training methods drove the 2010s breakthroughs.",
            ],
            body: [
              "The idea that machines could learn is older than most people expect. In 1958 Frank Rosenblatt demonstrated the perceptron, a simple model that adjusted its own weights after seeing labelled examples. Newspapers predicted thinking machines within a decade.",
              "They were early. Researchers soon showed that a single perceptron could not learn some very simple patterns, funding dried up, and the field entered the first of two “AI winters”. Interest returned in the 1980s when backpropagation made it practical to train networks with several layers.",
              "The modern era began around 2012. Three things arrived together: very large labelled datasets, graphics processors that could do the arithmetic quickly, and a set of training techniques that kept deep networks stable. The core recipe — show examples, measure the error, adjust the parameters — had not changed. The scale had.",
              "As you work through this course, keep that recipe in mind. Almost everything else is a refinement of it.",
            ],
          },
        ],
      },
      {
        id: "ml-m2",
        title: "Training models",
        quizId: "ml-quiz-2",
        lessons: [
          {
            id: "ml-gradient-descent",
            thumbnail: "/thumbnails/ml-gradient-descent.jpg",
            title: "How models learn: loss and gradient descent",
            type: "video",
            video: "sintel",
            minutes: 14,
            summary:
              "A loss function scores how wrong the model is. Gradient descent repeatedly nudges the parameters in the direction that lowers that score.",
            keyPoints: [
              "Loss measures the gap between predictions and correct answers.",
              "The gradient points in the direction where loss increases fastest — so we step the other way.",
              "The learning rate controls the step size: too big overshoots, too small crawls.",
            ],
            transcript: [
              "To improve a model we first need a way to measure how wrong it is.",
              "That measurement is called the loss. A lower loss means better predictions.",
              "Picture the loss as a hilly landscape, and the model as a hiker standing on it in fog.",
              "The hiker can't see the valley, but can feel which way the ground slopes.",
              "That slope is the gradient. Stepping downhill, against it, reduces the loss.",
              "Repeat that step many times and you have gradient descent.",
              "The size of each step is the learning rate. Too large and you overshoot the valley.",
              "Too small, and training takes forever. Choosing it well is part of the craft.",
            ],
            checkpoints: [
              {
                id: "cp-ml-4a",
                position: 0.5,
                prompt: "In gradient descent, which direction do we move the parameters?",
                options: [
                  "In the direction of the gradient",
                  "Opposite to the gradient",
                  "In a random direction",
                  "We don't move them; we change the data",
                ],
                answer: 1,
                explanation:
                  "The gradient points uphill, towards higher loss. We step in the opposite direction to reduce the loss.",
              },
              {
                id: "cp-ml-4b",
                position: 0.88,
                prompt: "What usually happens if the learning rate is far too large?",
                options: [
                  "Training becomes very slow but stable",
                  "The loss can bounce around or grow instead of shrinking",
                  "The model stops using the training data",
                  "Nothing changes",
                ],
                answer: 1,
                explanation:
                  "Oversized steps jump past the minimum, so the loss oscillates or diverges.",
              },
            ],
          },
          {
            id: "ml-overfitting",
            thumbnail: "/thumbnails/ml-overfitting.jpg",
            title: "Overfitting and generalization",
            type: "video",
            video: "bunny",
            minutes: 12,
            summary:
              "A model that memorises its training data can look perfect and still fail on anything new. The real goal is to generalize.",
            keyPoints: [
              "Overfitting: low training error, high error on unseen data.",
              "Underfitting: the model is too simple to capture the pattern at all.",
              "More data, simpler models and regularization all reduce overfitting.",
            ],
            transcript: [
              "Imagine a student who memorises last year's exam answers word for word.",
              "They score perfectly on that paper, and fail as soon as the questions change.",
              "Models do the same thing. We call it overfitting.",
              "The model has learned the noise in the training data, not the underlying pattern.",
              "What we really want is generalization: doing well on examples it has never seen.",
              "More data, a simpler model, or regularization can all help close that gap.",
            ],
            checkpoints: [
              {
                id: "cp-ml-5a",
                position: 0.6,
                prompt:
                  "A model scores 99% on training data but 62% on new data. What is the most likely problem?",
                options: ["Underfitting", "Overfitting", "The learning rate is zero", "Too little compute"],
                answer: 1,
                explanation:
                  "A large gap between training and unseen performance is the signature of overfitting.",
              },
            ],
          },
        ],
      },
      {
        id: "ml-m3",
        title: "Evaluating models",
        lessons: [
          {
            id: "ml-train-val-test",
            thumbnail: "/thumbnails/ml-train-val-test.jpg",
            title: "Train, validation and test sets",
            type: "video",
            video: "sintel",
            minutes: 10,
            summary:
              "Splitting your data three ways lets you train, tune, and then get one honest estimate of real-world performance.",
            keyPoints: [
              "Training set: used to fit parameters.",
              "Validation set: used to compare models and tune settings.",
              "Test set: touched once, at the end, for an unbiased estimate.",
            ],
            transcript: [
              "How do we know whether a model will work on data it hasn't seen?",
              "We hold some data back. The model never trains on it.",
              "The training set is what the model learns from.",
              "The validation set is for making choices, such as which model or settings to use.",
              "The test set stays locked away until the very end.",
              "Use it once, and you get an honest estimate of how the model will do in the real world.",
            ],
            checkpoints: [
              {
                id: "cp-ml-6a",
                position: 0.7,
                prompt: "Why should the test set be used only once, at the end?",
                options: [
                  "It is usually too small to reuse",
                  "Repeatedly tuning against it leaks information and makes the estimate too optimistic",
                  "It contains the labels for the training set",
                  "It makes training faster",
                ],
                answer: 1,
                explanation:
                  "Every decision made by looking at test results fits the model a little to that set, so it stops being an unbiased measure.",
              },
            ],
          },
          {
            id: "ml-choosing-metric",
            thumbnail: "/thumbnails/ml-choosing-metric.jpg",
            title: "Choosing the right metric",
            type: "reading",
            minutes: 7,
            summary:
              "Accuracy is not always the right score. The best metric depends on which mistakes are most costly.",
            keyPoints: [
              "Accuracy misleads when classes are imbalanced.",
              "Precision: of the items flagged, how many were right?",
              "Recall: of the items that should be flagged, how many were found?",
            ],
            body: [
              "Suppose 1 in 100 emails is a phishing attempt. A model that labels every email “safe” is 99% accurate — and completely useless. Accuracy hides the problem because one class is so much more common than the other.",
              "Two other measures tell you more. Precision asks: of everything the model flagged, what share was truly a problem? Recall asks: of everything that truly was a problem, what share did the model catch?",
              "They pull against each other. Flag more aggressively and recall rises while precision falls. Which one matters most depends on the cost of each mistake. A medical screening test should favour recall, because a missed case is serious. A spam filter should favour precision, because losing a real email is worse than seeing one piece of junk.",
              "Before training anything, decide which error you can least afford. That decision picks your metric.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "web-dev",
    thumbnail: "/thumbnails/course-web-dev.jpg",
    title: "Web Development Fundamentals",
    tagline: "Build your first real web pages with HTML and CSS.",
    description:
      "Start from a blank file and finish with a responsive page you can share. Short videos, frequent practice, and no prior coding experience needed.",
    subject: "Technology",
    level: "Beginner",
    instructor: "Marco Reyes",
    accent: "#7a2e12",
    learners: 20415,
    rating: 4.7,
    modules: [
      {
        id: "web-m1",
        title: "HTML and structure",
        quizId: "web-quiz-1",
        lessons: [
          {
            id: "web-how-web-works",
            thumbnail: "/thumbnails/web-how-web-works.jpg",
            title: "How the web works",
            type: "video",
            video: "bunny",
            minutes: 8,
            summary:
              "When you visit a page, your browser sends a request to a server and gets back files it knows how to draw.",
            keyPoints: [
              "The browser is the client; it requests pages from a server.",
              "HTML gives structure, CSS gives style, JavaScript adds behaviour.",
              "A URL is the address of a resource on the web.",
            ],
            transcript: [
              "Every time you open a website, a short conversation happens.",
              "Your browser, the client, asks a server for a page using its address, the URL.",
              "The server replies with files. The most important one is HTML.",
              "HTML describes the structure of the page: headings, paragraphs, links, images.",
              "CSS controls how it looks, and JavaScript controls how it behaves.",
              "Your browser reads all three and draws the page you see.",
            ],
            checkpoints: [
              {
                id: "cp-web-1a",
                position: 0.6,
                prompt: "Which technology is responsible for a page's structure?",
                options: ["CSS", "HTML", "JavaScript", "HTTP"],
                answer: 1,
                explanation:
                  "HTML describes what is on the page and how it is organised. CSS styles it and JavaScript adds behaviour.",
              },
            ],
          },
          {
            id: "web-semantic-html",
            thumbnail: "/thumbnails/web-semantic-html.jpg",
            title: "Semantic HTML",
            type: "video",
            video: "sintel",
            minutes: 12,
            summary:
              "Choosing elements for what they mean — not how they look — makes pages easier to read for people, search engines and assistive technology.",
            keyPoints: [
              "Use elements like header, nav, main, article and footer to describe page regions.",
              "Headings (h1–h6) form an outline; do not skip levels for styling.",
              "Semantic markup gives screen reader users a way to navigate.",
            ],
            transcript: [
              "You could build an entire page out of nothing but div elements.",
              "It would look fine, but it would mean nothing to a machine reading it.",
              "Semantic HTML means picking elements for their meaning.",
              "A nav element says: these are navigation links. A main element says: this is the content.",
              "Headings create an outline, like the table of contents in a book.",
              "Screen readers use that outline to let people jump around the page.",
              "Search engines use it too. Good structure is good for everyone.",
            ],
            checkpoints: [
              {
                id: "cp-web-2a",
                position: 0.5,
                prompt: "Which element best marks up a site's main set of navigation links?",
                options: ["<div class=\"nav\">", "<nav>", "<section>", "<links>"],
                answer: 1,
                explanation:
                  "The <nav> element tells browsers and assistive technology that its contents are navigation.",
              },
            ],
          },
        ],
      },
      {
        id: "web-m2",
        title: "Styling with CSS",
        quizId: "web-quiz-2",
        lessons: [
          {
            id: "web-box-model",
            thumbnail: "/thumbnails/web-box-model.jpg",
            title: "The box model",
            type: "video",
            video: "bunny",
            minutes: 10,
            summary:
              "Every element is a box made of content, padding, border and margin. Understanding those layers explains most layout surprises.",
            keyPoints: [
              "From the inside out: content, padding, border, margin.",
              "Padding is inside the border; margin is outside it.",
              "box-sizing: border-box makes width include padding and border.",
            ],
            transcript: [
              "In CSS, everything on the page is a rectangular box.",
              "At the centre is the content: your text or image.",
              "Around it is padding, the space inside the border.",
              "Then the border itself, and outside that, the margin.",
              "By default, width only measures the content, which surprises almost everyone.",
              "Setting box-sizing to border-box makes width include padding and border.",
            ],
            checkpoints: [
              {
                id: "cp-web-3a",
                position: 0.65,
                prompt: "Which layer sits between the content and the border?",
                options: ["Margin", "Outline", "Padding", "Gap"],
                answer: 2,
                explanation: "Padding is the space inside the border, between it and the content.",
              },
            ],
          },
          {
            id: "web-flexbox",
            thumbnail: "/thumbnails/web-flexbox.jpg",
            title: "Flexbox in ten minutes",
            type: "video",
            video: "sintel",
            minutes: 10,
            summary:
              "Flexbox lays items out along one axis and gives you simple controls for spacing and alignment.",
            keyPoints: [
              "display: flex turns an element into a flex container.",
              "justify-content aligns along the main axis; align-items along the cross axis.",
              "flex-direction switches the main axis between row and column.",
            ],
            transcript: [
              "Flexbox is the quickest way to line things up in CSS.",
              "Set display to flex on a parent, and its children become flex items.",
              "They sit in a row by default. That direction is called the main axis.",
              "Justify-content spaces the items along the main axis.",
              "Align-items positions them on the cross axis, at right angles to it.",
              "Change flex-direction to column and the two axes swap.",
              "With those three properties you can build most everyday layouts.",
            ],
            checkpoints: [
              {
                id: "cp-web-4a",
                position: 0.62,
                prompt:
                  "In a default flex row, which property centres items horizontally?",
                options: ["align-items", "justify-content", "text-align", "flex-wrap"],
                answer: 1,
                explanation:
                  "In a row the main axis is horizontal, and justify-content controls placement along the main axis.",
              },
            ],
          },
          {
            id: "web-specificity",
            thumbnail: "/thumbnails/web-specificity.jpg",
            title: "CSS specificity cheat sheet",
            type: "reading",
            minutes: 5,
            summary: "When two rules disagree, specificity decides which one wins.",
            keyPoints: [
              "Inline styles beat IDs, which beat classes, which beat element selectors.",
              "When specificity ties, the later rule wins.",
              "Prefer low-specificity class selectors so styles stay easy to override.",
            ],
            body: [
              "Sooner or later you will write a rule that seems to do nothing. Usually another rule is winning, and specificity is the reason.",
              "Browsers rank selectors in tiers. Inline styles sit at the top. Below them are ID selectors, then classes, attributes and pseudo-classes, and finally plain element selectors. A single ID outranks any number of classes.",
              "If two rules have exactly the same specificity, the one that appears later in the stylesheet wins. That is the “cascade” in Cascading Style Sheets.",
              "The practical advice is to stay low. Style with single classes where you can, avoid IDs in CSS, and treat !important as a last resort. Low-specificity rules are easy to override later; high-specificity ones start arms races.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "cell-biology",
    thumbnail: "/thumbnails/course-cell-biology.jpg",
    title: "Biology: Cells and Genetics",
    tagline: "Explore the machinery of life, from membranes to DNA.",
    description:
      "A visual tour of the cell and the code it carries. Each lesson pairs a short video with checkpoint questions so ideas stick before you move on.",
    subject: "Science",
    level: "Intermediate",
    instructor: "Dr. Lena Park",
    accent: "#0f4d3a",
    learners: 8630,
    rating: 4.9,
    modules: [
      {
        id: "bio-m1",
        title: "Inside the cell",
        quizId: "bio-quiz-1",
        lessons: [
          {
            id: "bio-organelles",
            thumbnail: "/thumbnails/bio-organelles.jpg",
            title: "Cell structure and organelles",
            type: "video",
            video: "sintel",
            minutes: 13,
            summary:
              "A cell is a busy city. Each organelle has a job, from storing instructions to producing energy.",
            keyPoints: [
              "The nucleus stores DNA in eukaryotic cells.",
              "Mitochondria release usable energy (ATP) from food.",
              "Ribosomes build proteins; the Golgi apparatus packages and ships them.",
            ],
            transcript: [
              "A good way to picture a cell is as a small, crowded city.",
              "The nucleus is city hall. It holds the plans, written in DNA.",
              "Ribosomes are the factories, building proteins from those plans.",
              "The Golgi apparatus is the post office: it packages proteins and sends them on.",
              "Mitochondria are the power stations, releasing energy the cell can spend.",
              "And around it all is the membrane, deciding what gets in and out.",
            ],
            checkpoints: [
              {
                id: "cp-bio-1a",
                position: 0.55,
                prompt: "Which organelle builds proteins?",
                options: ["Mitochondrion", "Ribosome", "Nucleus", "Lysosome"],
                answer: 1,
                explanation:
                  "Ribosomes read messenger RNA and assemble amino acids into proteins.",
              },
            ],
          },
          {
            id: "bio-membranes",
            thumbnail: "/thumbnails/bio-membranes.jpg",
            title: "Membranes and transport",
            type: "video",
            video: "bunny",
            minutes: 11,
            summary:
              "The cell membrane is selectively permeable. Some substances drift across; others need a protein channel or an energy-powered pump.",
            keyPoints: [
              "Diffusion moves particles from high to low concentration without energy.",
              "Osmosis is the diffusion of water across a membrane.",
              "Active transport uses energy to move substances against a gradient.",
            ],
            transcript: [
              "The membrane is the cell's border control.",
              "Small molecules like oxygen simply drift across. That is diffusion.",
              "They move from where there is more of them to where there is less.",
              "Water does the same thing. We give that a special name: osmosis.",
              "Moving something the other way, against the gradient, costs energy.",
              "That is active transport, and it relies on protein pumps in the membrane.",
            ],
            checkpoints: [
              {
                id: "cp-bio-2a",
                position: 0.7,
                prompt: "Which process requires the cell to spend energy?",
                options: ["Diffusion", "Osmosis", "Active transport", "Facilitated diffusion"],
                answer: 2,
                explanation:
                  "Active transport moves substances against their concentration gradient, which needs energy from ATP.",
              },
            ],
          },
        ],
      },
      {
        id: "bio-m2",
        title: "Genetics",
        lessons: [
          {
            id: "bio-dna",
            thumbnail: "/thumbnails/bio-dna.jpg",
            title: "DNA: the code of life",
            type: "video",
            video: "sintel",
            minutes: 12,
            summary:
              "DNA stores information in a four-letter alphabet. The order of those letters is the instruction set for building proteins.",
            keyPoints: [
              "DNA is a double helix built from four bases: A, T, C and G.",
              "A pairs with T; C pairs with G.",
              "A gene is a stretch of DNA that codes for a protein.",
            ],
            transcript: [
              "Every living cell carries a set of instructions written in DNA.",
              "DNA is a long molecule shaped like a twisted ladder: the double helix.",
              "The rungs are made of four bases, known by the letters A, T, C and G.",
              "A always pairs with T, and C always pairs with G.",
              "The order of those letters spells out the cell's instructions.",
              "A stretch that codes for one protein is called a gene.",
            ],
            checkpoints: [
              {
                id: "cp-bio-3a",
                position: 0.62,
                prompt: "Which base pairs with adenine (A) in DNA?",
                options: ["Cytosine (C)", "Guanine (G)", "Thymine (T)", "Uracil (U)"],
                answer: 2,
                explanation: "In DNA, A pairs with T and C pairs with G.",
              },
            ],
          },
          {
            id: "bio-mitosis",
            thumbnail: "/thumbnails/bio-mitosis.jpg",
            title: "Mitosis step by step",
            type: "video",
            video: "bunny",
            minutes: 14,
            summary:
              "Mitosis copies one cell into two identical cells in four stages: prophase, metaphase, anaphase and telophase.",
            keyPoints: [
              "DNA is copied before mitosis begins, during interphase.",
              "Chromosomes line up in the middle of the cell during metaphase.",
              "The result is two genetically identical daughter cells.",
            ],
            transcript: [
              "Your body replaces millions of cells every second. It does that by mitosis.",
              "Before it starts, the cell copies all of its DNA.",
              "In prophase, the chromosomes condense and become visible.",
              "In metaphase, they line up along the middle of the cell.",
              "In anaphase, the copies are pulled apart to opposite ends.",
              "In telophase, two new nuclei form, and the cell divides in two.",
            ],
            checkpoints: [
              {
                id: "cp-bio-4a",
                position: 0.72,
                prompt: "During which stage do chromosomes line up at the centre of the cell?",
                options: ["Prophase", "Metaphase", "Anaphase", "Telophase"],
                answer: 1,
                explanation: "Metaphase — think “M for middle”.",
              },
            ],
          },
          {
            id: "bio-mendel",
            thumbnail: "/thumbnails/bio-mendel.jpg",
            title: "Mendel and inheritance",
            type: "reading",
            minutes: 8,
            summary:
              "Gregor Mendel's pea plants revealed that traits are inherited as discrete units, some dominant and some recessive.",
            keyPoints: [
              "Each parent passes on one allele for each gene.",
              "A dominant allele masks a recessive one.",
              "A Punnett square predicts the odds of each combination.",
            ],
            body: [
              "In the 1860s an Augustinian friar named Gregor Mendel spent eight years crossing pea plants in a monastery garden and counting the results. What he found became the foundation of genetics.",
              "Mendel noticed that traits did not blend. Crossing a tall plant with a short one did not give medium plants; it gave tall ones. But the short trait was not gone — it reappeared in about a quarter of the next generation.",
              "His explanation was that each plant carries two copies of the instruction for a trait, one from each parent. We now call those versions alleles. When the two differ, one — the dominant allele — is expressed and the other — the recessive allele — is hidden.",
              "A Punnett square is a simple grid for working out the odds. Put one parent's alleles across the top, the other's down the side, and fill in the boxes. Each box is one equally likely outcome for their offspring.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "money-skills",
    thumbnail: "/thumbnails/course-money-skills.jpg",
    title: "Money Skills: Personal Finance",
    tagline: "Budget, save and understand interest before your first paycheck.",
    description:
      "Practical money skills in short lessons: how to plan spending, why starting early matters, and how to avoid the most common traps.",
    subject: "Life Skills",
    level: "Beginner",
    instructor: "Sofia Mendes",
    accent: "#5a4300",
    learners: 15270,
    rating: 4.6,
    modules: [
      {
        id: "fin-m1",
        title: "Budgeting basics",
        quizId: "fin-quiz-1",
        lessons: [
          {
            id: "fin-needs-wants",
            thumbnail: "/thumbnails/fin-needs-wants.jpg",
            title: "Needs, wants and the 50/30/20 rule",
            type: "video",
            video: "bunny",
            minutes: 7,
            summary:
              "A simple starting split for your income: half for needs, about a third for wants, and a fifth for savings.",
            keyPoints: [
              "Needs are essentials such as housing, food and transport.",
              "Wants make life enjoyable but could be reduced.",
              "50/30/20 is a guide, not a law — adjust it to your situation.",
            ],
            transcript: [
              "A budget is simply a plan for your money before you spend it.",
              "Start by sorting spending into needs and wants.",
              "Needs are things you can't go without: rent, food, getting to school or work.",
              "Wants are everything that makes life fun but isn't essential.",
              "A popular starting point is the fifty, thirty, twenty rule.",
              "Half for needs, thirty percent for wants, and twenty percent saved.",
            ],
            checkpoints: [
              {
                id: "cp-fin-1a",
                position: 0.75,
                prompt: "Under the 50/30/20 rule, what share of income goes to savings?",
                options: ["50%", "30%", "20%", "10%"],
                answer: 2,
                explanation: "50% needs, 30% wants, 20% savings and debt repayment.",
              },
            ],
          },
          {
            id: "fin-first-budget",
            thumbnail: "/thumbnails/fin-first-budget.jpg",
            title: "Building your first budget",
            type: "reading",
            minutes: 6,
            summary: "Four steps to a budget you will actually keep using.",
            keyPoints: [
              "Track what you really spend for a month before you plan.",
              "Give every unit of income a job, including savings.",
              "Review monthly and adjust rather than abandoning the plan.",
            ],
            body: [
              "Most first budgets fail for the same reason: they are built from guesses. Before you plan anything, spend one month simply writing down where your money goes. The result is usually a surprise.",
              "Next, list your income and sort last month's spending into needs, wants and savings. Compare the split with 50/30/20. You are not aiming for a perfect match — you are looking for the one or two categories that are far from where you want them.",
              "Then give every unit of income a job for the coming month. Savings counts as a job, and it should be paid first, on the day money arrives, rather than from whatever is left at the end.",
              "Finally, check in once a month. A budget that is adjusted is working. A budget that is never looked at again is not.",
            ],
          },
        ],
      },
      {
        id: "fin-m2",
        title: "Growing your money",
        lessons: [
          {
            id: "fin-compound-interest",
            thumbnail: "/thumbnails/fin-compound-interest.jpg",
            title: "Compound interest explained",
            type: "video",
            video: "sintel",
            minutes: 9,
            summary:
              "With compound interest you earn interest on your interest. Given enough time, that snowball does most of the work.",
            keyPoints: [
              "Simple interest is paid on the original amount only.",
              "Compound interest is paid on the original amount plus past interest.",
              "Time matters more than the amount: starting early beats saving more later.",
            ],
            transcript: [
              "Compound interest has been called the eighth wonder of the world.",
              "Here is the idea. You save some money, and it earns interest.",
              "Next year you earn interest on the original amount and on last year's interest.",
              "It works like a snowball rolling downhill, picking up more snow as it grows.",
              "In the early years the growth looks small. Later, it accelerates.",
              "That is why time is the most powerful ingredient in saving.",
              "Someone who starts at eighteen can end up ahead of someone who saves more but starts at thirty.",
            ],
            checkpoints: [
              {
                id: "cp-fin-3a",
                position: 0.5,
                prompt: "What makes compound interest different from simple interest?",
                options: [
                  "It has a higher interest rate",
                  "Interest is earned on previous interest as well as the original amount",
                  "It is only available to businesses",
                  "It is paid once at the end",
                ],
                answer: 1,
                explanation:
                  "Compounding means each period's interest is added to the balance, so future interest is calculated on a larger amount.",
              },
            ],
          },
          {
            id: "fin-saving-investing",
            thumbnail: "/thumbnails/fin-saving-investing.jpg",
            title: "Saving vs. investing",
            type: "video",
            video: "bunny",
            minutes: 10,
            summary:
              "Savings are safe and easy to reach; investments can grow faster but can also fall. Each has a different job.",
            keyPoints: [
              "Keep an emergency fund in savings before investing.",
              "Higher potential return comes with higher risk.",
              "Diversifying spreads risk across many investments.",
            ],
            transcript: [
              "Saving and investing sound similar, but they do different jobs.",
              "Savings are for money you may need soon. They are safe and easy to reach.",
              "Investing is for goals years away. It can grow faster, but its value goes up and down.",
              "That trade-off between risk and return never goes away.",
              "Spreading money across many investments, called diversifying, reduces the risk.",
              "A sensible order is: emergency savings first, then investing for the long term.",
            ],
            checkpoints: [
              {
                id: "cp-fin-4a",
                position: 0.68,
                prompt: "What should generally come first?",
                options: [
                  "Investing in a single company",
                  "Building an emergency fund in savings",
                  "Borrowing to invest",
                  "Buying the riskiest asset for the highest return",
                ],
                answer: 1,
                explanation:
                  "An emergency fund stops you having to sell investments at a bad time when something unexpected happens.",
              },
            ],
          },
        ],
      },
    ],
  },
];

export function getCourse(courseId: string) {
  return courses.find((course) => course.id === courseId);
}

export function courseLessons(course: Course): Lesson[] {
  return course.modules.flatMap((module) => module.lessons);
}

export function courseMinutes(course: Course) {
  return courseLessons(course).reduce((sum, lesson) => sum + lesson.minutes, 0);
}

export interface LessonLocation {
  course: Course;
  module: CourseModule;
  lesson: Lesson;
  index: number;
  total: number;
  previous?: Lesson;
  next?: Lesson;
}

export function findLesson(courseId: string, lessonId: string): LessonLocation | undefined {
  const course = getCourse(courseId);
  if (!course) return undefined;
  const lessons = courseLessons(course);
  const index = lessons.findIndex((lesson) => lesson.id === lessonId);
  if (index === -1) return undefined;
  const lesson = lessons[index];
  const courseModule = course.modules.find((module) => module.lessons.includes(lesson));
  if (!courseModule) return undefined;
  return {
    course,
    module: courseModule,
    lesson,
    index,
    total: lessons.length,
    previous: lessons[index - 1],
    next: lessons[index + 1],
  };
}
