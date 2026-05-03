/**
 * Translations for printed slips (thermal + HTML/PDF).
 *
 * Note: Devanagari (Hindi/Marathi) characters require a thermal printer that
 * supports a Devanagari/Unicode codepage. Most basic 58mm ESC/POS printers
 * (e.g. SR588) only render CP437/Latin glyphs and will print boxes for हिन्दी
 * text. The HTML/PDF slip preview always renders correctly.
 */
import { getLanguage } from './languageStore';
import type { LanguageCode } from './translations';

export interface SlipLabels {
    // Headings / section titles
    collection: string;
    paymentSlip: string;
    farmersList: string;
    membersList: string;
    digitalMilkSlip: string;
    thankYou: string;
    generatedDate: string;
    total: string;

    // Common labels
    from: string;
    till: string;
    code: string;
    name: string;
    farmerCode: string;
    member: string;
    date: string;
    shift: string;
    morning: string;
    evening: string;
    morningShort: string; // M
    eveningShort: string; // E
    fat: string;
    snf: string;
    qty: string;
    rate: string;
    amount: string;
    mobile: string;
    note: string;
    time: string;
    balance: string;

    // Payment rows
    lastPayment: string;
    lastBalance: string;
    milkAmount: string;
    milkQuantity: string;
    milkRate: string;
    advanceProduct: string;
    totalPayable: string;
    paidAmount: string;
    closingBalance: string;
    closingBal: string; // shorter for thermal

    // Reports / summaries
    fullSummary: string;
    shortSummary: string;
    averageFatSnf: string;
    samples: string;
    totalQty: string;
    totalAmount: string;
    avgRate: string;
    averageRate: string;
    farmers: string;
    totalDays: string;
    totalEntries: string;
    totalMembers: string;
    netBalance: string;
    records: string;
    advancesReport: string;
    milkSellingEntries: string;
    milkSellingReport: string;
    memberBalanceReport: string;
    milkEntries: string;
    milkSlip: string;
    positiveBalance: string;
    negativeBalance: string;
    allEntries: string;
    start: string;
    end: string;
    to: string;
    actions: string;
    print: string;
    status: string;

    // WhatsApp / SMS slip
    dairy: string;
}


const en: SlipLabels = {
    collection: 'Collection',
    paymentSlip: 'Payment Slip',
    farmersList: 'Farmers List',
    membersList: 'Members List',
    digitalMilkSlip: 'Digital Milk Slip',
    thankYou: 'Thank You!',
    generatedDate: 'Generated Date',
    total: 'Total',

    from: 'From',
    till: 'Till',
    code: 'Code',
    name: 'Name',
    farmerCode: 'Farmer Code',
    member: 'Member',
    date: 'Date',
    shift: 'Shift',
    morning: 'Morning',
    evening: 'Evening',
    morningShort: 'M',
    eveningShort: 'E',
    fat: 'Fat',
    snf: 'SNF',
    qty: 'Qty',
    rate: 'Rate',
    amount: 'Amount',
    mobile: 'Mobile',
    note: 'Note',
    time: 'Time',
    balance: 'Balance',

    lastPayment: 'Last Payment',
    lastBalance: 'Last Balance',
    milkAmount: 'Milk Amount',
    milkQuantity: 'Milk Quantity',
    milkRate: 'Milk Rate',
    advanceProduct: 'Advance / Product',
    totalPayable: 'Total Payable',
    paidAmount: 'Paid Amount',
    closingBalance: 'Closing Balance',
    closingBal: 'Closing Bal',

    fullSummary: 'Full Summary',
    shortSummary: 'Short Summary',
    averageFatSnf: 'Average FAT/SNF',
    samples: 'Samples',
    totalQty: 'Total Qty',
    totalAmount: 'Total Amount',
    avgRate: 'Avg Rate',
    averageRate: 'Average Rate',
    farmers: 'Farmers',
    totalDays: 'Total Days',
    totalEntries: 'Total Entries',
    totalMembers: 'Total Members',
    netBalance: 'Net Balance',
    records: 'Records',
    advancesReport: 'Advances Report',
    milkSellingEntries: 'Milk Selling Entries',
    milkSellingReport: 'Milk Selling Report',
    memberBalanceReport: 'Member Balance Report',
    milkEntries: 'Milk Entries',
    milkSlip: 'Milk Slip',
    positiveBalance: 'Positive Balance',
    negativeBalance: 'Negative Balance',
    allEntries: 'All Entries',
    start: 'Start',
    end: 'End',
    to: 'to',
    actions: 'Actions',
    print: 'Print',
    status: 'Status',

    dairy: 'Dairy',
};

