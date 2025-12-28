// File: src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { DashboardLayout } from './components/DashboardLayout'
import { DashboardPage } from './pages/DashboardPage'
import { UsersPage } from './pages/UsersPage'
import { BannersPage } from './pages/BannersPage'
import { OrdersPage } from './pages/OrdersPage'
import { SettingsPage } from './pages/SettingsPage'
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage'
import { ProductsPage } from './pages/ProductsPage'
import DeleteAccountPage from './pages/DeleteAccountPage'
import { AdminOrdersPage } from './pages/AdminOrdersPage'
import { AdminPurchasePage } from './pages/adminPurchasePage'

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
                        <Route path="banners" element={<BannersPage />} />
                        <Route path="admin-orders" element={<AdminOrdersPage />} />
                        <Route path="purchase" element={<AdminPurchasePage />} />
                        <Route path="settings" element={<SettingsPage />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    )
}

export default App
