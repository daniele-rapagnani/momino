import _ from "lodash";

export const extractor = (raw, data) => {
  const commits = _.get(raw, "github.commitsStats.all", []);
  return commits.length > 0 ? commits.reduce((a, b) => a + b) / data.commitsPeriod : 0;
};

export const rules = [
  { type: "cons", max: 0.140, min: 0.001, message: "Commits are sporadic ({{#rate}}{{value}}{{/rate}})" },
  { type: "note", min: 0.141, max: 0.250, message: "Commits are not frequent ({{#rate}}{{value}}{{/rate}})" },
  { type: "pro", min: 0.251, message: "Commits are frequent ({{#rate}}{{value}}{{/rate}})" },
  { type: "cons", max: 0, min: 0, message: "There were no commits in the last {{_data.commitsPeriod}} days" },
];

export const score = {
  data: [[1/8, 0], [1/7, 15], [1, 50], [10, 100]],
};
