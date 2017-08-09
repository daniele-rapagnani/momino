
export const extractor = (raw, data) => {
  return data["issue-closing-count"] / data.issueClosingInterval;
};

export const rules = {
  postfix: "({{#rate}}{{value}}{{/rate}} in the last {{#humanize}}{{_data.issueClosingInterval.value}}{{/humanize}})",
  rules: [
    { type: "pro", min: 0.300, message: "A good number of issues were closed" },
    { type: "note", min: 0.100, max: 0.299, message: "A moderate number of issues were closed" },
    { type: "cons", max: 0.099, message: "Not a lot of issues were closed" },
  ],
};

export const score = {
  data: [
    [0, 0], [0.150, 5], [0.300, 10], [1, 100],
    [5, 300], [10, 500], [100, 2000],
  ],
};
