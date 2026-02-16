declare module "@neardefi/shade-agent-js" {
  export function agentCall(options: {
    methodName: string;
    args: Record<string, unknown>;
  }): Promise<unknown>;

  export function agentView(options: {
    methodName: string;
    args: Record<string, unknown>;
  }): Promise<unknown>;
}
