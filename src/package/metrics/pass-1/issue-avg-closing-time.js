import _ from "lodash";
import moment from "moment";

export const extractor = (raw) => {
  const lastClosedIssues = _.get(raw, "github.lastClosedIssues");
  const closedIssuesTimes = lastClosedIssues.map((item) => {
    const creation = moment(item.created_at);
    const closing = moment(item.closed_at);
    return closing.diff(creation, "days", true);
  });

  return _.mean(closedIssuesTimes);
};

export const rules = [
  { type: "pro", max: 5, message: "Issues are closed fast (average of {{#humanize}}{{value}}{{/humanize}} on {{_data.issueClosingCount.value}} issues)" },
  { type: "note", min: 6, max: 10, message: "Closing issues tooks some time (average of {{#humanize}}{{value}}{{/humanize}} on {{_data.issueClosingCount.value}} issues)" },
  { type: "cons", min: 11, message: "Issues took a lot of time to be closed (average of {{#humanize}}{{value}}{{/humanize}} on {{_data.issueClosingCount.value}} issues)" },
];

export const score = {
  data: [
    [30, 0], [15, 5], [7, 15], [3, 30], [2, 100],
    [1, 300], [0.500, 500],
  ],
};
