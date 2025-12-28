import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react'
import { Admin, adminLogin, getAdminProfile } from '../lib/api'

interface AuthContextType {
    admin: Admin | null
    isLoading: boolean
    isAuthenticated: boolean
    login: (email: string, password: string) => Promise<void>
    logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [admin, setAdmin] = useState<Admin | null>(() => {
        // Initialize from localStorage to prevent flash
        const savedAdmin = localStorage.getItem('admin_user')
        return savedAdmin ? JSON.parse(savedAdmin) : null
    })
    const [isLoading, setIsLoading] = useState(true)
    const authChecked = useRef(false)

    const checkAuth = useCallback(async () => {
        // Prevent multiple auth checks
        if (authChecked.current) {
            setIsLoading(false)
            return
        }
        authChecked.current = true

        try {
            const token = localStorage.getItem('admin_token')
            if (token) {
                // Try to get fresh profile data
                const response = await getAdminProfile()
                if (response.success) {
                    setAdmin(response.response)
                    localStorage.setItem('admin_user', JSON.stringify(response.response))
                } else {
                    // Profile fetch failed, but we have cached data - use it
                    const savedAdmin = localStorage.getItem('admin_user')
                    if (savedAdmin) {
                        setAdmin(JSON.parse(savedAdmin))
                    } else {
                        // No cached data, clear auth
                        localStorage.removeItem('admin_token')
                        localStorage.removeItem('admin_user')
                        setAdmin(null)
                    }
                }
            } else {
                setAdmin(null)
            }
        } catch (error) {
            // On error, try to use cached admin data
            const savedAdmin = localStorage.getItem('admin_user')
            const token = localStorage.getItem('admin_token')

            if (savedAdmin && token) {
                // Use cached data if available
                setAdmin(JSON.parse(savedAdmin))
            } else {
                // No cached data, clear auth
                localStorage.removeItem('admin_token')
                localStorage.removeItem('admin_user')
                setAdmin(null)
            }
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        checkAuth()
    }, [checkAuth])

    const login = async (email: string, password: string) => {
        const response = await adminLogin(email, password)
        if (response.success) {
            localStorage.setItem('admin_token', response.response.token)
            localStorage.setItem('admin_user', JSON.stringify(response.response.admin))
            setAdmin(response.response.admin)
            authChecked.current = true
        } else {
            throw new Error(response.message)
        }
    }

    const logout = useCallback(() => {
        localStorage.removeItem('admin_token')
        localStorage.removeItem('admin_user')
        setAdmin(null)
        authChecked.current = false
    }, [])

    return (
        <AuthContext.Provider
            value={{
                admin,
                isLoading,
                isAuthenticated: !!admin,
                login,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
