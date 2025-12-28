// File: src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { DashboardLayout } from './components/DashboardLayout'
import { DashboardPage } from './pages/DashboardPage'
import { UsersPage } from './pages/UsersPage'
import { CategoriesPage } from './pages/CategoriesPage'
import { BannersPage } from './pages/BannersPage'
import { DeliveryPartnersPage } from './pages/DeliveryPartnersPage'
import { OrdersPage } from './pages/OrdersPage'
import { CouponsPage } from './pages/CouponsPage'
import { SettingsPage } from './pages/SettingsPage'
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage'
import { ProductsPage } from './pages/ProductsPage'
import { WithdrawalsPage } from './pages/WithdrawalsPage'
import DeleteAccountPage from './pages/DeleteAccountPage'

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
                        <Route path="orders" element={<OrdersPage />} />
                        <Route path="products" element={<ProductsPage />} />
                        <Route path="users" element={<UsersPage />} />
                        <Route path="categories" element={<CategoriesPage />} />
                        <Route path="coupons" element={<CouponsPage />} />
                        <Route path="banners" element={<BannersPage />} />
                        <Route path="delivery-partners" element={<DeliveryPartnersPage />} />
                        <Route path="withdrawals" element={<WithdrawalsPage />} />
                        <Route path="settings" element={<SettingsPage />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    )
}

export default App
