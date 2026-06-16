/**
 * Send a success response.
 * @param {object} res - Express response object
 * @param {string} message - Response message
 * @param {object} data - Data to include in response
 * @param {number} status - HTTP status code (default: 200)
 */
function sendSuccess(res, message, data = {}, status = 200) {
  return res.status(status).json({
    success: true,
    message,
    ...data
  });
}

/**
 * Send an error response.
 * @param {object} res - Express response object
 * @param {string} message - Error response message
 * @param {object} errors - Specific validation or field errors
 * @param {number} status - HTTP status code (default: 400)
 */
function sendError(res, message, errors = {}, status = 400) {
  const response = {
    success: false,
    message
  };
  
  if (errors && Object.keys(errors).length > 0) {
    response.errors = errors;
  }
  
  return res.status(status).json(response);
}

module.exports = {
  sendSuccess,
  sendError
};
