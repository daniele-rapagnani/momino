import _ from "lodash";
import moment from "moment";

export const extractor = (raw) => {
  const now = moment();
  const createdAt = moment(_.get(raw, "github.repo.created_at"));

  return now.diff(createdAt, "days", true);
};

export const rules = [
  { type: "cons", max: 121, message: "Is very young ({{#humanize}}{{value}}{{/humanize}})" },
  { type: "note", min: 121, max: 181, message: "Is not young but also not really mature ({{#humanize}}{{value}}{{/humanize}})" },
  { type: "pro", min: 182, message: "Has been around for a while ({{#humanize}}{{value}}{{/humanize}} ago)" },
];

export const score = {
  data: [[0, 0], [90, 5], [365, 20], [730, 27], [1460, 40]],
};
