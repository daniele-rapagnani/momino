import _ from "lodash";

export const extractor = (raw) => _.get(raw, "github.commitsStats.all", []).length * 7;
