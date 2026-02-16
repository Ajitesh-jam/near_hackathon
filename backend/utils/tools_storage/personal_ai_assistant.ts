/**
 * Personal AI assistant template tool.
 *
 * Selecting this tool in the master agent UI will provision
 * the new agent with the stored personal_ai tools and API
 * (implemented in the backend ForgeService).
 */
export async function run(): Promise<{ message: string }> {
  return {
    message: "personal_ai assistant template selected. The backend will copy personal_ai tools and api.ts into this agent.",
  };
}

