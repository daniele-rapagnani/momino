import _ from "lodash";

export const extractor = (raw) => {
  return _.get(raw, "npm.stats.downloads.all", 0);
};

export const rules = [
  { type: "pro", min: 1000000, message: "Is widely adopted ({{#number}}{{value}}{{/number}} total installs)" },
  { type: "note", min: 200000, max: 999999, message: "Is moderately adopted ({{#number}}{{value}}{{/number}} total installs)" },
  { type: "cons", max: 199999, message: "Is not adopted by many projects ({{#number}}{{value}}{{/number}} total installs)" },
];

export const score = {
  data: [
    [0, 0], [10000, 5], [100000, 10], [500000, 50],
    [1000000, 150], [6000000, 200], [20000000, 500],
    [2000000000, 6000],
  ],
};
