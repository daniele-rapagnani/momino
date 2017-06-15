import _ from "lodash";
import moment from "moment";

export const extractor = (raw) => {
  const lastClosedIssues = _.get(raw, "github.lastClosedIssues");
  const oldest = _.last(lastClosedIssues);

  return moment().diff(moment(oldest.created_at), "days", true);
};
