import _ from "lodash";
import winston from "winston";
import mustache from "mustache";
import moment from "moment";
import humanizeDuration from "humanize-duration";
import regression from "regression";

import { getNPMPackageData, formatFreq } from "./utils";

export default class Package {
  constructor(name, emitter, config = {}) {
    this.name = name;
    this.emitter = emitter;

    this.config = {
      thresholds: {
        age: {
          rules: [
            { type: "cons", max: 121, message: "Is very young ({{#humanize}}{{value}}{{/humanize}})" },
            { type: "note", min: 121, max: 181, message: "Is not young but also not really mature ({{#humanize}}{{value}}{{/humanize}})" },
            { type: "pro", min: 182, message: "Has been around for a while ({{#humanize}}{{value}}{{/humanize}} ago)" },
          ],
        },
        commitsRate: {
          rules: [
            { type: "cons", max: 0.140, min: 0.001, message: "Commits are sporadic ({{#rate}}{{value}}{{/rate}})" },
            { type: "note", min: 0.141, max: 0.250, message: "Commits are not frequent ({{#rate}}{{value}}{{/rate}})" },
            { type: "pro", min: 0.251, message: "Commits are frequent ({{#rate}}{{value}}{{/rate}})" },
            { type: "cons", max: 0.001, min: 0, message: "There were no commits in the last {{_data.commitsPeriod}} days" },
          ],
        },
        lastCommitDaysAgo: {
          rules: [
            { type: "pro", max: 3, message: "Last commit was done recently ({{#humanize}}{{value}}{{/humanize}} ago)" },
            { type: "note", min: 4, max: 15, message: "Last commit is not so recent ({{#humanize}}{{value}}{{/humanize}})" },
            { type: "cons", min: 15, message: "Last commit is not recent ({{#humanize}}{{value}}{{/humanize}})" },
          ],
        },
        starsRate: {
          rules: [
            { type: "cons", max: 0.070, message: "Does not get many stars ({{#rate}}{{value}}{{/rate}})"},
            { type: "note", min: 0.071, max: 0.50, message: "Gets a good amount of stars but not extraordinary ({{#rate}}{{value}}{{/rate}})"},
            { type: "pro", min: 0.51, message: "Gets a lot of stars ({{#rate}}{{value}}{{/rate}})"},
          ],
        },
        closedIssueRate: {
          rules: [
            { type: "cons", max: 0.140, message: "Issues are closed slowly ({{#rate}}{{value}}{{/rate})"},
            { type: "note", min: 0.141, max: 0.250, message: "Issues are solved in average time ({{#rate}}{{value}}{{/rate})"},
            { type: "pro", min: 0.251, message: "Issues are solved fast ({{#rate}}{{value}}{{/rate})"},
          ],
        },
        oldestOpenIssueDaysAgo: {
          rules: [
            { type: "pro", max: 15, message: "Oldest open issue is quite recent ({{#humanize}}{{value}}{{/humanize}} ago)" },
            { type: "note", min: 16, max: 30, message: "Oldest open issue is growing old ({{#humanize}}{{value}}{{/humanize}})" },
            { type: "cons", min: 31, message: "Oldest open issue is very old ({{#humanize}}{{value}}{{/humanize}})" },
          ],
        },
        downloadsRate: {
          rules: [
            { type: "pro", min: 51, message: "Was installed a lot this month ({{#rate}}{{value}}{{/rate}})" },
            { type: "note", min: 21, max: 50, message: "Last month not a lot of people installed it ({{#rate}}{{value}}{{/rate}})" },
            { type: "cons", max: 20, message: "Was installed rarely last month ({{#rate}}{{value}}{{/rate}})" },
          ],
        },
        downloads: {
          rules: [
            { type: "pro", min: 1000000, message: "Is widely adopted ({{value}} total installs)" },
            { type: "note", min: 200000, max: 999999, message: "Is moderately adopted ({{value}} total installs)" },
            { type: "cons", max: 199999, message: "Is not adopted by many projects ({{value}} total installs)" },
          ],
        },
        downloadsGrowth: {
          rules: [
            { type: "pro", min: 0.300, message: "Adoption is growing fast ({{#growth}}{{value}}{{/growth}} installs this month vs month before)" },
            { type: "note", min: 0, max: 0.299, message: "Adoption is slow ({{#growth}}{{value}}{{/growth}} installs this month vs month before)" },
            { type: "cons", max: 0, message: "Adoption is dropping ({{#growth}}{{value}}{{/growth}} installs this month vs month before)" },
          ],
        },
        releaseRate: {
          rules: [
            { type: "pro", min: (1 / 15), message: "Releases are frequent ({{#rate}}{{value}}{{/rate}})" },
            { type: "note", max: (1 / 15), min: (1 / 30), message: "Releases are not so frequent ({{#rate}}{{value}}{{/rate}})" },
            { type: "cons", max: (1 / 30.001), message: "Releases are sporadic ({{#rate}}{{value}}{{/rate}})" },
          ],
        },
        releases: {
          rules: [
            { type: "pro", min: 35, message: "There are many releases ({{value}} releases)" },
            { type: "note", min: 15, max: 34, message: "There are not so many releases ({{value}} releases)" },
            { type: "cons", max: 14, message: "Few releases have been published ({{value}} releases)" },
          ],
        },
        oldestPullRequestDaysAgo: {
          rules: [
            { type: "pro", max: 10, message: "Oldest open pull request is very recent ({{#humanize}}{{value}}{{/humanize}})" },
            { type: "note", min: 11, max: 30, message: "Oldest open pull request is not recent ({{#humanize}}{{value}}{{/humanize}})" },
            { type: "cons", min: 30, message: "Oldest open pull request is very old ({{#humanize}}{{value}}{{/humanize}})" },
          ],
        },
      },
      extractors: [
        {
          name: "age",
          extractor: (raw) => {
            const now = moment();
            const createdAt = moment(_.get(raw, "github.repo.created_at"));

            return now.diff(createdAt, "days", true);
          },
        },
        {
          name: "starsRate",
          extractor: (raw, data) => {
            const stars = _.get(raw, "github.repo.stargazers_count", 0);
            return stars / data.age;
          },
        },
        {
          name: "commitsPeriod",
          extractor: (raw) => _.get(raw, "github.commitsStats.all", []).length * 7,
        },
        {
          name: "commitsRate",
          extractor: (raw, data) => {
            const commits = _.get(raw, "github.commitsStats.all", []);
            return commits.length > 0 ? commits.reduce((a, b) => a + b) / data.commitsPeriod : 0;
          },
        },
        {
          name: "lastCommitDaysAgo",
          extractor: (raw) => {
            const commitDate = moment(_.get(raw, "github.lastCommit.commit.author.date"));
            return moment().diff(commitDate, "days", true);
          },
        },
        {
          name: "oldestOpenIssueDaysAgo",
          extractor: (raw) => {
            const oldestIssueDate = moment(_.get(raw, "github.oldestOpenIssue.created_at"));
            return moment().diff(oldestIssueDate, "days", true);
          },
        },
        {
          name: "downloadsRate",
          extractor: (raw) => {
            const downloads = _.get(raw, "npm.stats.downloads.lastMonth", 0);
            return downloads / 30;
          },
        },
        {
          name: "downloads",
          extractor: (raw) => {
            return _.get(raw, "npm.stats.downloads.all", 0);
          },
        },
        {
          name: "downloadsGrowth",
          extractor: (raw, data) => {
            const monthBefore = _.get(raw, "npm.stats.downloads.monthBefore", false);

            if (monthBefore === false) {
              return 0;
            }

            const monthBeforeRate = monthBefore / 30;

            return (data.downloadsRate / monthBeforeRate) - 1.0;
          },
        },
        {
          name: "releaseRate",
          extractor: (raw) => {
            const times =
              _.values(_.omit(_.get(raw, "npm.time", {}), ["created", "modified", "unpublished"]))
              .map((item) => moment(item))
            ;

            const timesSub = [].concat(times);
            timesSub.shift();
            timesSub.push(moment());

            const intervals =
              _.zip(times, timesSub)
              .map((item) => item[1].diff(item[0], "days", true))
            ;

            return 1 / _.mean(intervals);
          },
        },
        {
          name: "releases",
          extractor: (raw) => {
            return _.keys(_.get(raw, "npm.versions", {})).length;
          },
        },
        {
          name: "oldestPullRequestDaysAgo",
          extractor: (raw) => {
            const oldestPR = _.get(raw, "github.oldestPR.created_at");

            if (!oldestPR) {
              return false;
            }

            const oldestPRDate = moment(oldestPR);
            return moment().diff(oldestPRDate, "days", true);
          },
        },
      ],
      score: [
        {
          name: "age",
          data: [[0, 0], [90, 5], [365, 20], [730, 27], [1460, 40]],
        },
        {
          name: "starsRate",
          data: [[0, 0], [1/7, 5], [1/2, 15], [1, 25], [10, 50], [24, 150], [50, 300], [200, 700]],
        },
        {
          name: "commitsRate",
          data: [[0, 0], [1/7, 15], [1, 50], [10, 100]],
        },
        {
          name: "lastCommitDaysAgo",
          data: [[0, 20], [7, 10], [30, 0], [60, 0]],
        },
        {
          name: "oldestOpenIssueDaysAgo",
          data: [[0, 30], [30, 0], [60, 0]],
          regression: "linear",
        },
        {
          name: "downloads",
          data: [
            [0, 0], [10000, 5], [100000, 10], [500000, 50],
            [1000000, 150], [6000000, 200], [20000000, 500],
            [2000000000, 1500],
          ],
        },
        {
          name: "downloadsRate",
          data: [[0, 0], [50, 5], [500, 250], [1000, 700], [10000, 1500]],
        },
        {
          name: "downloadsGrowth",
          data: [
            [0, 0], [0.01, 2], [0.1, 10], [0.5, 25],
            [1.0, 40], [2.0, 100], [5.0, 300], [10.0, 400],
          ],
        },
        {
          name: "releaseRate",
          data: [
            [1/90, 0], [1/60, 2], [1/40, 5], [1/30, 10], [1/15, 30], [1/5, 100],
          ],
        },
        {
          name: "releases",
          data: [
            [0, 0], [5, 1], [10, 5], [20, 15], [35, 25], [50, 50], [100, 150],
          ],
        },
        {
          name: "oldestPullRequestDaysAgo",
          data: [
            [30, 0], [20, 5], [15, 15], [10, 30], [5, 100],
          ],
        },
      ],
      ...config,
    };

    this.data = {};

    this.cons = [];
    this.notes = [];
    this.pros = [];

    this.scorePartials = {};
    this.score = 0;

    const self = this;

    this.emitter.on("*.progress", function (event) {
      if (this.event == "package.progress") {
        return;
      }

      self.emitter.emit("package.progress", { ...event, package: self });
    });
  }