const hi: SlipLabels = {
    collection: 'संग्रह',
    paymentSlip: 'भुगतान पर्ची',
    farmersList: 'किसान सूची',
    membersList: 'सदस्य सूची',
    digitalMilkSlip: 'डिजिटल दूध पर्ची',
    thankYou: 'धन्यवाद!',
    generatedDate: 'जारी तिथि',
    total: 'कुल',

    from: 'से',
    till: 'तक',
    code: 'कोड',
    name: 'नाम',
    farmerCode: 'किसान कोड',
    member: 'सदस्य',
    date: 'दिनांक',
    shift: 'पाली',
    morning: 'सुबह',
    evening: 'शाम',
    morningShort: 'सु',
    eveningShort: 'शा',
    fat: 'फैट',
    snf: 'एसएनएफ',
    qty: 'मात्रा',
    rate: 'दर',
    amount: 'राशि',
    mobile: 'मोबाइल',
    note: 'टिप्पणी',
    time: 'समय',
    balance: 'शेष',

    lastPayment: 'पिछला भुगतान',
    lastBalance: 'पिछला शेष',
    milkAmount: 'दूध राशि',
    milkQuantity: 'दूध मात्रा',
    milkRate: 'दूध दर',
    advanceProduct: 'अग्रिम / उत्पाद',
    totalPayable: 'कुल देय',
    paidAmount: 'भुगतान राशि',
    closingBalance: 'शेष राशि',
    closingBal: 'शेष राशि',

    fullSummary: 'पूर्ण सारांश',
    shortSummary: 'संक्षिप्त सारांश',
    averageFatSnf: 'औसत फैट/एसएनएफ',
    samples: 'नमूने',
    totalQty: 'कुल मात्रा',
    totalAmount: 'कुल राशि',
    avgRate: 'औसत दर',
    averageRate: 'औसत दर',
    farmers: 'किसान',
    totalDays: 'कुल दिन',
    totalEntries: 'कुल प्रविष्टियाँ',
    totalMembers: 'कुल सदस्य',
    netBalance: 'शुद्ध शेष',
    records: 'रिकॉर्ड',
    advancesReport: 'अग्रिम रिपोर्ट',
    milkSellingEntries: 'दूध विक्रय प्रविष्टियाँ',
    milkSellingReport: 'दूध विक्रय रिपोर्ट',
    memberBalanceReport: 'सदस्य शेष रिपोर्ट',
    milkEntries: 'दूध प्रविष्टियाँ',
    milkSlip: 'दूध पर्ची',
    positiveBalance: 'जमा शेष',
    negativeBalance: 'बकाया शेष',
    allEntries: 'सभी प्रविष्टियाँ',
    start: 'प्रारंभ',
    end: 'अंत',
    to: 'से',
    actions: 'क्रियाएँ',
    print: 'प्रिंट',
    status: 'स्थिति',

    dairy: 'डेयरी',
};

const mr: SlipLabels = {
    collection: 'संकलन',
    paymentSlip: 'पेमेंट स्लिप',
    farmersList: 'शेतकरी यादी',
    membersList: 'सदस्य यादी',
    digitalMilkSlip: 'डिजिटल दूध स्लिप',
    thankYou: 'धन्यवाद!',
    generatedDate: 'जारी दिनांक',
    total: 'एकूण',

    from: 'पासून',
    till: 'पर्यंत',
    code: 'कोड',
    name: 'नाव',
    farmerCode: 'शेतकरी कोड',
    member: 'सदस्य',
    date: 'दिनांक',
    shift: 'पाळी',
    morning: 'सकाळ',
    evening: 'संध्याकाळ',
    morningShort: 'स',
    eveningShort: 'सं',
    fat: 'फॅट',
    snf: 'एसएनएफ',
    qty: 'मात्रा',
    rate: 'दर',
    amount: 'रक्कम',
    mobile: 'मोबाइल',
    note: 'टीप',
    time: 'वेळ',
    balance: 'शिल्लक',

    lastPayment: 'मागील पेमेंट',
    lastBalance: 'मागील शिल्लक',
    milkAmount: 'दूध रक्कम',
    milkQuantity: 'दूध मात्रा',
    milkRate: 'दूध दर',
    advanceProduct: 'अग्रिम / उत्पादन',
    totalPayable: 'एकूण देय',
    paidAmount: 'दिलेली रक्कम',
    closingBalance: 'शिल्लक रक्कम',
    closingBal: 'शिल्लक',

    fullSummary: 'पूर्ण सारांश',
    shortSummary: 'लघु सारांश',
    averageFatSnf: 'सरासरी फॅट/एसएनएफ',
    samples: 'नमुने',
    totalQty: 'एकूण मात्रा',
    totalAmount: 'एकूण रक्कम',
    avgRate: 'सरासरी दर',
    averageRate: 'सरासरी दर',
    farmers: 'शेतकरी',
    totalDays: 'एकूण दिवस',
    totalEntries: 'एकूण नोंदी',
    totalMembers: 'एकूण सदस्य',
    netBalance: 'निव्वळ शिल्लक',
    records: 'नोंदी',
    advancesReport: 'अग्रिम अहवाल',
    milkSellingEntries: 'दूध विक्री नोंदी',
    milkSellingReport: 'दूध विक्री अहवाल',
    memberBalanceReport: 'सदस्य शिल्लक अहवाल',
    milkEntries: 'दूध नोंदी',
    milkSlip: 'दूध स्लिप',
    positiveBalance: 'जमा शिल्लक',
    negativeBalance: 'थकीत शिल्लक',
    allEntries: 'सर्व नोंदी',
    start: 'प्रारंभ',
    end: 'शेवट',
    to: 'पर्यंत',
    actions: 'कृती',
    print: 'प्रिंट',
    status: 'स्थिती',

    dairy: 'डेअरी',
};

