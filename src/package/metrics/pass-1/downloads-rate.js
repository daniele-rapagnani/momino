import _ from "lodash";

export const extractor = (raw) => {
  const downloads = _.get(raw, "npm.stats.downloads.lastMonth", 0);
  return downloads / 30;
};

export const rules = {
  postfix: "({{#rate}}{{value}}{{/rate}})",
  rules: [
    { type: "pro", min: 51, message: "Was installed a lot this month" },
    { type: "note", min: 21, max: 50, message: "Last month not a lot of people installed it" },
    { type: "cons", max: 20, message: "Was installed rarely last month" },
  ],
};

export const score = {
  data: [
    [0, 0], [50, 5], [500, 250], [1000, 300],
    [10000, 600], [100000, 1000], [1000000, 2000],
  ],
};
