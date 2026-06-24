const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Admin } = require("../../models");
const { sendSuccess, sendError } = require("../../utils/responseHelper");
const {
	getObfuscatedKey,
	decryptValue,
	setAuthCookies,
	clearAuthCookies,
} = require("../../utils/cryptoHelper");
require("dotenv").config();

const JWT_SECRET =
	process.env.JWT_SECRET ||
	"super_secret_jwt_key_please_change_in_production";

const yup = require('yup');
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

/**
 * Handle admin login request.
 */
async function login(req, res) {
	try {
		const { email, password } = req.body;
		const trimmedEmail = email.trim().toLowerCase();

		const admin = await Admin.findOne({
			where: { email: trimmedEmail }
		});
		if (!admin) {
			return sendError(res, "Invalid email or password.", {}, 401);
		}

		const isPasswordValid = await bcrypt.compare(password, admin.password);
		if (!isPasswordValid) {
			return sendError(res, "Invalid email or password.", {}, 401);
		}

		// Issue JWT access token (15 mins) and refresh token (7 days)
		// We add role: 'admin' to the payload to satisfy requireRole('admin') middleware
		const tokenPayload = {
			id: admin.id,
			email: admin.email,
			role: "admin",
		};

		const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "15m" });

		const JWT_REFRESH_SECRET =
			process.env.JWT_REFRESH_SECRET || JWT_SECRET + "_refresh";
		const refreshToken = jwt.sign({ id: admin.id, role: "admin" }, JWT_REFRESH_SECRET, {
			expiresIn: "7d",
		});

		const adminDetails = {
			id: admin.id,
			name: admin.name,
			email: admin.email,
			role: "admin",
			profile_img: admin.profile_img,
		};

		setAuthCookies(res, token, refreshToken, adminDetails);

		return sendSuccess(
			res,
			"Admin sign-in successful!",
			{
				token,
				admin: adminDetails,
			},
			200,
		);
	} catch (error) {
		console.error("[Admin Auth] Login error:", error.message);
		return sendError(
			res,
			"An internal server error occurred during admin login.",
			{},
			500,
		);
	}
}

/**
 * Retrieve current authenticated admin details.
 */
async function getProfile(req, res) {
	try {
		const admin = await Admin.findByPk(req.user.id, {
			attributes: { exclude: ["password"] },
		});

		if (!admin) {
			return sendError(res, "Admin profile not found.", {}, 404);
		}

		const adminDetails = {
			id: admin.id,
			name: admin.name,
			email: admin.email,
			role: "admin",
			profile_img: admin.profile_img
		};

		return sendSuccess(res, "Admin profile retrieved successfully.", { admin: adminDetails });
	} catch (error) {
		console.error("[Admin Auth] Profile fetch error:", error.message);
		return sendError(
			res,
			"An internal server error occurred while retrieving admin profile.",
			{},
			500,
		);
	}
}

/**
 * Handle admin logout.
 */
async function logout(req, res) {
	try {
		clearAuthCookies(res);
		return sendSuccess(res, "Admin sign-out successful!", {}, 200);
	} catch (error) {
		console.error("[Admin Auth] Logout error:", error.message);
		return sendError(
			res,
			"An internal server error occurred during admin sign-out.",
			{},
			500,
		);
	}
}

