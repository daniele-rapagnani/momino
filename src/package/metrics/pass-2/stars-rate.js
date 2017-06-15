import _ from "lodash";

export const extractor = (raw, data) => {
  const stars = _.get(raw, "github.repo.stargazers_count", 0);
  return stars / data["age"];
};

export const rules = [
  { type: "cons", max: 0.070, message: "Does not get many stars ({{#rate}}{{value}}{{/rate}})"},
  { type: "note", min: 0.071, max: 0.50, message: "Gets a good amount of stars but not extraordinary ({{#rate}}{{value}}{{/rate}})"},
  { type: "pro", min: 0.51, message: "Gets a lot of stars ({{#rate}}{{value}}{{/rate}})"},
];

export const score = {
  data: [[0, 0], [1/7, 5], [1/2, 15], [1, 25], [10, 50], [24, 150], [50, 300], [200, 700]],
};
