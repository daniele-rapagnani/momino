import _ from "lodash";

export const extractor = (raw) => {
  return _.get(raw, "github.repo.homepage") ? 1 : 0;
};

export const rules = [
  { type: "pro", min: 1, max: 1, message: "Has a dedicated website" },
];

export const score = {
  data: [
    [0, 0], [1, 50],
  ],
};
