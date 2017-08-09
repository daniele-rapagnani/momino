import _ from "lodash";

export const extractor = (raw) => {
  return _.get(raw, "npm.stats.downloads.all", 0);
};

export const rules = {
  postfix: "({{#number}}{{value}}{{/number}} total installs)",
  rules: [
    { type: "pro", min: 1000000, message: "Is widely adopted" },
    { type: "note", min: 200000, max: 999999, message: "Is moderately adopted" },
    { type: "cons", max: 199999, message: "Is not adopted by many projects" },
  ],
};

export const score = (value, data) => (value / 100) * (1 / (data.age.value / 10));