/**
 * Refresh admin access token using refresh token cookie.
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
				"[Admin Auth] Failed to decrypt refresh token:",
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
				"[Admin Auth] Failed to verify refresh token JWT:",
				err.message,
			);
			return sendError(
				res,
				"Refresh token has expired or is invalid.",
				{},
				403,
			);
		}

		// Ensure the token represents an admin
		if (decoded.role !== "admin") {
			return sendError(res, "Access Denied: Invalid role.", {}, 403);
		}

		const admin = await Admin.findByPk(decoded.id);
		if (!admin) {
			return sendError(res, "Admin profile not found.", {}, 404);
		}

		// Generate new Access Token
		const tokenPayload = {
			id: admin.id,
			email: admin.email,
			role: "admin",
		};

		const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "15m" });

		const adminDetails = {
			id: admin.id,
			name: admin.name,
			email: admin.email,
			role: "admin",
			profile_img: admin.profile_img,
		};

		// Reuse old refresh token for simple rotation or generate new one. Let's keep it simple.
		setAuthCookies(res, token, encryptedRefreshToken, adminDetails);

		return sendSuccess(res, "Access token successfully refreshed.", {
			token,
			admin: adminDetails,
		});
	} catch (error) {
		console.error("[Admin Auth] Refresh error:", error.message);
		return sendError(
			res,
			"An internal server error occurred while refreshing authentication session.",
			{},
			500,
		);
	}
}

async function updateProfile(req, res) {
	try {
		const { name, email, profile_img } = req.body;
		const adminId = req.user.id;

		if (email) {
			const existingAdmin = await Admin.findOne({ where: { email } });
			if (existingAdmin && existingAdmin.id !== adminId) {
				return sendError(
					res,
					"An account with this email address already exists.",
					{ email: "An account with this email address already exists." },
					409
				);
			}
		}

		const updates = {};
		if (name !== undefined) updates.name = name;
		if (email !== undefined) updates.email = email;
		if (profile_img !== undefined) updates.profile_img = profile_img;

		if (Object.keys(updates).length > 0) {
			await Admin.update(updates, { where: { id: adminId } });
		}

		const updatedAdmin = await Admin.findByPk(adminId, {
			attributes: { exclude: ["password"] }
		});

		const tokenPayload = {
			id: updatedAdmin.id,
			email: updatedAdmin.email,
			role: "admin",
		};
		const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "15m" });
		const JWT_REFRESH_SECRET =
			process.env.JWT_REFRESH_SECRET || JWT_SECRET + "_refresh";
		const refreshToken = jwt.sign(
			{ id: updatedAdmin.id, role: "admin" },
			JWT_REFRESH_SECRET,
			{ expiresIn: "7d" }
		);

		const adminDetails = {
			id: updatedAdmin.id,
			name: updatedAdmin.name,
			email: updatedAdmin.email,
			role: "admin",
			profile_img: updatedAdmin.profile_img,
		};

		setAuthCookies(res, token, refreshToken, adminDetails);

		return sendSuccess(res, "Profile updated successfully.", {
			admin: adminDetails,
		});
	} catch (error) {
		console.error("[Admin Auth] Profile update error:", error.message);
		return sendError(
			res,
			"An internal server error occurred while updating admin profile.",
			{},
			500
		);
	}
}

async function changePassword(req, res) {
	try {
		const { currentPassword, newPassword } = req.body;
		const adminId = req.user.id;

		const admin = await Admin.findByPk(adminId);
		if (!admin) {
			return sendError(res, "Admin account not found.", {}, 404);
		}

		const isPasswordValid = await bcrypt.compare(currentPassword, admin.password);
		if (!isPasswordValid) {
			return sendError(
				res,
				"Invalid current password.",
				{ currentPassword: "The current password you entered is incorrect." },
				400
			);
		}

		const saltRounds = 12;
		const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

		await Admin.update(
			{ password: hashedPassword },
			{ where: { id: adminId } }
		);

		return sendSuccess(res, "Password changed successfully.", {});
	} catch (error) {
		console.error("[Admin Auth] Password update error:", error.message);
		return sendError(
			res,
			"An internal server error occurred while changing password.",
			{},
			500
		);
	}
}

const updateProfileSchema = yup.object().shape({
	name: yup.string().trim().required('Name is required.'),
	email: yup
		.string()
		.trim()
		.required('Email is required.')
		.email('Please enter a valid email address.'),
	profile_img: yup.string().nullable().optional()
});

const changePasswordSchema = yup.object().shape({
	currentPassword: yup.string().required('Current password is required.'),
	newPassword: yup
		.string()
		.required('New password is required.')
		.min(6, 'New password must be at least 6 characters long.')
});

module.exports = {
	login,
	logout,
	refresh,
	getProfile,
	updateProfile,
	changePassword,
	loginSchema,
	updateProfileSchema,
	changePasswordSchema
};
