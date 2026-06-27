const yup = require("yup");

const createMobileSchema = yup.object().shape({
	brand_id: yup
		.number()
		.integer("Brand ID must be an integer.")
		.required("Brand is required.")
		.positive("Invalid Brand ID."),
	model_id: yup
		.number()
		.integer("Model ID must be an integer.")
		.required("Model is required.")
		.positive("Invalid Model ID."),
	storage_id: yup
		.number()
		.integer("Storage ID must be an integer.")
		.required("Storage capacity is required.")
		.positive("Invalid Storage ID."),
	ram_id: yup
		.number()
		.integer("RAM ID must be an integer.")
		.required("RAM size is required.")
		.positive("Invalid RAM ID."),
	color: yup
		.string()
		.trim()
		.required("Color is required.")
		.max(100, "Color cannot exceed 100 characters."),
	imei: yup
		.string()
		.trim()
		.nullable()
		.notRequired()
		.test(
			"is-15-digits",
			"IMEI must be exactly 15 digits.",
			(value) => !value || /^\d{15}$/.test(value),
		),
	condition: yup
		.string()
		.oneOf(["NEW", "OLD"], "Condition must be NEW or OLD.")
		.required("Condition is required."),
	price: yup
		.number()
		.typeError("Selling price must be a number.")
		.positive("Selling price must be a positive number.")
		.nullable()
		.notRequired(),
	purchase_price: yup
		.number()
		.typeError("Cost price must be a number.")
		.positive("Cost price must be a positive number.")
		.nullable()
		.notRequired(),
	battery_health: yup
		.number()
		.typeError("Battery health must be a number.")
		.integer("Battery health must be an integer.")
		.min(50, "Battery health must be at least 50%.")
		.max(100, "Battery health cannot exceed 100%.")
		.nullable()
		.notRequired(),
	status: yup
		.string()
		.oneOf(["Available", "Sold", "Review"], "Status must be Available, Sold, or Review.")
		.default("Available"),
	description: yup
		.string()
		.trim()
		.nullable()
		.notRequired(),
	customer_id: yup
		.mixed()
		.nullable()
		.notRequired(),
	repairing_cost: yup
		.number()
		.typeError("Repairing cost must be a number.")
		.min(0, "Repairing cost cannot be negative.")
		.nullable()
		.notRequired(),
});

const updateMobileSchema = yup.object().shape({
	customer_id: yup
		.mixed()
		.nullable()
		.notRequired(),
	brand_id: yup
		.number()
		.integer()
		.positive()
		.nullable()
		.notRequired(),
	model_id: yup
		.number()
		.integer()
		.positive()
		.nullable()
		.notRequired(),
	storage_id: yup
		.number()
		.integer()
		.positive()
		.nullable()
		.notRequired(),
	ram_id: yup
		.number()
		.integer()
		.positive()
		.nullable()
		.notRequired(),
	color: yup
		.string()
		.trim()
		.max(100)
		.nullable()
		.notRequired(),
	imei: yup
		.string()
		.trim()
		.nullable()
		.notRequired()
		.test(
			"is-15-digits",
			"IMEI must be exactly 15 digits.",
			(value) => !value || /^\d{15}$/.test(value),
		),
	condition: yup
		.string()
		.oneOf(["NEW", "OLD"])
		.nullable()
		.notRequired(),
	price: yup
		.number()
		.positive()
		.nullable()
		.notRequired(),
	purchase_price: yup
		.number()
		.positive()
		.nullable()
		.notRequired(),
	battery_health: yup
		.number()
		.integer()
		.min(50)
		.max(100)
		.nullable()
		.notRequired(),
	status: yup
		.string()
		.oneOf(["Available", "Sold", "Review"])
		.nullable()
		.notRequired(),
	description: yup
		.string()
		.trim()
		.nullable()
		.notRequired(),
	repairing_cost: yup
		.number()
		.typeError("Repairing cost must be a number.")
		.min(0, "Repairing cost cannot be negative.")
		.nullable()
		.notRequired(),
});

module.exports = {
	createMobileSchema,
	updateMobileSchema,
};
