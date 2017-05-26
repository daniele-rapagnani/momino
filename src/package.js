import _ from "lodash";
import winston from "winston";
import mustache from "mustache";
import moment from "moment";
import humanizeDuration from "humanize-duration";
import regression from "regression";

import { getNPMPackageData, formatFreq } from "./utils";

export default class Package {
  constructor(name, spinner, config = {}) {
    this.name = name;
    this.spinner = spinner;

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
            { type: "cons", max: 0.14, min: 0.001, message: "Commits are sporadic ({{#rate}}{{value}}{{/rate}})" },
            { type: "note", min: 0.141, max: 0.25, message: "Commits are not frequent ({{#rate}}{{value}}{{/rate}})" },
            { type: "pro", min: 0.251, message: "Commits are frequent ({{#rate}}{{value}}{{/rate}})" },
            { type: "cons", max: 0.0009, min: 0, message: "There were no commits in the last {{_data.commitsPeriod}} days" },
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
            { type: "cons", max: 0.07, message: "Does not get many stars ({{#rate}}{{value}}{{/rate}})"},
            { type: "note", min: 0.071, max: 0.5, message: "Gets a good amount of stars but not extraordinary ({{#rate}}{{value}}{{/rate}})"},
            { type: "pro", min: 0.51, message: "Gets a lot of stars ({{#rate}}{{value}}{{/rate}})"},
          ],
        },
        closedIssueRate: {
          rules: [
            { type: "cons", max: 0.14, message: "Issues are closed slowly ({{#rate}}{{value}}{{/rate})"},
            { type: "note", min: 0.141, max: 0.25, message: "Issues are solved in average time ({{#rate}}{{value}}{{/rate})"},
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
            { type: "pro", min: 1000, message: "Was installed a lot this month ({{#rate}}{{value}}{{/rate}})" },
            { type: "note", min: 300, max: 999, message: "Last month not a lot of people installed it ({{#rate}}{{value}}{{/rate}})" },
            { type: "cons", max: 299, message: "Was not installed a lot in the last month ({{#rate}}{{value}}{{/rate}})" },
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
            { type: "pro", min: 0.3, message: "Adoption is growing fast ({{#growth}}{{value}}{{/growth}} installs last month)" },
            { type: "note", min: 0, max: 0.29, message: "Adoption is slow ({{#growth}}{{value}}{{/growth}} installs last month)" },
            { type: "cons", max: 0, message: "Adoption is dropping ({{#growth}}{{value}}{{/growth}} installs last month)" },
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
          extractor: (raw) => _.get(raw, "github.commitsPeriod", 30),
        },
        {
          name: "commitsRate",
          extractor: (raw, data) => {
            const commits = _.get(raw, "github.commits", []);
            return commits.length > 0 ? commits.length / data.commitsPeriod : 0;
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
            const totalRate = data.downloads / data.age;
            return (data.downloadsRate / totalRate) - 1.0;
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
            [200000000, 5000],
          ],
        },
        {
          name: "downloadsRate",
          data: [[0, 0], [300, 5], [1000, 50], [10000, 150], [1000000, 500]],
        },
        {
          name: "downloadsGrowth",
          data: [
            [0, 0], [0.01, 2], [0.1, 10], [0.5, 100],
            [1.0, 200], [2.0, 500], [5.0, 2000], [10.0, 5000],
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
  }

  async fetchData() {
    this.spinner.text = "Fetching remote data";
    return await getNPMPackageData(this.name, this.spinner, this.config.auth);
  }

  async analyze() {
    const rawData = await this.fetchData();
    require("fs").writeFileSync("yeah.json", JSON.stringify(rawData, null, 4));

    this.spinner.text = "Analyzing collected data";

    this.config.extractors.forEach(
      (extractor) => {
        this.data[extractor.name] = extractor.extractor(rawData, this.data);
      }
    );

    winston.debug(this.data);
  }

  calculateScore() {
    this.spinner.text = "Calculating score";

    this.scorePartials = {};

    [].concat(this.config.score).forEach((scoreDef) => {
      const value = this.data[scoreDef.name];

      if (!value) {
        this.scorePartials[scoreDef.name] = 0;
      }

      scoreDef = _.assign({ regression: "polynomial" }, scoreDef);

      winston.debug(
        "Analyzing score data",
        scoreDef.data, [[value, null]],
        "with regression",
        scoreDef.regression
      );

      const prediction = regression(
        scoreDef.regression,
        [].concat(scoreDef.data, [[value, null]]),
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
    if (rule.min === undefined && rule.max === undefined) {
      return;
    }

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
  }
}
