// Hindi translations - हिंदी
import type { TranslationKeys } from './en';

const hi: TranslationKeys = {
    // Tab Labels
    tabs: {
        home: 'होम',
        purchase: 'खरीदी',
        selling: 'बिक्री',
        register: 'रजिस्टर',
        profile: 'प्रोफाइल',
    },

    // Common
    common: {
        save: 'सेव करें',
        cancel: 'रद्द करें',
        delete: 'हटाएं',
        edit: 'संपादित करें',
        add: 'जोड़ें',
        search: 'खोजें',
        loading: 'लोड हो रहा है...',
        noData: 'कोई डेटा नहीं मिला',
        confirm: 'पुष्टि करें',
        close: 'बंद करें',
        submit: 'जमा करें',
        back: 'वापस',
        next: 'आगे',
        yes: 'हां',
        no: 'नहीं',
        ok: 'ठीक है',
        done: 'हो गया',
        retry: 'पुनः प्रयास करें',
        refresh: 'रीफ्रेश',
        viewAll: 'सभी देखें',
        amount: 'राशि',
        quantity: 'मात्रा',
        rate: 'दर',
        date: 'तारीख',
        total: 'कुल',
        name: 'नाम',
        phone: 'फोन',
        email: 'ईमेल',
        address: 'पता',
        status: 'स्थिति',
        actions: 'कार्रवाई',
        morning: 'सुबह',
        evening: 'शाम',
    },

    // Profile Screen
    profile: {
        title: 'प्रोफाइल',
        editProfile: 'प्रोफाइल संपादित करें',
        appearance: 'दिखावट',
        darkMode: 'डार्क मोड',
        lightMode: 'लाइट मोड',
        language: 'भाषा',
        selectLanguage: 'भाषा चुनें',
        myOrders: 'मेरे ऑर्डर',
        mySubscriptions: 'मेरी सदस्यता',
        submitForm: 'फॉर्म जमा करें',
        referralProgram: 'रेफरल प्रोग्राम',
        withdraw: 'निकासी',
        notifications: 'सूचनाएं',
        helpSupport: 'सहायता और समर्थन',
        termsConditions: 'नियम और शर्तें',
        privacyPolicy: 'गोपनीयता नीति',
        followUs: 'हमें फॉलो करें',
        logout: 'लॉगआउट',
        logoutConfirm: 'क्या आप लॉगआउट करना चाहते हैं?',
        referralCode: 'रेफरल कोड:',
        dairyOwner: 'डेयरी मालिक',
        owner: 'मालिक',
    },

    // Home Screen
    home: {
        quickOverview: 'त्वरित अवलोकन',
        today: 'आज',
        milkCollection: 'दूध संग्रह',
        sellQty: 'बिक्री मात्रा',
        members: 'सदस्य',
        farmers: 'किसान',
        quickActions: 'त्वरित कार्य',
        entry: 'एंट्री',
        advance: 'अग्रिम',
        products: 'उत्पाद',
        addToCart: 'कार्ट में डालें',
        choosePlan: 'अपना प्लान चुनें',
    },

    // Purchase Screen
    purchase: {
        title: 'खरीदी',
        addCustomer: 'ग्राहक जोड़ें',
        avgRate: 'औसत दर',
        totalQty: 'कुल मात्रा',
        totalAmt: 'कुल राशि',
        saleEntries: 'बिक्री प्रविष्टियां',
        noEntries: 'अभी तक कोई प्रविष्टि नहीं',
        milk: 'दूध',
        fat: 'फैट',
        snf: 'एसएनएफ',
        cow: 'गाय',
        buffalo: 'भैंस',
        customerName: 'ग्राहक का नाम',
        customerCode: 'ग्राहक कोड',
        priceBasis: 'मूल्य आधार',
        milkType: 'दूध प्रकार',
        saveCustomer: 'ग्राहक सेव करें',
        customerDetails: 'ग्राहक विवरण',
        defaultMilkType: 'डिफॉल्ट दूध प्रकार',
        milkSettings: 'दूध सेटिंग्स',
    },

    // Selling Screen
    selling: {
        title: 'बिक्री',
        entry: 'एंट्री',
        payment: 'भुगतान',
        reports: 'रिपोर्ट',
        member: 'सदस्य',
        addMember: 'सदस्य जोड़ें',
        memberName: 'सदस्य का नाम',
        memberCode: 'सदस्य कोड',
    },

    // Register Screen
    register: {
        title: 'रजिस्टर',
        payments: 'भुगतान',
        advances: 'अग्रिम',
        farmers: 'किसान',
        addFarmer: 'किसान जोड़ें',
        farmerName: 'किसान का नाम',
        farmerCode: 'किसान कोड',
    },

    // Auth
    auth: {
        login: 'लॉगिन',
        signup: 'साइन अप',
        welcomeBack: 'वापस स्वागत है',
        phoneNumber: 'फोन नंबर',
        password: 'पासवर्ड',
        forgotPassword: 'पासवर्ड भूल गए?',
        dontHaveAccount: 'अकाउंट नहीं है?',
        alreadyHaveAccount: 'पहले से अकाउंट है?',
    },

    // Notifications
    notifications: {
        title: 'सूचनाएं',
        noNotifications: 'अभी कोई सूचना नहीं',
        markAllRead: 'सभी को पढ़ा हुआ चिह्नित करें',
    },

    // Orders
    orders: {
        title: 'मेरे ऑर्डर',
        noOrders: 'अभी कोई ऑर्डर नहीं',
        orderStatus: 'ऑर्डर स्थिति',
        pending: 'लंबित',
        confirmed: 'पुष्टि',
        delivered: 'वितरित',
        cancelled: 'रद्द',
    },

    // Subscriptions
    subscriptions: {
        title: 'मेरी सदस्यता',
        activePlan: 'सक्रिय प्लान',
        expired: 'समाप्त',
        active: 'सक्रिय',
    },

    // Help & Support
    helpSupport: {
        title: 'सहायता और समर्थन',
        contactUs: 'संपर्क करें',
        faq: 'अक्सर पूछे जाने वाले प्रश्न',
    },

    // Feedback
    feedback: {
        title: 'प्रतिक्रिया',
        submitFeedback: 'प्रतिक्रिया जमा करें',
        placeholder: 'यहां अपनी प्रतिक्रिया लिखें...',
    },

    // Referral
    referral: {
        title: 'रेफरल प्रोग्राम',
        yourCode: 'आपका रेफरल कोड',
        shareCode: 'कोड शेयर करें',
        totalReferrals: 'कुल रेफरल',
        earnings: 'कमाई',
    },

    // Withdraw
    withdraw: {
        title: 'निकासी',
        availableBalance: 'उपलब्ध शेष',
        withdrawAmount: 'निकासी राशि',
        withdrawNow: 'अभी निकालें',
    },
};

export default hi;
