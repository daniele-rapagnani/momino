import _ from "lodash";

export const extractor = (raw) => {
  return _.get(raw, "npm.stats.downloads.all", 0);
};

export const rules = [
  { type: "pro", min: 1000000, message: "Is widely adopted ({{#number}}{{value}}{{/number}} total installs)" },
  { type: "note", min: 200000, max: 999999, message: "Is moderately adopted ({{#number}}{{value}}{{/number}} total installs)" },
  { type: "cons", max: 199999, message: "Is not adopted by many projects ({{#number}}{{value}}{{/number}} total installs)" },
];

export const score = (value, data) => (value / 100) * (1 / (data.age.value / 10));
