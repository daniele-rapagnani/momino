import _ from "lodash";
import moment from "moment";

export const extractor = (raw) => {
  const commitDate = moment(_.get(raw, "github.lastCommit.commit.author.date"));
  return moment().diff(commitDate, "days", true);
};

export const rules = {
  postfix: "({{#humanize}}{{value}}{{/humanize}} ago)",
  rules: [
    { type: "pro", max: 3, message: "Last commit was done recently" },
    { type: "note", min: 4, max: 15, message: "Last commit is not so recent" },
    { type: "cons", min: 15, message: "Last commit is not recent" },
  ],
};

export const score = {
  data: [[0, 20], [7, 10], [30, 0], [60, 0]],
};
