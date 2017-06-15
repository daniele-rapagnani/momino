import _ from "lodash";

export const extractor = (raw) => {
  return _.keys(_.get(raw, "npm.versions", {})).length;
};

export const rules = [
  { type: "pro", min: 35, message: "There are many releases ({{value}} releases)" },
  { type: "note", min: 15, max: 34, message: "There are not so many releases ({{value}} releases)" },
  { type: "cons", max: 14, message: "Few releases have been published ({{value}} releases)" },
];

export const score = {
  data: [
    [0, 0], [5, 1], [10, 5], [20, 15], [35, 25], [50, 50], [100, 150],
  ],
};
