import _ from "lodash";

export const extractor = (raw, data) => {
  const monthBefore = _.get(raw, "npm.stats.downloads.monthBefore", false);

  if (monthBefore === false) {
    return 0;
  }

  const monthBeforeRate = monthBefore / 30;

  return (data.downloadsRate / monthBeforeRate) - 1.0;
};

export const rules = [
  { type: "pro", min: 0.100, message: "Adoption is growing fast ({{#growth}}{{value}}{{/growth}} installs this month vs month before)" },
  { type: "note", min: 0, max: 0.099, message: "Adoption is slow ({{#growth}}{{value}}{{/growth}} installs this month vs month before)" },
  { type: "cons", max: 0, message: "Adoption is dropping ({{#growth}}{{value}}{{/growth}} installs this month vs month before)" },
];

export const score = {
  data: [
    [0, 0], [0.01, 2], [0.1, 10], [0.5, 25],
    [1.0, 40], [2.0, 300], [5.0, 1000], [10.0, 1500],
  ],
};
