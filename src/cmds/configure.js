import inquirer from "inquirer";
import store from "../store";

export const command = "configure";
export const desc = "Configuration wizard";

export const handler = async () => {
  const answer = await inquirer.prompt({
    name: "wantGithubToken",
    message: "Do you want to use your GitHub token? (this will speed up studying packages)",
    type: "confirm",
  });

  if (answer.wantGithubToken) {
    const token = await inquirer.prompt({
      name: "githubToken",
      message: "Insert your GitHub personal access token",
    });

    if (token) {
      store.github.set("githubToken", token.githubToken);
    }
  }

  store.save();
};
