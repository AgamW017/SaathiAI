"use client";

import { Check, CheckCheck, AlertCircle, Clock } from "lucide-react";

export interface Message {
  id: string;
  sender_id: string;
  receiver_learner_id: string;
  direction: "to_learner" | "from_learner";
  content: string;
  source: "whatsapp" | "dashboard" | "bot";
  status: "sent" | "delivered" | "read" | "failed";
  reply_to_id: string | null;
  created_at: string;
}

interface MessageThreadProps {
  messages: Message[];
  isLoading?: boolean;
}

function DeliveryStatusBadge({ status }: { status: Message["status"] }) {
  switch (status) {
    case "sent":
      return (
        <span className="inline-flex items-center gap-0.5 text-xs text-gray-400">
          <Clock className="h-3 w-3" />
          <span>Sent</span>
        </span>
      );
    case "delivered":
      return (
        <span className="inline-flex items-center gap-0.5 text-xs text-blue-500">
          <Check className="h-3 w-3" />
          <span>Delivered</span>
        </span>
      );
    case "read":
      return (
        <span className="inline-flex items-center gap-0.5 text-xs text-blue-600">
          <CheckCheck className="h-3 w-3" />
          <span>Read</span>
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-0.5 text-xs text-red-500">
          <AlertCircle className="h-3 w-3" />
          <span>Failed</span>
        </span>
      );
    default:
      return null;
  }
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default function MessageThread({
  messages,
  isLoading = false,
}: MessageThreadProps) {
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 py-12">
        Loading messages...
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 py-12">
        No messages yet. Send a ping to start the conversation.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-3 p-4">
      {messages.map((msg) => {
        const isOfficer = msg.direction === "to_learner";

        return (
          <div
            key={msg.id}
            className={`flex ${isOfficer ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                isOfficer
                  ? "bg-blue-600 text-white rounded-br-sm"
                  : "bg-gray-100 text-gray-900 rounded-bl-sm"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap break-words">
                {msg.content}
              </p>
              <div
                className={`flex items-center gap-2 mt-1 ${
                  isOfficer ? "justify-end" : "justify-start"
                }`}
              >
                <span
                  className={`text-xs ${
                    isOfficer ? "text-blue-200" : "text-gray-400"
                  }`}
                >
                  {formatTimestamp(msg.created_at)}
                </span>
                {isOfficer && <DeliveryStatusBadge status={msg.status} />}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
