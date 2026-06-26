const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Vendor, BusinessDetail } = require("../../models");
const { sendSuccess, sendError } = require("../../utils/responseHelper");
const {
	registerSchema,
	loginSchema,
	updateProfileSchema,
	changePasswordSchema,
} = require("../../validation/vendor/authValidation");
const {
	getObfuscatedKey,
	decryptValue,
	setAuthCookies,
	setAccessTokenCookie,
	clearAuthCookies,
} = require("../../utils/cryptoHelper");
require("dotenv").config();

const JWT_SECRET =
	process.env.JWT_SECRET ||
	"super_secret_jwt_key_please_change_in_production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";
const AUTO_APPROVE_VENDORS = process.env.AUTO_APPROVE_VENDORS === "true";

/**
 * Handle new vendor registration request.
 */
async function register(req, res) {
	try {
		const { name, email, password } = req.body;

		const trimmedName = name.trim();
		const trimmedEmail = email.trim().toLowerCase();

		// 1. Check for pre-existing vendor email
		const existingVendor = await Vendor.findOne({
			where: { email: trimmedEmail },
		});
		if (existingVendor) {
			return sendError(
				res,
				"An account with this email address already exists.",
				{ email: "An account with this email address already exists." },
				409,
			);
		}

		// 2. Hash the password with bcrypt (12 salt rounds)
		const saltRounds = 12;
		const hashedPassword = await bcrypt.hash(password, saltRounds);

		// 3. Set registration status based on approval configuration
		const status = AUTO_APPROVE_VENDORS ? "active" : "pending";

		// 4. Store vendor in database
		const newVendor = await Vendor.create({
			name: trimmedName,
			email: trimmedEmail,
			password: hashedPassword,
			status,
		});

		// Create default business details record
		await BusinessDetail.create({
			vendor_id: newVendor.id,
			shop_name: trimmedName + " Store",
			phone: "",
			address: "",
			payment_methods: "Cash, UPI",
			gst_enabled: true,
			gst_rate: 18,
		});

		return sendSuccess(
			res,
			status === "active"
				? "Vendor account registered successfully!"
				: "Registration successful! Your account is currently under review by an administrator.",
			{
				vendor: {
					id: newVendor.id,
					name: newVendor.name,
					email: newVendor.email,
					status: newVendor.status,
				},
			},
			201,
		);
	} catch (error) {
		console.error("[Vendor Auth] Registration error:", error.message);
		return sendError(
			res,
			"An internal server error occurred during registration.",
			{},
			500,
		);
	}
}

/**
 * Handle vendor login request.
 */
async function login(req, res) {
	try {
		const { email, password } = req.body;

		const trimmedEmail = email.trim().toLowerCase();

		// 1. Fetch vendor by email
		const vendor = await Vendor.findOne({
			where: { email: trimmedEmail },
			include: [{ model: BusinessDetail, as: "businessDetail" }],
		});
		if (!vendor) {
			return sendError(res, "Invalid email or password.", {}, 401);
		}

		// 2. Verify password hash
		const isPasswordValid = await bcrypt.compare(password, vendor.password);
		if (!isPasswordValid) {
			return sendError(res, "Invalid email or password.", {}, 401);
		}

		// 3. Validate account status
		if (vendor.status === "pending") {
			return sendError(
				res,
				"Your account is currently under review. An administrator will verify it shortly.",
				{},
				403,
			);
		}

		if (vendor.status === "inactive") {
			return sendError(
				res,
				"Your account has been deactivated. Please contact system support.",
				{},
				403,
			);
		}

		// 4. Issue JWT access token (15 mins) and refresh token (7 days)
		const tokenPayload = {
			id: vendor.id,
			email: vendor.email,
			role: "vendor",
			gstEnabled: vendor.businessDetail ? vendor.businessDetail.gst_enabled : true,
			gstRate: vendor.businessDetail ? vendor.businessDetail.gst_rate : 18,
		};

		const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "7d" });

		const JWT_REFRESH_SECRET =
			process.env.JWT_REFRESH_SECRET || JWT_SECRET + "_refresh";
		const refreshToken = jwt.sign({ id: vendor.id }, JWT_REFRESH_SECRET, {
			expiresIn: "7d",
		});

		const vendorDetails = {
			id: vendor.id,
			name: vendor.name,
			email: vendor.email,
			status: vendor.status,
			profile_img: vendor.profile_image_url,
			shop_name: vendor.businessDetail ? vendor.businessDetail.shop_name : "",
			phone: vendor.businessDetail ? vendor.businessDetail.phone : "",
			address: vendor.businessDetail ? vendor.businessDetail.address : "",
			payment_methods: vendor.businessDetail ? vendor.businessDetail.payment_methods : "",
			gst_enabled: vendor.businessDetail ? vendor.businessDetail.gst_enabled : true,
			gst_rate: vendor.businessDetail ? vendor.businessDetail.gst_rate : 18,
		};

		// 5. Encrypt tokens and set secure cookies
		setAuthCookies(res, token, refreshToken, vendorDetails);

		return sendSuccess(
			res,
			"Sign-in successful!",
			{
				token,
				vendor: vendorDetails,
			},
			200,
		);
	} catch (error) {
		console.error("[Vendor Auth] Login error:", error.message);
		return sendError(
			res,
			"An internal server error occurred during login.",
			{},
			500,
		);
	}
}

