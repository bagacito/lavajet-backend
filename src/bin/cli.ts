import { Command } from "commander";
import migrateCommand from "@decaf-ts/for-nest/cli";
import { bootCommand } from "../cli-module";

const nestCli = migrateCommand();

const nestCmd = new Command()
  .name("nest")
  .description("exposes various commands to help manage the nest integration");

for (const cmd of nestCli.commands) {
  if (cmd.name() === "boot") continue;
  nestCmd.addCommand(cmd);
}

nestCmd.addCommand(bootCommand);

