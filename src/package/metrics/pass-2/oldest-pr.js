import _ from "lodash";
import moment from "moment";

export const extractor = (raw, data) => {
  const oldestPR = _.get(raw, "github.oldestPR.updated_at");

  if (!oldestPR) {
    return false;
  }

  if (data.age < 30) {
    //If the project is new this metric does not make much sense
    return false;
  }

  const oldestPRDate = moment(oldestPR);

  return {
    extra: { url: _.get(raw, "github.oldestPR.html_url") },
    value: moment().diff(oldestPRDate, "days", true),
  };
};

export const rules = {
  postfix: "(updated {{#humanize}}{{value}}{{/humanize}} ago) - {{{extra.url}}}",
  rules: [
    { type: "pro", max: 10, message: "Oldest open pull request is still active" },
    { type: "note", min: 11, max: 20, message: "Oldest open pull request has been inactive for some time" },
    { type: "cons", min: 21, message: "Oldest open pull request is dead" },
  ],
};

export const score = {
  data: [
    [30, 0], [20, 5], [15, 15], [10, 30], [5, 100],
  ],
};
