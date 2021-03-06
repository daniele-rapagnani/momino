import _ from "lodash";
import winston from "winston";
import mustache from "mustache";
import humanizeDuration from "humanize-duration";
import numeral from "numeral";
import regression from "regression";
import camelCase from "camelcase";
import glob from "glob";
import path from "path";
import fs from "fs";

import { formatFreq } from "../utils";

export default class Package {
  constructor(name, emitter = null, config = {}) {
    this.name = name;
    this.emitter = emitter;

    this.config = { debug: false, ...config };

    this.metrics = {};
    this.scrapers = {};
    this.data = {};

    this.cons = [];
    this.notes = [];
    this.pros = [];

    this.scorePartials = {};
    this.score = 0;
    this.preApproved = false;
    this.banned = false;
  }

  init() {
    this.loadScrapers();
    this.loadMetrics();

    const self = this;

    this.emitter.on("*.progress", function (event) {
      if (this.event == "package.progress") {
        return;
      }

      self.emitter.emit("package.progress", { ...event, package: self });
    });
  }

  loadPasses(dir, cb) {
    const passesFiles = glob.sync(path.join(__dirname, dir, "*", "*.js"));

    passesFiles.forEach((passFile) => {
      const name = camelCase(path.basename(passFile, ".js"));
      const module = require(passFile);

      cb(name, module, passFile);
    });
  }

  loadScrapers() {
    this.loadPasses("scrapers", (name, module) => {
      this.scrapers[name] = module.default;
    });
  }

  loadMetrics() {
    this.loadPasses("metrics", (name, module) => {
      this.metrics[name] = module;
    });
  }

  async fetchData() {
    this.emitter.emit("progress.package", { text: "Fetching remote data" });

    const scrapers = _.keys(this.scrapers);
    let rawData = {};

    //@note: At the moment the concept of multiple
    //       passes for the scraper is not usefull
    //       but it can be used in the future to
    //       do parallel processing of scrapers
    //       that are interdependent

    for (let i = 0; i < scrapers.length; i++) {
      const data = await this.scrapers[scrapers[i]](
        this.name,
        this.emitter,
        this.config,
        rawData
      );

      rawData = { ...rawData, [scrapers[i]]: data };
    }

    return rawData;
  }

  async analyze() {
    this.emitter.emit("package.analyzing");

    const rawData = await this.fetchData();

    if (this.config.debug) {
      fs.writeFileSync(
        path.join(process.cwd(), `${this.name}-raw.json`),
        JSON.stringify(rawData, null, 2),
        "utf8"
      );
    }

    this.emitter.emit("package.progress", {
      text: "Analyzing collected data",
      package: this,
    });

    _.keys(this.metrics).forEach(
      (metricName) => {
        if (!this.metrics[metricName].extractor) {
          return;
        }

        this.data[metricName] = this.metrics[metricName].extractor(rawData, this.data);

        if (_.isNumber(this.data[metricName])) {
          this.data[metricName] = {
            value: this.data[metricName],
          };
        }
      }
    );

    winston.debug(this.data);
  }

  calculateScore() {
    this.emitter.emit("progress.package", { text: "Calculating score" });

    this.scorePartials = {};

    _.keys(this.metrics).forEach((metricName) => {
      let scoreDef = this.metrics[metricName].score;

      if (!scoreDef) {
        return;
      }

      const value = _.get(this.data[metricName], "value");

      if (!value) {
        this.scorePartials[metricName] = 0;
      } else if (_.isFunction(scoreDef)) {
        this.scorePartials[metricName] = Math.round(scoreDef(value, this.data));
      } else {
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

        this.scorePartials[metricName] = Math.max(0, _.get(
          prediction.points.filter((item) => item[0] == value),
          "[0][1]",
          0
        ));

        winston.debug("Prediction", prediction);
      }
    });

    this.score = Math.round(_.values(this.scorePartials).reduce((a, b) => a + b));
  }

  addMessage(data, threshold, rate, metric, extra = {}, postfix = null) {
    const values = {
      _data: this.data,
      value: rate,
      extra,
      humanize: () => (text, render) => {
        return humanizeDuration(
          render(text) * 24 * 60 * 60 * 1000,
          { round: true, largest: 2 }
        );
      },
      number: () => (text, render) => {
        return numeral(render(text)).format("0,0");
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

    let message = mustache.render(data.message, values);

    if (postfix) {
      postfix = mustache.render(postfix, values);
      message = `${message} ${postfix}`;
    }

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

  processRate(rateData, rule, threshold, metric, postfix) {
    let rate = _.get(rateData, "value", false);
    const extra = _.get(rateData, "extra", {});

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
      this.addMessage(rule, threshold, rate, metric, extra, postfix);
    }
  }

  update() {
    this.calculateScore();

    Object.keys(this.data).forEach((metricName) => {
      const metric = this.metrics[metricName];

      if (metric && metric.rules) {
        const rules = !_.isArray(metric.rules) ? _.get(metric.rules, "rules", []) : metric.rules;
        const postfix = !_.isArray(metric.rules) ? metric.rules.postfix : null;

        rules.forEach((rule) => {
          this.processRate(this.data[metricName], rule, metric, metricName, postfix);
        });

        if (_.isFunction(metric.processor)) {
          metric.processor(this.data, this.addMessageType);
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
