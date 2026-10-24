// ne - Not enough
// ak - Already know
// lang - language
// exp - explanation
// eg - examples
// bg - background
// pres - presentation
// co - content
// chlg - challenging

const feedbackTypes = {
  difficult: {
    "ne-exp": "Not enough explanation / examples",
    "ne-bg": "I'm missing basics",
    "co-difficult": "Content is too difficult",
    "lang-barrier": "Complex terms (jargon)",
    "unclear-pres": "Unclear or cluttered presentation",
    "too-fast": "Too fast"
  },
  easy: {
    "good-exp": "Good explanation",
    "ak-co": "Already know this concept",
    "easy-co": "Easy concept",
    "teacher-easy": "Neat presentation"
  },
  boring: {
    "too-difficult": "Too difficult for me",
    "too-easy": "Too easy for me",
    "co-boring": "Boring topic",
    "co-not-meaningful": "Not meaningful content",
    "pres-style": "Presentation style",
    "too-slow-repetitive": "Too slow or repetitive teaching"
  },
  engaging: {
    "interesting-egs": "Interesting examples (applications)",
    "good-exp": "Good explanation",
    "ak-co": "Already know this concept",
    "pres-style": "Presentation style",
    "interesting-topic": "Interesting topic",
    "intellectually-chlg": "Intellectually challenging"
  }
};

const difficultTypes = Object.keys(feedbackTypes.difficult);
const easyTypes = Object.keys(feedbackTypes.easy);
const boringTypes = Object.keys(feedbackTypes.boring);
const engagingTypes = Object.keys(feedbackTypes.engaging);

const feedbackOptions = {
  difficult: difficultTypes.map(t => ({ id: t, name: feedbackTypes.difficult[t] })),
  easy: easyTypes.map(t => ({ id: t, name: feedbackTypes.easy[t] })),
  boring: boringTypes.map(t => ({ id: t, name: feedbackTypes.boring[t] })),
  engaging: engagingTypes.map(t => ({ id: t, name: feedbackTypes.engaging[t] }))
};

const researchUsers = [
  {
    email: "pnkjchavan@gmail.com",
    password: "Pankaj@1234",
    name: "Pankaj Chavan"
  },
  {
    email: "localhoax0@gmail.com",
    password: "localhoax@1234",
    name: "Bhupender Singh"
  }
];

module.exports = {
  feedbackTypes,
  difficultTypes,
  easyTypes,
  boringTypes,
  engagingTypes,
  feedbackOptions,
  researchUsers
};
