import * as Sharing from 'expo-sharing';
import { Paths, File } from 'expo-file-system';
import { Alert } from 'react-native';

// Convert array of objects to CSV string
export const arrayToCSV = (data: any[], headers?: { [key: string]: string }): string => {
    if (data.length === 0) return '';

    const keys = Object.keys(headers || data[0]);
    const headerRow = headers
        ? keys.map(k => headers[k] || k).join(',')
        : keys.join(',');

    const rows = data.map(item =>
        keys.map(key => {
            let value = item[key];
            // Handle nested objects
            if (typeof value === 'object' && value !== null) {
                value = value.name || value.code || JSON.stringify(value);
            }
            // Escape quotes and wrap in quotes if contains comma
            if (value === undefined || value === null) value = '';
            value = String(value);
            if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                value = `"${value.replace(/"/g, '""')}"`;
            }
            return value;
        }).join(',')
    ).join('\n');

    return `${headerRow}\n${rows}`;
};

// Export and share CSV file
export const exportToCSV = async (
    data: any[],
    filename: string,
    headers?: { [key: string]: string }
): Promise<boolean> => {
    try {
        if (data.length === 0) {
            Alert.alert('Error', 'No data to export');
            return false;
        }

        const csv = arrayToCSV(data, headers);
        const file = new File(Paths.cache, `${filename}.csv`);

        // Write to file
        file.write(csv);

        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(file.uri, {
                mimeType: 'text/csv',
                dialogTitle: `Export ${filename}`,
                UTI: 'public.comma-separated-values-text'
            });
            return true;
        } else {
            Alert.alert('Success', `File saved to: ${file.uri}`);
            return true;
        }
    } catch (error) {
        console.error('CSV Export error:', error);
        Alert.alert('Error', 'Failed to export CSV file');
        return false;
    }
};

// Export members list
export const exportMembers = async (members: any[]): Promise<boolean> => {
    const headers = {
        code: 'Code',
        name: 'Name',
        mobile: 'Mobile',
        address: 'Address',
        totalLiters: 'Total Liters',
        totalPurchase: 'Total Purchase',
        pendingAmount: 'Pending Amount'
    };

    const data = members.map(m => ({
        code: m.code,
        name: m.name,
        mobile: m.mobile,
        address: m.address || '',
        totalLiters: m.totalLiters || 0,
        totalPurchase: m.totalPurchase || 0,
        pendingAmount: m.pendingAmount || 0
    }));

    return exportToCSV(data, `members_${getDateStr()}`, headers);
};

// Export milk collections
export const exportMilkCollections = async (collections: any[]): Promise<boolean> => {
    const headers = {
        date: 'Date',
        farmerName: 'Farmer Name',
        farmerCode: 'Farmer Code',
        shift: 'Shift',
        quantity: 'Quantity (L)',
        fat: 'FAT %',
        snf: 'SNF %',
        rate: 'Rate (₹)',
        amount: 'Amount (₹)'
    };

    const data = collections.map(c => ({
        date: formatDate(c.date),
        farmerName: c.farmer?.name || '',
        farmerCode: c.farmer?.code || c.farmerCode || '',
        shift: c.shift,
        quantity: c.quantity,
        fat: c.fat || 0,
        snf: c.snf || 0,
        rate: c.rate,
        amount: c.amount
    }));

    return exportToCSV(data, `milk_collections_${getDateStr()}`, headers);
};

// Export payments
export const exportPayments = async (payments: any[]): Promise<boolean> => {
    const headers = {
        date: 'Date',
        farmerName: 'Farmer Name',
        farmerCode: 'Farmer Code',
        amount: 'Amount (₹)',
        paymentMethod: 'Payment Method',
        reference: 'Reference'
    };

    const data = payments.map(p => ({
        date: formatDate(p.date || p.createdAt),
        farmerName: p.farmer?.name || '',
        farmerCode: p.farmer?.code || '',
        amount: p.amount,
        paymentMethod: p.paymentMethod || 'cash',
        reference: p.reference || ''
    }));

    return exportToCSV(data, `payments_${getDateStr()}`, headers);
};

// Helper functions
const getDateStr = () => {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
};

const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

// const API_BASE_URL = 'http://localhost:5000/api'