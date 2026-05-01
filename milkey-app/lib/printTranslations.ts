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
