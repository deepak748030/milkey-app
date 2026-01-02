import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { router } from 'expo-router';
import { ArrowLeft, Wallet, Clock, CheckCircle, XCircle, CreditCard, Building2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { withdrawalsApi, Withdrawal, WithdrawalData } from '@/lib/milkeyApi';

export default function WithdrawScreen() {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const styles = createStyles(colors, isDark, insets);

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [data, setData] = useState<WithdrawalData | null>(null);

    // Form state
    const [amount, setAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'upi' | 'bank'>('upi');
    const [upiId, setUpiId] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [ifscCode, setIfscCode] = useState('');
    const [accountHolderName, setAccountHolderName] = useState('');
    const [bankName, setBankName] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await withdrawalsApi.getData();
            if (res.success && res.response) {
                setData(res.response);
            }
        } catch (error) {
            console.error('Error fetching withdrawal data:', error);
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    };

    const handleSubmit = async () => {
        const amountNum = parseFloat(amount);

        if (!amount || amountNum <= 0) {
            Alert.alert('Error', 'Please enter a valid amount');
            return;
        }

        if (amountNum > (data?.balance || 0)) {
            Alert.alert('Error', `Insufficient balance. Available: ₹${data?.balance || 0}`);
            return;
        }

        if (paymentMethod === 'upi' && !upiId.trim()) {
            Alert.alert('Error', 'Please enter your UPI ID');
            return;
        }

        if (paymentMethod === 'bank') {
            if (!accountNumber.trim() || !ifscCode.trim() || !accountHolderName.trim()) {
                Alert.alert('Error', 'Please fill all bank details');
                return;
            }
        }

        setSubmitting(true);
        try {
            const payload: any = {
                amount: amountNum,
                paymentMethod,
            };

            if (paymentMethod === 'upi') {
                payload.upiId = upiId.trim();
            } else {
                payload.bankDetails = {
                    accountNumber: accountNumber.trim(),
                    ifscCode: ifscCode.trim().toUpperCase(),
                    accountHolderName: accountHolderName.trim(),
                    bankName: bankName.trim(),
                };
            }

            const res = await withdrawalsApi.create(payload);
            if (res.success) {
                Alert.alert('Success', 'Withdrawal request submitted successfully');
                setAmount('');
                setUpiId('');
                setAccountNumber('');
                setIfscCode('');
                setAccountHolderName('');
                setBankName('');
                fetchData();
            } else {
                Alert.alert('Error', res.message || 'Failed to submit request');
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Something went wrong');
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'approved':
                return <CheckCircle size={16} color={colors.success} />;
            case 'rejected':
            case 'cancelled':
                return <XCircle size={16} color={colors.destructive} />;
            default:
                return <Clock size={16} color={colors.warning} />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'approved':
                return colors.success;
            case 'rejected':
            case 'cancelled':
                return colors.destructive;
            default:
                return colors.warning;
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backBtn}>
                    <ArrowLeft size={22} color={colors.foreground} />
                </Pressable>
                <Text style={styles.headerTitle}>Withdraw</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {/* Balance Card */}
                <View style={styles.balanceCard}>
                    <View style={styles.balanceHeader}>
                        <Wallet size={22} color={colors.primary} />
                        <Text style={styles.balanceTitle}>Available Balance</Text>
                    </View>
                    <Text style={styles.balanceAmount}>₹{data?.balance?.toLocaleString() || 0}</Text>
                    <View style={styles.balanceStats}>
                        <View style={styles.balanceStat}>
                            <Text style={styles.balanceStatLabel}>Total Withdrawn</Text>
                            <Text style={styles.balanceStatValue}>₹{data?.totalWithdrawn?.toLocaleString() || 0}</Text>
                        </View>
                        <View style={styles.balanceDivider} />
                        <View style={styles.balanceStat}>
                            <Text style={styles.balanceStatLabel}>Pending</Text>
                            <Text style={[styles.balanceStatValue, { color: colors.warning }]}>₹{data?.pendingWithdrawals?.toLocaleString() || 0}</Text>
                        </View>
                    </View>
                </View>

                {/* Withdraw Form */}
                {(data?.balance || 0) > 0 && (
                    <View style={styles.formCard}>
                        <Text style={styles.formTitle}>Request Withdrawal</Text>

                        {/* Amount */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Amount (₹)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter amount"
                                placeholderTextColor={colors.mutedForeground}
                                keyboardType="numeric"
                                value={amount}
                                onChangeText={setAmount}
                            />
                        </View>

                        {/* Payment Method */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Payment Method</Text>
                            <View style={styles.methodRow}>
                                <Pressable
                                    style={[styles.methodBtn, paymentMethod === 'upi' && styles.methodBtnActive]}
                                    onPress={() => setPaymentMethod('upi')}
                                >
                                    <CreditCard size={18} color={paymentMethod === 'upi' ? colors.white : colors.foreground} />
                                    <Text style={[styles.methodBtnText, paymentMethod === 'upi' && styles.methodBtnTextActive]}>UPI</Text>
                                </Pressable>
                                <Pressable
                                    style={[styles.methodBtn, paymentMethod === 'bank' && styles.methodBtnActive]}
                                    onPress={() => setPaymentMethod('bank')}
                                >
                                    <Building2 size={18} color={paymentMethod === 'bank' ? colors.white : colors.foreground} />
                                    <Text style={[styles.methodBtnText, paymentMethod === 'bank' && styles.methodBtnTextActive]}>Bank Transfer</Text>
                                </Pressable>
                            </View>
                        </View>

                        {/* UPI Details */}
                        {paymentMethod === 'upi' && (
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>UPI ID</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="yourname@upi"
                                    placeholderTextColor={colors.mutedForeground}
                                    value={upiId}
                                    onChangeText={setUpiId}
                                    autoCapitalize="none"
                                />
                            </View>
                        )}

                        {/* Bank Details */}
                        {paymentMethod === 'bank' && (
                            <>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Account Holder Name</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Enter name"
                                        placeholderTextColor={colors.mutedForeground}
                                        value={accountHolderName}
                                        onChangeText={setAccountHolderName}
                                    />
                                </View>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Account Number</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Enter account number"
                                        placeholderTextColor={colors.mutedForeground}
                                        keyboardType="numeric"
                                        value={accountNumber}
                                        onChangeText={setAccountNumber}
                                    />
                                </View>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>IFSC Code</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Enter IFSC code"
                                        placeholderTextColor={colors.mutedForeground}
                                        value={ifscCode}
                                        onChangeText={setIfscCode}
                                        autoCapitalize="characters"
                                    />
                                </View>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Bank Name (Optional)</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Enter bank name"
                                        placeholderTextColor={colors.mutedForeground}
                                        value={bankName}
                                        onChangeText={setBankName}
                                    />
                                </View>
                            </>
                        )}

                        {/* Submit Button */}
                        <Pressable
                            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                            onPress={handleSubmit}
                            disabled={submitting}
                        >
                            {submitting ? (
                                <ActivityIndicator color={colors.white} size="small" />
                            ) : (
                                <Text style={styles.submitBtnText}>Submit Request</Text>
                            )}
                        </Pressable>
                    </View>
                )}

                {/* No Balance Message */}
                {(data?.balance || 0) <= 0 && (
                    <View style={styles.emptyCard}>
                        <Wallet size={40} color={colors.mutedForeground} />
                        <Text style={styles.emptyTitle}>No Balance Available</Text>
                        <Text style={styles.emptyText}>Earn referral commission to withdraw</Text>
                    </View>
                )}

                {/* Withdrawal History */}
                <Text style={styles.sectionTitle}>Withdrawal History</Text>
                {data?.withdrawals && data.withdrawals.length > 0 ? (
                    <View style={styles.historyCard}>
                        {data.withdrawals.map((item, index) => (
                            <View key={item._id} style={[styles.historyItem, index < data.withdrawals.length - 1 && styles.historyItemBorder]}>
                                <View style={styles.historyLeft}>
                                    {getStatusIcon(item.status)}
                                    <View style={styles.historyInfo}>
                                        <Text style={styles.historyAmount}>₹{item.amount.toLocaleString()}</Text>
                                        <Text style={styles.historyDate}>
                                            {new Date(item.createdAt).toLocaleDateString()} • {item.paymentMethod.toUpperCase()}
                                        </Text>
                                        {item.paymentMethod === 'upi' && item.upiId && (
                                            <Text style={styles.historyDetail}>{item.upiId}</Text>
                                        )}
                                        {item.paymentMethod === 'bank' && item.bankDetails?.accountNumber && (
                                            <Text style={styles.historyDetail}>A/C: ****{item.bankDetails.accountNumber.slice(-4)}</Text>
                                        )}
                                    </View>
                                </View>
                                <View style={styles.historyRight}>
                                    <Text style={[styles.historyStatus, { color: getStatusColor(item.status) }]}>
                                        {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                                    </Text>
                                    {item.adminNote && (
                                        <Text style={styles.historyNote} numberOfLines={1}>{item.adminNote}</Text>
                                    )}
                                </View>
                            </View>
                        ))}
                    </View>
                ) : (
                    <View style={styles.emptyCard}>
                        <Text style={styles.emptyText}>No withdrawal requests yet</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const createStyles = (colors: any, isDark: boolean, insets: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: insets.top + 8,
        paddingHorizontal: 6,
        paddingBottom: 10,
        backgroundColor: colors.card,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: colors.secondary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.foreground,
    },
    placeholder: {
        width: 36,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 6,
        paddingBottom: 30,
    },
    balanceCard: {
        backgroundColor: colors.card,
        borderRadius: 10,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: colors.border,
    },
    balanceHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    balanceTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.foreground,
    },
    balanceAmount: {
        fontSize: 32,
        fontWeight: '700',
        color: colors.success,
        marginBottom: 12,
    },
    balanceStats: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    balanceStat: {
        flex: 1,
        alignItems: 'center',
    },
    balanceStatLabel: {
        fontSize: 11,
        color: colors.mutedForeground,
        marginBottom: 2,
    },
    balanceStatValue: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.foreground,
    },
    balanceDivider: {
        width: 1,
        height: 30,
        backgroundColor: colors.border,
    },
    formCard: {
        backgroundColor: colors.card,
        borderRadius: 10,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: colors.border,
    },
    formTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.foreground,
        marginBottom: 12,
    },
    inputGroup: {
        marginBottom: 12,
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.foreground,
        marginBottom: 6,
    },
    input: {
        backgroundColor: colors.secondary,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        color: colors.foreground,
        borderWidth: 1,
        borderColor: colors.border,
    },
    methodRow: {
        flexDirection: 'row',
        gap: 8,
    },
    methodBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: colors.secondary,
        borderWidth: 1,
        borderColor: colors.border,
    },
    methodBtnActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    methodBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.foreground,
    },
    methodBtnTextActive: {
        color: colors.white,
    },
    submitBtn: {
        backgroundColor: colors.primary,
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
        marginTop: 4,
    },
    submitBtnDisabled: {
        opacity: 0.6,
    },
    submitBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.white,
    },
    emptyCard: {
        backgroundColor: colors.card,
        borderRadius: 10,
        padding: 24,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        gap: 8,
    },
    emptyTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.foreground,
    },
    emptyText: {
        fontSize: 12,
        color: colors.mutedForeground,
        textAlign: 'center',
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.foreground,
        marginBottom: 8,
        marginTop: 6,
    },
    historyCard: {
        backgroundColor: colors.card,
        borderRadius: 10,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
    },
    historyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 10,
    },
    historyItemBorder: {
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    historyLeft: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        flex: 1,
    },
    historyInfo: {
        flex: 1,
    },
    historyAmount: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.foreground,
    },
    historyDate: {
        fontSize: 11,
        color: colors.mutedForeground,
        marginTop: 2,
    },
    historyDetail: {
        fontSize: 10,
        color: colors.mutedForeground,
        marginTop: 2,
    },
    historyRight: {
        alignItems: 'flex-end',
    },
    historyStatus: {
        fontSize: 11,
        fontWeight: '600',
    },
    historyNote: {
        fontSize: 10,
        color: colors.mutedForeground,
        marginTop: 2,
        maxWidth: 100,
    },
});