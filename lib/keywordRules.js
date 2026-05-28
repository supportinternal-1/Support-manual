const keywordRules = [
  {
    intentId: "PAY_RECH_001",
    category: "Payments",
    type: "Recharge",
    subType: "Debit Success Pending Recharge",

    requiredKeywords: [
      "DEBIT_SUCCESS",
      "RECHARGE_FAILURE"
    ],

    optionalKeywords: [
      "pending",
      "failed"
    ],

    confidence: 0.95,
  },

  {
    intentId: "LOGIN_001",
    category: "Login",
    type: "Authentication",
    subType: "Login Failure",

    requiredKeywords: [
      "LOGIN_ISSUE"
    ],

    optionalKeywords: [
      "otp",
      "device"
    ],

    confidence: 0.90,
  },

  {
    intentId: "REFUND_001",
    category: "Refund",
    type: "Pending Refund",
    subType: "Refund Delayed",

    requiredKeywords: [
      "REFUND_PENDING"
    ],

    optionalKeywords: [
      "money",
      "pending"
    ],

    confidence: 0.92,
  },
];

export default keywordRules;
