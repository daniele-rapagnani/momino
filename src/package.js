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
      },
      extractors: [
        {
          name: "age",
          extractor: (raw) => {
            const now = moment();
            const createdAt = moment(raw.github.repo.created_at);

            return now.diff(createdAt, "days", true);
          },
        },
        {
          name: "starsRate",
          extractor: (raw, data) => {
            const stars = raw.github.repo.stargazers_count;
            return stars / data.age;
          },
        },
        {
          name: "commitsPeriod",
          extractor: (raw) => raw.github.commitsPeriod,
        },
        {
          name: "commitsRate",
          extractor: (raw, data) => {
            const commits = raw.github.commits;
            return commits.length > 0 ? commits.length / data.commitsPeriod : 0;
          },
        },
        {
          name: "lastCommitDaysAgo",
          extractor: (raw) => {
            const commitDate = moment(raw.github.lastCommit.commit.author.date);
            return moment().diff(commitDate, "days", true);
          },
        },
        {
          name: "oldestOpenIssueDaysAgo",
          extractor: (raw) => {
            const oldestIssueDate = moment(raw.github.oldestOpenIssue.created_at);
            return moment().diff(oldestIssueDate, "days", true);
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
      ],
      ...config,
    };

    this.data = {};

    this.cons = [];
    this.notes = [];
    this.pros = [];
  }

  async fetchData() {
    this.spinner.text = "Fetching remote data";
    return await getNPMPackageData(this.name, this.spinner, this.config.auth);
  }

  async analyze() {
    const rawData = await this.fetchData();

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

    const scorePartials = [].concat(this.config.score).map((scoreDef) => {
      const value = this.data[scoreDef.name];

      if (!value) {
        return 0;
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

      return Math.max(0, _.get(
        prediction.points.filter((item) => item[0] == value),
        "[0][1]",
        0
      ));
    });

    this.score = Math.round(scorePartials.reduce((a, b) => a + b));
  }

  addMessage(data, threshold, rate) {
    const values = {
      _data: this.data,
      value: rate,
      humanize: () => (text, render) => {
        return humanizeDuration(
          render(text) * 24 * 60 * 60 * 1000,
          { round: true, largest: 2 }
        );
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

    switch (data.type) {
      case "pro":
        this.pros.push(message);
        break;

      case "note":
        this.notes.push(message);
        break;

      case "cons":
        this.cons.push(message);
        break;

      default:
        throw new Error(`Unknown message type: ${data.type}`);
    }
  }

  processRate(rate, rule, threshold) {
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
      this.addMessage(rule, threshold, rate);
    }
  }

  update() {
    Object.keys(this.data).forEach((key) => {
      const threshold = this.config.thresholds[key];

      if (threshold && threshold.rules) {
        threshold.rules.forEach((rule) => {
          this.processRate(this.data[key], rule, threshold);
        });
      }
    });

    this.calculateScore();
  }
}
