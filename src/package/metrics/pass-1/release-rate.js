import _ from "lodash";
import moment from "moment";

export const extractor = (raw) => {
  const times =
    _.values(_.omit(_.get(raw, "npm.time", {}), ["created", "modified", "unpublished"]))
    .map((item) => moment(item))
  ;

  if (times.length == 0) {
    return false;
  }

  const timesSub = [].concat(times);
  timesSub.shift();
  timesSub.push(moment());

  const intervals =
    _.zip(times, timesSub)
    .map((item) => item[1].diff(item[0], "days", true))
  ;

  return 1 / _.mean(intervals);
};

export const rules = {
  postfix: "({{#rate}}{{value}}{{/rate}})",
  rules: [
    { type: "pro", min: (1 / 15), message: "Releases are frequent" },
    { type: "note", max: (1 / 15), min: (1 / 30), message: "Releases are not so frequent" },
    { type: "cons", max: (1 / 30.001), message: "Releases are sporadic" },
  ],
};

export const score = {
  data: [
    [1/90, 0], [1/60, 2], [1/40, 5], [1/30, 10], [1/15, 30], [1/5, 100],
  ],
};
