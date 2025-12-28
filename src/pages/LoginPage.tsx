import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, AlertCircle, Loader2, ChefHat, ArrowRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { setupAdmin } from '../lib/api'

export function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [setupMessage, setSetupMessage] = useState('')
    const { login } = useAuth()
    const navigate = useNavigate()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setIsLoading(true)

        try {
            await login(email, password)
            navigate('/')
        } catch (err: any) {
            setError(err.response?.data?.message || err.message || 'Login failed')
        } finally {
            setIsLoading(false)
        }
    }

    const handleSetup = async () => {
        setIsLoading(true)
        setError('')
        setSetupMessage('')
        try {
            const response = await setupAdmin()
            if (response.success) {
                setSetupMessage(
                    `Default admin created! Email: ${response.response.email}, Password: Admin@123`
                )
            }
        } catch (err: any) {
            if (err.response?.data?.message) {
                setError(err.response.data.message)
            } else {
                setError('Failed to create default admin')
            }
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex bg-background">
            {/* Left Side - Image & Branding */}
            <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative overflow-hidden">
                {/* Background Image */}
                <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{
                        backgroundImage: `url('https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=2070&auto=format&fit=crop')`,
                    }}
                />
                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/70 to-black/80" />

                {/* Content */}
                <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
                    {/* Logo */}
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl">
                            <ChefHat className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">The Art Of</h1>
                            <p className="text-3xl font-bold text-orange-300">भ ओ जन</p>
                        </div>
                    </div>

                    {/* Main Text */}
                    <div className="max-w-md">
                        <h2 className="text-4xl xl:text-5xl font-bold leading-tight mb-6">
                            Manage Your Food Business Like Never Before
                        </h2>
                        <p className="text-lg text-white/80 leading-relaxed">
                            A powerful admin dashboard to manage orders, users, delivery partners, and grow your food delivery business efficiently.
                        </p>

                        {/* Features */}
                        <div className="mt-8 space-y-4">
                            {[
                                'Real-time order tracking & management',
                                'Complete analytics & insights',
                                'Delivery partner management',
                            ].map((feature, index) => (
                                <div key={index} className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-orange-400" />
                                    <span className="text-white/90">{feature}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="text-sm text-white/60">
                        © 2025 The Art Of भ ओ जन. All rights reserved.
                    </div>
                </div>
            </div>

            {/* Right Side - Login Form */}
            <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
                <div className="w-full max-w-md animate-fade-in">
                    {/* Mobile Logo */}
                    <div className="lg:hidden text-center mb-8">
                        <div className="inline-flex items-center justify-center p-4 bg-primary rounded-2xl mb-4">
                            <ChefHat className="w-10 h-10 text-primary-foreground" />
                        </div>
                        <h1 className="text-xl font-bold text-foreground">The Art Of</h1>
                        <p className="text-2xl font-bold text-primary">भ ओ जन</p>
                    </div>

                    {/* Welcome Text */}
                    <div className="mb-8">
                        <h2 className="text-2xl lg:text-3xl font-bold text-foreground">Welcome back!</h2>
                        <p className="text-muted-foreground mt-2">Sign in to your admin dashboard</p>
                    </div>

                    {/* Login Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Error Message */}
                        {error && (
                            <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive">
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                <span className="text-sm">{error}</span>
                            </div>
                        )}

                        {/* Setup Message */}
                        {setupMessage && (
                            <div className="p-4 bg-success/10 border border-success/20 rounded-xl text-success text-sm">
                                {setupMessage}
                            </div>
                        )}

                        {/* Email Input */}
                        <div className="space-y-2">
                            <label htmlFor="email" className="text-sm font-medium text-foreground">
                                Email Address
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="admin@bhojan.com"
                                className="w-full px-4 py-3.5 bg-muted/50 border border-input rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all placeholder:text-muted-foreground/60"
                                required
                            />
                        </div>

                        {/* Password Input */}
                        <div className="space-y-2">
                            <label htmlFor="password" className="text-sm font-medium text-foreground">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    className="w-full px-4 py-3.5 bg-muted/50 border border-input rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all pr-12 placeholder:text-muted-foreground/60"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {showPassword ? (
                                        <EyeOff className="w-5 h-5" />
                                    ) : (
                                        <Eye className="w-5 h-5" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Login Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 transition-all flex items-center justify-center gap-2 text-base"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                <>
                                    Sign In
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Setup Section */}
                    <div className="mt-8 pt-8 border-t border-border">
                        <p className="text-sm text-muted-foreground text-center mb-4">
                            {/* First time? Create default admin account */}
                        </p>
                        <button
                            onClick={handleSetup}
                            disabled={isLoading}
                            className="w-full py-3.5 bg-muted text-foreground rounded-xl font-medium hover:bg-muted/80 disabled:opacity-50 transition-all border border-border"
                        >
                            Setup Default Admin
                        </button>
                    </div>

                    {/* Help Text */}
                    <p className="text-center text-sm text-muted-foreground mt-6">
                        Need help? Contact{' '}
                        <a href="mailto:support@bhojan.com" className="text-primary hover:underline">
                            support@bhaojan.com
                        </a>
                    </p>
                </div>
            </div>
        </div>
    )
}
