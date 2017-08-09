import _ from "lodash";
import moment from "moment";

export const extractor = (raw, data) => {
  const lastUpdateDate = moment(_.get(raw, "github.oldestOpenIssue.updated_at"));
  const lastUpdateDaysAgo = moment().diff(lastUpdateDate, "days", true);

  if (data.age < 30) {
    //If the project is new this metric does not make much sense
    return false;
  }

  return {
    value: lastUpdateDaysAgo,
    extra: {
      url: _.get(raw, "github.oldestOpenIssue.html_url"),
    },
  };
};

export const rules = {
  postfix: "(updated {{#humanize}}{{value}}{{/humanize}} ago) - {{{extra.url}}}",
  rules: [
    { type: "pro", max: 10, message: "Oldest open issue is still active" },
    { type: "note", min: 11, max: 20, message: "Oldest open issue has been dead for a while" },
    { type: "cons", min: 21, message: "Oldest open issue is dead" },
  ],
};

export const score = {
  data: [[0, 30], [30, 0], [60, 0]],
};
