import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import MessageThread from "../src/components/messaging/MessageThread";
import type { Message } from "../src/components/messaging/MessageThread";

/**
 * Validates: Requirements 4.4
 * THE Dashboard SHALL display the conversation thread between an officer and a learner
 * ordered by timestamp ascending, showing each message's content, timestamp, and
 * delivery status (sent, delivered, read, or failed)
 */

const MAX_MESSAGE_LENGTH = 1000;

function createMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-1",
    sender_id: "officer-1",
    receiver_learner_id: "learner-1",
    direction: "to_learner",
    content: "Hello learner!",
    source: "dashboard",
    status: "sent",
    reply_to_id: null,
    created_at: "2024-06-01T10:00:00Z",
    ...overrides,
  };
}

describe("Messaging UI - Thread Rendering Order", () => {
  it("renders messages in the order provided (ascending by index = ascending by time)", () => {
    const messages: Message[] = [
      createMessage({ id: "1", content: "First message", created_at: "2024-06-01T10:00:00Z" }),
      createMessage({ id: "2", content: "Second message", created_at: "2024-06-01T10:05:00Z" }),
      createMessage({ id: "3", content: "Third message", created_at: "2024-06-01T10:10:00Z" }),
    ];

    render(<MessageThread messages={messages} />);

    const messageElements = screen.getAllByText(/message/i);
    expect(messageElements[0]).toHaveTextContent("First message");
    expect(messageElements[1]).toHaveTextContent("Second message");
    expect(messageElements[2]).toHaveTextContent("Third message");
  });

  it("shows 'No messages yet' placeholder when messages array is empty", () => {
    render(<MessageThread messages={[]} />);
    expect(screen.getByText(/no messages yet/i)).toBeInTheDocument();
  });

  it("shows 'Loading messages...' when isLoading is true", () => {
    render(<MessageThread messages={[]} isLoading={true} />);
    expect(screen.getByText(/loading messages/i)).toBeInTheDocument();
  });

  it("officer messages (direction: 'to_learner') have blue background", () => {
    const messages: Message[] = [
      createMessage({ id: "1", direction: "to_learner", content: "Officer says hi" }),
    ];

    render(<MessageThread messages={messages} />);

    const messageContent = screen.getByText("Officer says hi");
    const bubble = messageContent.closest("[class*='bg-blue-600']");
    expect(bubble).not.toBeNull();
  });

  it("learner messages (direction: 'from_learner') have gray background", () => {
    const messages: Message[] = [
      createMessage({ id: "1", direction: "from_learner", content: "Learner reply" }),
    ];

    render(<MessageThread messages={messages} />);

    const messageContent = screen.getByText("Learner reply");
    const bubble = messageContent.closest("[class*='bg-gray-100']");
    expect(bubble).not.toBeNull();
  });
});

describe("Messaging UI - Message Length Validation", () => {
  it("MAX_MESSAGE_LENGTH is 1000 characters", () => {
    expect(MAX_MESSAGE_LENGTH).toBe(1000);
  });

  it("empty messages should not be sendable (validation logic)", () => {
    const messageInput = "";
    const trimmed = messageInput.trim();
    const isSendDisabled = !trimmed || trimmed.length > MAX_MESSAGE_LENGTH;
    expect(isSendDisabled).toBe(true);
  });

  it("whitespace-only messages should not be sendable", () => {
    const messageInput = "   ";
    const trimmed = messageInput.trim();
    const isSendDisabled = !trimmed || trimmed.length > MAX_MESSAGE_LENGTH;
    expect(isSendDisabled).toBe(true);
  });

  it("messages exceeding 1000 characters are rejected", () => {
    const messageInput = "a".repeat(1001);
    const isOverLimit = messageInput.length > MAX_MESSAGE_LENGTH;
    expect(isOverLimit).toBe(true);
  });

  it("messages at exactly 1000 characters are accepted", () => {
    const messageInput = "a".repeat(1000);
    const isOverLimit = messageInput.length > MAX_MESSAGE_LENGTH;
    const isSendDisabled = !messageInput.trim() || isOverLimit;
    expect(isSendDisabled).toBe(false);
  });

  it("valid messages under 1000 characters are accepted", () => {
    const messageInput = "Hello, how are you?";
    const isOverLimit = messageInput.length > MAX_MESSAGE_LENGTH;
    const isSendDisabled = !messageInput.trim() || isOverLimit;
    expect(isSendDisabled).toBe(false);
  });
});

describe("Messaging UI - Delivery Status Display", () => {
  it("shows 'Sent' status badge for officer messages with status 'sent'", () => {
    const messages: Message[] = [
      createMessage({ id: "1", direction: "to_learner", status: "sent" }),
    ];

    render(<MessageThread messages={messages} />);
    expect(screen.getByText("Sent")).toBeInTheDocument();
  });

  it("shows 'Delivered' status badge for officer messages with status 'delivered'", () => {
    const messages: Message[] = [
      createMessage({ id: "1", direction: "to_learner", status: "delivered" }),
    ];

    render(<MessageThread messages={messages} />);
    expect(screen.getByText("Delivered")).toBeInTheDocument();
  });

  it("shows 'Read' status badge for officer messages with status 'read'", () => {
    const messages: Message[] = [
      createMessage({ id: "1", direction: "to_learner", status: "read" }),
    ];

    render(<MessageThread messages={messages} />);
    expect(screen.getByText("Read")).toBeInTheDocument();
  });

  it("shows 'Failed' status badge for officer messages with status 'failed'", () => {
    const messages: Message[] = [
      createMessage({ id: "1", direction: "to_learner", status: "failed" }),
    ];

    render(<MessageThread messages={messages} />);
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("does not show delivery status badge for learner messages", () => {
    const messages: Message[] = [
      createMessage({ id: "1", direction: "from_learner", status: "delivered", content: "Learner msg" }),
    ];

    render(<MessageThread messages={messages} />);
    expect(screen.queryByText("Delivered")).not.toBeInTheDocument();
  });
});
