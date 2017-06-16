import _ from "lodash";
import pluralize from "pluralize";
import path from "path";
import fs from "fs";

export const formatFreq = (perDay) => {
  const freq = 1.0 / perDay;
  const table = [
    [365, "year"],
    [30, "month"],
    [7, "week"],
    [1, "day"],
    [0.041, "hour"],
    [0.00069, "minute"],
    [0.000011, "second"],
  ];

  for (let i = 0; i < table.length; i++) {
    if (freq >= table[i][0]) {
      const value = Math.round(freq * (1.0 / table[i][0]));

      if (value <= 1) {
        return `one every ${table[i][1]}`;
      }

      return `one every ${value} ${pluralize(table[i][1], value)}`;
    }
  }

  const perSecond = (perDay / (24 * 60 * 60));

  return `${Math.round(perSecond)} every second`;
};

export const getRepoInfoFromUrl = (url) => {
  const regex = /.+\:\/\/[^\/]+?\/([^\/]+?)\/([^\/]+?)(?:\.git|\/)/g;
  const match = regex.exec(url);

  if (!match || !match[1] || !match[2]) {
    return false;
  }

  return {
    owner: match[1],
    repo: match[2],
  };
};

export const getProjectDependencies = () => {
  const pkgJsonPath = path.join(process.cwd(), "package.json");

  if (!fs.existsSync(pkgJsonPath)) {
    return false;
  }

  const pkgJsonData = require(pkgJsonPath);

  return _.keys(_.merge(
    {},
    _.get(pkgJsonData, "dependencies", {}),
    _.get(pkgJsonData, "devDependencies", {})
  ));
};

export const getProjectConfig = () => {
  const configPath = path.join(process.cwd(), ".monkrc.json");

  if (!fs.existsSync(configPath)) {
    return {};
  }

  return require(configPath);
};
