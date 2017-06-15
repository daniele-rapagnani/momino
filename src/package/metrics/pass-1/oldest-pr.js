import _ from "lodash";
import moment from "moment";

export const extractor = (raw) => {
  const oldestPR = _.get(raw, "github.oldestPR.created_at");

  if (!oldestPR) {
    return false;
  }

  const oldestPRDate = moment(oldestPR);
  return moment().diff(oldestPRDate, "days", true);
};

export const rules = [
  { type: "pro", max: 10, message: "Oldest open pull request is very recent ({{#humanize}}{{value}}{{/humanize}})" },
  { type: "note", min: 11, max: 30, message: "Oldest open pull request is not recent ({{#humanize}}{{value}}{{/humanize}})" },
  { type: "cons", min: 30, message: "Oldest open pull request is very old ({{#humanize}}{{value}}{{/humanize}})" },
];

export const score = {
  data: [
    [30, 0], [20, 5], [15, 15], [10, 30], [5, 100],
  ],
};
