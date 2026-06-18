const { Transaction, Mobile, Customer, Brand, Model, Storage, Ram, Vendor } = require("../../models");
const { sendError } = require("../../utils/responseHelper");
const PDFDocument = require("pdfkit");

/**
 * Draw Code 39 Barcode using vector rectangles in PDFKit
 */
function drawCode39(doc, text, x, y, options = {}) {
	const { width = 0.45, height = 14 } = options;
	
	const code39Map = {
		'0': '000110100',
		'1': '100100001',
		'2': '001100001',
		'3': '101100000',
		'4': '000110001',
		'5': '100110000',
		'6': '001110000',
		'7': '000100101',
		'8': '100100100',
		'9': '001100100',
		'*': '010010100'
	};

	const cleanText = text.replace(/[^0-9A-Z\-.$/+%*]/gi, '').toUpperCase();
	const formattedText = `*${cleanText}*`;

	let currentX = x;
	doc.save();
	doc.fillColor("#000000");

	for (let i = 0; i < formattedText.length; i++) {
		const char = formattedText[i];
		const pattern = code39Map[char] || code39Map['*'];

		for (let j = 0; j < 9; j++) {
			const isBar = (j % 2 === 0);
			const isWide = (pattern[j] === '1');
			const elementWidth = isWide ? width * 2.5 : width;

			if (isBar) {
				doc.rect(currentX, y, elementWidth, height).fill();
			}
			currentX += elementWidth;
		}
		currentX += width; // Inter-character gap
	}
	doc.restore();
}

/**
 * Generate invoice PDF for a specific transaction and stream it back.
 */
