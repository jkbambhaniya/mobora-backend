const { ChatTemplate } = require("../../models");
const { sendSuccess, sendError } = require("../../utils/responseHelper");

/**
 * Get all templates for the logged-in vendor
 */
async function getTemplates(req, res) {
	try {
		const vendorId = req.user.id;
		const templates = await ChatTemplate.findAll({
			where: { vendor_id: vendorId },
			order: [["created_at", "DESC"]],
		});

		return sendSuccess(res, "Chat templates retrieved successfully.", { templates });
	} catch (error) {
		console.error("[ChatTemplateController] getTemplates error:", error.message);
		return sendError(res, "Internal server error retrieving templates.", {}, 500);
	}
}

/**
 * Create a new chat template
 */
async function createTemplate(req, res) {
	try {
		const vendorId = req.user.id;
		const { template_text } = req.body;

		if (!template_text || !template_text.trim()) {
			return sendError(res, "Template text is required.", { template_text: "Text is required." }, 400);
		}

		// Enforce maximum 5 templates limit
		const count = await ChatTemplate.count({ where: { vendor_id: vendorId } });
		if (count >= 5) {
			return sendError(res, "You can add a maximum of 5 templates only.", {}, 400);
		}

		const template = await ChatTemplate.create({
			vendor_id: vendorId,
			template_text: template_text.trim()
		});

		return sendSuccess(res, "Chat template created successfully.", { template }, 201);
	} catch (error) {
		console.error("[ChatTemplateController] createTemplate error:", error.message);
		return sendError(res, "Internal server error creating template.", {}, 500);
	}
}

/**
 * Update an existing chat template
 */
async function updateTemplate(req, res) {
	try {
		const vendorId = req.user.id;
		const { id } = req.params;
		const { template_text } = req.body;

		if (!template_text || !template_text.trim()) {
			return sendError(res, "Template text is required.", { template_text: "Text is required." }, 400);
		}

		const template = await ChatTemplate.findOne({
			where: { id, vendor_id: vendorId }
		});

		if (!template) {
			return sendError(res, "Template not found or access denied.", {}, 404);
		}

		template.template_text = template_text.trim();
		await template.save();

		return sendSuccess(res, "Chat template updated successfully.", { template });
	} catch (error) {
		console.error("[ChatTemplateController] updateTemplate error:", error.message);
		return sendError(res, "Internal server error updating template.", {}, 500);
	}
}

/**
 * Delete a chat template
 */
async function deleteTemplate(req, res) {
	try {
		const vendorId = req.user.id;
		const { id } = req.params;

		const template = await ChatTemplate.findOne({
			where: { id, vendor_id: vendorId }
		});

		if (!template) {
			return sendError(res, "Template not found or access denied.", {}, 404);
		}

		await template.destroy();

		return sendSuccess(res, "Chat template deleted successfully.", { id });
	} catch (error) {
		console.error("[ChatTemplateController] deleteTemplate error:", error.message);
		return sendError(res, "Internal server error deleting template.", {}, 500);
	}
}

module.exports = {
	getTemplates,
	createTemplate,
	updateTemplate,
	deleteTemplate
};