/**
 * Retrieve current authenticated vendor details.
 */
async function getProfile(req, res) {
	try {
		const vendor = await Vendor.findByPk(req.user.id, {
			include: [{ model: BusinessDetail, as: "businessDetail" }],
			attributes: { exclude: ["password"] },
		});

		if (!vendor) {
			return sendError(res, "Vendor profile not found.", {}, 444);
		}

		// Flatten businessDetail attributes into vendor root for backward compatibility
		const formatted = vendor.toJSON();
		formatted.profile_img = vendor.profile_image_url;
		if (formatted.businessDetail) {
			formatted.shop_name = formatted.businessDetail.shop_name;
			formatted.phone = formatted.businessDetail.phone;
			formatted.address = formatted.businessDetail.address;
			formatted.payment_methods = formatted.businessDetail.payment_methods;
			formatted.gst_enabled = formatted.businessDetail.gst_enabled;
			formatted.gst_rate = formatted.businessDetail.gst_rate;
		} else {
			formatted.shop_name = "";
			formatted.phone = "";
			formatted.address = "";
			formatted.payment_methods = "";
			formatted.gst_enabled = true;
			formatted.gst_rate = 18;
		}

		return sendSuccess(res, "Profile retrieved successfully.", { vendor: formatted });
	} catch (error) {
		console.error("[Vendor Auth] Profile fetch error:", error.message);
		return sendError(
			res,
			"An internal server error occurred while retrieving profile.",
			{},
			500,
		);
	}
}

/**
 * Handle vendor logout and clear secure cookies.
 */
async function logout(req, res) {
	try {
		clearAuthCookies(res);
		return sendSuccess(res, "Sign-out successful!", {}, 200);
	} catch (error) {
		console.error("[Vendor Auth] Logout error:", error.message);
		return sendError(
			res,
			"An internal server error occurred during sign-out.",
			{},
			500,
		);
	}
}

/**
 * Refresh access token using refresh token cookie.
 */
async function refresh(req, res) {
	try {
		const refreshCookieKey = getObfuscatedKey("refresh_token");
		const encryptedRefreshToken = req.cookies[refreshCookieKey];

		if (!encryptedRefreshToken) {
			return sendError(
				res,
				"Refresh token missing or session expired.",
				{},
				401,
			);
		}

		let refreshToken;
		try {
			refreshToken = decryptValue(encryptedRefreshToken);
		} catch (err) {
			console.warn(
				"[Vendor Auth] Failed to decrypt refresh token:",
				err.message,
			);
			return sendError(
				res,
				"Invalid refresh token cookie payload.",
				{},
				401,
			);
		}

		const JWT_REFRESH_SECRET =
			process.env.JWT_REFRESH_SECRET || JWT_SECRET + "_refresh";

		let decoded;
		try {
			decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
		} catch (err) {
			console.warn(
				"[Vendor Auth] Failed to verify refresh token JWT:",
				err.message,
			);
			return sendError(
				res,
				"Refresh token has expired or is invalid.",
				{},
				403,
			);
		}

		// Fetch vendor details to verify they still exist and status is approved
		const vendor = await Vendor.findByPk(decoded.id, {
			include: [{ model: BusinessDetail, as: "businessDetail" }],
		});
		if (!vendor) {
			return sendError(res, "Vendor profile not found.", {}, 404);
		}

		if (vendor.status !== "approved") {
			return sendError(res, "Vendor account is not active.", {}, 403);
		}

		// Generate new Access Token
		const tokenPayload = {
			id: vendor.id,
			email: vendor.email,
			role: "vendor",
			gstEnabled: vendor.businessDetail ? vendor.businessDetail.gst_enabled : true,
			gstRate: vendor.businessDetail ? vendor.businessDetail.gst_rate : 18,
		};

		const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "7d" });

		// Encrypt and set new Access Token cookie
		setAccessTokenCookie(res, token);

		return sendSuccess(
			res,
			"Token refreshed successfully!",
			{ token },
			200,
		);
	} catch (error) {
		console.error("[Vendor Auth] Token refresh error:", error.message);
		return sendError(
			res,
			"An internal server error occurred during token refresh.",
			{},
			500,
		);
	}
}

/**
 * Update vendor profile details.
 */
