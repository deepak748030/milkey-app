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

    // Payment rows
    lastPayment: string;
    milkAmount: string;
    milkQuantity: string;
    milkRate: string;
    advanceProduct: string;
    totalPayable: string;
    paidAmount: string;
    closingBalance: string;
    closingBal: string; // shorter for thermal

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

    lastPayment: 'Last Payment',
    milkAmount: 'Milk Amount',
    milkQuantity: 'Milk Quantity',
    milkRate: 'Milk Rate',
    advanceProduct: 'Advance / Product',
    totalPayable: 'Total Payable',
    paidAmount: 'Paid Amount',
    closingBalance: 'Closing Balance',
    closingBal: 'Closing Bal',

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

    lastPayment: 'पिछला भुगतान',
    milkAmount: 'दूध राशि',
    milkQuantity: 'दूध मात्रा',
    milkRate: 'दूध दर',
    advanceProduct: 'अग्रिम / उत्पाद',
    totalPayable: 'कुल देय',
    paidAmount: 'भुगतान राशि',
    closingBalance: 'शेष राशि',
    closingBal: 'शेष राशि',

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

    lastPayment: 'मागील पेमेंट',
    milkAmount: 'दूध रक्कम',
    milkQuantity: 'दूध मात्रा',
    milkRate: 'दूध दर',
    advanceProduct: 'अग्रिम / उत्पादन',
    totalPayable: 'एकूण देय',
    paidAmount: 'दिलेली रक्कम',
    closingBalance: 'शिल्लक रक्कम',
    closingBal: 'शिल्लक',

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

    lastPayment: 'Pichla Bhugtan',
    milkAmount: 'Doodh Rashi',
    milkQuantity: 'Doodh Matra',
    milkRate: 'Doodh Dar',
    advanceProduct: 'Advance / Product',
    totalPayable: 'Kul Dey',
    paidAmount: 'Bhugtan Rashi',
    closingBalance: 'Shesh Rashi',
    closingBal: 'Shesh',

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

    lastPayment: 'Magil Payment',
    milkAmount: 'Doodh Rakkam',
    milkQuantity: 'Doodh Matra',
    milkRate: 'Doodh Dar',
    advanceProduct: 'Advance / Utpadan',
    totalPayable: 'Ekun Dey',
    paidAmount: 'Dileli Rakkam',
    closingBalance: 'Shillak Rakkam',
    closingBal: 'Shillak',

    dairy: 'Dairy',
};

const THERMAL_MAP: Record<LanguageCode, SlipLabels> = {
    en,
    hi: hiLatin,
    mr: mrLatin,
};

/**
 * Get slip labels safe for ESC/POS thermal printing.
 *
 * For English → returns English labels.
 * For Hindi / Marathi → returns Roman-script transliterations so the
 * printer's CP437/Latin codepage renders them correctly instead of boxes.
 */
export function getThermalSlipLabels(lang?: LanguageCode): SlipLabels {
    const code = lang || (getLanguage() as LanguageCode);
    return THERMAL_MAP[code] || en;
}
