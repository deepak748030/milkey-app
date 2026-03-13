// English translations - Default language
const en = {
    // Tab Labels
    tabs: {
        home: 'Home',
        purchase: 'Purchase',
        selling: 'Selling',
        register: 'Register',
        profile: 'Profile',
    },

    // Common
    common: {
        save: 'Save',
        cancel: 'Cancel',
        delete: 'Delete',
        edit: 'Edit',
        add: 'Add',
        search: 'Search',
        loading: 'Loading...',
        noData: 'No data found',
        confirm: 'Confirm',
        close: 'Close',
        submit: 'Submit',
        back: 'Back',
        next: 'Next',
        yes: 'Yes',
        no: 'No',
        ok: 'OK',
        done: 'Done',
        retry: 'Retry',
        refresh: 'Refresh',
        viewAll: 'View All',
        amount: 'Amount',
        quantity: 'Quantity',
        rate: 'Rate',
        date: 'Date',
        total: 'Total',
        name: 'Name',
        phone: 'Phone',
        email: 'Email',
        address: 'Address',
        status: 'Status',
        actions: 'Actions',
        morning: 'Morning',
        evening: 'Evening',
    },

    // Profile Screen
    profile: {
        title: 'Profile',
        editProfile: 'Edit Profile',
        appearance: 'Appearance',
        darkMode: 'Dark Mode',
        lightMode: 'Light Mode',
        language: 'Language',
        selectLanguage: 'Select Language',
        myOrders: 'My Orders',
        mySubscriptions: 'My Subscriptions',
        submitForm: 'Submit Form',
        referralProgram: 'Referral Program',
        withdraw: 'Withdraw',
        notifications: 'Notifications',
        helpSupport: 'Help & Support',
        termsConditions: 'Terms & Conditions',
        privacyPolicy: 'Privacy Policy',
        followUs: 'Follow Us On',
        logout: 'Logout',
        logoutConfirm: 'Are you sure you want to logout?',
        referralCode: 'Referral Code:',
        dairyOwner: 'Dairy Owner',
        owner: 'Owner',
    },

    // Home Screen
    home: {
        quickOverview: 'Quick Overview',
        today: 'Today',
        milkCollection: 'Milk Collection',
        sellQty: 'Sell Qty',
        members: 'Members',
        farmers: 'Farmers',
        quickActions: 'Quick Actions',
        entry: 'Entry',
        advance: 'Advance',
        products: 'Products',
        addToCart: 'Add to Cart',
        choosePlan: 'Choose Your Plan',
    },

    // Purchase Screen
    purchase: {
        title: 'Purchase',
        addCustomer: 'Add Customer',
        avgRate: 'Avg Rate',
        totalQty: 'Total Qty',
        totalAmt: 'Total Amt',
        saleEntries: 'Sale Entries',
        noEntries: 'No entries yet',
        milk: 'Milk',
        fat: 'Fat',
        snf: 'SNF',
        cow: 'Cow',
        buffalo: 'Buffalo',
        customerName: 'Customer Name',
        customerCode: 'Customer Code',
        priceBasis: 'Price Basis',
        milkType: 'Milk Type',
        saveCustomer: 'Save Customer',
        customerDetails: 'Customer Details',
        defaultMilkType: 'Default Milk Type',
        milkSettings: 'Milk Settings',
    },

    // Selling Screen
    selling: {
        title: 'Selling',
        entry: 'Entry',
        payment: 'Payment',
        reports: 'Reports',
        member: 'Member',
        addMember: 'Add Member',
        memberName: 'Member Name',
        memberCode: 'Member Code',
    },

    // Register Screen
    register: {
        title: 'Register',
        payments: 'Payments',
        advances: 'Advances',
        farmers: 'Farmers',
        addFarmer: 'Add Farmer',
        farmerName: 'Farmer Name',
        farmerCode: 'Farmer Code',
    },

    // Auth
    auth: {
        login: 'Login',
        signup: 'Sign Up',
        welcomeBack: 'Welcome Back',
        phoneNumber: 'Phone Number',
        password: 'Password',
        forgotPassword: 'Forgot Password?',
        dontHaveAccount: "Don't have an account?",
        alreadyHaveAccount: 'Already have an account?',
    },

    // Notifications
    notifications: {
        title: 'Notifications',
        noNotifications: 'No notifications yet',
        markAllRead: 'Mark all as read',
    },

    // Orders
    orders: {
        title: 'My Orders',
        noOrders: 'No orders yet',
        orderStatus: 'Order Status',
        pending: 'Pending',
        confirmed: 'Confirmed',
        delivered: 'Delivered',
        cancelled: 'Cancelled',
    },

    // Subscriptions
    subscriptions: {
        title: 'My Subscriptions',
        activePlan: 'Active Plan',
        expired: 'Expired',
        active: 'Active',
    },

    // Help & Support
    helpSupport: {
        title: 'Help & Support',
        contactUs: 'Contact Us',
        faq: 'FAQ',
    },

    // Feedback
    feedback: {
        title: 'Feedback',
        submitFeedback: 'Submit Feedback',
        placeholder: 'Write your feedback here...',
    },

    // Referral
    referral: {
        title: 'Referral Program',
        yourCode: 'Your Referral Code',
        shareCode: 'Share Code',
        totalReferrals: 'Total Referrals',
        earnings: 'Earnings',
    },

    // Withdraw
    withdraw: {
        title: 'Withdraw',
        availableBalance: 'Available Balance',
        withdrawAmount: 'Withdraw Amount',
        withdrawNow: 'Withdraw Now',
    },
};

export type TranslationKeys = typeof en;
export default en;
