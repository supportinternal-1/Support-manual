const synonymMap = {
  // Debit Success
  "money deducted": "DEBIT_SUCCESS",
  "amount deducted": "DEBIT_SUCCESS",
  "amt debited": "DEBIT_SUCCESS",
  "payment cut": "DEBIT_SUCCESS",
  "bank charged": "DEBIT_SUCCESS",
  "money debited": "DEBIT_SUCCESS",

  // Recharge Failure
  "recharge failed": "RECHARGE_FAILURE",
  "recharge not done": "RECHARGE_FAILURE",
  "recharge pending": "RECHARGE_FAILURE",
  "operator issue": "RECHARGE_FAILURE",

  // Login Issues
  "unable to login": "LOGIN_ISSUE",
  "login failed": "LOGIN_ISSUE",
  "cannot login": "LOGIN_ISSUE",
  "otp issue": "LOGIN_ISSUE",

  // Refund Issues
  "refund pending": "REFUND_PENDING",
  "refund not received": "REFUND_PENDING",
  "money not refunded": "REFUND_PENDING",

  // Device Issues
  "device change": "DEVICE_CHANGE",
  "new phone login": "DEVICE_CHANGE",
};

export default synonymMap;
