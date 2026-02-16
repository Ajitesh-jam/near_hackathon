import { runSchedulerLoop } from "./tools/scheduler";

export function runLogic(): void {
  console.log("Personal AI Ready");
  try {
    runSchedulerLoop();
  } catch (error) {
    console.error("Personal AI logic exited unexpectedly:", error);
  }  
}
