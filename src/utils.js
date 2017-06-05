import _ from "lodash";
import winston from "winston";
import request from "request-promise-native";
import github from "github";
import moment from "moment";
import pluralize from "pluralize";
import store from "./store";

const githubClient = new github({
  debug: Boolean(process.env.DEBUG),
});

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

export const npmSearch = async (search) => {
  const result = await request({
    url: `http://registry.npmjs.org/${search}`,
  }).catch((err) => {
    if (err.statusCode == 404) {
      return Promise.reject("The package could not be found");
    }
  });

  return JSON.parse(result);
};

export const npmStats = async (info) => {
  const todayDate = moment().format("YYYY-MM-DD");
  const lastMonth = moment().subtract(1, "month").format("YYYY-MM-DD");
  const monthBefore = moment().subtract(2, "month").format("YYYY-MM-DD");
  const creationDate = moment(info.time.created).format("YYYY-MM-DD");
  const existsMonths = moment().diff(moment(info.time.created), "months", true);

  const lastMonthDownloads = await request({
    url: `https://api.npmjs.org/downloads/point/${lastMonth}:${todayDate}/${info.name}`,
  });

  let monthBeforeDownloads = false;

  if (existsMonths >= 2) {
    monthBeforeDownloads = await request({
      url: `https://api.npmjs.org/downloads/point/${monthBefore}:${lastMonth}/${info.name}`,
    });
  }

  const allDownloads = await request({
    url: `https://api.npmjs.org/downloads/point/${creationDate}:${todayDate}/${info.name}`,
  });

  return {
    downloads: {
      lastMonth: _.get(JSON.parse(lastMonthDownloads), "downloads", 0),
      monthBefore: monthBeforeDownloads ?
        _.get(JSON.parse(monthBeforeDownloads), "downloads", 0) : false,
      all: _.get(JSON.parse(allDownloads), "downloads", 0),
    },
  };
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

export const getNPMPackageData = async (name, emitter, auth = null) => {
  emitter.emit("npm.progress", { text: "Querying NPM registry for information" });

  const info = await npmSearch(name);
  const stats = await npmStats(info);

  winston.debug("NPM Stats", stats);

  const lastVersion = Object.keys(_.get(info, "versions", [])).pop();

  if (!lastVersion) {
    throw new Error("This package has no version information");
  }

  const repositoryUrl = _.get(
    info.versions[lastVersion],
    "repository.url"
  );

  if (!repositoryUrl) {
    throw new Error("This package has no repository to inspect");
  }

  winston.debug("Found repository:", repositoryUrl);

  const repository = getRepoInfoFromUrl(repositoryUrl);

  winston.debug("Repository info:", repository);

  if (!repository) {
    throw new Error(`Unsupported repository URL: ${repositoryUrl}`);
  }

  if (auth) {
    emitter.emit("github.progress", { text: "Authenticating on GitHub via user and password" });

    githubClient.authenticate({
      type: "basic",
      ...auth,
    });
  } else if (store.github.has("githubToken")) {
    emitter.emit("github.progress", { text: "Authenticating on GitHub via token" });

    githubClient.authenticate({
      type: "token",
      token: store.github.get("githubToken"),
    });
  }

  emitter.emit("github.progress", { text: "Fetching repository information" });

  const promises = [];

  const getPartial = async (name, func, part) => {
    return {
      [name]: (part ? _.get((await func()), part) : (await func())),
    };
  };

  promises.push(getPartial("repo", githubClient.repos.get.bind(this, repository), "data"));

  promises.push(getPartial("oldestOpenIssue", githubClient.issues.getForRepo.bind(this, {
    ...repository,
    sort: "created",
    direction: "asc",
    per_page: 1,
  }), "data[0]"));

  promises.push(getPartial("oldestPR", githubClient.pullRequests.getAll.bind(this, {
    ...repository,
    sort: "created",
    direction: "asc",
    per_page: 1,
  }), "data[0]"));

  promises.push(getPartial(
    "commitsStats",
    githubClient.repos.getStatsParticipation.bind(this, repository),
    "data"
  ));

  promises.push(getPartial(
    "lastCommit",
    githubClient.repos.getCommits.bind(this, {
      ...repository,
      per_page: 1,
    }),
    "data[0]"
  ));

  const github = (await Promise.all(promises)).reduce((acc, b) => ({...acc, ...b}));

  return {
    npm: {
      ...info,
      stats,
    },
    github,
  };
};
