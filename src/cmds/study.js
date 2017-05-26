import chalk from "chalk";
import winston from "winston";
import inquirer from "inquirer";
import ora from "ora";
import Package from "../package";

export const command = "study <package>";
export const desc = "Displays a package score";
export const builder = (yargs) => {
  yargs.option("auth", {
    alias: "A",
    description: "Authenticate on GitHub",
  });
};

export const handler = function(argv) {
  const packageName = argv.package;

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
      conf.auth = await inquirer.prompt([
        {
          name: "username",
          message: "Your GitHub username",
        },
        {
          name: "password",
          message: "Your GitHub password",
          type: "password",
        },
      ]);
    }

    spinner = ora(`Analyzing package ${chalk.bold(packageName)}`).start();

    const pk = new Package(packageName, spinner, conf);
    await pk.analyze();
    pk.update();

    spinner.stop();

    out(`\n${chalk.bold(packageName)} has scored: ${chalk.green.bold(pk.score)}\n`);

    if (pk.pros.length > 0) {
      out(chalk.green.bold("Pros:"));
      pk.pros.forEach((pro) => {
        let msg = chalk.green(`- ${pro.message}`);

        if (pro.metric) {
          const score = Math.round(pk.scorePartials[pro.metric]);

          if (score) {
            msg = `${msg} ${chalk.bold.green("+" + score)}`;
          }
        }

        out(msg);
      });
    }

    if (pk.cons.length > 0) {
      out("");
      out(chalk.red.bold("Cons:"));
      pk.cons.forEach((cons) => out(chalk.red(`- ${cons.message}`)));
    }

    if (pk.notes.length > 0) {
      out("");
      out("Notes:");
      pk.notes.forEach((note) => out(chalk.grey(`- ${note.message}`)));
    }
  };

  main(packageName);
};
