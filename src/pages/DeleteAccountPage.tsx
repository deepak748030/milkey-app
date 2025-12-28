import { useState, useEffect, useRef } from "react";
import { Trash2, Phone, Shield, CheckCircle, AlertTriangle, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import api from "@/lib/api";

type Step = "phone" | "otp" | "confirm" | "success" | "error";

const DeleteAccountPage = () => {
    const [step, setStep] = useState<Step>("phone");
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState(["", "", "", "", "", ""]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [countdown, setCountdown] = useState(0);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/\D/g, "").slice(0, 10);
        setPhone(value);
        setError("");
    };

    const handleSendOtp = async () => {
        if (phone.length !== 10) {
            setError("Please enter a valid 10-digit mobile number");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const fullPhone = `+91${phone}`;
            const response = await api.post("/auth/delete-account/send-otp", { phone: fullPhone });
            if (response.data.success) {
                if (!response.data.response.userExists) {
                    setError("No account found with this mobile number");
                    setLoading(false);
                    return;
                }
                setStep("otp");
                setCountdown(30);
            } else {
                setError(response.data.message || "Failed to send OTP");
            }
        } catch (err: any) {
            setError(err.response?.data?.message || "Failed to send OTP. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleOtpChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return;

        const newOtp = [...otp];
        newOtp[index] = value.slice(-1);
        setOtp(newOtp);
        setError("");

        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace" && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleOtpPaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
        const newOtp = [...otp];
        for (let i = 0; i < pastedData.length; i++) {
            newOtp[i] = pastedData[i];
        }
        setOtp(newOtp);
        if (pastedData.length === 6) {
            inputRefs.current[5]?.focus();
        }
    };

    const handleVerifyOtp = async () => {
        const otpString = otp.join("");
        if (otpString.length !== 6) {
            setError("Please enter the complete 6-digit OTP");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const fullPhone = `+91${phone}`;
            const response = await api.post("/auth/delete-account/verify-otp", { phone: fullPhone, otp: otpString });
            if (response.data.success) {
                setStep("confirm");
            } else {
                setError(response.data.message || "Invalid OTP");
            }
        } catch (err: any) {
            setError(err.response?.data?.message || "Invalid OTP. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAccount = async () => {
        setLoading(true);
        setError("");

        try {
            const fullPhone = `+91${phone}`;
            const response = await api.post("/auth/delete-account/confirm", { phone: fullPhone });
            if (response.data.success) {
                setStep("success");
            } else {
                setError(response.data.message || "Failed to delete account");
                setStep("error");
            }
        } catch (err: any) {
            setError(err.response?.data?.message || "Failed to delete account. Please try again.");
            setStep("error");
        } finally {
            setLoading(false);
        }
    };

    const handleResendOtp = async () => {
        if (countdown > 0) return;
        setLoading(true);
        try {
            const fullPhone = `+91${phone}`;
            await api.post("/auth/delete-account/send-otp", { phone: fullPhone });
            setCountdown(30);
            setOtp(["", "", "", "", "", ""]);
        } catch (err) {
            setError("Failed to resend OTP");
        } finally {
            setLoading(false);
        }
    };

    const resetFlow = () => {
        setStep("phone");
        setPhone("");
        setOtp(["", "", "", "", "", ""]);
        setError("");
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50">
            {/* Header */}
            <header className="bg-white shadow-sm border-b border-red-100">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
                    <Link to="/" className="text-gray-600 hover:text-gray-900">
                        <ArrowLeft size={24} />
                    </Link>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                            <Trash2 className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Account & Data Deletion</h1>
                            <p className="text-sm text-gray-500">Bhaojan App</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-xl mx-auto px-4 py-8">
                {/* Info Card */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6">
                    <div className="flex items-start gap-3 mb-4">
                        <Shield className="w-6 h-6 text-blue-500 mt-0.5" />
                        <div>
                            <h2 className="font-semibold text-gray-900 mb-1">Secure Deletion Process</h2>
                            <p className="text-sm text-gray-600">
                                This app allows users to request deletion of their account and associated personal data.
                            </p>
                        </div>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-4 mb-4">
                        <h3 className="font-medium text-gray-900 mb-2">Deletion process:</h3>
                        <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
                            <li>Enter your registered mobile number</li>
                            <li>Verify your identity using OTP</li>
                            <li>Confirm account deletion</li>
                        </ol>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <div className="flex items-start gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                            <div className="text-sm text-amber-800">
                                <strong>Important:</strong> Once the request is verified, the account and all associated personal data will be permanently deleted within 7 days.
                            </div>
                        </div>
                    </div>
                </div>

                {/* Step Content */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                    {step === "phone" && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Phone className="w-8 h-8 text-red-600" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900">Enter Mobile Number</h3>
                                <p className="text-sm text-gray-500 mt-1">Enter the mobile number registered with your account</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Mobile Number
                                </label>
                                <div className="flex items-center border border-gray-300 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-red-500 focus-within:border-red-500">
                                    <span className="px-4 py-3 bg-gray-50 text-gray-600 border-r border-gray-300">+91</span>
                                    <input
                                        type="tel"
                                        value={phone}
                                        onChange={handlePhoneChange}
                                        placeholder="Enter 10-digit number"
                                        className="flex-1 px-4 py-3 outline-none text-gray-900 placeholder-gray-400"
                                        maxLength={10}
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                                    {error}
                                </div>
                            )}

                            <button
                                onClick={handleSendOtp}
                                disabled={loading || phone.length !== 10}
                                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-xl transition-colors"
                            >
                                {loading ? "Sending OTP..." : "Send OTP"}
                            </button>
                        </div>
                    )}

                    {step === "otp" && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Shield className="w-8 h-8 text-blue-600" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900">Verify OTP</h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    Enter the 6-digit OTP sent to +91 {phone}
                                </p>
                            </div>

                            <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
                                {otp.map((digit, index) => (
                                    <input
                                        key={index}
                                        ref={(el) => (inputRefs.current[index] = el)}
                                        type="text"
                                        inputMode="numeric"
                                        value={digit}
                                        onChange={(e) => handleOtpChange(index, e.target.value)}
                                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                                        className="w-12 h-14 text-center text-xl font-bold border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none bg-white text-gray-900"
                                        maxLength={1}
                                    />
                                ))}
                            </div>

                            {error && (
                                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm text-center">
                                    {error}
                                </div>
                            )}

                            <button
                                onClick={handleVerifyOtp}
                                disabled={loading || otp.join("").length !== 6}
                                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-xl transition-colors"
                            >
                                {loading ? "Verifying..." : "Verify OTP"}
                            </button>

                            <div className="text-center">
                                <button
                                    onClick={handleResendOtp}
                                    disabled={countdown > 0 || loading}
                                    className="text-sm text-red-600 hover:text-red-700 disabled:text-gray-400"
                                >
                                    {countdown > 0 ? `Resend OTP in ${countdown}s` : "Resend OTP"}
                                </button>
                            </div>

                            <button
                                onClick={resetFlow}
                                className="w-full text-gray-600 hover:text-gray-900 text-sm py-2"
                            >
                                ← Change mobile number
                            </button>
                        </div>
                    )}

                    {step === "confirm" && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Trash2 className="w-8 h-8 text-red-600" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900">Confirm Deletion</h3>
                                <p className="text-sm text-gray-500 mt-1">This action cannot be undone</p>
                            </div>

                            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                                <h4 className="font-medium text-red-900 mb-2">The following data will be deleted:</h4>
                                <ul className="text-sm text-red-800 space-y-1">
                                    <li>• User profile and personal information</li>
                                    <li>• Phone number and email</li>
                                    <li>• Order history</li>
                                    <li>• Saved addresses</li>
                                    <li>• Wallet balance and transactions</li>
                                    <li>• All app activity data</li>
                                </ul>
                            </div>

                            {error && (
                                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                                    {error}
                                </div>
                            )}

                            <button
                                onClick={handleDeleteAccount}
                                disabled={loading}
                                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
                            >
                                {loading ? "Deleting Account..." : "Delete My Account"}
                            </button>

                            <button
                                onClick={resetFlow}
                                className="w-full border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold py-3 px-4 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    )}

                    {step === "success" && (
                        <div className="space-y-6 text-center">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                                <CheckCircle className="w-8 h-8 text-green-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Account Deletion Requested</h3>
                                <p className="text-sm text-gray-500 mt-2">
                                    Your account and associated data will be permanently deleted within 7 days.
                                </p>
                            </div>
                            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
                                You will receive a confirmation once your data has been completely removed from our systems.
                            </div>
                            <Link
                                to="/"
                                className="inline-block w-full bg-gray-900 hover:bg-gray-800 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
                            >
                                Return to Home
                            </Link>
                        </div>
                    )}

                    {step === "error" && (
                        <div className="space-y-6 text-center">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                                <AlertTriangle className="w-8 h-8 text-red-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Something Went Wrong</h3>
                                <p className="text-sm text-gray-500 mt-2">{error || "Failed to delete account. Please try again."}</p>
                            </div>
                            <button
                                onClick={resetFlow}
                                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
                            >
                                Try Again
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer Info */}
                <div className="mt-8 text-center text-sm text-gray-500">
                    <p>For security reasons, deletion is only allowed after OTP verification.</p>
                    <p className="mt-2">
                        Need help?{" "}
                        <a href="mailto:support@bhaojan.com" className="text-red-600 hover:text-red-700">
                            Contact Support
                        </a>
                    </p>
                </div>
            </main>
        </div>
    );
};

export default DeleteAccountPage;
