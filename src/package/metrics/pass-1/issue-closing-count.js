import _ from "lodash";

export const extractor = (raw) => {
  return _.get(raw, "github.lastClosedIssues", []).length;
};
