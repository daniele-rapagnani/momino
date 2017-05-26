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
  });

  return JSON.parse(result);
};

export const npmStats = async (info) => {
  const lastMonthDownloads = await request({
    url: `https://api.npmjs.org/downloads/point/last-month/${info.name}`,
  });

  const creationDate = moment(info.time.created).format("YYYY-MM-DD");
  const todayDate = moment().format("YYYY-MM-DD");

  const allDownloads = await request({
    url: `https://api.npmjs.org/downloads/point/${creationDate}:${todayDate}/${info.name}`,
  });

  return {
    downloads: {
      lastMonth: _.get(JSON.parse(lastMonthDownloads), "downloads", 0),
      all: _.get(JSON.parse(allDownloads), "downloads", 0),
    },
  };
};

export const getRepoInfoFromUrl = (url) => {
  const regex = /.+\:\/\/[^\/]+?\/([^\/]+?)\/([^\/]+?).git/g;
  const match = regex.exec(url);

  if (!match[1] || !match[2]) {
    return false;
  }

  return {
    owner: match[1],
    repo: match[2],
  };
};

const getAllPages = async (func, ...args) => {
  const results = [];
  let data = null;

  do {
    if (data === null) {
      winston.debug("Fetching first page");
      data = await func.apply(this, args);
      results.push(data);
    } else {
      if (githubClient.hasNextPage(data)) {
        winston.debug("Fetching next page");
        data = await githubClient.getNextPage(data);
        results.push(data);
      } else {
        data = false;
      }
    }
  } while(data !== false);

  return _.flatten(results.map((item) => item.data));
};

export const getNPMPackageData = async (name, spinner, auth = null) => {
  spinner.text = "Querying NPM registry for informations";
  const info = await npmSearch(name);
  const stats = await npmStats(info);

  winston.debug("NPM Stats", stats);

  const lastVersion = Object.keys(info.versions).pop();

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
    spinner.text = "Authenticating on GitHub via user and password";
    githubClient.authenticate({
      type: "basic",
      ...auth,
    });
  } else if (store.github.has("githubToken")) {
    spinner.text = "Authenticating on GitHub via token";

    githubClient.authenticate({
      type: "token",
      token: store.github.get("githubToken"),
    });
  }

  spinner.text = "Fetching repository information";
  const repo = (await githubClient.repos.get(repository)).data;

  const oldestOpenIssue = (await githubClient.issues.getForRepo({
    ...repository,
    sort: "created",
    direction: "asc",
    per_page: 1,
  })).data[0];

  const releases = await getAllPages(githubClient.repos.getReleases, repository);
  const oldestPR = (await githubClient.pullRequests.getAll({
    ...repository,
    sort: "created",
    direction: "asc",
    per_page: 1,
  })).data[0];

  const oneMonthAgo = moment().subtract(30, "days");

  const commits = await getAllPages(githubClient.repos.getCommits, {
    ...repository,
    since: oneMonthAgo.format(),
  });

  const lastCommit = (await githubClient.repos.getCommits({
    ...repository,
    per_page: 1,
  })).data[0];

  return {
    npm: {
      ...info,
      stats,
    },
    github: {
      repo,
      releases,
      oldestPR,
      oldestOpenIssue,
      commits,
      commitsPeriod: 30,
      lastCommit,
    },
  };
};
