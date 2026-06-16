"use client";

import { useState, useRef, useEffect } from "react";
import { Send, MessageSquare } from "lucide-react";
import { trpc } from "@/src/lib/trpc/client";
import MessageThread from "@/src/components/messaging/MessageThread";

const MAX_MESSAGE_LENGTH = 1000;

export default function MessagingPage() {
  const [learnerId, setLearnerId] = useState("");
  const [activeLearnerId, setActiveLearnerId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const threadEndRef = useRef<HTMLDivElement>(null);

  // Fetch thread with 5-second polling when a learner is selected
  const threadQuery = trpc.messaging.getThread.useQuery(
    { learnerId: activeLearnerId! },
    {
      enabled: !!activeLearnerId,
      refetchInterval: 5000,
    }
  );

  // Send message mutation
  const sendPing = trpc.messaging.sendPing.useMutation({
    onSuccess: () => {
      setMessageInput("");
      threadQuery.refetch();
    },
  });

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [threadQuery.data?.messages]);

  function handleSelectLearner(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = learnerId.trim();
    if (trimmed) {
      setActiveLearnerId(trimmed);
    }
  }

  function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!activeLearnerId || !messageInput.trim() || messageInput.length > MAX_MESSAGE_LENGTH) {
      return;
    }
    sendPing.mutate({
      learnerId: activeLearnerId,
      message: messageInput.trim(),
    });
  }

  const charCount = messageInput.length;
  const isOverLimit = charCount > MAX_MESSAGE_LENGTH;
  const isSendDisabled =
    !messageInput.trim() || isOverLimit || sendPing.isPending;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <MessageSquare className="h-6 w-6 text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-900">
            Messaging
          </h1>
        </div>
      </header>

      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
        {/* Learner Selector */}
        <div className="px-6 py-4 bg-white border-b border-gray-200">
          <form onSubmit={handleSelectLearner} className="flex gap-3">
            <input
              type="text"
              value={learnerId}
              onChange={(e) => setLearnerId(e.target.value)}
              placeholder="Enter Learner ID (UUID)"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              aria-label="Learner ID"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!learnerId.trim()}
            >
              Load Thread
            </button>
          </form>
          {activeLearnerId && (
            <p className="text-xs text-gray-500 mt-2">
              Viewing conversation with: <span className="font-mono">{activeLearnerId}</span>
            </p>
          )}
        </div>

        {/* Message Thread Area */}
        <div className="flex-1 flex flex-col min-h-0 bg-white">
          {!activeLearnerId ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 py-12">
              Enter a learner ID above to view the conversation.
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto">
                <MessageThread
                  messages={threadQuery.data?.messages ?? []}
                  isLoading={threadQuery.isLoading}
                />
                <div ref={threadEndRef} />
              </div>

              {/* Error Display */}
              {sendPing.isError && (
                <div className="px-4 py-2 bg-red-50 border-t border-red-200 text-sm text-red-600">
                  {sendPing.error.message}
                </div>
              )}

              {/* Message Input */}
              <div className="border-t border-gray-200 p-4">
                <form onSubmit={handleSendMessage} className="flex gap-3">
                  <div className="flex-1 relative">
                    <textarea
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      placeholder="Type your message..."
                      rows={2}
                      maxLength={MAX_MESSAGE_LENGTH + 100} // Allow slight overshoot for visibility
                      className={`w-full px-4 py-2.5 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:border-transparent ${
                        isOverLimit
                          ? "border-red-400 focus:ring-red-500"
                          : "border-gray-300 focus:ring-blue-500"
                      }`}
                      aria-label="Message input"
                    />
                    <span
                      className={`absolute bottom-2 right-3 text-xs ${
                        isOverLimit ? "text-red-500 font-medium" : "text-gray-400"
                      }`}
                    >
                      {charCount}/{MAX_MESSAGE_LENGTH}
                    </span>
                  </div>
                  <button
                    type="submit"
                    disabled={isSendDisabled}
                    className="self-end px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    aria-label="Send message"
                  >
                    <Send className="h-4 w-4" />
                    <span className="text-sm font-medium">Send</span>
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
