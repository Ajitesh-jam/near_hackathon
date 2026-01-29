```python
import time
import logging

# Configure logging for the agent logic
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class AgentLogic:
    """
    AgentLogic class for a NEAR agent to manage a will based on user's online status.

    User Intent: "create a will that when i don't be online for 6 days transfer my will to my son"

    Active Tools:
    - 'social_checker': Monitors user's online status and triggers when status changes or is periodically checked.

    Reactive Tools:
    - 'will_executor': Executes the transfer of the will/assets to the designated recipient.
    """

    def __init__(self, tools: dict, agent_id: str):
        """
        Initializes the AgentLogic with available tools and agent ID.

        Args:
            tools (dict): A dictionary of available tools, e.g., {'social_checker': SocialCheckerToolInstance}.
            agent_id (str): The unique identifier for this agent instance.
        """
        self.tools = tools
        self.agent_id = agent_id
        logging.info(f"AgentLogic initialized for agent: {self.agent_id}")

        # --- State Management ---
        # Timestamp when the user was last detected online.
        # None indicates the user is currently online or no offline period has started.
        self.last_online_timestamp = None

        # Flag to ensure the will is transferred only once.
        self.will_transferred = False

        # Recipient's NEAR address for the will transfer.
        # IMPORTANT: In a real application, this should be securely configured by the user
        # or retrieved from a trusted source, not hardcoded.
        self.son_near_address = "son.near" # Placeholder for son's NEAR address

        # Duration threshold for being offline before the will is executed (6 days in seconds).
        self.offline_duration_threshold_seconds = 6 * 24 * 60 * 60

        logging.info(f"Will transfer threshold set to {self.offline_duration_threshold_seconds / (24*60*60):.2f} days.")
        logging.info(f"Son's NEAR address configured as: {self.son_near_address}")

    def on_trigger(self, tool_name: str, payload: dict):
        """
        Handles triggers received from active tools.

        Args:
            tool_name (str): The name of the tool that triggered this event.
            payload (dict): The data payload provided by the triggering tool.
        """
        logging.info(f"Received trigger from tool: '{tool_name}' with payload: {payload}")

        if tool_name == 'social_checker':
            self._handle_social_checker_trigger(payload)
        else:
            logging.warning(f"Unhandled trigger from unknown tool: '{tool_name}'.")

    def _handle_social_checker_trigger(self, payload: dict):
        """
        Processes the payload from the 'social_checker' tool.

        Expected payload structure:
        {'is_online': bool, 'timestamp': float}
        - 'is_online': True if the user is currently online, False otherwise.
        - 'timestamp': The Unix timestamp (float) when this status was observed.
                       Defaults to current time if not provided.
        """
        is_online = payload.get('is_online')
        trigger_timestamp = payload.get('timestamp', time.time()) # Use current time if not provided

        if is_online is None:
            logging.error("Social checker trigger payload missing 'is_online' status. Cannot process.")
            return

        if self.will_transferred:
            logging.info("Will has already been transferred. No further action needed regardless of online status.")
            return

        if is_online:
            # User is detected as online. Reset any ongoing offline tracking.
            if self.last_online_timestamp is not None:
                logging.info(f"User detected back online at {time.ctime(trigger_timestamp)}. Resetting offline timer.")
                self.last_online_timestamp = None
            else:
                logging.info(f"User confirmed online at {time.ctime(trigger_timestamp)}. No active offline period.")
            return

        # User is detected as offline.
        logging.info(f"User detected offline at {time.ctime(trigger_timestamp)}.")

        if self.last_online_timestamp is None:
            # This is the first detection of the user being offline in a continuous period.
            self.last_online_timestamp = trigger_timestamp
            logging.info(f"Started tracking continuous offline period from {time.ctime(self.last_online_timestamp)}.")
            return # Wait for subsequent triggers to check the duration

        # User is still offline. Calculate the duration.
        current_offline_duration = trigger_timestamp - self.last_online_timestamp
        offline_days = current_offline_duration / (24 * 60 * 60)
        threshold_days = self.offline_duration_threshold_seconds / (24 * 60 * 60)

        logging.info(f"Current continuous offline duration: {offline_days:.2f} days. "
                     f"Threshold for will transfer: {threshold_days:.2f} days.")

        if current_offline_duration >= self.offline_duration_threshold_seconds:
            logging.info(f"User has been offline for {offline_days:.2f} days, "
                         f"exceeding the {threshold_days:.2f} day threshold.")
            self._execute_will_transfer()
        else:
            logging.info("Offline duration not yet met the threshold for will transfer.")

    def _execute_will_transfer(self):
        """
        Executes the will transfer using the 'will_executor' reactive tool.
        This method is called when the offline condition is met.
        """
        if self.will_transferred:
            logging.warning("Attempted to transfer will, but it was already transferred. Aborting.")
            return

        if 'will_executor' not in self.tools:
            logging.error("Reactive tool 'will_executor' not available. Cannot transfer will.")
            return

        try:
            logging.info(f"Initiating will transfer to son's NEAR address: {self.son_near_address}...")

            # Call the 'transfer_will' method on the will_executor tool.
            # The 'will_executor' tool is expected to handle the specifics of what "my will" entails,
            # potentially accessing pre-configured asset details or instructions.
            result = self.tools['will_executor'].transfer_will(
                recipient_address=self.son_near_address,
                will_details="User's last will and testament assets as per pre-configuration."
            )
            self.will_transferred = True
            logging.info(f"Will transfer initiated successfully. Result: {result}")
            # After a successful transfer, the agent might want to notify relevant parties
            # or persist this state change securely.
        except Exception as e:
            logging.error(f"Failed to execute will transfer to {self.son_near_address}: {e}")

    # Optional: on_message method for direct user interaction (e.g., configuration, status checks)
    def on_message(self, message: str, sender: str):
        """
        Handles direct messages sent to the agent.
        This can be used for initial setup, status queries, or dynamic configuration.

        Args:
            message (str): The content of the message.
            sender (str): The identifier of the sender.
        """
        logging.info(f"Received message from {sender}: '{message}'")

        if message.lower() == "status":
            status_msg = (
                f"Agent ID: {self.agent_id}\n"
                f"Last online timestamp: {time.ctime(self.last_online_timestamp) if self.last_online_timestamp else 'N/A'}\n"
                f"Will transferred: {self.will_transferred}\n"
                f"Son's NEAR address: {self.son_near_address}\n"
                f"Offline threshold: {self.offline_duration_threshold_seconds / (24*60*60):.2f} days"
            )
            logging.info(f"Agent Status:\n{status_msg}")
            # In a real system, you would typically send this status back to the sender.
        elif message.lower().startswith("set son address "):
            try:
                new_address = message.split(" ", 3)[3].strip()
                if new_address:
                    self.son_near_address = new_address
                    logging.info(f"Son's NEAR address updated to: {self.son_near_address}")
                else:
                    logging.warning("New address cannot be empty. Use 'set son address <NEAR_ADDRESS>'")
            except IndexError:
                logging.warning("Invalid format for setting son's address. Use 'set son address <NEAR_ADDRESS>'")
        else:
            logging.info("Agent does not have specific message handling for this input.")

```