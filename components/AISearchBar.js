import React, { useState } from "react";

export default function AISearchBar({ onResult }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSearch() {
    if (!query.trim()) return;

    setLoading(true);

    try {
      const response = await fetch("/api/ai-search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
        }),
      });

      const result = await response.json();

      if (result.success) {
        onResult(result.data);
      }

    } catch (error) {
      console.error("Search Error:", error);
    }

    setLoading(false);
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "90%",
        maxWidth: "700px",
        background: "#111",
        padding: "12px",
        borderRadius: "14px",
        display: "flex",
        gap: "10px",
        boxShadow: "0 0 10px rgba(0,0,0,0.3)",
      }}
    >
      <input
        type="text"
        placeholder="Ask support issue..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          flex: 1,
          padding: "12px",
          borderRadius: "10px",
          border: "none",
          outline: "none",
          fontSize: "15px",
        }}
      />

      <button
        onClick={handleSearch}
        disabled={loading}
        style={{
          padding: "12px 18px",
          borderRadius: "10px",
          border: "none",
          cursor: "pointer",
          fontWeight: "bold",
        }}
      >
        {loading ? "..." : "Ask"}
      </button>
    </div>
  );
}