const MAP: Record<LanguageCode, SlipLabels> = { en, hi, mr };

/** Get slip labels for the currently selected app language. */
export function getSlipLabels(lang?: LanguageCode): SlipLabels {
    const code = lang || (getLanguage() as LanguageCode);
    return MAP[code] || en;
}

/* ------------------------------------------------------------------
 * Thermal-printer (Latin-script) variants for hi / mr.
 *
 * Most cheap 58mm Bluetooth thermal printers (SR588, MTP-2, Rongta,
 * XPrinter etc.) only ship with CP437 / Latin codepages and CANNOT
 * render Devanagari glyphs — they print boxes / garbage. To still
 * give Hindi / Marathi users a slip in their own language, we use
 * a Roman-script ("Hinglish") transliteration for thermal printing.
 *
 * HTML / PDF / WhatsApp slips still use the proper Devanagari labels
 * via getSlipLabels().
 * ------------------------------------------------------------------ */

const hiLatin: SlipLabels = {
    collection: 'Sangrah',
    paymentSlip: 'Payment Slip',
    farmersList: 'Kisan List',
    membersList: 'Sadasya List',
    digitalMilkSlip: 'Digital Doodh Slip',
    thankYou: 'Dhanyavaad!',
    generatedDate: 'Jaari Tithi',
    total: 'Kul',

    from: 'Se',
    till: 'Tak',
    code: 'Code',
    name: 'Naam',
    farmerCode: 'Kisan Code',
    member: 'Sadasya',
    date: 'Dinank',
    shift: 'Pali',
    morning: 'Subah',
    evening: 'Shaam',
    morningShort: 'S',
    eveningShort: 'Sh',
    fat: 'Fat',
    snf: 'SNF',
    qty: 'Matra',
    rate: 'Dar',
    amount: 'Rashi',
    mobile: 'Mobile',
    note: 'Note',
    time: 'Time',
    balance: 'Shesh',

    lastPayment: 'Pichla Bhugtan',
    lastBalance: 'Pichla Shesh',
    milkAmount: 'Doodh Rashi',
    milkQuantity: 'Doodh Matra',
    milkRate: 'Doodh Dar',
    advanceProduct: 'Advance / Product',
    totalPayable: 'Kul Dey',
    paidAmount: 'Bhugtan Rashi',
    closingBalance: 'Shesh Rashi',
    closingBal: 'Shesh',

    fullSummary: 'Full Summary',
    shortSummary: 'Short Summary',
    averageFatSnf: 'Average FAT/SNF',
    samples: 'Samples',
    totalQty: 'Kul Matra',
    totalAmount: 'Kul Rashi',
    avgRate: 'Avg Dar',
    averageRate: 'Average Dar',
    farmers: 'Kisan',
    totalDays: 'Kul Din',
    totalEntries: 'Kul Entries',
    totalMembers: 'Kul Sadasya',
    netBalance: 'Net Shesh',
    records: 'Records',
    advancesReport: 'Advance Report',
    milkSellingEntries: 'Doodh Vikray Entries',
    milkSellingReport: 'Doodh Vikray Report',
    memberBalanceReport: 'Sadasya Shesh Report',
    milkEntries: 'Doodh Entries',
    milkSlip: 'Doodh Slip',
    positiveBalance: 'Jama Shesh',
    negativeBalance: 'Bakaya Shesh',
    allEntries: 'Sabhi Entries',
    start: 'Start',
    end: 'End',
    to: 'se',
    actions: 'Actions',
    print: 'Print',
    status: 'Status',

    dairy: 'Dairy',
};

