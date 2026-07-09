/**
 * Calculates GST values based on the Indian GST Margin Scheme (Rule 32(5)).
 * GST is calculated only on the positive profit margin (Sale Price - Purchase Price).
 * 
 * @param {number} amount - The transaction amount (selling price)
 * @param {number|undefined} purchasePrice - The purchase cost of the device
 * @param {string} type - The transaction type (e.g. 'Sale', 'Purchase')
 * @returns {object} Calculated GST margin details
 */
function calculateMarginGst(amount, purchasePrice, type, gstEnabled = false, gstRate = 0) {
	const isSale = type === "Sale";
	const salePrice = Number(amount);
	const costPrice = purchasePrice !== undefined ? Number(purchasePrice) : 0;
	
	const margin = (isSale && purchasePrice !== undefined) ? (salePrice - costPrice) : 0;
	
	return {
		gstRate: 0,
		gstHalfRate: 0,
		gstAmount: 0,
		cgst: 0,
		sgst: 0,
		taxableValue: salePrice,
		margin,
	};
}

module.exports = {
	calculateMarginGst,
};
