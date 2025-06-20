import { Command } from "../../core/command";
import { InspectViewManager } from "./logview-view";
import { showError } from "../../components/error";
import { commands } from "vscode";
import {
  kInspectEvalLogFormatVersion,
  kInspectOpenInspectViewVersion,
} from "../inspect/inspect-constants";
import { LogviewState } from "./logview-state";
import { inspectVersionDescriptor } from "../../inspect/props";
import { selectFileUri } from "./log-file-selector";

export interface LogviewOptions {
  state?: LogviewState;
  activate?: boolean;
}

export async function logviewCommands(
  manager: InspectViewManager
): Promise<Command[]> {
  // Check whether the open in inspect view command should be enabled
  const descriptor = inspectVersionDescriptor();
  const enableOpenInView =
    descriptor?.version &&
    descriptor.version.compare(kInspectOpenInspectViewVersion) >= 0 &&
    descriptor.version.compare(kInspectEvalLogFormatVersion) <= 0;
  await commands.executeCommand(
    "setContext",
    "inspect_ai.enableOpenInView",
    enableOpenInView
  );

  return [new ShowLogviewCommand(manager), new ShowOpenLogCommand()];
}

class ShowLogviewCommand implements Command {
  constructor(private readonly manager_: InspectViewManager) {}
  async execute(): Promise<void> {
    // ensure logview is visible
    try {
      await this.manager_.showInspectView();
    } catch (err: unknown) {
      await showError(
        "An error occurred while attempting to start Inspect View",
        err instanceof Error ? err : Error(String(err))
      );
    }
  }

  private static readonly id = "inspect.inspectView";
  public readonly id = ShowLogviewCommand.id;
}

class ShowOpenLogCommand implements Command {
  constructor() {}
  async execute(): Promise<void> {
    try {
      const uri = await selectFileUri();
      if (uri) {
        await commands.executeCommand("inspect.openLogViewer", uri);
      }
    } catch (err: unknown) {
      // pass
    }
  }

  private static readonly id = "inspect.inspectViewLog";
  public readonly id = ShowOpenLogCommand.id;
}
