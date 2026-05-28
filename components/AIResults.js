import React from "react";

export default function AIResults({ result }) {
  if (!result) return null;

  return (
    <div
      style={{
        margin: "20px",
        padding: "20px",
        borderRadius: "14px",
        background: "#1b1b1b",
        color: "#fff",
        boxShadow: "0 0 10px rgba(0,0,0,0.2)",
      }}
    >
      <h2>Suggested Workflow</h2>

      <p>
        <strong>Source:</strong> {result.source}
      </p>

      <p>
        <strong>Confidence:</strong>{" "}
        {(result.confidence * 100).toFixed(0)}%
      </p>

      <hr style={{ margin: "15px 0" }} />

      <p>
        <strong>Category:</strong> {result.category}
      </p>

      <p>
        <strong>Type:</strong> {result.type}
      </p>

      <p>
        <strong>Sub Type:</strong> {result.subType}
      </p>

      {result.intentId && (
        <p>
          <strong>Intent ID:</strong> {result.intentId}
        </p>
      )}

      {result.message && (
        <p
          style={{
            color: "#ffcc00",
            marginTop: "15px",
          }}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
