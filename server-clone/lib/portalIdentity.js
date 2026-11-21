const mongoose = require('mongoose');
const Member = require('../models/Member');
const PurchaseFarmer = require('../models/PurchaseFarmer');
const Farmer = require('../models/Farmer');
const User = require('../models/User');
const PrintSettings = require('../models/PrintSettings');
const { normalizeIndianMobile } = require('./ninzaSms');
const { portalEligibleOwnerIds } = require('./portal-feature-access');

/**
 * Farmer / Customer portal identity resolution.
 *
 * This module is READ-ONLY. It finds every selling customer (Member) and
 * collection farmer (PurchaseFarmer / Farmer) whose registered mobile number
 * matches the verified phone, and groups them by dairy owner so no other
 * owner's records can leak into a portal response.
 */

const toId = (value) => {
    if (!value) return '';
    try {
        return String(value);
    } catch {
        return '';
    }
};

const mobileTail = (value) => String(value || '').replace(/\D/g, '').slice(-10);

const isMobileMatch = (mobile, phone) => {
    const normalized = normalizeIndianMobile(mobile);
    return normalized.ok && normalized.tenDigit === phone;
};

const escapeRegExp = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizePhone = (input) => {
    const normalized = normalizeIndianMobile(input);
    if (!normalized.ok) throw new Error(normalized.error || 'Invalid mobile number');
    return normalized.tenDigit;
};

const phoneVariants = (phone) => [
    phone,
    `0${phone}`,
    `91${phone}`,
    `+91${phone}`,
    `+91 ${phone}`,
    `+91-${phone}`,
];

const mobileQuery = (phone) => ({
    $or: [
        { mobile: { $in: phoneVariants(phone) } },
        // Legacy mobiles can contain separators between digits, not just before
        // the number. The strict normalization check below validates candidates.
        { mobile: { $regex: `${phone.split('').join('[^0-9]*')}[^0-9]*$` } },
    ],
});

const activeMobileQuery = (phone) => ({
    ...mobileQuery(phone),
    isActive: { $ne: false },
});

const shortCode = (prefix, id) => `${prefix}${toId(id).slice(-4).toUpperCase() || '0000'}`;

const uniquePush = (array, value) => {
    const id = toId(value);
    if (id && !array.includes(id)) array.push(id);
};

