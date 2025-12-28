import { Shield, Database, Lock, Eye, UserCheck, Bell, MapPin, Trash2, Phone, Mail, Building } from 'lucide-react';

export function PrivacyPolicyPage() {
    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="bg-card border-b border-border sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                        <Shield className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-foreground">The Art Of भ ओ जन - Privacy Policy</h1>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-8">
                {/* Hero Section */}
                <div className="text-center mb-10">
                    <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Shield className="w-8 h-8 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">Your Privacy Matters</h2>
                    <p className="text-muted-foreground max-w-2xl mx-auto">
                        At The Art Of भ ओ जन, we are committed to protecting your personal information.
                        This Privacy Policy explains how we collect, use, disclose, and safeguard your information
                        when you use our mobile applications and services.
                    </p>
                    <p className="text-sm text-muted-foreground mt-4">
                        <strong>Effective Date:</strong> January 1, 2025 | <strong>Last Updated:</strong> December 22, 2025
                    </p>
                </div>

                {/* Apps Covered */}
                <div className="bg-card border border-border rounded-xl p-6 mb-8">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Applications Covered by This Policy</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="bg-background rounded-lg p-4 border border-border">
                            <h4 className="font-medium text-foreground mb-2">The Art Of भ ओ जन E-commerce App</h4>
                            <p className="text-sm text-muted-foreground">
                                Customer-facing app for browsing products, placing orders, and managing purchases.
                            </p>
                        </div>
                        <div className="bg-background rounded-lg p-4 border border-border">
                            <h4 className="font-medium text-foreground mb-2">The Art Of भ ओ जन Delivery Partner App</h4>
                            <p className="text-sm text-muted-foreground">
                                Delivery partner app for managing deliveries, earnings, and order fulfillment.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Policy Sections */}
                <div className="space-y-6">
                    {/* Information Collection */}
                    <PolicySection
                        icon={<Database className="w-5 h-5 text-primary" />}
                        title="1. Information We Collect"
                        content={
                            <div className="space-y-4">
                                <div>
                                    <h4 className="font-medium text-foreground mb-2">Personal Information</h4>
                                    <ul className="list-disc list-inside text-muted-foreground space-y-1 text-sm">
                                        <li>Name, email address, and phone number</li>
                                        <li>Profile photo and account credentials</li>
                                        <li>Delivery addresses and location data</li>
                                        <li>Payment information (processed securely via third-party payment gateways)</li>
                                    </ul>
                                </div>
                                <div>
                                    <h4 className="font-medium text-foreground mb-2">For Delivery Partners (Additional)</h4>
                                    <ul className="list-disc list-inside text-muted-foreground space-y-1 text-sm">
                                        <li>Identity documents: Aadhaar Card, PAN Card, Driving License</li>
                                        <li>Vehicle information: Registration number, type, and photos</li>
                                    </ul>
                                </div>
                                <div>
                                    <h4 className="font-medium text-foreground mb-2">Device & Usage Information</h4>
                                    <ul className="list-disc list-inside text-muted-foreground space-y-1 text-sm">
                                        <li>Device type, operating system, and app version</li>
                                        <li>IP address and device identifiers</li>
                                        <li>App usage patterns and interaction data</li>
                                        <li>Push notification tokens</li>
                                    </ul>
                                </div>
                            </div>
                        }
                    />

                    {/* How We Use Information */}
                    <PolicySection
                        icon={<Eye className="w-5 h-5 text-primary" />}
                        title="2. How We Use Your Information"
                        content={
                            <ul className="list-disc list-inside text-muted-foreground space-y-2 text-sm">
                                <li>To create and manage your account</li>
                                <li>To process orders, payments, and deliveries</li>
                                <li>To verify delivery partner identity and eligibility (KYC)</li>
                                <li>To provide real-time order tracking and delivery updates</li>
                                <li>To calculate and process delivery partner earnings</li>
                                <li>To send important notifications about orders and account updates</li>
                                <li>To provide customer support and resolve disputes</li>
                                <li>To improve our services and user experience</li>
                                <li>To comply with legal obligations and prevent fraud</li>
                            </ul>
                        }
                    />

                    {/* Location Data */}
                    <PolicySection
                        icon={<MapPin className="w-5 h-5 text-primary" />}
                        title="3. Location Data Collection"
                        content={
                            <div className="space-y-3">
                                <p className="text-sm text-muted-foreground">
                                    <strong className="text-foreground">For Customers:</strong> We collect location data to provide accurate delivery addresses and show nearby vendors/products.
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    <strong className="text-foreground">For Delivery Partners:</strong> We collect location data when you are online and available for deliveries. This is used to:
                                </p>
                                <ul className="list-disc list-inside text-muted-foreground space-y-1 text-sm ml-4">
                                    <li>Assign nearby delivery orders efficiently</li>
                                    <li>Provide navigation assistance</li>
                                    <li>Share live delivery tracking with customers</li>
                                    <li>Calculate accurate delivery distances and times</li>
                                </ul>
                                <p className="text-sm text-muted-foreground">
                                    You can disable location access through your device settings, but this may affect app functionality.
                                </p>
                            </div>
                        }
                    />

                    {/* Data Security */}
                    <PolicySection
                        icon={<Lock className="w-5 h-5 text-primary" />}
                        title="4. Data Security"
                        content={
                            <div className="space-y-3">
                                <p className="text-sm text-muted-foreground">
                                    We implement industry-standard security measures to protect your personal information:
                                </p>
                                <ul className="list-disc list-inside text-muted-foreground space-y-1 text-sm">
                                    <li>SSL/TLS encryption for all data transmission</li>
                                    <li>Secure servers with regular security audits</li>
                                    <li>Access controls and authentication mechanisms</li>
                                    <li>Payment data processed through PCI-DSS compliant payment gateways</li>
                                    <li>KYC documents stored with encryption</li>
                                    <li>Regular vulnerability assessments and penetration testing</li>
                                </ul>
                            </div>
                        }
                    />

                    {/* Data Sharing */}
                    <PolicySection
                        icon={<UserCheck className="w-5 h-5 text-primary" />}
                        title="5. Data Sharing and Disclosure"
                        content={
                            <div className="space-y-3">
                                <p className="text-sm text-muted-foreground">We may share your information with:</p>
                                <ul className="list-disc list-inside text-muted-foreground space-y-2 text-sm">
                                    <li><strong className="text-foreground">Delivery Partners & Customers:</strong> Name and phone number for delivery coordination</li>
                                    <li><strong className="text-foreground">Vendors:</strong> Order details for order preparation</li>
                                    <li><strong className="text-foreground">Payment Processors:</strong> Payment information for transaction processing</li>
                                    <li><strong className="text-foreground">Service Providers:</strong> Third-party services for analytics, notifications, and cloud hosting</li>
                                    <li><strong className="text-foreground">Legal Authorities:</strong> When required by law, court order, or legal process</li>
                                </ul>
                                <p className="text-sm text-muted-foreground font-medium mt-4">
                                    We do NOT sell your personal information to third parties for marketing purposes.
                                </p>
                            </div>
                        }
                    />

                    {/* Notifications */}
                    <PolicySection
                        icon={<Bell className="w-5 h-5 text-primary" />}
                        title="6. Notifications and Communications"
                        content={
                            <div className="space-y-3">
                                <p className="text-sm text-muted-foreground">We send notifications for:</p>
                                <ul className="list-disc list-inside text-muted-foreground space-y-1 text-sm">
                                    <li>Order confirmations, updates, and delivery status</li>
                                    <li>New delivery requests (for delivery partners)</li>
                                    <li>Payment and earnings notifications</li>
                                    <li>Account security alerts</li>
                                    <li>Important service announcements</li>
                                </ul>
                                <p className="text-sm text-muted-foreground">
                                    You can manage notification preferences in your app settings. Marketing communications require your explicit consent.
                                </p>
                            </div>
                        }
                    />

                    {/* Data Retention */}
                    <PolicySection
                        icon={<Trash2 className="w-5 h-5 text-primary" />}
                        title="7. Data Retention and Deletion"
                        content={
                            <div className="space-y-3">
                                <ul className="list-disc list-inside text-muted-foreground space-y-2 text-sm">
                                    <li>We retain your personal information for as long as your account is active</li>
                                    <li>Order and transaction data is retained for 7 years for legal and tax compliance</li>
                                    <li>KYC documents are retained as per regulatory requirements</li>
                                    <li>Location data is retained for 30 days for service improvement</li>
                                </ul>
                                <p className="text-sm text-muted-foreground mt-2">
                                    You can request account deletion at any time. Upon deletion request:
                                </p>
                                <ul className="list-disc list-inside text-muted-foreground space-y-1 text-sm">
                                    <li>Personal data will be deleted within 30 days</li>
                                    <li>Some anonymized data may be retained for analytics</li>
                                    <li>Data required for legal compliance will be retained as per law</li>
                                </ul>
                            </div>
                        }
                    />

                    {/* User Rights */}
                    <PolicySection
                        icon={<UserCheck className="w-5 h-5 text-primary" />}
                        title="8. Your Rights"
                        content={
                            <div className="space-y-3">
                                <p className="text-sm text-muted-foreground">You have the right to:</p>
                                <ul className="list-disc list-inside text-muted-foreground space-y-1 text-sm">
                                    <li><strong className="text-foreground">Access:</strong> Request a copy of your personal data</li>
                                    <li><strong className="text-foreground">Correction:</strong> Request correction of inaccurate information</li>
                                    <li><strong className="text-foreground">Deletion:</strong> Request deletion of your account and data</li>
                                    <li><strong className="text-foreground">Data Portability:</strong> Request your data in a machine-readable format</li>
                                    <li><strong className="text-foreground">Opt-out:</strong> Unsubscribe from marketing communications</li>
                                    <li><strong className="text-foreground">Withdraw Consent:</strong> Withdraw previously given consent for data processing</li>
                                </ul>
                                <p className="text-sm text-muted-foreground">
                                    To exercise these rights, contact us through the app's Help & Support section or via email.
                                </p>
                            </div>
                        }
                    />

                    {/* Children's Privacy */}
                    <PolicySection
                        icon={<Shield className="w-5 h-5 text-primary" />}
                        title="9. Children's Privacy"
                        content={
                            <p className="text-sm text-muted-foreground">
                                Our services are not intended for children under 18 years of age. We do not knowingly collect personal information from children. If you believe a child has provided us with personal information, please contact us immediately, and we will take steps to delete such information.
                            </p>
                        }
                    />

                    {/* Third-Party Services */}
                    <PolicySection
                        icon={<Database className="w-5 h-5 text-primary" />}
                        title="10. Third-Party Services"
                        content={
                            <div className="space-y-3">
                                <p className="text-sm text-muted-foreground">
                                    Our apps may integrate with third-party services including:
                                </p>
                                <ul className="list-disc list-inside text-muted-foreground space-y-1 text-sm">
                                    <li>Payment gateways (Razorpay, UPI providers)</li>
                                    <li>Map and navigation services (Google Maps)</li>
                                    <li>Analytics services</li>
                                    <li>Push notification services</li>
                                    <li>Cloud hosting providers</li>
                                </ul>
                                <p className="text-sm text-muted-foreground">
                                    These third-party services have their own privacy policies. We encourage you to review their policies.
                                </p>
                            </div>
                        }
                    />

                    {/* Policy Updates */}
                    <PolicySection
                        icon={<Bell className="w-5 h-5 text-primary" />}
                        title="11. Changes to This Policy"
                        content={
                            <p className="text-sm text-muted-foreground">
                                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date. We encourage you to review this Privacy Policy periodically for any changes.
                            </p>
                        }
                    />
                </div>

                {/* Contact Information */}
                <div className="mt-10 bg-card border border-border rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Contact Us</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        If you have any questions about this Privacy Policy or our data practices, please contact us:
                    </p>
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                                <Mail className="w-4 h-4 text-primary" />
                            </div>
                            <span className="text-sm text-muted-foreground">privacy@theartofbhaojan.com</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                                <Phone className="w-4 h-4 text-primary" />
                            </div>
                            <span className="text-sm text-muted-foreground">+91 748 930 1982</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                                <Building className="w-4 h-4 text-primary" />
                            </div>
                            <span className="text-sm text-muted-foreground">The Art Of भ ओ जन Technologies Pvt Ltd</span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-8 text-center text-sm text-muted-foreground">
                    <p>© 2025 The Art Of भ ओ जन. All rights reserved.</p>
                </div>
            </main>
        </div>
    );
}

interface PolicySectionProps {
    icon: React.ReactNode;
    title: string;
    content: React.ReactNode;
}

function PolicySection({ icon, title, content }: PolicySectionProps) {
    return (
        <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                    {icon}
                </div>
                <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            </div>
            {content}
        </div>
    );
}