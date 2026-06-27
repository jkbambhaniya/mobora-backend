const yup = require('yup');

/**
 * Validate password strength against security policy rules.
 */
function isStrongPassword(password) {
  return (
    password &&
    password.length >= 8 &&
    /\d/.test(password) &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

/**
 * Yup schema for registration validation.
 */
const registerSchema = yup.object().shape({
  name: yup
    .string()
    .trim()
    .required('Full Name is required.'),
  email: yup
    .string()
    .trim()
    .required('Email is required.')
    .email('Please enter a valid email address.'),
  password: yup
    .string()
    .required('Password is required.')
    .test(
      'is-strong-password',
      'Password must be at least 8 characters long, contain uppercase & lowercase letters, a number, and a special character.',
      (value) => !value || isStrongPassword(value)
    )
});

/**
 * Yup schema for login validation.
 */
const loginSchema = yup.object().shape({
  email: yup
    .string()
    .trim()
    .required('Email is required.')
    .email('Please enter a valid email address.'),
  password: yup
    .string()
    .required('Password is required.')
});

const updateProfileSchema = yup.object().shape({
  name: yup
    .string()
    .trim()
    .nullable()
    .notRequired(),
  email: yup
    .string()
    .trim()
    .email('Please enter a valid email address.')
    .nullable()
    .notRequired(),
  phone: yup
    .string()
    .trim()
    .nullable()
    .notRequired(),
  shop_name: yup
    .string()
    .trim()
    .nullable()
    .notRequired(),
  address: yup
    .string()
    .trim()
    .nullable()
    .notRequired(),
  payment_methods: yup
    .string()
    .trim()
    .nullable()
    .notRequired(),
  profile_img: yup
    .string()
    .nullable()
    .notRequired(),
  gst_enabled: yup
    .boolean()
    .nullable()
    .notRequired(),
  gst_rate: yup
    .number()
    .integer()
    .min(0)
    .max(100)
    .nullable()
    .notRequired(),
  markup: yup
    .number()
    .integer()
    .min(0)
    .max(1000)
    .nullable()
    .notRequired()
});

const changePasswordSchema = yup.object().shape({
  currentPassword: yup
    .string()
    .required('Current password is required.'),
  newPassword: yup
    .string()
    .required('New password is required.')
    .test(
      'is-strong-password',
      'Password must be at least 8 characters long, contain uppercase & lowercase letters, a number, and a special character.',
      (value) => !value || isStrongPassword(value)
    )
});

module.exports = {
  isStrongPassword,
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema
};