async function updateProfile(req, res) {
	try {
		const {
			name,
			email,
			phone,
			shop_name,
			address,
			payment_methods,
			profile_img,
		} = req.body;
		const vendorId = req.user.id;

		// Check if new email is in use by another vendor
		if (email) {
			const existingVendor = await Vendor.findOne({ where: { email } });
			if (existingVendor && existingVendor.id !== vendorId) {
				return sendError(
					res,
					"An account with this email address already exists.",
					{
						email: "An account with this email address already exists.",
					},
					409,
				);
			}
		}

		// Update vendor fields in DB
		const vendorFields = ["name", "email", "profile_img"];
		const vendorUpdates = {};
		for (const field of vendorFields) {
			if (req.body[field] !== undefined) {
				vendorUpdates[field] = req.body[field];
			}
		}

		if (Object.keys(vendorUpdates).length > 0) {
			await Vendor.update(vendorUpdates, { where: { id: vendorId } });
		}

		// Update business details fields in DB
		const businessFields = ["phone", "shop_name", "address", "payment_methods", "gst_enabled", "gst_rate"];
		const businessUpdates = {};
		for (const field of businessFields) {
			if (req.body[field] !== undefined) {
				businessUpdates[field] = req.body[field];
			}
		}

		if (Object.keys(businessUpdates).length > 0) {
			const existingDetail = await BusinessDetail.findOne({ where: { vendor_id: vendorId } });
			if (existingDetail) {
				await existingDetail.update(businessUpdates);
			} else {
				await BusinessDetail.create({
					vendor_id: vendorId,
					...businessUpdates
				});
			}
		}

		const updatedVendor = await Vendor.findByPk(vendorId, {
			include: [{ model: BusinessDetail, as: "businessDetail" }],
			attributes: { exclude: ["password"] },
		});

		// Re-generate JWTs (so details match) and set updated cookies
		const tokenPayload = {
			id: updatedVendor.id,
			email: updatedVendor.email,
			role: "vendor",
			gstEnabled: updatedVendor.businessDetail ? updatedVendor.businessDetail.gst_enabled : true,
			gstRate: updatedVendor.businessDetail ? updatedVendor.businessDetail.gst_rate : 18,
		};
		const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "7d" });
		const JWT_REFRESH_SECRET =
			process.env.JWT_REFRESH_SECRET || JWT_SECRET + "_refresh";
		const refreshToken = jwt.sign(
			{ id: updatedVendor.id },
			JWT_REFRESH_SECRET,
			{ expiresIn: "7d" },
		);

		const formattedVendor = updatedVendor.toJSON();
		if (formattedVendor.businessDetail) {
			formattedVendor.shop_name = formattedVendor.businessDetail.shop_name;
			formattedVendor.phone = formattedVendor.businessDetail.phone;
			formattedVendor.address = formattedVendor.businessDetail.address;
			formattedVendor.payment_methods = formattedVendor.businessDetail.payment_methods;
			formattedVendor.gst_enabled = formattedVendor.businessDetail.gst_enabled;
			formattedVendor.gst_rate = formattedVendor.businessDetail.gst_rate;
		}

		setAuthCookies(res, token, refreshToken, formattedVendor);

		return sendSuccess(res, "Profile updated successfully.", {
			vendor: formattedVendor,
		});
	} catch (error) {
		console.error("[Vendor Auth] Profile update error:", error.message);
		return sendError(
			res,
			"An internal server error occurred while updating profile.",
			{},
			500,
		);
	}
}

/**
 * Change vendor password.
 */
async function changePassword(req, res) {
	try {
		const { currentPassword, newPassword } = req.body;
		const vendorId = req.user.id;

		// Fetch vendor details with password hash
		const vendor = await Vendor.findByPk(vendorId);
		if (!vendor) {
			return sendError(res, "Vendor account not found.", {}, 404);
		}

		// Compare current password
		const isPasswordValid = await bcrypt.compare(
			currentPassword,
			vendor.password,
		);
		if (!isPasswordValid) {
			return sendError(
				res,
				"Invalid current password.",
				{
					currentPassword:
						"The current password you entered is incorrect.",
				},
				400,
			);
		}

		// Hash the new password (12 salt rounds)
		const saltRounds = 12;
		const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

		// Save updated password in DB
		await Vendor.update(
			{ password: hashedPassword },
			{ where: { id: vendorId } },
		);

		return sendSuccess(res, "Password changed successfully.", {});
	} catch (error) {
		console.error("[Vendor Auth] Password update error:", error.message);
		return sendError(
			res,
			"An internal server error occurred while changing password.",
			{},
			500,
		);
	}
}

module.exports = {
	register,
	login,
	logout,
	getProfile,
	refresh,
	updateProfile,
	changePassword,
	registerSchema,
	loginSchema,
	updateProfileSchema,
	changePasswordSchema,
};