async function findPortalProfiles(rawPhone) {
    const phone = normalizePhone(rawPhone);
    const query = activeMobileQuery(phone);

    const [memberCandidates, purchaseFarmerCandidates, farmerCandidates] = await Promise.all([
        Member.find(query).lean(),
        PurchaseFarmer.find(query).lean(),
        Farmer.find(query).lean(),
    ]);

    // Only accepted Indian mobile formats can match; an arbitrary longer
    // number ending in the same digits must never link another profile.
    const members = memberCandidates.filter((doc) => isMobileMatch(doc.mobile, phone));
    const purchaseFarmers = purchaseFarmerCandidates.filter((doc) => isMobileMatch(doc.mobile, phone));
    const farmers = farmerCandidates.filter((doc) => isMobileMatch(doc.mobile, phone));

    // Selling profiles are grouped by owner. Multiple Member docs with the same
    // phone under one owner are kept in the same scoped link.
    const sellingMap = new Map();
    for (const member of members) {
        const owner = toId(member.owner);
        const memberId = toId(member._id);
        if (!owner || !memberId) continue;
        const key = owner;
        const existing = sellingMap.get(key) || {
            owner,
            memberIds: [],
            memberDocs: [],
            name: member.name || 'Customer',
            mobile: member.mobile || phone,
            address: member.address || '',
            code: member.code || shortCode('C', memberId),
            dairyName: '',
        };
        uniquePush(existing.memberIds, memberId);
        existing.memberDocs.push(member);
        sellingMap.set(key, existing);
    }

    // Collection data is split across two legacy farmer models:
    // - MilkCollection usually points to PurchaseFarmer (or farmerCode)
    // - Advance / Payment usually points to Farmer
    // Group by owner + code and keep both ID sets in one link.
    const collectionMap = new Map();
    const addCollectionDoc = (doc, source) => {
        const owner = toId(doc.owner);
        const id = toId(doc._id);
        if (!owner || !id) return;
        const code = String(doc.code || '').trim() || shortCode('F', id);
        const key = `${owner}|${code.toLowerCase()}`;
        const existing = collectionMap.get(key) || {
            owner,
            code,
            name: doc.name || 'Farmer',
            mobile: doc.mobile || phone,
            address: doc.address || '',
            farmerIds: [],
            purchaseFarmerIds: [],
            allProfileIds: [],
            farmerDocs: [],
            purchaseFarmerDocs: [],
            dairyName: '',
        };
        if (source === 'farmer') {
            uniquePush(existing.farmerIds, id);
            existing.farmerDocs.push(doc);
        } else {
            uniquePush(existing.purchaseFarmerIds, id);
            existing.purchaseFarmerDocs.push(doc);
        }
        uniquePush(existing.allProfileIds, id);
        collectionMap.set(key, existing);
    };

    for (const doc of purchaseFarmers) addCollectionDoc(doc, 'purchase_farmer');
    for (const doc of farmers) addCollectionDoc(doc, 'farmer');

    // A mobile may be stored on only one of the two farmer models. Pull the
    // matching code companion so portal entries, advances and payments all line up.
    const ownerCodeOr = Array.from(collectionMap.values()).map((link) => ({
        owner: link.owner,
        code: { $regex: `^${escapeRegExp(link.code)}$`, $options: 'i' },
    }));

    if (ownerCodeOr.length) {
        const [companionFarmers, companionPurchaseFarmers] = await Promise.all([
            Farmer.find({ $or: ownerCodeOr, isActive: { $ne: false } }).lean(),
            PurchaseFarmer.find({ $or: ownerCodeOr, isActive: { $ne: false } }).lean(),
        ]);

        for (const doc of companionFarmers) {
            const owner = toId(doc.owner);
            const code = String(doc.code || '').trim();
            const link = collectionMap.get(`${owner}|${code.toLowerCase()}`);
            if (link) addCollectionDoc(doc, 'farmer');
        }
        for (const doc of companionPurchaseFarmers) {
            const owner = toId(doc.owner);
            const code = String(doc.code || '').trim();
            const link = collectionMap.get(`${owner}|${code.toLowerCase()}`);
            if (link) addCollectionDoc(doc, 'purchase_farmer');
        }
    }

    const ownerIds = Array.from(new Set([
        ...Array.from(sellingMap.values()).map((link) => link.owner),
        ...Array.from(collectionMap.values()).map((link) => link.owner),
    ].filter((id) => mongoose.isValidObjectId(id))));

    // Fetch only settings belonging to already verified linked owners. Keep the
    // existing owner-name mapping for record labels and filters; Linked by is
    // a separate display value sourced from the owner's receipt settings.
    const users = ownerIds.length ? await User.find({ _id: { $in: ownerIds } }).select('name subscriptionFeatureVersion').lean() : [];
    const eligible = await portalEligibleOwnerIds(users);
    const eligibleOwnerIds = ownerIds.filter(id => eligible.has(id));
    const settings = eligibleOwnerIds.length
        ? await PrintSettings.find({ owner: { $in: eligibleOwnerIds } }).select('owner dairyName').lean()
        : [];
    const ownerNames = {};
    for (const user of users) if (eligible.has(toId(user._id))) ownerNames[toId(user._id)] = user.name || 'Dairy';
    const linkedDairyNames = {};
    for (const ownerId of eligibleOwnerIds) linkedDairyNames[ownerId] = ownerNames[ownerId] || 'Dairy';
    for (const setting of settings) {
        const ownerId = toId(setting.owner);
        const name = typeof setting.dairyName === 'string' ? setting.dairyName.trim() : '';
        if (Object.prototype.hasOwnProperty.call(linkedDairyNames, ownerId) && name) linkedDairyNames[ownerId] = name;
    }

    const sellingLinks = Array.from(sellingMap.values()).filter(link => eligible.has(link.owner)).map((link) => ({
        ...link,
        dairyName: ownerNames[link.owner] || 'Dairy',
        linkedDairyName: linkedDairyNames[link.owner] || ownerNames[link.owner] || 'Dairy',
    }));
    const collectionLinks = Array.from(collectionMap.values()).filter(link => eligible.has(link.owner)).map((link) => ({
        ...link,
        dairyName: ownerNames[link.owner] || 'Dairy',
        linkedDairyName: linkedDairyNames[link.owner] || ownerNames[link.owner] || 'Dairy',
    }));

    const firstSelling = sellingLinks[0];
    const firstCollection = collectionLinks[0];
    const profile = firstCollection || firstSelling || null;
    const dairyNames = Array.from(new Set(Object.values(ownerNames).filter(Boolean)));

    return {
        phone,
        ownerNames,
        dairyNames,
        sellingLinks,
        collectionLinks,
        availableModules: {
            collection: collectionLinks.length > 0,
            selling: sellingLinks.length > 0,
        },
        profile: profile ? {
            name: profile.name || 'Farmer / Customer',
            mobile: profile.mobile || phone,
            address: profile.address || '',
            code: profile.code || '',
            dairyName: profile.dairyName || dairyNames[0] || 'Dairy',
        } : null,
    };
}