  async fetchData() {
    this.emitter.emit("progress.package", { text: "Fetching remote data" });
    return await getNPMPackageData(this.name, this.emitter, this.config.auth);
  }

  async analyze() {
    this.emitter.emit("package.analyzing");

    const rawData = await this.fetchData();

    this.emitter.emit("package.progress", {
      text: "Analyzing collected data",
      package: this,
    });

    this.config.extractors.forEach(
      (extractor) => {
        this.data[extractor.name] = extractor.extractor(rawData, this.data);
      }
    );

    winston.debug(this.data);
  }

  calculateScore() {
    this.emitter.emit("progress.package", { text: "Calculating score" });

    this.scorePartials = {};

    [].concat(this.config.score).forEach((scoreDef) => {
      const value = this.data[scoreDef.name];

      if (!value) {
        this.scorePartials[scoreDef.name] = 0;
      }

      scoreDef = _.assign({ regression: "linear" }, scoreDef);

      let insPos = _.findLastIndex(scoreDef.data, (d) => d[0] < value);
      const data = [].concat(scoreDef.data);

      if (insPos < 0) {
        insPos = data.length;
      }

      data.splice(insPos + 1, 0, [value, null]);

      winston.debug(
        "Analyzing score data",
        data,
        "value inserted at index",
        insPos,
        "with regression",
        scoreDef.regression
      );

      const prediction = regression(
        scoreDef.regression,
        data,
        3
      );

      winston.debug("Prediction", prediction);

      this.scorePartials[scoreDef.name] = Math.max(0, _.get(
        prediction.points.filter((item) => item[0] == value),
        "[0][1]",
        0
      ));
    });

    this.score = Math.round(_.values(this.scorePartials).reduce((a, b) => a + b));
  }

