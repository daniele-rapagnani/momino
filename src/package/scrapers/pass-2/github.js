import _ from "lodash";
import winston from "winston";
import github from "github";

import store from "../../../store";
import { getRepoInfoFromUrl } from "../../../utils";

const githubClient = new github({
  debug: Boolean(process.env.DEBUG),
});

export default async (name, emitter, { auth, apiRateError }, raw) => {
  const versions = _.get(raw, "npm.versions", {});
  const lastVersion = Object.keys(versions).pop();

  if (!lastVersion) {
    throw new Error("This package has no version information");
  }

  const repositoryUrl = _.get(
    versions[lastVersion],
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

  promises.push(getPartial(
    "lastClosedIssues",
    githubClient.issues.getForRepo.bind(this, {
      ...repository,
      sort: "created",
      direction: "desc",
      state: "closed",
      per_page: 100,
    }),
    "data"
  ));

  try {
    return (await Promise.all(promises)).reduce((acc, b) => ({...acc, ...b}));
  } catch (e) {
    let decoded = false;

    try {
      decoded = JSON.parse(e.message);
    } catch (e) {
      decoded = { message: e.message, documentation_url: "" };
    }

    if (decoded.documentation_url.match("#rate-limiting") && apiRateError) {
      throw apiRateError("GitHub", e);
    }

    let error = decoded.message;

    if (decoded.documentation_url) {
      error = `${error} (${decoded.documentation_url})`;
    }

    throw new Error(error);
  }
};
