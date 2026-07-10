/** How a real generated deliverable is packed into `ActivityEvent.message` —
 * the schema has no output column, so the delivered content lives in the
 * existing text log instead. The marker is matched with `contains`, not
 * `startsWith`, so a task reassigned mid-flight (new agent, same title)
 * still resolves to its own delivery history regardless of which agent's
 * name prefixes the message. */
function deliveredMarker(taskTitle: string): string {
  return `delivered "${taskTitle}":`;
}

export function formatDeliveryMessage(
  agentName: string,
  taskTitle: string,
  summary: string,
  deliverable: string,
): string {
  return `${agentName} ${deliveredMarker(taskTitle)} ${summary}\n\n${deliverable}`;
}

export function deliveryMessageMatchesTask(message: string, taskTitle: string): boolean {
  return message.includes(deliveredMarker(taskTitle));
}

export function parseDeliveryMessage(
  message: string,
  taskTitle: string,
): { summary: string; deliverable: string } {
  const marker = deliveredMarker(taskTitle);
  const idx = message.indexOf(marker);
  const rest = idx >= 0 ? message.slice(idx + marker.length) : message;
  const [summaryPart, ...deliverableParts] = rest.split("\n\n");
  return {
    summary: summaryPart.trim(),
    deliverable: deliverableParts.join("\n\n").trim(),
  };
}
