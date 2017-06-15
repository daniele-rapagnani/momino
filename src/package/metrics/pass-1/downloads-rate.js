import _ from "lodash";

export const extractor = (raw) => {
  const downloads = _.get(raw, "npm.stats.downloads.lastMonth", 0);
  return downloads / 30;
};

export const rules = [
  { type: "pro", min: 51, message: "Was installed a lot this month ({{#rate}}{{value}}{{/rate}})" },
  { type: "note", min: 21, max: 50, message: "Last month not a lot of people installed it ({{#rate}}{{value}}{{/rate}})" },
  { type: "cons", max: 20, message: "Was installed rarely last month ({{#rate}}{{value}}{{/rate}})" },
];

export const score = {
  data: [
    [0, 0], [50, 5], [500, 250], [1000, 700],
    [10000, 1500], [100000, 3000], [1000000, 6000],
  ],
};
