const yup = require("yup");

/**
 * Yup schema for Brand validation.
 */
const brandSchema = yup.object().shape({
	name: yup
		.string()
		.trim()
		.required("Brand name is required.")
		.max(255, "Brand name cannot exceed 255 characters."),
});

/**
 * Yup schema for Model validation.
 */
const createModelSchema = yup.object().shape({
	name: yup
		.string()
		.trim()
		.required("Model name is required.")
		.max(255, "Model name cannot exceed 255 characters."),
	brand_id: yup
		.number()
		.integer("Brand ID must be an integer.")
		.required("Brand is required.")
		.positive("Invalid Brand ID."),
});

const updateModelSchema = yup.object().shape({
	name: yup
		.string()
		.trim()
		.nullable()
		.notRequired()
		.max(255, "Model name cannot exceed 255 characters."),
	brand_id: yup
		.number()
		.integer("Brand ID must be an integer.")
		.nullable()
		.notRequired()
		.positive("Invalid Brand ID."),
});

/**
 * Yup schema for Storage option validation.
 */
const storageSchema = yup.object().shape({
	value: yup
		.string()
		.trim()
		.required("Storage capacity value is required.")
		.max(100, "Storage value cannot exceed 100 characters."),
});

/**
 * Yup schema for RAM option validation.
 */
const ramSchema = yup.object().shape({
	value: yup
		.string()
		.trim()
		.required("RAM capacity value is required.")
		.max(100, "RAM value cannot exceed 100 characters."),
});

module.exports = {
	brandSchema,
	createModelSchema,
	updateModelSchema,
	storageSchema,
	ramSchema,
};