  addMessage(data, threshold, rate, metric) {
    const values = {
      _data: this.data,
      value: rate,
      humanize: () => (text, render) => {
        return humanizeDuration(
          render(text) * 24 * 60 * 60 * 1000,
          { round: true, largest: 2 }
        );
      },
      growth: () => (text, render) => {
        const value = render(text);
        return `${value > 0 ? "+" : ""}${Math.round(value * 100)}%`;
      },
      rate: () => (text, render) => {
        return formatFreq(render(text));
      },
    };

    if (threshold.compute) {
      Object.keys(threshold.compute).forEach((item) => {
        values[item] = threshold.compute[item](rate);
      });
    }

    const message = mustache.render(data.message, values);

    this.addMessageType(data.type, message, metric);
  }

  addMessageType(type, message, metric) {
    switch (type) {
      case "pro":
        this.pros.push({ message, metric });
        break;

      case "note":
        this.notes.push({ message, metric });
        break;

      case "cons":
        this.cons.push({ message, metric });
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  }

  processRate(rate, rule, threshold, metric) {
    if (rate === false) {
      return;
    }

    if (rule.min === undefined && rule.max === undefined) {
      return;
    }

    // Keep 3 decimal places at most
    rate = Math.round(rate * 1000) / 1000;

    let shouldAdd = false;

    if (rule.min !== undefined && rule.max === undefined) {
      if (rate > rule.min) {
        shouldAdd = true;
      }
    } else if (rule.min === undefined && rule.max !== undefined) {
      if (rate < rule.max) {
        shouldAdd = true;
      }
    } else {
      if (rate >= rule.min && rate <= rule.max) {
        shouldAdd = true;
      }
    }

    if (shouldAdd) {
      this.addMessage(rule, threshold, rate, metric);
    }
  }

  update() {
    this.calculateScore();

    Object.keys(this.data).forEach((metric) => {
      const threshold = this.config.thresholds[metric];

      if (threshold && threshold.rules) {
        threshold.rules.forEach((rule) => {
          this.processRate(this.data[metric], rule, threshold, metric);
        });

        if (_.isFunction(threshold.processor)) {
          threshold.processor(this.data, this.addMessageType);
        }
      }
    });

    this.emitter.emit("package.updated");
  }

  shouldInstall([min, mid], strictMode = true) {
    if (this.score < min) {
      return false;
    }

    if (this.score < mid) {
      return !strictMode;
    }

    return true;
  }
}
