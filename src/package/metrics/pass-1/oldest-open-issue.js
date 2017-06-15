import _ from "lodash";
import moment from "moment";

export const extractor = (raw) => {
  const oldestIssueDate = moment(_.get(raw, "github.oldestOpenIssue.created_at"));
  return moment().diff(oldestIssueDate, "days", true);
};

export const rules = [
  { type: "pro", max: 15, message: "Oldest open issue is quite recent ({{#humanize}}{{value}}{{/humanize}} ago)" },
  { type: "note", min: 16, max: 30, message: "Oldest open issue is growing old ({{#humanize}}{{value}}{{/humanize}})" },
  { type: "cons", min: 31, message: "Oldest open issue is very old ({{#humanize}}{{value}}{{/humanize}})" },
];

export const score = {
  data: [[0, 30], [30, 0], [60, 0]],
};
