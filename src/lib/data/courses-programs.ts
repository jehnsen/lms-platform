import type { Course } from "@/lib/types";

/**
 * Seed data: courses that belong to the programs Don Bosco College – Canlubang
 * actually runs: the Bachelor of Arts in Philosophy, the Bachelor of Secondary
 * Education (Values Education), and the Bachelor of Technical-Vocational
 * Teacher Education (Automotive), plus the Salesian formation every student
 * takes. `courses.ts` adds these to the general courses.
 *
 * The content is written for the demo: it is accurate, but a teacher would
 * replace it with their own syllabus.
 */
export const programCourses: Course[] = [
  {
    id: "ethics",
    code: "ETH-101",
    termId: "term-2026-1",
    status: "active",
    thumbnail: "/thumbnails/course-ethics.svg",
    title: "Ethics",
    tagline: "Think clearly about right and wrong, and act on what you decide.",
    description:
      "A general education course in moral philosophy. You will study what makes an act a moral act, the ethical theories behind everyday judgements, and how to reason through a dilemma from your own life as a student, a son or daughter, and a Filipino.",
    subject: "Philosophy",
    level: "Beginner",
    instructor: "Mr. Joselito Magtibay",
    accent: "#4a2c6b",
    learners: 13,
    rating: 0,
    modules: [
      {
        id: "eth-m1",
        title: "The moral life",
        quizId: "eth-quiz-1",
        lessons: [
          {
            id: "eth-moral-agent",
            thumbnail: "/thumbnails/eth-moral-agent.svg",
            title: "The moral agent: acts, freedom and conscience",
            type: "video",
            video: "sintel",
            minutes: 11,
            summary:
              "Ethics begins with the human act: something done knowingly and freely. Only such acts can be called good or bad, and conscience is the judgement we make about them.",
            keyPoints: [
              "A human act is done with knowledge and free will; an act of man, like a heartbeat, is not.",
              "Ignorance, fear, habit and force can lessen how responsible a person is for an act.",
              "Conscience is the judgement of reason about whether an act is good or bad. It must be formed, not just obeyed.",
            ],
            transcript: [
              "Why do we blame a thief but not a person who sneezes?",
              "Ethics studies human acts: things we do knowingly and by free choice.",
              "A heartbeat or a reflex is an act of man. It happens to us, and nobody calls it good or bad.",
              "For a human act, two things must be present: knowledge of what we are doing, and freedom to choose it.",
              "Responsibility can be lessened. Ignorance, fear, strong habit or force can reduce how free an act really was.",
              "Conscience is reason judging an act as good or bad, before, during or after we do it.",
              "A conscience can be wrong, which is why it has to be formed by study, good advice and honest reflection.",
            ],
            checkpoints: [
              {
                id: "cp-eth-1a",
                position: 0.45,
                prompt: "Which of these is a human act, in the sense used in ethics?",
                options: [
                  "Your heart beating faster when you are nervous",
                  "Blinking when dust gets in your eye",
                  "Deciding to return a wallet you found",
                  "Growing taller during the school year",
                ],
                answer: 2,
                explanation:
                  "A human act is done with knowledge and free choice. Returning the wallet is a decision; the other three just happen to the body.",
              },
              {
                id: "cp-eth-1b",
                position: 0.85,
                prompt: "A student copies an answer because a classmate threatens him. How does this affect his responsibility?",
                options: [
                  "It removes none of it, because copying is always wrong",
                  "It may lessen it, because fear reduces how free the act was",
                  "It increases it, because he had a choice",
                  "It is not a human act at all",
                ],
                answer: 1,
                explanation:
                  "Fear can reduce freedom, and so reduce responsibility. It does not make the act good, and it does not always remove all blame.",
              },
            ],
          },
          {
            id: "eth-filipino-values",
            thumbnail: "/thumbnails/eth-filipino-values.svg",
            title: "Culture, relativism and Filipino values",
            type: "reading",
            minutes: 8,
            summary:
              "Customs differ between societies, but that does not mean every moral claim is just opinion. Filipino values such as pakikipagkapwa and utang na loob show how a culture shapes moral life, and where it can be tested.",
            keyPoints: [
              "Cultural relativism says right and wrong depend only on a society's customs; critics point out that it cannot explain moral reform.",
              "Pakikipagkapwa means treating the other as a fellow person, and sits at the centre of Filipino ethics.",
              "A value such as utang na loob can build trust or can be used to pressure someone, so it needs to be judged by reason.",
            ],
            body: [
              "Visit another country, or another barangay for that matter, and you will notice that people greet, eat, argue and mourn differently. Cultural relativism takes this fact about customs and draws a conclusion from it: that nothing is right or wrong except what a society approves.",
              "The difficulty is that relativism makes moral reform impossible. If a society's approval is what makes something right, then people who campaigned against slavery or child labour in their own society were simply wrong, because they disagreed with their own culture. Most of us do not believe that. The more careful position is that customs differ, but we can still ask whether a custom serves human dignity.",
              "Filipino moral life has its own vocabulary. Pakikipagkapwa, treating the other as kapwa, a fellow human being and not a stranger, is the root of many everyday virtues: pakikisama, bayanihan, malasakit. Utang na loob, the debt of gratitude owed to someone who helped you, is why children care for their parents and why neighbours return a favour. Hiya, a sense of propriety and shame, restrains people from acts that would shame themselves or their family.",
              "These values are strengths, and they can also be bent. Utang na loob can turn into a reason for staying silent about a relative's corruption. Hiya can stop a student from asking a question or reporting a wrong. Ethics does not throw the values away. It asks which of their uses protect the dignity of persons, and which do not.",
              "As you read the theories in the next unit, keep one question in mind: if this theory were applied to utang na loob or to hiya, what would it say?",
            ],
          },
        ],
      },
      {
        id: "eth-m2",
        title: "Ethical theories",
        quizId: "eth-quiz-2",
        lessons: [
          {
            id: "eth-utility-duty",
            thumbnail: "/thumbnails/eth-utility-duty.svg",
            title: "Utilitarianism and Kant's duty ethics",
            type: "video",
            video: "bunny",
            minutes: 13,
            summary:
              "Utilitarianism judges an act by its consequences for everyone affected. Kant judges it by whether it could be a rule for all and whether it respects persons as ends.",
            keyPoints: [
              "Utilitarianism (Bentham, Mill): the right act brings the greatest happiness to the greatest number.",
              "Kant's categorical imperative: act only on a rule you could will to be a universal law.",
              "Kant also says never treat a person only as a means; always as an end in themselves.",
            ],
            transcript: [
              "Suppose a barangay can build a covered court or repair the road to the health center, but not both.",
              "A utilitarian asks which choice produces the most good, for the most people.",
              "Jeremy Bentham measured good as pleasure and pain. John Stuart Mill argued that some pleasures, like learning, are worth more than others.",
              "The weakness is that it can seem to allow an injustice to one person if the total benefit is large enough.",
              "Immanuel Kant took a different road. For him an act is right when it follows a duty that reason can accept for everyone.",
              "His test is the categorical imperative: could you will your rule to be a universal law?",
              "A rule like “I may break promises when it suits me” fails, because if everyone did it, promises would mean nothing.",
              "Kant's second formula: treat humanity, in yourself and in others, never only as a means, always also as an end.",
            ],
            checkpoints: [
              {
                id: "cp-eth-3a",
                position: 0.4,
                prompt: "A utilitarian would judge the barangay's choice mainly by…",
                options: [
                  "Which option follows the oldest custom",
                  "Which option produces the greatest good for the greatest number",
                  "Which option the mayor prefers",
                  "Which option the intention behind it is purest",
                ],
                answer: 1,
                explanation: "Utilitarianism is a consequentialist theory: it looks at the results for everyone affected.",
              },
              {
                id: "cp-eth-3b",
                position: 0.85,
                prompt: "Why does “I may break a promise whenever it suits me” fail Kant's universal law test?",
                options: [
                  "Because promises are usually written down",
                  "Because it would make people unhappy in the short term",
                  "Because if everyone acted on it, the practice of promising would collapse",
                  "Because it is against the law",
                ],
                answer: 2,
                explanation:
                  "A rule that destroys the practice it depends on cannot be willed as a universal law. That is the contradiction Kant points to.",
              },
            ],
          },
          {
            id: "eth-virtue-natural-law",
            thumbnail: "/thumbnails/eth-virtue-natural-law.svg",
            title: "Virtue ethics, natural law and the common good",
            type: "reading",
            minutes: 8,
            summary:
              "Aristotle asks what kind of person we should become. The Catholic tradition adds natural law and the dignity of the human person, which also ground the Church's teaching on the common good.",
            keyPoints: [
              "Aristotle: a virtue is a stable habit of choosing the mean between two extremes, and it leads to eudaimonia, human flourishing.",
              "Natural law (Aquinas): reason can discover the basic goods of human life, such as life, knowledge and living in society.",
              "The common good is the sum of conditions that let every person and group reach fulfilment.",
            ],
            body: [
              "Utilitarianism and Kant both start from the question “What should I do?” Aristotle asks a different one: “What kind of person should I become?” For him, the goal of human life is eudaimonia, usually translated as flourishing, and we reach it by building virtues through practice.",
              "A virtue is a stable habit of choosing well. Aristotle described each virtue as a mean between two faults. Courage lies between cowardice and recklessness, and generosity between stinginess and wastefulness. The mean is not an average: it is whatever a wise person would judge right for this situation. Virtues are learned the way a skill is, by doing the right acts repeatedly until they become second nature.",
              "St. Thomas Aquinas joined Aristotle's thought to Christian belief in his account of natural law. Human beings can know through reason certain basic goods: to preserve life, to know the truth, to live in society, to raise a family. Acts that attack these goods are wrong, and acts that serve them are right. The law that governs a country is just only if it respects them.",
              "The Church's social teaching builds on this with the dignity of the human person and the common good. The common good is not what is best for the majority at the expense of the few. It is the whole set of social conditions, such as safe streets, schools, honest government and decent work, that allows each person to flourish.",
              "That idea sits close to the Salesian view of education: the aim is to form “honest citizens and good Christians,” and character is built in a community through daily practice rather than through rules alone.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "salesian-formation",
    code: "SAL-101",
    termId: "term-2026-1",
    status: "active",
    thumbnail: "/thumbnails/course-salesian-formation.svg",
    title: "Don Bosco and the Preventive System",
    tagline: "The life of Don Bosco and the way of educating young people that bears his name.",
    description:
      "A formation course taken by every student of the college. It covers the life of St. John Bosco, the Salesian family, and the Preventive System of reason, religion and loving-kindness, with reflection tasks that connect it to your own life on campus.",
    subject: "Salesian Formation",
    level: "Beginner",
    instructor: "Fr. Dennis Santiago, SDB",
    accent: "#7a1f2b",
    learners: 13,
    rating: 0,
    modules: [
      {
        id: "sal-m1",
        title: "The life and mission of Don Bosco",
        quizId: "sal-quiz-1",
        lessons: [
          {
            id: "sal-becchi-valdocco",
            thumbnail: "/thumbnails/sal-becchi-valdocco.svg",
            title: "From Becchi to Valdocco",
            type: "video",
            video: "sintel",
            minutes: 12,
            summary:
              "John Bosco was born into a poor farming family in Piedmont in 1815. His mother, his early dream and the street boys of Turin shaped the work of his life.",
            keyPoints: [
              "John Bosco was born on 16 August 1815 at Becchi, near Castelnuovo, in northern Italy.",
              "His father died when he was two, and his mother, Margaret, raised him and encouraged his studies.",
              "He was ordained a priest in 1841 and began gathering poor and abandoned boys in Turin, in what became the Oratory at Valdocco.",
            ],
            transcript: [
              "John Bosco was born on the sixteenth of August, 1815, in a farmhouse at Becchi, in the Piedmont region of Italy.",
              "His father died when he was two years old. His mother, Margaret, raised three boys on very little.",
              "As a boy he entertained neighbours with juggling and tricks, then held them to a promise: first pray, then play.",
              "At nine he had a dream that he would later say shaped his whole life. In it he was told to win young people with gentleness, not with blows.",
              "He studied hard, often while working, and was ordained a priest in Turin in 1841.",
              "Turin was a growing industrial city, and young migrants arrived looking for work with no family and no school.",
              "Don Bosco began meeting them on Sundays for Mass, games and lessons. That gathering became the Oratory.",
              "In 1846 it settled in the Valdocco district, where Mamma Margaret came to help him run the house.",
            ],
            checkpoints: [
              {
                id: "cp-sal-1a",
                position: 0.45,
                prompt: "What lesson did the dream at the age of nine give John Bosco?",
                options: [
                  "To build schools only for the rich",
                  "To win young people with gentleness rather than with blows",
                  "To leave Italy as a missionary at once",
                  "To avoid games and play",
                ],
                answer: 1,
                explanation: "The dream taught him to gain young people through kindness, which later became the heart of his educational method.",
              },
              {
                id: "cp-sal-1b",
                position: 0.9,
                prompt: "Which place became the home of Don Bosco's Oratory from 1846?",
                options: ["Rome", "Milan", "Valdocco, in Turin", "Genoa"],
                answer: 2,
                explanation: "After moving between several places, the Oratory settled at Valdocco in Turin.",
              },
            ],
          },
          {
            id: "sal-salesian-family",
            thumbnail: "/thumbnails/sal-salesian-family.svg",
            title: "The Salesian family and the Salesians in the Philippines",
            type: "reading",
            minutes: 8,
            summary:
              "Don Bosco's work grew into a worldwide family: the Salesians, the Daughters of Mary Help of Christians, the Salesian Cooperators and many lay groups.",
            keyPoints: [
              "The Society of St. Francis de Sales, the Salesians of Don Bosco, was founded in 1859.",
              "Don Bosco and St. Mary Mazzarello founded the Daughters of Mary Help of Christians in 1872.",
              "The Salesians arrived in the Philippines in 1951, and Don Bosco College in Canlubang began in 1963.",
            ],
            body: [
              "Don Bosco could not do his work alone, and he did not try to. He gathered young priests and lay helpers, many of them former boys of the Oratory. In 1859 they formed the Society of St. Francis de Sales, whose members are called Salesians and add the letters SDB, Salesians of Don Bosco, after their names. St. Francis de Sales, a bishop known for his gentleness, was chosen as patron.",
              "In 1872 Don Bosco and St. Mary Domenica Mazzarello founded the Daughters of Mary Help of Christians to do for girls what the Salesians did for boys. He also started the Salesian Cooperators, lay people who share the mission while living ordinary family and working lives. Today these and many other groups, including former students, are called the Salesian Family.",
              "Don Bosco died on 31 January 1888, and the feast of St. John Bosco is celebrated on that day. He was declared a saint in 1934, and in 1989 Pope John Paul II gave him the title “Father and Teacher of the Youth.”",
              "The Salesians reached the Philippines in 1951. Over the following decades they opened parishes, schools and training centers, among them the technical programs that grew into today's TVET departments. Don Bosco College in Canlubang, Calamba, was founded in 1963. Its motto, Ad Maiora Natus, means “Born for Greater Things,” and the campus keeps the Salesian pattern of a school that is also a home, a parish and a playground.",
              "As you read the next unit, think about which of these signs you can already see around you on campus.",
            ],
          },
        ],
      },
      {
        id: "sal-m2",
        title: "The Preventive System",
        quizId: "sal-quiz-2",
        lessons: [
          {
            id: "sal-reason-religion-kindness",
            thumbnail: "/thumbnails/sal-reason-religion-kindness.svg",
            title: "Reason, religion and loving-kindness",
            type: "video",
            video: "bunny",
            minutes: 12,
            summary:
              "The Preventive System is a way of education built on three pillars: reason, religion and loving-kindness, lived out through the constant presence of an educator among the young.",
            keyPoints: [
              "Reason (ragione): explain rules, give young people good reasons and treat them as able to understand.",
              "Religion (religione): faith, prayer and the sacraments form the conscience from within.",
              "Loving-kindness (amorevolezza): it is not enough to love the young; they must know they are loved.",
            ],
            transcript: [
              "Don Bosco described two ways of educating: the repressive and the preventive.",
              "The repressive system waits for a rule to be broken, then punishes. The preventive system tries to stop harm before it happens.",
              "It does this by being present: teachers share meals, games and breaks with the students and are always among them.",
              "Three pillars hold it up. The first is reason: rules are explained, and students are treated as people who can understand.",
              "The second is religion. Faith and prayer are not extras. They help young people build a conscience of their own.",
              "The third is loving-kindness, amorevolezza. Don Bosco said it is not enough to love the young. They must know that they are loved.",
              "That means a teacher who knows names, who listens, who is patient with a student who is struggling.",
              "Discipline in this system comes from trust, and the goal is a young person who chooses what is good without being watched.",
            ],
            checkpoints: [
              {
                id: "cp-sal-3a",
                position: 0.4,
                prompt: "What is the main difference between the preventive and the repressive system?",
                options: [
                  "The preventive system has no rules",
                  "The preventive system tries to prevent harm by presence and guidance rather than waiting to punish",
                  "The repressive system is gentler",
                  "The preventive system is only for religious schools",
                ],
                answer: 1,
                explanation:
                  "Both have rules, but the preventive system uses presence, reason and kindness so that wrongdoing is less likely to start.",
              },
              {
                id: "cp-sal-3b",
                position: 0.85,
                prompt: "“It is not enough to love the young; they must know they are loved.” Which pillar does this describe?",
                options: ["Reason", "Religion", "Loving-kindness", "Assistance"],
                answer: 2,
                explanation: "Loving-kindness (amorevolezza) is love that the young can see and feel in the educator's care.",
              },
            ],
          },
          {
            id: "sal-home-school-playground",
            thumbnail: "/thumbnails/sal-home-school-playground.svg",
            title: "A home, a school, a parish and a playground",
            type: "reading",
            minutes: 6,
            summary:
              "A Salesian house of education is meant to feel like a home that welcomes, a school that prepares for life, a parish that evangelizes and a playground where friends meet.",
            keyPoints: [
              "The four oratory criteria: home, school, parish and playground.",
              "Cheerfulness, study and prayer belong together; joy is a sign of a healthy community.",
              "The “good night,” a short word to the community at the end of the day, is a Salesian custom.",
            ],
            body: [
              "At Valdocco, Don Bosco did not build a school with a separate chapel and a separate playground. He built one place where the young person's whole life could be taken seriously. Salesians describe it with four words.",
              "The first is home. A young person should feel welcome and known, and not be treated as one more name on a list. The second is school: a place that prepares students for life and work, with good teaching and good habits of study. The third is parish: a community that opens the young to faith and to service. The fourth is playground: a place of friendship, where joy and games are part of education, not a break from it.",
              "Joy has a special place. One of Don Bosco's pupils, St. Dominic Savio, is remembered for saying that holiness for him meant being cheerful and doing his duties well. Salesian communities try to hold together cheerfulness, study and prayer, and they treat a joyless house as a warning.",
              "Many Salesian schools keep the custom of the “good night,” a few minutes at the end of the day when the director or a teacher gives the community a short, simple thought to carry into the evening. In the morning, there is a matching “good morning.” They are small, but they tell students that someone is paying attention to their day.",
              "In your reflection paper for this unit you will look for these four marks in the places where you study, eat, play and pray on campus.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "assessment-learning",
    code: "ED-301",
    termId: "term-2026-1",
    status: "active",
    thumbnail: "/thumbnails/course-assessment-learning.svg",
    title: "Assessment in Learning 1",
    tagline: "Learn to write tests that measure what you taught, and to read the results fairly.",
    description:
      "A professional education course for future teachers. You will learn the purposes of classroom assessment, how to write learning targets and a table of specification, how to construct good test items, and how to judge a test's validity, reliability and item quality.",
    subject: "Education",
    level: "Intermediate",
    instructor: "Dr. Evangeline Castillo",
    accent: "#1f4e5a",
    learners: 6,
    rating: 0,
    modules: [
      {
        id: "al-m1",
        title: "Foundations of assessment",
        quizId: "al-quiz-1",
        lessons: [
          {
            id: "al-assessment-purposes",
            thumbnail: "/thumbnails/al-assessment-purposes.svg",
            title: "Measurement, assessment and evaluation",
            type: "video",
            video: "sintel",
            minutes: 10,
            summary:
              "Teachers measure, assess and evaluate for different reasons. Knowing the difference, and when to assess for, as and of learning, changes how a test is designed and used.",
            keyPoints: [
              "Measurement gathers a score; assessment gathers evidence of learning; evaluation makes a judgement about it.",
              "Formative assessment guides learning while it is happening; summative assessment reports it at the end.",
              "Assessment for learning helps the teacher, assessment as learning helps the student reflect, assessment of learning reports achievement.",
            ],
            transcript: [
              "Three words are often used as if they were the same: measurement, assessment and evaluation.",
              "Measurement is collecting a number, for instance a score of 34 out of 40.",
              "Assessment is gathering many kinds of evidence of what a learner knows and can do.",
              "Evaluation is the judgement we make from that evidence, such as deciding that a student has met the standard.",
              "Assessment can happen while students are still learning. That is formative assessment, and its purpose is to help.",
              "Summative assessment comes at the end of a unit or term, and its purpose is to report what was achieved.",
              "Teachers also speak of assessment for learning, as learning, and of learning.",
              "A quick seatwork check, a student reflecting on her own errors, and a quarterly exam are three different uses.",
            ],
            checkpoints: [
              {
                id: "cp-al-1a",
                position: 0.4,
                prompt: "A student scores 34 out of 40 on a quiz. What is this score?",
                options: ["An evaluation", "A measurement", "A learning target", "A rubric"],
                answer: 1,
                explanation:
                  "A score is a measurement. Deciding what the score means for the student is evaluation.",
              },
              {
                id: "cp-al-1b",
                position: 0.88,
                prompt: "Which is the clearest example of formative assessment?",
                options: [
                  "The quarterly examination",
                  "The final grade on the report card",
                  "A three-item exit ticket used to decide what to reteach tomorrow",
                  "A national achievement test",
                ],
                answer: 2,
                explanation:
                  "Formative assessment is used while learning is still going on, to adjust teaching. Exit tickets fit that purpose.",
              },
            ],
          },
          {
            id: "al-learning-targets",
            thumbnail: "/thumbnails/al-learning-targets.svg",
            title: "Learning targets and the revised Bloom's taxonomy",
            type: "reading",
            minutes: 8,
            summary:
              "A test can only be as good as the target it measures. Clear learning targets, written with the right action verbs, tell you what kind of item to write.",
            keyPoints: [
              "A learning target names what the learner will know or be able to do, with an observable verb.",
              "The revised taxonomy has six levels: remember, understand, apply, analyze, evaluate, create.",
              "Targets also come in affective and psychomotor domains, and the type of target decides the method of assessment.",
            ],
            body: [
              "Before a teacher writes a single test item, she should be able to finish the sentence “By the end of this lesson, the learner can…” with a verb that can be seen or heard. “Understand photosynthesis” is hard to assess. “Explain, in her own words, how a plant makes food” is much easier.",
              "Bloom's taxonomy, as revised by Anderson and Krathwohl, arranges thinking into six levels. Remember: recall facts. Understand: explain or summarize. Apply: use a method in a new situation. Analyze: break a whole into parts and see how they relate. Evaluate: judge using criteria. Create: put elements together into something new.",
              "Each level has typical verbs. Define and list belong to remembering. Classify and paraphrase to understanding. Solve and demonstrate to applying. Compare and differentiate to analyzing. Justify and critique to evaluating. Design and compose to creating. When a teacher's target says “design,” a multiple-choice test about definitions does not match it.",
              "Learning targets are also found in two other domains. Affective targets deal with values and attitudes, such as showing respect. Psychomotor targets deal with physical skills, such as using a micrometer correctly. The method must match the type: skills are best assessed by watching performance, and attitudes by observation and reflection, not by a written quiz.",
              "The alignment of target, instruction and assessment is a theme you will meet again when you build a table of specification in the next unit.",
            ],
          },
        ],
      },
      {
        id: "al-m2",
        title: "Building and judging a test",
        quizId: "al-quiz-2",
        lessons: [
          {
            id: "al-test-construction",
            thumbnail: "/thumbnails/al-test-construction.svg",
            title: "The table of specification and writing good items",
            type: "video",
            video: "bunny",
            minutes: 13,
            summary:
              "A table of specification maps the test to the content taught and the thinking levels intended. Each item is then written to follow clear rules.",
            keyPoints: [
              "A table of specification (TOS) lists topics, the number of class hours, the cognitive levels and the number of items for each.",
              "Items per topic are proportional to the time spent teaching it.",
              "Write the stem as a clear question or a complete statement, avoid “all of the above,” and make every distractor plausible.",
            ],
            transcript: [
              "Imagine a teacher who spends two weeks on fractions and one day on decimals, and then writes a test that is half decimals.",
              "A table of specification prevents this. It is a blueprint for the test.",
              "The rows are the topics. The columns are the thinking levels you intend to measure, such as remembering, understanding and applying.",
              "To decide how many items each topic gets, we divide its teaching hours by the total hours and multiply by the number of items.",
              "For example, if a topic took 4 of 20 class hours, and the test has 50 items, that topic gets ten items.",
              "Then the items are written. A good multiple-choice stem states the problem fully, so the learner knows what is being asked before reading the options.",
              "Avoid “all of the above” and “none of the above,” and avoid grammatical clues that point to the right answer.",
              "Every distractor should be something a learner who has not mastered the content might really choose.",
            ],
            checkpoints: [
              {
                id: "cp-al-3a",
                position: 0.55,
                prompt: "A topic took 4 of 20 class hours. The test has 50 items. How many items should that topic get in the TOS?",
                options: ["4", "5", "10", "20"],
                answer: 2,
                explanation: "4 ÷ 20 = 0.2, and 0.2 × 50 = 10 items.",
              },
              {
                id: "cp-al-3b",
                position: 0.9,
                prompt: "Which is a flaw in a multiple-choice item?",
                options: [
                  "A stem that states the whole problem",
                  "Distractors that a student with a common misconception might choose",
                  "An option that is much longer than the others and is the correct one",
                  "Options of similar length and form",
                ],
                answer: 2,
                explanation:
                  "A noticeably longer correct option is a clue that lets students guess without knowing the content.",
              },
            ],
          },
          {
            id: "al-validity-reliability",
            thumbnail: "/thumbnails/al-validity-reliability.svg",
            title: "Validity and reliability",
            type: "reading",
            minutes: 7,
            summary:
              "A valid test measures what it claims to measure. A reliable test gives consistent results. A test can be reliable without being valid, but it cannot be valid if it is not reliable.",
            keyPoints: [
              "Content validity: the items represent the content and levels taught. A TOS is the main evidence.",
              "Reliability is the consistency of scores, estimated by test-retest, split-half or internal consistency methods.",
              "A scale that is always 5 kg off is reliable, but not valid.",
            ],
            body: [
              "Validity asks whether a test measures what it is supposed to measure. A Mathematics test full of long reading passages may really be measuring reading ability. The most important evidence for a classroom test is content validity: do the items fairly represent the topics taught and the levels of thinking intended? A table of specification is the teacher's tool for this.",
              "Other forms of validity are criterion-related, which compares scores with another measure such as a later exam, and construct validity, which asks whether the test behaves the way the theory about the underlying trait says it should.",
              "Reliability is about consistency. If the same students took the test again, or took an equivalent form, would they get similar scores? Test-retest reliability compares two administrations of the same test. Split-half reliability compares scores on two halves of one test, such as the odd and even items. Internal consistency measures, such as Cronbach's alpha, look at how well the items hang together.",
              "The two ideas are related, but not equal. Picture a bathroom scale that always reads 5 kilograms too high. It is reliable, since it gives the same reading every time, but it is not valid, since the readings are wrong. A test that is not reliable cannot be valid, because unstable scores cannot be measuring anything well.",
              "Teachers improve reliability by having enough items, writing clear directions, and scoring objectively. They improve validity by planning with a TOS and checking that the test matches the learning targets.",
            ],
          },
          {
            id: "al-item-analysis",
            thumbnail: "/thumbnails/al-item-analysis.svg",
            title: "Item analysis: difficulty and discrimination",
            type: "video",
            video: "sintel",
            minutes: 11,
            summary:
              "After a test is given, item analysis shows which items were too easy, too hard or unable to tell strong students from weak ones.",
            keyPoints: [
              "Difficulty index = number answering correctly ÷ number of examinees.",
              "Discrimination index = proportion correct in the upper group − proportion correct in the lower group.",
              "An item with a discrimination index near zero or negative should be revised or removed.",
            ],
            transcript: [
              "A test has been scored. Which items worked, and which did not?",
              "Item analysis looks at each item separately. Two numbers matter most.",
              "The difficulty index is the proportion of examinees who got the item right.",
              "If 18 of 30 students answered item seven correctly, the difficulty index is 0.60.",
              "A very low index means the item is hard, and a very high one means it is easy. Most good items fall between about 0.30 and 0.80.",
              "The discrimination index tells us whether the item separates students who did well overall from those who did poorly.",
              "We take the top group and the bottom group, say the top and bottom 27 percent, and subtract the proportions correct.",
              "If 8 of 10 in the upper group and 3 of 10 in the lower group got it right, the index is 0.80 minus 0.30, or 0.50.",
              "If more students in the lower group got an item right than in the upper group, something is wrong with the item.",
            ],
            checkpoints: [
              {
                id: "cp-al-5a",
                position: 0.45,
                prompt: "18 of 30 students answered an item correctly. What is its difficulty index?",
                options: ["0.18", "0.40", "0.60", "1.67"],
                answer: 2,
                explanation: "18 ÷ 30 = 0.60.",
              },
              {
                id: "cp-al-5b",
                position: 0.85,
                prompt: "On an item, 8 of 10 in the upper group and 3 of 10 in the lower group answered correctly. What is the discrimination index?",
                options: ["0.05", "0.30", "0.50", "0.80"],
                answer: 2,
                explanation: "0.80 − 0.30 = 0.50, which shows the item separates stronger from weaker students well.",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "automotive-engines",
    code: "AUTO-201",
    termId: "term-2026-1",
    status: "active",
    thumbnail: "/thumbnails/course-automotive-engines.svg",
    title: "Engine Fundamentals and Servicing",
    tagline: "Work safely in the shop and understand how a gasoline engine runs.",
    description:
      "A core course of the technical-vocational teacher education program, automotive major. You will learn shop safety and tool use, the four-stroke cycle, the main engine components, and how lubrication and cooling keep an engine alive. Lectures are on the course page, and the practical work happens in the automotive shop.",
    subject: "Automotive Technology",
    level: "Beginner",
    instructor: "Engr. Rodolfo Abad",
    accent: "#2f3b4c",
    learners: 6,
    rating: 0,
    modules: [
      {
        id: "auto-m1",
        title: "Shop safety and tools",
        quizId: "auto-quiz-1",
        lessons: [
          {
            id: "auto-shop-safety",
            thumbnail: "/thumbnails/auto-shop-safety.svg",
            title: "Shop safety, PPE and 5S",
            type: "video",
            video: "sintel",
            minutes: 10,
            summary:
              "A shop is safe when people wear the right protective equipment, keep the space organized with 5S, and never trust a jack alone to hold a vehicle.",
            keyPoints: [
              "Wear PPE for the job: safety glasses, gloves, safety shoes and coveralls.",
              "Support a raised vehicle on jack stands; never work under a vehicle held only by a jack.",
              "5S: sort, set in order, shine, standardize, sustain.",
            ],
            transcript: [
              "Most shop accidents are avoidable, and most start with a shortcut.",
              "Personal protective equipment is the last line of defense. Safety glasses for the eyes, gloves for the hands, safety shoes for the feet.",
              "Long hair is tied back, and rings and watches are taken off before working near moving parts.",
              "A jack is for lifting only. Once the vehicle is up, it is placed on jack stands before anyone goes underneath.",
              "Know where the fire extinguisher is, and know that fuel and oil fires need a different type from a paper fire.",
              "The Japanese 5S method keeps the shop orderly. Seiri is sorting out what is not needed.",
              "Seiton is a place for everything. Seiso is cleaning as you go. Seiketsu is making the standards visible.",
              "Shitsuke is discipline, making the first four a habit. These practices also follow the occupational safety and health standards of the Department of Labor and Employment.",
            ],
            checkpoints: [
              {
                id: "cp-auto-1a",
                position: 0.5,
                prompt: "What must support a vehicle before you work underneath it?",
                options: [
                  "A hydraulic jack",
                  "Jack stands",
                  "A wooden block under the bumper",
                  "The handbrake",
                ],
                answer: 1,
                explanation:
                  "A jack can fail or slip. Jack stands are built to hold the load while someone is under the vehicle.",
              },
              {
                id: "cp-auto-1b",
                position: 0.9,
                prompt: "In 5S, what does “Seiton” mean?",
                options: ["Sort", "Set in order", "Shine", "Sustain"],
                answer: 1,
                explanation: "Seiton is setting things in order: a place for each tool and each tool in its place.",
              },
            ],
          },
          {
            id: "auto-hand-tools",
            thumbnail: "/thumbnails/auto-hand-tools.svg",
            title: "Hand tools and measuring instruments",
            type: "reading",
            minutes: 7,
            summary:
              "Choosing the right wrench, using a torque wrench correctly and reading a vernier caliper or feeler gauge are basic skills for every engine job.",
            keyPoints: [
              "A socket or box-end wrench grips better than an open-end wrench and is used first on tight fasteners.",
              "A torque wrench tightens a fastener to a specified value, in newton-meters (N·m).",
              "A feeler gauge measures small gaps, such as valve clearance; a vernier caliper and a micrometer measure sizes.",
            ],
            body: [
              "A mechanic's hands are only as good as the tools in them. For fasteners, the rule is to use the tool that grips the most of the nut or bolt head. A six-point socket or a box-end wrench holds all around the head and is much less likely to round off the corners than an open-end wrench. Use an open-end wrench only when there is no room for a better tool.",
              "Many engine fasteners must be tightened to a precise value, which the service manual gives in newton-meters (N·m). That is the job of a torque wrench. Set the value, pull smoothly until the wrench clicks, and stop. Never use a torque wrench to loosen a bolt, and store a click-type wrench at its lowest setting so the spring does not weaken. When several bolts hold one part, such as a cylinder head, tighten them in the order and in the stages the manual shows, usually working from the center outward in a crisscross pattern.",
              "Measuring tools tell you whether a part is within specification. A feeler gauge is a set of thin blades of known thickness that is slid into a gap, such as the clearance between a valve stem and its rocker arm. A vernier caliper measures outside and inside sizes and depths to a hundredth of a millimeter. A micrometer is more precise still, and it is used for measuring parts like a piston or a crankshaft journal.",
              "Always clean a part before measuring it, and measure at room temperature, because metal expands as it warms. Record the readings on the job sheet, since your next step depends on them.",
            ],
          },
        ],
      },
      {
        id: "auto-m2",
        title: "How an engine works",
        quizId: "auto-quiz-2",
        lessons: [
          {
            id: "auto-four-stroke",
            thumbnail: "/thumbnails/auto-four-stroke.svg",
            title: "The four-stroke cycle",
            type: "video",
            video: "bunny",
            minutes: 12,
            summary:
              "A gasoline engine turns fuel into motion in four strokes: intake, compression, power and exhaust. Each cycle takes two full turns of the crankshaft.",
            keyPoints: [
              "The four strokes in order are intake, compression, power and exhaust.",
              "The crankshaft turns twice for each complete cycle, and the camshaft turns once.",
              "A spark ignites the mixture in a gasoline engine; a diesel engine ignites by the heat of compression.",
            ],
            transcript: [
              "Almost every car and motorcycle on the road runs on the same basic idea: the four-stroke cycle.",
              "On the intake stroke, the piston moves down and the intake valve opens, drawing in air and fuel.",
              "On the compression stroke, both valves close and the piston rises, squeezing the mixture into a small space.",
              "Near the top, the spark plug fires. The burning mixture expands and pushes the piston down hard. That is the power stroke.",
              "On the exhaust stroke, the exhaust valve opens, and the rising piston pushes the burnt gases out.",
              "Count the strokes: up, down, up, down. That is two full turns of the crankshaft for one cycle.",
              "The camshaft opens the valves, and it turns at half the speed of the crankshaft, so it turns once per cycle.",
              "A diesel engine works the same way, except it has no spark plug. Air is compressed so much that it becomes hot enough to ignite the fuel when it is injected.",
            ],
            checkpoints: [
              {
                id: "cp-auto-3a",
                position: 0.4,
                prompt: "Which stroke follows compression?",
                options: ["Intake", "Power", "Exhaust", "Idle"],
                answer: 1,
                explanation: "Compression is followed by the power stroke, when the spark ignites the mixture and pushes the piston down.",
              },
              {
                id: "cp-auto-3b",
                position: 0.85,
                prompt: "How many turns of the crankshaft make up one complete four-stroke cycle?",
                options: ["One half", "One", "Two", "Four"],
                answer: 2,
                explanation: "Four strokes are four piston movements, and each turn of the crankshaft gives two, so a cycle needs two turns.",
              },
            ],
          },
          {
            id: "auto-engine-parts",
            thumbnail: "/thumbnails/auto-engine-parts.svg",
            title: "Engine components and the valve train",
            type: "reading",
            minutes: 8,
            summary:
              "From the block and the head to the piston, crankshaft and camshaft, each part has a job, and the timing of the valves must match the motion of the pistons.",
            keyPoints: [
              "The cylinder block holds the cylinders; the cylinder head closes them from above and carries the valves.",
              "The piston, connecting rod and crankshaft change straight-line motion into rotation.",
              "The timing belt or chain keeps the camshaft in step with the crankshaft.",
            ],
            body: [
              "The cylinder block is the foundation of the engine. It contains the cylinders where the pistons move, and passages for coolant and oil. On top of it sits the cylinder head, which closes the cylinders and carries the valves, the spark plugs and the camshaft in most modern engines. Between the two is the head gasket, which seals combustion pressure, coolant and oil from one another. A failed head gasket is a classic cause of overheating and of white smoke from the exhaust.",
              "Inside each cylinder a piston slides up and down. Piston rings seal the gap against the cylinder wall and wipe oil back down. The piston is joined by a gudgeon pin, also called a wrist pin, to the connecting rod, and the rod is joined to the crankshaft. Together they convert the straight-line motion of the pistons into the rotation that the flywheel delivers to the transmission.",
              "The valve train opens and closes the valves at the right moments. The camshaft has lobes that push the valves open, directly or through lifters and rocker arms, and springs close them. A timing belt or chain connects the crankshaft to the camshaft so that they stay in step. If a timing belt breaks, the valves can stop at the wrong moment and be struck by the pistons, which in many engines causes serious damage. That is why manufacturers give a replacement interval for timing belts.",
              "In an inline four-cylinder engine, the cylinders do not fire in order from one to four. A common firing order is 1-3-4-2, which spreads the power strokes evenly and keeps the engine balanced. The firing order is stamped in the service manual, and it matters when you refit spark plug wires or ignition coils.",
            ],
          },
          {
            id: "auto-lubrication-cooling",
            thumbnail: "/thumbnails/auto-lubrication-cooling.svg",
            title: "Lubrication and cooling",
            type: "video",
            video: "sintel",
            minutes: 9,
            summary:
              "Oil reduces friction and carries heat away from moving parts, and the cooling system removes the rest of the heat of combustion. An engine that loses either will fail quickly.",
            keyPoints: [
              "The oil pump forces filtered oil to the bearings, the cylinder walls and the valve train.",
              "A viscosity grade such as 5W-30 describes how the oil flows when cold (5W) and at operating temperature (30).",
              "The thermostat holds coolant in the engine until it warms up, then opens to let it flow to the radiator.",
            ],
            transcript: [
              "Two systems keep an engine from destroying itself: lubrication and cooling.",
              "The oil pump draws oil from the pan, pushes it through the filter, and sends it to the bearings, the cylinder walls and the valve train.",
              "A thin film of oil keeps metal surfaces from touching, and it carries heat and tiny particles back to the filter.",
              "Oil is graded by viscosity. In 5W-30, the first number tells how well it flows when cold, and the second how thick it stays when hot.",
              "Use the grade the manufacturer specifies, and change the oil and filter at the recommended interval.",
              "Combustion makes a great deal of heat. The coolant, a mix of water and antifreeze, carries it from the engine to the radiator.",
              "The thermostat stays closed on a cold engine so it warms up quickly, then opens once the engine reaches operating temperature.",
              "Never open a radiator cap on a hot engine. The system is under pressure, and hot coolant can cause serious burns.",
            ],
            checkpoints: [
              {
                id: "cp-auto-5a",
                position: 0.55,
                prompt: "In the oil grade 5W-30, what does “5W” describe?",
                options: [
                  "How thick the oil is at operating temperature",
                  "How well the oil flows when the engine is cold",
                  "The oil's capacity in liters",
                  "The additive package",
                ],
                answer: 1,
                explanation: "The first number, with W for winter, rates cold flow. The second number rates thickness at operating temperature.",
              },
              {
                id: "cp-auto-5b",
                position: 0.9,
                prompt: "What does the thermostat do when the engine is cold?",
                options: [
                  "Stays open so coolant flows to the radiator",
                  "Stays closed so the engine warms up quickly",
                  "Switches on the fan",
                  "Releases pressure from the radiator",
                ],
                answer: 1,
                explanation: "A closed thermostat keeps coolant circulating inside the engine only, so it reaches operating temperature sooner.",
              },
            ],
          },
        ],
      },
    ],
  },
];
