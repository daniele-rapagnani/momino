import winston from "winston";
import chalk from "chalk";
import ora from "ora";
import Enquirer from "enquirer";

import Package from "./package";

winston.configure({
  level: process.env.DEBUG ? "debug" : "warn",
  transports: [
    new (winston.transports.Console)({
      timestamp: true,
      colorize: "all",
      prettyPrint: true,
      handleExceptions: true,
    }),
  ],
});

const argv = require("yargs")
  .option("auth", {
    alias: "A",
    description: "Authenticate on GitHub",
  })
  .help()
  .argv
;

const packageName = [].concat(argv._ || []).pop();

if (!packageName) {
  process.stderr.write(
    chalk.red("Please specify a package to analyze. Type --help for more info\n")
  );

  process.exit(1);
}

const out = (string) => {
  process.stdout.write(`${string}\n`);
};

const main = async (packageName) => {
  let spinner = null;

  const handleError = (error) => {
    if (process.env.DEBUG || !spinner) {
      winston.error(error);
    } else if (spinner) {
      spinner.fail(error.message || error.toString());
    }

    process.exit(1);
  };

  process.on("unhandledRejection", handleError);
  process.on("uncaughtException", handleError);

  const conf = {};

  if (argv.auth) {
    const enq = new Enquirer();

    enq.register("password", require("prompt-password"));

    enq.question({
      name: "username",
      message: "Your GitHub username",
    });

    enq.question({
      name: "password",
      message: "Your GitHub password",
      type: "password",
    });

    conf.auth = await enq.ask();
  }

  spinner = ora(`Analyzing package ${chalk.bold(packageName)}`).start();

  const pk = new Package(packageName, spinner, conf);
  await pk.analyze();
  pk.update();

  spinner.stop();

  out(`\n${chalk.bold(packageName)} has scored: ${chalk.green.bold(pk.score)}\n`);

  if (pk.pros.length > 0) {
    out(chalk.green.bold("Pros:"));
    pk.pros.forEach((pro) => out(chalk.green(`- ${pro}`)));
  }

  if (pk.cons.length > 0) {
    out("");
    out(chalk.red.bold("Cons:"));
    pk.cons.forEach((cons) => out(chalk.red(`- ${cons}`)));
  }

  if (pk.notes.length > 0) {
    out("");
    out("Notes:");
    pk.notes.forEach((note) => out(chalk.grey(`- ${note}`)));
  }
};

main(packageName);
