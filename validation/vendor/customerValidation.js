const yup = require('yup');

/**
 * Yup schema for customer creation validation.
 */
const createCustomerSchema = yup.object().shape({
  name: yup
    .string()
    .trim()
    .required('Full Name is required.'),
  email: yup
    .string()
    .trim()
    .email('Please enter a valid email address.')
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .notRequired(),
  phone: yup
    .string()
    .trim()
    .required('Phone Number is required.'),
  status: yup
    .string()
    .oneOf(['Active', 'Inactive'], 'Status must be either Active or Inactive.')
    .default('Active'),
  address: yup
    .string()
    .trim()
    .nullable()
    .notRequired(),
  profile_img: yup
    .string()
    .trim()
    .nullable()
    .notRequired(),
  profileImg: yup
    .string()
    .trim()
    .nullable()
    .notRequired(),
  idType: yup
    .string()
    .trim()
    .nullable()
    .notRequired(),
  idNumber: yup
    .string()
    .trim()
    .nullable()
    .notRequired(),
  kycDocumentImg: yup
    .string()
    .trim()
    .nullable()
    .notRequired(),
  associateExisting: yup
    .boolean()
    .nullable()
    .notRequired()
});

/**
 * Yup schema for customer update validation.
 */
const updateCustomerSchema = yup.object().shape({
  name: yup
    .string()
    .trim()
    .nullable()
    .notRequired(),
  email: yup
    .string()
    .trim()
    .email('Please enter a valid email address.')
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .notRequired(),
  phone: yup
    .string()
    .trim()
    .nullable()
    .notRequired(),
  status: yup
    .string()
    .oneOf(['Active', 'Inactive'], 'Status must be either Active or Inactive.')
    .nullable()
    .notRequired(),
  address: yup
    .string()
    .trim()
    .nullable()
    .notRequired(),
  profile_img: yup
    .string()
    .trim()
    .nullable()
    .notRequired(),
  profileImg: yup
    .string()
    .trim()
    .nullable()
    .notRequired(),
  idType: yup
    .string()
    .trim()
    .nullable()
    .notRequired(),
  idNumber: yup
    .string()
    .trim()
    .nullable()
    .notRequired(),
  kycDocumentImg: yup
    .string()
    .trim()
    .nullable()
    .notRequired()
});

module.exports = {
  createCustomerSchema,
  updateCustomerSchema
};
