/// File: src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { DashboardLayout } from './components/DashboardLayout'
import { DashboardPage } from './pages/DashboardPage'
import { UsersPage } from './pages/UsersPage'
import { Purchase } from './pages/Purchase'
import { BannersPage } from './pages/BannersPage'
import { SettingsPage } from './pages/SettingsPage'
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage'
import { ProductsPage } from './pages/ProductsPage'
import DeleteAccountPage from './pages/DeleteAccountPage'
import { AdminOrdersPage } from './pages/AdminOrdersPage'
import { SellingMembersPage } from './pages/SellingMembersPage'
import { SellingEntriesPage } from './pages/SellingEntriesPage'
import { SellingPaymentsPage } from './pages/SellingPaymentsPage'
import { SellingReportPage } from './pages/SellingReportPage'
import { RegisterFarmersPage } from './pages/RegisterFarmersPage'
import { RegisterAdvancesPage } from './pages/RegisterAdvancesPage'
import { RegisterPaymentsPage } from './pages/RegisterPaymentsPage'
import { ProductManagementPage } from './pages/ProductManagementPage'
import { SubscriptionsPage } from './pages/SubscriptionsPage'
import { CustomFormsPage } from './pages/CustomFormsPage'
import { ActiveSubscriptionsPage } from './pages/ActiveSubscriptionsPage'
import { WithdrawalsPage } from './pages/WithdrawalsPage'
import { SocialLinksPage } from './pages/SocialLinksPage'
import { CollectionReportPage } from './pages/CollectionReportPage'
import { CollectionFarmersPage } from './pages/CollectionFarmersPage'
import { AppVersionPage } from './pages/AppVersionPage'
import { PaymentSettingsPage } from './pages/PaymentSettingsPage'
import { WhatsappSettingsPage } from './pages/WhatsappSettingsPage'
import { NotificationsPage } from './pages/NotificationsPage'

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    {/* Public Routes (No Login Required) */}
                    <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
                    <Route path="/delete-account" element={<DeleteAccountPage />} />

                    <Route path="/login" element={<LoginPage />} />
                    <Route
                        path="/"
                        element={
                            <ProtectedRoute>
                                <DashboardLayout />
                            </ProtectedRoute>
                        }
                    >
                        <Route index element={<DashboardPage />} />
                        <Route path="products" element={<ProductsPage />} />
                        <Route path="product-management" element={<ProductManagementPage />} />
                        <Route path="users" element={<UsersPage />} />
                        <Route path="banners" element={<BannersPage />} />
                        <Route path="admin-orders" element={<AdminOrdersPage />} />
                        <Route path="purchase" element={<Purchase />} />
                        <Route path="collection-data" element={<Purchase />} />
                        <Route path="collection-report" element={<CollectionReportPage />} />
                        <Route path="collection-farmers" element={<CollectionFarmersPage />} />
                        <Route path="selling-members" element={<SellingMembersPage />} />
                        <Route path="selling-entries" element={<SellingEntriesPage />} />
                        <Route path="selling-payments" element={<SellingPaymentsPage />} />
                        <Route path="selling-report" element={<SellingReportPage />} />
                        <Route path="register-farmers" element={<RegisterFarmersPage />} />
                        <Route path="register-advances" element={<RegisterAdvancesPage />} />
                        <Route path="register-payments" element={<RegisterPaymentsPage />} />
                        <Route path="subscriptions" element={<SubscriptionsPage />} />
                        <Route path="active-subscriptions" element={<ActiveSubscriptionsPage />} />
                        <Route path="withdrawals" element={<WithdrawalsPage />} />
                        <Route path="custom-forms" element={<CustomFormsPage />} />
                        <Route path="settings" element={<SettingsPage />} />
                        <Route path="social-links" element={<SocialLinksPage />} />
                        <Route path="app-version" element={<AppVersionPage />} />
                        <Route path="payment-settings" element={<PaymentSettingsPage />} />
                        <Route path="whatsapp-settings" element={<WhatsappSettingsPage />} />
                        <Route path="notifications" element={<NotificationsPage />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    )
}

export default App
