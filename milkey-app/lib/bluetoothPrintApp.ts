/**
 * Helper to print via the "Bluetooth Print" app (mate.bluetoothprint)
 * This acts as a reliable fallback when direct BLE printing doesn't work.
 * 
 * App URL: https://play.google.com/store/apps/details?id=mate.bluetoothprint
 * 
 * Format: <BoldAlignFormat>Content
 * B: 0=no bold, 1=bold
 * A: 0=left, 1=center, 2=right  
 * F: 0=normal, 1=double height, 2=double height+width, 3=double width
 */

import { Linking, Platform, Alert } from 'react-native';

const BLUETOOTH_PRINT_PACKAGE = 'mate.bluetoothprint';

/**
 * Format a line for Bluetooth Print app
 * @param text - Text content
 * @param bold - 0 or 1
 * @param align - 0=left, 1=center, 2=right
 * @param format - 0=normal, 1=double height, 2=double H+W, 3=double width
 */
function formatLine(text: string, bold: number = 0, align: number = 0, format: number = 0): string {
    return `<${bold}${align}${format}>${text}`;
}

/**
 * Build a receipt string for the Bluetooth Print app
 */
export function buildBluetoothPrintReceipt(options: {
    dairyName?: string;
    ownerName?: string;
    mobile?: string;
    address?: string;
    farmerCode?: string;
    farmerName?: string;
    date?: string;
    shift?: string;
    quantity?: string | number;
    fat?: string | number;
    snf?: string | number;
    rate?: string | number;
    amount?: string | number;
    extraInfo?: string;
}): string {
    let str = '';

    // Header
    if (options.dairyName) {
        str += formatLine(options.dairyName, 1, 1, 2); // Bold, Center, Double H+W
    }
    if (options.ownerName) {
        str += formatLine(options.ownerName, 0, 1, 0);
    }
    if (options.mobile) {
        str += formatLine('Ph: ' + options.mobile, 0, 1, 0);
    }
    if (options.address) {
        str += formatLine(options.address, 0, 1, 0);
    }

    str += formatLine('--------------------------------', 0, 0, 0);

    // Farmer details
    if (options.farmerCode) {
        str += formatLine('Code: ' + options.farmerCode, 0, 0, 0);
    }
    if (options.farmerName) {
        str += formatLine('Name: ' + options.farmerName, 0, 0, 0);
    }
    if (options.date) {
        const dateShift = options.shift ? `${options.date}   Shift: ${options.shift}` : options.date;
        str += formatLine('Date: ' + dateShift, 0, 0, 0);
    }

    str += formatLine('--------------------------------', 0, 0, 0);

    // Milk details
    const fat = options.fat ? String(options.fat) : '-';
    const snf = options.snf ? String(options.snf) : '-';
    str += formatLine(`Fat: ${fat}              SNF: ${snf}`, 0, 0, 0);

    const rate = options.rate ? String(options.rate) : '-';
    const qty = options.quantity ? String(options.quantity) : '-';
    str += formatLine(`Rate: ${rate}           Qty: ${qty}`, 0, 0, 0);

    str += formatLine('--------------------------------', 0, 0, 0);

    // Amount
    if (options.amount) {
        str += formatLine('Amount: Rs. ' + String(options.amount), 1, 1, 1); // Bold, Center, Double Height
    }

    str += formatLine('--------------------------------', 0, 0, 0);

    // Extra info
    if (options.extraInfo) {
        str += formatLine(options.extraInfo, 0, 1, 0);
    }

    str += formatLine('Thank You!', 0, 1, 0);

    return str;
}

/**
 * Build a summary string for the Bluetooth Print app
 */
export function buildBluetoothPrintSummary(options: {
    title: string;
    dateLabel: string;
    lines: { label: string; value: string }[];
    details?: { code: string; qty: string; fat: string; rate: string; amount: string }[];
}): string {
    let str = '';

    str += formatLine(options.title, 1, 1, 2);
    str += formatLine(options.dateLabel, 0, 1, 0);
    str += formatLine('================================', 0, 0, 0);

    if (options.details && options.details.length > 0) {
        str += formatLine('Code     Qty    Fat   Rate   Amt', 1, 0, 0);
        str += formatLine('--------------------------------', 0, 0, 0);
        for (const d of options.details) {
            str += formatLine(`${d.code.padEnd(9)}${d.qty.padEnd(7)}${d.fat.padEnd(6)}${d.rate.padEnd(7)}${d.amount}`, 0, 0, 0);
        }
        str += formatLine('================================', 0, 0, 0);
    }

    for (const line of options.lines) {
        str += formatLine(`${line.label}: ${line.value}`, 1, 0, 0);
    }

    str += formatLine('================================', 0, 0, 0);
    str += formatLine('--- End ---', 0, 1, 0);

    return str;
}

/**
 * Send data to Bluetooth Print app via Android Intent
 */
export async function printViaBluetoothPrintApp(data: string): Promise<boolean> {
    if (Platform.OS !== 'android') {
        Alert.alert('Not Supported', 'Bluetooth Print app is only available on Android.');
        return false;
    }

    try {
        // Use Intent ACTION_SEND to mate.bluetoothprint
        const intentUrl = `intent:#Intent;action=android.intent.action.SEND;type=text/plain;package=${BLUETOOTH_PRINT_PACKAGE};S.android.intent.extra.TEXT=${encodeURIComponent(data)};end`;

        const canOpen = await Linking.canOpenURL(intentUrl);
        if (canOpen) {
            await Linking.openURL(intentUrl);
            return true;
        }

        // Fallback: try share intent
        const shareUrl = `market://details?id=${BLUETOOTH_PRINT_PACKAGE}`;
        Alert.alert(
            'Bluetooth Print App Required',
            'Please install the "Bluetooth Print" app from Play Store for reliable thermal printer support.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Install App',
                    onPress: () => Linking.openURL(shareUrl).catch(() => {
                        Linking.openURL(`https://play.google.com/store/apps/details?id=${BLUETOOTH_PRINT_PACKAGE}`);
                    }),
                },
            ]
        );
        return false;
    } catch (error) {
        console.error('Bluetooth Print app error:', error);
        Alert.alert('Error', 'Failed to open Bluetooth Print app. Please make sure it is installed.');
        return false;
    }
}

/**
 * Build a test print string for Bluetooth Print app
 */
export function buildBluetoothPrintTest(): string {
    let str = '';
    str += formatLine('MILKEY', 1, 1, 2);
    str += formatLine('Printer Test', 0, 1, 0);
    str += formatLine('--------------------------------', 0, 0, 0);
    str += formatLine('Status: Connected', 0, 0, 0);
    str += formatLine('Width: 58mm', 0, 0, 0);
    str += formatLine('Method: Bluetooth Print App', 0, 0, 0);
    str += formatLine('--------------------------------', 0, 0, 0);
    str += formatLine('Printer is working!', 0, 1, 0);
    return str;
}