const mrLatin: SlipLabels = {
    collection: 'Sankalan',
    paymentSlip: 'Payment Slip',
    farmersList: 'Shetkari Yadi',
    membersList: 'Sadasya Yadi',
    digitalMilkSlip: 'Digital Doodh Slip',
    thankYou: 'Dhanyavaad!',
    generatedDate: 'Jaari Dinank',
    total: 'Ekun',

    from: 'Pasun',
    till: 'Paryant',
    code: 'Code',
    name: 'Naav',
    farmerCode: 'Shetkari Code',
    member: 'Sadasya',
    date: 'Dinank',
    shift: 'Pali',
    morning: 'Sakal',
    evening: 'Sandhyakal',
    morningShort: 'S',
    eveningShort: 'Sn',
    fat: 'Fat',
    snf: 'SNF',
    qty: 'Matra',
    rate: 'Dar',
    amount: 'Rakkam',
    mobile: 'Mobile',
    note: 'Note',
    time: 'Vel',
    balance: 'Shillak',

    lastPayment: 'Magil Payment',
    lastBalance: 'Magil Shillak',
    milkAmount: 'Doodh Rakkam',
    milkQuantity: 'Doodh Matra',
    milkRate: 'Doodh Dar',
    advanceProduct: 'Advance / Utpadan',
    totalPayable: 'Ekun Dey',
    paidAmount: 'Dileli Rakkam',
    closingBalance: 'Shillak Rakkam',
    closingBal: 'Shillak',

    fullSummary: 'Purna Saransh',
    shortSummary: 'Laghu Saransh',
    averageFatSnf: 'Sarasari FAT/SNF',
    samples: 'Namune',
    totalQty: 'Ekun Matra',
    totalAmount: 'Ekun Rakkam',
    avgRate: 'Sarasari Dar',
    averageRate: 'Sarasari Dar',
    farmers: 'Shetkari',
    totalDays: 'Ekun Divas',
    totalEntries: 'Ekun Nondi',
    totalMembers: 'Ekun Sadasya',
    netBalance: 'Nivval Shillak',
    records: 'Records',
    advancesReport: 'Advance Report',
    milkSellingEntries: 'Doodh Vikri Nondi',
    milkSellingReport: 'Doodh Vikri Report',
    memberBalanceReport: 'Sadasya Shillak Report',
    milkEntries: 'Doodh Nondi',
    milkSlip: 'Doodh Slip',
    positiveBalance: 'Jama Shillak',
    negativeBalance: 'Thakit Shillak',
    allEntries: 'Sarva Nondi',
    start: 'Start',
    end: 'End',
    to: 'paryant',
    actions: 'Actions',
    print: 'Print',
    status: 'Status',

    dairy: 'Dairy',
};

/**
 * Thermal-printer label map.
 *
 * Modern Bluetooth thermal printers (POSIFLOW, SR588 newer firmwares,
 * Sunmi, Epson, MTP-3, etc.) DO support Unicode / Devanagari when the
 * text is sent as UTF-8 — the underlying DantSu ESC/POS engine renders
 * the text as a bitmap before sending bytes to the printer, so any
 * glyph that exists in the device font is printed correctly.
 *
 * We therefore send the proper Devanagari labels for hi / mr. If a
 * very old printer can't render them, the user can switch the app
 * language to English and the receipt will print in English.
 *
 * Roman-script transliterations are kept as a fallback (see
 * `getThermalSlipLabelsLatin`) for legacy CP437-only printers.
 */
const THERMAL_MAP: Record<LanguageCode, SlipLabels> = {
    en,
    hi,
    mr,
};

const THERMAL_LATIN_MAP: Record<LanguageCode, SlipLabels> = {
    en,
    hi: hiLatin,
    mr: mrLatin,
};

/**
 * Get slip labels for ESC/POS thermal printing.
 *
 * Returns native-script labels (Devanagari for hi / mr) so printers
 * with Unicode support (POSIFLOW, modern SR588, Sunmi, etc.) render
 * the user's chosen language correctly.
 */
export function getThermalSlipLabels(lang?: LanguageCode): SlipLabels {
    const code = lang || (getLanguage() as LanguageCode);
    return THERMAL_MAP[code] || en;
}

/**
 * Legacy Roman-script transliteration fallback for printers that only
 * support CP437/Latin codepage (very old SR58B / no-name 58mm models).
 * Not used by default — kept for opt-in escape hatch.
 */
export function getThermalSlipLabelsLatin(lang?: LanguageCode): SlipLabels {
    const code = lang || (getLanguage() as LanguageCode);
    return THERMAL_LATIN_MAP[code] || en;
}