async function getTransactionInvoice(req, res) {
	try {
		const vendorId = req.user.id;
		const { id } = req.params;

		const tx = await Transaction.findOne({
			where: { id, vendor_id: vendorId },
			include: [
				{
					model: Mobile,
					as: "mobile",
					include: [
						{ model: Brand, as: "brand", attributes: ["name"] },
						{ model: Model, as: "model", attributes: ["name"] },
						{ model: Storage, as: "storage", attributes: ["value"] },
						{ model: Ram, as: "ram", attributes: ["value"] },
					],
				},
				{
					model: Customer,
					as: "customer",
					attributes: ["name", "email", "phone", "address"],
				},
				{
					model: Vendor,
					as: "vendor",
					attributes: ["name", "email", "phone", "shop_name", "address"],
				},
			],
		});

		if (!tx) {
			return sendError(res, "Transaction not found.", {}, 404);
		}

		const doc = new PDFDocument({
			margin: 50,
			size: "A4",
			ownerPassword: process.env.PDF_OWNER_PASSWORD || "mobora_invoice_secure_owner_key_2026",
			permissions: {
				printing: "highResolution",
				modifying: false,
				copying: true,
				annotating: false,
				fillingForms: false,
				documentAssembly: false
			}
		});

		// Set headers
		res.setHeader("Content-Type", "application/pdf");
		res.setHeader(
			"Content-Disposition",
			`inline; filename="invoice-${tx.id}.pdf"`,
		);

		// Pipe PDF stream to res
		doc.pipe(res);

		// Colors
		const primaryColor = "#0284c7";
		const textColor = "#1f2937";
		const lightGray = "#f9fafb";
		const darkGray = "#4b5563";

		// Draw Header Banner
		doc.rect(0, 0, 595.28, 110).fill(primaryColor);
		
		const shopName = tx.vendor ? (tx.vendor.shop_name || tx.vendor.name) : "Mobora Store";
		const vendorPhone = tx.vendor ? (tx.vendor.phone || "N/A") : "N/A";
		const vendorEmail = tx.vendor ? tx.vendor.email : "N/A";
		const vendorAddress = tx.vendor ? (tx.vendor.address || "N/A") : "N/A";

		doc.fillColor("#ffffff")
			.fontSize(22)
			.font("Helvetica-Bold")
			.text(shopName.toUpperCase(), 50, 30);

		let docType = "INVOICE";
		if (tx.type === "Purchase") {
			docType = "PURCHASE RECEIPT";
		} else if (tx.type === "Exchange") {
			docType = "EXCHANGE RECEIPT";
		}

		doc.fontSize(13)
			.text(docType, 400, 35, { align: "right" });

		doc.fontSize(8.5)
			.font("Helvetica")
			.text(`Phone: ${vendorPhone}  |  Email: ${vendorEmail}`, 50, 65)
			.text(`Address: ${vendorAddress}`, 50, 78);

		doc.fillColor(textColor);
		let startY = 140;

		// Customer Section
		doc.fontSize(10).font("Helvetica-Bold").text("BILL TO / CLIENT", 50, startY);
		const custName = tx.customer ? tx.customer.name : "Walk-in Customer";
		const custPhone = tx.customer ? tx.customer.phone : "N/A";
		const custEmail = tx.customer ? (tx.customer.email || "N/A") : "N/A";
		const custAddress = tx.customer ? (tx.customer.address || "Store Walk-in Customer") : "N/A";

		doc.fontSize(9.5).font("Helvetica").text(custName, 50, startY + 16);
		doc.text(`Phone: ${custPhone}`, 50, startY + 29);
		doc.text(`Email: ${custEmail}`, 50, startY + 42);
		doc.text(`Address: ${custAddress}`, 50, startY + 55, { width: 220 });

		// Invoice details Section
		doc.fontSize(10).font("Helvetica-Bold").text("RECEIPT DETAILS", 350, startY);
		doc.fontSize(9.5).font("Helvetica")
			.text(`Receipt No: #INV-${tx.id.toString().padStart(5, "0")}`, 350, startY + 16)
			.text(`Date: ${tx.date}`, 350, startY + 29)
			.text(`Payment Status: Completed`, 350, startY + 42)
			.text(`Transaction Type: ${tx.type}`, 350, startY + 55);

		// Items Table
		startY = 240;
		doc.rect(50, startY, 495, 22).fill(primaryColor);
		doc.fillColor("#ffffff")
			.font("Helvetica-Bold")
			.fontSize(8.5)
			.text("ITEM DESCRIPTION & SPECS", 60, startY + 7)
			.text("IMEI", 260, startY + 7)
			.text("COND / BATT", 370, startY + 7)
			.text("AMOUNT", 480, startY + 7, { align: "right" });

		// Table Row
		const itemY = startY + 22;
		doc.rect(50, itemY, 495, 48).fill(lightGray);
		doc.fillColor(textColor).font("Helvetica-Bold").fontSize(8.5);

		const mobileData = tx.mobile;
		const brandName = mobileData && mobileData.brand ? mobileData.brand.name : "N/A";
		const modelName = mobileData && mobileData.model ? mobileData.model.name : "N/A";
		const storage = mobileData && mobileData.storage ? mobileData.storage.value : "N/A";
		const ram = mobileData && mobileData.ram ? mobileData.ram.value : "N/A";
		const color = mobileData ? mobileData.color : "N/A";
		const imei = mobileData ? mobileData.imei : "N/A";
		const condition = mobileData ? mobileData.condition : "N/A";
		const battery = mobileData ? `${mobileData.battery_health}%` : "N/A";

		const desc = `${brandName} ${modelName}\nSpecs: ${storage} / ${ram} | Color: ${color}`;
		
		doc.text(desc, 60, itemY + 8, { width: 190 });
		doc.font("Helvetica").fontSize(8).text(imei, 260, itemY + 8);
		
		if (imei && imei !== "N/A") {
			drawCode39(doc, imei, 260, itemY + 20, { width: 0.4, height: 16 });
		}
		
		doc.fontSize(8.5).text(`${condition} / BH: ${battery}`, 370, itemY + 15);
		
		doc.font("Helvetica-Bold")
			.text(`INR ${Number(tx.amount).toLocaleString("en-IN")}.00`, 450, itemY + 15, { align: "right", width: 85 });

		// Totals
		const totalY = itemY + 63;
		doc.strokeColor("#e5e7eb").lineWidth(1).moveTo(320, totalY).lineTo(545, totalY).stroke();

		doc.font("Helvetica-Bold").fontSize(9.5)
			.text("Subtotal:", 350, totalY + 8)
			.text(`INR ${Number(tx.amount).toLocaleString("en-IN")}.00`, 450, totalY + 8, { align: "right", width: 85 });

		doc.text("Total Amount:", 350, totalY + 22)
			.fillColor(primaryColor)
			.text(`INR ${Number(tx.amount).toLocaleString("en-IN")}.00`, 450, totalY + 22, { align: "right", width: 85 });

		// Notes & Terms
		const notesY = totalY + 60;
		doc.fillColor(textColor).font("Helvetica-Bold").fontSize(9.5).text("Notes:", 50, notesY);
		doc.font("Helvetica").fontSize(8.5).fillColor(darkGray)
			.text(tx.notes || "No extra notes recorded for this transaction.", 50, notesY + 13, { width: 495 });

		doc.font("Helvetica-Bold").fontSize(9.5).text("Terms & Conditions:", 50, notesY + 50);
		doc.font("Helvetica").fontSize(7.5).fillColor(darkGray)
			.text("1. This is a computer-generated document, no signature is required.", 50, notesY + 63)
			.text("2. Warranty is subject to store terms. All device sales/purchases are final.", 50, notesY + 72);

		// Footer
		doc.fontSize(8.5).fillColor("#9ca3af").text("Thank you for choosing Mobora!", 50, 750, { align: "center", width: 495 });

		doc.end();
	} catch (error) {
		console.error("[InvoiceController] getTransactionInvoice error:", error.message);
		return sendError(res, "Internal server error generating invoice PDF.", {}, 500);
	}
}

module.exports = {
	getTransactionInvoice,
};