function publicPortalIdentity(identity, module) {
    const availableModules = [];
    if (identity.availableModules.collection) availableModules.push('collection');
    if (identity.availableModules.selling) availableModules.push('selling');

    const collectionProfile = identity.collectionLinks[0] || null;
    const sellingProfile = identity.sellingLinks[0] || null;
    // The displayed selling profile is built from the first linked member. Use
    // that same member's configured rate, never a historical entry or average.
    const sellingRate = sellingProfile?.memberDocs?.[0]?.ratePerLiter;
    const milkRate = sellingRate != null && String(sellingRate).trim() !== '' && Number.isFinite(Number(sellingRate)) && Number(sellingRate) >= 0
        ? Number(sellingRate) : null;
    const namesFor = (links) => Array.from(new Set(links.map((link) => link.linkedDairyName || link.dairyName || 'Dairy')));
    const profileFor = (profile, links) => profile ? ({
        name: profile.name || 'Farmer / Customer',
        phone: profile.mobile || identity.phone,
        code: profile.code || '',
        address: profile.address || '',
        dairyName: profile.dairyName || identity.dairyNames[0] || 'Dairy',
        dairyNames: identity.dairyNames || [],
        linkedDairyNames: namesFor(links),
        status: 'Active',
    }) : null;
    const moduleProfiles = {
        collection: profileFor(collectionProfile, identity.collectionLinks),
        selling: sellingProfile ? { ...profileFor(sellingProfile, identity.sellingLinks), milkRate } : null,
    };
    const selectedProfile = module === 'selling'
        ? (sellingProfile || collectionProfile)
        : (collectionProfile || sellingProfile || identity.profile);

    return {
        id: `portal:${identity.phone}`,
        name: selectedProfile?.name || 'Farmer / Customer',
        phone: selectedProfile?.mobile || identity.phone,
        role: 'farmer_customer',
        code: selectedProfile?.code || '',
        address: selectedProfile?.address || '',
        dairyName: selectedProfile?.dairyName || identity.dairyNames[0] || 'Dairy',
        dairyNames: identity.dairyNames || [],
        linkedDairyNames: namesFor(selectedProfile === sellingProfile && sellingProfile ? identity.sellingLinks : identity.collectionLinks),
        status: 'Active',
        milkRate: selectedProfile === sellingProfile && sellingProfile ? milkRate : null,
        availableModules,
        moduleProfiles,
        memberSince: null,
    };
}

module.exports = {
    toId,
    mobileTail,
    isMobileMatch,
    escapeRegExp,
    normalizePhone,
    mobileQuery,
    findPortalProfiles,
    publicPortalIdentity,
};
