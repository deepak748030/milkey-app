/**
 * Translations for printed slips (thermal + HTML/PDF).
 *
 * Only English and Hindi (Devanagari) are supported for printing.
 * If the app language is anything else (e.g. Marathi), printing falls
 * back to English so the receipt is always readable.
 *
 * Modern Bluetooth thermal printers (SR588 newer firmware, Sunmi, Epson,
 * MTP-3, POSIFLOW) render Devanagari correctly because the DantSu ESC/POS
 * engine sends text as a bitmap. Very old CP437-only printers may print
 * boxes for Hindi — in that case the user should switch the app language
 * to English.
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
    connected: string;
    test: string;

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
    connected: 'Connected',
    test: 'Test',

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
    connected: 'जुड़ा हुआ',
    test: 'परीक्षण',

    dairy: 'डेयरी',
};

/**
 * Resolve the active print language. Only `en` and `hi` are supported for
 * printing — anything else (e.g. `mr`) falls back to English.
 */
function resolvePrintLang(lang?: LanguageCode): 'en' | 'hi' {
    const code = lang || (getLanguage() as LanguageCode);
    return code === 'hi' ? 'hi' : 'en';
}

/** Get slip labels for the currently selected app language (HTML / PDF). */
export function getSlipLabels(lang?: LanguageCode): SlipLabels {
    return resolvePrintLang(lang) === 'hi' ? hi : en;
}

/**
 * Get slip labels for ESC/POS thermal printing.
 *
 * Returns native-script labels for Hindi (Devanagari) so printers with
 * Unicode support render correctly. Falls back to English for any other
 * app language.
 */
export function getThermalSlipLabels(lang?: LanguageCode): SlipLabels {
    return resolvePrintLang(lang) === 'hi' ? hi : en;
}
