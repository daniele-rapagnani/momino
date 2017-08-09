import _ from "lodash";
import chalk from "chalk";
import { printResults } from "../results";
import { createHandler, createBuilder } from "./common";
import { getProjectDependencies, getProjectConfig } from "../utils";
import emitter from "../events";
import analyzer from "../analyzer";

export const command = ["study [package...]", "*"];
export const desc = "Displays a package score";
export const builder = createBuilder((yargs) => {
  yargs.option("ranges", {
    alias: "r",
    description: "Specifies the score ranges to use when deciding " +
      "if you should use a package or not this" +
      " is in the format: [lowest score, good score]",
    type: "array",
    default: [300, 500],
  });

  yargs.option("test", {
    alias: "t",
    description: "Shows a small report of the result, "+
      "useful when integrated into a testing pipeline",
  });

  yargs.option("strict", {
    alias: "s",
    description: "Fail with any package below the 'good score' threshold (see -r). " +
      "Useful in conjunction with -t",
  });

  yargs.option("why", {
    alias: "w",
    description: "Gives a more detailed explanation of the score",
    type: "boolean",
  });

  yargs.option("allowed", {
    alias: "a",
    description: "Allow a package even if it's under the required score",
    type: "array",
  });

  yargs.option("banned", {
    alias: "b",
    description: "Ban a package even if it satisfied the minimum score",
    type: "array",
  });
});

export const handler = createHandler(async (argv, spinner, auth) => {
  let packages = argv.package;

  emitter.on("package.analyzing", () => spinner.start());

  emitter.on("package.progress", (event) => {
    if (event.text) {
      spinner.text = `${chalk.bold(event.package.name)}: ${event.text}`;
    }
  });

  emitter.on("package.updated", () => spinner.stop());

  emitter.on("*.warning", (event) => {
    process.stdout.write(`\n${chalk.bold.yellow("Warning")}: ${chalk.yellow(event.text)}.\n`);
  });

  if (!packages || packages.length == 0 ) {
    packages = getProjectDependencies();

    if (packages === false) {
      throw new Error(
        `No package.json file found in this directory.
        Pass a package name as parameter to analyze it.`
      );
    }
  }

  const projectConfig = getProjectConfig();
  const config = _.merge({}, projectConfig, argv, {
    auth,
    apiRateError: (service) => {
      return new Error(
        chalk.red.bold(`You reached your ${service} API limit.\n`) +
        chalk.red(`Try running ${argv.$0} with -A or run '${argv.$0} configure' command to permanently set your credentials.`)
      );
    },
  });

  const results = await analyzer(packages, config);

  process.exit(printResults(results, argv) ? 0 : 1);
});
