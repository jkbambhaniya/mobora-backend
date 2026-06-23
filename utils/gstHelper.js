/**
 * Calculates GST values based on the Indian GST Margin Scheme (Rule 32(5)).
 * GST is calculated only on the positive profit margin (Sale Price - Purchase Price).
 * 
 * @param {number} amount - The transaction amount (selling price)
 * @param {number|undefined} purchasePrice - The purchase cost of the device
 * @param {string} type - The transaction type (e.g. 'Sale', 'Purchase')
 * @returns {object} Calculated GST margin details
 */
function calculateMarginGst(amount, purchasePrice, type, gstEnabled = true, gstRate = 18) {
	const isSale = type === "Sale";
	const salePrice = Number(amount);
	const costPrice = purchasePrice !== undefined ? Number(purchasePrice) : 0;
	
	const margin = (isSale && purchasePrice !== undefined) ? (salePrice - costPrice) : 0;
	const hasProfit = margin > 0;
	
	const gstHalfRate = gstRate / 2;
	
	const gstAmount = (gstEnabled && hasProfit) ? Math.round(margin - (margin / (1 + (gstRate / 100)))) : 0;
	const cgst = Math.round(gstAmount / 2);
	const sgst = gstAmount - cgst;
	const taxableValue = salePrice - gstAmount;

	return {
		gstRate,
		gstHalfRate,
		gstAmount,
		cgst,
		sgst,
		taxableValue,
		margin,
	};
}

module.exports = {
	calculateMarginGst,
};
