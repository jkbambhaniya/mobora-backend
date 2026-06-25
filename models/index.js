const { sequelize } = require('../config/db');
const VendorModel = require('./Vendor');
const CustomerModel = require('./Customer');
const BrandModel = require('./Brand');
const ModelModel = require('./Model');
const StorageModel = require('./Storage');
const RamModel = require('./Ram');
const ChatSessionModel = require('./ChatSession');
const MessageModel = require('./Message');
const NotificationModel = require('./Notification');
const MobileModel = require('./Mobile');
const TransactionModel = require('./Transaction');
const RepairModel = require('./Repair');
const BusinessDetailModel = require('./BusinessDetail');
const AdminModel = require('./Admin');
const BlacklistedMobileModel = require('./BlacklistedMobile');
const DeviceRequirementModel = require('./DeviceRequirement');

const Vendor = VendorModel(sequelize);
const Customer = CustomerModel(sequelize);
const Brand = BrandModel(sequelize);
const Model = ModelModel(sequelize);
const Storage = StorageModel(sequelize);
const Ram = RamModel(sequelize);
const ChatSession = ChatSessionModel(sequelize);
const Message = MessageModel(sequelize);
const Notification = NotificationModel(sequelize);
const Mobile = MobileModel(sequelize);
const Transaction = TransactionModel(sequelize);
const Repair = RepairModel(sequelize);
const BusinessDetail = BusinessDetailModel(sequelize);
const Admin = AdminModel(sequelize);
const BlacklistedMobile = BlacklistedMobileModel(sequelize);
const DeviceRequirement = DeviceRequirementModel(sequelize);

// Define associations
Vendor.hasOne(BusinessDetail, { foreignKey: 'vendor_id', as: 'businessDetail', onDelete: 'CASCADE' });
BusinessDetail.belongsTo(Vendor, { foreignKey: 'vendor_id', as: 'vendor' });

Vendor.hasMany(Repair, { foreignKey: 'vendor_id', as: 'repairs', onDelete: 'CASCADE' });
Repair.belongsTo(Vendor, { foreignKey: 'vendor_id', as: 'vendor' });
Vendor.hasMany(Customer, { foreignKey: 'vendor_id', as: 'customers', onDelete: 'CASCADE' });
Customer.belongsTo(Vendor, { foreignKey: 'vendor_id', as: 'vendor' });

Vendor.hasMany(ChatSession, { foreignKey: 'vendor_id', as: 'chatSessions', onDelete: 'CASCADE' });
ChatSession.belongsTo(Vendor, { foreignKey: 'vendor_id', as: 'vendor' });

Vendor.hasMany(ChatSession, { foreignKey: 'recipient_vendor_id', as: 'receivedChatSessions', onDelete: 'SET NULL' });
ChatSession.belongsTo(Vendor, { foreignKey: 'recipient_vendor_id', as: 'recipientVendor' });

ChatSession.hasMany(Message, { foreignKey: 'chat_id', sourceKey: 'chat_id', as: 'messages', onDelete: 'CASCADE' });
Message.belongsTo(ChatSession, { foreignKey: 'chat_id', targetKey: 'chat_id', as: 'chatSession' });

Vendor.hasMany(Notification, { foreignKey: 'vendor_id', as: 'notifications', onDelete: 'CASCADE' });
Notification.belongsTo(Vendor, { foreignKey: 'vendor_id', as: 'vendor' });

Vendor.hasMany(BlacklistedMobile, { foreignKey: 'vendor_id', as: 'blacklistedMobiles', onDelete: 'CASCADE' });
BlacklistedMobile.belongsTo(Vendor, { foreignKey: 'vendor_id', as: 'vendor' });

Vendor.hasMany(DeviceRequirement, { foreignKey: 'vendor_id', as: 'deviceRequirements', onDelete: 'CASCADE' });
DeviceRequirement.belongsTo(Vendor, { foreignKey: 'vendor_id', as: 'vendor' });

