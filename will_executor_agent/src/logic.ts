import { willExecutorAgent } from "./tools/will_executor";

export function runLogic(): void {
  (async () => {
    try {
      await willExecutorAgent();
    } catch (error) {
      console.error("will executor logic exited unexpectedly:", error);
    }
  })();
}