import inquirer from "inquirer";
import winston from "winston";
import ora from "ora";

export const createBuilder = (builder, { auth } = { auth: true }) => (yargs) => {
  if (auth) {
    yargs.option("auth", {
      alias: "A",
      description: "Authenticate on GitHub",
    });
  }

  builder(yargs);
};

export const createHandler = (handler, { auth } = { auth: true }) => async (argv) => {
  const spinner = ora();
  let authData = null;

  const handleError = (error) => {
    if (process.env.DEBUG) {
      winston.error(error);
    } else {
      spinner.fail(error.message || error.toString());
    }

    process.exit(1);
  };

  process.on("unhandledRejection", handleError);
  process.on("uncaughtException", handleError);

  if (auth && argv.auth) {
    authData = await inquirer.prompt([
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

  handler(argv, spinner, authData);
};