Brand.hasMany(DeviceRequirement, { foreignKey: 'brand_id', as: 'deviceRequirements', onDelete: 'RESTRICT' });
DeviceRequirement.belongsTo(Brand, { foreignKey: 'brand_id', as: 'brand' });

Model.hasMany(DeviceRequirement, { foreignKey: 'model_id', as: 'deviceRequirements', onDelete: 'RESTRICT' });
DeviceRequirement.belongsTo(Model, { foreignKey: 'model_id', as: 'model' });

Storage.hasMany(DeviceRequirement, { foreignKey: 'storage_id', as: 'deviceRequirements', onDelete: 'RESTRICT' });
DeviceRequirement.belongsTo(Storage, { foreignKey: 'storage_id', as: 'storage' });

Ram.hasMany(DeviceRequirement, { foreignKey: 'ram_id', as: 'deviceRequirements', onDelete: 'RESTRICT' });
DeviceRequirement.belongsTo(Ram, { foreignKey: 'ram_id', as: 'ram' });

Brand.hasMany(Model, { foreignKey: 'brand_id', as: 'models', onDelete: 'CASCADE' });
Model.belongsTo(Brand, { foreignKey: 'brand_id', as: 'brand' });

Vendor.hasMany(Model, { foreignKey: 'vendor_id', as: 'models', onDelete: 'CASCADE' });
Model.belongsTo(Vendor, { foreignKey: 'vendor_id', as: 'vendor' });

// Mobile associations
Vendor.hasMany(Mobile, { foreignKey: 'vendor_id', as: 'mobiles', onDelete: 'CASCADE' });
Mobile.belongsTo(Vendor, { foreignKey: 'vendor_id', as: 'vendor' });

Brand.hasMany(Mobile, { foreignKey: 'brand_id', as: 'mobiles', onDelete: 'RESTRICT' });
Mobile.belongsTo(Brand, { foreignKey: 'brand_id', as: 'brand' });

Model.hasMany(Mobile, { foreignKey: 'model_id', as: 'mobiles', onDelete: 'RESTRICT' });
Mobile.belongsTo(Model, { foreignKey: 'model_id', as: 'model' });

Storage.hasMany(Mobile, { foreignKey: 'storage_id', as: 'mobiles', onDelete: 'RESTRICT' });
Mobile.belongsTo(Storage, { foreignKey: 'storage_id', as: 'storage' });

Ram.hasMany(Mobile, { foreignKey: 'ram_id', as: 'mobiles', onDelete: 'RESTRICT' });
Mobile.belongsTo(Ram, { foreignKey: 'ram_id', as: 'ram' });

// Transaction associations
Vendor.hasMany(Transaction, { foreignKey: 'vendor_id', as: 'transactions', onDelete: 'CASCADE' });
Transaction.belongsTo(Vendor, { foreignKey: 'vendor_id', as: 'vendor' });

// Polymorphic Partner associations
Customer.hasMany(Transaction, { foreignKey: 'partner_id', constraints: false, scope: { partner_type: 'Customer' }, as: 'transactions' });
Transaction.belongsTo(Customer, { foreignKey: 'partner_id', constraints: false, as: 'customer' });

Vendor.hasMany(Transaction, { foreignKey: 'partner_id', constraints: false, scope: { partner_type: 'Vendor' }, as: 'partnerTransactions' });
Transaction.belongsTo(Vendor, { foreignKey: 'partner_id', constraints: false, as: 'partnerVendor' });

Mobile.hasMany(Transaction, { foreignKey: 'mobile_id', as: 'transactions', onDelete: 'CASCADE' });
Transaction.belongsTo(Mobile, { foreignKey: 'mobile_id', as: 'mobile' });

module.exports = {
	sequelize,
	Vendor,
	Customer,
	Brand,
	Model,
	Storage,
	Ram,
	ChatSession,
	Message,
	Notification,
	Mobile,
	Transaction,
	Repair,
	BusinessDetail,
	Admin,
	BlacklistedMobile,
	DeviceRequirement
};
