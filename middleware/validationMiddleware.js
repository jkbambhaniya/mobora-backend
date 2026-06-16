const { sendError } = require('../utils/responseHelper');

/**
 * Express middleware helper to validate request body using a Yup schema.
 * @param {object} schema - Yup schema object
 */
const validateBody = (schema) => async (req, res, next) => {
  try {
    // Validate request body, strip fields that are not in the schema (optional, but clean)
    const validatedBody = await schema.validate(req.body, { 
      abortEarly: false, 
      stripUnknown: true 
    });
    // Replace req.body with the validated and cleaned body
    req.body = validatedBody;
    next();
  } catch (error) {
    const formattedErrors = {};
    
    if (error.inner && error.inner.length > 0) {
      error.inner.forEach((err) => {
        if (err.path) {
          formattedErrors[err.path] = err.message;
        }
      });
    } else if (error.path) {
      formattedErrors[error.path] = error.message;
    }
    
    return sendError(res, 'Validation failed.', formattedErrors, 400);
  }
};

module.exports = {
  validateBody
};
